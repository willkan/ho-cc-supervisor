#!/usr/bin/env node

/**
 * Session Monitor - 监控 Worker Claude 的会话
 * 在 Supervisor 窗口运行，监听 Worker 的输出
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const InquiryGenerator = require('./inquiry-generator');
const ProjectAnalyzer = require('./project-analyzer');

class SessionMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            sessionFile: options.sessionFile || path.join(process.cwd(), '.super', 'worker-session.log'),
            watchInterval: options.watchInterval || 1000,  // 1秒检查一次
            projectRoot: options.projectRoot || process.cwd(),
            ...options
        };
        
        this.state = {
            lastPosition: 0,
            lastAnalysis: null,
            projectContext: null,
            recentTasks: []
        };
        
        this.inquiryGenerator = new InquiryGenerator();
        this.projectAnalyzer = new ProjectAnalyzer(this.config.projectRoot);
        
        this.setupDirectories();
    }
    
    /**
     * 设置目录
     */
    setupDirectories() {
        const logDir = path.dirname(this.config.sessionFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }
    
    /**
     * 开始监控
     */
    async start() {
        console.log('🔍 Session Monitor Started');
        console.log(`📁 Monitoring: ${this.config.sessionFile}`);
        console.log('');
        
        // 初始分析项目
        await this.analyzeProject();
        
        // 开始监听文件
        this.watchSession();
        
        // 定期分析
        setInterval(() => {
            this.performAnalysis();
        }, 30000); // 30秒分析一次
    }
    
    /**
     * 分析项目
     */
    async analyzeProject() {
        console.log('📊 Analyzing project structure...');
        this.state.projectContext = await this.projectAnalyzer.analyze();
        const summary = this.projectAnalyzer.generateSummary();
        
        console.log('Project Type:', summary.projectType);
        console.log('Test Framework:', summary.testFramework || 'None');
        console.log('Quality Tools:', summary.qualityTools.join(', ') || 'None');
        console.log('---\n');
    }
    
    /**
     * 监听会话文件
     */
    watchSession() {
        // 检查文件是否存在
        if (!fs.existsSync(this.config.sessionFile)) {
            console.log('⏳ Waiting for worker session to start...');
            console.log(`   (Worker should write to: ${this.config.sessionFile})`);
        }
        
        // 定期检查文件变化
        setInterval(() => {
            this.readNewContent();
        }, this.config.watchInterval);
    }
    
    /**
     * 读取新内容
     */
    readNewContent() {
        if (!fs.existsSync(this.config.sessionFile)) {
            return;
        }
        
        const stats = fs.statSync(this.config.sessionFile);
        if (stats.size > this.state.lastPosition) {
            // 有新内容
            const stream = fs.createReadStream(this.config.sessionFile, {
                start: this.state.lastPosition,
                end: stats.size
            });
            
            let newContent = '';
            stream.on('data', (chunk) => {
                newContent += chunk.toString();
            });
            
            stream.on('end', () => {
                this.state.lastPosition = stats.size;
                this.processNewContent(newContent);
            });
        }
    }
    
    /**
     * 处理新内容
     */
    processNewContent(content) {
        // 检测任务完成标记
        const completionPatterns = [
            /✅|✓|done|completed|finished|implemented|fixed/gi,
            /all tests pass/gi,
            /successfully|works now/gi,
            /feature is ready/gi,
            /已完成|完成了|搞定/gi
        ];
        
        let hasCompletion = false;
        let matchedPattern = null;
        
        for (const pattern of completionPatterns) {
            if (pattern.test(content)) {
                hasCompletion = true;
                matchedPattern = content.match(pattern)[0];
                break;
            }
        }
        
        if (hasCompletion) {
            console.log(`\n🎯 Detected completion claim: "${matchedPattern}"`);
            
            // 提取相关上下文
            const lines = content.split('\n');
            const relevantLines = lines.slice(-10).join('\n'); // 最后10行
            
            // 生成智能询问
            this.generateInquiry(relevantLines);
        }
        
        // 显示关键内容
        if (content.includes('error') || content.includes('Error')) {
            console.log('⚠️  Error detected in worker session');
        }
        
        if (content.includes('test') && content.includes('fail')) {
            console.log('❌ Test failure detected');
        }
    }
    
    /**
     * 生成智能询问
     */
    generateInquiry(context) {
        // 根据上下文生成询问
        let issue = {
            type: 'code_quality',
            details: {}
        };
        
        // 分析上下文确定问题类型
        if (context.includes('test')) {
            issue.type = 'missing_tests';
            issue.details.function_name = '新功能';
        } else if (context.includes('auth') || context.includes('login')) {
            issue.type = 'security';
            issue.details.data_source = '用户输入';
        } else if (context.includes('api') || context.includes('endpoint')) {
            issue.type = 'api_contract';
        }
        
        const inquiry = this.inquiryGenerator.generate(issue, this.state.projectContext);
        
        console.log('\n💡 Suggested inquiry:');
        console.log(`   "${inquiry}"`);
        console.log('\n📋 You can copy and paste this to Worker session\n');
        
        // 记录到文件
        this.logInquiry(inquiry);
    }
    
    /**
     * 执行定期分析
     */
    performAnalysis() {
        // 运行测试验证
        const { spawn } = require('child_process');
        const verifyPath = path.join(__dirname, '..', 'scripts', 'verify.sh');
        
        if (fs.existsSync(verifyPath)) {
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
                    console.log('🔴 Background test failed!');
                    this.analyzeTestFailure(output);
                } else {
                    console.log('🟢 Background test passed');
                }
            });
        }
    }
    
    /**
     * 分析测试失败
     */
    analyzeTestFailure(output) {
        const issue = {
            type: 'test_failure',
            details: {
                test_name: 'background test',
                error: output.substring(0, 100),
                possible_cause: '代码更改导致测试失败'
            }
        };
        
        const inquiry = this.inquiryGenerator.generate(issue);
        console.log('\n⚠️  Test failure inquiry:');
        console.log(`   "${inquiry}"`);
        console.log('');
        
        this.logInquiry(inquiry);
    }
    
    /**
     * 记录询问
     */
    logInquiry(inquiry) {
        const inquiryLog = path.join(path.dirname(this.config.sessionFile), 'inquiries.log');
        const timestamp = new Date().toISOString();
        const entry = `[${timestamp}] ${inquiry}\n`;
        
        fs.appendFileSync(inquiryLog, entry);
    }
    
    /**
     * 显示状态
     */
    showStatus() {
        console.log('\n📊 Monitor Status:');
        console.log(`   Session File: ${this.config.sessionFile}`);
        console.log(`   Bytes Read: ${this.state.lastPosition}`);
        console.log(`   Project Type: ${this.state.projectContext?.stack?.framework || 'Unknown'}`);
        console.log('');
    }
}

// 如果直接运行
if (require.main === module) {
    const monitor = new SessionMonitor({
        sessionFile: process.argv[2] || path.join(process.cwd(), '.super', 'worker-session.log')
    });
    
    monitor.start();
    
    // 定期显示状态
    setInterval(() => {
        monitor.showStatus();
    }, 60000); // 每分钟
    
    // 优雅退出
    process.on('SIGINT', () => {
        console.log('\n👋 Session Monitor stopped');
        process.exit(0);
    });
}

module.exports = SessionMonitor;