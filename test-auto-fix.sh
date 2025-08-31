#!/bin/bash

# 测试 Node.js 自动修复功能

echo "========================================="
echo "测试 supervisor-node 自动修复功能"
echo "========================================="

# 清理旧文件
rm -f /tmp/claude-issues /tmp/supervisor-node.log

echo ""
echo "1. 模拟验证发现问题..."
cat > /tmp/claude-issues <<'EOF'
📋 验证反馈:
  说明: 发现代码质量问题
  问题: 
    1. TypeError: Cannot read property 'id' of undefined at auth.service.ts:42
    2. ESLint 错误：Missing semicolon at line 15
    3. 测试失败：3 个测试用例未通过
  建议: 
    1. 检查 auth.service.ts 中的空值处理
    2. 运行 npm run lint:fix 修复格式问题  
    3. 修复失败的测试用例
  ❌ 代码质量需要改进
EOF

echo "✅ 问题文件已创建: /tmp/claude-issues"
echo ""
echo "2. 查看生成的问题内容:"
echo "----------------------------------------"
cat /tmp/claude-issues
echo "----------------------------------------"

echo ""
echo "3. 监控日志文件 (等待 supervisor-node 处理)..."
echo ""
echo "请在另一个终端运行: supervisor-node"
echo "然后观察自动修复是否触发"
echo ""
echo "监控日志: tail -f /tmp/supervisor-node.log"
echo ""
echo "按 Ctrl+C 退出"

# 监控日志
tail -f /tmp/supervisor-node.log 2>/dev/null || echo "等待 supervisor-node 启动..."