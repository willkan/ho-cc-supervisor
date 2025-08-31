#!/usr/bin/env node

/**
 * Quick Checker - PostToolUse Hook 的快速检查逻辑
 * 对文件写入操作进行即时语法检查
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class QuickChecker {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || process.cwd();
        this.tool = options.tool || '';
        this.file = options.file || '';
    }
    
    /**
     * 执行快速检查
     */
    async check() {
        // 只检查写入类工具
        if (!['Write', 'Edit', 'MultiEdit'].includes(this.tool)) {
            return;
        }
        
        // 文件必须存在
        if (!this.file || !fs.existsSync(this.file)) {
            return;
        }
        
        // 根据文件类型执行检查
        const ext = path.extname(this.file);
        const errors = await this.checkByFileType(ext);
        
        // 只在有严重错误时输出
        if (errors.critical && errors.critical.length > 0) {
            this.reportErrors(errors);
        }
    }
    
    /**
     * 根据文件类型执行检查
     */
    async checkByFileType(ext) {
        const errors = {
            critical: [],
            warnings: []
        };
        
        switch (ext) {
            case '.js':
            case '.jsx':
                return this.checkJavaScript(this.file);
            
            case '.ts':
            case '.tsx':
                return this.checkTypeScript(this.file);
            
            case '.py':
                return this.checkPython(this.file);
            
            case '.json':
                return this.checkJSON(this.file);
            
            case '.yaml':
            case '.yml':
                return this.checkYAML(this.file);
            
            default:
                // 其他文件类型暂不检查
                return errors;
        }
    }
    
    /**
     * 检查 JavaScript 文件
     */
    async checkJavaScript(filePath) {
        const errors = {
            critical: [],
            warnings: []
        };
        
        try {
            // 使用 Node.js 进行语法检查
            const { stderr } = await execAsync(`node -c "${filePath}"`, {
                cwd: this.projectRoot
            });
            
            if (stderr) {
                errors.critical.push({
                    file: filePath,
                    message: stderr.trim()
                });
            }
        } catch (error) {
            // 解析错误信息
            const match = error.message.match(/([^:]+):(\d+)/);
            if (match) {
                errors.critical.push({
                    file: filePath,
                    line: match[2],
                    message: error.message.split('\n')[0]
                });
            } else {
                errors.critical.push({
                    file: filePath,
                    message: error.message
                });
            }
        }
        
        return errors;
    }
    
    /**
     * 检查 TypeScript 文件
     */
    async checkTypeScript(filePath) {
        const errors = {
            critical: [],
            warnings: []
        };
        
        // 检查是否有 TypeScript
        const hasTsc = await this.commandExists('tsc');
        if (!hasTsc) {
            return errors; // 没有 TypeScript，跳过检查
        }
        
        try {
            const { stdout, stderr } = await execAsync(
                `tsc --noEmit --skipLibCheck "${filePath}"`,
                { cwd: this.projectRoot }
            );
            
            if (stderr || stdout) {
                const output = stderr || stdout;
                const lines = output.split('\n');
                
                lines.forEach(line => {
                    const match = line.match(/(.+)\((\d+),(\d+)\): error TS\d+: (.+)/);
                    if (match) {
                        errors.critical.push({
                            file: match[1],
                            line: match[2],
                            column: match[3],
                            message: match[4]
                        });
                    }
                });
            }
        } catch (error) {
            // TypeScript 编译错误
            const lines = error.stdout ? error.stdout.split('\n') : [];
            lines.forEach(line => {
                if (line.includes('error TS')) {
                    errors.critical.push({
                        file: filePath,
                        message: line
                    });
                }
            });
        }
        
        return errors;
    }
    
    /**
     * 检查 Python 文件
     */
    async checkPython(filePath) {
        const errors = {
            critical: [],
            warnings: []
        };
        
        try {
            await execAsync(`python -m py_compile "${filePath}"`, {
                cwd: this.projectRoot
            });
        } catch (error) {
            // Python 语法错误
            const match = error.message.match(/File "([^"]+)", line (\d+)/);
            if (match) {
                errors.critical.push({
                    file: match[1],
                    line: match[2],
                    message: error.message.split('\n').find(l => l.includes('SyntaxError')) || error.message
                });
            } else {
                errors.critical.push({
                    file: filePath,
                    message: error.message
                });
            }
        }
        
        return errors;
    }
    
    /**
     * 检查 JSON 文件
     */
    async checkJSON(filePath) {
        const errors = {
            critical: [],
            warnings: []
        };
        
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            JSON.parse(content);
        } catch (error) {
            errors.critical.push({
                file: filePath,
                message: `JSON 解析错误: ${error.message}`
            });
        }
        
        return errors;
    }
    
    /**
     * 检查 YAML 文件
     */
    async checkYAML(filePath) {
        const errors = {
            critical: [],
            warnings: []
        };
        
        // 简单检查：确保没有明显的语法错误
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            
            // 检查缩进一致性
            let indentSize = null;
            lines.forEach((line, index) => {
                if (line.trim() && !line.trim().startsWith('#')) {
                    const indent = line.match(/^(\s*)/)[1];
                    if (indent.includes('\t') && indent.includes(' ')) {
                        errors.critical.push({
                            file: filePath,
                            line: index + 1,
                            message: 'YAML 文件不应混合使用制表符和空格'
                        });
                    }
                }
            });
        } catch (error) {
            errors.critical.push({
                file: filePath,
                message: error.message
            });
        }
        
        return errors;
    }
    
    /**
     * 检查命令是否存在
     */
    async commandExists(cmd) {
        try {
            await execAsync(`which ${cmd}`);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * 报告错误
     */
    reportErrors(errors) {
        if (errors.critical.length === 0) {
            return;
        }
        
        console.log('\n⚠️  语法检查发现问题：');
        errors.critical.forEach(error => {
            if (error.line) {
                console.log(`  ${error.file}:${error.line} - ${error.message}`);
            } else {
                console.log(`  ${error.file} - ${error.message}`);
            }
        });
        console.log('');
    }
}

// CLI 入口
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    // 解析命令行参数（支持 --key=value 和 --key value 两种格式）
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            if (arg.includes('=')) {
                // 格式: --key=value
                const [key, value] = arg.split('=', 2);
                const cleanKey = key.replace('--', '');
                options[cleanKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
            } else {
                // 格式: --key value
                const key = arg.replace('--', '');
                const value = args[i + 1];
                options[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
                i++; // 跳过下一个参数（因为它是值）
            }
        }
    }
    
    const checker = new QuickChecker(options);
    checker.check().catch(console.error);
}

module.exports = QuickChecker;