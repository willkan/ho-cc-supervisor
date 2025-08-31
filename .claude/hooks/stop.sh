#!/bin/bash
# Stop Hook - 调用 cc-supervisor CLI 进行验证
# 使用 --json 格式输出，让 Claude Code 可以注入反馈到对话中

# 读取 Claude Code 传递的 JSON 输入
if [ ! -t 0 ]; then
    input=$(cat)
    # 尝试从 JSON 中提取 session_id
    claude_session_id=$(echo "$input" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('session_id', ''))" 2>/dev/null)
fi

# 优先使用 Claude 官方的 session_id，其次使用 cc-supervisor 的环境变量
session_to_use="${claude_session_id:-$SUPERVISOR_SESSION_ID}"

# 执行验证，传递 session ID 和完整的 stop input
if [ -n "$session_to_use" ]; then
    # 将完整的输入通过环境变量传递给验证程序
    result=$(STOP_HOOK_INPUT="$input" cc-supervisor verify --json --session "$session_to_use")
else
    result=$(STOP_HOOK_INPUT="$input" cc-supervisor verify --json)
fi

# 解析结果，如果有问题则写入文件触发自动修复
if echo "$result" | grep -q "验证发现问题\|测试失败\|错误\|TypeError"; then
    # 提取 systemMessage 内容
    message=$(echo "$result" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('systemMessage', ''))" 2>/dev/null)
    
    # 根据环境变量决定写入位置
    if [ -n "$message" ]; then
        if [ -n "$SUPERVISOR_ISSUES_FILE" ]; then
            # 使用 cc-supervisor 提供的 session 特定文件
            echo "$message" > "$SUPERVISOR_ISSUES_FILE"
            echo "[$(date)] 问题已提交给 Supervisor 自动修复 (Session: $session_to_use)" >> "$(dirname "$SUPERVISOR_ISSUES_FILE")/supervisor.log"
        elif [ -n "$session_to_use" ]; then
            # 使用 Claude 官方 session ID 构建路径
            project_name=$(pwd | sed 's/\//\-/g' | sed 's/^-//')
            issues_dir="$HOME/.cc-supervisor/projects/$project_name"
            mkdir -p "$issues_dir"
            issues_file="$issues_dir/${session_to_use}.issues"
            echo "$message" > "$issues_file"
            echo "[$(date)] 问题已写入: $issues_file" >> "$issues_dir/supervisor.log"
        else
            # 兼容旧版本或 tmux 模式
            echo "$message" > /tmp/claude-issues
            echo "[$(date)] 问题已提交给 Supervisor 自动修复" >> /tmp/supervisor.log
        fi
    fi
fi

# 输出原始结果给 Claude Code
echo "$result"