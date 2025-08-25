#!/usr/bin/env node

/**
 * Mock Claude - 模拟 Claude Code 的交互界面
 * 用于测试 Super Proxy
 */

const readline = require('readline');

// ANSI 转义码
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    magenta: '\x1b[35m'
};

// 思考动画
const spinners = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerIndex = 0;

class MockClaude {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: `${colors.cyan}Claude>${colors.reset} `
        });
        
        this.taskCount = 0;
        this.setupInterface();
    }

    setupInterface() {
        // 显示欢迎信息（模拟 Claude Code）
        console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════╗${colors.reset}`);
        console.log(`${colors.bright}${colors.cyan}║  Welcome to Claude Code (Mock Mode)   ║${colors.reset}`);
        console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════╝${colors.reset}`);
        console.log(`${colors.dim}Type your message and press Enter${colors.reset}\n`);
        
        this.rl.prompt();
        
        this.rl.on('line', (input) => {
            this.processInput(input);
        });
        
        this.rl.on('close', () => {
            console.log('\nGoodbye!');
            process.exit(0);
        });
    }

    processInput(input) {
        const trimmed = input.trim();
        
        if (!trimmed) {
            this.rl.prompt();
            return;
        }
        
        // 显示思考动画
        this.showThinking();
        
        // 模拟处理时间
        const delay = 1000 + Math.random() * 2000;
        
        setTimeout(() => {
            this.clearThinking();
            this.generateResponse(trimmed);
            this.rl.prompt();
        }, delay);
    }

    showThinking() {
        // 显示思考动画
        process.stdout.write(`${colors.yellow}`);
        this.thinkingInterval = setInterval(() => {
            process.stdout.write(`\r${spinners[spinnerIndex]} Thinking...`);
            spinnerIndex = (spinnerIndex + 1) % spinners.length;
        }, 100);
    }

    clearThinking() {
        if (this.thinkingInterval) {
            clearInterval(this.thinkingInterval);
            process.stdout.write('\r\x1b[K'); // 清除行
        }
        process.stdout.write(`${colors.reset}`);
    }

    generateResponse(input) {
        const lower = input.toLowerCase();
        
        // 检测不同类型的输入
        if (lower.includes('hello') || lower.includes('hi')) {
            console.log(`Hello! I'm Claude, your AI assistant. How can I help you today?`);
        } else if (lower.includes('done') || lower.includes('complete') || lower.includes('finished')) {
            // 触发验证的关键词
            this.taskCount++;
            console.log(`${colors.green}✓ Task #${this.taskCount} completed successfully!${colors.reset}`);
            console.log(`All tests passed. Great work!`);
        } else if (lower.includes('test') && lower.includes('fail')) {
            // 询问测试失败
            console.log(`Let me check the test failures...`);
            this.showProgress('Analyzing test output', 3);
            console.log(`${colors.yellow}Found issues:${colors.reset}`);
            console.log(`- Test "add function" expected 4 but got 5`);
            console.log(`- Missing test coverage for multiply function`);
            console.log(`\nWould you like me to fix these issues?`);
        } else if (lower.includes('fix')) {
            // 修复问题
            this.showProgress('Fixing issues', 5);
            console.log(`${colors.green}✓ Fixed test issues${colors.reset}`);
            console.log(`Updated add function and added test coverage.`);
        } else if (lower.includes('write') || lower.includes('create')) {
            // 创建代码
            console.log(`I'll help you with that. Let me create the code...`);
            this.showProgress('Writing code', 4);
            console.log(`\`\`\`javascript`);
            console.log(`function example() {`);
            console.log(`    return "Hello from Claude!";`);
            console.log(`}`);
            console.log(`\`\`\``);
        } else if (lower === 'exit' || lower === 'quit') {
            console.log('Goodbye!');
            process.exit(0);
        } else {
            // 通用响应
            console.log(`I understand you want to: "${input}"`);
            console.log(`Let me help you with that...`);
            
            // 随机添加一些工作指示器
            if (Math.random() > 0.5) {
                this.showProgress('Processing', 2);
            }
            
            console.log(`Response to: ${input}`);
        }
    }

    showProgress(action, steps) {
        for (let i = 1; i <= steps; i++) {
            setTimeout(() => {
                process.stdout.write(`${colors.dim}  → ${action} [${i}/${steps}]${colors.reset}\n`);
            }, i * 200);
        }
    }
}

// 启动模拟器
new MockClaude();