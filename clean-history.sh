#!/bin/bash

# 创建一个新的干净历史分支
git checkout -b clean-release main

# 获取第一个提交
FIRST_COMMIT=$(git rev-list --max-parents=0 HEAD)

# 软重置到第一个提交，保留所有更改
git reset --soft $FIRST_COMMIT

# 创建一个包含主要里程碑的提交
git commit -m "feat: ho-cc-supervisor v1.0.0

## 🚀 核心架构
- 初始 Supervisor-ME MVP 实现
- 从双窗口监控到 Hooks 验证方案架构转型  
- 透明代理架构 (Phase 6) 重构
- 品牌重塑为 ho-cc-supervisor

## ✨ 主要功能
- 智能监工系统，防止Claude偷懒
- Stop Hook 拦截和质量检查机制
- 零容忍错误政策执行
- 智能区分偷懒停顿和合理批准请求
- 动态session跟踪和自动问题修复
- 完整的国际化支持（中英文）
- 暂停/恢复监工功能
- 子目录自动向上查找规则

## 🛠 技术实现
- 验证提示模版系统
- checkedList调试功能
- pre-commit强制检查
- proxy success JSON提取
- GitHub Actions CI/CD

## 📚 文档
- 完善的中英文README
- ASCII流程图（npm兼容）
- 详细的监工规则模板

从80+个开发commits整理而成的稳定版本"

echo "✅ 创建了包含所有功能的单一提交"
echo "📝 如需查看原始开发历史，请访问 main 分支"