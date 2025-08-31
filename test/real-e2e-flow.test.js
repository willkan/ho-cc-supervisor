#!/usr/bin/env node

/**
 * CC-Supervisor 真实端到端流程测试
 * 模拟完整的：任务完成 → Stop hook → 验证 → Issues生成 → 自动注入
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 测试配置
const TEST_DIR = path.join(os.tmpdir(), 'cc-supervisor-real-e2e-' + Date.now());
const PROJECT_NAME = TEST_DIR.replace(/\//g, '-').replace(/^-/, '');
const PROJECT_DIR = path.join(os.homedir(), '.cc-supervisor', 'projects', PROJECT_NAME);

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

async function setup() {
  log('\n🚀 设置真实测试环境...', 'blue');
  
  // 创建测试目录
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(PROJECT_DIR, { recursive: true });
  
  // 切换到测试目录
  process.chdir(TEST_DIR);
  
  // 初始化cc-supervisor
  execSync('cc-supervisor init', { stdio: 'pipe' });
  
  // 创建有问题的测试文件
  const testFile = path.join(TEST_DIR, 'buggy.js');
  fs.writeFileSync(testFile, `
// 故意的语法错误和安全问题
function login(password) {
  console.log("Password is: " + password);  // 明文密码泄露
  if (password = "123456") {  // 赋值而不是比较
    return true
  }  // 缺少分号和else
}
`);
  
  log('✅ 环境准备完成', 'green');
  log(`  测试目录: ${TEST_DIR}`, 'cyan');
  log(`  测试文件: ${testFile}`, 'cyan');
  return testFile;
}

async function testRealFlow(testFile) {
  log('\n📋 测试真实端到端流程...', 'blue');
  
  return new Promise((resolve, reject) => {
    const sessionId = 'real-test-session-' + Date.now();
    const activeSessionFile = path.join(PROJECT_DIR, 'active-session');
    const issuesFile = path.join(PROJECT_DIR, `${sessionId}.issues`);
    
    log('1️⃣ 设置活动会话...', 'yellow');
    fs.writeFileSync(activeSessionFile, sessionId);
    
    log('2️⃣ 手动触发Stop hook验证...', 'yellow');
    
    // 模拟Stop hook输入
    const stopInput = JSON.stringify({
      session_id: sessionId,
      transcript_path: '/tmp/test.jsonl',
      hook_event_name: 'Stop',
      stop_hook_active: true
    });
    
    // 手动触发验证
    try {
      const result = execSync(`echo '${stopInput}' | .claude/hooks/stop.sh`, {
        encoding: 'utf-8',
        env: { ...process.env, STOP_HOOK_INPUT: stopInput }
      });
      
      log('3️⃣ 验证结果：', 'yellow');
      console.log('  ', result.trim());
      
      // 检查是否生成了issues文件
      setTimeout(() => {
        if (fs.existsSync(issuesFile)) {
          log('4️⃣ ✅ Issues文件已生成', 'green');
          const issueContent = fs.readFileSync(issuesFile, 'utf-8');
          log('  问题内容预览：', 'cyan');
          console.log('  ', issueContent.split('\n')[0]);
          
          log('5️⃣ 启动cc-supervisor-claude监控...', 'yellow');
          testAutoInjection(sessionId, resolve, reject);
        } else {
          log('4️⃣ ❌ Issues文件未生成', 'red');
          log(`  期望文件：${issuesFile}`, 'yellow');
          reject(new Error('Issues file not generated'));
        }
      }, 2000);
      
    } catch (err) {
      log('❌ Stop hook执行失败', 'red');
      console.error(err.message);
      reject(err);
    }
  });
}

function testAutoInjection(sessionId, resolve, reject) {
  const supervisorPath = path.join(__dirname, '..', 'bin', 'cc-supervisor-claude.js');
  
  const proc = spawn('node', [supervisorPath, '--debug', '--session', sessionId], {
    cwd: TEST_DIR,
    env: { ...process.env, NO_COLOR: '1' }
  });
  
  let injectionDetected = false;
  let timeout;
  
  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.includes('[SESSION]') || line.includes('[ISSUES]') || line.includes('[INJECT]')) {
        console.log('  监控：', line);
      }
      
      if (line.includes('[自动注入]') && line.includes('自动修复')) {
        injectionDetected = true;
        log('✅ 检测到真实自动注入！', 'green');
        clearTimeout(timeout);
        proc.kill();
        resolve(true);
      }
    });
  });
  
  proc.stderr.on('data', (data) => {
    console.log('  [DEBUG]', data.toString().trim());
  });
  
  // 10秒超时
  timeout = setTimeout(() => {
    proc.kill();
    if (injectionDetected) {
      resolve(true);
    } else {
      reject(new Error('Real auto-injection not detected within timeout'));
    }
  }, 10000);
  
  proc.on('error', (err) => {
    clearTimeout(timeout);
    reject(err);
  });
}

async function cleanup() {
  log('\n🧹 清理环境...', 'blue');
  
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  
  if (fs.existsSync(PROJECT_DIR)) {
    fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
  }
  
  log('✅ 清理完成', 'green');
}

async function runTest() {
  log('╔════════════════════════════════════════╗', 'blue');
  log('║  CC-Supervisor 真实端到端流程测试      ║', 'blue');
  log('╚════════════════════════════════════════╝', 'blue');
  
  try {
    const testFile = await setup();
    await testRealFlow(testFile);
    
    log('\n🎉 真实端到端流程测试通过！', 'green');
    log('  ✅ Stop hook → 验证 → Issues生成 → 自动注入 全链路正常', 'cyan');
    
  } catch (err) {
    log(`\n💥 测试失败: ${err.message}`, 'red');
    console.error(err);
    process.exit(1);
    
  } finally {
    await cleanup();
  }
}

if (require.main === module) {
  runTest();
}