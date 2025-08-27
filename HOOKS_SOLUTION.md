# Supervisor-ME 简化方案：基于 Hooks 的智能验证

## 设计理念

### 核心认知
1. **ESC = 用户控制**：用户中断是主动选择，不需要验证
2. **完成 = 需要验证**：只有 Claude 认为完成的任务才验证
3. **帮助 > 监督**：我们是助手，不是监工

## 架构设计

```yaml
项目结构:
supervisor-me-mvp/
├── .claude/
│   ├── settings.json      # 项目级 hooks 配置
│   └── hooks/
│       ├── stop.sh         # Claude 完成任务时验证
│       ├── post-tool.sh    # 工具使用后快速检查
│       └── log-intent.sh   # 记录用户意图
├── lib/
│   ├── verify-completion.js  # Stop hook 的验证逻辑
│   ├── quick-check.js        # PostToolUse 的检查逻辑
│   ├── intent-logger.js      # UserPromptSubmit 的记录逻辑
│   ├── project-analyzer.js   # [复用] 项目分析
│   └── inquiry-generator.js  # [复用] 智能提问
└── logs/
    ├── completions/         # 完成验证日志
    ├── checks/             # 快速检查日志
    └── intents/            # 用户意图日志
```

## Hook 实现细节

### 1. Stop Hook - 完成验证
```javascript
// lib/verify-completion.js
class CompletionVerifier {
    async verify(hookData) {
        // 1. 分析 Claude 完成了什么任务
        const taskType = this.detectTaskType(hookData);
        
        // 2. 根据任务类型选择验证策略
        const strategy = this.getVerificationStrategy(taskType);
        
        // 3. 执行验证
        const results = await strategy.verify();
        
        // 4. 生成友好的反馈
        if (!results.success) {
            console.log(`
⚠️  验证发现一些问题：
${results.issues.map(i => `  • ${i}`).join('\n')}

💡 建议：${results.suggestion}
            `);
        } else {
            console.log('✅ 任务验证通过！');
        }
    }
    
    getVerificationStrategy(taskType) {
        const strategies = {
            'file-creation': new FileVerificationStrategy(),
            'test-execution': new TestVerificationStrategy(),
            'refactoring': new RefactoringVerificationStrategy(),
            'bug-fix': new BugFixVerificationStrategy()
        };
        return strategies[taskType] || new BasicVerificationStrategy();
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

## 验证策略

### 文件创建验证
```yaml
检查项:
  - 文件是否存在
  - 文件内容是否符合预期格式
  - 语法是否正确（针对代码文件）
  - 是否有明显的安全问题
```

### 测试执行验证
```yaml
检查项:
  - 测试是否真的运行了
  - 是否有失败的测试
  - 代码覆盖率是否下降
  - 是否引入新的 lint 错误
```

### 重构验证
```yaml
检查项:
  - 功能是否保持不变（测试通过）
  - 性能是否有退化
  - 代码质量指标（复杂度、重复度）
```

### Bug 修复验证
```yaml
检查项:
  - 原始问题是否解决
  - 是否引入新问题（回归测试）
  - 修复是否有测试覆盖
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

### Hook 脚本示例
```bash
#!/bin/bash
# .claude/hooks/stop.sh
# Claude 完成任务时的验证

# 获取项目根目录
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$0")")")"

# 运行验证
node "$PROJECT_ROOT/lib/verify-completion.js" \
  --session-id="$CLAUDE_SESSION_ID" \
  --transcript="$CLAUDE_TRANSCRIPT_PATH" \
  --project-root="$PROJECT_ROOT"

# 返回状态（0=成功，非0=建议但不阻止）
exit 0
```

## 用户体验

### 正常完成场景
```
用户: 帮我创建一个登录页面
Claude: [创建文件，编写代码...]
Claude: ✨ 登录页面创建完成！

[Stop Hook 触发]
✅ 验证通过：
  • login.html 创建成功
  • 语法检查通过
  • 表单验证逻辑完整
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
Claude: [修改代码...]
Claude: ✨ Bug 修复完成！

[Stop Hook 触发]
⚠️ 验证发现一些问题：
  • 测试 auth.test.js 失败：期望 true 得到 false
  • 可能遗漏了边界条件检查

💡 建议：运行 npm test 查看详细错误
```

## 实施步骤

### Phase 1: 基础实现（1-2天）
1. ✅ 更新架构文档
2. 创建基础 hook 脚本
3. 实现 Stop hook 验证逻辑
4. 测试基本场景

### Phase 2: 智能化（3-5天）
1. 实现任务类型识别
2. 开发不同的验证策略
3. 优化反馈信息
4. 性能优化

### Phase 3: 学习优化（持续）
1. 分析用户意图日志
2. 优化验证规则
3. 减少误报
4. 提升用户体验

## 优势总结

1. **简单**：不需要双窗口，不需要文件轮询
2. **精准**：只在需要时验证，不过度干扰
3. **智能**：根据任务类型选择合适的验证策略
4. **友好**：反馈信息清晰，建议而非强制
5. **可扩展**：易于添加新的验证策略

## 与现有代码的关系

### 可复用的模块
- `project-analyzer.js` - 项目分析能力
- `inquiry-generator.js` - 智能提问生成

### 需要归档的模块
- `session-monitor.js` - 文件监控方案
- `worker-wrapper.js` - 双窗口包装器
- `mock-claude.js` - 测试用 mock

### 全新开发的模块
- `verify-completion.js` - Stop hook 验证
- `quick-check.js` - PostToolUse 检查
- `intent-logger.js` - 用户意图记录