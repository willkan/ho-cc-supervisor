#!/bin/bash
# Claude 智能监工 Hook - 改进版（使用隔离目录+调试日志）
# 防止Claude偷懒，自动检查工作质量

# 获取脚本PID
SCRIPT_PID=$$

# 读取输入
input=$(cat)
stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active // false')
session_id=$(echo "$input" | jq -r '.session_id // ""')

# 获取Hook脚本所在的项目目录（这是真正的项目根目录）
# Hook脚本总是在 .claude/hooks/cc-supervisor-stop.sh
# 需要解析为绝对路径，因为$0可能是相对路径
HOOK_SCRIPT_PATH=$(realpath "$0")
HOOK_DIR=$(dirname "$HOOK_SCRIPT_PATH")        # .claude/hooks
CLAUDE_DIR=$(dirname "$HOOK_DIR")              # .claude
PROJECT_DIR=$(dirname "$CLAUDE_DIR")            # 项目根目录

# 获取当前工作目录（仅用于记录）
CURRENT_DIR=$(pwd)

# 使用Claude Code提供的session_id
SESSION_ID="${session_id}"
TEMP_BASE="/tmp/cc-supervisor"

# 基于项目根目录生成项目名称（而不是当前工作目录）
PROJECT_NAME=$(echo "$PROJECT_DIR" | sed 's/\//-/g')
# 日志目录基于项目根目录
TEMP_DIR="${TEMP_BASE}/${PROJECT_NAME}/${SESSION_ID}"

# 创建隔离的临时目录和调试日志
mkdir -p "$TEMP_DIR"
DEBUG_LOG="${TEMP_DIR}/debug.log"

# 调试日志函数
log_debug() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$DEBUG_LOG"
}

# 先读取配置以确定语言设置和暂停状态
supervisor_template="$PROJECT_DIR/.claude/cc-supervisor-rules.txt"
SUPERVISOR_DIR=$(dirname "$supervisor_template")
CONFIG_FILE="$SUPERVISOR_DIR/cc-supervisor-config.json"
if [ -f "$CONFIG_FILE" ]; then
    LOCALE=$(jq -r '.locale // "zh-CN"' "$CONFIG_FILE")
    PAUSED=$(jq -r '.paused // false' "$CONFIG_FILE")
    PAUSED_AT=$(jq -r '.pausedAt // ""' "$CONFIG_FILE")
else
    LOCALE="zh-CN"
    PAUSED="false"
    PAUSED_AT=""
fi

# 根据语言设置选择消息
if [ "$LOCALE" = "en-US" ]; then
    # English messages
    MSG_HOOK_START="===== Supervisor Hook Started ====="
    MSG_HOOK_END="===== Supervisor Hook Ended ====="
    MSG_PROJECT_ROOT="Project root:"
    MSG_CURRENT_DIR="Current directory:"
    MSG_PROJECT_NAME="Project name:"
    MSG_SESSION_ID="Session ID:"
    MSG_STOP_HOOK_ACTIVE="Detected stop_hook_active=true, continuing supervision (may cause loop blocking)"
    MSG_RULES_NOT_FOUND="Supervisor rules file not found:"
    MSG_RULES_FOUND="Found supervisor rules:"
    MSG_READING_CONFIG="Reading supervisor config:"
    MSG_CLAUDE_CMD="Claude command:"
    MSG_DEFAULT_CMD="Using default Claude command:"
    MSG_CREATE_SYMLINK="Created symlink:"
    MSG_TRANSCRIPT_PATH="Transcript path:"
    MSG_TRANSCRIPT_COPIED="Transcript copied to:"
    MSG_TRANSCRIPT_SUMMARY="Transcript summary:"
    MSG_TRANSCRIPT_EMPTY="Transcript does not exist or is empty"
    MSG_CALLING_SUPERVISOR="Starting supervisor Claude"
    MSG_SWITCHING_DIR="Switching to temp directory:"
    MSG_SUPERVISOR_FAILED="Supervisor call failed, exit code:"
    MSG_SUPERVISOR_RETURNED="Supervisor returned, exit code:"
    MSG_SUPERVISOR_RAW="Supervisor raw output:"
    MSG_PROXY_DETECTED="Detected proxy success, extracting JSON:"
    MSG_FILTERED_RESULT="Filtered supervisor result:"
    MSG_EMPTY_RESPONSE="Warning: Supervisor returned empty or proxy-only response"
    MSG_RETURNING_PROJECT="Returning to project directory:"
    MSG_DECISION_BLOCK="Supervisor decision: BLOCK"
    MSG_BLOCK_REASON="Block reason:"
    MSG_DECISION_PASS="Supervisor decision: PASS - Work quality acceptable"
    MSG_MARK_CLEANUP="Marked for cleanup, will be deleted after 1 hour"
    MSG_CLEANED_OLD="Cleaned sessions older than 1 hour"
    MSG_UNEXPECTED_RESULT="Warning: Supervisor returned unexpected result:"
    MSG_PARSE_DECISION="Parsed decision value:"
    MSG_CHECK_LIST="Check list:"
    MSG_DEBUG_LOG_SAVED="# Debug log saved to:"
    MSG_SIGNAL_TERM="Received signal: SIGTERM (15) - Normal termination"
    MSG_SIGNAL_INT="Received signal: SIGINT (2) - Interrupt"
    MSG_SIGNAL_HUP="Received signal: SIGHUP (1) - Hangup"
    MSG_HOOK_EXIT="Hook exiting normally or abnormally"
    MSG_CALLING_CLAUDE="Starting call to"
    MSG_STDERR_CONTENT="stderr content:"
    MSG_SUPERVISOR_STDERR="Supervisor stderr output:"
    MSG_ORIGINAL_OUTPUT="Original output:"
    MSG_PAUSED_STATUS="Supervisor is currently PAUSED"
    MSG_PAUSED_SINCE="Paused since:"
    MSG_PAUSED_REMINDER="For inquiry-only conversations. Run 'cc-supervisor resume' to restore supervision"
else
    # 中文消息
    MSG_HOOK_START="===== 监工Hook开始 ====="
    MSG_HOOK_END="===== 监工Hook结束 ====="
    MSG_PROJECT_ROOT="项目根目录:"
    MSG_CURRENT_DIR="当前工作目录:"
    MSG_PROJECT_NAME="项目名称:"
    MSG_SESSION_ID="会话ID:"
    MSG_STOP_HOOK_ACTIVE="检测到stop_hook_active=true，继续执行监工检查（可能导致循环阻止）"
    MSG_RULES_NOT_FOUND="未找到监工规则文件:"
    MSG_RULES_FOUND="找到监工规则:"
    MSG_READING_CONFIG="读取监工配置:"
    MSG_CLAUDE_CMD="Claude命令:"
    MSG_DEFAULT_CMD="使用默认Claude命令:"
    MSG_CREATE_SYMLINK="创建软链接:"
    MSG_TRANSCRIPT_PATH="对话记录路径:"
    MSG_TRANSCRIPT_COPIED="对话记录已复制到:"
    MSG_TRANSCRIPT_SUMMARY="对话记录摘要:"
    MSG_TRANSCRIPT_EMPTY="对话记录不存在或为空"
    MSG_CALLING_SUPERVISOR="开始调用监工Claude"
    MSG_SWITCHING_DIR="切换到临时目录:"
    MSG_SUPERVISOR_FAILED="监工调用失败，退出码:"
    MSG_SUPERVISOR_RETURNED="监工返回，退出码:"
    MSG_SUPERVISOR_RAW="监工原始返回:"
    MSG_PROXY_DETECTED="检测到proxy success，提取JSON结果:"
    MSG_FILTERED_RESULT="过滤后的监工结果:"
    MSG_EMPTY_RESPONSE="警告: 监工返回为空或只有代理响应"
    MSG_RETURNING_PROJECT="返回项目目录:"
    MSG_DECISION_BLOCK="监工决定: BLOCK"
    MSG_BLOCK_REASON="阻止理由:"
    MSG_DECISION_PASS="监工决定: PASS - 工作质量合格"
    MSG_MARK_CLEANUP="标记为待清理，将在1小时后自动删除"
    MSG_CLEANED_OLD="已清理超过1小时的旧session"
    MSG_UNEXPECTED_RESULT="警告: 监工返回了意外的结果:"
    MSG_PARSE_DECISION="解析的decision值:"
    MSG_CHECK_LIST="检查清单:"
    MSG_DEBUG_LOG_SAVED="# 调试日志已保存至:"
    MSG_SIGNAL_TERM="收到信号: SIGTERM (15) - 正常终止"
    MSG_SIGNAL_INT="收到信号: SIGINT (2) - 中断"
    MSG_SIGNAL_HUP="收到信号: SIGHUP (1) - 挂起"
    MSG_HOOK_EXIT="Hook正常退出或异常终止"
    MSG_CALLING_CLAUDE="开始调用"
    MSG_STDERR_CONTENT="stderr内容:"
    MSG_SUPERVISOR_STDERR="监工stderr输出:"
    MSG_ORIGINAL_OUTPUT="原始输出:"
    MSG_PAUSED_STATUS="监工当前处于暂停状态"
    MSG_PAUSED_SINCE="暂停时间:"
    MSG_PAUSED_REMINDER="仅用于询问类对话。运行 'cc-supervisor resume' 恢复监工"
fi

# 增强的信号处理函数
handle_sigterm() {
    log_debug "$MSG_SIGNAL_TERM"
    log_debug "📊 终止时状态信息:"
    log_debug "  • 进程PID: $SCRIPT_PID"
    log_debug "  • 运行时长: $(($(date +%s) - START_TIME))秒"
    log_debug "  • 当前阶段: $CURRENT_STAGE"
    log_debug "  • 项目目录: $PROJECT_DIR"
    log_debug "  • 会话目录: $SESSION_DIR" 
    log_debug "  • 是否调用监工: $SUPERVISOR_CALLED"
    [ -n "$SUPERVISOR_PID" ] && log_debug "  • 监工子进程PID: $SUPERVISOR_PID"
    log_debug "🔍 可能的终止原因:"
    log_debug "  1. Claude Code超时终止 (默认20分钟)"
    log_debug "  2. 用户手动终止 (Ctrl+C 或 kill)"
    log_debug "  3. 系统资源不足"
    log_debug "  4. 监工Claude卡住未响应"
    log_debug "💡 调试建议:"
    log_debug "  • 检查监工是否卡在某个提示上"
    log_debug "  • 考虑增加超时时间 (.claude/settings.json)"
    log_debug "  • 查看系统资源使用情况"
    exit 143
}

handle_sigint() {
    log_debug "$MSG_SIGNAL_INT"
    log_debug "🛑 用户中断Hook执行 (Ctrl+C)"
    log_debug "  • 当前阶段: $CURRENT_STAGE"
    log_debug "  • 运行时长: $(($(date +%s) - START_TIME))秒"
    exit 130
}

handle_sighup() {
    log_debug "$MSG_SIGNAL_HUP"
    log_debug "🔌 终端连接断开"
    log_debug "  • 当前阶段: $CURRENT_STAGE"
    exit 129
}

# 设置信号捕获（记录被杀原因）
trap 'handle_sigterm' TERM
trap 'handle_sigint' INT
trap 'handle_sighup' HUP
trap 'log_debug "$MSG_HOOK_EXIT"' EXIT

# 初始化状态跟踪变量
START_TIME=$(date +%s)
CURRENT_STAGE="初始化"
SUPERVISOR_CALLED="否"
SUPERVISOR_PID=""

# 记录开始
log_debug "$MSG_HOOK_START"
log_debug "Hook进程PID: $SCRIPT_PID"
log_debug "$MSG_PROJECT_ROOT $PROJECT_DIR"
log_debug "$MSG_CURRENT_DIR $CURRENT_DIR"
log_debug "$MSG_PROJECT_NAME $PROJECT_NAME"
log_debug "$MSG_SESSION_ID $SESSION_ID"
log_debug "stop_hook_active: $stop_hook_active"

# 记录完整输入（脱敏处理）
echo "$input" | jq '.' >> "$DEBUG_LOG" 2>/dev/null || log_debug "输入JSON解析失败"

# 记录stop_hook_active状态但不特殊处理
# 注意：即使stop_hook_active=true也会继续检查，可能导致循环阻止
# 这是设计决定：宁可严格也不放过偷懒行为
if [ "$stop_hook_active" = "true" ]; then
    log_debug "$MSG_STOP_HOOK_ACTIVE"
    # 不退出，继续正常检查
fi

# 检查是否处于暂停状态
if [ "$PAUSED" = "true" ]; then
    log_debug "$MSG_PAUSED_STATUS"
    if [ -n "$PAUSED_AT" ]; then
        log_debug "$MSG_PAUSED_SINCE $PAUSED_AT"
    fi
    log_debug "$MSG_PAUSED_REMINDER"
    log_debug "$MSG_HOOK_END"
    
    # 暂停状态下直接允许停止，但要在stderr显示提醒
    echo "# $MSG_PAUSED_STATUS" >&2
    echo "# $MSG_PAUSED_REMINDER" >&2
    
    # 返回空对象允许停止
    echo "{}"
    exit 0
fi

# 直接检查项目根目录的监工规则（已在前面定义）
if [ ! -f "$supervisor_template" ]; then
    log_debug "$MSG_RULES_NOT_FOUND $supervisor_template"
    # 没有监工模板，允许停止
    exit 0
fi

log_debug "$MSG_RULES_FOUND $supervisor_template"

# 读取监工配置（从监工规则所在的目录）
# 配置文件和语言设置已在前面读取
CURRENT_STAGE="读取配置"
if [ -f "$CONFIG_FILE" ]; then
    log_debug "$MSG_READING_CONFIG $CONFIG_FILE"
    CLAUDE_BASE=$(jq -r '.claude_command.base // "claude"' "$CONFIG_FILE")
    CLAUDE_ARGS=$(jq -r '.claude_command.args[]' "$CONFIG_FILE" 2>/dev/null | tr '\n' ' ')
    CLAUDE_CMD="$CLAUDE_BASE $CLAUDE_ARGS"
    log_debug "$MSG_CLAUDE_CMD $CLAUDE_CMD"
else
    # 默认命令
    CLAUDE_CMD="claude -p"
    log_debug "$MSG_DEFAULT_CMD $CLAUDE_CMD"
fi


# 创建软链接到项目目录
ln -s "$PROJECT_DIR" "$TEMP_DIR/project"
log_debug "$MSG_CREATE_SYMLINK $TEMP_DIR/project -> $PROJECT_DIR"

# 复制对话记录到临时目录（如果存在）
transcript_path=$(echo "$input" | jq -r '.transcript_path // ""')
log_debug "$MSG_TRANSCRIPT_PATH $transcript_path"

if [ -f "$transcript_path" ] && [ -s "$transcript_path" ]; then
    cp "$transcript_path" "$TEMP_DIR/transcript.json"
    transcript_ref="$TEMP_DIR/transcript.json"
    log_debug "$MSG_TRANSCRIPT_COPIED $transcript_ref"
    # 记录对话摘要（最后几条）
    log_debug "$MSG_TRANSCRIPT_SUMMARY"
    tail -5 "$transcript_path" | while IFS= read -r line; do
        # 处理JSONL格式的对话记录
        if echo "$line" | jq -e . >/dev/null 2>&1; then
            # 解析Claude Code的JSONL格式
            role=$(echo "$line" | jq -r '.message.role // .type // "unknown"' 2>/dev/null)
            content=$(echo "$line" | jq -r '.message.content // .summary // ""' 2>/dev/null)
            
            # 如果content是数组，提取text部分
            if [ "$content" != "" ] && echo "$content" | jq -e 'type == "array"' >/dev/null 2>&1; then
                content=$(echo "$content" | jq -r '.[0].text // .[0] // ""' 2>/dev/null)
            fi
            
            # 截断过长的内容
            if [ ${#content} -gt 200 ]; then
                content="${content:0:200}..."
            fi
            
            log_debug "[$role] $content"
        else
            log_debug "[parse_error] $line"
        fi
    done
else
    transcript_ref=""
    log_debug "$MSG_TRANSCRIPT_EMPTY"
fi

# 构建监工系统提示
system_prompt="检查任务：
1. 阅读对话记录：$transcript_ref
2. 根据监工规则检查Claude的工作质量

监工规则：
$(cat "$supervisor_template" 2>/dev/null || echo "监工规则文件未找到")

对话上下文：
$(echo "$input" | jq -r '.')

你的角色和输出要求：
- 你是一个质量检查API，不是对话助手
- 只能输出单行JSON，禁止markdown、表情、标题、列表等任何其他格式
- 根据监工规则的决策原则，输出以下格式之一：
  * {\"decision\": \"block\", \"reason\": \"[具体原因]\", \"checkedList\": [{\"item\": \"检查项名称\", \"result\": \"pass/fail\", \"detail\": \"具体情况\"}]} - 当需要阻止停止时
  * {\"checkedList\": [{\"item\": \"检查项名称\", \"result\": \"pass\", \"detail\": \"具体情况\"}]} - 当允许停止时
- 第一个字符必须是{，最后一个字符必须是}
- checkedList是数组，按照监工规则逐项记录检查结果
- 每个检查项包含：item（检查项名称）、result（pass/fail）、detail（具体发现的情况或无问题）

OUTPUT:"

# 记录监工提示摘要
CURRENT_STAGE="调用监工"
SUPERVISOR_CALLED="是"
log_debug "$MSG_CALLING_SUPERVISOR ($CLAUDE_CMD)"

# 在隔离目录中调用监工
cd "$TEMP_DIR"
log_debug "$MSG_SWITCHING_DIR $TEMP_DIR"

# 调用监工并记录完整结果
log_debug "$MSG_CALLING_CLAUDE $CLAUDE_CMD..."
supervisor_result_raw=$(echo "$system_prompt" | $CLAUDE_CMD 2>"${DEBUG_LOG}.stderr")
exit_code=$?

# 记录退出码和更新阶段
CURRENT_STAGE="解析监工结果"
log_debug "$MSG_SUPERVISOR_RETURNED $exit_code"

# 处理非零退出码
if [ $exit_code -ne 0 ]; then
    log_debug "$MSG_SUPERVISOR_FAILED $exit_code"
    if [ -s "${DEBUG_LOG}.stderr" ]; then
        stderr_content=$(cat "${DEBUG_LOG}.stderr")
        log_debug "$MSG_STDERR_CONTENT $stderr_content"
    fi
    # 如果没有输出，给个默认值
    if [ -z "$supervisor_result_raw" ]; then
        supervisor_result_raw="ERROR: 监工调用失败"
    fi
fi

log_debug "$MSG_SUPERVISOR_RAW $supervisor_result_raw"

# 改进的过滤逻辑：处理proxy success和JSON（可能多行）的情况
if echo "$supervisor_result_raw" | grep -q "proxy success"; then
    # 检测到proxy success，需要提取JSON部分
    # 从第一个{开始，到最后一个}结束，包括多行JSON
    supervisor_result=$(echo "$supervisor_result_raw" | awk '
        /{/ { capture=1 }
        capture { result = result $0 }
        /}/ && capture { print result; exit }
    ')
    
    # 如果还是空，尝试更宽松的提取
    if [ -z "$supervisor_result" ]; then
        # 去掉proxy success行，然后提取剩余内容
        supervisor_result=$(echo "$supervisor_result_raw" | sed '/proxy success/d' | tr -d '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    fi
    
    log_debug "$MSG_PROXY_DETECTED $supervisor_result"
else
    # 没有proxy success，正常过滤markdown标记
    supervisor_result=$(echo "$supervisor_result_raw" | sed '/^```json$/d' | sed '/^```$/d')
    log_debug "$MSG_FILTERED_RESULT $supervisor_result"
fi

# 如果过滤后为空，说明只有代理响应没有真实内容
if [[ -z "$supervisor_result" ]]; then
    log_debug "$MSG_EMPTY_RESPONSE"
    log_debug "$MSG_ORIGINAL_OUTPUT $supervisor_result_raw"
    exit 0  # 默认通过，避免阻塞
fi

# 记录stderr（如果有错误）
if [ -s "${DEBUG_LOG}.stderr" ]; then
    log_debug "$MSG_SUPERVISOR_STDERR"
    cat "${DEBUG_LOG}.stderr" >> "$DEBUG_LOG"
fi

# 返回项目目录
cd "$PROJECT_DIR"
log_debug "$MSG_RETURNING_PROJECT $PROJECT_DIR"

# 解析监工返回的JSON结果
# 尝试提取decision字段
decision=$(echo "$supervisor_result" | jq -r '.decision // "undefined"' 2>/dev/null || echo "parse_error")

# 记录检查清单（如果存在）
checkedList=$(echo "$supervisor_result" | jq -r '.checkedList // null' 2>/dev/null)
if [ "$checkedList" != "null" ]; then
    log_debug "$MSG_CHECK_LIST"
    echo "$supervisor_result" | jq '.checkedList' >> "$DEBUG_LOG" 2>/dev/null
fi

if [ "$decision" = "block" ]; then
    # 发现问题，阻止停止
    reason=$(echo "$supervisor_result" | jq -r '.reason // "未提供原因"' 2>/dev/null || echo "监工发现问题但未正确返回JSON")
    CURRENT_STAGE="阻止工作"
    log_debug "$MSG_DECISION_BLOCK"
    log_debug "$MSG_BLOCK_REASON $reason"
    
    # 保留调试日志供用户查看
    echo "$MSG_DEBUG_LOG_SAVED $DEBUG_LOG" >&2
    
    # 输出监工返回的JSON（但要去掉checkedList以符合Claude Code格式）
    echo "$supervisor_result" | jq 'del(.checkedList)' 2>/dev/null || echo "$supervisor_result"
elif [ "$decision" = "undefined" ] || [ "$decision" = "null" ]; then
    # 工作合格，允许停止
    CURRENT_STAGE="允许停止"
    log_debug "$MSG_DECISION_PASS"
    
    # 清理临时目录（但保留一段时间供调试）
    log_debug "$MSG_MARK_CLEANUP"
    
    # 清理超过1小时的旧session（避免积累）
    find "${TEMP_BASE}/${PROJECT_NAME}" -maxdepth 1 -type d -mmin +60 -exec rm -rf {} \; 2>/dev/null || true
    log_debug "$MSG_CLEANED_OLD"
    
    log_debug "$MSG_HOOK_END"
    
    # 输出空对象（去掉checkedList）
    echo "{}"
    exit 0
else
    # 解析错误或意外的decision值
    log_debug "$MSG_UNEXPECTED_RESULT $supervisor_result"
    log_debug "$MSG_PARSE_DECISION $decision"
    
    # 默认允许停止，避免阻塞
    echo "{}"
    exit 0
fi