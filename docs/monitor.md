# Monitor.sh Documentation

## Overview

`monitor.sh` is an automatic monitoring system that continuously watches for file changes, git status changes, and new commits, automatically running verification when changes are detected.

## Features

- **Automatic Change Detection**
  - File timestamp monitoring
  - Git status change detection
  - New commit detection
- **Configurable Interval** - Default 60 seconds, customizable
- **Alert System** - Creates ALERT.txt on test failure
- **Status Transitions** - Notifies when tests start failing or passing
- **Color-coded Output** - Clear visual feedback
- **Logging** - Maintains `.proof/monitor.log`

## Usage

### Basic Usage

```bash
# Start with default 60-second interval
./monitor.sh &

# Start with custom interval (e.g., 3 seconds)
./monitor.sh --interval 3 &

# Start monitoring specific directory
./monitor.sh --watch src --interval 5 &
```

### Command Line Options

- `--interval <seconds>` - Check interval in seconds (default: 60)
- `--watch <directory>` - Directory to watch (default: example-app)

## Change Detection Methods

1. **File Timestamp Detection**
   - Uses `stat` command to track file modification times
   - Cross-platform support (macOS/Linux)

2. **Git Status Detection**
   - Monitors `git status --porcelain` output
   - Detects any working directory changes

3. **Commit Detection**
   - Tracks `git rev-parse HEAD`
   - Detects new commits

## Alert System

### ALERT.txt Creation

When tests fail, creates `ALERT.txt` containing:
- Timestamp of failure
- Test results (passed/failed counts)
- Current git status
- Last commit information
- Action required message

### ALERT.txt Removal

Automatically removes `ALERT.txt` when tests pass again.

## Console Output

### Color Coding

- 🔵 **Blue** - No changes detected, running verification
- 🟡 **Yellow** - Changes detected
- 🟢 **Green** - Tests passing, success messages
- 🔴 **Red** - Tests failing, alerts

### Status Indicators

- ✅ **PASS** - All tests passing
- ❌ **FAIL** - One or more tests failing

### Timestamp Format

All messages include `[HH:MM:SS]` timestamp.

## Status Transitions

Monitor alerts on status changes:

- **PASS → FAIL**: "⚠️ ALERT: Tests started failing!"
- **FAIL → PASS**: "✨ GOOD: Tests are passing again!"

## Log File

Monitor maintains `.proof/monitor.log` with:
- Start/stop events
- Status changes
- Change detection events
- Timestamps for all events

## Examples

### Example 1: Development Workflow

```bash
# Start monitoring during development
./monitor.sh --interval 5 &

# Make code changes
# Monitor automatically runs tests
# See immediate feedback in console

# Stop monitoring
pkill -f monitor.sh
```

### Example 2: CI/CD Integration

```bash
# Use in CI pipeline
./monitor.sh --interval 10 &
MONITOR_PID=$!

# Run deployment tasks
# Monitor ensures code stays valid

# Check final status
./verify.sh || exit 1
kill $MONITOR_PID
```

### Example 3: Git Hook Integration

```bash
# .git/hooks/pre-push
#!/bin/bash
./monitor.sh --interval 2 &
MONITOR_PID=$!
sleep 10  # Give time for verification
kill $MONITOR_PID

# Check for ALERT.txt
if [ -f ALERT.txt ]; then
    echo "Tests failing - push blocked!"
    exit 1
fi
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Monitor not detecting changes | Check file permissions and git status |
| High CPU usage | Increase interval with `--interval 60` |
| md5sum not found (macOS) | Script auto-detects and uses `md5` instead |
| Monitor won't stop | Use `pkill -f monitor.sh` |

## Technical Details

### Cross-platform Compatibility

```bash
# macOS
stat -f "%m"  # File modification time
md5           # Hash function

# Linux
stat -c "%Y"  # File modification time
md5sum        # Hash function
```

### Process Management

- Runs in background with `&`
- Clean shutdown with Ctrl+C or kill signal
- Multiple instances can run with different configs

## Integration with Supervisor-ME

Monitor.sh integrates with:
- `verify.sh` - Runs verification on changes
- `.proof/latest.json` - Reads test results
- `ALERT.txt` - Creates/removes based on status

## Best Practices

1. **Development**: Use short intervals (3-5 seconds)
2. **Production**: Use longer intervals (60+ seconds)
3. **CI/CD**: Run with specific timeout periods
4. **Git Hooks**: Use with pre-commit/pre-push hooks