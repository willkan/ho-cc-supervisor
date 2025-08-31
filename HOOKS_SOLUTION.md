# Supervisor-ME 双 Claude 智能验证方案

## 设计理念

### 核心认知
1. **ESC = 用户控制**：用户中断是主动选择，不需要验证
2. **完成 = 需要验证**：只有 Claude 认为完成的任务才验证
3. **帮助 > 监督**：我们是助手，不是监工
4. **智能 > 模式**：使用第二个 Claude 理解任务，不依赖固定模式

## 架构设计

```yaml
项目结构:
supervisor-me-mvp/
├── .claude/
│   ├── settings.json           # 项目级 hooks 配置
│   └── hooks/
│       ├── stop.sh             # Claude 完成任务时触发验证
│       ├── post-tool-use.sh    # 工具使用后快速检查
│       └── user-prompt-submit.sh # 记录用户意图
├── lib/
│   ├── claude-verify-simple.js # 🌟 双 Claude 验证器核心
│   ├── verify-completion.js    # 备用：模式匹配验证
│   ├── quick-check.js          # PostToolUse 的检查逻辑
│   ├── project-analyzer.js     # 项目分析
│   └── inquiry-generator.js    # 智能提问
└── logs/
    ├── completions/            # 完成验证日志
    ├── checks/                 # 快速检查日志
    └── intents/                # 用户意图日志
```

## Hook 实现细节

### 1. Stop Hook - 双 Claude 验证
```javascript
// lib/claude-verify-simple.js
class SimpleClaudeVerifier {
    async verify() {
        // 1. 收集上下文信息
        const context = this.gatherContext();
        
        // 2. 构建验证提示
        const prompt = this.buildPrompt(context);
        
        // 3. 使用 claude -p 调用第二个 Claude
        const result = await this.runClaudePrompt(prompt);
        
        // 4. 返回结果给 Worker Claude
        return result;
    }
    
    async runClaudePrompt(prompt) {
        // 继承 Worker Claude 的参数
        const workerArgs = process.argv.slice(2)
            .filter(arg => arg.startsWith('--'))
            .join(' ');
        
        // 使用 claude -p 模式执行验证
        const cmd = `CLAUDE_VERIFIER_MODE=true claude ${workerArgs} -p "${prompt}"`;
        
        // 执行并解析结果
        const output = execSync(cmd, {
            cwd: this.projectRoot,
            encoding: 'utf-8',
            timeout: 30000
        });
        
        return this.parseOutput(output);
    }
}
```

### 2. PostToolUse Hook - 快速检查
```javascript
// lib/quick-check.js
class QuickChecker {
    async check(toolName, filePath) {
        // 只对写入操作进行检查
        if (!['Write', 'Edit', 'MultiEdit'].includes(toolName)) {
            return;
        }
        
        // 快速语法检查
        const errors = await this.syntaxCheck(filePath);
        
        // 只在有严重问题时提醒
        if (errors.critical.length > 0) {
            console.log(`
⚠️  语法检查发现问题：
${errors.critical.map(e => `  ${e.file}:${e.line} - ${e.message}`).join('\n')}
            `);
        }
    }
}
```

### 3. UserPromptSubmit Hook - 意图记录
```javascript
// lib/intent-logger.js
class IntentLogger {
    async log(userPrompt) {
        // 记录用户意图用于学习
        const intent = {
            timestamp: new Date(),
            prompt: userPrompt,
            context: await this.getCurrentContext(),
            wasInterrupted: this.checkIfPreviousWasInterrupted()
        };
        
        // 写入日志用于后续分析
        await this.saveIntent(intent);
        
        // 如果是 ESC 后的新指令，记录切换模式
        if (intent.wasInterrupted) {
            await this.logTaskSwitch(intent);
        }
    }
}
```

## 双 Claude 验证策略

### Verifier Claude 的验证提示
```javascript
// 构建给 Verifier Claude 的提示
buildPrompt(context) {
    const filesInfo = context.recentFiles.length > 0 
        ? `最近修改的文件:\n${context.recentFiles.map(f => `- ${f}`).join('\n')}`
        : '没有检测到最近修改的文件';
    
    const prompt = `分析刚刚完成的编程任务并验证其质量。

${filesInfo}

请执行以下验证步骤:
1. 如果有新创建或修改的代码文件，检查语法是否正确
2. 如果项目有测试(package.json中有test脚本)，考虑是否需要运行测试
3. 评估任务是否真正完成

请用简洁的方式回答:
- 验证结果: 通过/失败
- 如果失败，列出主要问题(最多3个)
- 如果失败，给出一个简单的修复建议

注意：回复要简洁，不要解释过程。`;
    
    return prompt;
}
```

### 智能验证优势
```yaml
传统模式匹配:
  - 固定规则，容易误判
  - 无法理解上下文
  - 难以适应新场景

双 Claude 验证:
  - 理解任务上下文
  - 自然语言判断
  - 灵活适应各种场景
  - 提供智能建议
```

## 配置文件

### .claude/settings.json
```json
{
  "hooks": {
    "Stop": ".claude/hooks/stop.sh",
    "PostToolUse": {
      "Write": ".claude/hooks/post-tool.sh",
      "Edit": ".claude/hooks/post-tool.sh",
      "MultiEdit": ".claude/hooks/post-tool.sh"
    },
    "UserPromptSubmit": ".claude/hooks/log-intent.sh"
  }
}
```

### Hook 脚本实现
```bash
#!/bin/bash
# .claude/hooks/stop.sh
# Stop Hook - 双 Claude 智能验证

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs/completions"

# 创建日志目录
mkdir -p "$LOG_DIR"

# 检查是否是验证 Claude（避免循环）
if [ "$CLAUDE_VERIFIER_MODE" = "true" ]; then
    echo "  [跳过] 验证 Claude 不触发验证" >> "$LOG_DIR/stop.log"
    exit 0
fi

# 使用智能 Claude 验证（claude -p 模式）
if [ -f "$PROJECT_ROOT/lib/claude-verify-simple.js" ]; then
    echo "🤖 启动 Claude 智能验证 (claude -p 模式)..." >> "$LOG_DIR/stop.log"
    
    # 运行验证并显示结果
    node "$PROJECT_ROOT/lib/claude-verify-simple.js" \
      --session-id="${CLAUDE_SESSION_ID:-unknown}" \
      --transcript="${CLAUDE_TRANSCRIPT_PATH:-}" \
      --project-root="$PROJECT_ROOT"
fi

# 返回 0 表示成功（不阻塞 Claude）
exit 0
```

## 用户体验

### 正常完成场景
```
用户: 帮我创建一个登录页面
Worker Claude: [创建文件，编写代码...]
Worker Claude: ✨ 登录页面创建完成！

[Stop Hook 触发 → Verifier Claude 验证]

📋 验证 Claude 反馈:
   验证结果: 通过，登录页面创建成功，语法正确，功能完整
```

### ESC 中断场景
```
用户: 帮我重构整个项目
Claude: [开始重构...]
用户: [按 ESC]
Claude: [停止]

[无 Hook 触发 - 这是正确的行为]

用户: 先修复这个 bug 吧
[UserPromptSubmit 记录任务切换]
Claude: [开始修复 bug...]
```

### 发现问题场景
```
用户: 修复登录验证的 bug
Worker Claude: [修改代码...]
Worker Claude: ✨ Bug 修复完成！

[Stop Hook 触发 → Verifier Claude 验证]

📋 验证 Claude 反馈:
   验证结果: 失败
   主要问题: 1) auth.test.js 测试失败 2) 边界条件未处理
   修复建议: 检查空值处理逻辑，运行 npm test 查看详细错误
   ⚠️  建议检查并修复问题
```

## 实施步骤

### Phase 1: 基础实现（已完成）✅
1. ✅ 更新架构文档
2. ✅ 创建基础 hook 脚本
3. ✅ 实现 claude-verify-simple.js（双 Claude 验证）
4. ✅ 测试环境变量防循环机制

### Phase 2: 当前状态
1. ✅ 使用 claude -p 模式实现智能验证
2. ✅ 继承 Worker Claude 参数
3. ✅ 结果返回给 Worker Claude 显示
4. ✅ 30秒超时处理

### Phase 3: 后续优化
1. 优化验证提示词
2. 根据项目类型调整验证策略
3. 收集验证反馈优化准确率
4. 支持更多编程语言和框架

## 优势总结

1. **智能化**：使用第二个 Claude 理解并验证，不依赖固定模式
2. **精准**：只在任务完成时验证，ESC中断不触发
3. **快速**：claude -p 模式 30秒内返回结果
4. **非侵入**：通过 Hooks 集成，不改变使用习惯
5. **防循环**：CLAUDE_VERIFIER_MODE 环境变量避免无限验证
6. **参数继承**：Verifier Claude 使用相同的模型和参数

## 核心实现文件

### 主要验证器
- `claude-verify-simple.js` - 🌟 双 Claude 验证器核心实现
  - 使用 claude -p 模式调用第二个 Claude
  - 收集上下文并构建验证提示
  - 解析结果返回给 Worker Claude

### Hook 脚本
- `.claude/hooks/stop.sh` - Stop hook 处理脚本
- `.claude/hooks/post-tool-use.sh` - 文件修改后检查
- `.claude/hooks/user-prompt-submit.sh` - 用户意图记录

### 辅助模块
- `verify-completion.js` - 备用模式匹配验证
- `quick-check.js` - 语法快速检查
- `project-analyzer.js` - 项目结构分析
- `inquiry-generator.js` - 智能问题生成

## 技术细节

### 环境变量
```bash
CLAUDE_VERIFIER_MODE=true  # 标记验证 Claude，防止循环
NODE_NO_WARNINGS=1         # 抑制 Node.js 警告
```

### 命令构建
```javascript
// 继承参数并添加环境变量
const cmd = `NODE_NO_WARNINGS=1 CLAUDE_VERIFIER_MODE=true claude ${workerArgs} -p "${escapedPrompt}"`;
```