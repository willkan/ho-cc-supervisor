#!/bin/bash

echo "============================================"
echo "测试 supervisor-node 参数透传"
echo "============================================"
echo

echo "1. 测试参数过滤："
echo "命令: supervisor-node --session abc123 -p \"test prompt\" --debug"
echo "期望: Claude 收到: -p \"test prompt\""
echo

echo "2. 常见 Claude 参数示例："
echo "  supervisor-node -p \"验证代码\"          # prompt 模式"
echo "  supervisor-node --continue              # 继续上次对话"
echo "  supervisor-node --model opus-4.1        # 指定模型"
echo "  supervisor-node --no-stream             # 禁用流式输出"
echo

echo "3. 混合使用示例："
echo "  supervisor-node --session <uuid> -p \"修复 bug\"  # 指定 session 并使用 prompt"
echo "  supervisor-node --debug --continue              # 调试模式并继续对话"
echo

echo "4. Worker 和 Supervisor 都可用的场景："
echo "  - Worker: supervisor-node -p \"实现功能 X\""
echo "  - Supervisor 验证: 内部会调用 claude -p \"验证完成度\""
echo "  - 两者都能正常接收 -p 参数"
echo

echo "============================================"
echo "实际测试（查看参数是否正确传递）："
echo

# 创建测试脚本模拟 claude 命令
cat > /tmp/test-claude.sh << 'EOF'
#!/bin/bash
echo "Claude 收到的参数: $@"
EOF
chmod +x /tmp/test-claude.sh

# 测试参数传递
echo "运行: PATH=/tmp:$PATH supervisor-node --session test123 -p \"hello\" --debug"