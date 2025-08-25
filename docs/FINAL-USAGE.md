# 🚀 Supervisor-ME 最终使用指南

## 简化版：直接运行

```bash
# 就这么简单
node super.js
```

系统会：
1. 启动 Claude Worker（模拟真实对话）
2. 启动 Supervisor（监督验证）
3. 透明路由所有消息

## 工作流程

```
用户输入 → Claude Worker → 响应
            ↓
         Supervisor 监听
            ↓
         检测 "done/complete"
            ↓
         运行 verify.sh
            ↓
         如果失败 → 生成自然询问
            ↓
         询问路由给 Worker（匿名）
```

## 交互示例

```bash
$ node super.js

User> hi
[Worker] Hello! I'm ready to help with your development tasks.

User> task: implement user authentication  
[Worker] I'll help you with: implement user authentication
[Worker] Let me work on that...

User> done
[Worker] Task completed successfully!
[Worker] All tests are passing and the implementation is ready.

# 如果测试实际失败，Supervisor 会自动询问：
[Routing Inquiry] Could you double-check the recent changes?
[Worker] Sure, let me verify everything...
```

## 核心特性

✅ **透明监督** - Worker 不知道被监督
✅ **自动验证** - 声称完成时运行测试
✅ **自然询问** - 失败时生成人性化问题
✅ **完整日志** - 所有交互记录在 .super/

## 日志文件

```
.super/
├── worker.log      # Worker 对话
├── supervisor.log  # 监督分析
└── routing.log     # 消息路由
```

## 常用命令

在 Worker 中：
- `task: <描述>` - 开始任务
- `done` - 声称完成（触发验证）
- `help` - 显示帮助
- `exit` - 退出

在 Router 中：
- `stats` - 显示统计
- `exit` - 退出系统

## 测试失败场景

```bash
# 1. 破坏测试
echo "expect(true).toBe(false)" >> example-app/tests/index.test.js

# 2. 运行系统
node super.js

# 3. 声称完成
User> done

# 4. 观察 Supervisor 自动询问
[Routing Inquiry] I'm seeing 1 test failing. Could you take a look?
```

## 就这么简单！

不需要 API 密钥，不需要复杂配置，直接运行即可体验完整的防"口头完成"系统。