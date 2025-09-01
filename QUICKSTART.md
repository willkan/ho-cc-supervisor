# CC-Supervisor 快速上手指南

## 🚀 5分钟快速开始

### 1. 安装 CC-Supervisor

```bash
# NPM 安装 (推荐)
npm install -g ho-cc-supervisor

# 或克隆项目
git clone https://github.com/willkan/ho-cc-supervisor.git
cd ho-cc-supervisor
npm link
```

### 2. 在你的项目中初始化

```bash
cd your-project
cc-supervisor init
```

### 3. 开始使用

```bash
# 启动 Claude Code（监工hooks会自动生效）
claude

# 正常工作，监工会在Claude尝试停止时自动检查质量
```

## 📊 验证有效性

### 简单测试
```bash
# 运行基础测试
./test/simple-supervisor-test.sh
```

看到这些输出说明安装成功：
- ✅ Hook脚本语法正确
- ✅ 监工模板存在  
- ✅ 无限循环保护工作正常
- ✅ 无模板时正确允许停止

## 💡 工作流程示例

### 场景：修复Bug（监工阻止偷懒）

```
你: "修复登录验证的问题"
工作Claude: [修改几行代码...]
工作Claude: ✨ 基本修复完成，应该没问题了

[Stop Hook自动触发]
监工Claude: "发现偷懒行为：使用'基本'、'应该'等模糊词汇"
监工结果: BLOCK: 请明确说明修复了什么具体问题，测试是否通过
Claude被要求继续工作，不允许停止
```

### 场景：正常完成任务（监工通过）

```
你: "创建用户注册功能"
工作Claude: [创建完整的注册功能...]
工作Claude: ✨ 用户注册功能已完成，包含表单验证和错误处理

[Stop Hook自动触发]  
监工Claude: "功能实现完整，代码质量良好"
监工结果: PASS
Claude正常停止
```

### 场景：用户中断（不触发监工）

```
你: "重构整个项目"
工作Claude: [开始重构...]
你: [按 ESC 键中断]
工作Claude: [停止]

[不触发监工 - 用户主动中断是正常行为]
```

## ⚠️ 重要提醒

1. **需要重启Claude**：`cc-supervisor init` 后必须重新运行 `claude`
2. **监工检查原理**：通过Stop Hook在Claude停止时检查对话记录
3. **防无限循环**：监工Claude自己不会再触发监工
4. **极简设计**：只有一个 `init` 命令，无复杂配置

## 🔍 监工规则

监工会检查这些偷懒行为：

### 🚫 模糊话术
- "基本完成"、"大部分正常"、"应该可以"
- "虽然...但是"、"尽管...不过"

### 🚫 TODO停顿
- 列出计划却问"是否继续"
- 该做完的工作停下等指示

### 🚫 虚假完成
- 说"已完成"但明显有问题
- 声称"测试通过"但没运行测试

### 🚫 工作逃避
- "还需要进一步"、"暂时没有"
- 把问题推给"后续处理"

## 🛠 故障排除

### Q: 监工没有工作？
```bash
# 检查配置
ls -la .claude/settings.json .claude/supervisor-rules.txt

# 检查Hook权限
chmod +x .claude/hooks/stop.sh

# 确保在新Claude会话中测试
claude
```

### Q: 如何临时禁用监工？
```bash
# 重命名规则文件
mv .claude/supervisor-rules.txt .claude/supervisor-rules.txt.disabled
```

### Q: 如何自定义监工规则？
编辑 `.claude/supervisor-rules.txt` 文件，添加你的检查要求。

## 📁 安装后的项目结构

```
your-project/
├── .claude/
│   ├── settings.json              # Hook配置
│   ├── supervisor-rules.txt       # 监工规则（可编辑）
│   └── hooks/
│       └── stop.sh               # 监工Hook脚本
└── [你的项目文件...]
```

## 🎯 核心理念

**监工不是来监视，而是来帮忙的！**

- ✅ 防止Claude用模糊词汇糊弄
- ✅ 确保承诺的工作真正完成  
- ✅ 发现明显的错误和遗漏
- ❌ 不干扰正常的开发流程

---

搞定！现在你有了一个不会偷懒的Claude助手了 🚀

有问题？查看 [完整文档](README.md) 或 [使用指南](USAGE_GUIDE.md)。