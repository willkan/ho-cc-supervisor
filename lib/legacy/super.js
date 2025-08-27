#!/usr/bin/env node

/**
 * Super - 智能双 Claude 监督系统
 * Worker Claude: 处理开发任务
 * Supervisor Claude: 智能QA监督
 */

const pty = require('node-pty');
const fs = require('fs');
const path = require('path');
const SupervisorClaude = require('./supervisor-claude');

class Super {
    constructor() {
        this.workerPty = null;
        this.supervisor = null;
        this.logDir = path.join(process.cwd(), '.super');
        
        // 日志流
        this.logs = {
            worker: null,
            supervisor: null,
            routing: null
        };
        
        // 状态
        this.state = {
            isWorkerBusy: false,
            lastWorkerOutput: '',
            inquiryPending: false,
            sessionStartTime: Date.now()
        };
        
        this.setupLogs();
    }
    
    /**
     * 设置日志
     */
    setupLogs() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
        
        this.logs.worker = fs.createWriteStream(
            path.join(this.logDir, 'worker.log'),
            { flags: 'a' }
        );
        
        this.logs.supervisor = fs.createWriteStream(
            path.join(this.logDir, 'supervisor.log'),
            { flags: 'a' }
        );
        
        this.logs.routing = fs.createWriteStream(
            path.join(this.logDir, 'routing.log'),
            { flags: 'a' }
        );
        
        const timestamp = new Date().toISOString();
        this.logs.routing.write(`\\n=== Session Started: ${timestamp} ===\\n`);
    }
    
    /**
     * 启动双 Claude 系统
     */
    async start() {
        console.log('🚀 Starting Intelligent Supervisor System...');
        
        // 启动 Worker Claude (主要开发会话)
        this.startWorkerClaude();
        
        // 启动 Supervisor Claude (QA监督)
        this.startSupervisorClaude();
        
        // 设置信号处理
        this.setupSignalHandlers();
    }
    
    /**
     * 启动 Worker Claude
     */
    startWorkerClaude() {
        const args = process.argv.slice(2);
        
        // 使用实际的 claude 命令
        const command = 'claude';
        
        console.log('Starting Claude Code in supervised mode...');
        console.log('Command:', command, args.join(' '));
        
        // 创建伪终端
        try {
            this.workerPty = pty.spawn(command, args, {
                name: 'xterm-256color',
                cols: process.stdout.columns || 80,
                rows: process.stdout.rows || 24,
                cwd: process.cwd(),
                env: process.env
            });
        } catch (error) {
            console.error(`\n❌ Failed to start Claude Code: ${error.message}`);
            console.error('\nMake sure Claude Code CLI is installed and accessible');
            process.exit(1);
        }
        
        // Worker 输出 -> 用户终端 + Supervisor 分析
        this.workerPty.onData((data) => {
            // 直接输出到用户终端（保持透明）
            process.stdout.write(data);
            
            // 记录到日志
            this.logs.worker.write(data);
            
            // 发送给 Supervisor 分析
            if (this.supervisor) {
                this.supervisor.monitorWorkerOutput(data);
            }
            
            // 更新状态
            this.state.lastWorkerOutput = data;
            this.updateWorkerStatus(data);
        });
        
        // 用户输入 -> Worker
        process.stdin.on('data', (data) => {
            this.workerPty.write(data);
            this.logs.worker.write(`[USER INPUT] ${data}`);
        });
        
        // 处理终端大小变化
        process.stdout.on('resize', () => {
            this.workerPty.resize(
                process.stdout.columns || 80,
                process.stdout.rows || 24
            );
        });
        
        // Worker 退出处理
        this.workerPty.onExit(({ exitCode }) => {
            this.cleanup();
            process.exit(exitCode);
        });
    }
    
    /**
     * 启动 Supervisor Claude
     */
    startSupervisorClaude() {
        // 创建 Supervisor 实例
        this.supervisor = new SupervisorClaude({
            projectRoot: process.cwd(),
            analysisInterval: 15000,  // 15秒分析一次
            inquiryCooldown: 30000    // 30秒询问冷却
        });
        
        // 监听 Supervisor 的智能询问
        this.supervisor.on('inquiry', (question) => {
            this.injectInquiry(question);
        });
        
        // 监听任务完成检测
        this.supervisor.on('task-completed', (task) => {
            this.logs.supervisor.write(`[TASK_COMPLETED] ${task}\\n`);
            this.logs.routing.write(`[${new Date().toISOString()}] Task detected: ${task.substring(0, 50)}...\\n`);
        });
        
        // 启动 Supervisor
        this.supervisor.start().catch(err => {
            console.error('Failed to start supervisor:', err);
        });
    }
    
    /**
     * 注入智能询问
     */
    injectInquiry(question) {
        // 检查是否合适的时机
        if (!this.shouldInjectNow()) {
            // 延迟注入
            setTimeout(() => {
                this.injectInquiry(question);
            }, 5000);
            return;
        }
        
        // 记录路由决策
        this.logs.routing.write(`[${new Date().toISOString()}] Injecting inquiry: ${question}\\n`);
        
        // 自然地注入到 Worker 会话
        // 添加换行确保新行开始
        const formattedQuestion = `\\n${question}\\n`;
        
        // 注入到 Worker
        this.workerPty.write(formattedQuestion);
        
        // 同时显示给用户（模拟用户输入的效果）
        // 使用灰色显示表示这是自动生成的
        process.stdout.write(`\\x1b[90m${question}\\x1b[0m\\n`);
        
        // 记录
        this.logs.supervisor.write(`[INQUIRY] ${question}\\n`);
        this.state.inquiryPending = true;
        
        // 5秒后清除pending状态
        setTimeout(() => {
            this.state.inquiryPending = false;
        }, 5000);
    }
    
    /**
     * 判断是否适合注入询问
     */
    shouldInjectNow() {
        // 不在 Worker 繁忙时注入
        if (this.state.isWorkerBusy) return false;
        
        // 不在刚刚注入后立即再注入
        if (this.state.inquiryPending) return false;
        
        // 检查输出是否稳定（没有活跃输出）
        const lastOutput = this.state.lastWorkerOutput;
        if (lastOutput && lastOutput.includes('...')) return false;
        
        return true;
    }
    
    /**
     * 更新 Worker 状态
     */
    updateWorkerStatus(output) {
        // 检测 Worker 是否在思考/处理中
        const busyIndicators = [
            'thinking',
            'analyzing',
            'processing',
            'loading',
            '...'
        ];
        
        this.state.isWorkerBusy = busyIndicators.some(indicator => 
            output.toLowerCase().includes(indicator)
        );
    }
    
    /**
     * 设置信号处理
     */
    setupSignalHandlers() {
        const signals = ['SIGINT', 'SIGTERM'];
        
        signals.forEach(signal => {
            process.on(signal, () => {
                console.log(`\\n[Supervisor] Received ${signal}, shutting down...`);
                this.cleanup();
                process.exit(0);
            });
        });
    }
    
    /**
     * 清理资源
     */
    cleanup() {
        // 停止 Supervisor
        if (this.supervisor) {
            this.supervisor.stop();
        }
        
        // 关闭 Worker PTY
        if (this.workerPty) {
            this.workerPty.kill();
        }
        
        // 写入会话结束日志
        const timestamp = new Date().toISOString();
        this.logs.routing.write(`=== Session Ended: ${timestamp} ===\\n`);
        
        // 关闭日志流
        Object.values(this.logs).forEach(log => {
            if (log) log.end();
        });
    }
    
    /**
     * 生成会话报告
     */
    generateReport() {
        const duration = Date.now() - this.state.sessionStartTime;
        const minutes = Math.floor(duration / 60000);
        
        const report = `
=== Supervisor Session Report ===
Duration: ${minutes} minutes
Inquiries Generated: ${this.supervisor?.state.taskHistory.length || 0}
Worker Status: ${this.state.isWorkerBusy ? 'Busy' : 'Idle'}
Logs Location: ${this.logDir}
===================================
        `.trim();
        
        console.log(report);
        this.logs.routing.write(report);
    }
}

// 导出类
module.exports = Super;

// 如果直接运行
if (require.main === module) {
    const supervisor = new Super();
    supervisor.start();
}