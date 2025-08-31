#!/bin/bash

# Stop Hook - Claude 完成任务时的验证
# 只在 Claude 认为任务完成时触发（不包括 ESC 中断）

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs/cc-supervisor/completions"

# 创建日志目录
mkdir -p "$LOG_DIR"

# 记录触发时间
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stop hook triggered" >> "$LOG_DIR/stop.log"

# 检查是否是验证 Claude（避免循环）
if [ "$CLAUDE_VERIFIER_MODE" = "true" ]; then
    echo "  [跳过] 验证 Claude 不触发验证" >> "$LOG_DIR/stop.log"
    exit 0
fi

# 使用智能 Claude 验证（claude -p 模式）
if [ -f "$PROJECT_ROOT/lib/claude-verify-simple.js" ]; then
    echo "🤖 启动 Claude 智能验证 (claude -p 模式)..." >> "$LOG_DIR/stop.log"
    
    # 运行验证并显示结果
    node "$PROJECT_ROOT/lib/claude-verify-simple.js" \
      --session-id="${CLAUDE_SESSION_ID:-unknown}" \
      --transcript="${CLAUDE_TRANSCRIPT_PATH:-}" \
      --project-root="$PROJECT_ROOT"
else
    # 降级到模式匹配验证
    if [ -f "$PROJECT_ROOT/lib/verify-completion.js" ]; then
        node "$PROJECT_ROOT/lib/verify-completion.js" \
          --session-id="${CLAUDE_SESSION_ID:-unknown}" \
          --transcript="${CLAUDE_TRANSCRIPT_PATH:-}" \
          --project-root="$PROJECT_ROOT"
    else
        echo "✅ Task completed (verifier not yet implemented)"
    fi
fi

# 返回 0 表示成功（不阻塞 Claude）
exit 0