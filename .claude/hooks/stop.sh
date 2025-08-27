#!/bin/bash

# Stop Hook - Claude 完成任务时的验证
# 只在 Claude 认为任务完成时触发（不包括 ESC 中断）

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs/completions"

# 创建日志目录
mkdir -p "$LOG_DIR"

# 记录触发时间
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stop hook triggered" >> "$LOG_DIR/stop.log"

# 运行验证脚本
if [ -f "$PROJECT_ROOT/lib/verify-completion.js" ]; then
    node "$PROJECT_ROOT/lib/verify-completion.js" \
      --session-id="${CLAUDE_SESSION_ID:-unknown}" \
      --transcript="${CLAUDE_TRANSCRIPT_PATH:-}" \
      --project-root="$PROJECT_ROOT"
else
    echo "✅ Task completed (verifier not yet implemented)"
fi

# 返回 0 表示成功（不阻塞 Claude）
exit 0