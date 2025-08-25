#!/usr/bin/env node

/**
 * Super - 透明监督器
 * 完全保留 Claude Code 原生体验，暗中添加监督
 */

const pty = require('node-pty');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 加载配置（如果存在）
let config;
try {
    config = require('./super-config.js');
} catch (e) {
    // 使用默认配置
    config = {
        injectionStyle: 'marked',
        getInquiry: () => "[AUTO-CHECK] Tests failed, please investigate. [/AUTO-CHECK]"
    };
}

class Super {
    constructor() {
        this.logDir = path.join(process.cwd(), '.super');
        this.supervisorLog = null;
        this.analysisBuffer = '';
        this.lastUserInput = '';
        this.verificationPending = false;
        this.inquiryQueue = [];
        
        // 确保日志目录存在
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
        
        this.supervisorLog = fs.createWriteStream(
            path.join(this.logDir, 'supervisor.log'), 
            { flags: 'a' }
        );
    }

    start() {
        // 检测是否使用模拟模式
        const args = process.argv.slice(2);
        const useMock = args.includes('--mock');
        
        if (useMock) {
            console.log('Using Mock Claude for testing...\n');
            // 使用模拟器
            this.claude = pty.spawn('node', [path.join(__dirname, 'mock-claude.js')], {
                name: 'xterm-256color',
                cols: process.stdout.columns || 120,
                rows: process.stdout.rows || 40,
                cwd: process.cwd(),
                env: process.env
            });
        } else {
            // 过滤掉 --mock 参数，传递其他所有参数给 Claude
            const claudeArgs = args.filter(arg => arg !== '--mock');
            
            // 显示传递的参数（可选）
            if (claudeArgs.length > 0) {
                console.log(`Passing arguments to Claude: ${claudeArgs.join(' ')}\n`);
            }
            
            // 启动真正的 Claude（保持原生体验）
            this.claude = pty.spawn('claude', claudeArgs, {
                name: 'xterm-256color',
                cols: process.stdout.columns || 120,
                rows: process.stdout.rows || 40,
                cwd: process.cwd(),
                env: process.env
            });
        }

        // 关键：设置原始模式，确保完全透明
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }

        // 双向透明管道
        // 用户输入 → Claude（同时记录）
        process.stdin.on('data', (data) => {
            const str = data.toString();
            
            // Ctrl+C 退出
            if (str === '\x03') {
                this.cleanup();
                return;
            }
            
            // 传递给 Claude
            this.claude.write(data);
            
            // 记录用户输入（用于分析）
            if (str === '\r' || str === '\n') {
                this.analyzeUserInput(this.lastUserInput);
                this.lastUserInput = '';
            } else if (str === '\x7f' || str === '\b') {
                // 退格键
                this.lastUserInput = this.lastUserInput.slice(0, -1);
            } else {
                this.lastUserInput += str;
            }
        });

        // Claude 输出 → 用户（同时监听）
        this.claude.on('data', (data) => {
            // 直接显示给用户（保持原生体验）
            process.stdout.write(data);
            
            // Supervisor 暗中分析
            this.supervisorAnalyze(data.toString());
        });

        // 处理窗口大小变化
        process.stdout.on('resize', () => {
            this.claude.resize(
                process.stdout.columns,
                process.stdout.rows
            );
        });

        // Claude 退出时
        this.claude.on('exit', () => {
            this.cleanup();
        });

        // 启动后台验证器
        this.startBackgroundVerifier();
    }

    supervisorAnalyze(data) {
        // 累积输出用于分析
        this.analysisBuffer += data;
        
        // 写入日志
        this.supervisorLog.write(`[OUTPUT] ${data}`);
        
        // 检测完成声明
        const completionKeywords = [
            'done', 'complete', 'finished',
            '完成', '搞定', 'ready'
        ];
        
        const lowerBuffer = this.analysisBuffer.toLowerCase();
        const hasCompletion = completionKeywords.some(keyword => 
            lowerBuffer.includes(keyword)
        );
        
        if (hasCompletion && !this.verificationPending) {
            this.verificationPending = true;
            this.supervisorLog.write('[TRIGGER] Detected completion claim\n');
            
            // 延迟触发验证（让 Claude 先完成响应）
            setTimeout(() => {
                this.triggerVerification();
            }, 3000);
        }
        
        // 限制缓冲区大小
        if (this.analysisBuffer.length > 10000) {
            this.analysisBuffer = this.analysisBuffer.slice(-5000);
        }
    }

    analyzeUserInput(input) {
        if (!input.trim()) return;
        
        this.supervisorLog.write(`[USER] ${input}\n`);
        
        // 重置分析缓冲区
        this.analysisBuffer = '';
    }

    triggerVerification() {
        // 运行验证脚本
        const verifyPath = path.join(__dirname, '..', 'scripts', 'verify.sh');
        
        // 检查验证脚本是否存在
        if (!fs.existsSync(verifyPath)) {
            this.supervisorLog.write('[VERIFY] verify.sh not found, simulating failure\n');
            // 模拟测试失败
            this.handleVerificationResult(1);
            return;
        }
        
        const verifyProcess = spawn(verifyPath, [], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: process.cwd()
        });
        
        let verifyOutput = '';
        
        verifyProcess.stdout.on('data', (data) => {
            verifyOutput += data.toString();
        });
        
        verifyProcess.on('close', (code) => {
            this.verificationPending = false;
            this.handleVerificationResult(code);
        });
    }
    
    handleVerificationResult(code) {
        if (code === 0) {
            this.supervisorLog.write('[VERIFY] Tests PASSED\n');
        } else {
            this.supervisorLog.write('[VERIFY] Tests FAILED\n');
            
            // 使用配置生成询问
            const inquiry = config.getInquiry ? config.getInquiry() : "[AUTO-CHECK] Tests failed, please investigate. [/AUTO-CHECK]";
            
            // 延迟注入，看起来更自然
            setTimeout(() => {
                this.injectInquiry(inquiry);
            }, 2000);
        }
    }

    injectInquiry(text) {
        // 关键：注入的内容看起来像用户打字
        // 逐字符输入，模拟真实打字
        this.supervisorLog.write(`[INJECT] ${text}\n`);
        
        let index = 0;
        const typeChar = () => {
            if (index < text.length) {
                this.claude.write(text[index]);
                index++;
                // 随机打字速度，更像人类
                setTimeout(typeChar, 50 + Math.random() * 100);
            } else {
                // 输入完成，按回车
                this.claude.write('\r');
            }
        };
        
        // 开始"打字"
        typeChar();
    }

    startBackgroundVerifier() {
        // 每30秒运行一次后台验证（可选）
        setInterval(() => {
            const verifyPath = path.join(__dirname, '..', 'scripts', 'verify.sh');
            
            // 检查验证脚本是否存在
            if (!fs.existsSync(verifyPath)) {
                // 静默跳过，不报错
                return;
            }
            
            // 静默验证，不触发询问
            const verifyProcess = spawn(verifyPath, [], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd()
            });
            
            verifyProcess.on('close', (code) => {
                const status = code === 0 ? 'PASS' : 'FAIL';
                this.supervisorLog.write(`[BACKGROUND] Status: ${status}\n`);
            });
            
            verifyProcess.on('error', (err) => {
                // 静默处理错误，不中断程序
                this.supervisorLog.write(`[BACKGROUND] Error: ${err.message}\n`);
            });
        }, 30000);
    }

    cleanup() {
        // 恢复终端
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        
        // 清理资源
        if (this.claude) {
            this.claude.kill();
        }
        
        if (this.supervisorLog) {
            this.supervisorLog.write('\n=== Session Ended ===\n\n');
            this.supervisorLog.end();
        }
        
        process.exit(0);
    }
}

// 处理进程信号
process.on('SIGINT', () => {
    // Ctrl+C 已在 stdin 处理中捕获
});

process.on('SIGTERM', () => {
    process.exit(0);
});

// 启动代理
console.log('Starting Super (Transparent Mode)...');
console.log('Press Ctrl+C to exit\n');

const super_ = new Super();
super_.start();