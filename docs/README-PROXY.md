# Super Proxy - 透明代理监督器

## 架构概述

```
用户终端 ←→ [Super Proxy] ←→ Claude Code CLI
                ↓
           Supervisor
           (暗中监督)
```

## 核心特性

### ✅ 完全透明
- **保留 Claude 原生体验**：所有动画、高亮、交互功能完全保留
- **双向管道**：用户输入和 Claude 输出直接传递，无修改
- **无界面污染**：没有 [Supervisor] 等标记，用户看不到监督痕迹

### 🔍 暗中监督
- **后台分析**：Supervisor 监听所有交互但不影响显示
- **关键词检测**：检测 "done"、"complete" 等完成声明
- **自动验证**：触发 `./verify.sh` 进行测试验证

### 💉 智能注入
- **自然打字**：逐字符注入，模拟真实用户输入
- **随机延迟**：50-150ms 随机间隔，更像人类打字
- **上下文感知**：根据失败类型生成合适的询问

## 文件说明

```
super-proxy.js      # 主程序 - 透明代理
mock-claude.js      # 模拟器 - 用于测试
test-proxy.js       # 自动化测试脚本
demo-proxy.sh       # 演示脚本
```

## 使用方法

### 1. 使用真实 Claude
```bash
node super-proxy.js
# 或
./super-proxy.js
```

### 2. 使用模拟器测试
```bash
node super-proxy.js --mock
```

### 3. 运行自动化测试
```bash
node test-proxy.js
```

## 工作流程

1. **用户输入** → Super Proxy → Claude
2. **Claude 响应** → Super Proxy → 用户（同时 Supervisor 分析）
3. **检测到 "done"** → 延迟 3 秒 → 运行 verify.sh
4. **测试失败** → 延迟 2 秒 → 注入自然询问
5. **询问看起来像用户输入** → Claude 响应

## 日志文件

所有监督活动记录在：
```
.super/proxy-supervisor.log
```

日志格式：
- `[OUTPUT]` - Claude 的输出
- `[USER]` - 用户的输入
- `[TRIGGER]` - 检测到完成声明
- `[VERIFY]` - 验证结果
- `[INJECT]` - 注入的询问

## 技术细节

### node-pty 的关键用法
```javascript
// 创建伪终端
const claude = pty.spawn('claude', [], {
    name: 'xterm-256color',
    cols: process.stdout.columns,
    rows: process.stdout.rows
});

// 透明管道
process.stdin.pipe(claude);    // 用户 → Claude
claude.pipe(process.stdout);   // Claude → 用户

// 同时监听（不影响管道）
claude.on('data', (data) => {
    supervisorAnalyze(data);  // 暗中分析
});
```

### 自然注入技术
```javascript
function injectInquiry(text) {
    let index = 0;
    const typeChar = () => {
        if (index < text.length) {
            claude.write(text[index]);
            index++;
            // 随机打字速度
            setTimeout(typeChar, 50 + Math.random() * 100);
        } else {
            claude.write('\r');  // Enter
        }
    };
    typeChar();
}
```

## 与之前方案的区别

### ❌ 之前的错误理解
- 创建了新的界面
- 有 Worker/Supervisor 分离显示
- 修改了 Claude 的输出

### ✅ 现在的正确实现
- 不创建任何新界面
- 完全保留 Claude 原生体验
- Supervisor 完全隐形
- 注入的询问看起来像用户输入

## 测试验证

运行测试脚本会：
1. 发送 "hello" - 正常交互
2. 发送 "write a test" - 代码生成
3. 发送 "task done" - 触发验证
4. 观察自动注入的询问（"Can you check why the tests are failing?"）
5. 验证整个流程透明无痕

## 注意事项

- 需要 `node-pty` 包来创建伪终端
- 在 Windows 上可能需要额外配置
- Ctrl+C 用于退出代理
- 确保 `verify.sh` 有执行权限