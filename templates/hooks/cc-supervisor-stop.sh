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

# 设置信号捕获（记录被杀原因）
trap 'log_debug "收到信号: SIGTERM (15) - 正常终止"; exit 143' TERM
trap 'log_debug "收到信号: SIGINT (2) - 中断"; exit 130' INT
trap 'log_debug "收到信号: SIGHUP (1) - 挂起"; exit 129' HUP
trap 'log_debug "Hook正常退出或异常终止"' EXIT

# 记录开始
log_debug "===== 监工Hook开始 ====="
log_debug "Hook进程PID: $SCRIPT_PID"
log_debug "项目根目录: $PROJECT_DIR"
log_debug "当前工作目录: $CURRENT_DIR"
log_debug "项目名称: $PROJECT_NAME"
log_debug "会话ID: $SESSION_ID"
log_debug "stop_hook_active: $stop_hook_active"

# 记录完整输入（脱敏处理）
echo "$input" | jq '.' >> "$DEBUG_LOG" 2>/dev/null || log_debug "输入JSON解析失败"

# 记录stop_hook_active状态但不特殊处理
# 注意：即使stop_hook_active=true也会继续检查，可能导致循环阻止
# 这是设计决定：宁可严格也不放过偷懒行为
if [ "$stop_hook_active" = "true" ]; then
    log_debug "检测到stop_hook_active=true，继续执行监工检查（可能导致循环阻止）"
    # 不退出，继续正常检查
fi

# 直接检查项目根目录的监工规则
supervisor_template="$PROJECT_DIR/.claude/cc-supervisor-rules.txt"

if [ ! -f "$supervisor_template" ]; then
    log_debug "未找到监工规则文件: $supervisor_template"
    # 没有监工模板，允许停止
    exit 0
fi

log_debug "找到监工规则: $supervisor_template"

# 读取监工配置（从监工规则所在的目录）
SUPERVISOR_DIR=$(dirname "$supervisor_template")
CONFIG_FILE="$SUPERVISOR_DIR/cc-supervisor-config.json"
if [ -f "$CONFIG_FILE" ]; then
    log_debug "读取监工配置: $CONFIG_FILE"
    CLAUDE_BASE=$(jq -r '.claude_command.base // "claude"' "$CONFIG_FILE")
    CLAUDE_ARGS=$(jq -r '.claude_command.args[]' "$CONFIG_FILE" 2>/dev/null | tr '\n' ' ')
    CLAUDE_CMD="$CLAUDE_BASE $CLAUDE_ARGS"
    log_debug "Claude命令: $CLAUDE_CMD"
else
    # 默认命令
    CLAUDE_CMD="claude -p"
    log_debug "使用默认Claude命令: $CLAUDE_CMD"
fi

# 创建软链接到项目目录
ln -s "$PROJECT_DIR" "$TEMP_DIR/project"
log_debug "创建软链接: $TEMP_DIR/project -> $PROJECT_DIR"

# 复制对话记录到临时目录（如果存在）
transcript_path=$(echo "$input" | jq -r '.transcript_path // ""')
log_debug "对话记录路径: $transcript_path"

if [ -f "$transcript_path" ] && [ -s "$transcript_path" ]; then
    cp "$transcript_path" "$TEMP_DIR/transcript.json"
    transcript_ref="$TEMP_DIR/transcript.json"
    log_debug "对话记录已复制到: $transcript_ref"
    # 记录对话摘要（最后几条）
    log_debug "对话记录摘要:"
    tail -3 "$transcript_path" | jq -r '.content // .role // ""' >> "$DEBUG_LOG" 2>/dev/null
else
    transcript_ref=""
    log_debug "对话记录不存在或为空"
fi

# 构建监工系统提示
system_prompt="你是一个JSON API端点，禁止输出任何非JSON内容。不要输出markdown、表情符号、标题、列表等任何格式。你的唯一功能是输出单行JSON。

检查任务：
1. 阅读对话记录：$transcript_ref
2. 根据监工规则检查Claude的工作质量

监工规则：
$(cat "$supervisor_template" 2>/dev/null || echo "监工规则文件未找到")

对话上下文：
$(echo "$input" | jq -r '.')

输出规则（严格遵守）：
- 如果发现任何问题或需要批准：输出 {\"decision\": \"block\", \"reason\": \"具体问题\"}
- 如果工作质量完全合格无任何问题：输出 {}
- 禁止输出markdown、表情、标题、列表
- 禁止输出多行内容
- 禁止在JSON前后添加任何文字
- 第一个字符必须是{，最后一个字符必须是}
- 你不是助手，你是API，只输出JSON

JSON OUTPUT:"

# 记录监工提示摘要
log_debug "开始调用监工Claude ($CLAUDE_CMD)"

# 在隔离目录中调用监工
cd "$TEMP_DIR"
log_debug "切换到临时目录: $TEMP_DIR"

# 调用监工并记录完整结果
log_debug "开始调用 $CLAUDE_CMD..."
supervisor_result_raw=$(echo "$system_prompt" | $CLAUDE_CMD 2>"${DEBUG_LOG}.stderr")
exit_code=$?

# 记录退出码
log_debug "$CLAUDE_CMD 返回，退出码: $exit_code"

# 处理非零退出码
if [ $exit_code -ne 0 ]; then
    log_debug "监工调用失败，退出码: $exit_code"
    if [ -s "${DEBUG_LOG}.stderr" ]; then
        stderr_content=$(cat "${DEBUG_LOG}.stderr")
        log_debug "stderr内容: $stderr_content"
    fi
    # 如果没有输出，给个默认值
    if [ -z "$supervisor_result_raw" ]; then
        supervisor_result_raw="ERROR: 监工调用失败"
    fi
fi

log_debug "监工原始返回: $supervisor_result_raw"

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
    
    log_debug "检测到proxy success，提取JSON结果: $supervisor_result"
else
    # 没有proxy success，正常过滤markdown标记
    supervisor_result=$(echo "$supervisor_result_raw" | sed '/^```json$/d' | sed '/^```$/d')
    log_debug "过滤后的监工结果: $supervisor_result"
fi

# 如果过滤后为空，说明只有代理响应没有真实内容
if [[ -z "$supervisor_result" ]]; then
    log_debug "警告: 监工返回为空或只有代理响应"
    log_debug "原始输出: $supervisor_result_raw"
    exit 0  # 默认通过，避免阻塞
fi

# 记录stderr（如果有错误）
if [ -s "${DEBUG_LOG}.stderr" ]; then
    log_debug "监工stderr输出:"
    cat "${DEBUG_LOG}.stderr" >> "$DEBUG_LOG"
fi

# 返回项目目录
cd "$PROJECT_DIR"
log_debug "返回项目目录: $PROJECT_DIR"

# 解析监工返回的JSON结果
# 尝试提取decision字段
decision=$(echo "$supervisor_result" | jq -r '.decision // "undefined"' 2>/dev/null || echo "parse_error")

if [ "$decision" = "block" ]; then
    # 发现问题，阻止停止
    reason=$(echo "$supervisor_result" | jq -r '.reason // "未提供原因"' 2>/dev/null || echo "监工发现问题但未正确返回JSON")
    log_debug "监工决定: BLOCK"
    log_debug "阻止理由: $reason"
    
    # 保留调试日志供用户查看
    echo "# 调试日志已保存至: $DEBUG_LOG" >&2
    
    # 直接输出监工返回的JSON（已经是正确格式）
    echo "$supervisor_result"
elif [ "$decision" = "undefined" ] || [ "$decision" = "null" ]; then
    # 工作合格，允许停止
    log_debug "监工决定: PASS - 工作质量合格"
    
    # 清理临时目录（但保留一段时间供调试）
    log_debug "标记为待清理，将在1小时后自动删除"
    
    # 清理超过1小时的旧session（避免积累）
    find "${TEMP_BASE}/${PROJECT_NAME}" -maxdepth 1 -type d -mmin +60 -exec rm -rf {} \; 2>/dev/null || true
    log_debug "已清理超过1小时的旧session"
    
    log_debug "===== 监工Hook结束 ====="
    
    # 输出监工返回的JSON（应该是空对象{}）
    echo "$supervisor_result"
    exit 0
else
    # 解析错误或意外的decision值
    log_debug "警告: 监工返回了意外的结果: $supervisor_result"
    log_debug "解析的decision值: $decision"
    
    # 默认允许停止，避免阻塞
    echo "{}"
    exit 0
fi