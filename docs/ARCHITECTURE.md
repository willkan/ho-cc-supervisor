# Supervisor-ME 架构设计

## 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Supervisor-ME System                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  verify.sh  │  │  monitor.sh  │  │   wrapper.js    │  │
│  │             │  │              │  │                 │  │
│  │  Core       │  │  Auto        │  │  Command        │  │
│  │  Validator  │  │  Monitor     │  │  Interceptor    │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                │                    │           │
│         └────────────────┼────────────────────┘           │
│                          │                                │
│                    ┌─────▼──────┐                        │
│                    │            │                        │
│                    │  Test      │                        │
│                    │  Runner    │                        │
│                    │            │                        │
│                    └─────┬──────┘                        │
│                          │                                │
│                    ┌─────▼──────┐                        │
│                    │            │                        │
│                    │  Evidence  │                        │
│                    │  Generator │                        │
│                    │            │                        │
│                    └─────┬──────┘                        │
│                          │                                │
│                    ┌─────▼──────┐                        │
│                    │  .proof/   │                        │
│                    │  Storage   │                        │
│                    └────────────┘                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 组件说明

### 1. verify.sh - 核心验证器

**职责**：
- 检查项目结构完整性
- 执行测试套件
- 解析测试结果
- 生成证据文件

**工作流程**：
```bash
1. 验证 example-app 目录存在
2. 检查并安装依赖
3. 运行 npm test
4. 解析输出（支持多种格式）
5. 获取 git commit hash
6. 生成 JSON 证据
7. 返回状态码
```

**关键特性**：
- 错误处理和恢复
- 多格式测试输出解析
- 彩色终端输出
- 原子性操作

### 2. monitor.sh - 自动监控器

**职责**：
- 监控文件系统变化
- 定期执行验证
- 记录状态变化
- 发出警报

**工作流程**：
```bash
1. 初始化监控参数
2. 获取基准时间戳
3. 循环检测：
   a. 休眠指定间隔
   b. 比较文件时间戳
   c. 检测到变化则运行验证
   d. 记录并报告结果
```

**关键特性**：
- 跨平台兼容（macOS/Linux）
- 实时状态反馈
- 日志记录
- 状态变化警报

### 3. wrapper.js - 命令包装器

**职责**：
- 拦截命令执行
- 预验证检查
- 后验证确认
- 日志审计

**工作流程**：
```javascript
1. 解析命令参数
2. 检查是否需要预验证
3. 执行验证（如需要）
4. 运行原始命令
5. 执行后验证（如配置）
6. 返回结果
```

**关键特性**：
- 命令分类（需要预验证/后验证）
- 透明代理执行
- 失败阻断机制
- 审计日志

### 4. test-all.sh - 测试套件

**职责**：
- 完整系统测试
- 回归测试
- 故障场景验证
- 测试报告生成

**测试覆盖**：
1. 项目结构测试
2. 示例应用测试
3. 验证脚本测试
4. 故障检测测试
5. 包装器测试
6. 清理和恢复测试

## 数据流

### 验证数据流

```
源代码 → 测试执行 → 结果解析 → 证据生成 → 状态判定
   ↓         ↓          ↓          ↓          ↓
 .js文件   npm test   stdout    .json文件   PASS/FAIL
```

### 监控数据流

```
文件系统 → 时间戳检查 → 变化检测 → 触发验证 → 状态更新
    ↓          ↓           ↓          ↓          ↓
  源文件     stat命令    比较差异    verify.sh   日志/警报
```

## 证据结构

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["timestamp", "commitHash", "tests", "status"],
  "properties": {
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 格式的时间戳"
    },
    "commitHash": {
      "type": "string",
      "description": "Git commit SHA 或 'none'"
    },
    "tests": {
      "type": "object",
      "required": ["passed", "failed", "total"],
      "properties": {
        "passed": {"type": "integer", "minimum": 0},
        "failed": {"type": "integer", "minimum": 0},
        "total": {"type": "integer", "minimum": 0}
      }
    },
    "status": {
      "type": "string",
      "enum": ["PASS", "FAIL"],
      "description": "整体验证状态"
    }
  }
}
```

## 扩展性设计

### 1. 测试框架支持

当前支持 Jest，可扩展支持：
- Mocha
- Jasmine
- pytest
- go test
- cargo test

通过修改 `verify.sh` 中的解析逻辑实现。

### 2. 证据存储

当前使用本地文件系统，可扩展：
- 数据库存储（SQLite/PostgreSQL）
- 云存储（S3/GCS）
- 区块链存储（不可篡改性）

### 3. 通知机制

可添加：
- Slack/Discord 通知
- 邮件警报
- Webhook 集成
- 仪表板可视化

### 4. 命令扩展

`wrapper.js` 可配置：
- 自定义命令规则
- 动态加载配置
- 插件系统
- 策略引擎

## 安全考虑

1. **证据防篡改**
   - 使用时间戳
   - 包含 git hash
   - 可选：数字签名

2. **权限控制**
   - 脚本执行权限
   - 目录访问控制
   - 日志文件保护

3. **输入验证**
   - 参数检查
   - 路径验证
   - 命令注入防护

## 性能优化

1. **缓存策略**
   - node_modules 缓存
   - 测试结果缓存
   - 时间戳缓存

2. **并发处理**
   - 并行测试执行
   - 异步文件监控
   - 批量验证

3. **资源管理**
   - 内存使用控制
   - 日志轮转
   - 清理机制

## 部署模式

### 1. 本地开发

```bash
# 开发时持续监控
./monitor.sh --interval 3
```

### 2. CI/CD 集成

```yaml
# GitHub Actions 示例
- name: Verify Code
  run: ./verify.sh
```

### 3. Pre-commit Hook

```bash
#!/bin/sh
./verify.sh || exit 1
```

### 4. 容器化部署

```dockerfile
FROM node:14
COPY . /app
WORKDIR /app
RUN chmod +x *.sh
CMD ["./monitor.sh"]
```

## 故障恢复

1. **测试失败处理**
   - 详细错误日志
   - 状态回滚建议
   - 自动重试机制

2. **系统异常处理**
   - 信号捕获
   - 优雅关闭
   - 状态持久化

3. **数据恢复**
   - 证据文件备份
   - 日志归档
   - 配置备份