# Supervisor-ME 项目状态

## 🎯 当前版本：双 Claude 智能验证系统

### 核心架构
本项目已从原来的"双窗口监控"和"文件轮询"方案升级为基于 Claude Code Hooks 的双 Claude 智能验证系统。

### 主要特性
- **双 Claude 协作**：Worker Claude 执行任务，Verifier Claude 智能验证
- **自然语言理解**：不依赖固定模式，真正理解任务完成度
- **精准触发**：仅在任务完成时验证，ESC中断不触发
- **快速响应**：使用 claude -p 模式，30秒内返回结果

### 文件结构
```
supervisor-me-mvp/
├── .claude/                 # Hooks 配置
│   ├── settings.json       # 项目级配置
│   └── hooks/              # Hook 脚本
├── lib/                    # 核心实现
│   ├── claude-verify-simple.js  # 双 Claude 验证器
│   ├── verify-completion.js     # 备用验证器
│   ├── quick-check.js           # 语法检查
│   └── project-analyzer.js      # 项目分析
├── logs/                   # 运行日志
├── archive/                # 归档的旧实现
│   ├── old-docs/          # 旧文档
│   ├── old-scripts/       # 旧脚本
│   └── old-implementations/  # 旧代码
└── docs/                   # 当前文档
    ├── README.md          # 项目概览
    ├── ARCHITECTURE_COMPARISON.md  # 架构对比
    ├── HOOKS_SOLUTION.md  # 实现细节
    └── USAGE_GUIDE.md     # 使用指南
```

### 使用方法
1. 复制 `.claude` 和 `lib` 目录到你的项目
2. 启动 Claude Code
3. 正常工作，验证会自动运行

### 设计理念
**"验证完成，而非监督过程"** - 我们相信用户的判断，只在任务完成时提供智能验证帮助。

### 历史版本
- v1.0: 双窗口文件监控（已归档）
- v2.0: 透明代理监控（已归档）
- v3.0: 当前版本 - 双 Claude Hooks 验证

### 维护状态
✅ 活跃维护中

## 🆕 最新改进（2025-08-29）

### 完整的多 Session 支持
**问题解决**：同一项目的多个 Claude worker 不再冲突！

关键改进：
- **自动 Session 检测**：智能识别 5 分钟内活跃的 session
- **动态 Session 捕获**：从 Claude 输出实时捕获真实 session ID  
- **官方 Session 支持**：Stop hook 读取 Claude Code 官方 session_id
- **完全隔离**：每个 session 独立的 issues 文件和日志

使用方式：
```bash
# 自动检测活跃 session
supervisor-node

# 指定特定 session
supervisor-node --session <uuid>

# 多 worker 并行（不同终端）
supervisor-node --session session-1
supervisor-node --session session-2
```

### Session ID 与 Claude 完全一致
现在 supervisor-node 使用与 Claude 完全一致的 session ID：

```
Claude 结构:
~/.claude/projects/-Users-ouyanganran-dev-supervisor-me-mvp/
├── 0233f70a-67e3-4043-9bbf-68b5b6e7449e.jsonl  # Session 1
└── 093e5932-41b7-4035-bd73-76b7a5d32909.jsonl  # Session 2

Supervisor 结构（一一对应）:
~/.supervisor-me/projects/-Users-ouyanganran-dev-supervisor-me-mvp/
├── 0233f70a-67e3-4043-9bbf-68b5b6e7449e.issues   # 对应 Session 1
└── 093e5932-41b7-4035-bd73-76b7a5d32909.issues   # 对应 Session 2
```

### 自动检测 Claude Session
```bash
# 自动检测当前 Claude session
supervisor-node

# 指定特定的 Claude session
supervisor-node --session 0233f70a-67e3-4043-9bbf-68b5b6e7449e
```

### 性能优化
- **文件监听替代轮询**：CPU 占用从持续降到几乎为零
- **支持追加模式**：问题文件可以追加内容
- **多 Session 隔离**：每个 session 独立文件

### 改进的日志系统
- `supervisor-me show-report --latest` 显示完整验证内容
- `supervisor-me show-report --detailed` 显示详细历史
- 每次验证保存独立的 `verification-*.log` 文件