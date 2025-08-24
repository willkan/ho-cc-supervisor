# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Supervisor-ME is an automated code verification system designed to prevent "verbal completion" scenarios by continuously running tests and generating tamper-proof evidence files. The system ensures code changes are truly complete and functional.

## Essential Commands

### Verification and Testing
```bash
# Run single verification (generates .proof/latest.json)
./verify.sh

# Run complete test suite (22 tests covering all components)
./test-all.sh

# Run example-app tests directly
cd example-app && npm test && cd ..
```

### Development Workflow
```bash
# Start file monitoring (detects changes and auto-verifies)
./monitor.sh --interval 3

# Wrap commands with verification
node wrapper.js "git commit -m 'message'"

# Setup permissions (required after cloning)
chmod +x *.sh
```

### Troubleshooting
```bash
# Fix missing dependencies
cd example-app && npm install && cd ..

# Fix corrupted evidence file
rm .proof/latest.json && ./verify.sh

# Check verification status
cat .proof/latest.json
```

## Architecture Overview

The system consists of four main components that work together:

1. **verify.sh**: Core verification engine
   - Runs tests in example-app/
   - Parses Jest output to extract pass/fail counts
   - Generates JSON evidence in .proof/latest.json
   - Returns exit code 0 for PASS, 1 for FAIL

2. **monitor.sh**: File system watcher
   - Uses stat command to detect timestamp changes (macOS/Linux compatible)
   - Triggers verify.sh when changes detected
   - Logs state transitions to .proof/monitor.log
   - Alerts on status changes (PASS→FAIL or FAIL→PASS)

3. **wrapper.js**: Command interceptor
   - Pre-validates before commit/push commands
   - Post-validates after test/build commands
   - Configurable via CONFIG object
   - Logs all operations to .proof/wrapper.log

4. **test-all.sh**: Integration test suite
   - Tests all components including failure scenarios
   - Temporarily modifies code to verify failure detection
   - Self-restoring after tests complete

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

1. **Cross-platform file monitoring** (monitor.sh):
   - macOS: `stat -f "%m"`
   - Linux: `stat -c "%Y"`

2. **Test output parsing** (verify.sh):
   - Primary: Looks for "Tests:" line
   - Fallback: Searches for individual pass/fail counts
   - Uses `head -1` to avoid duplicate matches

3. **Command wrapping** (wrapper.js):
   - Uses `spawn` with `stdio: 'inherit'` for transparent command execution
   - Captures SIGINT for graceful shutdown
   - Exit codes are preserved from wrapped commands

4. **Failure simulation** (test-all.sh):
   - Backs up original files before modification
   - Restores files after testing failure detection
   - Verifies both failure detection and recovery

## Development Notes

- All shell scripts must have execute permissions (`chmod +x`)
- The .proof/ directory is created automatically by scripts
- Color output uses ANSI escape codes (can be disabled with NO_COLOR=1)
- Scripts use `set -e` for fail-fast behavior
- Example-app contains minimal Jest setup with add() and multiply() functions

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