# tmux 透明代理方案 - 真正的全自动验证修复系统

## 核心思路

不试图劫持或包装 Claude Code，而是在 **tmux 会话层面** 进行控制：

```
┌────────────────────────────────────────┐
│          tmux session: claude          │
├────────────────────────────────────────┤
│                                        │
│  Claude Code 运行在这里（原生交互）      │
│  - 保持所有终端特性                     │
│  - 流式输出、颜色、进度条都正常          │
│                                        │
└────────────────────────────────────────┘
            ▲              ▲
            │              │
     用户正常输入    Supervisor 注入命令
                   (tmux send-keys)
```

## 实现细节

### 1. 启动脚本（supervisor-me）

```bash
#!/bin/bash
# bin/supervisor-me

# 配置
TMUX_SESSION="claude-supervised"
SUPERVISOR_FIFO="/tmp/supervisor-commands"
ISSUES_FILE="/tmp/claude-issues"
SUPERVISOR_LOG="/tmp/supervisor.log"

# 创建 FIFO 用于接收 supervisor 命令
mkfifo $SUPERVISOR_FIFO 2>/dev/null

# 启动 supervisor 监控进程（后台）
start_supervisor() {
    while true; do
        # 监控问题文件
        if [ -f "$ISSUES_FILE" ]; then
            issues=$(cat "$ISSUES_FILE")
            echo "[$(date)] 发现问题，生成修复指令..." >> $SUPERVISOR_LOG
            
            # 生成修复指令（这里可以调用另一个 Claude API）
            fix_command=$(echo "$issues" | generate_fix_command)
            
            # 通过 tmux 注入命令
            tmux send-keys -t $TMUX_SESSION "$fix_command" Enter
            
            echo "[$(date)] 已注入修复指令: $fix_command" >> $SUPERVISOR_LOG
            
            # 清理问题文件
            rm "$ISSUES_FILE"
        fi
        sleep 1
    done
}

# 检查 tmux 会话是否存在
if ! tmux has-session -t $TMUX_SESSION 2>/dev/null; then
    # 创建新会话并运行 Claude Code
    tmux new-session -d -s $TMUX_SESSION "claude"
    echo "创建新的 supervised Claude 会话"
    
    # 启动 supervisor
    start_supervisor &
    SUPERVISOR_PID=$!
    echo $SUPERVISOR_PID > /tmp/supervisor.pid
fi

# 附加到 tmux 会话（用户交互）
tmux attach-session -t $TMUX_SESSION
```

### 2. 智能修复命令生成器

```bash
#!/bin/bash
# lib/generate_fix_command.sh

generate_fix_command() {
    local issues="$1"
    
    # 分析问题类型
    if echo "$issues" | grep -q "TypeError"; then
        echo "请修复 TypeError：检查变量类型和空值处理"
    elif echo "$issues" | grep -q "测试失败"; then
        echo "请修复失败的测试：运行测试并解决所有失败项"
    elif echo "$issues" | grep -q "lint"; then
        echo "请修复 lint 错误：运行 npm run lint:fix"
    else
        # 通用修复指令
        echo "请解决以下问题并确保所有测试通过：$issues"
    fi
}
```

### 3. 增强的 Stop Hook

```bash
#!/bin/bash
# .claude/hooks/stop.sh

# ... 现有的验证逻辑 ...

if [ "$has_issues" = true ]; then
    # 写入问题文件，触发 supervisor
    cat > /tmp/claude-issues <<EOF
发现 $issue_count 个问题需要修复：
$formatted_issues
EOF
    
    echo "$(date): 问题已提交给 Supervisor 自动修复" >> /tmp/supervisor.log
fi
```

## 关键优势

1. **完全透明**：Claude Code 运行在原生 tmux 环境，所有交互特性保持不变
2. **不破坏体验**：用户看到的就是正常的 Claude Code，只是会自动修复问题
3. **可观察性**：用户能看到 Supervisor 注入的命令和执行过程
4. **可中断**：用户随时可以 Ctrl+C 中断自动修复

## 进阶功能

### 1. 智能等待机制

```bash
# 等待 Claude 空闲后再注入命令
wait_for_idle() {
    while true; do
        # 检查最后一行是否包含提示符
        last_line=$(tmux capture-pane -t $TMUX_SESSION -p | tail -1)
        if [[ "$last_line" =~ \$ ]] || [[ "$last_line" =~ \> ]]; then
            break
        fi
        sleep 0.5
    done
}

# 在注入命令前调用
wait_for_idle
tmux send-keys -t $TMUX_SESSION "$fix_command" Enter
```

### 2. 防止死循环

```bash
# 记录修复历史，避免重复修复同一问题
declare -A fix_history

should_fix() {
    local issue_hash=$(echo "$1" | md5sum | cut -d' ' -f1)
    local current_time=$(date +%s)
    
    if [[ ${fix_history[$issue_hash]} ]]; then
        local last_fix_time=${fix_history[$issue_hash]}
        local time_diff=$((current_time - last_fix_time))
        
        # 5分钟内不重复修复同一问题
        if [ $time_diff -lt 300 ]; then
            echo "跳过重复问题修复"
            return 1
        fi
    fi
    
    fix_history[$issue_hash]=$current_time
    return 0
}
```

### 3. 优先级队列

```bash
# 高优先级修复（错误）vs 低优先级（警告）
process_issues() {
    local errors=$(echo "$issues" | grep ERROR)
    local warnings=$(echo "$issues" | grep WARNING)
    
    if [ -n "$errors" ]; then
        # 优先修复错误
        generate_fix_command "$errors"
    elif [ -n "$warnings" ]; then
        # 然后修复警告
        generate_fix_command "$warnings"
    fi
}
```

## 使用方法

1. 安装 tmux（如未安装）：
   ```bash
   brew install tmux  # macOS
   ```

2. 设置别名：
   ```bash
   alias claude='~/dev/supervisor-me-mvp/bin/supervisor-me'
   ```

3. 正常使用 Claude：
   ```bash
   claude  # 自动在 supervised 模式下运行
   ```

## 实际效果

```
用户: 请实现一个用户认证系统

Claude: 我来实现用户认证系统...
[Claude 开始编码...]

[验证系统检测到问题]
→ Supervisor 自动注入: "请修复 TypeError: Cannot read property 'id' of undefined in auth.service.ts:42"

Claude: 我发现了一个类型错误，让我修复它...
[Claude 自动修复问题...]

[验证通过]
✅ 所有测试通过，认证系统实现完成！
```

## 这个方案的巧妙之处

1. **不改变 Claude Code 本身** - 只是在 tmux 层面控制
2. **保持原生体验** - 所有终端特性都正常工作
3. **用户可见** - 能看到自动修复过程，保持透明
4. **易于实现** - 不需要复杂的 PTY 编程
5. **跨平台** - tmux 在所有 Unix-like 系统上都能用