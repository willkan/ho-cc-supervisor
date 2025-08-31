# Supervisor-ME 快速上手指南

## 🚀 5分钟快速开始

### 1. 安装 Supervisor-ME

```bash
# 克隆项目
git clone https://github.com/yourusername/supervisor-me-mvp.git
cd supervisor-me-mvp

# 全局链接命令
npm link
```

### 2. 在你的项目中初始化

```bash
cd your-project
supervisor-me init
```

### 3. 开始使用

```bash
# 启动 Claude Code（hooks 会自动生效）
claude

# 正常工作，验证会在任务完成时自动运行
```

## 📊 常用命令

```bash
# 查看验证报告
supervisor-me show-report

# 查看系统状态
supervisor-me status

# 测试验证功能
supervisor-me test

# 清理日志
supervisor-me clean
```

## 💡 工作流程示例

### 场景：修复一个 Bug

1. **你说**："修复登录验证的问题"
2. **Worker Claude**：开始修改代码...
3. **Worker Claude**：Bug 修复完成！
4. **[自动触发验证]**
5. **验证反馈**：代码质量良好，建议添加错误处理

### 场景：创建新功能

1. **你说**："创建用户注册功能"
2. **Worker Claude**：创建注册表单、API、数据库...
3. **Worker Claude**：功能创建完成！
4. **[自动触发验证]**
5. **验证反馈**：功能完整，建议添加输入验证和测试

## ⚠️ 注意事项

1. **首次使用需要重启 Claude Code**：`supervisor-me init` 后需要重新运行 `claude`
2. **验证是异步的**：不会影响你的工作流
3. **防循环设计**：验证 Claude 不会触发新的验证

## 🔍 查看验证日志

```bash
# 实时查看验证日志
supervisor-me show-report --follow

# 查看最近20条记录
supervisor-me show-report -n 20

# JSON 格式输出
supervisor-me show-report --json
```

## 🛠 故障排除

### Q: 验证没有触发？
- 确认在新的 Claude 会话中
- 运行 `supervisor-me status` 检查状态

### Q: 如何临时禁用验证？
```bash
export CLAUDE_VERIFIER_MODE=true
claude
```

### Q: 如何完全卸载？
```bash
# 在项目中
rm -rf .claude logs/supervisor-me

# 全局卸载
npm unlink -g supervisor-me
```

## 📝 提示

- 验证会检查最近5分钟内修改的文件
- 验证结果会通过 JSON 格式注入到对话上下文
- Worker Claude 会自动接收并处理验证反馈

---

有问题？查看 [README.md](README.md) 获取更多信息。