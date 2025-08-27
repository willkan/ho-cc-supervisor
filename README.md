# Supervisor-ME：智能验证系统 for Claude Code

> 基于 Hooks 的轻量级智能验证系统，让 Claude Code 更可靠

## 🎯 核心理念

**"验证完成，而非监督过程"**

- ✅ 当 Claude 说"完成了"，我们验证质量
- ❌ 当用户按 ESC 中断，我们不干预（用户在控制）
- 💡 提供建议而非强制，辅助而非监督

## 🚀 快速开始

### 1. 克隆项目到你的工作目录

```bash
git clone https://github.com/yourusername/supervisor-me-mvp.git
cd your-project
```

### 2. 复制 hooks 配置到你的项目

```bash
# 在你的项目根目录
cp -r path/to/supervisor-me-mvp/.claude .
cp -r path/to/supervisor-me-mvp/lib .
```

### 3. 安装依赖（如果需要）

```bash
npm install  # 如果你的项目使用 npm
```

### 4. 开始使用

正常使用 Claude Code，系统会自动在以下时机工作：

- **任务完成时**：验证代码质量和测试
- **文件修改时**：快速语法检查
- **用户输入时**：记录意图用于学习

## 📁 项目结构

```
your-project/
├── .claude/
│   ├── settings.json          # Hooks 配置
│   └── hooks/
│       ├── stop.sh           # 完成验证
│       ├── post-tool-use.sh  # 快速检查
│       └── user-prompt-submit.sh # 意图记录
├── lib/
│   ├── verify-completion.js  # 验证逻辑
│   ├── quick-check.js        # 语法检查
│   ├── inquiry-generator.js  # 智能提问
│   └── project-analyzer.js   # 项目分析
└── logs/
    ├── completions/          # 完成验证日志
    ├── checks/              # 快速检查日志
    └── intents/             # 用户意图日志
```

## 🎨 使用场景

### 场景 1：代码创建验证

```
用户: 创建一个登录组件
Claude: [创建文件并编写代码...]
Claude: ✨ 登录组件创建完成！

系统自动验证:
✅ 文件 components/Login.jsx 创建成功
✅ 语法检查通过
✅ 依赖导入正确
```

### 场景 2：测试执行验证

```
用户: 运行所有测试
Claude: [执行测试...]
Claude: ✨ 测试执行完成！

系统自动验证:
⚠️ 验证发现一些问题：
  • 2 个测试失败
  • auth.test.js:45 - 期望值不匹配
💡 建议：运行 npm test -- --verbose 查看详细信息
```

### 场景 3：用户中断（不验证）

```
用户: 重构整个项目
Claude: [开始重构...]
用户: [按 ESC 中断]
Claude: [停止]

系统: [静默，不进行验证]

用户: 先修复这个 bug
Claude: [开始新任务...]
```

## ⚙️ 配置说明

### .claude/settings.json

```json
{
  "hooks": {
    "Stop": ".claude/hooks/stop.sh",
    "PostToolUse": {
      "Write": ".claude/hooks/post-tool-use.sh",
      "Edit": ".claude/hooks/post-tool-use.sh",
      "MultiEdit": ".claude/hooks/post-tool-use.sh"
    },
    "UserPromptSubmit": ".claude/hooks/user-prompt-submit.sh"
  }
}
```

### 自定义验证策略

编辑 `lib/verify-completion.js` 添加你的验证逻辑：

```javascript
class CustomStrategy extends VerificationStrategy {
    async verify() {
        // 你的验证逻辑
        return {
            success: true,
            details: ['自定义验证通过']
        };
    }
}
```

## 🔍 验证策略

系统内置多种验证策略：

| 策略 | 触发条件 | 验证内容 |
|------|---------|---------|
| **文件创建** | 创建新文件 | 文件存在性、语法正确性 |
| **测试执行** | 运行测试 | 测试通过率、覆盖率 |
| **重构** | 代码重构 | 功能保持、测试通过 |
| **Bug 修复** | 修复问题 | 问题解决、无回归 |

## 📊 日志和调试

查看验证日志：

```bash
# 完成验证日志
tail -f logs/completions/stop.log

# 快速检查日志  
tail -f logs/checks/tools.log

# 用户意图日志
tail -f logs/intents/intents.log
```

## 🤝 最佳实践

### ✅ 推荐做法

1. **让验证静默运行**：正常情况下不要有输出
2. **只在问题时提醒**：发现问题才显示信息
3. **提供可操作建议**：告诉用户如何解决问题
4. **记录但不阻塞**：验证失败不阻止 Claude 继续

### ❌ 避免做法

1. **过度验证**：不要每个小操作都验证
2. **强制中断**：不要因为验证失败就中断流程
3. **冗长输出**：保持输出简洁明了
4. **验证中断操作**：用户主动中断时不要验证

## 🛠 故障排除

### Hooks 没有触发

1. 确认 `.claude/settings.json` 配置正确
2. 检查 hook 脚本有执行权限：`chmod +x .claude/hooks/*.sh`
3. 新开一个 Claude 会话（hooks 在会话启动时加载）

### 验证脚本报错

1. 检查 Node.js 是否安装：`node --version`
2. 确认 lib 目录文件完整
3. 查看日志文件了解详细错误

### 误报太多

1. 调整 `lib/verify-completion.js` 中的验证策略
2. 根据项目特点自定义验证规则
3. 可以临时禁用某些检查

## 📈 进阶使用

### 集成到 CI/CD

```yaml
# .github/workflows/verify.yml
name: Supervisor Verify
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: node lib/verify-completion.js
```

### 自定义验证规则

创建 `.supervisor/rules.json`：

```json
{
  "rules": {
    "require-tests": true,
    "min-coverage": 80,
    "max-complexity": 10
  }
}
```

### 团队共享配置

将验证配置提交到代码库，团队成员自动获得相同的验证标准。

## 🤔 常见问题

**Q: 这会影响 Claude Code 的性能吗？**
A: 不会。所有验证都是异步的，不阻塞 Claude 的操作。

**Q: 可以关闭某些验证吗？**
A: 可以。编辑 `.claude/settings.json` 移除不需要的 hooks。

**Q: 支持哪些编程语言？**
A: 目前支持 JavaScript、TypeScript、Python、JSON、YAML。易于扩展到其他语言。

**Q: 与 ESLint/Prettier 冲突吗？**
A: 不冲突。快速检查只做语法验证，不改变代码格式。

## 🚧 路线图

- [ ] 支持更多编程语言（Go、Rust、Java）
- [ ] 集成更多测试框架
- [ ] AI 驱动的智能验证建议
- [ ] 可视化验证报告
- [ ] 团队协作功能

## 📄 许可证

MIT License

## 🙏 贡献

欢迎提交 Issue 和 Pull Request！

---

**记住：我们的目标是帮助，而不是监督。让 Claude Code 更可靠，让开发更愉快！**