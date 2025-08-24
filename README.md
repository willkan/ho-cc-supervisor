# Supervisor-ME MVP

> 🛡️ 自动化代码验证系统 - 防止"口头完成"，确保代码真正工作

## 🎯 项目目标

创建一个自动验证系统，通过持续运行测试并生成不可篡改的证据文件，确保代码改动真正完成且功能正常。

## ✨ 核心特性

- ✅ **自动验证** - 运行测试并生成 JSON 格式的证据文件
- 🔍 **实时监控** - 检测文件变化并自动触发验证
- 🎯 **命令拦截** - 在关键操作前强制验证
- 📊 **完整测试** - 包含 22 个测试用例的完整测试套件
- 🎨 **友好界面** - 彩色终端输出，清晰的状态反馈

## 🚀 快速开始

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd supervisor-me-mvp

# 设置权限
chmod +x *.sh

# 安装依赖
cd example-app && npm install && cd ..

# 运行测试验证安装
./test-all.sh
```

### 基本使用

```bash
# 运行单次验证
./verify.sh

# 启动自动监控（每5秒检查）
./monitor.sh --interval 5

# 包装命令执行
node wrapper.js "git commit -m 'feature done'"

# 运行完整测试套件
./test-all.sh
```

## 📁 项目结构

```
supervisor-me-mvp/
├── verify.sh           # 核心验证脚本
├── monitor.sh          # 自动监控脚本
├── wrapper.js          # 命令包装器
├── test-all.sh         # 完整测试套件
├── example-app/        # 示例应用
│   ├── package.json
│   ├── src/
│   │   └── index.js    # add() 和 multiply() 函数
│   └── tests/
│       └── index.test.js # Jest 测试
├── .proof/             # 证据存储目录
│   ├── latest.json     # 最新验证结果
│   └── monitor.log     # 监控日志
└── docs/               # 详细文档
    ├── README.md       # 文档主页
    ├── ARCHITECTURE.md # 架构设计
    ├── USAGE.md        # 使用指南
    └── API.md          # API 文档
```

## 🔄 工作流程

```
代码改动 → 运行测试 → 解析结果 → 生成证据 → 状态判定
```

## 📋 证据格式

```json
{
  "timestamp": "2024-01-20T10:30:00Z",
  "commitHash": "abc123def456...",
  "tests": {
    "passed": 10,
    "failed": 0,
    "total": 10
  },
  "status": "PASS"
}
```

## 🔧 配置选项

### monitor.sh
- `--interval <秒>`: 检查间隔（默认: 5）
- `--watch <目录>`: 监控目录（默认: example-app）

### wrapper.js
- 预验证命令: `commit`, `push`
- 后验证命令: `test`, `build`

## 📊 测试覆盖

`test-all.sh` 包含 22 个测试：

1. ✅ 项目结构验证（7个测试）
2. ✅ 示例应用测试（5个测试）
3. ✅ 验证脚本测试（4个测试）
4. ✅ 故障检测测试（2个测试）
5. ✅ 包装器功能测试（2个测试）
6. ✅ 系统恢复测试（2个测试）

## 🎯 使用场景

### 开发流程
```bash
# 开始开发
./monitor.sh --interval 3  # 启动监控

# 编写代码...
# 监控器自动验证每次保存

# 提交前验证
./verify.sh && git commit -m "feature complete"
```

### CI/CD 集成
```yaml
# GitHub Actions
- name: Verify Code
  run: ./verify.sh
```

### Git Hooks
```bash
# .git/hooks/pre-commit
#!/bin/sh
./verify.sh || exit 1
```

## 🛠️ 故障排除

| 问题 | 解决方案 |
|------|----------|
| 测试无法运行 | `cd example-app && npm install` |
| 权限错误 | `chmod +x *.sh` |
| 监控无响应 | 增加间隔 `--interval 10` |
| JSON 解析失败 | 删除并重新生成 `rm .proof/latest.json && ./verify.sh` |

## 📚 文档

- 📖 [完整文档](docs/README.md)
- 🏗️ [架构设计](docs/ARCHITECTURE.md)
- 📝 [使用指南](docs/USAGE.md)
- 🔌 [API 文档](docs/API.md)

## 🤝 贡献

欢迎贡献！请确保：

1. 所有改动通过 `./test-all.sh`
2. 更新相关文档
3. 遵循现有代码风格
4. 提交前运行 `./verify.sh`

## 📄 许可证

MIT License

## 🙏 致谢

感谢所有贡献者和使用者的支持！

---

**记住**: Trust but Verify - 信任但要验证！ 🛡️# Test change
# Another change
