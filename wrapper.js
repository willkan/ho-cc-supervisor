#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
    red: text => `\x1b[31m${text}\x1b[0m`,
    green: text => `\x1b[32m${text}\x1b[0m`,
    yellow: text => `\x1b[33m${text}\x1b[0m`,
    blue: text => `\x1b[34m${text}\x1b[0m`,
    cyan: text => `\x1b[36m${text}\x1b[0m`
};

// 配置
const CONFIG = {
    verifyBeforeCommands: ['commit', 'push'],  // 这些命令前需要验证
    autoVerifyAfter: ['test', 'build'],        // 这些命令后自动验证
    proofDir: '.proof',
    logFile: '.proof/wrapper.log'
};

// 确保日志目录存在
if (!fs.existsSync(CONFIG.proofDir)) {
    fs.mkdirSync(CONFIG.proofDir, { recursive: true });
}

// 记录日志
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}\n`;
    fs.appendFileSync(CONFIG.logFile, logMessage);
}

// 运行验证
function runVerification() {
    console.log(colors.cyan('\n🔍 Running Supervisor-ME verification...\n'));
    
    try {
        const result = execSync('./verify.sh', { encoding: 'utf8', stdio: 'pipe' });
        
        // 读取验证结果
        const proofFile = path.join(CONFIG.proofDir, 'latest.json');
        if (fs.existsSync(proofFile)) {
            const proof = JSON.parse(fs.readFileSync(proofFile, 'utf8'));
            
            if (proof.status === 'PASS') {
                console.log(colors.green(`✅ Verification PASSED - ${proof.tests.passed}/${proof.tests.total} tests passing`));
                log(`Verification PASSED - ${proof.tests.passed}/${proof.tests.total} tests`);
                return true;
            } else {
                console.log(colors.red(`❌ Verification FAILED - ${proof.tests.failed} tests failing`));
                log(`Verification FAILED - ${proof.tests.failed} tests failing`);
                return false;
            }
        }
    } catch (error) {
        console.log(colors.red('❌ Verification failed or verify.sh not found'));
        log('Verification error: ' + error.message);
        return false;
    }
}

// 主函数
function main() {
    const args = process.argv.slice(2);
    const command = args.join(' ');
    
    if (args.length === 0) {
        console.log('Supervisor-ME Claude Code Wrapper');
        console.log('Usage: node wrapper.js <claude-code-command>');
        console.log('\nThis wrapper will:');
        console.log('  - Run verification before: ' + CONFIG.verifyBeforeCommands.join(', '));
        console.log('  - Auto-verify after: ' + CONFIG.autoVerifyAfter.join(', '));
        process.exit(0);
    }
    
    log(`Command: ${command}`);
    
    // 检查是否需要预验证
    const needsPreVerification = CONFIG.verifyBeforeCommands.some(cmd => 
        command.includes(cmd)
    );
    
    if (needsPreVerification) {
        console.log(colors.yellow(`\n⚠️  Command "${command}" requires verification first`));
        const verified = runVerification();
        
        if (!verified) {
            console.log(colors.red('\n❌ Cannot proceed - verification failed'));
            console.log(colors.yellow('Fix the failing tests before running this command'));
            process.exit(1);
        }
        console.log(colors.green('\n✅ Verification passed, proceeding with command...\n'));
    }
    
    // 执行原始命令（这里模拟执行）
    console.log(colors.blue(`\n📦 Executing: ${command}`));
    console.log(colors.cyan('----------------------------------------'));
    
    // 注意：这里应该调用实际的 Claude Code CLI
    // 由于这是一个演示，我们只是模拟执行
    try {
        // 模拟命令执行
        const child = spawn('sh', ['-c', command], {
            stdio: 'inherit'
        });
        
        child.on('exit', (code) => {
            console.log(colors.cyan('----------------------------------------'));
            
            // 检查是否需要后验证
            const needsPostVerification = CONFIG.autoVerifyAfter.some(cmd => 
                command.includes(cmd)
            );
            
            if (needsPostVerification) {
                console.log(colors.cyan('\n🔍 Running post-command verification...'));
                runVerification();
            }
            
            process.exit(code);
        });
        
    } catch (error) {
        console.error(colors.red('Error executing command:'), error.message);
        log('Execution error: ' + error.message);
        process.exit(1);
    }
}

// 捕获中断信号
process.on('SIGINT', () => {
    console.log(colors.yellow('\n\n⚠️  Interrupted by user'));
    log('Wrapper interrupted by user');
    process.exit(130);
});

// 运行主程序
main();