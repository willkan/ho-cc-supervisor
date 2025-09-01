# CLAUDE.md - ho-cc-supervisor 项目说明

## 项目概述
ho-cc-supervisor 是一个Claude Code智能监工系统，通过Stop Hook机制防止Claude偷懒和糊弄工作。采用双Claude架构，在Claude尝试结束对话时自动检查工作质量。

## 核心命令

### 基础命令
```bash
# 初始化监工系统到目标项目
cc-supervisor init

# 查看调试日志
cc-supervisor logs              # 查看最新日志的最后20行
cc-supervisor logs -f           # 实时跟踪现有日志文件（tail -f）
cc-supervisor logs -w           # 等待并监控新的监工session
cc-supervisor logs --list       # 列出所有可用的session日志
cc-supervisor logs --session <id>  # 查看特定session的日志
cc-supervisor logs -n 100       # 显示最后100行

# 清理日志
cc-supervisor clean             # 清理7天前的日志
cc-supervisor clean --days 0    # 清理今天的日志
cc-supervisor clean --all       # 清理所有项目的日志
```

## 工作原理

### 执行流程
1. 用户使用Claude Code正常工作
2. Claude完成任务尝试停止对话
3. Stop Hook被触发，拦截停止请求
4. Hook在隔离目录调用监工Claude (`claude -p`)
5. 监工根据规则检查工作质量
6. 如果发现偷懒行为，阻止停止并要求重做
7. 如果质量合格，允许正常停止

### 关键文件
- `/bin/cc-supervisor` - CLI工具，提供init/logs/clean命令
- `/.claude.disabled/hooks/stop.sh` - 监工Hook脚本模板（安装后名为cc-supervisor-stop.sh）
- `/.claude.disabled/supervisor-rules.txt` - 监工检查规则模板
- `/.claude.disabled/supervisor-config.json` - Claude命令参数配置模板
- `/.claude.disabled/settings.json` - Hook配置模板（包含20分钟超时）

### 目录结构
```
项目安装后：
your-project/
├── .claude/
│   ├── settings.json                  # Hook配置（合并现有配置）
│   ├── cc-supervisor-rules.txt       # 监工规则（可自定义）
│   ├── cc-supervisor-config.json     # Claude命令参数（可选）
│   └── hooks/
│       └── cc-supervisor-stop.sh    # 监工Hook脚本

临时目录（调试日志）：
/tmp/cc-supervisor/
└── -Users-username-project-name/
    └── {session-id}/
        ├── debug.log          # 调试日志
        ├── transcript.json    # 对话记录副本
        └── project/          # 项目软链接
```

## 技术架构

### 双Claude系统
- **工作Claude**: 用户正常交互的Claude Code实例
- **监工Claude**: 通过 `claude -p` 调用的质量检查实例
- **隔离执行**: 监工在 `/tmp/cc-supervisor/` 独立目录运行，避免循环

### Hook集成
- 利用Claude Code原生的Stop Hook机制
- Hook配置写入 `.claude/settings.json`
- 超时设置为1200秒（20分钟），给监工充足时间
- 仅在Claude主动停止时触发，用户中断(ESC)不触发
- Hook返回JSON格式：`{"decision": "block", "reason": "..."}` 阻止停止

### 防循环机制
1. **stop_hook_active检测**: Claude传递的标识，避免递归
2. **隔离目录执行**: 监工在无Hook的临时目录运行
3. **代理检测**: 检测"proxy success"等异常响应自动跳过

### 监工规则系统
监工检查以下偷懒行为：
1. **模糊话术**: "基本"、"大部分"、"应该"等含糊词汇
2. **TODO停顿**: 列了计划却停下问"是否继续"
3. **虚假完成**: 声称完成但明显有问题
4. **工作逃避**: 用"还需要"、"暂时没有"推脱
5. **责任推卸**: 归咎系统限制而不尝试解决

## 测试方法

### 基础测试
```bash
# 语法和基础功能测试
./test/simple-supervisor-test.sh

# 全链路测试
./test/full-chain-test.sh

# 端到端测试（包含模拟claude -p）
./test/e2e-test.sh
```

### 手动测试
```bash
# 创建测试项目
mkdir /tmp/test-project && cd /tmp/test-project
cc-supervisor init

# 模拟Hook调用
echo '{"stop_hook_active": false, "session_id": "test-123"}' | ./.claude/hooks/cc-supervisor-stop.sh

# 查看调试日志
cc-supervisor logs
```

## 开发注意事项

### 本项目开发
1. 源文件在 `.claude.disabled/` 目录，避免被自己监工
2. 修改Hook后需要测试 `cc-supervisor init` 能正确复制文件
3. 测试时注意清理 `/tmp/cc-supervisor/` 下的临时文件

### 代理环境
- 如果 `claude -p` 返回 "proxy success"，Hook会自动跳过
- 这是为了兼容代理环境，避免阻塞工作流

### 调试技巧
1. 使用 `cc-supervisor logs -f` 实时查看执行过程
2. 检查 `/tmp/cc-supervisor/` 下的debug.log获取详细信息
3. 测试不同的对话记录场景验证监工判断

## 版本信息
- **Package**: ho-cc-supervisor
- **Version**: 3.0.0
- **License**: MIT

## 贡献指南
1. Fork项目并创建feature分支
2. 运行测试确保功能正常
3. 提交PR并说明改动内容

### Claude命令配置
支持通过 `.claude/cc-supervisor-config.json` 自定义Claude命令参数：
```json
{
  "claude_command": {
    "base": "claude",
    "args": ["-p", "--dangerously-skip-permissions"]
  }
}
```

## 当前状态 (2025-09-01)

### ✅ 已实现功能
1. **极简CLI**: 只有init/logs/clean三个命令
2. **Stop Hook监工**: Claude停止时自动触发检查
3. **隔离目录执行**: 避免无限循环和session污染
4. **调试日志系统**: 完整记录每次监工执行过程，包含PID和信号追踪
5. **代理兼容**: 自动过滤proxy success和markdown标记
6. **自定义规则**: 用户可编辑监工检查规则
7. **JSON规范输出**: 监工严格按照Claude Code官方格式返回JSON
8. **双参数日志查看**: `-f` 跟踪现有，`-w` 监控新session
9. **可配置Claude参数**: 支持自定义claude命令参数

### 🎯 设计理念
- **极简至上**: 一键初始化，无复杂配置
- **透明可调试**: 完整的日志记录便于排查问题
- **不干扰工作**: 只在Claude主动停止时检查
- **健壮容错**: 处理各种异常情况不阻塞工作流

## 已知问题
1. 代理环境下 `claude -p` 可能返回 "proxy success" 而非实际判断（已通过过滤处理）
2. 大型对话记录可能导致监工提示过长

## FAQ

**Q: 为什么监工没有触发？**
A: 检查 `.claude/settings.json` 配置，确保在新Claude会话中测试

**Q: 如何临时禁用监工？**
A: 删除或重命名 `.claude/cc-supervisor-rules.txt` 文件

**Q: 如何配置Claude命令参数？**
A: 编辑 `.claude/cc-supervisor-config.json` 文件，添加所需参数

**Q: 调试日志在哪里？**
A: `/tmp/cc-supervisor/{project-name}/{session-id}/debug.log`

**Q: 如何自定义监工规则？**
A: 编辑项目的 `.claude/cc-supervisor-rules.txt` 文件

**Q: 监工检查超时怎么办？**
A: 默认超时为20分钟，可在 `settings.json` 中调整 `timeout` 值