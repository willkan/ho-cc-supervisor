#!/bin/bash

echo "============================================"
echo "🔄 测试完整的自动验证-修复循环"
echo "============================================"
echo

echo "📋 系统概述："
echo "  1. Worker Claude 完成任务"
echo "  2. Stop Hook 自动触发验证"
echo "  3. Supervisor Claude 分析代码"
echo "  4. 发现问题写入 issues 文件"
echo "  5. supervisor-node 检测到问题"
echo "  6. 自动注入修复命令给 Worker"
echo "  7. Worker 修复问题"
echo "  8. 循环继续直到无问题"
echo

echo "🚀 启动方式："
echo "  supervisor-node          # 自动检测当前 Claude session"
echo "  supervisor-node -p \"实现功能X\"  # 带参数启动"
echo "  supervisor-node --continue      # 继续上次对话"
echo

echo "📊 查看系统状态："
echo "  supervisor-me status            # 系统状态"
echo "  supervisor-me show-report       # 最新验证报告"
echo "  supervisor-me show-prompts      # Supervisor 提示历史"
echo "  supervisor-me list-sessions     # 所有 session"
echo

echo "🔍 日志位置："
echo "  logs/supervisor-me/completions/  # Stop hook 日志"
echo "  logs/supervisor-me/prompts/      # Supervisor 提示"
echo "  logs/supervisor-me/verifications/ # 验证结果"
echo

echo "📁 Session 文件对应关系："
echo "  Claude: ~/.claude/projects/<project>/<session-id>.jsonl"
echo "  Issues: ~/.supervisor-me/projects/<project>/<session-id>.issues"
echo

echo "============================================"
echo "测试参数透传："
echo

# 测试参数过滤
echo "1. supervisor-node --session abc -p \"test\" --debug"
echo "   → Claude 收到: -p \"test\" --debug"
echo "   → --session 被过滤（supervisor专用）"
echo

echo "2. supervisor-node --continue --model opus-4.1"
echo "   → Claude 收到: --continue --model opus-4.1"
echo "   → 所有参数都传递"
echo

echo "============================================"
echo "✅ 系统已就绪，可以开始使用了！"