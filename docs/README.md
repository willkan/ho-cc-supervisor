# Supervisor-ME 文档

## 概述

Supervisor-ME 是一个自动化代码验证系统，旨在防止"口头完成"的情况。它通过持续运行测试并生成不可篡改的证据文件，确保代码改动真正完成且功能正常。

## 核心理念

- **Trust but Verify（信任但验证）**: 不仅依赖开发者的声明，而是通过自动化测试验证
- **Evidence-Based（基于证据）**: 每次验证都生成 JSON 格式的证据文件
- **Real-Time Monitoring（实时监控）**: 可以持续监控代码变化并自动验证
- **Fail-Fast（快速失败）**: 在问题出现时立即发现并报告

## 文档结构

- [架构设计](ARCHITECTURE.md) - 系统架构和组件设计
- [使用指南](USAGE.md) - 详细的使用说明和示例
- [API 文档](API.md) - 脚本接口和参数说明

## 快速开始

### 1. 基本验证

```bash
./verify.sh
```

验证当前代码状态，生成证据文件到 `.proof/latest.json`

### 2. 持续监控

```bash
./monitor.sh --interval 5
```

每 5 秒检查一次文件变化，自动运行验证

### 3. 命令包装

```bash
node wrapper.js "git commit -m 'feature complete'"
```

在执行敏感命令前自动验证代码状态

## 系统要求

- Bash Shell
- Node.js 14+
- Git（可选，用于获取 commit hash）

## 验证流程

```
代码改动 → 运行测试 → 解析结果 → 生成证据 → 状态判定
```

## 证据格式

```json
{
  "timestamp": "2024-01-20T10:30:00Z",
  "commitHash": "abc123...",
  "tests": {
    "passed": 10,
    "failed": 0,
    "total": 10
  },
  "status": "PASS"
}
```

## 集成场景

1. **CI/CD Pipeline**: 作为构建流程的一部分
2. **Pre-commit Hook**: 提交前自动验证
3. **Code Review**: 提供客观的测试证据
4. **Development Workflow**: 实时反馈代码状态

## 最佳实践

1. **始终运行验证**: 在声明功能完成前运行 `verify.sh`
2. **保存证据文件**: 将 `.proof` 目录纳入版本控制
3. **设置监控**: 开发时运行 `monitor.sh` 获得实时反馈
4. **包装关键命令**: 使用 `wrapper.js` 保护重要操作

## 故障排除

### 测试无法运行
- 确保 `node_modules` 已安装
- 检查 `package.json` 中的 test 脚本配置

### 验证脚本权限错误
```bash
chmod +x verify.sh monitor.sh wrapper.js test-all.sh
```

### JSON 解析失败
- 确保测试输出格式正确
- 检查 grep 命令的兼容性（macOS vs Linux）

## 贡献指南

欢迎提交 Issue 和 Pull Request。请确保：

1. 所有改动通过 `test-all.sh`
2. 更新相关文档
3. 遵循现有代码风格

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 GitHub Issue。