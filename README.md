# Supervisor-ME MVP

> 🛡️ 自动化代码验证系统 - 防止"口头完成"，确保代码真正工作

## 🎯 项目目标

创建一个自动验证系统，通过持续运行测试并生成不可篡改的证据文件，确保代码改动真正完成且功能正常。

## ✨ 核心特性

- ✅ **自动验证** - 运行测试并生成 JSON 格式的证据文件 (Part 1)
- 🔍 **实时监控** - 检测文件变化并自动触发验证 (Part 2)
- 🎯 **关键词检测** - 监测输出中的完成关键词并触发验证 (Part 3)
- ⚠️ **提交验证** - 检测 commit hash 不匹配并显示警告 (Part 3)
- 📊 **集成测试** - 端到端测试确保所有组件正常工作 (Part 4)
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

# Part 3 新功能：包装任意命令并监测关键词
node wrapper.js "echo 'task completed'"  # 触发验证
node wrapper.js "npm test"                # 捕获输出到 session.log

# 运行完整测试套件
./test-all.sh
```

## 📁 项目结构

```
supervisor-me-mvp/
├── verify.sh           # 核心验证脚本
├── monitor.sh          # 自动监控脚本
├── wrapper.js          # Part 3: 命令包装器（关键词检测）
├── test-all.sh         # 完整测试套件
├── session.log         # wrapper.js 生成的日志文件
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

### wrapper.js (Part 3 - 新增)
- 监控输出关键词: `test pass`, `all tests pass`, `completed`, `done`, `finished`
- 自动触发验证并检查提交哈希
- 生成 session.log 日志文件
- 显示警告: `⚠️ WARNING: COMMIT MISMATCH`

## 📊 测试覆盖

`test-all.sh` (Part 4) 包含 4 个核心集成测试：

1. ✅ **Verify Test** - 验证 verify.sh 运行并生成 proof 文件
2. ✅ **Monitor Test** - 测试 monitor.sh 可以运行（5秒）
3. ✅ **Wrapper Test** - 测试 wrapper.js 执行命令并生成 session.log
4. ✅ **Integration Test** - 端到端测试：修改文件、提交、验证哈希匹配

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
# Test mismatch
