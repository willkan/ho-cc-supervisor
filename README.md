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
- 📝 **压力循环** - 验证失败时生成质询文件要求说明 (Part 5)
- 🎨 **友好界面** - 彩色终端输出，清晰的状态反馈

## 项目结构

```
supervisor-me-mvp/
├── super.js               # 透明监督器（主程序）
├── super-config.js        # 监督器配置文件
├── mock-claude.js         # Claude模拟器（测试用）
├── verify.sh              # 核心验证脚本
├── challenge.sh           # 循环挑战生成器
├── monitor.sh             # 文件监控器
├── wrapper.js             # 命令包装器
├── test-all.sh            # 集成测试
├── example-app/           # 示例应用（Jest测试）
│   ├── add.js
│   ├── add.test.js
│   └── package.json
├── .proof/                # 证据文件目录
│   └── latest.json        # 最新验证结果
├── .super/                # Supervisor日志目录
│   └── supervisor.log       # 监督日志
└── archive/               # 归档文件
    ├── old-implementations/  # 旧实现
    ├── tests/                # 测试文件
    └── demos/                # 演示脚本
```

## 核心功能

### 1. 透明监督器 (super.js) 🆕
- **完全透明**：保留 Claude Code 所有原生体验（动画、高亮、交互）
- **暗中监督**：后台监控所有交互，用户无感知
- **自动注入**：测试失败时自动注入带标记的询问
- **参数传递**：支持传递所有 Claude CLI 参数

### 2. 验证系统 (verify.sh)
- 自动运行 example-app 中的测试
- 生成防篡改的证据文件
- 提供清晰的通过/失败状态

### 3. 监控系统 (monitor.sh)
- 实时检测文件变化
- 自动触发验证
- 记录所有状态变化

### 4. 命令包装器 (wrapper.js)
- 拦截关键命令（commit、push）
- 前置/后置验证
- 透明命令执行

### 5. 挑战循环 (challenge.sh)
- 测试失败时生成 CHALLENGE.md
- 要求解释失败原因
- 测试通过后自动清理

## 🚀 快速开始

### 使用透明代理（推荐）

```bash
# 安装依赖
npm install

# 方式1：直接运行
./bin/super

# 方式2：通过 npm
npm link  # 链接到全局
super  # 运行（或 supervisor-me）

# 方式3：通过 node
node bin/super

# 跳过权限检查
./bin/super --dangerously-skip-permissions

# 使用模拟器测试
./bin/super --mock
```

### 传统方式

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
./scripts/verify.sh

# 启动自动监控（每5秒检查）
./scripts/monitor.sh --interval 5

# Part 3: 包装任意命令并监测关键词
node wrapper.js "echo 'task completed'"  # 触发验证
node wrapper.js "npm test"                # 捕获输出到 session.log

# Part 5: 压力循环 - 生成质询文件
./scripts/challenge.sh  # 失败时生成 CHALLENGE.md，成功时自动清理

# 运行完整测试套件
./test-all.sh
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

**记住**: Trust but Verify - 信任但要验证！ 🛡️