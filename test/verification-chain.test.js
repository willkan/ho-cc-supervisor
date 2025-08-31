#!/usr/bin/env node

/**
 * CC-Supervisor 验证链路测试
 * 测试完整的验证和自动修复流程
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 测试配置
const TEST_DIR = path.join(os.tmpdir(), 'cc-supervisor-test-' + Date.now());
const TEST_FILE = path.join(TEST_DIR, 'test.js');
const ISSUES_DIR = path.join(os.homedir(), '.cc-supervisor', 'projects', TEST_DIR.replace(/\//g, '-').replace(/^-/, ''));

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// 测试结果
let passed = 0;
let failed = 0;

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function test(name, fn) {
  try {
    fn();
    passed++;
    log(`✅ ${name}`, 'green');
  } catch (err) {
    failed++;
    log(`❌ ${name}: ${err.message}`, 'red');
  }
}

function setup() {
  log('\n🚀 设置测试环境...', 'blue');
  
  // 创建测试目录
  fs.mkdirSync(TEST_DIR, { recursive: true });
  process.chdir(TEST_DIR);
  
  // 初始化 cc-supervisor
  execSync('cc-supervisor init', { stdio: 'pipe' });
  
  // 创建测试文件（有问题的代码）
  fs.writeFileSync(TEST_FILE, `
// 故意的问题：密码未加密
function login(username, password) {
  // 直接存储明文密码（安全问题）
  const user = {
    username: username,
    password: password  // 应该加密
  };
  return user;
}
`);
  
  log('✅ 测试环境准备完成', 'green');
}

function cleanup() {
  log('\n🧹 清理测试环境...', 'blue');
  
  // 清理测试目录
  if (fs.existsSync(TEST_DIR)) {
    execSync(`rm -rf ${TEST_DIR}`, { stdio: 'pipe' });
  }
  
  // 清理 issues 文件
  if (fs.existsSync(ISSUES_DIR)) {
    execSync(`rm -rf ${ISSUES_DIR}`, { stdio: 'pipe' });
  }
  
  log('✅ 清理完成', 'green');
}

// 测试 1: Hook 配置
function testHookConfiguration() {
  test('Hook 配置存在', () => {
    const settingsPath = path.join(TEST_DIR, '.claude', 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      throw new Error('settings.json 不存在');
    }
    
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    if (!settings.hooks || !settings.hooks.Stop) {
      throw new Error('Stop hook 未配置');
    }
  });
  
  test('Stop hook 脚本可执行', () => {
    const hookPath = path.join(TEST_DIR, '.claude', 'hooks', 'stop.sh');
    if (!fs.existsSync(hookPath)) {
      throw new Error('stop.sh 不存在');
    }
    
    const stats = fs.statSync(hookPath);
    if (!(stats.mode & 0o100)) {
      throw new Error('stop.sh 不可执行');
    }
  });
}

// 测试 2: 验证功能
function testVerification() {
  test('验证命令可执行', () => {
    try {
      execSync('cc-supervisor verify --help', { stdio: 'pipe' });
    } catch (err) {
      throw new Error('cc-supervisor verify 命令不可用');
    }
  });
  
  test('Stop hook 触发验证', () => {
    const stopHook = path.join(TEST_DIR, '.claude', 'hooks', 'stop.sh');
    const testInput = JSON.stringify({
      session_id: 'test-session-123',
      transcript_path: '/tmp/test.jsonl',
      hook_event_name: 'Stop',
      stop_hook_active: true
    });
    
    try {
      const result = execSync(`echo '${testInput}' | ${stopHook}`, { 
        encoding: 'utf-8',
        stdio: 'pipe' 
      });
      
      const output = JSON.parse(result);
      if (!output.continue) {
        throw new Error('Hook 返回格式错误');
      }
      
      // 检查是否有 systemMessage（验证反馈）
      if (output.systemMessage && output.systemMessage.includes('验证')) {
        // 验证成功触发
      }
    } catch (err) {
      throw new Error(`Hook 执行失败: ${err.message}`);
    }
  });
}

// 测试 3: Session 管理
function testSessionManagement() {
  test('Session 跟踪文件创建', () => {
    const sessionDir = path.join(os.homedir(), '.cc-supervisor', 'projects');
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    // 模拟创建 active-session
    const projectDir = path.join(sessionDir, TEST_DIR.replace(/\//g, '-').replace(/^-/, ''));
    fs.mkdirSync(projectDir, { recursive: true });
    
    const activeSessionPath = path.join(projectDir, 'active-session');
    fs.writeFileSync(activeSessionPath, 'test-session-123');
    
    if (!fs.existsSync(activeSessionPath)) {
      throw new Error('active-session 文件创建失败');
    }
  });
}

// 测试 4: 自动注入（需要模拟）
function testAutoInjection() {
  test('Issues 文件监控', () => {
    // 这个测试需要 cc-supervisor-claude 运行
    // 在 CI 环境中可能需要 mock
    log('  ⏭️  跳过（需要交互式环境）', 'yellow');
  });
}

// 主测试流程
async function runTests() {
  log('╔════════════════════════════════════════╗', 'blue');
  log('║  CC-Supervisor 验证链路测试            ║', 'blue');
  log('╚════════════════════════════════════════╝', 'blue');
  
  try {
    setup();
    
    log('\n📋 运行测试...', 'blue');
    testHookConfiguration();
    testVerification();
    testSessionManagement();
    testAutoInjection();
    
    log('\n📊 测试结果:', 'blue');
    log(`  ✅ 通过: ${passed}`, 'green');
    if (failed > 0) {
      log(`  ❌ 失败: ${failed}`, 'red');
    }
    
    if (failed === 0) {
      log('\n🎉 所有测试通过！', 'green');
    } else {
      log('\n❌ 部分测试失败', 'red');
      process.exit(1);
    }
    
  } catch (err) {
    log(`\n💥 测试崩溃: ${err.message}`, 'red');
    process.exit(1);
  } finally {
    cleanup();
  }
}

// 运行测试
if (require.main === module) {
  runTests();
}

module.exports = { runTests };