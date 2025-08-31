# CC-Supervisor 使用指南

## 🚀 快速开始

### 方式一：NPM 安装（推荐）

```bash
# 1. 全局安装
npm install -g ho-cc-supervisor

# 2. 进入你的项目
cd your-project

# 3. 初始化
cc-supervisor init

# 4. 启动 Claude Code
claude
```

### 方式二：本地开发安装

```bash
# 1. 克隆并进入项目
git clone https://github.com/willkan/ho-cc-supervisor.git
cd ho-cc-supervisor

# 2. 链接到全局
npm link

# 3. 在你的项目中初始化
cd your-project
cc-supervisor init

# 4. 启动 Claude Code
claude
```

## 📋 验证工作流程

### 1. 正常编程流程
```
你: "创建一个计算器函数"
Worker Claude: [编写代码...]
Worker Claude: ✨ 计算器函数创建完成！

[自动触发验证]
📋 验证 Claude 反馈:
   验证结果: 通过，语法正确，功能实现完整
```

### 2. ESC 中断（不触发验证）
```
你: "重构整个项目"
Worker Claude: [开始重构...]
你: [按 ESC 键]
Worker Claude: [停止]

[没有验证 - 这是正确的行为]
```

### 3. 验证发现问题
```
你: "修复登录验证 bug"
Worker Claude: [修改代码...]
Worker Claude: ✨ Bug 修复完成！

[自动触发验证]
📋 验证 Claude 反馈:
   验证结果: 失败
   主要问题: 测试未通过，边界条件未处理
   修复建议: 检查空值处理逻辑
   ⚠️  建议检查并修复问题
```

## 🎯 核心概念

### 双 Claude 架构
- **Worker Claude**：你正在交互的主 Claude，执行编程任务
- **Verifier Claude**：验证 Claude，使用 `claude -p` 模式智能验证

### 触发机制
| 事件 | 触发验证 | 说明 |
|-----|---------|------|
| 任务完成 | ✅ | Worker Claude 认为任务完成时 |
| ESC 中断 | ❌ | 用户主动控制，不需要验证 |
| 文件修改 | 🔍 | 快速语法检查（可选） |

### 防循环机制
- 环境变量 `CLAUDE_VERIFIER_MODE=true` 防止验证 Claude 触发新的验证
- Verifier Claude 检测到此变量会跳过验证

## ⚙️ 配置说明

### 项目配置文件
`.claude/settings.json`
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

### 自定义验证提示
编辑 `lib/claude-verify-simple.js` 中的 `buildPrompt` 方法：

```javascript
buildPrompt(context) {
    // 可以根据项目特点定制验证重点
    const prompt = `分析刚刚完成的编程任务...
    
    // 添加你的特定验证要求
    请特别注意：
    - 安全性检查
    - 性能优化建议
    - 代码规范符合度
    `;
    
    return prompt;
}
```

## 📊 日志查看

### 查看验证历史
```bash
# 查看所有验证记录
tail -f logs/completions/stop.log

# 查看今天的验证
grep "$(date '+%Y-%m-%d')" logs/completions/stop.log
```

### 查看语法检查
```bash
# 实时查看语法检查
tail -f logs/checks/tools.log
```

### 查看用户意图
```bash
# 查看用户提交的任务历史
cat logs/intents/intents.log
```

## 🔧 故障排除

### 问题：验证没有触发

**检查步骤：**
1. 确认在新的 Claude 会话中（hooks 在启动时加载）
2. 检查配置文件存在：
   ```bash
   ls -la .claude/settings.json
   ```
3. 确认脚本有执行权限：
   ```bash
   chmod +x .claude/hooks/*.sh
   ```
4. 查看日志是否有错误：
   ```bash
   tail logs/completions/stop.log
   ```

### 问题：验证超时

**现象：**
显示 "验证超时，默认通过"

**解决方案：**
- 这是正常的保护机制（30秒超时）
- 如需调整，编辑 `lib/claude-verify-simple.js`:
  ```javascript
  timeout: 60000  // 改为60秒
  ```

### 问题：验证结果不准确

**优化建议：**
1. 调整验证提示词
2. 提供更多上下文信息
3. 根据项目类型定制验证策略

## 🎨 高级用法

### 临时禁用验证
```bash
# 设置环境变量
export CLAUDE_VERIFIER_MODE=true
claude
```

### 手动触发验证
```bash
# 直接运行验证脚本
bash .claude/hooks/stop.sh
```

### 测试验证功能
```bash
# 创建测试文件
echo "function add(a, b) { return a + b; }" > test.js

# 手动触发验证
node lib/claude-verify-simple.js --project-root .
```

## 📝 最佳实践

### ✅ 推荐做法
1. **让验证自动运行** - 不要手动干预验证流程
2. **关注验证反馈** - 及时修复发现的问题
3. **定期查看日志** - 了解验证模式和趋势
4. **根据项目定制** - 调整验证策略适配项目特点

### ❌ 避免做法
1. **频繁中断任务** - 会错过验证机会
2. **忽略验证反馈** - 可能积累技术债务
3. **过度定制验证** - 保持验证逻辑简单清晰
4. **禁用所有验证** - 失去质量保障

## 🚧 进阶配置

### 集成到 CI/CD
```yaml
# .github/workflows/verify.yml
name: Supervisor Verification
on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - name: Run Verification
        run: |
          node lib/claude-verify-simple.js \
            --project-root . \
            --ci-mode true
```

### 自定义验证策略
```javascript
// lib/custom-strategies.js
class SecurityVerificationStrategy {
    async verify(context) {
        // 实现安全检查逻辑
        return {
            success: true,
            message: "安全检查通过"
        };
    }
}
```

## 📚 参考文档

- [README.md](README.md) - 项目概览
- [ARCHITECTURE_COMPARISON.md](ARCHITECTURE_COMPARISON.md) - 架构对比
- [HOOKS_SOLUTION.md](HOOKS_SOLUTION.md) - 技术实现细节

## 🤝 获取帮助

遇到问题？
1. 查看本指南的故障排除部分
2. 查看项目 Issues
3. 提交新的 Issue 描述你的问题

---

**记住核心理念**：验证是为了帮助，不是监督。让 Claude 更聪明，让编程更愉快！ 🚀