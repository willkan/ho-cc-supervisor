# 🚀 全自动验证修复系统 - tmux 方案使用指南

## 快速开始

### 1. 安装 tmux（如未安装）
```bash
# macOS
brew install tmux

# Linux
sudo apt-get install tmux  # Ubuntu/Debian
sudo yum install tmux      # CentOS/RHEL
```

### 2. 启动 supervised Claude
```bash
# 使用 tmux 透明代理启动
./bin/supervisor-tmux

# 或添加到 PATH 后
supervisor-tmux
```

### 3. 正常使用 Claude Code
- 所有交互特性保持不变
- 流式输出、颜色、进度条都正常
- 自动修复在后台透明运行

## 工作原理

```
用户输入 → Claude Code 执行任务
            ↓
        Stop Hook 验证
            ↓
     发现问题？写入 /tmp/claude-issues
            ↓
    Supervisor 监控到问题文件
            ↓
     生成修复指令（智能分析）
            ↓
    tmux send-keys 注入命令
            ↓
    Claude Code 自动修复
            ↓
        循环直到通过
```

## 命令说明

### 基本命令
```bash
supervisor-tmux           # 启动/连接到 supervised Claude
supervisor-tmux status    # 查看运行状态
supervisor-tmux stop      # 停止所有组件
supervisor-tmux logs      # 实时查看 supervisor 日志
supervisor-tmux help      # 显示帮助
```

### tmux 操作
```bash
Ctrl+B D    # 分离会话（后台继续运行）
Ctrl+B [    # 进入滚动模式查看历史
Ctrl+B C    # 创建新窗口
Ctrl+B N    # 切换到下一个窗口
```

## 实际效果示例

```
用户: 请实现一个用户认证系统

Claude: 我来实现用户认证系统...
[编写代码...]

[Stop Hook 自动验证]
❌ 发现问题：TypeError in auth.service.ts:42

[Supervisor 自动注入]
[🤖 自动修复] 发现 JavaScript 错误，请检查并修复类型错误。确保所有变量都正确定义和初始化。

Claude: 我发现了类型错误，让我修复它...
[自动修复代码...]

[再次验证]
✅ 所有测试通过！认证系统实现完成。
```

## 特性

### ✅ 已实现
- **完全透明**：保持 Claude Code 所有原生交互特性
- **自动修复**：检测到问题自动注入修复命令
- **防死循环**：5分钟内不重复修复同一问题
- **可观察性**：用户能看到自动修复过程
- **可中断性**：随时 Ctrl+C 中断

### 🎯 优势
1. **不改变 Claude Code**：只在 tmux 层面控制
2. **保持原生体验**：所有终端特性正常工作
3. **用户可见**：透明的修复过程
4. **易于实现**：不需要复杂的 PTY 编程
5. **跨平台**：tmux 在所有 Unix-like 系统可用

### ⚠️ 限制
1. 需要安装 tmux
2. Windows 需要 WSL 支持
3. 修复命令基于模式匹配（可改进为 AI 生成）

## 调试和监控

### 查看日志
```bash
# 实时监控 supervisor 日志
tail -f /tmp/supervisor.log

# 查看修复历史
cat /tmp/supervisor-fix-history

# 查看当前问题
cat /tmp/claude-issues
```

### 手动触发修复
```bash
# 手动写入问题文件测试
echo "测试问题：TypeError in test.js" > /tmp/claude-issues
```

### 清理和重置
```bash
# 停止所有组件
supervisor-tmux stop

# 清理临时文件
rm -f /tmp/claude-issues /tmp/supervisor.* 

# 重新启动
supervisor-tmux
```

## 进阶配置

### 自定义修复策略
编辑 `bin/supervisor-tmux` 中的 `generate_fix_command` 函数：

```bash
generate_fix_command() {
    local issues="$1"
    
    # 添加自定义规则
    if echo "$issues" | grep -q "你的模式"; then
        echo "你的修复指令"
    fi
    
    # ...
}
```

### 集成 AI 分析
可以调用 Claude API 智能生成修复指令：

```bash
generate_fix_command() {
    local issues="$1"
    
    # 调用 Claude API
    local fix=$(echo "$issues" | claude -p "分析问题并生成修复指令")
    echo "$fix"
}
```

## 常见问题

### Q: tmux session 已存在？
```bash
# 先停止旧会话
supervisor-tmux stop

# 或直接附加
tmux attach-session -t claude-supervised
```

### Q: 修复命令没有注入？
检查：
1. `/tmp/claude-issues` 文件是否创建
2. Supervisor 进程是否运行：`ps aux | grep supervisor`
3. 查看日志：`tail -f /tmp/supervisor.log`

### Q: 如何退出？
1. 在 Claude 中输入 `exit` 或 Ctrl+D
2. 或使用 `supervisor-tmux stop`

## 下一步改进

1. **AI 生成修复指令**：集成 Claude API 智能分析
2. **多会话支持**：支持多个并行 Claude 会话
3. **Web 界面**：提供监控和管理界面
4. **插件系统**：支持自定义验证和修复策略