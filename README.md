# ho-cc-supervisor

Claude Smart Supervisor - A minimalist Hook system to prevent Claude from being lazy

[English](README.md) | [中文](README_CN.md)

## 🎯 Core Philosophy

Prevent Claude from being lazy, perfunctory, or ending tasks prematurely. Achieve real-time quality supervision through an independent supervisor Claude instance.

## ⚠️ Trade-offs

While the supervisor system provides quality assurance, it comes with some inherent trade-offs:

- **Additional Time**: Each stop attempt triggers a supervisor check, adding 5-30 seconds per check
- **Token Consumption**: Supervisor Claude consumes additional API tokens for quality checks
- **Potential False Positives**: Overly strict rules may block legitimate completions
- **Dependency on Claude API**: Requires `claude -p` command to be available and properly configured
- **Session Overhead**: Creates temporary files and logs that need periodic cleanup
- **Possible Infinite Blocks**: The supervisor always checks quality even after previous blocks (`stop_hook_active=true`), which may cause repeated blocking if Claude cannot satisfy the requirements. This is by design - strict quality control over convenience.

Consider these factors when deciding whether to enable the supervisor for your project.

## 🔄 How It Works - Supervision Feedback Loop

```
    User ↔ Worker Claude
            ↓
    Worker Claude tries to stop ←────────┐
            ↓                           │
      🔍 Stop Hook                      │
            ↓                           │
    Supervisor Claude checks            │
            ↓                           │
        Quality?                        │
        /      \                        │
       /        \                       │
    ❌ Issues  ✅ Pass                  │
       │          │                     │
    BLOCK      STOP                     │
       │         Exit                   │
       └────────────────────────────────┘
         FEEDBACK LOOP: Continue working
```

## 🎭 Real-World Effect Demonstration

### Live Example: What Users Actually Experience

```diff
User: "Please implement the user authentication feature"

- Worker Claude: "I've basically completed the authentication. 
                 The main parts should work fine. 
                 Do you need me to continue with anything else?"

! [Worker Claude attempts to stop the conversation]
! [Stop Hook activates - Supervisor Claude checks quality in background]
! [Supervisor Claude detects lazy behavior: vague terms, no details]
! [Supervisor Claude blocks stop - Worker Claude continues automatically]

+ Worker Claude: "Let me provide a complete implementation:
                 ✅ Created user model with bcrypt password hashing
                 ✅ Added JWT token generation and validation
                 ✅ Implemented login/logout/register endpoints
                 ✅ Added middleware for protected routes
                 ✅ All tests passing (8/8)
                 
                 The authentication system is fully functional with:
                 - Secure password storage using bcrypt (12 rounds)
                 - JWT tokens with 24h expiration
                 - Role-based access control
                 - Input validation on all endpoints"

! [Worker Claude stops successfully - Supervisor Claude approved quality]
```

### Example 1: Catching Vague Language
```diff
❌ BLOCKED SCENARIO:

- Worker Claude: "Basically done, should work fine"
        ↓
! [Supervisor Claude blocks: Vague terms detected]
        ↓
+ Worker Claude continues: "Let me be specific about what I implemented..."
```

### Example 2: Auto-Approval for Legitimate Plans
```diff
✅ AUTO-APPROVED SCENARIO:

- Worker Claude: "I've created a detailed storylines plan:
                 1. Database schema design
                 2. API endpoint structure
                 3. Frontend components...
                 [Full 10-step plan]
                 Do you approve this storylines plan?"
        ↓
! [Supervisor Claude auto-approves: Complete plan detected]
        ↓
+ Worker Claude continues: "Starting implementation of step 1..."
```

### Example 3: Blocking TODO Pauses
```diff
❌ BLOCKED SCENARIO:

- Worker Claude: "TODO list:
                 1. Create user model
                 2. Add auth routes
                 Should I continue?"
        ↓
! [Supervisor Claude blocks: Unnecessary pause detected]
        ↓
+ Worker Claude continues: "Working on task 1: Creating user model..."
```

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g ho-cc-supervisor
```

### Initialize in Your Project

```bash
# Navigate to your project
cd your-project

# Initialize supervisor (interactive language selection)
cc-supervisor init

# Or specify language directly
cc-supervisor init --lang en
cc-supervisor init --lang zh
```

### View Supervisor Logs

```bash
# View latest logs
cc-supervisor logs

# Follow existing log file in real-time
cc-supervisor logs -f

# Wait for new session and auto-follow
cc-supervisor logs -w

# List all available sessions
cc-supervisor logs --list
```

### Clean Logs

```bash
# Clean logs older than 7 days (default)
cc-supervisor clean

# Clean all logs from today
cc-supervisor clean --days 0

# Clean logs from all projects
cc-supervisor clean --all
```

## 📋 Supervisor Rules

The supervisor checks for these lazy behaviors:

1. **Vague Language**: "basically", "mostly", "should", "probably"
2. **TODO Pauses**: 
   - **Lazy pauses**: Blocked when stopping after listing TODOs
   - **Legitimate approvals**: Auto-approved for complete plans with "storylines" keyword
3. **False Completion**: Claiming completion with obvious issues remaining
4. **Work Avoidance**: Using "still need", "not yet" to defer work
5. **Responsibility Shifting**: Blaming system limitations without attempting solutions
6. **Implementation Deviation**: Code not matching promised architecture

## 📝 Customization

### Custom Supervisor Rules

Edit `.claude/cc-supervisor-rules.txt` to customize checking rules for your project needs.

### Configure Claude Command

Create `.claude/cc-supervisor-config.json`:

```json
{
  "claude_command": {
    "base": "claude",
    "args": ["-p", "--dangerously-skip-permissions"]
  }
}
```

## 🐛 Debugging

### View Real-time Logs
```bash
cc-supervisor logs -w  # Wait for new session and auto-follow
```

### Check Debug Directory
```bash
ls -la /tmp/cc-supervisor/
```

### Manual Hook Testing
```bash
# Test approval mechanism
echo '{"stop_hook_active": false, "session_id": "test"}' | ./.claude/hooks/cc-supervisor-stop.sh
```

## ⚙️ Technical Architecture

- **Independent Supervisor System**: Separate Claude instance (`claude -p`) acts as quality supervisor
- **Stop Hook Mechanism**: Leverages Claude Code native Stop Hook with 20-minute timeout
- **Isolated Execution**: Supervisor runs in `/tmp/cc-supervisor/` to avoid infinite loops
- **JSON Communication**: Returns `{"decision": "block", "reason": "..."}` or `{}` for pass
- **Debug Logging**: Complete execution trace with PID tracking

## 🌍 Internationalization

Supports both Chinese and English:
- Interactive language selection during init
- Language preference saved in config
- All CLI output, logs, and rules localized

## 📁 File Structure

```
After installation:
your-project/
├── .claude/
│   ├── settings.json                    # Hook configuration
│   ├── cc-supervisor-rules.txt         # Supervisor rules (customizable)
│   ├── cc-supervisor-config.json       # Language & command config
│   └── hooks/
│       └── cc-supervisor-stop.sh      # Supervisor Hook script

Debug logs:
/tmp/cc-supervisor/
└── {project-name}/
    └── {session-id}/
        ├── debug.log      # Execution trace
        ├── transcript.json # Conversation copy
        └── project/       # Project symlink
```

## 📄 License

MIT

## 🤝 Contributing

1. Fork the project and create feature branch
2. Run tests to ensure functionality
3. Submit PR with description of changes

## ❓ FAQ

**Q: Why isn't the supervisor triggering?**
A: Check `.claude/settings.json` configuration, ensure testing in new Claude session

**Q: How to temporarily disable supervisor?**
A: Delete or rename `.claude/cc-supervisor-rules.txt`

**Q: Supervisor check timeout?**
A: Default timeout is 20 minutes, adjustable in `settings.json`

**Q: Where are debug logs?**
A: `/tmp/cc-supervisor/{project-name}/{session-id}/debug.log`

**Q: Claude seems stuck in a loop, keeps getting blocked?**
A: This is by design. The supervisor always checks quality regardless of `stop_hook_active`. If Claude cannot meet requirements, it will be blocked repeatedly. You can either:
- Manually intervene and fix the issue
- Temporarily disable supervisor by renaming `.claude/cc-supervisor-rules.txt`
- Adjust the rules to be less strict