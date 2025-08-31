#!/bin/bash
# SessionStart Hook - 记录新会话的 session ID
# 在会话开始时更新活跃 session

# 引入 session tracker
HOOK_DIR="$(dirname "$0")"
source "$HOOK_DIR/session-tracker.sh"

# 读取 Claude Code 传递的 JSON 输入
if [ ! -t 0 ]; then
    input=$(cat)
    
    # 提取 session_id
    session_id=$(echo "$input" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('session_id', ''))
except:
    pass
" 2>/dev/null)
    
    # 提取 matcher（startup, resume, clear）
    matcher=$(echo "$input" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('matcher', ''))
except:
    pass
" 2>/dev/null)
    
    if [ -n "$session_id" ]; then
        # 更新活跃 session
        update_active_session "$session_id" "session_start:$matcher"
    fi
fi

# 返回成功（不干扰 Claude Code）
echo '{"continue": true}'