#!/bin/bash

# UserPromptSubmit Hook - 记录用户意图
# 用于学习用户模式和任务切换行为

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs/intents"

# 创建日志目录
mkdir -p "$LOG_DIR"

# 获取用户输入
USER_PROMPT="${CLAUDE_USER_PROMPT:-}"
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"

# 记录用户意图
{
    echo "=== User Intent ==="
    echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Session: $SESSION_ID"
    echo "Prompt: $USER_PROMPT"
    echo ""
} >> "$LOG_DIR/intents.log"

# 如果有 intent-logger.js，运行它进行深度分析
if [ -f "$PROJECT_ROOT/lib/intent-logger.js" ]; then
    echo "$USER_PROMPT" | node "$PROJECT_ROOT/lib/intent-logger.js" \
      --session-id="$SESSION_ID" \
      --project-root="$PROJECT_ROOT"
fi

# 返回 0，不干扰用户操作
exit 0