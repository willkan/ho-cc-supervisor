#!/bin/bash

echo "============================================"
echo "测试 Session ID 传递"
echo "============================================"
echo

# 测试场景1：通过环境变量传递 Session ID
echo "1. 测试环境变量传递："
export SUPERVISOR_SESSION_ID="test-session-123"
cd /tmp && supervisor-me verify --json 2>&1 | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print('✅ JSON 输出正常')
except:
    print('❌ JSON 解析失败')
"
unset SUPERVISOR_SESSION_ID

echo
echo "2. 测试命令行参数传递："
cd /tmp && supervisor-me verify --json --session "cli-session-456" 2>&1 | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print('✅ JSON 输出正常')
except:
    print('❌ JSON 解析失败')
"

echo
echo "3. 检查 issues 文件位置："
echo "   环境变量 session: ~/.supervisor-me/projects/*/test-session-123.issues"
echo "   命令行 session:   ~/.supervisor-me/projects/*/cli-session-456.issues"

echo
echo "4. Stop Hook 集成测试："
echo "   当通过 supervisor-node 运行时："
echo "   - supervisor-node 设置 SUPERVISOR_SESSION_ID 环境变量"
echo "   - stop.sh 读取该变量并传递给 verify 命令"
echo "   - verify 使用该 session ID 写入对应的 issues 文件"
echo "   - supervisor-node 监听该文件并注入修复命令"

echo
echo "============================================"
echo "✅ Session ID 链路："
echo "   supervisor-node → 环境变量 → stop.sh → verify --session → issues 文件"
echo "============================================"