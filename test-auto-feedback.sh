#!/bin/bash

# test-auto-feedback.sh - 测试supervisor-node的自动反馈提交功能
# 
# 测试流程：
# 1. supervisor-node成功检测到issues文件
# 2. 自动注入显示在终端
# 3. 命令被提交给Claude  
# 4. Claude接收并处理消息

set -e

echo "🧪 测试 supervisor-node 自动反馈功能"
echo "=================================="

# 测试环境准备
TEST_DIR="/tmp/test-supervisor-feedback-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "📁 测试目录: $TEST_DIR"

# 初始化supervisor-me
echo "🚀 初始化 supervisor-me..."
supervisor-me init -f > /dev/null 2>&1

# 启动supervisor-node在后台
echo "🔧 启动 supervisor-node..."
nohup supervisor-node --dangerously-skip-permissions > test.log 2>&1 &
SUPERVISOR_PID=$!
echo "   PID: $SUPERVISOR_PID"

# 等待启动
sleep 5

# 获取session ID
SESSION_ID=$(ls -t ~/.supervisor-me/projects/tmp-test-supervisor-feedback-*/*.log 2>/dev/null | head -1 | xargs basename 2>/dev/null | cut -d. -f1)

if [ -z "$SESSION_ID" ]; then
    echo "❌ 无法获取 session ID"
    kill $SUPERVISOR_PID 2>/dev/null
    exit 1
fi

echo "📝 Session ID: $SESSION_ID"

# 创建issues文件
ISSUES_FILE="$HOME/.supervisor-me/projects/$(echo "$TEST_DIR" | tr / -  | sed 's/^-//')/${SESSION_ID}.issues"
echo "📝 创建测试 issues 文件..."
cat > "$ISSUES_FILE" << 'EOF'
🔧 自动测试验证：

这是自动化测试脚本创建的验证消息。
如果此消息被成功处理，说明：
1. issues文件被检测到
2. 内容被自动注入
3. 命令被提交执行

测试时间: $(date)
EOF

# 等待处理
echo "⏳ 等待 supervisor-node 处理..."
sleep 3

# 检查日志
echo "📋 检查处理结果..."

# 检查issues文件是否被处理（删除）
if [ -f "$ISSUES_FILE" ]; then
    echo "❌ issues 文件未被处理"
    RESULT=1
else
    echo "✅ issues 文件已被处理"
    RESULT=0
fi

# 检查日志中是否有注入记录
if grep -q "命令已注入并执行" test.log 2>/dev/null; then
    echo "✅ 命令注入记录找到"
else
    # 也检查supervisor-me的日志
    LOG_FILE="$HOME/.supervisor-me/projects/$(echo "$TEST_DIR" | tr / - | sed 's/^-//')/${SESSION_ID}.log"
    if [ -f "$LOG_FILE" ] && grep -q "命令已注入并执行" "$LOG_FILE"; then
        echo "✅ 命令注入记录找到（在supervisor日志中）"
    else
        echo "⚠️  未找到命令注入记录"
        RESULT=1
    fi
fi

# 检查是否有[自动注入]标记
if grep -q "\[自动注入\]" test.log 2>/dev/null; then
    echo "✅ 自动注入标记显示在终端"
else
    echo "⚠️  未找到自动注入标记"
fi

# 清理
echo "🧹 清理测试环境..."
kill $SUPERVISOR_PID 2>/dev/null || true
cd /
rm -rf "$TEST_DIR"

echo "=================================="
if [ $RESULT -eq 0 ]; then
    echo "✅ 测试通过！自动反馈功能正常工作"
else
    echo "❌ 测试失败，请检查日志"
fi

exit $RESULT