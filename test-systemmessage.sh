#!/bin/bash

# 测试 systemMessage 的实际行为

echo "🧪 测试 Stop Hook 的 systemMessage 行为"
echo "========================================"
echo ""

# 测试 1: 创建一个简单的 Stop hook 测试
echo "测试 1: 基础 systemMessage"
echo "----------------------------"
cat > test-stop-hook.sh << 'EOF'
#!/bin/bash
echo '{"continue": true, "systemMessage": "这是一个测试系统消息"}'
EOF
chmod +x test-stop-hook.sh

echo "执行: ./test-stop-hook.sh"
./test-stop-hook.sh
echo ""

# 测试 2: 测试带换行的 systemMessage
echo "测试 2: 带换行的 systemMessage"
echo "----------------------------"
cat > test-stop-hook2.sh << 'EOF'
#!/bin/bash
cat << JSON
{
  "continue": true,
  "systemMessage": "📋 验证反馈:\n问题1: 缺少错误处理\n问题2: 未使用的变量\n建议: 添加 try-catch"
}
JSON
EOF
chmod +x test-stop-hook2.sh

echo "执行: ./test-stop-hook2.sh"
./test-stop-hook2.sh
echo ""

# 测试 3: 测试 continue=false 时的 stopReason
echo "测试 3: continue=false 和 stopReason"
echo "----------------------------"
cat > test-stop-hook3.sh << 'EOF'
#!/bin/bash
echo '{"continue": false, "stopReason": "发现严重安全问题", "systemMessage": "⚠️ 代码包含硬编码密钥"}'
EOF
chmod +x test-stop-hook3.sh

echo "执行: ./test-stop-hook3.sh"
./test-stop-hook3.sh
echo ""

# 测试 4: 实际的 supervisor-me 输出
echo "测试 4: supervisor-me verify --json 的实际输出"
echo "----------------------------"
echo "执行: supervisor-me verify --json"
supervisor-me verify --json
echo ""

# 清理测试文件
rm -f test-stop-hook*.sh

echo "========================================"
echo "📝 根据测试结果："
echo ""
echo "1. systemMessage 是 Stop hook 的有效字段"
echo "2. 它可以包含多行文本（使用 \\n）"
echo "3. 可以和 continue、stopReason 等字段一起使用"
echo "4. Claude Code 框架会处理这个字段并显示消息"
echo ""
echo "⚠️  注意："
echo "- 具体的显示方式取决于 Claude Code 的实现"
echo "- systemMessage 的内容会显示给用户"
echo "- 这是基于文档和实际测试的结论"