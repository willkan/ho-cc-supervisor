# ho-cc-supervisor

Claude智能监工 - 防止Claude偷懒的极简Hook系统

[English](#english) | [中文](README_CN.md)

---

## 中文

### 🎯 核心理念

防止Claude在工作中偷懒、糊弄或提前结束任务。通过双Claude架构实现实时质量监督。

### 🔄 工作原理 - 监督反馈循环

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
│                  （.claude/hooks/stop.sh）                      │
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

### 📦 快速开始

#### 1. 安装

```bash
# 全局安装
npm install -g ho-cc-supervisor

# 或使用 yarn
yarn global add ho-cc-supervisor
```

#### 2. 初始化监工系统

在你的项目目录中运行：

```bash
cc-supervisor init
```

输出示例：
```
🚀 初始化 Claude 智能监工...
📄 监工Hook已安装
📋 默认监工规则已安装
⚙️ Claude Code settings已更新

✅ Claude智能监工初始化完成！

📖 使用说明:
1. 启动Claude Code正常工作
2. 监工会自动检查Claude的工作质量
3. 发现偷懒行为时会自动要求重做
4. 可编辑 .claude/supervisor-rules.txt 自定义监工规则
```

#### 3. 开始使用

正常使用Claude Code即可，监工会在后台自动工作。

### 🎭 效果示例

#### 场景1：Claude试图糊弄过关

```
Claude: 我已经基本完成了主要功能，虽然还有一些小问题...
[尝试停止对话]

监工: BLOCK - 检测到模糊话术"基本完成"和"虽然"，请明确完成状态并解决所有问题

Claude: [被迫继续工作，修复所有问题]
```

#### 场景2：Claude列TODO后停顿

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

### 🛠️ 命令详解

#### 初始化命令
```bash
cc-supervisor init
```
- 创建 `.claude/` 目录结构
- 安装监工Hook脚本到 `.claude/hooks/stop.sh`
- 配置 `settings.json` 启用Hook（300秒超时）
- 生成默认监工规则到 `.claude/supervisor-rules.txt`

#### 日志查看命令
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

#### 清理命令
```bash
# 清理7天前的日志（默认）
cc-supervisor clean

# 清理所有今天的日志
cc-supervisor clean --days 0

# 清理所有项目的日志
cc-supervisor clean --all
```

### 📝 自定义监工规则

编辑 `.claude/supervisor-rules.txt` 文件来自定义检查规则：

```text
# 示例规则
1. 禁止使用"基本"、"大概"、"应该"等模糊词汇
2. TODO列表必须全部完成，不能中途询问
3. 测试必须全部通过才能声称完成
4. 遇到错误必须解决，不能推给用户
```

### 🐛 调试技巧

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
   echo '{"stop_hook_active": false, "session_id": "test"}' | ./.claude/hooks/stop.sh
   ```

### ⚙️ 技术架构

- **双Claude系统**: 工作Claude + 监工Claude
- **Hook机制**: 利用Claude Code原生Stop Hook
- **隔离执行**: 监工在独立目录避免循环
- **JSON通信**: 标准化的决策格式
- **调试日志**: 完整记录执行过程

## 📄 License

MIT

### 🎯 Core Concept

Prevent Claude from being lazy, cutting corners, or ending tasks prematurely. An independent supervisor Claude monitors work quality in real-time.

### 🔄 How It Works - Supervision Feedback Loop

```
┌──────────────────────────────────────────────────────────────┐
│                    User Interacts with Claude                    │
└──────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────┐
│              Claude Completes Task and Tries to Stop             │
└──────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────┐
│                  Stop Hook Intercepts Stop Request               │
│                    (.claude/hooks/stop.sh)                       │
└──────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────┐
│                  Supervisor Claude (claude -p) Starts            │
│                    Executes Check in Isolated Directory          │
└──────────────────────────────────────────────────────────────┘
                                  │
                   ┌──────────────┴──────────────┐
                   ▼                             ▼
        ┌──────────────────┐          ┌──────────────────┐
        │  Check Work       │          │  Check Work       │
        │  Quality          │          │  Quality          │
        │  Issues Found     │          │  Quality OK       │
        └──────────────────┘          └──────────────────┘
                   │                             │
                   ▼                             ▼
        ┌──────────────────┐          ┌──────────────────┐
        │ Return BLOCK      │          │  Return PASS      │
        │ {"decision":     │          │       {}         │
        │  "block",        │          └──────────────────┘
        │  "reason":"..."}│                     │
        └──────────────────┘                     ▼
                   │                   ┌──────────────────┐
                   ▼                   │  Allow Normal     │
        ┌──────────────────┐          │     Stop          │
        │   Block Stop      │          └──────────────────┘
        │   Request &       │
        │   Require Rework  │
        └──────────────────┘
                   │
                   ▼
        ┌──────────────────┐
        │ Claude Continues  │◄──────────────┐
        │     Working       │              │
        └──────────────────┘              │
                   │                       │
                   └───────────────────────┘
                    (Loop Until Quality OK)
```

### 📦 Quick Start

#### 1. Installation

```bash
# Global installation
npm install -g ho-cc-supervisor

# Or using yarn
yarn global add ho-cc-supervisor
```

#### 2. Initialize Supervisor System

Run in your project directory:

```bash
cc-supervisor init
```

Output example:
```
🚀 Initializing Claude Supervisor...
📄 Supervisor Hook installed
📋 Default supervisor rules installed
⚙️ Claude Code settings updated

✅ Claude Supervisor initialization complete!

📖 Usage:
1. Start Claude Code and work normally
2. Supervisor will automatically check Claude's work quality
3. When lazy behavior is detected, it will require rework
4. Edit .claude/supervisor-rules.txt to customize rules
```

#### 3. Start Using

Just use Claude Code normally, the supervisor works automatically in the background.

### 🎭 Effect Examples

#### Scenario 1: Claude Tries to Cut Corners

```
Claude: I've basically completed the main features, although there are some minor issues...
[Attempts to stop conversation]

Supervisor: BLOCK - Detected vague terms "basically" and "although", please clarify completion status and resolve all issues

Claude: [Forced to continue working, fixes all issues]
```

#### Scenario 2: Claude Lists TODOs Then Stops

```
Claude: I've planned the following steps:
1. Implement user authentication
2. Add data validation  
3. Write test cases
Should I continue?
[Attempts to stop]

Supervisor: BLOCK - Detected TODO pause behavior, please continue completing all planned work

Claude: [Continues executing all steps]
```

### 🛠️ Command Reference

#### Initialize Command
```bash
cc-supervisor init
```
- Creates `.claude/` directory structure
- Installs supervisor Hook script to `.claude/hooks/stop.sh`
- Configures `settings.json` to enable Hook (300s timeout)
- Generates default supervisor rules to `.claude/supervisor-rules.txt`

#### Log Viewing Commands
```bash
# View latest logs (last 20 lines)
cc-supervisor logs

# Real-time follow existing logs
cc-supervisor logs -f

# Wait and monitor for new supervisor sessions
cc-supervisor logs -w

# View last 50 lines of logs
cc-supervisor logs -n 50

# List all available log files
cc-supervisor logs --list

# View logs for specific session
cc-supervisor logs --session <session-id>
```

#### Cleanup Commands
```bash
# Clean logs older than 7 days (default)
cc-supervisor clean

# Clean all logs from today
cc-supervisor clean --days 0

# Clean logs from all projects
cc-supervisor clean --all
```

### 📝 Custom Supervisor Rules

Edit `.claude/supervisor-rules.txt` to customize checking rules:

```text
# Example rules
1. Prohibit vague terms like "basically", "probably", "should"
2. TODO lists must be fully completed, no mid-task inquiries
3. All tests must pass before claiming completion
4. Errors must be resolved, not passed to user
```

### 🐛 Debugging Tips

1. **View Real-time Logs**
   ```bash
   cc-supervisor logs -w  # Wait for new session and auto-follow
   ```

2. **Check Debug Directory**
   ```bash
   ls -la /tmp/cc-supervisor/
   ```

3. **Manually Test Hook**
   ```bash
   echo '{"stop_hook_active": false, "session_id": "test"}' | ./.claude/hooks/stop.sh
   ```

### ⚙️ Technical Architecture

- **Independent Supervisor System**: Separate Claude instance (`claude -p`) acts as quality supervisor
- **Hook Mechanism**: Leverages Claude Code native Stop Hook
- **Isolated Execution**: Supervisor runs in separate directory to avoid loops
- **JSON Communication**: Standardized decision format
- **Debug Logging**: Complete execution process recording

### 📄 License

MIT