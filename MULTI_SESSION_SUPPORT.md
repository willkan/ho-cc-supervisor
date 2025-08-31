# 🎯 Supervisor-ME 多 Session 支持完整实现

## 核心问题解决

原问题：同一个项目目录的多个 Claude worker 会监听/反馈冲突

**✅ 现已完全解决！**

## 实现方案

### 1. Session ID 获取链路（优先级从高到低）

```
1. Claude Code 官方 session_id
   └── Stop hook 从 JSON stdin 读取
   
2. Claude CLI 输出捕获
   └── supervisor-node 从 stdout 解析 JSON
   
3. 文件系统活跃检测
   └── 检测 5 分钟内活跃的 session
   
4. 环境变量传递
   └── SUPERVISOR_SESSION_ID
   
5. 生成新 UUID
   └── 兜底方案
```

### 2. 关键代码改进

#### A. Stop Hook 读取官方 Session ID
```bash
# .claude/hooks/stop.sh
# 读取 Claude Code 传递的 JSON 输入
if [ ! -t 0 ]; then
    input=$(cat)
    claude_session_id=$(echo "$input" | python3 -c "
        import sys, json
        data = json.load(sys.stdin)
        print(data.get('session_id', ''))
    " 2>/dev/null)
fi
```

#### B. Supervisor-node 动态捕获
```javascript
// bin/supervisor-node.js
captureSessionId(data) {
  const output = data.toString();
  // 从 stdout 解析 JSON 获取 session_id
  const json = JSON.parse(line);
  if (json.session_id) {
    this.realSessionId = json.session_id;
    this.updateIssuesFilePath(this.realSessionId);
  }
}
```

#### C. 活跃 Session 检测
```javascript
// 检测 5 分钟内活跃的 sessions
const activeSessions = files.filter(f => f.ageMinutes <= 5);
if (activeSessions.length === 1) {
  return activeSessions[0].name;
} else if (activeSessions.length > 1) {
  console.log('检测到多个活跃 session，使用最新的');
  return activeSessions[0].name;
}
```

### 3. 文件隔离结构

```
~/.supervisor-me/projects/<project>/
├── session-1.issues    # Worker 1 的问题文件
├── session-1.log       # Worker 1 的日志
├── session-2.issues    # Worker 2 的问题文件  
├── session-2.log       # Worker 2 的日志
└── supervisor.log      # 总体日志
```

## 使用场景

### 场景 1：自动检测
```bash
supervisor-node
# 自动检测并使用最活跃的 Claude session
```

### 场景 2：指定 Session
```bash
supervisor-node --session 02b1dee7-78cb-4a8a-981f-18961bb22f58
# 监听特定 session
```

### 场景 3：多 Worker 并行
```bash
# Terminal 1
supervisor-node --session session-1

# Terminal 2  
supervisor-node --session session-2

# 两个 worker 完全独立，互不干扰
```

## 技术亮点

1. **完全自动化** - 无需手动配置 session ID
2. **智能检测** - 自动识别活跃 session
3. **动态更新** - 捕获新 session 后自动切换监听
4. **完全隔离** - 每个 session 独立的验证和修复
5. **向后兼容** - 支持旧版本的兼容模式

## 借鉴的技术

从 ClaudeCodeUI 项目学习到的关键技术：

1. **CLI 输出解析** - Claude CLI 会输出包含 session_id 的 JSON
2. **文件系统监控** - 使用 chokidar 高效监控文件变化
3. **Session 保护机制** - 防止活跃对话期间的干扰
4. **智能路径提取** - 从 JSONL 文件提取真实项目路径

## 测试验证

```bash
# 查看当前项目的所有 sessions
ls -lt ~/.claude/projects/$(pwd | sed 's/\//\-/g' | sed 's/^-//')/*.jsonl

# 查看对应的 issues 文件
ls -la ~/.supervisor-me/projects/$(pwd | sed 's/\//\-/g' | sed 's/^-//')/*.issues

# 运行测试脚本
./test-multi-session.sh
```

## 总结

✅ **问题完全解决**：多个 Claude worker 现在可以在同一项目中并行工作，每个 session 完全独立，互不干扰。

✅ **自动化程度高**：系统能自动检测、捕获、更新 session ID，无需人工干预。

✅ **用户体验优秀**：透明代理 + 自动验证 + 智能修复，形成完整闭环。

---

*最后更新：2025-08-29*