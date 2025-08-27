#!/bin/bash

# PostToolUse Hook - 工具使用后的快速检查
# 主要用于 Write/Edit 操作后的语法检查

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs/checks"

# 创建日志目录
mkdir -p "$LOG_DIR"

# 从环境变量获取工具信息
TOOL_NAME="${CLAUDE_TOOL_NAME:-unknown}"
TOOL_FILE="${CLAUDE_TOOL_FILE:-}"

# 记录工具使用
echo "[$(date '+%Y-%m-%d %H:%M:%S')] PostToolUse: $TOOL_NAME on $TOOL_FILE" >> "$LOG_DIR/tools.log"

# 只对文件写入操作进行检查
if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" || "$TOOL_NAME" == "MultiEdit" ]]; then
    if [ -f "$PROJECT_ROOT/lib/quick-check.js" ]; then
        node "$PROJECT_ROOT/lib/quick-check.js" \
          --tool="$TOOL_NAME" \
          --file="$TOOL_FILE" \
          --project-root="$PROJECT_ROOT"
    fi
fi

# 返回 0，不阻塞
exit 0