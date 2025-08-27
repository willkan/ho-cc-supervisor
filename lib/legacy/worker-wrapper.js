#!/usr/bin/env node

/**
 * Worker Wrapper - 包装 Claude Code 并记录会话
 * 在 Worker 窗口运行
 */

const pty = require('node-pty');
const fs = require('fs');
const path = require('path');

class WorkerWrapper {
    constructor() {
        this.sessionFile = path.join(process.cwd(), '.super', 'worker-session.log');
        this.claudePty = null;
        
        this.setupDirectories();
        this.setupSession();
    }
    
    /**
     * 设置目录
     */
    setupDirectories() {
        const logDir = path.dirname(this.sessionFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }
    
    /**
     * 设置会话记录
     */
    setupSession() {
        // 清空或创建新的会话文件
        const timestamp = new Date().toISOString();
        fs.writeFileSync(this.sessionFile, `=== Worker Session Started: ${timestamp} ===\n`);
        
        console.log('📝 Worker session logging to:', this.sessionFile);
        console.log('');
    }
    
    /**
     * 启动 Claude
     */
    start() {
        const args = process.argv.slice(2);
        
        console.log('🚀 Starting Claude Code (Worker Mode)...');
        console.log('📊 Session will be monitored by Supervisor');
        
        if (args.length > 0) {
            console.log('📌 Claude arguments:', args.join(' '));
        }
        console.log('');
        
        try {
            // 启动 Claude
            this.claudePty = pty.spawn('claude', args, {
                name: 'xterm-256color',
                cols: process.stdout.columns || 80,
                rows: process.stdout.rows || 24,
                cwd: process.cwd(),
                env: process.env
            });
            
            // Claude 输出 -> 终端 + 日志
            this.claudePty.onData((data) => {
                // 输出到终端
                process.stdout.write(data);
                
                // 移除 ANSI 转义序列后记录到文件
                const cleanData = this.stripAnsi(data);
                if (cleanData.trim()) {
                    fs.appendFileSync(this.sessionFile, cleanData);
                }
            });
            
            // 用户输入 -> Claude + 日志
            process.stdin.on('data', (data) => {
                // 发送给 Claude
                this.claudePty.write(data);
                
                // 记录输入（清理后）
                const cleanInput = this.stripAnsi(data.toString());
                if (cleanInput.trim()) {
                    fs.appendFileSync(this.sessionFile, `\n[USER] ${cleanInput}`);
                }
            });
            
            // 处理终端大小变化
            process.stdout.on('resize', () => {
                this.claudePty.resize(
                    process.stdout.columns || 80,
                    process.stdout.rows || 24
                );
            });
            
            // 设置原始模式
            process.stdin.setRawMode(true);
            
            // Claude 退出时
            this.claudePty.onExit(({ exitCode }) => {
                this.cleanup();
                process.exit(exitCode);
            });
            
        } catch (error) {
            console.error('❌ Failed to start Claude:', error.message);
            console.error('\nMake sure Claude Code is installed');
            process.exit(1);
        }
    }
    
    /**
     * 移除 ANSI 转义序列
     */
    stripAnsi(str) {
        // 移除所有 ANSI 转义序列
        return str.replace(/\x1b\[[0-9;]*m/g, '')  // 颜色码
                  .replace(/\x1b\[[\d;]*[HJK]/g, '') // 光标移动
                  .replace(/\x1b\[\d*[ABCD]/g, '')   // 光标移动
                  .replace(/\x1b\[\d*[GE]/g, '')     // 光标位置
                  .replace(/\x1b\[2K/g, '')           // 清除行
                  .replace(/\x1b\[\?[\d;]*[hl]/g, '') // 模式设置
                  .replace(/\x1b\[[\d;]*m/g, '')     // 其他转义
                  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // 控制字符
    }
    
    /**
     * 清理
     */
    cleanup() {
        const timestamp = new Date().toISOString();
        fs.appendFileSync(this.sessionFile, `\n=== Worker Session Ended: ${timestamp} ===\n`);
        
        if (this.claudePty) {
            this.claudePty.kill();
        }
        
        console.log('\n📝 Session logged to:', this.sessionFile);
    }
}

// 如果直接运行
if (require.main === module) {
    const worker = new WorkerWrapper();
    worker.start();
    
    // 优雅退出
    process.on('SIGINT', () => {
        worker.cleanup();
        process.exit(0);
    });
}

module.exports = WorkerWrapper;