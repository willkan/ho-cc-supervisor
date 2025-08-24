# Supervisor-ME 使用指南

## 目录

1. [安装和设置](#安装和设置)
2. [基本使用](#基本使用)
3. [高级功能](#高级功能)
4. [实际场景](#实际场景)
5. [最佳实践](#最佳实践)
6. [常见问题](#常见问题)

## 安装和设置

### 1. 克隆项目

```bash
git clone <repository-url>
cd supervisor-me-mvp
```

### 2. 设置权限

```bash
chmod +x verify.sh monitor.sh wrapper.js test-all.sh
```

### 3. 安装示例应用依赖

```bash
cd example-app
npm install
cd ..
```

### 4. 验证安装

```bash
./test-all.sh
```

如果所有测试通过，系统已准备就绪。

## 基本使用

### 1. 运行单次验证

最简单的使用方式是运行验证脚本：

```bash
./verify.sh
```

**输出示例**：

```
================================================
     Supervisor-ME Verification System
================================================
✓ Found example-app directory

Running tests...

================================================
              Verification Results
================================================
Timestamp: 2024-01-20T10:30:00Z
Commit: abc123d
Tests Passed: 10
Tests Failed: 0
Total Tests: 10

✅ VERIFICATION PASSED
All tests are passing!

Proof saved to: .proof/latest.json
================================================
```

### 2. 查看证据文件

```bash
cat .proof/latest.json
```

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

### 3. 持续监控

启动监控器以实时检测变化：

```bash
./monitor.sh
```

**自定义检查间隔**：

```bash
./monitor.sh --interval 10  # 每10秒检查一次
```

**指定监控目录**：

```bash
./monitor.sh --watch src/  # 只监控src目录
```

### 4. 命令包装

在执行关键命令前自动验证：

```bash
node wrapper.js "git commit -m 'feature done'"
```

## 高级功能

### 1. 组合监控和验证

在一个终端运行监控：

```bash
./monitor.sh --interval 5
```

在另一个终端进行开发，监控器会自动检测并验证变化。

### 2. 集成到 Git Workflow

#### Pre-commit Hook

创建 `.git/hooks/pre-commit`：

```bash
#!/bin/sh
echo "Running Supervisor-ME verification..."
./verify.sh
if [ $? -ne 0 ]; then
    echo "❌ Verification failed. Please fix tests before committing."
    exit 1
fi
echo "✅ Verification passed. Proceeding with commit."
```

设置权限：

```bash
chmod +x .git/hooks/pre-commit
```

#### Pre-push Hook

创建 `.git/hooks/pre-push`：

```bash
#!/bin/sh
./verify.sh || exit 1
```

### 3. CI/CD 集成

#### GitHub Actions

`.github/workflows/verify.yml`：

```yaml
name: Supervisor-ME Verification

on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '14'
      - run: cd example-app && npm install
      - run: ./verify.sh
      - name: Upload evidence
        uses: actions/upload-artifact@v2
        with:
          name: verification-proof
          path: .proof/latest.json
```

#### Jenkins Pipeline

```groovy
pipeline {
    agent any
    stages {
        stage('Verify') {
            steps {
                sh './verify.sh'
                archiveArtifacts artifacts: '.proof/latest.json'
            }
        }
    }
}
```

### 4. 自定义配置

创建 `supervisor.config.json`：

```json
{
  "verifyBeforeCommands": ["commit", "push", "deploy"],
  "autoVerifyAfter": ["test", "build", "install"],
  "monitorInterval": 5,
  "watchPatterns": ["*.js", "*.json", "*.test.js"],
  "notificationWebhook": "https://hooks.slack.com/..."
}
```

## 实际场景

### 场景 1: 功能开发

```bash
# 1. 开始开发前，启动监控
./monitor.sh --interval 3

# 2. 开发新功能
code src/newFeature.js

# 3. 编写测试
code tests/newFeature.test.js

# 4. 监控器自动验证每次保存

# 5. 准备提交时
node wrapper.js "git add ."
node wrapper.js "git commit -m 'Add new feature'"
```

### 场景 2: Bug 修复

```bash
# 1. 复现 bug（测试失败）
./verify.sh  # 显示 FAIL

# 2. 查看失败详情
cat .proof/latest.json

# 3. 修复代码
code src/buggyCode.js

# 4. 验证修复
./verify.sh  # 应该显示 PASS

# 5. 提交修复
git commit -m "Fix: resolve calculation error"
```

### 场景 3: 代码审查

```bash
# 1. 切换到功能分支
git checkout feature-branch

# 2. 运行完整测试
./test-all.sh

# 3. 生成验证报告
./verify.sh > verification-report.txt

# 4. 附加证据到 PR
cat .proof/latest.json >> pr-description.md
```

### 场景 4: 部署前验证

```bash
# 1. 部署脚本
#!/bin/bash
echo "Pre-deployment verification..."

if ! ./verify.sh; then
    echo "Deployment aborted: verification failed"
    exit 1
fi

echo "Deploying to production..."
# 实际部署命令
```

## 最佳实践

### 1. 开发流程

1. **开始工作前**：运行 `./verify.sh` 确认基准状态
2. **开发过程中**：保持 `monitor.sh` 运行
3. **提交代码前**：确保 `verify.sh` 通过
4. **代码审查时**：提供 `.proof/latest.json` 作为证据

### 2. 测试策略

- 保持测试快速运行（< 30秒）
- 覆盖关键业务逻辑
- 包含集成测试
- 定期运行 `test-all.sh`

### 3. 证据管理

```bash
# 保存重要证据
cp .proof/latest.json .proof/$(date +%Y%m%d_%H%M%S).json

# 清理旧证据
find .proof -name "*.json" -mtime +30 -delete
```

### 4. 团队协作

- 将 `.proof` 目录加入 `.gitignore`（本地证据）
- 或提交到仓库（共享证据）
- 在 PR 描述中包含验证结果
- 设置团队共享的监控仪表板

## 常见问题

### Q1: 验证失败但测试应该通过

**可能原因**：
- node_modules 未安装或过期
- 测试输出格式不兼容
- 环境变量问题

**解决方案**：

```bash
# 重新安装依赖
cd example-app
rm -rf node_modules package-lock.json
npm install
cd ..
./verify.sh
```

### Q2: monitor.sh 没有检测到文件变化

**可能原因**：
- 文件系统延迟
- 权限问题
- 错误的监控路径

**解决方案**：

```bash
# 增加检查间隔
./monitor.sh --interval 10

# 明确指定监控目录
./monitor.sh --watch ./example-app
```

### Q3: wrapper.js 不执行验证

**检查配置**：

```javascript
// 查看 wrapper.js 中的配置
const CONFIG = {
    verifyBeforeCommands: ['commit', 'push'],  // 这些命令需要验证
    autoVerifyAfter: ['test', 'build']         // 这些命令后自动验证
};
```

### Q4: 跨平台兼容性问题

**macOS vs Linux**：

```bash
# verify.sh 已处理兼容性
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS specific
else
    # Linux specific
fi
```

### Q5: 证据文件损坏

**恢复方法**：

```bash
# 删除损坏的文件
rm .proof/latest.json

# 重新运行验证
./verify.sh
```

## 调试技巧

### 1. 启用详细输出

```bash
# 修改 verify.sh
set -x  # 添加到脚本开头
```

### 2. 检查测试输出

```bash
# 直接运行测试查看原始输出
cd example-app
npm test
```

### 3. 验证脚本路径

```bash
# 确保在正确目录
pwd
ls -la *.sh
```

### 4. 查看监控日志

```bash
tail -f .proof/monitor.log
```

## 性能优化

### 1. 减少监控开销

```bash
# 只监控源代码
./monitor.sh --watch "src/*.js"
```

### 2. 并行测试

修改 `package.json`：

```json
{
  "scripts": {
    "test": "jest --maxWorkers=4"
  }
}
```

### 3. 缓存优化

```bash
# 使用 npm ci 而不是 npm install
cd example-app
npm ci
```

## 下一步

- 探索 [API 文档](API.md) 了解详细参数
- 查看 [架构设计](ARCHITECTURE.md) 了解内部原理
- 贡献代码或提出改进建议