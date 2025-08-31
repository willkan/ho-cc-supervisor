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

## Notes for Claude Assistants
When assisting with CC-Supervisor development:
- Always verify auto-feedback actually submits (not just displays)
- Test real scenarios with actual Claude sessions
- Check terminal output for `[自动注入]` markers
- Validate hook integration doesn't interfere with normal Claude operation