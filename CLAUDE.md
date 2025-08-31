# CLAUDE.md - CC-Supervisor Project Instructions

## Project Overview
CC-Supervisor (@ho/cc-supervisor) is an AI-powered dual-Claude verification system designed to automatically improve code quality through intelligent verification and feedback loops.

## Key Commands and Usage

### Primary Commands
- `cc-supervisor init` - Initialize CC-Supervisor in a project
- `cc-supervisor test` - Test verification functionality
- `cc-supervisor status` - Check system status
- `cc-supervisor show-report` - View verification reports
- `cc-supervisor clean` - Clean old logs

### Auto-Feedback Mode
- `cc-supervisor-claude` - Start transparent proxy with auto-feedback
- `cc-supervisor-claude --session <uuid>` - Specify Claude session ID
- `cc-supervisor-claude --debug` - Debug mode

## Development Guidelines

### When Working on CC-Supervisor

1. **Testing Changes**: Always test both manual verification (hooks) and auto-feedback mode (cc-supervisor-claude)
2. **Verification Logic**: The core verification happens in `lib/claude-verify-simple.js` using `claude -p` mode
3. **Auto-Feedback**: The transparent proxy in `bin/cc-supervisor-claude.js` handles automatic injection of feedback

### Key Files
- `/lib/claude-verify-simple.js` - Core verification engine
- `/bin/cc-supervisor` - CLI tool for manual operations
- `/bin/cc-supervisor-claude.js` - Transparent proxy for auto-feedback
- `/.claude/hooks/*.sh` - Hook scripts for Claude Code integration

### Testing Procedures

When making changes, test the following scenarios:

1. **Basic Verification**:
   ```bash
   cc-supervisor test
   ```

2. **Auto-Feedback Loop**:
   ```bash
   # In test project
   cc-supervisor init
   cc-supervisor-claude
   # Create a file with syntax error and verify auto-correction
   ```

3. **Hook Integration**:
   ```bash
   # Start Claude normally
   claude
   # Complete a task and verify Stop hook triggers
   ```

## Architecture Notes

### Dual Claude System
- **Worker Claude**: Primary Claude instance handling user tasks
- **Verifier Claude**: Secondary Claude launched via `claude -p` for verification
- **Feedback Loop**: Verifier results are injected back to Worker via systemMessage or auto-injection

### Auto-Injection Mechanism
The cc-supervisor-claude transparent proxy:
1. Monitors Claude session for idle state
2. Checks for `.issues` files with verification feedback
3. Automatically injects feedback as commands
4. Submits with proper terminal sequences (`\r\n`)

### Session Management
- Sessions tracked via UUID in `~/.claude/`
- Project-specific logs in `logs/cc-supervisor/`
- Issues files in `~/.cc-supervisor/projects/`

## Common Issues and Solutions

### Issue: Feedback not auto-submitting
**Solution**: Ensure using `\r\n` sequence in `injectCommand()`, not just `\n`

### Issue: Verification not triggering
**Solution**: Check hooks are properly configured in `.claude/settings.json`

### Issue: Session ID mismatch
**Solution**: Verify cc-supervisor-claude is monitoring correct session via `--session` flag

## Important Implementation Details

### Terminal Control Sequences
When implementing auto-injection, remember:
- Use `\r` (carriage return) followed by `\n` (line feed)
- Display injected commands with `[自动注入]` prefix for visibility
- Handle multi-line commands by joining with spaces

### Hook System
CC-Supervisor leverages Claude Code's hook system:
- `Stop`: Triggers verification when tasks complete normally
- `PostToolUse`: Quick syntax checks after file modifications
- `UserPromptSubmit`: Captures user intent for context

### Verification Timeout
Default timeout is 30 seconds. If verification takes longer, it defaults to "pass" to avoid blocking workflow.

## Package Information
- **Package Name**: @ho/cc-supervisor
- **Main Binary**: cc-supervisor
- **Auto Mode Binary**: cc-supervisor-claude
- **Version**: 2.0.0

## Contributing
When contributing to CC-Supervisor:
1. Follow existing code patterns
2. Test both manual and auto modes
3. Update documentation for new features
4. Ensure backward compatibility with Claude Code hooks

## Current Status (2025-01-31)

### ✅ Completed Features
1. **Dynamic Session Tracking**: cc-supervisor-claude 动态跟踪活跃 session，支持 session 切换
2. **Auto-Injection Working**: 自动注入和提交功能已验证在真实环境中工作
3. **Complete Test Suite**: 
   - `test/verification-chain.test.js` - 6个测试全部通过
   - `test/run-all-tests.sh` - 9个测试综合套件
   - Pre-commit hooks 质量保证
4. **Template System**: 模板引擎和配置文件支持

### 🚧 Planned Architecture Refactor: File Polling → RPC Communication

**Current Problem**: File-based communication with polling
- Hook writes to `.issues` files → cc-supervisor-claude polls files
- Performance overhead from file I/O and timers
- Debugging difficulty due to async file operations

**Target Solution**: Real-time RPC communication
- Hook calls RPC method → cc-supervisor-claude receives immediately  
- Event-driven architecture with bidirectional logging
- Clear debugging and better performance

### 📋 RPC Architecture Refactor Plan

#### Phase 1: RPC Server Integration
- **Task**: Modify `bin/cc-supervisor-claude.js` to start RPC Server
- **File**: `lib/rpc-server.js` (already created)
- **Method**: 
  - Start Unix socket server on startup
  - Replace file polling with RPC event handlers
  - Keep PTY management unchanged

#### Phase 2: Hook Client Conversion  
- **Task**: Convert `Stop Hook` from file writer to RPC client
- **File**: `.claude/hooks/stop.sh`
- **Method**:
  - Add RPC client function (via nc/curl/node)
  - Call `reportIssue(sessionId, verificationResult)` instead of writing files
  - Maintain hook return format for Claude Code compatibility

#### Phase 3: Clean Up Legacy
- **Task**: Remove file polling mechanisms
- **Files**: Remove timer code, file watchers from cc-supervisor-claude
- **Test**: Ensure all existing test cases still pass

#### Phase 4: Enhanced Features
- **Bidirectional Communication**: Allow supervisor to query hook status
- **Performance Monitoring**: Add metrics for RPC call latency
- **Fallback Mechanism**: File-based fallback if RPC unavailable

### 🎯 Implementation Details

**RPC Protocol Design**:
```
Method: reportIssue
Params: {
  sessionId: string,
  issueData: string (markdown format),
  timestamp: ISO string
}
Response: {
  success: boolean,
  message: string
}
```

**Socket Path**: `/tmp/cc-supervisor-rpc.sock` (Unix socket)

**Error Handling**:
- RPC timeout: Fall back to file-based approach
- Connection failed: Log warning, continue with current session
- Protocol error: Retry once, then fallback

### 🧪 Testing Strategy
1. **Unit Tests**: RPC server and client components
2. **Integration Tests**: Full Hook → RPC → Injection flow
3. **Backward Compatibility**: Ensure file-based hooks still work during transition
4. **Performance Tests**: Compare RPC vs file polling latency

### 📊 Success Metrics
- **Latency**: RPC response < 100ms (vs ~1000ms file polling)
- **Reliability**: 99%+ RPC call success rate
- **Debugging**: Clear bidirectional logs for troubleshooting
- **Compatibility**: All existing functionality preserved

## Notes for Claude Assistants
When assisting with CC-Supervisor development:
- Always verify auto-feedback actually submits (not just displays)
- Test real scenarios with actual Claude sessions
- Check terminal output for `[自动注入]` markers
- Validate hook integration doesn't interfere with normal Claude operation
- **RPC Refactor**: Test both RPC and legacy file-based modes during transition