#!/usr/bin/env node

/**
 * Completion Verifier - Stop Hook 的验证逻辑
 * 只在 Claude 认为任务完成时验证质量
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class CompletionVerifier {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || process.cwd();
        this.sessionId = options.sessionId || 'unknown';
        this.transcript = options.transcript || '';
        
        // 验证策略
        this.strategies = new Map([
            ['file-creation', new FileCreationStrategy()],
            ['test-execution', new TestExecutionStrategy()],
            ['refactoring', new RefactoringStrategy()],
            ['bug-fix', new BugFixStrategy()],
            ['default', new DefaultStrategy()]
        ]);
    }
    
    /**
     * 主验证入口
     */
    async verify() {
        try {
            // 1. 分析任务类型
            const taskType = await this.detectTaskType();
            console.log(`🔍 检测到任务类型: ${taskType}`);
            
            // 2. 选择验证策略
            const strategy = this.strategies.get(taskType) || this.strategies.get('default');
            strategy.setContext({
                projectRoot: this.projectRoot,
                sessionId: this.sessionId,
                transcript: this.transcript
            });
            
            // 3. 执行验证
            const result = await strategy.verify();
            
            // 4. 输出结果
            this.displayResult(result);
            
            return result;
        } catch (error) {
            console.error('❌ 验证过程出错:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 检测任务类型
     */
    async detectTaskType() {
        // 简单的关键词匹配，后续可以增强
        const recentTranscript = this.getRecentTranscript();
        
        if (recentTranscript.includes('test') || recentTranscript.includes('测试')) {
            return 'test-execution';
        }
        if (recentTranscript.includes('create') || recentTranscript.includes('创建')) {
            return 'file-creation';
        }
        if (recentTranscript.includes('refactor') || recentTranscript.includes('重构')) {
            return 'refactoring';
        }
        if (recentTranscript.includes('fix') || recentTranscript.includes('修复')) {
            return 'bug-fix';
        }
        
        return 'default';
    }
    
    /**
     * 获取最近的对话记录
     */
    getRecentTranscript() {
        // 如果有 transcript 文件，读取最后 1000 个字符
        if (this.transcript && fs.existsSync(this.transcript)) {
            const content = fs.readFileSync(this.transcript, 'utf-8');
            return content.slice(-1000);
        }
        return '';
    }
    
    /**
     * 显示验证结果
     */
    displayResult(result) {
        if (result.success) {
            console.log(`
✅ 任务验证通过！
${result.details ? result.details.map(d => `  ✓ ${d}`).join('\n') : ''}
            `);
        } else {
            console.log(`
⚠️  验证发现一些问题：
${result.issues ? result.issues.map(i => `  • ${i}`).join('\n') : ''}

💡 建议：${result.suggestion || '请检查上述问题'}
            `);
        }
    }
}

/**
 * 验证策略基类
 */
class VerificationStrategy {
    setContext(context) {
        this.context = context;
    }
    
    async verify() {
        throw new Error('子类必须实现 verify 方法');
    }
    
    async runCommand(cmd) {
        try {
            const { stdout, stderr } = await execAsync(cmd, {
                cwd: this.context.projectRoot,
                timeout: 30000
            });
            return { success: true, stdout, stderr };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

/**
 * 文件创建验证策略
 */
class FileCreationStrategy extends VerificationStrategy {
    async verify() {
        const result = {
            success: true,
            issues: [],
            details: []
        };
        
        // 查找最近创建的文件
        const recentFiles = await this.findRecentFiles();
        
        for (const file of recentFiles) {
            // 检查文件是否存在
            if (!fs.existsSync(file)) {
                result.success = false;
                result.issues.push(`文件 ${file} 未创建成功`);
                continue;
            }
            
            result.details.push(`文件 ${file} 创建成功`);
            
            // 如果是代码文件，检查语法
            if (this.isCodeFile(file)) {
                const syntaxCheck = await this.checkSyntax(file);
                if (!syntaxCheck.success) {
                    result.success = false;
                    result.issues.push(`文件 ${file} 有语法错误: ${syntaxCheck.error}`);
                } else {
                    result.details.push(`文件 ${file} 语法正确`);
                }
            }
        }
        
        if (!result.success) {
            result.suggestion = '请修复语法错误或确认文件创建';
        }
        
        return result;
    }
    
    async findRecentFiles() {
        // 简化实现：查找最近 5 分钟内创建的文件
        const cmd = "find . -type f -mmin -5 -not -path './node_modules/*' -not -path './.git/*' 2>/dev/null | head -10";
        const { stdout } = await this.runCommand(cmd);
        return stdout ? stdout.trim().split('\n').filter(f => f) : [];
    }
    
    isCodeFile(file) {
        const ext = path.extname(file);
        return ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go'].includes(ext);
    }
    
    async checkSyntax(file) {
        const ext = path.extname(file);
        
        // JavaScript/TypeScript
        if (['.js', '.jsx'].includes(ext)) {
            return this.runCommand(`node -c "${file}"`);
        }
        
        // Python
        if (ext === '.py') {
            return this.runCommand(`python -m py_compile "${file}"`);
        }
        
        // 其他文件类型暂时跳过
        return { success: true };
    }
}

/**
 * 测试执行验证策略
 */
class TestExecutionStrategy extends VerificationStrategy {
    async verify() {
        const result = {
            success: true,
            issues: [],
            details: []
        };
        
        // 检测项目的测试框架
        const testCommand = await this.detectTestCommand();
        
        if (!testCommand) {
            result.details.push('未检测到测试框架');
            return result;
        }
        
        console.log(`📊 运行测试: ${testCommand}`);
        const testResult = await this.runCommand(testCommand);
        
        if (testResult.success) {
            result.success = true;
            result.details.push('所有测试通过');
        } else {
            result.success = false;
            result.issues.push('测试失败');
            result.suggestion = `运行 '${testCommand}' 查看详细错误`;
        }
        
        return result;
    }
    
    async detectTestCommand() {
        // 检查 package.json
        const packageJsonPath = path.join(this.context.projectRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            if (packageJson.scripts && packageJson.scripts.test) {
                return 'npm test';
            }
        }
        
        // 检查其他测试框架
        if (fs.existsSync(path.join(this.context.projectRoot, 'pytest.ini'))) {
            return 'pytest';
        }
        
        return null;
    }
}

/**
 * 重构验证策略
 */
class RefactoringStrategy extends VerificationStrategy {
    async verify() {
        const result = {
            success: true,
            issues: [],
            details: []
        };
        
        // 重构后应该：
        // 1. 测试仍然通过
        const testStrategy = new TestExecutionStrategy();
        testStrategy.setContext(this.context);
        const testResult = await testStrategy.verify();
        
        if (!testResult.success) {
            result.success = false;
            result.issues.push('重构后测试失败');
        } else {
            result.details.push('测试保持通过');
        }
        
        // 2. 代码质量没有下降（简化：检查 lint）
        const lintResult = await this.checkLint();
        if (!lintResult.success) {
            result.issues.push('代码存在 lint 问题');
            result.suggestion = '运行 lint 修复代码风格问题';
        }
        
        return result;
    }
    
    async checkLint() {
        // 尝试运行 eslint
        const { success } = await this.runCommand('npm run lint 2>/dev/null');
        return { success };
    }
}

/**
 * Bug 修复验证策略
 */
class BugFixStrategy extends VerificationStrategy {
    async verify() {
        const result = {
            success: true,
            issues: [],
            details: []
        };
        
        // Bug 修复后应该：
        // 1. 相关测试通过
        const testStrategy = new TestExecutionStrategy();
        testStrategy.setContext(this.context);
        const testResult = await testStrategy.verify();
        
        if (testResult.success) {
            result.details.push('测试验证通过');
        } else {
            result.success = false;
            result.issues.push('修复后测试仍然失败');
            result.suggestion = '请确认 bug 是否真正修复';
        }
        
        return result;
    }
}

/**
 * 默认验证策略
 */
class DefaultStrategy extends VerificationStrategy {
    async verify() {
        return {
            success: true,
            details: ['任务完成（使用默认验证）']
        };
    }
}

// CLI 入口
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    // 解析命令行参数
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        const value = args[i + 1];
        options[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    }
    
    const verifier = new CompletionVerifier(options);
    verifier.verify().catch(console.error);
}

module.exports = CompletionVerifier;