# ho-cc-supervisor

Claude智能监工 - 防止Claude偷懒的极简Hook系统

[English](README.md) | [中文](README_CN.md)

## 🎯 核心理念

防止Claude在工作中偷懒、糊弄或提前结束任务。通过独立的监工Claude实例实现实时质量监督。

## ⚠️ 权衡取舍

虽然监工系统提供了质量保证，但也带来了一些固有的权衡：

- **额外时间开销**：每次停止尝试都会触发监工检查，每次检查增加5-30秒
- **Token消耗**：监工Claude会消耗额外的API tokens进行质量检查
- **潜在误判**：过于严格的规则可能会阻止合理的任务完成
- **API依赖**：需要`claude -p`命令可用且正确配置
- **会话开销**：创建临时文件和日志需要定期清理

在决定是否为项目启用监工时，请考虑这些因素。

## 🔄 工作原理 - 监督反馈循环

```
┌──────────────────────────────────────────────────────────────┐
│                         用户与Claude对话                          │
└──────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────┐
│                     Claude完成任务并尝试停止                      │
└──────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────┐
│                    Stop Hook 拦截停止请求                        │
│             (.claude/hooks/cc-supervisor-stop.sh)              │
└──────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────┐
│                   监工Claude (claude -p) 启动                    │
│                      在隔离目录中执行检查                          │
└──────────────────────────────────────────────────────────────┘
                                  │
                   ┌──────────────┴──────────────┐
                   ▼                             ▼
        ┌──────────────────┐          ┌──────────────────┐
        │   检查工作质量    │          │   检查工作质量    │
        │   发现偷懒行为    │          │    质量合格      │
        └──────────────────┘          └──────────────────┘
                   │                             │
                   ▼                             ▼
        ┌──────────────────┐          ┌──────────────────┐
        │ 返回 BLOCK 决定  │          │  返回 PASS 决定  │
        │ {"decision":     │          │       {}         │
        │  "block",        │          └──────────────────┘
        │  "reason":"..."}│                     │
        └──────────────────┘                     ▼
                   │                   ┌──────────────────┐
                   ▼                   │   允许正常停止    │
        ┌──────────────────┐          └──────────────────┘
        │   阻止停止请求    │
        │  要求Claude重做   │
        └──────────────────┘
                   │
                   ▼
        ┌──────────────────┐
        │  Claude继续工作   │◄──────────────┐
        └──────────────────┘              │
                   │                       │
                   └───────────────────────┘
                        （循环直到质量合格）
```

## 📦 快速开始

### 1. 安装

```bash
# 全局安装
npm install -g ho-cc-supervisor

# 或使用 yarn
yarn global add ho-cc-supervisor
```

### 2. 初始化监工系统

在你的项目目录中运行：

```bash
cc-supervisor init
```

输出示例：
```
🚀 初始化 Claude 智能监工...
📄 监工Hook已安装
📋 默认监工规则已安装
⚙️ 监工配置文件已安装
⚙️ Claude Code settings已更新

✅ Claude智能监工初始化完成！

📖 使用说明:
1. 启动Claude Code正常工作
2. 监工会自动检查Claude的工作质量
3. 发现偷懒行为时会自动要求重做
4. 可编辑 .claude/cc-supervisor-rules.txt 自定义监工规则
5. 可编辑 .claude/cc-supervisor-config.json 配置Claude命令参数
```

### 3. 开始使用

正常使用Claude Code即可，监工会在后台自动工作。

## 🎭 效果示例

### 场景1：Claude试图糊弄过关

```
Claude: 我已经基本完成了主要功能，虽然还有一些小问题...
[尝试停止对话]

监工: BLOCK - 检测到模糊话术"基本完成"和"虽然"，请明确完成状态并解决所有问题

Claude: [被迫继续工作，修复所有问题]
```

### 场景2：Claude列TODO后停顿

```
Claude: 我规划了以下步骤：
1. 实现用户认证
2. 添加数据验证
3. 编写测试用例
是否需要我继续？
[尝试停止]

监工: BLOCK - 检测到TODO停顿行为，请继续完成所有规划的工作

Claude: [继续执行所有步骤]
```

## 🛠️ 命令详解

### 初始化命令
```bash
cc-supervisor init
```
- 创建 `.claude/` 目录结构
- 安装监工Hook脚本到 `.claude/hooks/cc-supervisor-stop.sh`
- 配置 `settings.json` 启用Hook（1200秒超时）
- 生成默认监工规则到 `.claude/cc-supervisor-rules.txt`
- 生成监工配置文件到 `.claude/cc-supervisor-config.json`

### 日志查看命令
```bash
# 查看最新日志（最后20行）
cc-supervisor logs

# 实时跟踪现有日志
cc-supervisor logs -f

# 等待并监控新的监工session
cc-supervisor logs -w

# 查看最后50行日志
cc-supervisor logs -n 50

# 列出所有可用的日志文件
cc-supervisor logs --list

# 查看特定session的日志
cc-supervisor logs --session <session-id>
```

### 清理命令
```bash
# 清理7天前的日志（默认）
cc-supervisor clean

# 清理所有今天的日志
cc-supervisor clean --days 0

# 清理所有项目的日志
cc-supervisor clean --all
```

## 📝 自定义监工规则

编辑 `.claude/cc-supervisor-rules.txt` 文件来自定义检查规则：

```text
# 示例规则
1. 禁止使用"基本"、"大概"、"应该"等模糊词汇
2. TODO列表必须全部完成，不能中途询问
3. 测试必须全部通过才能声称完成
4. 遇到错误必须解决，不能推给用户
```

## ⚙️ 配置Claude命令

编辑 `.claude/cc-supervisor-config.json` 来配置监工Claude的命令参数：

```json
{
  "claude_command": {
    "base": "claude",
    "args": ["-p", "--dangerously-skip-permissions"]
  }
}
```

## 🐛 调试技巧

1. **查看实时日志**
   ```bash
   cc-supervisor logs -w  # 等待新session并自动跟踪
   ```

2. **检查调试目录**
   ```bash
   ls -la /tmp/cc-supervisor/
   ```

3. **手动测试Hook**
   ```bash
   echo '{"stop_hook_active": false, "session_id": "test"}' | ./.claude/hooks/cc-supervisor-stop.sh
   ```

## ⚙️ 技术架构

- **独立监工系统**: 独立的Claude实例（`claude -p`）作为质量监工
- **Hook机制**: 利用Claude Code原生Stop Hook
- **隔离执行**: 监工在独立目录避免循环
- **JSON通信**: 标准化的决策格式
- **调试日志**: 完整记录执行过程

## 📄 License

MIT