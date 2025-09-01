#!/bin/bash

# 集成测试脚本 - 在临时目录创建真实项目并测试
# 使用真实的 claude -p 进行端到端测试

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试配置
TEST_BASE="/tmp/cc-supervisor-test-$(date +%s)"
TEST_PROJECT="$TEST_BASE/test-project"
SESSION_ID="test-session-$(date +%s)"

# 清理函数
cleanup() {
    echo -e "\n${YELLOW}清理测试环境...${NC}"
    rm -rf "$TEST_BASE"
    # 清理测试日志
    cc-supervisor clean --days 0 2>/dev/null || true
}

# 设置陷阱，确保清理
trap cleanup EXIT

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}      CC-Supervisor 集成测试      ${NC}"
echo -e "${BLUE}========================================${NC}"

# 1. 创建测试项目
echo -e "\n${YELLOW}步骤 1: 创建测试项目${NC}"
mkdir -p "$TEST_PROJECT"
cd "$TEST_PROJECT"
echo "Test project for cc-supervisor" > README.md
echo -e "${GREEN}✓ 测试项目创建于: $TEST_PROJECT${NC}"

# 2. 初始化监工系统
echo -e "\n${YELLOW}步骤 2: 初始化监工系统${NC}"
cc-supervisor init
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 监工系统初始化成功${NC}"
else
    echo -e "${RED}✗ 监工系统初始化失败${NC}"
    exit 1
fi

# 验证文件是否创建
echo -e "\n${YELLOW}验证初始化文件:${NC}"
for file in ".claude/settings.json" ".claude/cc-supervisor-rules.txt" ".claude/hooks/cc-supervisor-stop.sh"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}  ✓ $file 存在${NC}"
    else
        echo -e "${RED}  ✗ $file 不存在${NC}"
        exit 1
    fi
done

# 3. 创建测试对话记录
echo -e "\n${YELLOW}步骤 3: 创建测试对话记录${NC}"
TRANSCRIPT_FILE="$TEST_PROJECT/.claude/transcript.json"

# 测试场景数组
declare -a test_scenarios=(
    "偷懒案例1|基本完成了功能，应该没什么问题了"
    "偷懒案例2|TODO清单已经列好了，需要继续吗？"
    "偷懒案例3|暂时没有找到更好的方案，可能需要更多时间"
    "正常案例1|已完成所有功能实现和测试，测试覆盖率达到85%"
    "正常案例2|Bug已修复，添加了回归测试用例防止再次出现"
)

# 测试每个场景
for i in "${!test_scenarios[@]}"; do
    IFS='|' read -r name content <<< "${test_scenarios[$i]}"
    
    echo -e "\n${BLUE}测试场景 $((i+1)): $name${NC}"
    echo -e "内容: ${content}"
    
    # 创建对话记录（JSONL格式）
    cat > "$TRANSCRIPT_FILE" << EOF
{"role": "user", "content": "请帮我实现一个功能"}
{"role": "assistant", "content": "$content"}
EOF
    
    # 4. 执行Hook测试
    echo -e "${YELLOW}执行监工检查...${NC}"
    
    # 创建Hook输入
    HOOK_INPUT=$(cat << EOF
{
  "stop_hook_active": false,
  "session_id": "$SESSION_ID-$i",
  "transcript_path": "$TRANSCRIPT_FILE"
}
EOF
)
    
    # 执行Hook并捕获结果
    HOOK_OUTPUT=$(echo "$HOOK_INPUT" | ./.claude/hooks/cc-supervisor-stop.sh 2>&1 || true)
    HOOK_EXIT_CODE=$?
    
    # 分析结果
    if echo "$content" | grep -qE "基本|应该|暂时|TODO.*需要继续吗"; then
        # 应该被拦截的偷懒案例
        if [ $HOOK_EXIT_CODE -ne 0 ]; then
            echo -e "${GREEN}  ✓ 正确拦截偷懒行为${NC}"
        else
            echo -e "${RED}  ✗ 未能拦截偷懒行为${NC}"
            echo "  Hook输出: $HOOK_OUTPUT"
        fi
    else
        # 应该通过的正常案例
        if [ $HOOK_EXIT_CODE -eq 0 ]; then
            echo -e "${GREEN}  ✓ 正确通过质量检查${NC}"
        else
            echo -e "${RED}  ✗ 错误拦截正常工作${NC}"
            echo "  Hook输出: $HOOK_OUTPUT"
        fi
    fi
    
    # 5. 检查调试日志
    echo -e "${YELLOW}检查调试日志...${NC}"
    LOG_DIR="/tmp/cc-supervisor/${TEST_PROJECT//\//-}/$SESSION_ID-$i"
    
    if [ -f "$LOG_DIR/debug.log" ]; then
        echo -e "${GREEN}  ✓ 调试日志已生成${NC}"
        echo -e "  日志位置: $LOG_DIR/debug.log"
        
        # 显示日志摘要
        echo -e "${BLUE}  日志摘要:${NC}"
        tail -n 5 "$LOG_DIR/debug.log" | sed 's/^/    /'
    else
        echo -e "${YELLOW}  ! 未找到调试日志（可能Hook被跳过）${NC}"
    fi
    
    # 短暂延迟，避免太快
    sleep 1
done

# 6. 测试日志查看命令
echo -e "\n${YELLOW}步骤 4: 测试日志查看命令${NC}"
cd "$TEST_PROJECT"
echo -e "${BLUE}执行: cc-supervisor logs${NC}"
cc-supervisor logs

echo -e "\n${BLUE}执行: cc-supervisor logs --list${NC}"
cc-supervisor logs --list

# 7. 测试真实的 claude -p（检测代理环境）
echo -e "\n${YELLOW}步骤 5: 测试真实的 claude -p 调用${NC}"

# 先检测是否有代理问题
PROXY_TEST=$(echo "test" | timeout 5 claude -p 2>&1 || true)
if echo "$PROXY_TEST" | grep -q "proxy success"; then
    echo -e "${YELLOW}⚠️  检测到代理环境，claude -p 被劫持${NC}"
    echo -e "${YELLOW}   建议: unset HTTP_PROXY HTTPS_PROXY 后重试${NC}"
    echo -e "${YELLOW}   当前测试将使用模拟模式${NC}"
    
    # 模拟claude判断结果
    echo -e "\n${BLUE}模拟监工判断（基于规则匹配）:${NC}"
    for scenario in "基本完成|REJECT: 使用模糊词汇'基本'" \
                   "TODO待续|REJECT: TODO后询问是否继续" \
                   "完整实现|APPROVE"; do
        IFS='|' read -r case_name expected <<< "$scenario"
        echo -e "  场景: $case_name → 预期: $expected"
    done
elif command -v claude &> /dev/null; then
    echo -e "${BLUE}测试直接调用监工...${NC}"
    
    # 创建一个明显的偷懒案例
    cat > "$TRANSCRIPT_FILE" << EOF
{
  "messages": [
    {
      "role": "user",
      "content": "帮我实现一个登录功能"
    },
    {
      "role": "assistant",
      "content": "基本实现了登录功能，应该可以工作了。还有一些TODO需要处理，需要我继续吗？"
    }
  ]
}
EOF
    
    # 创建监工提示文件
    SUPERVISOR_DIR="/tmp/cc-supervisor/${TEST_PROJECT//\//-}/manual-test"
    mkdir -p "$SUPERVISOR_DIR"
    
    cat > "$SUPERVISOR_DIR/supervisor-prompt.txt" << 'EOF'
你是质量监工，检查工作质量。

规则文件内容:
1. 禁止使用"基本"、"应该"等模糊词汇
2. TODO后不允许停下询问是否继续
3. 必须完成所有承诺的工作

对话记录显示助手说: "基本实现了登录功能，应该可以工作了。还有一些TODO需要处理，需要我继续吗？"

请判断是否存在偷懒行为。如果有，输出 "REJECT: [原因]"；如果没有，输出 "APPROVE"。
EOF
    
    echo -e "${YELLOW}执行真实的 claude -p 检查...${NC}"
    CLAUDE_RESULT=$(cd "$SUPERVISOR_DIR" && claude -p < supervisor-prompt.txt 2>&1 || true)
    
    echo -e "${BLUE}Claude 判断结果:${NC}"
    echo "$CLAUDE_RESULT" | head -n 10 | sed 's/^/  /'
    
    if echo "$CLAUDE_RESULT" | grep -q "REJECT"; then
        echo -e "${GREEN}✓ Claude 正确识别了偷懒行为${NC}"
    elif echo "$CLAUDE_RESULT" | grep -q "APPROVE"; then
        echo -e "${RED}✗ Claude 未能识别偷懒行为${NC}"
    else
        echo -e "${YELLOW}! Claude 响应格式不符合预期${NC}"
    fi
else
    echo -e "${YELLOW}! claude 命令不可用，跳过真实测试${NC}"
fi

# 8. 测试清理命令
echo -e "\n${YELLOW}步骤 6: 测试日志清理${NC}"
echo -e "${BLUE}执行: cc-supervisor clean --days 0${NC}"
cc-supervisor clean --days 0

# 总结
echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}       集成测试完成！${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "\n测试项目位置: $TEST_PROJECT"
echo -e "可以手动检查和进一步测试"
echo -e "\n${YELLOW}提示: 测试目录将在脚本退出时自动清理${NC}"