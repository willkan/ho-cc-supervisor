#!/bin/bash
# Session Tracker - 记录当前项目的活跃 session
# 被 SessionStart 和其他 hooks 调用

update_active_session() {
    local session_id="$1"
    local event_type="${2:-unknown}"
    
    if [ -z "$session_id" ]; then
        return
    fi
    
    # 获取项目信息
    PROJECT_PATH=$(pwd)
    PROJECT_NAME=$(echo "$PROJECT_PATH" | sed 's/\//\-/g' | sed 's/^-//')
    
    # 创建 session 跟踪目录
    TRACK_DIR="$HOME/.supervisor-me/projects/$PROJECT_NAME"
    mkdir -p "$TRACK_DIR"
    
    # 更新活跃 session 文件（简单的单行文件）
    echo "$session_id" > "$TRACK_DIR/active-session"
    
    # 记录历史
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[$TIMESTAMP] $event_type: $session_id" >> "$TRACK_DIR/session-history.log"
    
    # 创建 session 专用的 issues 文件（如果不存在）
    ISSUES_FILE="$TRACK_DIR/${session_id}.issues"
    if [ ! -f "$ISSUES_FILE" ]; then
        touch "$ISSUES_FILE"
    fi
    
    echo "✅ Session 已更新: ${session_id:0:8}... ($event_type)"
}

# 如果直接调用，处理参数
if [ "$0" = "${BASH_SOURCE[0]}" ]; then
    update_active_session "$1" "$2"
fi