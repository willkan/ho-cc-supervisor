# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.3.2] - 2025-09-02

### Enhanced
- 🔍 **Pre-commit Checks**: Added mandatory pre-commit execution check in supervisor rules
- 📋 **Test Coverage Requirements**: Clarified test coverage requirements in rules (100% main storylines, 60% secondary)
- 🎯 **Mandatory Checks Section**: Added "Checks Required Regardless of What Claude Says" section

### Changed
- 📝 **Rule Structure**: Reorganized Section 3 to emphasize mandatory checks that must be performed
- 🌍 **Bilingual Updates**: Updated both Chinese and English rule templates consistently

## [3.3.1] - 2025-09-02

### Added
- 🌍 **Full i18n Support for Hook Script**: Complete internationalization of all debug messages
- 📝 **Language-aware Debug Logs**: Debug messages now display in the language selected during init (zh-CN or en-US)
- 🔧 **Early Locale Detection**: Moved locale reading before first log message to ensure consistent language usage

### Fixed
- 🐛 **Empty Debug Messages**: Fixed issue where initial debug messages were empty due to late locale detection
- 📍 **Message Variable Initialization**: Ensured all message variables are defined before first use
- 🧹 **Code Cleanup**: Removed duplicate locale configuration sections

## [3.3.0] - 2025-09-02

### Added
- ✨ **CheckedList Debug Feature**: Added detailed checkedList array to track supervisor's inspection process
- 📋 **Dynamic Check Items**: CheckedList dynamically records each rule check with item, result, and detail
- 🔍 **Debug Transparency**: Each check item shows pass/fail status and specific findings

### Fixed
- 🐛 **Transcript Summary**: Fixed empty transcript summary issue in debug logs
- 📝 **JSONL Parsing**: Correctly handle JSONL format for conversation transcripts

### Changed
- 🔧 **Output Format Reorganization**: Moved format specifications to Hook script, rules focus on business logic
- 📊 **CheckedList Format**: Changed from fixed fields to dynamic array based on actual checks
- 🎯 **Better Separation**: Hook defines "how to output", rules define "when to block"

## [3.2.5] - 2025-09-02

### Changed
- 🔧 **Unified Format Instructions**: Removed duplicate output format rules from Hook script
- 📝 **Clearer Separation**: Hook focuses on JSON constraint, rules file defines logic
- 🎯 **Avoid Confusion**: Single source of truth for output format in rules file

### Fixed  
- 🐛 **Format Duplication**: Eliminated conflicting format instructions between Hook and rules

## [3.2.4] - 2025-09-02

### Fixed
- 🐛 **JSON Output Enforcement**: Fixed supervisor returning markdown instead of JSON
- 🔧 **Stricter API Mode**: Enhanced prompt to ensure supervisor acts as JSON API endpoint only
- 📝 **Clearer Instructions**: Explicitly forbid markdown, emojis, titles, lists in output

### Changed
- 🎯 **System Prompt**: Changed from "JSON formatter" to "JSON API endpoint"
- 🚫 **Output Rules**: Added explicit prohibitions against non-JSON content
- 📌 **Format Enforcement**: First character must be {, last must be }

## [3.2.3] - 2025-09-01

### Fixed
- 🔧 **Auto-Approval Logic**: Fixed auto-approval not working for legitimate plan approvals
- 📝 **Clearer Instructions**: Made it explicit that auto-approval should use block to push forward
- 🎯 **Correct Behavior**: Supervisor now correctly returns block for storyline/workflow approvals

### Enhanced
- 📋 **More Keywords**: Added "storyline", "workflow", "APPROVAL GATE" to auto-approval detection
- 💡 **Better Guidance**: Added explicit "must return" and "do not return" examples in rules

## [3.2.2] - 2025-09-01

### Enhanced
- 🔒 **Zero Tolerance Policy**: Strengthened supervisor rules with explicit zero tolerance for any errors
- 💪 **Stricter Enforcement**: Supervisor cannot use "although...but..." rhetoric or make compromises
- 🚫 **No Exception Rule**: Even 99% completion with 1 error must block
- 📝 **Clearer Standards**: Added explicit enforcement standards for supervisor execution

### Fixed
- 🐛 **Supervisor Leniency**: Fixed issue where supervisor was too lenient with compilation errors
- 🎯 **Enforcement Consistency**: Supervisor now strictly enforces its own rules without compromise

## [3.2.1] - 2025-09-01

### Fixed
- 🔧 **Path Resolution**: Fixed project directory resolution to use Hook script location instead of current working directory
- 📁 **Log Directory Consistency**: Logs are now correctly created based on project root path, not pwd
- 🐛 **Absolute Path**: Added `realpath` to resolve Hook script to absolute path
- 📝 **Template Syntax**: Fixed backtick escaping in supervisor prompt

### Changed
- 🗂️ **Simplified Rule Check**: Removed unnecessary upward search since project root is now correctly identified
- 📍 **Directory Logic**: PROJECT_DIR is now derived from Hook script location (3 dirname calls from .claude/hooks/cc-supervisor-stop.sh)

## [3.2.0] - 2025-09-01

### Added
- 🔍 **Upward Search for Rules**: Hook now searches up to 10 parent directories for supervisor rules
- 📁 **Subdirectory Support**: Can work in project subdirectories without needing separate initialization
- 🔧 **Smart Config Loading**: Configuration file is loaded from the same directory as the rules file

### Changed
- 🏗️ **Project Structure Flexibility**: No longer requires `.claude/` folder in every subdirectory
- 📍 **Rule Resolution**: Rules are resolved relative to project root, not current working directory

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