# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Supervisor-ME is a transparent supervision system for Claude Code that ensures code changes are truly complete and functional. It acts as a proxy between the user and Claude Code, monitoring all interactions and automatically running tests in the background.

## Quick Start

### Using the Transparent Proxy (Recommended)
```bash
# Install dependencies
npm install

# Method 1: Direct execution
./bin/super

# Method 2: Global installation
npm link
super  # or supervisor-me

# Method 3: With mock mode for testing
./bin/super --mock

# Skip permission checks if needed
./bin/super --dangerously-skip-permissions
```

### Traditional Script Commands
```bash
# Run single verification (generates .proof/latest.json)
./scripts/verify.sh

# Generate challenge file when verification fails
./scripts/challenge.sh

# Run example-app tests directly
cd example-app && npm test && cd ..
```

### Development Workflow
```bash
# Start file monitoring (detects changes and auto-verifies)
./scripts/monitor.sh --interval 3

# Wrap commands with verification
node scripts/wrapper.js "git commit -m 'message'"

# Setup permissions (required after cloning)
chmod +x scripts/*.sh
```

### Troubleshooting
```bash
# Fix missing dependencies
cd example-app && npm install && cd ..
npm install  # for node-pty dependency

# Fix corrupted evidence file
rm .proof/latest.json && ./scripts/verify.sh

# Check verification status
cat .proof/latest.json

# View supervisor logs
cat .super/supervisor.log
```

## Architecture Overview

### New Transparent Proxy Architecture

The system now features a **transparent proxy** that sits between the user and Claude Code:

```
User → super.js (proxy) → Claude Code
         ↓
    Background verification & monitoring
```

**lib/super.js**: Transparent supervision proxy
- Uses `node-pty` to create a pseudo-terminal
- Preserves all Claude Code native features (colors, animations, interactions)
- Monitors all input/output transparently
- Runs verification in background
- Injects natural inquiries when tests fail
- Configurable via `lib/super-config.js`

### Core Components (in scripts/ directory)

1. **scripts/verify.sh**: Core verification engine
   - Runs tests in example-app/
   - Parses Jest output to extract pass/fail counts
   - Generates JSON evidence in .proof/latest.json
   - Returns exit code 0 for PASS, 1 for FAIL

2. **scripts/monitor.sh**: File system watcher
   - Uses stat command to detect timestamp changes (macOS/Linux compatible)
   - Triggers verify.sh when changes detected
   - Logs state transitions to .proof/monitor.log
   - Alerts on status changes (PASS→FAIL or FAIL→PASS)

3. **scripts/wrapper.js**: Command interceptor
   - Pre-validates before commit/push commands
   - Post-validates after test/build commands
   - Configurable via CONFIG object
   - Logs all operations to .proof/wrapper.log

4. **scripts/challenge.sh**: Pressure loop generator
   - Creates CHALLENGE.md when verification fails
   - Requests explanation for test failures
   - Includes terminal evidence in challenge file
   - Auto-removes challenge when tests pass

### Project Structure
```
supervisor-me-mvp/
├── bin/
│   └── super              # Global command entry point
├── lib/
│   ├── super.js           # Transparent proxy implementation
│   ├── super-config.js    # Configuration
│   └── mock-claude.js     # Mock Claude for testing
├── scripts/
│   ├── verify.sh          # Verification script
│   ├── monitor.sh         # File monitor
│   ├── wrapper.js         # Command wrapper
│   └── challenge.sh       # Challenge generator
├── example-app/           # Test application
├── .proof/                # Evidence files
└── .super/                # Supervisor logs
```

## Evidence File Format

All verification results are stored in `.proof/latest.json`:

```json
{
  "timestamp": "ISO 8601 timestamp",
  "commitHash": "git SHA or 'none'",
  "tests": {
    "passed": number,
    "failed": number,
    "total": number
  },
  "status": "PASS" | "FAIL"
}
```

Status is "PASS" only when failed=0 and total>0.

## Test Framework Integration

The system currently parses Jest output by looking for patterns like:
- "Tests: X passed, Y failed, Z total"
- Individual "X passed" and "Y failed" strings

The parsing logic in verify.sh handles multiple output formats and falls back gracefully.

## Critical Implementation Details

1. **Transparent Proxy** (lib/super.js):
   - Uses `node-pty` for pseudo-terminal creation
   - Preserves ANSI codes, cursor movements, and interactions
   - Monitors keyword patterns for completion claims
   - Injects inquiries with configurable markers
   - Handles SIGINT, SIGTERM gracefully

2. **Cross-platform file monitoring** (scripts/monitor.sh):
   - macOS: `stat -f "%m"`
   - Linux: `stat -c "%Y"`

3. **Test output parsing** (scripts/verify.sh):
   - Primary: Looks for "Tests:" line
   - Fallback: Searches for individual pass/fail counts
   - Uses `head -1` to avoid duplicate matches

4. **Command wrapping** (scripts/wrapper.js):
   - Uses `spawn` with `stdio: 'inherit'` for transparent command execution
   - Captures SIGINT for graceful shutdown
   - Exit codes are preserved from wrapped commands

## Development Notes

- Install `node-pty` dependency with `npm install`
- All shell scripts must have execute permissions (`chmod +x scripts/*.sh`)
- The .proof/ directory is created automatically by scripts
- The .super/ directory contains supervisor logs
- Color output uses ANSI escape codes (can be disabled with NO_COLOR=1)
- Scripts use `set -e` for fail-fast behavior
- Example-app contains minimal Jest setup with add() and multiply() functions
- The transparent proxy requires proper terminal capabilities

## Lessons Learned

### Cross-platform Compatibility
- **md5 hashing**: macOS uses `md5` while Linux uses `md5sum`
  - Solution: Detect OS and use appropriate command
- **stat command**: Different flags for macOS (`-f "%m"`) vs Linux (`-c "%Y"`)
  - Solution: OS detection with `$OSTYPE` variable

### Git Integration
- Git status detection using `git status --porcelain` provides consistent output
- Commit hash tracking with `git rev-parse HEAD` for new commit detection
- Multiple change detection methods can trigger simultaneously - prioritize by order

### Testing Best Practices
- Use short intervals (2-3 seconds) for testing, longer (60+ seconds) for production
- Always clean up test files and restore original state after testing
- Kill background processes properly with `pkill -f` or tracking PIDs

### Alert System Design
- Create ALERT.txt with comprehensive information for debugging
- Auto-remove alerts when issues are resolved to avoid confusion
- Include timestamps, test counts, git status, and action items in alerts

### Transparent Proxy Implementation
- **node-pty** provides full terminal emulation capabilities
- Preserves all escape sequences and control codes
- Monitors output without interfering with user experience
- Injection timing is crucial - use delays to appear natural
- Configuration allows customization of inquiry messages