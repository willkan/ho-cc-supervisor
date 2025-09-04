# CC-Supervisor 使用指南

## 📦 安装方式

### 方式一：NPM 安装（推荐）

```bash
# 1. 全局安装
npm install -g ho-cc-supervisor

# 2. 进入你的项目
cd your-project

# 3. 初始化监工系统
cc-supervisor init

# 4. 正常启动 Claude Code
claude
```

### 方式二：本地开发安装

```bash
# 1. 克隆并进入项目
git clone https://github.com/willkan/ho-cc-supervisor.git
cd ho-cc-supervisor

# 2. 链接到全局
npm link

# 3. 在你的项目中初始化
cd your-project
cc-supervisor init

# 4. 启动 Claude Code
claude
```

## 🛠️ 命令行工具

### 初始化命令
```bash
cc-supervisor init
```
功能：
- 创建 `.claude/` 目录结构
- 安装监工Hook脚本到 `.claude/hooks/stop.sh`
- 配置 `settings.json` 启用Hook（300秒超时）
- 生成默认监工规则到 `.claude/supervisor-rules.txt`

### 日志查看命令

```bash
# 查看最新日志（最后20行）
cc-supervisor logs

# 实时跟踪现有日志文件
cc-supervisor logs -f

# 等待并监控新的监工session（推荐）
cc-supervisor logs -w

# 查看最后50行日志
cc-supervisor logs -n 50

# 列出所有可用的日志文件
cc-supervisor logs --list

# 查看特定session的日志
cc-supervisor logs --session <session-id>
```

**-f vs -w 参数说明：**
- `-f (--follow)`: 对现有日志文件进行tail -f跟踪
- `-w (--watch)`: 等待新的监工session产生，自动跟踪新日志（更适合监控）

### 清理命令

```bash
# 清理7天前的日志（默认）
cc-supervisor clean

# 清理所有今天的日志
cc-supervisor clean --days 0

# 清理所有项目的日志
cc-supervisor clean --all
```

## 📋 监工工作流程

### 1. 正常工作流程（监工通过）
```
你: "创建一个计算器函数"
工作Claude: [编写代码...]
工作Claude: ✨ 计算器函数创建完成，包含加减乘除功能和错误处理

[Stop Hook自动触发]
监工Claude: 检查代码质量...功能完整，实现清晰
监工结果: PASS (返回 {})
Claude正常停止
```

### 2. 发现偷懒行为（监工阻止）
```
你: "修复登录验证 bug"
工作Claude: [稍作修改...]
工作Claude: ✨ 基本修复完成，应该可以工作了

[Stop Hook自动触发]
监工Claude: 发现问题：使用模糊词汇'基本'、'应该'
监工结果: BLOCK (返回 {"decision": "block", "reason": "..."})
Claude被要求继续工作，不允许停止
```

### 3. ESC 中断（不触发监工）
```
你: "重构整个项目"
工作Claude: [开始重构...]
你: [按 ESC 键中断]
工作Claude: [停止]

[不触发监工检查 - 用户主动中断]
```

## 🎯 核心概念

### Hook机制架构
```
Claude Code (工作实例)
    │
    ├─ 尝试停止对话
    │
    └─ Stop Hook触发
        │
        ├─ 调用 stop.sh
        │
        └─ claude -p (监工检查)
            │
            ├─ 质量合格 → 返回 {} → 允许停止
            │
            └─ 发现问题 → 返回 {"decision": "block", "reason": "..."} → 阻止停止
```

### 监工触发时机
| 情况 | 是否触发监工 | 说明 |
|-----|-------------|------|
| Claude正常完成任务 | ✅ 是 | Stop Hook自动检查质量 |
| 用户按ESC中断 | ❌ 否 | 用户主动控制，无需检查 |
| 系统错误停止 | ❌ 否 | 非正常结束 |

### 防无限循环机制
1. **stop_hook_active标识**: Claude传递此标识避免递归
2. **隔离目录执行**: 监工在 `/tmp/cc-supervisor/` 独立目录运行
3. **代理响应过滤**: 自动过滤"proxy success"等异常响应

### JSON通信格式（Claude Code官方要求）
```json
// 阻止停止
{
  "decision": "block",
  "reason": "具体问题描述"
}

// 允许停止
{}
```

## ⚙️ 配置文件

### .claude/settings.json
```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/stop.sh",
        "timeout": 300
      }]
    }]
  }
}
```
**注意**: timeout设置为300秒，给监工Claude足够的检查时间

### .claude/supervisor-rules.txt
监工检查规则，可自定义：

```text
# Claude 监工规则 - 防偷懒检查清单

## 1. 模糊话术检测
- 使用"基本"、"大部分"、"应该"、"可能"等不确定词汇
- 用"虽然...但是..."、"尽管...不过..."掩盖问题

## 2. TODO停顿行为  
- 列出了工作计划但停下来问"是否继续"
- 该继续工作时却主动停顿等待指示

## 3. 虚假完成声明
- 声称"已完成"但明显还有问题未解决
- 说"成功实现"但存在明显的错误或遗漏
- 通过skip/no-verify等行为跳过测试

## 4. 工作逃避行为
- 使用"还需要"、"尚未"、"暂时没有"等推脱词汇
- 将应该立即解决的问题推给"后续处理"

## 5. 责任推卸
- 把错误归咎于"系统限制"而不尝试解决
- 遇到困难就建议用户"手动处理"
```

## 🐛 调试技巧

### 实时监控新Session
```bash
# 推荐：等待新的监工session并自动跟踪
cc-supervisor logs -w

# 监控输出示例：
📡 等待新的监工session... (Ctrl+C 退出)
监控目录: /tmp/cc-supervisor/-Users-username-project

✅ 发现活动日志: cce68d4e-d792-4486-a2d4-e8596908a1ae
📄 开始跟踪: /tmp/cc-supervisor/.../debug.log

[2025-09-01 14:56:51] ===== 监工Hook开始 =====
[2025-09-01 14:56:51] Hook进程PID: 47593
[2025-09-01 14:56:51] 开始调用claude -p...
[2025-09-01 14:57:44] 监工决定: PASS - 工作质量合格
```

### 查看调试日志结构
```bash
# 列出所有session
cc-supervisor logs --list

# 输出示例：
可用的Session日志:
  📁 abc123-session-id
     创建时间: 2025-09-01 14:56:51
     文件大小: 4.23 KB
  📁 def456-session-id
     创建时间: 2025-09-01 15:10:22
     文件大小: 6.81 KB
```

### 手动测试监工Hook
```bash
# 模拟监工触发
echo '{"stop_hook_active": false, "session_id": "test-123"}' | ./.claude/hooks/stop.sh

# 查看测试日志
cc-supervisor logs --session test-123
```

### 调试目录结构
```
/tmp/cc-supervisor/
└── -Users-username-project-name/    # 项目特定目录
    └── {session-id}/                # 每个session独立
        ├── debug.log                # 调试日志（详细记录）
        ├── transcript.json          # 对话记录副本
        ├── project/                # 项目软链接
        └── debug.log.stderr         # 错误输出
```

## 🔧 故障排除

### 问题：监工没有工作

**检查步骤：**
1. 确认在新的Claude会话中测试（Hook在启动时加载）
2. 检查配置文件：
   ```bash
   cat .claude/settings.json | jq '.'
   ```
3. 确认Hook脚本权限：
   ```bash
   chmod +x .claude/hooks/stop.sh
   ls -la .claude/hooks/
   ```
4. 检查监工规则文件存在：
   ```bash
   ls -la .claude/supervisor-rules.txt
   ```
5. 查看最新日志：
   ```bash
   cc-supervisor logs
   ```

### 问题：监工总是阻止停止

**可能原因：**
- 监工规则过于严格
- 代理环境导致输出异常

**解决方案：**
1. 查看具体阻止原因：
   ```bash
   cc-supervisor logs -n 50 | grep "阻止理由"
   ```
2. 调整监工规则，减少误判
3. 检查是否有代理干扰

### 问题：代理环境下监工异常

**现象：**
监工返回"proxy success"而非实际判断

**解决方案：**
Hook已内置过滤机制，自动处理代理响应。如仍有问题，检查：
```bash
# 查看原始返回
cc-supervisor logs | grep "监工原始返回"
```

## 🎨 高级用法

### 临时禁用监工
```bash
# 方法1：重命名规则文件（推荐）
mv .claude/supervisor-rules.txt .claude/supervisor-rules.txt.disabled

# 方法2：删除Hook配置（需要重新init）
rm .claude/settings.json
```

### 自定义监工严格程度

编辑 `.claude/supervisor-rules.txt`，可以：
- 添加项目特定的检查规则
- 调整对模糊词汇的容忍度
- 增加对特定编程语言的检查

### 批量清理旧日志
```bash
# 清理所有超过1天的日志
cc-supervisor clean --days 1 --all

# 立即清理当前项目的所有日志
cc-supervisor clean --days 0
```

## 📝 最佳实践

### ✅ 推荐做法
1. **使用 -w 参数监控新session**: 更容易捕获监工活动
2. **定期查看日志**: 了解监工判断模式
3. **根据项目调整规则**: 不同项目可能需要不同的检查标准
4. **保留调试日志**: 有助于优化监工规则

### ❌ 避免做法
1. **频繁修改Hook脚本**: 可能破坏监工机制
2. **设置过短的timeout**: 监工需要时间分析
3. **完全依赖监工**: 仍需要人工review重要代码
4. **忽略监工反馈**: 失去质量保障意义

## 🔍 监工检查详解

### PID和信号跟踪
Hook脚本记录详细的进程信息：
- Hook进程PID
- 信号捕获（SIGTERM, SIGINT, SIGHUP）
- 退出码记录
- 执行时长统计

### 监工执行时序
```
1. Hook启动 → 记录PID
2. 创建隔离目录 → /tmp/cc-supervisor/...
3. 复制对话记录 → transcript.json
4. 调用claude -p → 等待判断（最长300秒）
5. 解析JSON结果 → 决定BLOCK或PASS
6. 清理临时文件 → 保留日志供调试
```

## 🎯 定制化建议

### 根据团队规范定制
```text
# 在 supervisor-rules.txt 中添加：

## 团队代码规范
- 必须包含单元测试
- 必须通过lint检查
- 必须有错误处理
- 必须有注释说明
```

### 根据项目类型定制
```text
# Web项目
- 检查安全漏洞（XSS, SQL注入等）
- 验证API错误处理
- 确认前端兼容性

# 数据处理项目
- 检查数据验证
- 确认异常处理
- 验证性能优化
```

## 📚 相关文档

- [README.md](README.md) - 项目概览和快速开始（含ASCII流程图）
- [CLAUDE.md](CLAUDE.md) - 技术实现细节和开发说明

## 🤝 获取帮助

遇到问题？
1. 使用 `cc-supervisor logs -w` 实时监控
2. 查看 `/tmp/cc-supervisor/` 下的调试日志
3. 运行测试脚本验证安装
4. 提交Issue到项目仓库

---

**记住**：监工是质量保障工具，帮助Claude提供更可靠的代码！ 🚀