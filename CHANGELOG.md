# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.1] - 2025-09-01

### Fixed
- 🐛 **Proxy Response Parsing**: Fixed issue where "proxy success" and JSON response on the same line weren't properly parsed
- 📝 **JSON Extraction**: Improved filter logic to correctly extract JSON from various proxy response formats

## [3.1.0] - 2025-09-01

### Changed
- 🔒 **Stop Hook Logic**: Removed `stop_hook_active` special handling - supervisor now always checks quality even after previous blocks
- 📝 **Documentation**: Primary README is now in English with Chinese version in README_CN.md
- 🎯 **Auto-Approval**: Enhanced auto-approval mechanism to distinguish between lazy pauses and legitimate plan approvals
- 📚 **Examples**: Moved effect examples before quick start section for better user experience

### Added
- 🌍 **Internationalization**: Full i18n support with Chinese (zh-CN) and English (en-US) locales
- 🎯 **Smart Approval**: Auto-approval for storylines/implementation plans while still blocking lazy TODO pauses
- 🔍 **Implementation Deviation Detection**: New rule to check if code implementation matches promised architecture
- 📖 **Testing Documentation**: Added auto-approval testing methods and examples
- ⚠️ **Infinite Block Warning**: Documented the possibility of repeated blocking as a design decision

### Fixed
- 🐛 **Language Consistency**: Fixed README language mixing issue - English and Chinese are now properly separated
- 📝 **Rule Templates**: Updated both Chinese and English rule templates with auto-approval logic

## [3.0.0] - 2025-09-01

### 🎉 First Stable Release
This is the first production-ready release of ho-cc-supervisor, a minimalist Hook system to prevent Claude from being lazy.

### Core Features
- ✨ **Stop Hook Supervisor**: Intercepts Claude's stop attempts and checks work quality
- 🔍 **Lazy Pattern Detection**: Identifies vague language, TODO pauses, false completions, work avoidance, and responsibility shifting
- 📊 **Debug Logging**: Comprehensive execution trace with PID tracking in `/tmp/cc-supervisor/`
- 🌐 **Isolated Execution**: Supervisor runs in isolated directory to prevent infinite loops
- ⚙️ **Configurable Claude Command**: Support for custom `claude -p` parameters
- 🧹 **Log Management**: Commands for viewing, following, and cleaning supervisor logs
- ⏱️ **20-minute Timeout**: Generous timeout for thorough quality checks

### CLI Commands
- `cc-supervisor init` - Initialize supervisor in project (with language selection)
- `cc-supervisor logs` - View supervisor debug logs
- `cc-supervisor clean` - Clean old log files

### Architecture
- **Independent Supervisor System**: Uses `claude -p` for quality checking
- **JSON Communication**: Returns `{"decision": "block", "reason": "..."}` or `{}` for pass
- **Session Isolation**: Each session has its own debug directory
- **Hook Integration**: Leverages Claude Code native Stop Hook mechanism

### Documentation
- Complete README in English and Chinese
- Installation and usage guides
- Troubleshooting and FAQ sections
- Technical architecture documentation

---

## Previous Development History (Pre-3.0.0)

### [2.0.0] - 2025-01-31
- Rebranded from `supervisor-me` to `@ho/cc-supervisor`
- Renamed CLI commands for clarity
- Fixed auto-feedback and terminal control issues

### [1.x] - 2025-01
- Initial prototype development
- Basic Hook system implementation
- Early testing and iteration