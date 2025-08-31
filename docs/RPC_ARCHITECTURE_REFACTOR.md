# CC-Supervisor RPC Architecture Refactor

**日期**: 2025-01-31  
**状态**: 计划中  
**影响范围**: 核心通信机制  

## 背景和动机

### 当前架构问题
```
Hook Scripts                    cc-supervisor-claude
     ↓                               ↑
写入 .issues 文件            定时器轮询文件 (每500ms)
     ↓                               ↑
文件系统 I/O                  文件读取和解析
```

**问题分析**:
1. **性能开销**: 每500ms轮询文件系统
2. **时序问题**: 轮询延迟导致反应滞后
3. **调试困难**: 异步文件操作，日志分散
4. **资源浪费**: 持续的定时器和文件I/O
5. **扩展限制**: 难以添加双向通信功能

### 目标架构
```
Hook Scripts (RPC Client)       cc-supervisor-claude (RPC Server)
     ↓                               ↑
调用 reportIssue()             实时接收和处理
     ↓                               ↑
Unix Socket 通信              事件驱动响应
```

**预期改进**:
- ⚡ **实时响应**: 从1000ms延迟降到<100ms
- 📝 **清晰日志**: 双向通信日志，便于调试
- 💪 **更好性能**: 去除定时器，事件驱动
- 🔧 **易扩展**: 支持更多RPC方法和功能

## 详细实施计划

### Phase 1: RPC Server 集成 [预计2小时]

#### 1.1 修改 cc-supervisor-claude.js
**目标**: 在启动时集成 RPC Server

**关键变更**:
```javascript
// 新增导入
const CCSupervisorRPCServer = require('../lib/rpc-server');

class ClaudeProxy {
    constructor() {
        // 现有代码...
        this.rpcServer = new CCSupervisorRPCServer();
    }
    
    async start() {
        // 启动RPC服务器
        await this.rpcServer.start();
        this.rpcServer.onIssue((sessionId, issueData) => {
            this.handleIssuesFromRPC(sessionId, issueData);
        });
        
        // 现有PTY启动代码...
    }
}
```

**需要实现的方法**:
- `handleIssuesFromRPC(sessionId, issueData)` - 处理RPC传来的问题
- 保持现有的 `injectCommand()` 功能不变

#### 1.2 兼容性考虑
- **向后兼容**: 保留文件轮询机制，同时支持RPC
- **渐进迁移**: 先添加RPC支持，再移除文件轮询
- **错误处理**: RPC失败时自动降级到文件机制

#### 1.3 测试验证
```bash
# 测试RPC服务器启动
cc-supervisor-claude --debug
# 应该看到 "[RPC] 🚀 RPC Server 启动: /tmp/cc-supervisor-rpc.sock"

# 测试RPC连接
echo '{"method":"ping","id":1}' | nc -U /tmp/cc-supervisor-rpc.sock
# 应该收到 pong 响应
```

### Phase 2: Stop Hook RPC Client 转换 [预计1.5小时]

#### 2.1 修改 .claude/hooks/stop.sh
**目标**: 将文件写入改为RPC调用

**当前代码**:
```bash
# 写入issues文件
echo "$result" > "$issues_file"
```

**目标代码**:
```bash
# RPC调用函数
call_rpc() {
    local method="$1"
    local params="$2"
    local socket_path="/tmp/cc-supervisor-rpc.sock"
    
    if [ -S "$socket_path" ]; then
        local request=$(cat <<EOF
{"method":"$method","params":$params,"id":$(date +%s)}
EOF
)
        echo "$request" | nc -U "$socket_path" 2>/dev/null
        return $?
    else
        return 1
    fi
}

# 使用RPC调用
rpc_params=$(cat <<EOF
{
    "sessionId": "$session_to_use",
    "issueData": $(echo "$result" | jq -R -s .),
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
}
EOF
)

if call_rpc "reportIssue" "$rpc_params"; then
    echo "[RPC] ✅ 问题已通过RPC发送" >&2
else
    echo "[RPC] ⚠️ RPC失败，使用文件fallback" >&2
    # fallback到原有文件方式
    echo "$result" > "$issues_file"
fi
```

#### 2.2 依赖处理
**需要的工具**:
- `nc` (netcat) - Unix socket客户端
- `jq` - JSON处理工具

**兼容性检查**:
```bash
# 在hook中检查工具可用性
command -v nc >/dev/null 2>&1 || { echo "nc not found, using file fallback"; return 1; }
command -v jq >/dev/null 2>&1 || { echo "jq not found, using file fallback"; return 1; }
```

#### 2.3 错误处理策略
1. **RPC优先**: 先尝试RPC调用
2. **自动降级**: RPC失败时使用文件机制
3. **超时处理**: RPC调用3秒超时
4. **重试机制**: 失败时重试一次

### Phase 3: 性能优化和清理 [预计1小时]

#### 3.1 移除文件轮询机制
**移除的代码**:
- `checkIssuesFile()` 定时器
- `setInterval` 相关代码
- 文件监控逻辑

**保留的代码**:
- Session跟踪 (`checkActiveSession`)
- PTY管理
- 命令注入逻辑

#### 3.2 性能监控
**添加指标**:
```javascript
class PerformanceMetrics {
    constructor() {
        this.rpcCalls = 0;
        this.rpcLatency = [];
        this.rpcErrors = 0;
    }
    
    recordRPCCall(latency) {
        this.rpcCalls++;
        this.rpcLatency.push(latency);
    }
    
    getStats() {
        return {
            totalCalls: this.rpcCalls,
            averageLatency: this.rpcLatency.reduce((a,b) => a+b, 0) / this.rpcLatency.length,
            errorRate: this.rpcErrors / this.rpcCalls
        };
    }
}
```

### Phase 4: 测试和验证 [预计1小时]

#### 4.1 单元测试
```javascript
// test/rpc-integration.test.js
describe('RPC Integration', () => {
    it('should start RPC server', async () => {
        const server = new CCSupervisorRPCServer();
        const socketPath = await server.start();
        expect(fs.existsSync(socketPath)).toBe(true);
    });
    
    it('should handle reportIssue RPC call', (done) => {
        // 测试RPC调用处理
    });
});
```

#### 4.2 端到端测试
```bash
# 完整流程测试
./test/rpc-e2e-test.sh
# 1. 启动cc-supervisor-claude
# 2. 触发stop hook
# 3. 验证RPC通信
# 4. 确认自动注入
```

#### 4.3 性能基准测试
```bash
# 对比测试：文件轮询 vs RPC
./test/performance-comparison.sh
# 测量延迟、CPU使用率、内存占用
```

## 风险评估和缓解

### 主要风险
1. **向后兼容性**: 老版本hook脚本失效
2. **系统依赖**: nc/jq工具缺失
3. **网络问题**: Unix socket权限或连接问题
4. **性能回退**: RPC开销比文件轮询更大

### 缓解措施
1. **渐进迁移**: 
   - 第一阶段同时支持RPC和文件
   - 逐步迁移用户
   - 最后移除文件支持

2. **优雅降级**:
   ```bash
   # Hook脚本中的fallback逻辑
   if ! call_rpc_with_timeout 3s; then
       fallback_to_file_method
   fi
   ```

3. **监控和告警**:
   ```javascript
   if (rpcErrorRate > 0.1) {
       console.warn('[RPC] High error rate, consider fallback');
   }
   ```

4. **文档和迁移指南**:
   - 详细的升级说明
   - 故障排除指南
   - 回滚方案

## 成功标准

### 功能标准
- ✅ 所有现有功能正常工作
- ✅ RPC调用成功率 > 99%
- ✅ 向后兼容现有hook脚本

### 性能标准
- ✅ 响应延迟 < 100ms (vs 当前1000ms)
- ✅ CPU使用率减少 > 50%
- ✅ 内存使用保持稳定

### 可维护性标准
- ✅ 清晰的双向调试日志
- ✅ 完整的单元和集成测试
- ✅ 详细的架构文档

## 时间线

| 阶段 | 预计时间 | 里程碑 |
|-----|---------|--------|
| Phase 1 | 2小时 | RPC Server集成完成 |
| Phase 2 | 1.5小时 | Hook RPC Client完成 |
| Phase 3 | 1小时 | 性能优化完成 |
| Phase 4 | 1小时 | 测试验证完成 |
| **总计** | **5.5小时** | **架构重构完成** |

## 回滚计划

如果重构出现问题，可以通过以下步骤回滚：

1. **立即回滚**: `git revert <commit-hash>`
2. **禁用RPC**: 设置环境变量 `CC_SUPERVISOR_DISABLE_RPC=1`
3. **文件机制**: 自动降级到原有文件轮询机制
4. **验证功能**: 运行完整测试套件确认功能正常

---

**注意**: 这个重构是一个重大架构变更，建议在充分测试后再部署到生产环境。