#!/bin/bash

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认配置
INTERVAL=60  # 检查间隔（秒） - 默认60秒
WATCH_DIR="example-app"
LOG_FILE=".proof/monitor.log"
ALERT_FILE="ALERT.txt"

echo "================================================"
echo "     Supervisor-ME Auto Monitor"
echo "================================================"

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --interval)
            INTERVAL="$2"
            shift 2
            ;;
        --watch)
            WATCH_DIR="$2"
            shift 2
            ;;
        *)
            echo "Usage: $0 [--interval SECONDS] [--watch DIRECTORY]"
            echo "  --interval: Check interval in seconds (default: 60)"
            echo "  --watch: Directory to watch (default: example-app)"
            exit 1
            ;;
    esac
done

# 确保日志目录存在
mkdir -p .proof

# 初始化日志
echo "$(date): Monitor started" > "$LOG_FILE"
echo "Watching: $WATCH_DIR"
echo "Check interval: ${INTERVAL}s"
echo "Log file: $LOG_FILE"
echo ""
echo "Press Ctrl+C to stop monitoring"
echo "------------------------------------------------"

# 获取初始文件修改时间戳
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    get_timestamp() {
        find "$WATCH_DIR" -type f -name "*.js" -o -name "*.json" -o -name "*.test.js" | xargs stat -f "%m" 2>/dev/null | sort -n | tail -1
    }
else
    # Linux
    get_timestamp() {
        find "$WATCH_DIR" -type f -name "*.js" -o -name "*.json" -o -name "*.test.js" | xargs stat -c "%Y" 2>/dev/null | sort -n | tail -1
    }
fi

# 获取git状态哈希值（用于检测文件变化）
get_git_status_hash() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        git status --porcelain 2>/dev/null | md5 2>/dev/null || echo "no-git"
    else
        git status --porcelain 2>/dev/null | md5sum 2>/dev/null | cut -d' ' -f1 || echo "no-git"
    fi
}

# 获取当前commit哈希
get_commit_hash() {
    git rev-parse HEAD 2>/dev/null || echo "no-commit"
}

# 创建ALERT文件
create_alert() {
    local timestamp="$1"
    local status="$2"
    local passed="$3"
    local failed="$4"
    local total="$5"
    
    cat > "$ALERT_FILE" << EOF
================================================
    VERIFICATION FAILURE ALERT
================================================
Timestamp: $timestamp
Status: $status
Tests Passed: $passed/$total
Tests Failed: $failed

Git Status:
$(git status --short 2>/dev/null || echo "Git not available")

Last Commit:
$(git log -1 --oneline 2>/dev/null || echo "No commits")

Action Required: Please check and fix the failing tests!
================================================
EOF
    
    echo -e "${RED}⚠️  ALERT.txt created - Verification failed!${NC}"
}

# 删除ALERT文件（当测试通过时）
remove_alert() {
    if [ -f "$ALERT_FILE" ]; then
        rm "$ALERT_FILE"
        echo -e "${GREEN}✅ ALERT.txt removed - Tests are passing${NC}"
    fi
}

LAST_TIMESTAMP=$(get_timestamp)
LAST_GIT_STATUS=$(get_git_status_hash)
LAST_COMMIT=$(get_commit_hash)
LAST_STATUS="unknown"

# 运行初始验证
echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} Running initial verification..."
if ./verify.sh > /dev/null 2>&1; then
    LAST_STATUS="PASS"
    echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} Initial status: ✅ PASS"
else
    LAST_STATUS="FAIL"
    echo -e "${RED}[$(date +%H:%M:%S)]${NC} Initial status: ❌ FAIL"
fi

# 监控循环
while true; do
    sleep "$INTERVAL"
    
    # 获取当前状态
    CURRENT_TIMESTAMP=$(get_timestamp)
    CURRENT_GIT_STATUS=$(get_git_status_hash)
    CURRENT_COMMIT=$(get_commit_hash)
    
    # 检查是否有变化（文件时间戳、git status或新commit）
    CHANGES_DETECTED=false
    CHANGE_REASON=""
    
    if [ "$CURRENT_TIMESTAMP" != "$LAST_TIMESTAMP" ]; then
        CHANGES_DETECTED=true
        CHANGE_REASON="file timestamp changed"
    elif [ "$CURRENT_GIT_STATUS" != "$LAST_GIT_STATUS" ]; then
        CHANGES_DETECTED=true
        CHANGE_REASON="git status changed"
    elif [ "$CURRENT_COMMIT" != "$LAST_COMMIT" ]; then
        CHANGES_DETECTED=true
        CHANGE_REASON="new commit detected: $(echo $CURRENT_COMMIT | cut -c1-7)"
    fi
    
    # 如果检测到变化，运行验证
    if [ "$CHANGES_DETECTED" = true ]; then
        echo -e "${YELLOW}[$(date +%H:%M:%S)]${NC} Detected changes ($CHANGE_REASON), running verification..."
        
        # 运行验证
        if ./verify.sh > /dev/null 2>&1; then
            NEW_STATUS="PASS"
            STATUS_SYMBOL="✅"
            STATUS_COLOR=$GREEN
        else
            NEW_STATUS="FAIL"
            STATUS_SYMBOL="❌"
            STATUS_COLOR=$RED
        fi
        
        # 读取测试结果
        if [ -f ".proof/latest.json" ]; then
            TESTS_INFO=$(grep -E '"passed"|"failed"|"total"' .proof/latest.json | tr -d ',' | awk '{print $2}')
            PASSED=$(echo "$TESTS_INFO" | sed -n '1p')
            FAILED=$(echo "$TESTS_INFO" | sed -n '2p')
            TOTAL=$(echo "$TESTS_INFO" | sed -n '3p')
            
            echo -e "${STATUS_COLOR}[$(date +%H:%M:%S)]${NC} Status: $STATUS_SYMBOL $NEW_STATUS (Passed: $PASSED/$TOTAL, Failed: $FAILED)"
            
            # 创建或删除ALERT.txt
            if [ "$NEW_STATUS" = "FAIL" ]; then
                create_alert "$(date)" "$NEW_STATUS" "$PASSED" "$FAILED" "$TOTAL"
            else
                remove_alert
            fi
            
            # 如果状态发生变化，记录到日志
            if [ "$NEW_STATUS" != "$LAST_STATUS" ]; then
                echo "$(date): Status changed from $LAST_STATUS to $NEW_STATUS (Reason: $CHANGE_REASON)" >> "$LOG_FILE"
                
                if [ "$NEW_STATUS" = "FAIL" ] && [ "$LAST_STATUS" = "PASS" ]; then
                    echo -e "${RED}⚠️  ALERT: Tests started failing!${NC}"
                elif [ "$NEW_STATUS" = "PASS" ] && [ "$LAST_STATUS" = "FAIL" ]; then
                    echo -e "${GREEN}✨ GOOD: Tests are passing again!${NC}"
                fi
            fi
            
            LAST_STATUS="$NEW_STATUS"
        fi
        
        # 更新所有状态
        LAST_TIMESTAMP="$CURRENT_TIMESTAMP"
        LAST_GIT_STATUS="$CURRENT_GIT_STATUS"
        LAST_COMMIT="$CURRENT_COMMIT"
    else
        # 没有变化时显示当前状态
        echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} No changes detected - Current status: $LAST_STATUS"
    fi
done