#!/bin/bash

echo "============================================"
echo "🔄 测试多 Session 支持"
echo "============================================"
echo

echo "📋 核心改进："
echo "1. 自动检测活跃的 Claude session"
echo "2. 从 Claude 输出捕获真实 session ID"
echo "3. 动态更新监听的 issues 文件路径"
echo "4. Stop hook 使用 Claude 官方 session ID"
echo

echo "🎯 Session ID 获取优先级："
echo "1. Claude Code 官方 session_id (从 JSON 输入)"
echo "2. Claude CLI 输出的 session_id (从 stdout)"
echo "3. 文件系统检测的最新 session"
echo "4. supervisor-node 环境变量"
echo "5. 生成新的 UUID"
echo

echo "============================================"
echo "🧪 测试场景："
echo

echo "场景 1: 同一项目多个 Claude session"
echo "  - Worker A: claude (session-1)"
echo "  - Worker B: claude (session-2)"
echo "  - 每个 session 独立的 issues 文件"
echo "  - 验证结果写入对应的 session issues 文件"
echo

echo "场景 2: supervisor-node 动态 session 检测"
echo "  - 启动 supervisor-node（无指定 session）"
echo "  - 自动检测最活跃的 session（5分钟内）"
echo "  - 从 Claude 输出捕获真实 session ID"
echo "  - 动态切换到正确的 issues 文件"
echo

echo "场景 3: 手动指定 session"
echo "  - supervisor-node --session <id>"
echo "  - 监听指定 session 的 issues 文件"
echo

echo "============================================"
echo "📁 文件结构："
echo
echo "~/.claude/projects/<project>/"
echo "├── session-1.jsonl          # Claude session 1"
echo "├── session-2.jsonl          # Claude session 2"
echo "└── session-3.jsonl          # Claude session 3"
echo
echo "~/.supervisor-me/projects/<project>/"
echo "├── session-1.issues         # Session 1 的问题"
echo "├── session-1.log           # Session 1 的日志"
echo "├── session-2.issues        # Session 2 的问题"
echo "├── session-2.log          # Session 2 的日志"
echo "└── supervisor.log          # 总体日志"
echo

echo "============================================"
echo "🔍 监控多个 session 的方法："
echo

echo "方法 1: 为每个 session 启动独立的 supervisor-node"
echo "  terminal1: supervisor-node --session session-1"
echo "  terminal2: supervisor-node --session session-2"
echo

echo "方法 2: 使用活跃 session 自动检测"
echo "  supervisor-node  # 自动选择最活跃的 session"
echo

echo "============================================"
echo "✅ 优势："
echo "  - 完全隔离不同 session 的验证和修复"
echo "  - 支持并行开发，互不干扰"
echo "  - 自动匹配正确的 session"
echo "  - 防止跨 session 的错误注入"
echo

echo "============================================"
echo "🚀 快速测试命令："
echo

# 显示当前项目的所有 Claude sessions
PROJECT_NAME=$(pwd | sed 's/\//\-/g' | sed 's/^-//')
CLAUDE_DIR="$HOME/.claude/projects/$PROJECT_NAME"

if [ -d "$CLAUDE_DIR" ]; then
    echo "当前项目的 Claude sessions:"
    ls -lt "$CLAUDE_DIR"/*.jsonl 2>/dev/null | head -5 | while read line; do
        file=$(echo "$line" | awk '{print $NF}')
        basename=$(basename "$file" .jsonl)
        age=$(echo "$line" | awk '{print $6, $7, $8}')
        echo "  • $basename (最后更新: $age)"
    done
else
    echo "  （未找到 Claude sessions）"
fi

echo
echo "============================================"