/**
 * CC-Supervisor RPC 服务器
 * 接收 Hook Scripts 的验证结果，触发自动注入
 */

const net = require('net');
const path = require('path');
const fs = require('fs');
const os = require('os');

class CCSupervisorRPCServer {
    constructor(options = {}) {
        this.port = options.port || 0; // 0表示随机端口
        this.server = null;
        this.sessions = new Map(); // sessionId -> sessionInfo
        this.onIssueCallback = null; // 问题回调函数
        
        // RPC Socket 文件路径
        this.socketPath = path.join(os.tmpdir(), 'cc-supervisor-rpc.sock');
    }

    /**
     * 启动 RPC 服务器
     */
    async start() {
        return new Promise((resolve, reject) => {
            // 清理旧的 socket 文件
            if (fs.existsSync(this.socketPath)) {
                fs.unlinkSync(this.socketPath);
            }

            // 使用 Unix Socket 而不是 TCP（更安全）
            this.server = net.createServer((socket) => {
                this.handleConnection(socket);
            });

            this.server.listen(this.socketPath, () => {
                console.error(`[RPC] 🚀 RPC Server 启动: ${this.socketPath}`);
                resolve(this.socketPath);
            });

            this.server.on('error', (err) => {
                console.error(`[RPC] ❌ 服务器错误: ${err.message}`);
                reject(err);
            });

            // 优雅关闭处理
            process.on('SIGINT', () => this.stop());
            process.on('SIGTERM', () => this.stop());
        });
    }

    /**
     * 停止服务器
     */
    stop() {
        if (this.server) {
            this.server.close();
            if (fs.existsSync(this.socketPath)) {
                fs.unlinkSync(this.socketPath);
            }
            console.error('[RPC] 🛑 RPC Server 已停止');
        }
    }

    /**
     * 处理客户端连接
     */
    handleConnection(socket) {
        console.error('[RPC] 📞 Hook 连接');
        
        let buffer = '';
        
        socket.on('data', (data) => {
            buffer += data.toString();
            
            // 按行处理 JSON-RPC 请求
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 保留不完整的行
            
            for (const line of lines) {
                if (line.trim()) {
                    this.handleRPCRequest(socket, line.trim());
                }
            }
        });

        socket.on('close', () => {
            console.error('[RPC] 📴 Hook 连接关闭');
        });

        socket.on('error', (err) => {
            console.error(`[RPC] ❌ 连接错误: ${err.message}`);
        });
    }

    /**
     * 处理 RPC 请求
     */
    handleRPCRequest(socket, data) {
        try {
            const request = JSON.parse(data);
            console.error(`[RPC] 📨 收到请求: ${request.method}`);
            
            let response;
            
            switch (request.method) {
                case 'registerSession':
                    response = this.registerSession(request.params);
                    break;
                    
                case 'reportIssue':
                    response = this.reportIssue(request.params);
                    break;
                    
                case 'ping':
                    response = { success: true, message: 'pong' };
                    break;
                    
                default:
                    response = { 
                        success: false, 
                        error: `Unknown method: ${request.method}` 
                    };
            }

            // 发送响应
            const responseData = {
                id: request.id,
                result: response
            };
            
            socket.write(JSON.stringify(responseData) + '\n');
            console.error(`[RPC] 📤 发送响应: ${response.success ? '✅' : '❌'}`);
            
        } catch (err) {
            console.error(`[RPC] ❌ 处理请求失败: ${err.message}`);
            
            const errorResponse = {
                id: null,
                error: { code: -1, message: err.message }
            };
            
            socket.write(JSON.stringify(errorResponse) + '\n');
        }
    }

    /**
     * 注册会话
     */
    registerSession(params) {
        const { sessionId, projectPath } = params;
        
        if (!sessionId) {
            return { success: false, error: 'sessionId is required' };
        }
        
        this.sessions.set(sessionId, {
            sessionId,
            projectPath,
            registeredAt: new Date().toISOString()
        });
        
        console.error(`[RPC] 📝 会话已注册: ${sessionId.substring(0, 8)}...`);
        
        return { 
            success: true, 
            message: `Session ${sessionId} registered` 
        };
    }

    /**
     * 报告问题（核心方法）
     */
    reportIssue(params) {
        const { sessionId, issueData, timestamp } = params;
        
        if (!sessionId || !issueData) {
            return { 
                success: false, 
                error: 'sessionId and issueData are required' 
            };
        }
        
        console.error(`[RPC] 🔍 收到问题报告: ${sessionId.substring(0, 8)}...`);
        console.error(`[RPC]   问题类型: ${this.extractIssueType(issueData)}`);
        
        // 触发自动注入回调
        if (this.onIssueCallback) {
            try {
                this.onIssueCallback(sessionId, issueData);
            } catch (err) {
                console.error(`[RPC] ❌ 问题处理回调失败: ${err.message}`);
                return { 
                    success: false, 
                    error: `Callback failed: ${err.message}` 
                };
            }
        }
        
        return { 
            success: true, 
            message: 'Issue received and processed',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 设置问题处理回调
     */
    onIssue(callback) {
        this.onIssueCallback = callback;
    }

    /**
     * 提取问题类型（用于日志）
     */
    extractIssueType(issueData) {
        if (typeof issueData === 'string') {
            if (issueData.includes('语法错误')) return '语法错误';
            if (issueData.includes('安全问题')) return '安全问题';
            if (issueData.includes('类型错误')) return '类型错误';
            return '代码质量问题';
        }
        return '未知问题类型';
    }

    /**
     * 获取服务器状态
     */
    getStatus() {
        return {
            running: !!this.server && this.server.listening,
            socketPath: this.socketPath,
            sessions: this.sessions.size,
            uptime: process.uptime()
        };
    }
}

module.exports = CCSupervisorRPCServer;