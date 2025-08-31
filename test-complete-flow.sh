#!/bin/bash

echo "============================================"
echo "🧪 测试完整的 Supervisor-ME 流程"
echo "============================================"
echo

# 1. 检查 Hooks 配置
echo "1️⃣ 检查 Hooks 配置："
echo "────────────────────"
if [ -f ".claude/settings.json" ]; then
    echo "✅ settings.json 存在"
    echo "   Hooks 配置："
    grep -E "(SessionStart|Stop|PostToolUse|UserPromptSubmit)" .claude/settings.json | head -5
else
    echo "❌ settings.json 不存在"
fi
echo

# 2. 检查 Hook 脚本
echo "2️⃣ 检查 Hook 脚本："
echo "──────────────────"
for hook in session-start.sh session-tracker.sh stop.sh post-tool-use.sh user-prompt-submit.sh; do
    if [ -f ".claude/hooks/$hook" ]; then
        echo "✅ $hook 存在"
    else
        echo "❌ $hook 缺失"
    fi
done
echo

# 3. 测试 Session 追踪
echo "3️⃣ 测试 Session 追踪："
echo "───────────────────"
TEST_SESSION="test-$(uuidgen | tr '[:upper:]' '[:lower:]')"
echo "测试 Session ID: $TEST_SESSION"

# 调用 session-tracker
bash .claude/hooks/session-tracker.sh "$TEST_SESSION" "test"

# 检查是否创建了文件
PROJECT_NAME=$(pwd | sed 's/\//\-/g' | sed 's/^-//')
TRACK_DIR="$HOME/.supervisor-me/projects/$PROJECT_NAME"

if [ -f "$TRACK_DIR/active-session" ]; then
    ACTIVE=$(cat "$TRACK_DIR/active-session")
    echo "✅ active-session 文件创建成功"
    echo "   当前活跃: $ACTIVE"
else
    echo "❌ active-session 文件未创建"
fi

if [ -f "$TRACK_DIR/${TEST_SESSION}.issues" ]; then
    echo "✅ issues 文件创建成功"
else
    echo "❌ issues 文件未创建"
fi
echo

# 4. 测试验证命令
echo "4️⃣ 测试验证命令："
echo "───────────────"
echo "执行: supervisor-me verify --json --session $TEST_SESSION"
RESULT=$(supervisor-me verify --json --session "$TEST_SESSION" 2>&1)
if echo "$RESULT" | grep -q '"continue"'; then
    echo "✅ 验证命令执行成功"
else
    echo "⚠️  验证命令可能有问题"
fi
echo

# 5. 测试 Issues 文件监听
echo "5️⃣ 测试 Issues 文件处理："
echo "──────────────────────"
ISSUES_FILE="$TRACK_DIR/${TEST_SESSION}.issues"
echo "🔧 测试问题：代码需要优化" > "$ISSUES_FILE"
echo "✅ 写入测试问题到 issues 文件"
echo "   文件: $ISSUES_FILE"
echo

# 6. 检查日志
echo "6️⃣ 检查系统日志："
echo "───────────────"
if [ -f "$TRACK_DIR/session-history.log" ]; then
    echo "Session 历史："
    tail -3 "$TRACK_DIR/session-history.log"
else
    echo "（无 session 历史）"
fi
echo

# 7. 显示架构流程
echo "7️⃣ 系统架构流程："
echo "───────────────"
cat << 'EOF'
User ──► supervisor-node ──► Worker Claude
              │                    │
              │                    ▼ Stop Hook
              │              supervisor-me verify
              │                    │
              │                    ▼ Issues?
              │              Write issues file
              │                    │
              ◄────────────────────┘
         Auto inject fix command
EOF
echo

# 8. 清理测试文件
echo "8️⃣ 清理测试文件..."
rm -f "$ISSUES_FILE"
echo "✅ 测试完成！"
echo

echo "============================================"
echo "📋 下一步："
echo "1. 运行 supervisor-node 启动完整系统"
echo "2. 在 Claude 中执行任务"
echo "3. 观察自动验证和修复流程"
echo "============================================"