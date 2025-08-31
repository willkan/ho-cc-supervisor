#!/bin/bash

# 测试 Supervisor-ME 验证系统
set -e

echo "🧪 测试 Supervisor-ME 验证系统"
echo "================================"

# 1. 创建测试项目
TEST_DIR="/tmp/test-supervisor-$(date +%s)"
echo "📁 创建测试目录: $TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# 2. 初始化项目
echo ""
echo "📦 初始化 Supervisor-ME..."
/Users/ouyanganran/dev/supervisor-me-mvp/bin/supervisor-me init

# 3. 检查文件结构
echo ""
echo "🔍 检查文件结构..."
echo "  .claude/settings.json: $([ -f .claude/settings.json ] && echo '✅' || echo '❌')"
echo "  .claude/hooks/stop.sh: $([ -f .claude/hooks/stop.sh ] && echo '✅' || echo '❌')"
echo "  lib/supervisor-me/: $([ -d lib/supervisor-me ] && echo '✅' || echo '❌')"
echo "  lib/supervisor-me/claude-verify-simple.js: $([ -f lib/supervisor-me/claude-verify-simple.js ] && echo '✅' || echo '❌')"

# 4. 检查 hook 脚本路径
echo ""
echo "🔍 检查 stop.sh 中的路径..."
grep -n "lib/supervisor-me" .claude/hooks/stop.sh || echo "未找到路径"

# 5. 创建测试文件
echo ""
echo "📝 创建测试文件..."
cat > test.js << 'EOF'
function add(a, b) {
    return a + b;
}
console.log('Test file created');
EOF

# 6. 手动触发 Stop hook
echo ""
echo "🚀 手动触发 Stop hook..."
bash .claude/hooks/stop.sh

# 7. 检查日志
echo ""
echo "📋 检查日志..."
if [ -f logs/supervisor-me/completions/stop.log ]; then
    echo "最近的日志内容："
    tail -5 logs/supervisor-me/completions/stop.log
else
    echo "❌ 未找到日志文件"
fi

# 8. 使用 CLI 查看状态
echo ""
echo "📊 系统状态："
/Users/ouyanganran/dev/supervisor-me-mvp/bin/supervisor-me status

# 9. 查看验证报告
echo ""
echo "📋 验证报告："
/Users/ouyanganran/dev/supervisor-me-mvp/bin/supervisor-me show-report -n 3

# 清理
echo ""
echo "🧹 清理测试目录..."
cd /
rm -rf "$TEST_DIR"

echo ""
echo "✅ 测试完成！"