# Supervisor-ME API 文档

## verify.sh

### 概述
核心验证脚本，执行测试并生成证据文件。

### 用法
```bash
./verify.sh
```

### 参数
无命令行参数（未来版本可能添加）

### 环境变量
- `NO_COLOR`: 设置为 `1` 禁用彩色输出
- `VERIFY_DEBUG`: 设置为 `1` 启用调试输出

### 输入
- **example-app/**: 包含待测试的应用
- **example-app/package.json**: 必须包含 `test` 脚本
- **.git/**: 可选，用于获取 commit hash

### 输出

#### 标准输出
```
================================================
     Supervisor-ME Verification System
================================================
✓ Found example-app directory

Running tests...

================================================
              Verification Results
================================================
Timestamp: 2024-01-20T10:30:00Z
Commit: abc123d
Tests Passed: 10
Tests Failed: 0
Total Tests: 10

✅ VERIFICATION PASSED
All tests are passing!

Proof saved to: .proof/latest.json
================================================
```

#### 证据文件 (.proof/latest.json)
```json
{
  "timestamp": "ISO 8601 时间戳",
  "commitHash": "Git SHA 或 'none'",
  "tests": {
    "passed": "通过的测试数",
    "failed": "失败的测试数",
    "total": "总测试数"
  },
  "status": "PASS | FAIL"
}
```

### 退出码
- `0`: 验证通过
- `1`: 验证失败或错误

### 错误处理
- example-app 不存在：退出码 1
- package.json 不存在：退出码 1
- 测试执行失败：继续执行，状态设为 FAIL
- JSON 生成失败：退出码 1

---

## monitor.sh

### 概述
自动监控文件变化并触发验证。

### 用法
```bash
./monitor.sh [选项]
```

### 参数
| 参数 | 描述 | 默认值 |
|------|------|--------|
| `--interval <秒>` | 检查间隔 | 5 |
| `--watch <目录>` | 监控目录 | example-app |

### 示例
```bash
# 默认配置
./monitor.sh

# 每10秒检查，监控src目录
./monitor.sh --interval 10 --watch src

# 快速响应模式
./monitor.sh --interval 1
```

### 输入
- 文件系统变化（通过时间戳检测）
- verify.sh 脚本（必须可执行）

### 输出

#### 标准输出
```
================================================
     Supervisor-ME Auto Monitor
================================================
Watching: example-app
Check interval: 5s
Log file: .proof/monitor.log

Press Ctrl+C to stop monitoring
------------------------------------------------
[10:30:00] Running initial verification...
[10:30:01] Initial status: ✅ PASS
[10:30:15] Detected file changes, running verification...
[10:30:16] Status: ✅ PASS (Passed: 10/10, Failed: 0)
[10:35:22] Detected file changes, running verification...
[10:35:23] Status: ❌ FAIL (Passed: 8/10, Failed: 2)
⚠️  ALERT: Tests started failing!
```

#### 日志文件 (.proof/monitor.log)
```
2024-01-20T10:30:00Z: Monitor started
2024-01-20T10:30:01Z: Initial status: PASS
2024-01-20T10:35:23Z: Status changed from PASS to FAIL
```

### 信号处理
- `SIGINT (Ctrl+C)`: 优雅关闭
- `SIGTERM`: 优雅关闭

### 平台兼容性
- macOS: 使用 `stat -f "%m"`
- Linux: 使用 `stat -c "%Y"`

---

## wrapper.js

### 概述
命令包装器，在执行特定命令前后进行验证。

### 用法
```bash
node wrapper.js <命令>
```

### 参数
| 参数 | 描述 |
|------|------|
| `<命令>` | 要执行的命令字符串 |

### 示例
```bash
# 显示帮助
node wrapper.js

# 执行简单命令
node wrapper.js "echo hello"

# 执行需要验证的命令
node wrapper.js "git commit -m 'done'"

# 执行后自动验证的命令
node wrapper.js "npm test"
```

### 配置
内置配置（可在代码中修改）：

```javascript
const CONFIG = {
    verifyBeforeCommands: ['commit', 'push'],  // 预验证命令
    autoVerifyAfter: ['test', 'build'],        // 后验证命令
    proofDir: '.proof',
    logFile: '.proof/wrapper.log'
};
```

### 输入
- 命令行参数
- verify.sh 脚本输出
- .proof/latest.json 文件

### 输出

#### 标准输出
```
⚠️  Command "git commit" requires verification first
🔍 Running Supervisor-ME verification...
✅ Verification PASSED - 10/10 tests passing
✅ Verification passed, proceeding with command...

📦 Executing: git commit -m 'feature complete'
----------------------------------------
[git output here]
----------------------------------------
```

#### 日志文件 (.proof/wrapper.log)
```
2024-01-20T10:30:00Z: Command: git commit -m 'done'
2024-01-20T10:30:01Z: Verification PASSED - 10/10 tests
2024-01-20T10:30:02Z: Command executed successfully
```

### 退出码
- 继承被包装命令的退出码
- 验证失败时退出码 `1`
- 用户中断时退出码 `130`

---

## test-all.sh

### 概述
完整的系统测试套件。

### 用法
```bash
./test-all.sh
```

### 参数
无参数

### 测试类别
1. **项目结构测试**
   - 目录存在性
   - 文件可执行性
   
2. **示例应用测试**
   - 文件完整性
   - npm 测试执行

3. **验证脚本测试**
   - verify.sh 功能
   - JSON 生成和验证

4. **故障场景测试**
   - 错误检测
   - 状态报告

5. **包装器测试**
   - 帮助信息
   - 命令执行

6. **清理测试**
   - 状态恢复
   - 最终验证

### 输出

#### 标准输出
```
================================================
     Supervisor-ME Complete Test Suite
================================================

1. Project Structure Tests
----------------------------------------
Testing: example-app directory exists
  ✅ PASSED
[更多测试...]

================================================
              Test Results Summary
================================================
Total Tests: 22
Passed: 22
Failed: 0

✅ ALL TESTS PASSED!
The Supervisor-ME system is working correctly.
```

### 退出码
- `0`: 所有测试通过
- `1`: 有测试失败

---

## 共享数据格式

### 证据文件格式

#### 字段说明

| 字段 | 类型 | 描述 | 示例 |
|------|------|------|------|
| timestamp | string | ISO 8601 时间戳 | "2024-01-20T10:30:00Z" |
| commitHash | string | Git commit SHA | "abc123def456..." |
| tests.passed | integer | 通过的测试数 | 10 |
| tests.failed | integer | 失败的测试数 | 0 |
| tests.total | integer | 总测试数 | 10 |
| status | string | 整体状态 | "PASS" 或 "FAIL" |

#### 验证规则
- `status` = "PASS" 当且仅当 `tests.failed` = 0
- `tests.total` = `tests.passed` + `tests.failed`
- `commitHash` = "none" 如果不在 git 仓库中

### 日志格式

#### monitor.log
```
<ISO时间戳>: <事件描述>
```

#### wrapper.log
```
<ISO时间戳>: <事件类型>: <详细信息>
```

---

## 错误代码

### verify.sh 错误
| 代码 | 描述 | 解决方案 |
|------|------|----------|
| 1 | example-app 不存在 | 创建 example-app 目录 |
| 1 | package.json 不存在 | 创建 package.json 文件 |
| 1 | 测试失败 | 修复失败的测试 |

### monitor.sh 错误
| 代码 | 描述 | 解决方案 |
|------|------|----------|
| 1 | 无效参数 | 检查命令行参数 |
| 130 | 用户中断 | 正常退出 |

### wrapper.js 错误
| 代码 | 描述 | 解决方案 |
|------|------|----------|
| 1 | 验证失败 | 修复测试后重试 |
| 1 | 命令执行失败 | 检查命令语法 |
| 130 | 用户中断 | 正常退出 |

---

## 扩展接口

### 自定义测试解析器

修改 `verify.sh` 中的解析逻辑：

```bash
# 添加对新测试框架的支持
if echo "$TEST_OUTPUT" | grep -q "YourFramework"; then
    # 自定义解析逻辑
    TESTS_PASSED=$(...)
    TESTS_FAILED=$(...)
fi
```

### 自定义通知

在 `monitor.sh` 中添加：

```bash
# 发送通知
send_notification() {
    local status=$1
    curl -X POST https://your-webhook-url \
         -H "Content-Type: application/json" \
         -d "{\"status\":\"$status\"}"
}
```

### 插件系统

在 `wrapper.js` 中实现：

```javascript
// 加载插件
const plugins = require('./plugins.json');

// 执行插件钩子
plugins.forEach(plugin => {
    if (plugin.beforeVerify) {
        plugin.beforeVerify(command);
    }
});
```

---

## 版本兼容性

### 依赖版本
- Bash: 3.2+
- Node.js: 14+
- npm: 6+
- Git: 2.0+（可选）

### 操作系统
- macOS: 10.15+
- Linux: Ubuntu 18.04+, CentOS 7+
- Windows: WSL2 推荐

### 测试框架
- Jest: 26+
- Mocha: 8+（需要适配）
- 其他：需要自定义解析器

---

## 性能指标

### 典型执行时间
| 操作 | 时间 |
|------|------|
| verify.sh | 1-5 秒 |
| monitor.sh 检测 | < 100ms |
| wrapper.js 开销 | < 50ms |
| test-all.sh | 10-30 秒 |

### 资源占用
| 组件 | CPU | 内存 |
|------|-----|------|
| verify.sh | < 5% | < 50MB |
| monitor.sh | < 1% | < 20MB |
| wrapper.js | < 1% | < 30MB |

### 扩展限制
- 最大测试数：10,000
- 最大日志文件：100MB
- 监控文件数：10,000
- 证据文件大小：1MB