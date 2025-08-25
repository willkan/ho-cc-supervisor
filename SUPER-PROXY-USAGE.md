# Super Proxy 使用指南

## 快速开始

### 安装
```bash
# 安装依赖
npm install

# （可选）全局安装
npm link
```

### 启动方式

#### 方式 1：直接运行（推荐）
```bash
# 基本使用
./bin/super-proxy

# 跳过权限检查
./bin/super-proxy --dangerously-skip-permissions

# 使用模拟器测试
./bin/super-proxy --mock
```

#### 方式 2：全局安装后
```bash
npm link  # 只需执行一次

# 然后在任意目录使用
supervisor-me
supervisor-me --dangerously-skip-permissions
```

#### 方式 3：通过 Node
```bash
node bin/super-proxy
node bin/super-proxy --dangerously-skip-permissions
```

## 支持的 Claude 参数

Super Proxy 支持传递所有 Claude CLI 参数：

```bash
# 跳过所有权限检查
./bin/super-proxy --dangerously-skip-permissions

# 连接到 IDE
./bin/super-proxy --ide

# 设置模型
./bin/super-proxy --model opus

# 继续最近的会话
./bin/super-proxy -c

# 组合多个参数
./bin/super-proxy --dangerously-skip-permissions --model opus
```

## 工作原理

```
用户 ←→ [Super] ←→ Claude Code
            ↓
        Supervisor
        (暗中监督)
```

1. **透明代理**：所有输入输出完全透传，不修改
2. **参数传递**：除了 `--mock` 外的所有参数都传给 Claude
3. **暗中监督**：Supervisor 在后台分析所有交互
4. **自动注入**：测试失败时自动注入自然的询问

## 监督功能

### 触发词检测
当检测到以下关键词时触发验证：
- done
- complete
- finished
- 完成
- 搞定
- ready

### 验证流程
1. 检测到触发词 → 延迟 3 秒
2. 运行 `verify.sh`（如果存在）
3. 测试失败 → 延迟 2 秒
4. 注入自然询问（逐字输入）

### 注入的询问
系统会随机选择一个带标记的询问：
- "[AUTO-CHECK] Can you check why the tests are failing? [/AUTO-CHECK]"
- "[SUPERVISOR] Tests failed. Please check the errors. [/SUPERVISOR]"
- "[VERIFY-BOT] Automated check failed, need your attention. [/VERIFY-BOT]"

## 日志文件

所有监督活动记录在：
```
.super/proxy-supervisor.log
```

日志内容包括：
- `[OUTPUT]` - Claude 的所有输出
- `[USER]` - 用户的输入
- `[TRIGGER]` - 检测到完成声明
- `[VERIFY]` - 验证结果
- `[INJECT]` - 注入的询问
- `[BACKGROUND]` - 后台验证状态

## 使用场景

### 场景 1：正常开发
```bash
# 直接使用，保留所有权限检查
./bin/super-proxy
```

### 场景 2：自动化测试
```bash
# 跳过权限，适合 CI/CD
./bin/super-proxy --dangerously-skip-permissions
```

### 场景 3：本地测试
```bash
# 使用模拟器，不需要真实 Claude
./bin/super-proxy --mock
```

### 场景 4：从任意目录运行
```bash
# 全局安装后
cd /path/to/your/project
supervisor-me --dangerously-skip-permissions

# 或者直接指定路径
/path/to/supervisor-me-mvp/bin/super-proxy --dangerously-skip-permissions
```

## 注意事项

1. **安装依赖**
   ```bash
   npm install
   ```

2. **退出方式**
   - 使用 Ctrl+C 退出
   - 会自动清理并保存日志

3. **verify.sh 位置**
   - 代理会在 `scripts/verify.sh` 查找验证脚本
   - 如果不存在，会模拟测试失败

4. **权限传递**
   - `--dangerously-skip-permissions` 直接传给 Claude
   - 适合自动化场景，避免交互式提示

## 故障排除

### 问题：出现信任提示
**解决**：添加 `--dangerously-skip-permissions` 参数

### 问题：verify.sh 找不到
**解决**：这是正常的，系统会模拟测试失败并注入询问

### 问题：没有看到注入
**解决**：确保说了触发词（如 "done"），然后等待 5 秒

### 问题：Claude 没有响应
**解决**：检查 Claude CLI 是否正确安装和认证