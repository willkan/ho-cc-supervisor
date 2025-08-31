# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-01-31

### Changed
- 🎯 **BREAKING**: Rebranded from `supervisor-me` to `@ho/cc-supervisor`
- 🔄 **BREAKING**: Renamed CLI commands:
  - `supervisor-me` → `cc-supervisor`
  - `supervisor-node` → `cc-supervisor-claude`
  - Removed deprecated `supervisor-tmux`
- 📚 Documentation now primarily in English with Chinese auxiliary docs
- 🔧 Fixed auto-feedback submission issue in transparent proxy mode

### Added
- ✨ Auto-injection visual feedback with `[自动注入]` prefix
- 📝 Comprehensive CLAUDE.md project instructions
- 🤖 GitHub Actions for CI/CD and npm publishing
- 📦 Proper .npmignore for cleaner package distribution

### Fixed
- 🐛 Terminal control sequences now properly submit commands (`\r\n` instead of `\n`)
- 🎨 Missing color definitions in terminal output
- 🔍 Session ID tracking and monitoring improvements

### Removed
- 🗑️ 13 outdated documentation files
- 🧹 Old test scripts with deprecated command references
- 📦 supervisor-tmux binary (superseded by cc-supervisor-claude)

## [1.0.0] - 2025-01-30

### Added
- 🚀 Initial release as `supervisor-me`
- 🤖 Dual Claude verification system
- 🔍 Automatic code quality verification
- ⚡ Claude -p mode for fast verification
- 🪝 Claude Code hooks integration
- 📊 Verification reporting system