#!/usr/bin/env node

/**
 * CC-Supervisor Claude Proxy - Automatic verification and fix system
 * Transparent terminal proxy using node-pty
 */

const pty = require('node-pty');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// ANSI 颜色代码（提前定义，供 getSessionId 使用）
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// 获取 session ID（仅用于命令行参数）
function getSessionIdFromArgs() {
  // 1. 优先使用命令行参数指定的 session ID
  const args = process.argv.slice(2);
  const sessionIndex = args.indexOf('--session');
  if (sessionIndex !== -1 && args[sessionIndex + 1]) {
    const specifiedSession = args[sessionIndex + 1];
    console.log(`${colors.cyan}📌 使用指定 session: ${specifiedSession}${colors.reset}`);
    return specifiedSession;
  }
  
  // 2. 尝试从 active-session 文件读取
  const projectPath = process.cwd();
  const projectName = projectPath.replace(/\//g, '-').replace(/^-/, '');
  
  // 先尝试从 .cc-supervisor 目录读取 active-session
  const supervisorProjectDir = path.join(require('os').homedir(), '.cc-supervisor', 'projects', projectName);
  const activeSessionFile = path.join(supervisorProjectDir, 'active-session');
  
  if (fs.existsSync(activeSessionFile)) {
    try {
      const activeSession = fs.readFileSync(activeSessionFile, 'utf-8').trim();
      if (activeSession) {
        console.log(`${colors.green}📋 使用活跃 session: ${activeSession.substring(0, 8)}...${colors.reset}`);
        return activeSession;
      }
    } catch (err) {
      // 忽略读取错误，继续尝试其他方法
    }
  }
  
  // 3. 尝试获取活跃的 Claude session ID（后备方案）
  const claudeProjectDir = path.join(require('os').homedir(), '.claude', 'projects', projectName);
  
  if (fs.existsSync(claudeProjectDir)) {
    // 获取所有 session 文件，按修改时间排序
    const now = Date.now();
    const files = fs.readdirSync(claudeProjectDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => {
        const stats = fs.statSync(path.join(claudeProjectDir, f));
        return {
          name: f.replace('.jsonl', ''),
          path: path.join(claudeProjectDir, f),
          mtime: stats.mtime,
          size: stats.size,
          ageMinutes: Math.floor((now - stats.mtime.getTime()) / 60000)
        };
      })
      .filter(f => f.size > 0) // 排除空文件
      .sort((a, b) => b.mtime - a.mtime);
    
    if (files.length > 0) {
      // 检查是否有最近活跃的 session（5分钟内有更新）
      const activeSessions = files.filter(f => f.ageMinutes <= 5);
      
      if (activeSessions.length === 1) {
        console.log(`${colors.green}🔗 检测到活跃 Claude session: ${activeSessions[0].name}${colors.reset}`);
        return activeSessions[0].name;
      } else if (activeSessions.length > 1) {
        console.log(`${colors.yellow}⚠️  检测到多个活跃 session:${colors.reset}`);
        activeSessions.slice(0, 3).forEach((s, i) => {
          console.log(`   ${i+1}. ${s.name} (${s.ageMinutes}分钟前活跃)`);
        });
        console.log(`${colors.cyan}💡 使用最新的: ${activeSessions[0].name}${colors.reset}`);
        console.log(`${colors.gray}   提示: 使用 --session <id> 指定特定 session${colors.reset}`);
        return activeSessions[0].name;
      } else {
        // 没有活跃 session，使用最新的
        console.log(`${colors.yellow}⚠️  无活跃 session，使用最新的: ${files[0].name}${colors.reset}`);
        console.log(`${colors.gray}   (最后活跃: ${files[0].ageMinutes}分钟前)${colors.reset}`);
        return files[0].name;
      }
    }
  }
  
  // 4. 生成新的 UUID 格式的 session ID
  const crypto = require('crypto');
  const uuid = crypto.randomUUID();
  console.log(`${colors.yellow}⚠️  未找到 Claude session，生成新 ID: ${uuid}${colors.reset}`);
  console.log(`${colors.yellow}💡 提示: 使用 --session <uuid> 指定特定 session${colors.reset}`);
  return uuid;
}

// 不在初始化时读取 session，等待 SessionStart hook
const projectPath = process.cwd();
const projectName = projectPath.replace(/\//g, '-').replace(/^-/, '');

// 创建 supervisor 专用目录（结构与 Claude 一致）
const supervisorDir = path.join(require('os').homedir(), '.cc-supervisor', 'projects', projectName);
if (!fs.existsSync(supervisorDir)) {
  fs.mkdirSync(supervisorDir, { recursive: true });
}

// 基础配置，session相关的路径会动态更新
const CONFIG = {
  idleCheckInterval: 500,
  maxWaitForIdle: 30000,
  duplicateFixTimeout: 300000, // 5分钟
  projectPath: projectPath,  // 保存项目路径
  projectName: projectName,  // 项目名称
  sessionDir: supervisorDir,  // session 目录
  // 动态属性，会在运行时更新
  currentSessionId: null,  // 当前活跃的 session ID
  issuesFile: null,  // 动态路径
  supervisorLog: null,  // 动态路径
  fixHistoryFile: null  // 动态路径
};

class ClaudeProxy extends EventEmitter {
  constructor() {
    super();
    this.ptyProcess = null;
    this.isIdle = true;
    this.lastOutput = '';
    this.outputBuffer = '';
    this.inputQueue = [];
    this.fixHistory = {};
    this.supervisorActive = false;
    this.lastActivityTime = Date.now();
    this.currentSessionId = null;  // 当前活跃的 session ID
    this.activeSessionFile = path.join(CONFIG.sessionDir, 'active-session');
    this.sessionCheckInterval = null;  // 定时检查 session 的 timer
    this.issuesCheckInterval = null;  // 定时检查 issues 文件
    this.lastIssuesSize = 0;  // 上次 issues 文件大小
  }
  
  /**
   * 动态更新 session ID 和相关路径
   */
  updateSessionId(newSessionId) {
    if (newSessionId && newSessionId !== this.currentSessionId) {
      const oldSession = this.currentSessionId;
      this.currentSessionId = newSessionId;
      CONFIG.currentSessionId = newSessionId;
      CONFIG.issuesFile = path.join(CONFIG.sessionDir, `${newSessionId}.issues`);
      CONFIG.supervisorLog = path.join(CONFIG.sessionDir, `${newSessionId}.log`);
      CONFIG.fixHistoryFile = path.join(CONFIG.sessionDir, `${newSessionId}.history.json`);
      
      // 重新加载修复历史
      this.fixHistory = this.loadFixHistory();
      
      console.error(`[SESSION] 🔄 切换 session: ${oldSession ? oldSession.substring(0,8) : 'null'} -> ${newSessionId.substring(0, 8)}`);
      console.error(`[SESSION] 📝 监控文件: ${CONFIG.issuesFile}`);
      this.log(`🔄 切换到新 session: ${newSessionId.substring(0, 8)}...`);
      
      
      // 重置 issues 文件状态
      this.lastIssuesSize = 0;
      
      // 立即检查新 session 的 issues 文件
      this.checkIssuesFile();
    }
  }
  
  /**
   * 检查 issues 文件
   */
  checkIssuesFile() {
    if (!CONFIG.issuesFile || !this.currentSessionId) {
      return;
    }
    
    try {
      if (fs.existsSync(CONFIG.issuesFile)) {
        const stats = fs.statSync(CONFIG.issuesFile);
        const currentSize = stats.size;
        
        // 有新内容
        if (currentSize > this.lastIssuesSize && currentSize > 0) {
          console.error(`[ISSUES] 🔴 发现问题文件: ${CONFIG.issuesFile} (${currentSize} bytes)`);
          
          const issues = fs.readFileSync(CONFIG.issuesFile, 'utf-8');
          console.error(`[ISSUES] 📄 内容: ${issues.substring(0, 100)}...`);
          
          // 删除文件
          fs.unlinkSync(CONFIG.issuesFile);
          this.lastIssuesSize = 0;
          
          // 处理问题
          this.handleIssues(issues).catch(err => {
            console.error(`[ISSUES] 处理失败: ${err.message}`);
          });
        } else {
          this.lastIssuesSize = currentSize;
        }
      }
    } catch (err) {
      console.error(`[ISSUES] 检查失败: ${err.message}`);
    }
  }
  
  /**
   * 处理发现的问题
   */
  async handleIssues(issues) {
    console.error(`[ISSUES] 🎯 开始处理问题...`);
    
    // 生成修复命令
    const fixCommand = `请分析并修复以下问题：\n${issues}`;
    
    // 注入命令
    await this.injectCommand(fixCommand);
  }
  
  /**
   * 检查并更新活跃 session
   */
  checkActiveSession() {
    try {
      if (fs.existsSync(this.activeSessionFile)) {
        const activeSession = fs.readFileSync(this.activeSessionFile, 'utf-8').trim();
        if (activeSession && activeSession !== this.currentSessionId) {
          console.error(`[SESSION] 🆕 发现新 session: ${activeSession.substring(0,8)}...`);
          this.updateSessionId(activeSession);
        }
      }
    } catch (err) {
      // 忽略错误
    }
  }
  
  /**
   * 获取要传递给 Claude 的参数
   */
  getClaudeArgs() {
    const args = process.argv.slice(2);
    const filteredArgs = [];
    
    // cc-supervisor-claude 特有的参数（需要过滤）
    const supervisorArgs = ['--session', '--debug', '--help', '-h'];
    
    let skipNext = false;
    for (let i = 0; i < args.length; i++) {
      if (skipNext) {
        skipNext = false;
        continue;
      }
      
      const arg = args[i];
      
      // 检查是否是 supervisor 特有参数
      if (supervisorArgs.includes(arg)) {
        // 如果是 --session，还需要跳过下一个参数（session ID）
        if (arg === '--session') {
          skipNext = true;
        }
        continue;
      }
      
      // 检查是否以 supervisor 参数开头（如 --session=xxx）
      if (supervisorArgs.some(sa => arg.startsWith(sa + '='))) {
        continue;
      }
      
      // 这是要传递给 Claude 的参数
      filteredArgs.push(arg);
    }
    
    return filteredArgs;
  }

  /**
   * 启动代理
   */
  start() {
    console.log(`${colors.green}🚀 启动 Claude 透明代理...${colors.reset}`);
    console.log(`${colors.yellow}📁 项目: ${CONFIG.projectPath}${colors.reset}`);
    console.log(`${colors.yellow}🔄 Session: 等待 SessionStart hook 提供${colors.reset}`);
    
    // 获取要传递给 Claude 的参数（过滤掉 cc-supervisor-claude 特有的参数）
    const claudeArgs = this.getClaudeArgs();
    if (claudeArgs.length > 0) {
      console.log(`${colors.yellow}⚙️  Claude 参数: ${claudeArgs.join(' ')}${colors.reset}`);
    }
    console.log();
    
    // 启动定时检查 active-session
    this.sessionCheckInterval = setInterval(() => {
      this.checkActiveSession();
    }, 1000);  // 每秒检查一次
    
    // 启动定时检查 issues 文件
    this.issuesCheckInterval = setInterval(() => {
      this.checkIssuesFile();
    }, 500);  // 每500ms检查一次
    
    // 立即检查一次
    this.checkActiveSession();
    
    // 获取当前终端尺寸
    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;
    
    // 创建 PTY 进程
    this.ptyProcess = pty.spawn('claude', claudeArgs, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.cwd(),
      env: { 
        ...process.env, 
        CLAUDE_PROXY: 'true'
      }
    });
    
    // 设置原始模式以完美转发终端控制
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    
    // 处理窗口大小变化
    process.stdout.on('resize', () => {
      this.ptyProcess.resize(process.stdout.columns, process.stdout.rows);
    });
    
    // 设置事件处理
    this.setupEventHandlers();
    
    // 启动监控
    this.startSupervisor();
    
    // 启动空闲检测
    this.startIdleDetection();
  }
  
  /**
   * 设置事件处理
   */
  setupEventHandlers() {
    // PTY 输出 -> 用户终端（完全透明）
    this.ptyProcess.on('data', (data) => {
      // 直接输出到终端，保持所有格式
      process.stdout.write(data);
      
      // 调试：记录 Claude 的响应
      if (this.supervisorActive) {
        console.error(`[CLAUDE] 收到响应: ${data.toString().substring(0, 50)}...`);
      }
      
      // 记录输出用于状态检测
      this.outputBuffer += data;
      this.lastOutput = data;
      this.lastActivityTime = Date.now();
      
      // 尝试从输出中捕获真实的 session ID
      this.captureSessionId(data);
      
      // 检测空闲状态
      this.checkIdleState(data);
    });
    
    // 用户输入 -> PTY（除非被拦截）
    process.stdin.on('data', (data) => {
      // 检查是否需要拦截（如 Ctrl+C）
      if (data[0] === 0x03) { // Ctrl+C
        this.shutdown();
        return;
      }
      
      // 如果正在自动修复，缓存用户输入
      if (this.supervisorActive) {
        this.inputQueue.push(data);
        this.log('用户输入已缓存，等待自动修复完成...');
      } else {
        // 透明转发到 Claude
        this.ptyProcess.write(data);
      }
    });
    
    // PTY 退出处理
    this.ptyProcess.on('exit', (code) => {
      this.log(`Claude 退出，代码: ${code}`);
      this.shutdown();
    });
    
    // 错误处理
    this.ptyProcess.on('error', (err) => {
      console.error(`${colors.red}PTY 错误: ${err.message}${colors.reset}`);
      this.shutdown();
    });
  }
  
  /**
   * 检测空闲状态
   */
  checkIdleState(data) {
    const dataStr = data.toString();
    
    // 检测各种提示符和完成标记
    const idlePatterns = [
      /\$ ?$/,           // Shell 提示符
      /> ?$/,            // 其他提示符
      /Human: ?$/,       // Claude 提示
      /Assistant: ?$/,   // Claude 回复结束
      /✓|✅|完成|Done/,  // 完成标记
      /\n$/,             // 空行（可能表示等待）
    ];
    
    // 检测是否匹配空闲模式
    const wasIdle = this.isIdle;
    this.isIdle = idlePatterns.some(pattern => pattern.test(dataStr));
    
    if (!wasIdle && this.isIdle) {
      this.emit('idle');
      this.log('检测到 Claude 空闲');
    }
  }
  
  /**
   * 启动空闲检测（更精确）
   */
  startIdleDetection() {
    setInterval(() => {
      const timeSinceLastActivity = Date.now() - this.lastActivityTime;
      
      // 如果超过2秒没有输出，认为是空闲
      if (timeSinceLastActivity > 2000 && !this.isIdle) {
        this.isIdle = true;
        this.emit('idle');
      }
    }, CONFIG.idleCheckInterval);
  }
  
  /**
   * 从 Claude 输出中捕获真实的 session ID
   */
  captureSessionId(data) {
    // 如果已经捕获了真实 session ID，不再处理
    if (this.realSessionId) return;
    
    const output = data.toString();
    const lines = output.split('\n');
    
    // 尝试解析每一行查找 JSON 响应
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const json = JSON.parse(trimmed);
          if (json.session_id) {
            this.realSessionId = json.session_id;
            this.log(`🎯 捕获到真实 Claude session ID: ${this.realSessionId}`);
            
            // 更新监听的 issues 文件路径
            this.updateIssuesFilePath(this.realSessionId);
            return;
          }
        } catch (e) {
          // 不是有效的 JSON，继续处理下一行
        }
      }
    }
    
    // 另一种方式：从文件路径模式中提取 session ID
    // 例如：~/.claude/projects/xxx/session-id.jsonl
    const sessionMatch = output.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.jsonl/);
    if (sessionMatch) {
      this.realSessionId = sessionMatch[1];
      this.log(`🎯 从路径捕获 Claude session ID: ${this.realSessionId}`);
      this.updateIssuesFilePath(this.realSessionId);
    }
  }
  
  /**
   * 更新监听的 issues 文件路径
   */
  updateIssuesFilePath(newSessionId) {
    if (newSessionId === CONFIG.sessionId) {
      return; // 相同的 session ID，无需更新
    }
    
    const oldIssuesFile = CONFIG.issuesFile;
    const newIssuesFile = path.join(CONFIG.sessionDir, `${newSessionId}.issues`);
    
    this.log(`📂 更新 issues 文件路径:`);
    this.log(`   旧: ${path.basename(oldIssuesFile)}`);
    this.log(`   新: ${path.basename(newIssuesFile)}`);
    
    // 停止旧的文件监听
    if (this.watcher) {
      this.watcher.close();
    }
    
    // 更新配置
    CONFIG.sessionId = newSessionId;
    CONFIG.issuesFile = newIssuesFile;
    CONFIG.supervisorLog = path.join(CONFIG.sessionDir, `${newSessionId}.log`);
    CONFIG.fixHistoryFile = path.join(CONFIG.sessionDir, `${newSessionId}.history.json`);
    
    // 更新环境变量
    if (this.ptyProcess) {
      // 注意：环境变量在进程创建后不能直接修改
      // 但我们可以通过其他方式通知 hooks
      this.log('⚠️  注意：Claude 进程的环境变量已更新为新 session');
    }
    
    // 重新启动监听器
    this.startSupervisor();
  }
  
  /**
   * 启动 Supervisor 监控
   */
  startSupervisor() {
    // 如果已有监听器，先关闭
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    
    this.log(`CC-Supervisor monitoring started (Session: ${CONFIG.sessionId})`);
    
    // 使用 fs.watch 监控文件变化（更高效）
    const watchDir = path.dirname(CONFIG.issuesFile);
    const watchFile = path.basename(CONFIG.issuesFile);
    
    // 记录最后处理的文件大小，避免重复处理
    this.lastFileSize = 0;
    this.processingFile = false;
    
    // 确保目录存在
    if (!fs.existsSync(watchDir)) {
      fs.mkdirSync(watchDir, { recursive: true });
    }
    
    // 处理初始文件（如果已存在）
    if (fs.existsSync(CONFIG.issuesFile)) {
      this.log('发现已存在的问题文件，立即处理');
      this.handleIssues();
    }
    
    // 监听文件变化
    this.watcher = fs.watch(watchDir, (eventType, filename) => {
      // 处理目标文件的所有变化
      if (filename === watchFile) {
        // 'rename' 事件：文件创建或删除
        // 'change' 事件：文件内容修改
        
        if (!fs.existsSync(CONFIG.issuesFile)) {
          return;  // 文件不存在，可能被删除了
        }
        
        // 获取当前文件大小
        const stats = fs.statSync(CONFIG.issuesFile);
        const currentSize = stats.size;
        
        // 检查是否有新内容
        if (currentSize > this.lastFileSize && !this.processingFile) {
          this.log(`检测到问题文件变化 (${eventType}): ${currentSize} bytes`);
          
          // 短暂延迟确保文件写入完成
          setTimeout(() => {
            if (fs.existsSync(CONFIG.issuesFile) && !this.processingFile) {
              this.processingFile = true;
              this.handleIssues().finally(() => {
                this.processingFile = false;
              });
            }
          }, 100);
        }
        
        this.lastFileSize = currentSize;
      }
    });
    
    this.log(`正在监听: ${CONFIG.issuesFile} (支持追加模式)`);
  }
  
  /**
   * 处理发现的问题
   */
  async handleIssues() {
    try {
      const issues = fs.readFileSync(CONFIG.issuesFile, 'utf-8');
      
      // 删除文件并重置大小记录（处理完成后清理）
      fs.unlinkSync(CONFIG.issuesFile);
      this.lastFileSize = 0;
      
      this.log(`发现问题:\n${issues}`);
      
      // 检查是否应该修复
      if (!this.shouldFix(issues)) {
        return;
      }
      
      // 生成修复命令
      const fixCommand = this.generateFixCommand(issues);
      
      // 等待空闲
      await this.waitForIdle();
      
      // 注入修复命令
      await this.injectCommand(fixCommand);
      
    } catch (err) {
      this.log(`处理问题失败: ${err.message}`);
    }
  }
  
  /**
   * 检查是否应该修复（防止死循环）
   */
  shouldFix(issues) {
    const issueHash = this.hashIssue(issues);
    const now = Date.now();
    
    if (this.fixHistory[issueHash]) {
      const lastFixTime = this.fixHistory[issueHash];
      if (now - lastFixTime < CONFIG.duplicateFixTimeout) {
        this.log('跳过重复问题（5分钟内已尝试修复）');
        return false;
      }
    }
    
    this.fixHistory[issueHash] = now;
    this.saveFixHistory();
    return true;
  }
  
  /**
   * 生成修复命令
   */
  generateFixCommand(issues) {
    // 保留完整的问题内容，不截断
    const fullIssues = issues.trim();
    
    // 智能分析问题类型
    // 不截断，传递完整的问题描述
    return `请分析并修复以下问题：\n${fullIssues}`;
  }
  
  /**
   * 等待 Claude 空闲
   */
  waitForIdle() {
    return new Promise((resolve) => {
      if (this.isIdle) {
        resolve();
        return;
      }
      
      const timeout = setTimeout(() => {
        this.log('等待超时，强制继续');
        resolve();
      }, CONFIG.maxWaitForIdle);
      
      this.once('idle', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
  
  /**
   * 注入命令到 Claude
   */
  async injectCommand(command) {
    this.supervisorActive = true;
    
    // 添加自动修复标记
    const markedCommand = `[🤖 自动修复] ${command}`;
    
    this.log(`注入修复命令: ${command}`);
    
    // Claude 交互式模式不支持多行输入，需要将内容合并成单行
    // 将换行替换为空格，保持内容可读性
    const singleLineCommand = markedCommand
      .replace(/\n\s*/g, ' ')  // 将换行和后续空格替换为单个空格
      .replace(/\s+/g, ' ')    // 将多个连续空格压缩为一个
      .replace(/```[^`]*```/g, '[代码块]')  // 简化代码块
      .trim();
    
    // 写入完整命令
    this.ptyProcess.write(singleLineCommand);
    
    // 同时显示在用户终端（让用户看到注入的内容）
    process.stdout.write(colors.cyan + '[自动注入] ' + colors.reset + singleLineCommand);
    
    // 增加延迟，确保命令完整接收
    await this.sleep(200);
    
    // 发送回车键执行命令（重要！）
    // 必须同时发送 \r\n 才能正确提交
    console.error(`[INJECT] ✅ 发送回车键提交命令`);
    this.ptyProcess.write('\r\n');
    
    // 显示回车符号让用户知道已经提交
    process.stdout.write('\n');
    
    // 等待一下让 Claude 处理
    await this.sleep(500);
    console.error(`[INJECT] ✔️  命令已提交，等待 Claude 响应...`);
    
    // 备选方案：如果上面不行，可以试试:
    // this.ptyProcess.write(String.fromCharCode(13)); // Enter key
    
    this.log('命令已注入并执行');
    
    // 等待一段时间后恢复
    setTimeout(() => {
      this.supervisorActive = false;
      this.processQueuedInput();
    }, 3000);  // 增加等待时间
  }
  
  /**
   * 处理缓存的用户输入
   */
  processQueuedInput() {
    while (this.inputQueue.length > 0) {
      const input = this.inputQueue.shift();
      this.ptyProcess.write(input);
    }
  }
  
  /**
   * 工具函数：生成问题哈希
   */
  hashIssue(issue) {
    // 简单哈希实现
    let hash = 0;
    for (let i = 0; i < issue.length; i++) {
      hash = ((hash << 5) - hash) + issue.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString();
  }
  
  /**
   * 加载修复历史
   */
  loadFixHistory() {
    try {
      if (fs.existsSync(CONFIG.fixHistoryFile)) {
        return JSON.parse(fs.readFileSync(CONFIG.fixHistoryFile, 'utf-8'));
      }
    } catch (err) {
      this.log(`加载修复历史失败: ${err.message}`);
    }
    return {};
  }
  
  /**
   * 保存修复历史
   */
  saveFixHistory() {
    try {
      // 清理过期记录
      const now = Date.now();
      for (const hash in this.fixHistory) {
        if (now - this.fixHistory[hash] > CONFIG.duplicateFixTimeout * 2) {
          delete this.fixHistory[hash];
        }
      }
      
      if (CONFIG.fixHistoryFile) {
        fs.writeFileSync(CONFIG.fixHistoryFile, JSON.stringify(this.fixHistory, null, 2));
      }
    } catch (err) {
      // 忽略错误
    }
  }
  
  /**
   * 记录日志
   */
  log(message) {
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    const logMessage = `[${timestamp}] ${message}\n`;
    
    // 写入日志文件（如果已经有 session）
    if (CONFIG.supervisorLog) {
      fs.appendFileSync(CONFIG.supervisorLog, logMessage);
    }
    
    // 调试模式下输出到 stderr
    if (process.env.DEBUG) {
      process.stderr.write(`${colors.yellow}[Supervisor] ${message}${colors.reset}\n`);
    }
  }
  
  /**
   * 工具函数：延迟
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 关闭代理
   */
  shutdown() {
    this.log('关闭透明代理...');
    
    // 恢复终端模式
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
    
    // 重置终端状态 - 修复光标和颜色问题
    process.stdout.write('\x1b[0m');     // 重置所有属性（修复颜色）
    process.stdout.write('\x1b[?25h');   // 显示光标（修复光标隐藏）
    process.stdout.write('\x1b[?1l');    // 恢复正常光标键
    process.stdout.write('\x1b[?47l');   // 恢复主屏幕缓冲区
    
    // 关闭文件监听器
    if (this.watcher) {
      this.watcher.close();
      this.log('文件监听器已关闭');
    }
    
    // 终止 PTY 进程
    if (this.ptyProcess) {
      this.ptyProcess.kill();
    }
    
    // 清理资源
    this.saveFixHistory();
    
    console.log(`${colors.green}✅ 透明代理已关闭${colors.reset}`);
    process.exit(0);
  }
}

// 处理进程信号
process.on('SIGINT', () => {
  console.log('\n收到中断信号...');
  if (proxy) {
    proxy.shutdown();
  } else {
    // 即使没有 proxy 也要恢复终端
    process.stdout.write('\x1b[0m\x1b[?25h');
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  if (proxy) {
    proxy.shutdown();
  } else {
    process.stdout.write('\x1b[0m\x1b[?25h');
    process.exit(0);
  }
});

// 处理未捕获的异常，确保终端恢复
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
  // 恢复终端
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdout.write('\x1b[0m\x1b[?25h');
  process.exit(1);
});

process.on('exit', () => {
  // 最后的保险：确保终端恢复
  process.stdout.write('\x1b[0m\x1b[?25h');
});

// 主函数
function main() {
  // 显示启动信息
  console.log(`${colors.blue}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║   Claude 全自动验证修复系统 (Node.js)  ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════╝${colors.reset}`);
  console.log();
  console.log(`${colors.yellow}提示: Ctrl+C 退出${colors.reset}`);
  console.log();
  
  // 检查依赖
  try {
    require.resolve('node-pty');
  } catch (err) {
    console.error(`${colors.red}错误: 未安装 node-pty${colors.reset}`);
    console.log('请运行: npm install node-pty');
    process.exit(1);
  }
  
  // 创建并启动代理
  global.proxy = new ClaudeProxy();
  proxy.start();
}

// 命令行参数处理
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
使用方法:
  cc-supervisor-claude                    # 启动透明代理（自动检测 session）
  cc-supervisor-claude --session <uuid>   # 指定 Claude session ID
  cc-supervisor-claude --help             # 显示帮助
  cc-supervisor-claude --debug            # 调试模式

环境变量:
  DEBUG=1                            # 显示调试日志
  SUPERVISOR_SESSION_ID              # 传递给子进程的 session ID
  SUPERVISOR_ISSUES_FILE             # 传递给子进程的问题文件路径

特性:
  - 完全透明的终端代理
  - 保持所有 Claude Code 交互特性
  - 自动检测并修复问题
  - 防止死循环的智能重试
  - 与 Claude session 一一对应
  
文件位置:
  ~/.cc-supervisor/projects/<project-name>/<session-id>.issues    # 问题文件
  ~/.cc-supervisor/projects/<project-name>/<session-id>.log       # 日志文件
  ~/.cc-supervisor/projects/<project-name>/<session-id>.history   # 历史记录
  `);
  process.exit(0);
}

if (args.includes('--debug')) {
  process.env.DEBUG = '1';
}

// 启动
main();