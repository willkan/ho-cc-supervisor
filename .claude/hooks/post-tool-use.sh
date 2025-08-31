#!/bin/bash

# PostToolUse Hook - 工具使用后的快速检查
# 主要用于 Write/Edit 操作后的语法检查

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs/supervisor-me/checks"

# 创建日志目录
mkdir -p "$LOG_DIR"

# 读取 JSON 输入
input=""
if [ ! -t 0 ]; then
    input=$(cat)
fi

# 从 JSON 中提取工具信息（如果有的话）
TOOL_NAME=""
TOOL_FILE=""

if [ -n "$input" ]; then
    # 尝试解析 JSON
    TOOL_NAME=$(echo "$input" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('tool_name', ''))
except:
    pass
" 2>/dev/null)
    
    TOOL_FILE=$(echo "$input" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tool_input = data.get('tool_input', {})
    print(tool_input.get('file_path', tool_input.get('notebook_path', '')))
except:
    pass
" 2>/dev/null)
fi

# 如果无法从JSON获取，使用环境变量
TOOL_NAME="${TOOL_NAME:-${CLAUDE_TOOL_NAME:-unknown}}"
TOOL_FILE="${TOOL_FILE:-${CLAUDE_TOOL_FILE:-}}"

# 记录工具使用和JSON输入
echo "[$(date '+%Y-%m-%d %H:%M:%S')] PostToolUse: $TOOL_NAME on $TOOL_FILE" >> "$LOG_DIR/tools.log"
if [ -n "$input" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] JSON Input: $input" >> "$LOG_DIR/tools.log"
fi

# 只对文件写入操作进行检查
if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" || "$TOOL_NAME" == "MultiEdit" ]]; then
    # 优先使用项目本地的quick-check.js，否则使用全局安装的supervisor-me包中的
    QUICK_CHECK_JS="$PROJECT_ROOT/lib/supervisor-me/quick-check.js"
    if [ ! -f "$QUICK_CHECK_JS" ]; then
        # 尝试使用全局安装的supervisor-me包中的quick-check.js
        SUPERVISOR_ME_PATH=$(npm root -g)/supervisor-me/lib/supervisor-me/quick-check.js
        if [ -f "$SUPERVISOR_ME_PATH" ]; then
            QUICK_CHECK_JS="$SUPERVISOR_ME_PATH"
        fi
    fi
    
    if [ -f "$QUICK_CHECK_JS" ]; then
        # 运行语法检查器并捕获输出
        check_output=$(node "$QUICK_CHECK_JS" \
          --tool="$TOOL_NAME" \
          --file="$TOOL_FILE" \
          --project-root="$PROJECT_ROOT" 2>&1)
        
        # 如果有错误输出，将其作为hookSpecificOutput注入给 Claude
        if [ -n "$check_output" ]; then
            # 使用JSON格式让Claude Code将反馈注入到对话中
            cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "🔍 语法检查发现问题：\n\n$check_output\n\n请修复上述语法错误后再继续。"
  }
}
EOF
        fi
    fi
fi

# 返回 0，不阻塞
exit 0