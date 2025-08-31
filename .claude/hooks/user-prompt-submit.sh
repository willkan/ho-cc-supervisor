#!/bin/bash

# UserPromptSubmit Hook - 记录用户意图
# 用于学习用户模式和任务切换行为

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs/cc-supervisor/intents"

# 创建日志目录
mkdir -p "$LOG_DIR"

# 获取用户输入
USER_PROMPT="${1:-${CLAUDE_USER_PROMPT:-}}"  # 优先从命令行参数，其次环境变量
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"

# 记录用户意图
{
    echo "=== User Intent ==="
    echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Session: $SESSION_ID"
    echo "Prompt: $USER_PROMPT"
    echo ""
} >> "$LOG_DIR/intents.log"

# 保存最新的用户需求供Stop hook使用
if [ -n "$USER_PROMPT" ]; then
    PROJECT_NAME=$(echo "$PROJECT_ROOT" | tr '/' '-' | sed 's/^-//')
    PROMPT_DIR="$HOME/.cc-supervisor/projects/$PROJECT_NAME"
    mkdir -p "$PROMPT_DIR"
    echo "$USER_PROMPT" > "$PROMPT_DIR/${SESSION_ID}.prompt"
fi

# 检查是否有待处理的验证反馈需要注入
PROJECT_NAME=$(echo "$PROJECT_ROOT" | tr '/' '-' | sed 's/^-//')
ISSUES_FILE="$HOME/.cc-supervisor/projects/$PROJECT_NAME/$SESSION_ID.issues"
if [ -f "$ISSUES_FILE" ]; then
    # 读取反馈内容并注入到对话中
    FEEDBACK_CONTENT=$(cat "$ISSUES_FILE")
    
    # 直接输出反馈内容让它成为用户消息的一部分
    cat << EOF

📋 系统反馈（自动提交）：

$FEEDBACK_CONTENT

EOF
    
    # 删除已处理的反馈文件
    rm "$ISSUES_FILE"
fi

# 如果有 intent-logger.js，运行它进行深度分析
if [ -f "$PROJECT_ROOT/lib/intent-logger.js" ]; then
    echo "$USER_PROMPT" | node "$PROJECT_ROOT/lib/intent-logger.js" \
      --session-id="$SESSION_ID" \
      --project-root="$PROJECT_ROOT"
fi

# 返回 0，不干扰用户操作
exit 0