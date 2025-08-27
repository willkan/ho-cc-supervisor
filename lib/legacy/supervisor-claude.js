#!/usr/bin/env node

/**
 * Supervisor Claude - 智能QA监督器
 * 使用 Claude API 进行智能代码审查和质量验证
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class SupervisorClaude extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            claudeCommand: config.claudeCommand || 'claude',
            projectRoot: config.projectRoot || process.cwd(),
            analysisInterval: config.analysisInterval || 10000, // 10秒分析一次
            inquiryCooldown: config.inquiryCooldown || 30000,   // 30秒询问冷却
            ...config
        };
        
        this.state = {
            projectContext: null,
            currentTask: null,
            lastInquiryTime: 0,
            taskHistory: [],
            codebaseKnowledge: {},
            pendingIssues: []
        };
        
        this.claudeProcess = null;
        this.isAnalyzing = false;
    }
    
    /**
     * 启动 Supervisor Claude
     */
    async start() {
        console.log('[Supervisor] Starting intelligent QA supervisor...');
        
        // 初始分析项目
        await this.analyzeProject();
        
        // 启动 Claude CLI 会话
        this.startClaudeSession();
        
        // 定期分析
        setInterval(() => {
            if (!this.isAnalyzing) {
                this.performAnalysis();
            }
        }, this.config.analysisInterval);
    }
    
    /**
     * 分析项目结构和上下文
     */
    async analyzeProject() {
        this.isAnalyzing = true;
        
        const prompt = `
You are a QA engineer analyzing a project. Please analyze the following project structure and understand:
1. Main functionality and architecture
2. Testing standards and patterns
3. Common issues and edge cases
4. Code quality requirements

Project root: ${this.config.projectRoot}

Please provide a brief summary of the project and key quality checkpoints.
        `.trim();
        
        try {
            // 读取关键文件
            const files = await this.readProjectFiles();
            
            // 使用 Claude 分析
            const analysis = await this.askClaude(prompt + '\n\nKey files:\n' + files);
            
            this.state.projectContext = analysis;
            console.log('[Supervisor] Project analysis complete');
            
        } catch (error) {
            console.error('[Supervisor] Failed to analyze project:', error);
        } finally {
            this.isAnalyzing = false;
        }
    }
    
    /**
     * 读取项目关键文件
     */
    async readProjectFiles() {
        const keyFiles = [
            'package.json',
            'README.md',
            'src/index.js',
            'test/',
            '.github/workflows/'
        ];
        
        let content = '';
        
        for (const file of keyFiles) {
            const filePath = path.join(this.config.projectRoot, file);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    // 读取目录结构
                    const files = fs.readdirSync(filePath).slice(0, 5);
                    content += `\n${file}:\n${files.join('\n')}\n`;
                } else {
                    // 读取文件内容（限制大小）
                    const data = fs.readFileSync(filePath, 'utf8');
                    content += `\n${file}:\n${data.substring(0, 1000)}\n`;
                }
            }
        }
        
        return content;
    }
    
    /**
     * 监控 Worker 输出
     */
    monitorWorkerOutput(output) {
        // 检测任务完成标记
        const completionPatterns = [
            /done|completed|finished|implemented|fixed/i,
            /all tests pass/i,
            /successfully|works now/i,
            /feature is ready/i
        ];
        
        const hasCompletion = completionPatterns.some(pattern => pattern.test(output));
        
        if (hasCompletion) {
            // 记录可能的任务完成
            this.state.currentTask = {
                output,
                timestamp: Date.now(),
                verified: false
            };
            
            // 触发验证分析
            this.emit('task-completed', output);
            
            // 延迟验证（让 Worker 有时间完成）
            setTimeout(() => {
                this.validateDelivery(output);
            }, 3000);
        }
        
        // 持续学习对话模式
        this.learnFromConversation(output);
    }
    
    /**
     * 验证交付质量
     */
    async validateDelivery(taskOutput) {
        if (this.isAnalyzing) return;
        
        this.isAnalyzing = true;
        
        const prompt = `
As a QA engineer, review this completed task:

Task output: "${taskOutput}"

Based on the project context, check for:
1. Edge cases that might be missed
2. Error handling completeness  
3. Test coverage adequacy
4. Performance considerations
5. Security implications

If you find issues, provide a natural, conversational question that a colleague might ask.
Format: Just the question, no prefixes or explanations.
If everything looks good, respond with "LGTM".
        `.trim();
        
        try {
            const response = await this.askClaude(prompt);
            
            if (response && response !== 'LGTM') {
                // 生成智能询问
                this.generateInquiry(response);
            }
            
        } catch (error) {
            console.error('[Supervisor] Validation failed:', error);
        } finally {
            this.isAnalyzing = false;
        }
    }
    
    /**
     * 生成智能询问
     */
    generateInquiry(question) {
        const now = Date.now();
        
        // 检查冷却时间
        if (now - this.state.lastInquiryTime < this.config.inquiryCooldown) {
            // 保存问题稍后询问
            this.state.pendingIssues.push(question);
            return;
        }
        
        // 添加自然的前缀变化
        const prefixes = [
            '',
            'Hey, quick question - ',
            'BTW, ',
            'Just noticed - ',
            'Hmm, ',
            'One thing - '
        ];
        
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const inquiry = prefix + question;
        
        // 添加随机延迟（0.5-2.5秒）
        const delay = 500 + Math.random() * 2000;
        
        setTimeout(() => {
            this.emit('inquiry', inquiry);
            this.state.lastInquiryTime = Date.now();
        }, delay);
    }
    
    /**
     * 执行定期分析
     */
    async performAnalysis() {
        // 运行测试验证
        this.runTests();
        
        // 检查代码质量
        this.checkCodeQuality();
        
        // 处理待处理的问题
        if (this.state.pendingIssues.length > 0) {
            const issue = this.state.pendingIssues.shift();
            this.generateInquiry(issue);
        }
    }
    
    /**
     * 运行测试
     */
    runTests() {
        const verifyPath = path.join(__dirname, '..', 'scripts', 'verify.sh');
        
        if (!fs.existsSync(verifyPath)) return;
        
        const verify = spawn(verifyPath, [], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: this.config.projectRoot
        });
        
        let output = '';
        
        verify.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        verify.stderr.on('data', (data) => {
            output += data.toString();
        });
        
        verify.on('close', (code) => {
            if (code !== 0) {
                // 测试失败，分析原因
                this.analyzeTestFailure(output);
            }
        });
    }
    
    /**
     * 分析测试失败
     */
    async analyzeTestFailure(testOutput) {
        const prompt = `
Test output shows failures:
${testOutput}

Generate a natural question about this failure, as if you're a colleague who just noticed it.
Be specific about what failed and suggest what might be wrong.
Keep it conversational and helpful.
        `.trim();
        
        try {
            const question = await this.askClaude(prompt);
            if (question) {
                this.generateInquiry(question);
            }
        } catch (error) {
            console.error('[Supervisor] Failed to analyze test failure:', error);
        }
    }
    
    /**
     * 检查代码质量
     */
    async checkCodeQuality() {
        // 这里可以集成 ESLint, SonarQube 等工具
        // 暂时使用简单的文件检查
        
        const recentFiles = this.getRecentlyModifiedFiles();
        
        for (const file of recentFiles) {
            await this.reviewFile(file);
        }
    }
    
    /**
     * 获取最近修改的文件
     */
    getRecentlyModifiedFiles() {
        // 简化实现：返回空数组
        // 实际应该使用 git 或文件系统 API
        return [];
    }
    
    /**
     * 审查单个文件
     */
    async reviewFile(filePath) {
        // 读取文件内容
        // 使用 Claude 进行代码审查
        // 生成改进建议
    }
    
    /**
     * 从对话中学习
     */
    learnFromConversation(output) {
        // 记录对话模式
        // 学习任务类型
        // 优化询问策略
        
        this.state.taskHistory.push({
            output,
            timestamp: Date.now()
        });
        
        // 只保留最近100条
        if (this.state.taskHistory.length > 100) {
            this.state.taskHistory.shift();
        }
    }
    
    /**
     * 向 Claude 提问
     */
    async askClaude(prompt) {
        return new Promise((resolve, reject) => {
            // 如果有真实的 Claude 进程，使用它
            if (this.claudeProcess) {
                let response = '';
                const timeout = setTimeout(() => {
                    resolve(response || "需要进一步分析...");
                }, 5000);
                
                // 监听响应
                const handler = (data) => {
                    response += data.toString();
                    // 检测响应结束
                    if (response.includes('\n') || response.length > 200) {
                        clearTimeout(timeout);
                        this.claudeProcess.removeListener('data', handler);
                        resolve(response.trim());
                    }
                };
                
                this.claudeProcess.onData(handler);
                
                // 发送提问
                this.claudeProcess.write(prompt + '\n');
                
            } else {
                // 使用 InquiryGenerator 生成智能响应
                const InquiryGenerator = require('./inquiry-generator');
                const generator = new InquiryGenerator();
                
                // 解析问题类型
                let issue = { type: 'code_quality', details: {} };
                
                if (prompt.includes('test') || prompt.includes('fail')) {
                    issue.type = 'test_failure';
                    issue.details = {
                        test_name: 'test',
                        error: 'failure detected',
                        possible_cause: '验证逻辑问题'
                    };
                } else if (prompt.includes('edge case')) {
                    issue.type = 'missing_edge_case';
                    issue.details = {
                        function_name: '函数',
                        edge_case: '边界条件'
                    };
                }
                
                const inquiry = generator.generate(issue);
                resolve(inquiry);
            }
        });
    }
    
    /**
     * 启动 Claude CLI 会话
     */
    startClaudeSession() {
        const pty = require('node-pty');
        
        try {
            // 启动 Supervisor 的 Claude 实例
            this.claudeProcess = pty.spawn('claude', ['--role', 'qa'], {
                name: 'xterm-256color',
                cols: 80,
                rows: 24,
                cwd: this.config.projectRoot,
                env: { ...process.env, CLAUDE_ROLE: 'supervisor' }
            });
            
            // 处理 Claude 输出
            this.claudeProcess.onData((data) => {
                // 记录输出但不显示给用户
                if (this.config.debug) {
                    console.log('[Supervisor Claude]:', data);
                }
            });
            
            console.log('[Supervisor] Claude session started');
            
        } catch (error) {
            console.log('[Supervisor] Running without separate Claude process');
            // 使用智能询问生成器
        }
    }
    
    /**
     * 停止 Supervisor
     */
    stop() {
        if (this.claudeProcess) {
            this.claudeProcess.kill();
        }
        this.removeAllListeners();
        console.log('[Supervisor] Stopped');
    }
}

module.exports = SupervisorClaude;

