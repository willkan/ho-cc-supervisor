# Changelog

All notable changes to Supervisor-ME MVP will be documented in this file.

## [0.3.0] - 2025-08-25

### Added
- **challenge.sh** - Part 5: 压力循环（简化版）
  - Generates CHALLENGE.md when verification fails
  - Includes test failure details and terminal evidence
  - Requests explanation with three prompts:
    1. 失败原因（一句话）
    2. 修复计划
    3. 预计时间
  - Auto-removes CHALLENGE.md when tests pass
  - Integrated into test-all.sh with full test coverage

### Updated
- test-all.sh now includes challenge.sh testing
- README.md updated with Part 5 documentation
- CLAUDE.md updated with challenge.sh commands

## [0.2.0] - 2025-08-24

### Added
- **monitor.sh** - Automatic monitoring system with comprehensive change detection
  - File timestamp monitoring for immediate change detection
  - Git status change detection for working directory changes
  - New commit detection to track repository updates
  - Configurable check interval (default 60 seconds)
  - ALERT.txt creation on test failure with detailed information
  - Automatic ALERT.txt removal when tests pass
  - Color-coded console output with timestamps
  - Status transition alerts (PASS→FAIL, FAIL→PASS)
  - Monitoring log in `.proof/monitor.log`
  - Cross-platform support (macOS/Linux)

### Fixed
- macOS compatibility for md5 hashing (uses `md5` instead of `md5sum`)
- File change detection using proper stat commands for each OS

### Documentation
- Added comprehensive monitor.sh documentation in `docs/monitor.md`
- Created PROGRESS.md to track implementation progress
- Updated CLAUDE.md with project-specific instructions

### Testing
- Verified all monitor.sh features:
  - File change detection (< 3 seconds response time)
  - Git status change detection
  - New commit detection
  - ALERT.txt creation and removal
  - Status transition notifications
  - Proper timestamp formatting

## [0.1.0] - 2025-08-24

### Initial Release
- **verify.sh** - Core verification script
  - Runs Jest tests in example-app
  - Generates JSON evidence in `.proof/latest.json`
  - Color-coded output for test results
  - Exit codes for pass/fail status

- **wrapper.js** - Command wrapper system
  - Pre-validation for commit/push commands
  - Post-validation for test/build commands
  - Transparent command execution
  - Operation logging

- **test-all.sh** - Comprehensive test suite
  - 22 tests covering all components
  - Failure simulation and recovery testing
  - Self-restoring after tests

- **example-app** - Demo application
  - Simple add() and multiply() functions
  - Jest test setup
  - npm package configuration

### Project Structure
- Established `.proof/` directory for evidence storage
- Created comprehensive documentation in `docs/`
- Implemented color-coded terminal output
- Set up cross-platform compatibility