#!/usr/bin/env node

/**
 * CC-Supervisor 自动注入端到端测试
 * 验证完整的自动注入和修复流程
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 测试配置
const TEST_DIR = path.join(os.tmpdir(), 'cc-supervisor-e2e-' + Date.now());
const TEST_FILE = path.join(TEST_DIR, 'test.js');
const PROJECT_NAME = TEST_DIR.replace(/\//g, '-').replace(/^-/, '');
const PROJECT_DIR = path.join(os.homedir(), '.cc-supervisor', 'projects', PROJECT_NAME);
const ACTIVE_SESSION_FILE = path.join(PROJECT_DIR, 'active-session');

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setup() {
  log('\n🚀 设置测试环境...', 'blue');
  
  // 创建测试目录
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(PROJECT_DIR, { recursive: true });
  
  // 创建初始测试文件（有问题的代码）
  fs.writeFileSync(TEST_FILE, `
// 故意的语法错误
function test() {
  console.log("test"
}
`);
  
  log('✅ 测试环境准备完成', 'green');
  log(`  测试目录: ${TEST_DIR}`, 'cyan');
  log(`  项目目录: ${PROJECT_DIR}`, 'cyan');
}

async function testAutoInjection() {
  log('\n📋 测试自动注入流程...', 'blue');
  
  return new Promise((resolve, reject) => {
    // 模拟会话ID
    const sessionId = 'test-session-' + Date.now();
    
    // 1. 写入活动会话
    log('1️⃣ 设置活动会话...', 'yellow');
    fs.writeFileSync(ACTIVE_SESSION_FILE, sessionId);
    
    // 2. 创建 issues 文件
    const issuesFile = path.join(PROJECT_DIR, `${sessionId}.issues`);
    log('2️⃣ 创建 issues 文件...', 'yellow');
    
    // 模拟验证失败的反馈
    const issueContent = `## 🔍 验证发现问题

### 语法错误
文件: ${TEST_FILE}
行 3: SyntaxError: Unexpected end of input
缺少闭合括号 ')'

### 建议修复
\`\`\`javascript
function test() {
  console.log("test");  // 添加闭合括号和分号
}
\`\`\`
`;
    
    // 3. 启动 cc-supervisor-claude
    log('3️⃣ 启动 cc-supervisor-claude...', 'yellow');
    const supervisorPath = path.join(__dirname, '..', 'bin', 'cc-supervisor-claude.js');
    
    const proc = spawn('node', [supervisorPath, '--debug', '--session', sessionId], {
      cwd: TEST_DIR,
      env: { ...process.env, NO_COLOR: '1' }
    });
    
    let output = '';
    let injected = false;
    let timeout;
    
    proc.stdout.on('data', (data) => {
      output += data.toString();
      const lines = data.toString().split('\n');
      
      lines.forEach(line => {
        // 调试输出
        if (line.includes('[SESSION]') || line.includes('[ISSUES]') || line.includes('[INJECT]')) {
          console.log('  ', line);
        }
        
        // 检测自动注入
        if (line.includes('[自动注入]') || line.includes('cc-supervisor fix')) {
          injected = true;
          log('✅ 检测到自动注入命令', 'green');
        }
      });
    });
    
    proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          console.log('  [DEBUG]', line);
        }
      });
    });
    
    // 等待进程启动
    setTimeout(async () => {
      log('4️⃣ 写入 issues 内容...', 'yellow');
      fs.writeFileSync(issuesFile, issueContent);
      
      // 等待检测和注入
      timeout = setTimeout(() => {
        proc.kill();
        
        if (injected) {
          log('\n✅ 自动注入测试通过！', 'green');
          log('  - Session 跟踪正常', 'cyan');
          log('  - Issues 文件检测正常', 'cyan');
          log('  - 命令自动注入成功', 'cyan');
          resolve(true);
        } else {
          log('\n❌ 自动注入测试失败', 'red');
          log('  未检测到自动注入命令', 'yellow');
          reject(new Error('Auto injection not detected'));
        }
      }, 5000);
    }, 2000);
    
    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function cleanup() {
  log('\n🧹 清理测试环境...', 'blue');
  
  // 清理测试目录
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  
  // 清理项目目录
  if (fs.existsSync(PROJECT_DIR)) {
    fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
  }
  
  log('✅ 清理完成', 'green');
}

// 主测试流程
async function runTest() {
  log('╔════════════════════════════════════════╗', 'blue');
  log('║  CC-Supervisor 自动注入端到端测试      ║', 'blue');
  log('╚════════════════════════════════════════╝', 'blue');
  
  try {
    await setup();
    await testAutoInjection();
    
    log('\n🎉 所有测试通过！', 'green');
    process.exit(0);
    
  } catch (err) {
    log(`\n💥 测试失败: ${err.message}`, 'red');
    console.error(err);
    process.exit(1);
    
  } finally {
    await cleanup();
  }
}

// 运行测试
if (require.main === module) {
  runTest();
}

module.exports = { runTest };