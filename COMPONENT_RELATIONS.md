# 🔗 Supervisor-ME 组件关联详解

## 一、核心关联机制

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       组件间关联方式总览                                   │
└──────────────────────────────────────────────────────────────────────────┘

1. Session ID        - 唯一标识每个会话，贯穿全流程
2. 环境变量          - 进程间传递配置信息
3. 文件系统          - 持久化状态和通信
4. PTY (伪终端)      - 透明代理输入输出
5. JSON 标准输入     - Hooks 接收事件数据
6. 进程通信          - 父子进程数据传递
```

## 二、详细关联图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         组件关联详细图                                        │
└─────────────────────────────────────────────────────────────────────────────┘

用户 (Human Developer)
    │
    │ [终端输入]
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ supervisor-node                                                              │
│                                                                              │
│  关联机制：                                                                   │
│  • PTY.spawn('claude', args) ────────[进程创建]──────► Worker Claude        │
│  • process.env 传递：                                                        │
│    - SUPERVISOR_SESSION_ID=<uuid>   ─[环境变量]──────► Hooks 可读取          │
│    - SUPERVISOR_ISSUES_FILE=<path>  ─[环境变量]──────► Stop hook 使用        │
│  • fs.watch(issues_file) ───────────[文件监听]──────► 检测问题文件变化        │
│  • ptyProcess.write(command) ───────[PTY写入]──────► 注入修复命令            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ [PTY 双向通道]
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Worker Claude                                                                │
│                                                                              │
│  接收来源：                                                                   │
│  • 用户输入 (通过 PTY)                                                        │
│  • 自动修复命令 (supervisor-node 注入)                                        │
│                                                                              │
│  输出目标：                                                                   │
│  • 终端显示 (通过 PTY)                                                        │
│  • Hooks 触发 (通过 Claude Code 内部机制)                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ [事件触发]
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Claude Code Hooks 系统                                                       │
│                                                                              │
│ ┌─────────────────────────────────────────────────────────────────────┐     │
│ │ SessionStart Hook                                                   │     │
│ │ 输入: JSON stdin { "session_id": "xxx", "matcher": "startup" }     │     │
│ │ 输出: 写入 ~/.supervisor-me/projects/<project>/active-session      │     │
│ │ 关联: session_id ──► active-session 文件                           │     │
│ └─────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│ ┌─────────────────────────────────────────────────────────────────────┐     │
│ │ Stop Hook                                                           │     │
│ │ 输入: JSON stdin { "session_id": "xxx", ... }                      │     │
│ │ 环境: $SUPERVISOR_SESSION_ID, $SUPERVISOR_ISSUES_FILE              │     │
│ │ 执行: supervisor-me verify --session <id>                          │     │
│ │ 输出: JSON { "continue": true, "systemMessage": "..." }            │     │
│ └─────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ [命令执行]
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ supervisor-me verify                                                         │
│                                                                              │
│  输入参数：                                                                   │
│  • --session <id>  (命令行参数或环境变量)                                     │
│  • --json         (输出格式)                                                 │
│                                                                              │
│  处理流程：                                                                   │
│  1. 启动 Supervisor Claude (claude -p 模式)                                  │
│  2. 传递验证提示词                                                           │
│  3. 解析验证结果                                                             │
│                                                                              │
│  输出：                                                                       │
│  • 如果有问题 ──[文件写入]──► ~/.supervisor-me/projects/<p>/<session>.issues │
│  • JSON 结果 ──[stdout]──► Stop Hook ──[事件结果]──► Claude Code            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ [文件写入]
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 文件系统状态                                                                  │
│                                                                              │
│ ~/.supervisor-me/projects/<project>/                                        │
│ ├── active-session          [SessionStart 写入，Stop hook 读取]             │
│ ├── <session-id>.issues     [verify 写入，supervisor-node 监听]             │
│ ├── <session-id>.log        [supervisor-node 写入]                          │
│ └── <session-id>.history    [supervisor-node 写入]                          │
│                                                                              │
│ 关联链路：                                                                    │
│ SessionStart ─写入─► active-session ─读取─► Stop hook                        │
│ Stop hook ─调用─► verify ─写入─► issues ─监听─► supervisor-node             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 三、Session ID 传递链路

```
Session ID 完整传递路径
======================

1. Claude Code 生成 session_id
           │
           ▼
2. SessionStart Hook 接收 (JSON stdin)
           │
           ├─► 写入 active-session 文件
           │
           ▼
3. Stop Hook 触发时
           │
           ├─► 从 JSON stdin 读取 session_id
           ├─► 或从 active-session 文件读取
           ├─► 或从环境变量 $SUPERVISOR_SESSION_ID 读取
           │
           ▼
4. 传递给 verify 命令 (--session 参数)
           │
           ▼
5. verify 写入对应的 issues 文件
   ~/.supervisor-me/projects/<project>/<session-id>.issues
           │
           ▼
6. supervisor-node 监听该文件
           │
           ├─► 检测到变化
           ├─► 读取问题内容
           └─► 注入修复命令
```

## 四、环境变量传递

```
环境变量流向图
=============

supervisor-node 进程
    │
    ├─► SUPERVISOR_SESSION_ID=<uuid>
    ├─► SUPERVISOR_ISSUES_FILE=<path>
    ├─► CLAUDE_PROJECT_DIR=<project_path>
    └─► 其他继承的环境变量
              │
              ▼ [进程继承]
        Worker Claude
              │
              ▼ [Hooks 继承]
         所有 Hooks
              │
              ├─► SessionStart Hook (可读取)
              ├─► Stop Hook (使用 SUPERVISOR_SESSION_ID)
              └─► 其他 Hooks (可用但未使用)
```

## 五、文件监听机制

```
文件监听和响应流程
=================

supervisor-node (fs.watch)
    │
    ├─► 监听目录: ~/.supervisor-me/projects/<project>/
    │
    ├─► 监听文件: <session-id>.issues
    │   │
    │   ├─► eventType: 'rename' (文件创建/删除)
    │   ├─► eventType: 'change' (内容修改)
    │   │
    │   ▼
    │   检查文件大小变化
    │   │
    │   ├─► 大小增加 → 有新问题
    │   ├─► 大小为0 → 问题已处理
    │   └─► 大小不变 → 忽略
    │
    └─► 触发动作:
        │
        ├─► 读取问题内容
        ├─► 检测 Claude 空闲状态
        └─► 注入修复命令 (ptyProcess.write)
```

## 六、数据格式规范

```yaml
# SessionStart Hook 输入
{
  "session_id": "uuid-format-string",
  "transcript_path": "/path/to/transcript",
  "matcher": "startup|resume|clear",
  "cwd": "/current/working/directory"
}

# Stop Hook 输入
{
  "session_id": "uuid-format-string",
  "stop_hook_active": true,
  "transcript_path": "/path/to/transcript"
}

# verify 命令输出 (JSON)
{
  "continue": true,
  "systemMessage": "验证反馈内容..."
}

# Issues 文件格式
🔧 发现以下问题需要修复:

[问题描述]
[建议修复方案]

请根据上述反馈修复代码问题。
```

## 七、关键关联点总结

| 组件A | 关联机制 | 组件B | 数据内容 |
|------|---------|-------|---------|
| supervisor-node | PTY spawn | Worker Claude | 进程创建和控制 |
| supervisor-node | 环境变量 | Hooks | SESSION_ID, ISSUES_FILE |
| Worker Claude | 事件触发 | Hooks | JSON 事件数据 |
| SessionStart | 文件写入 | active-session | 当前 session ID |
| Stop Hook | 命令执行 | verify | session 参数 |
| verify | 文件写入 | issues 文件 | 验证问题 |
| supervisor-node | fs.watch | issues 文件 | 文件变化事件 |
| supervisor-node | PTY write | Worker Claude | 修复命令注入 |

---

*这是完整的组件关联关系图，每个箭头都标注了具体的关联机制*