# 全自动验证修复系统 - 技术设计方案

## 一、核心架构

### 1.1 问题本质
- Claude Code 只接受来自 stdin 的输入
- Hooks 的 systemMessage 只能显示，不能作为新输入
- 需要在输入层面实现多路复用

### 1.2 解决思路：PTY 输入代理

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   用户      │────>│   PTY Master    │────>│ Claude Code  │
└─────────────┘     │  (输入代理器)   │     │  (Worker)    │
                    │                 │     └──────────────┘
┌─────────────┐     │                 │            │
│ Supervisor  │────>│  - 输入队列     │            │
│   Claude    │     │  - 优先级管理   │            ▼
└─────────────┘     │  - 冲突检测     │     ┌──────────────┐
      ▲             └─────────────────┘     │    Hooks     │
      │                                     │  (验证系统)   │
      └─────────────────────────────────────└──────────────┘
                    反馈问题
```

## 二、实现方案

### 2.1 方案A：Node.js PTY 包装器（推荐）

```javascript
// supervisor-wrapper.js
const pty = require('node-pty');
const readline = require('readline');

class ClaudeCodeSupervisor {
  constructor() {
    // 创建 PTY 运行 Claude Code
    this.pty = pty.spawn('claude', [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env
    });
    
    this.inputQueue = [];
    this.isProcessing = false;
    this.supervisorMode = false;
  }
  
  // 处理用户输入
  handleUserInput(data) {
    if (!this.supervisorMode) {
      this.pty.write(data);
    } else {
      this.inputQueue.push({ type: 'user', data });
    }
  }
  
  // 处理 Supervisor 输入
  handleSupervisorInput(instruction) {
    this.supervisorMode = true;
    this.inputQueue.push({ 
      type: 'supervisor', 
      data: instruction,
      priority: 'high'
    });
    this.processQueue();
  }
  
  // 监听验证结果
  listenForIssues() {
    // 监控特定文件或 socket
    fs.watch('/tmp/claude-issues', (event) => {
      if (event === 'change') {
        const issues = fs.readFileSync('/tmp/claude-issues', 'utf-8');
        const fixInstruction = this.generateFixInstruction(issues);
        this.handleSupervisorInput(fixInstruction);
      }
    });
  }
  
  // 生成修复指令
  generateFixInstruction(issues) {
    // 使用另一个 Claude 实例分析问题并生成修复指令
    return `请修复以下问题：\n${issues}\n`;
  }
}
```

### 2.2 方案B：Bash 脚本 + 命名管道（FIFO）

```bash
#!/bin/bash
# supervisor-me.sh

# 创建命名管道
FIFO_USER="/tmp/claude-user-input"
FIFO_SUPERVISOR="/tmp/claude-supervisor-input"
FIFO_MERGED="/tmp/claude-merged-input"

mkfifo $FIFO_USER $FIFO_SUPERVISOR $FIFO_MERGED 2>/dev/null

# 输入合并器（后台运行）
merge_inputs() {
  while true; do
    # 优先处理 supervisor 输入
    if read -t 0.1 line <$FIFO_SUPERVISOR; then
      echo "[SUPERVISOR] $line" >>$FIFO_MERGED
    elif read -t 0.1 line <$FIFO_USER; then
      echo "$line" >>$FIFO_MERGED
    fi
  done
}

# 启动 Claude Code，输入来自合并管道
run_claude() {
  claude <$FIFO_MERGED
}

# Supervisor 监控器
supervisor_monitor() {
  while true; do
    if [ -f /tmp/claude-issues ]; then
      # 分析问题
      issues=$(cat /tmp/claude-issues)
      
      # 生成修复指令
      fix_instruction=$(echo "$issues" | generate_fix_instruction)
      
      # 发送到 supervisor 管道
      echo "$fix_instruction" >$FIFO_SUPERVISOR
      
      rm /tmp/claude-issues
    fi
    sleep 1
  done
}

# 启动所有组件
merge_inputs &
supervisor_monitor &
run_claude
```

### 2.3 方案C：Python 异步架构（最强大）

```python
# supervisor_me.py
import asyncio
import pexpect
from queue import PriorityQueue
import json

class SupervisorMe:
    def __init__(self):
        self.claude = pexpect.spawn('claude')
        self.input_queue = PriorityQueue()
        self.is_fixing = False
        
    async def user_input_handler(self):
        """处理用户输入"""
        while True:
            user_input = await asyncio.get_event_loop().run_in_executor(
                None, input, ""
            )
            if not self.is_fixing:
                self.claude.sendline(user_input)
            else:
                # 暂存用户输入
                self.input_queue.put((2, 'user', user_input))
    
    async def supervisor_handler(self):
        """处理验证反馈"""
        while True:
            # 监控问题文件
            issues = await self.check_for_issues()
            if issues:
                self.is_fixing = True
                fix_instruction = await self.generate_fix(issues)
                
                # 高优先级插入
                self.input_queue.put((1, 'supervisor', fix_instruction))
                await self.process_queue()
    
    async def generate_fix(self, issues):
        """使用 Claude API 生成修复指令"""
        # 调用 Claude API 分析问题
        prompt = f"""
        作为 Supervisor，分析以下问题并生成修复指令：
        {issues}
        
        生成简洁的修复命令给 Worker Claude。
        """
        # 返回修复指令
        return fix_instruction
    
    async def process_queue(self):
        """处理输入队列"""
        while not self.input_queue.empty():
            priority, source, instruction = self.input_queue.get()
            
            if source == 'supervisor':
                # 添加标记让 Worker 知道这是自动修复
                self.claude.sendline(f"[自动修复] {instruction}")
                
                # 等待修复完成
                await self.wait_for_completion()
                self.is_fixing = False
            else:
                self.claude.sendline(instruction)
```

## 三、关键技术点

### 3.1 输入冲突管理
```python
class InputConflictResolver:
    def resolve(self, user_input, supervisor_input):
        # 1. 如果正在修复，暂存用户输入
        # 2. 如果用户正在输入，等待完成后插入
        # 3. 使用优先级队列管理
        pass
```

### 3.2 状态检测
```python
class ClaudeStateDetector:
    def is_idle(self):
        # 检测 Claude 是否空闲
        # 通过输出模式判断
        pass
    
    def is_waiting_input(self):
        # 检测是否在等待输入
        pass
```

### 3.3 验证触发器
```bash
# 在 stop hook 中
if [ "$has_issues" = true ]; then
  # 写入问题文件，触发 supervisor
  echo "$issues" > /tmp/claude-issues
  
  # 可选：发送信号
  kill -USR1 $SUPERVISOR_PID
fi
```

## 四、部署步骤

### 4.1 安装依赖
```bash
# Node.js 方案
npm install node-pty

# Python 方案
pip install pexpect asyncio
```

### 4.2 启动命令
```bash
# 替代原来的 claude 命令
alias claude='node ~/supervisor-me/supervisor-wrapper.js'

# 或使用 Python 版本
alias claude='python ~/supervisor-me/supervisor_me.py'
```

### 4.3 配置 Hooks
```bash
# .claude/hooks/stop.sh
#!/bin/bash
# ... 验证逻辑 ...

if [ "$has_issues" = true ]; then
  # 触发 supervisor
  echo "$issues" > /tmp/claude-issues
fi
```

## 五、优势对比

| 方案 | 优势 | 劣势 | 适用场景 |
|------|------|------|----------|
| Node.js PTY | 跨平台、易扩展 | 需要 Node 环境 | 通用开发 |
| Bash FIFO | 轻量、原生 | 仅 Unix/Linux | 快速原型 |
| Python 异步 | 功能强大、可扩展 | 复杂度较高 | 企业级应用 |

## 六、预期效果

1. **完全自动化**：无需人工干预的验证-修复循环
2. **智能优先级**：Supervisor 修复优先于用户新任务
3. **透明操作**：用户可以看到自动修复过程
4. **可中断性**：用户可以随时接管控制

## 七、实现挑战

1. **同步问题**：确保修复指令在正确时机注入
2. **死循环预防**：避免修复导致新问题的无限循环
3. **上下文保持**：确保 Worker Claude 理解修复上下文
4. **性能开销**：PTY 代理可能引入延迟

## 八、下一步行动

1. 选择实现方案（推荐 Node.js PTY）
2. 实现核心输入代理器
3. 集成现有验证系统
4. 测试自动修复循环
5. 优化和调试

这个方案可以真正实现你想要的**全自动验证修复系统**！