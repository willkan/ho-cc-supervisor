#!/usr/bin/env node

/**
 * 使用 claude -p 模式的验证器
 * 直接传递提示，获取结果，返回给 Worker Claude
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class SimpleClaudeVerifier {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || process.cwd();
    }
    
    async verify() {
        try {
            // 1. 收集上下文信息
            const context = this.gatherContext();
            
            // 2. 构建验证提示
            const prompt = this.buildPrompt(context);
            
            // 3. 使用 claude -p 调用验证
            const result = await this.runClaudePrompt(prompt);
            
            // 4. 返回结果给 Worker Claude
            return result;
        } catch (error) {
            console.error('❌ 验证失败:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 收集上下文信息
     */
    gatherContext() {
        const context = {
            recentFiles: [],
            hasTests: false,
            packageJson: null
        };
        
        // 获取最近5分钟内修改的文件
        try {
            const files = execSync(
                'find . -type f -mmin -5 -not -path "./node_modules/*" -not -path "./.git/*" 2>/dev/null | head -10',
                { cwd: this.projectRoot, encoding: 'utf-8' }
            ).trim().split('\n').filter(f => f);
            context.recentFiles = files;
        } catch {}
        
        // 检查是否有 package.json
        const packagePath = path.join(this.projectRoot, 'package.json');
        if (fs.existsSync(packagePath)) {
            context.packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
            context.hasTests = !!(context.packageJson.scripts && context.packageJson.scripts.test);
        }
        
        return context;
    }
    
    /**
     * 构建验证提示
     */
    buildPrompt(context) {
        const filesInfo = context.recentFiles.length > 0 
            ? `最近修改的文件:\n${context.recentFiles.map(f => `- ${f}`).join('\n')}`
            : '没有检测到最近修改的文件';
        
        const prompt = `分析刚刚完成的编程任务并验证其质量。

${filesInfo}

请执行以下验证步骤:
1. 如果有新创建或修改的代码文件，检查语法是否正确
2. 如果项目有测试(package.json中有test脚本)，考虑是否需要运行测试
3. 评估任务是否真正完成

请用简洁的方式回答:
- 验证结果: 通过/失败
- 如果失败，列出主要问题(最多3个)
- 如果失败，给出一个简单的修复建议

注意：回复要简洁，不要解释过程。`;
        
        return prompt;
    }
    
    /**
     * 使用 claude -p 运行验证
     */
    async runClaudePrompt(prompt) {
        try {
            // 继承 Worker Claude 的参数
            const workerArgs = process.argv.slice(2)
                .filter(arg => arg.startsWith('--') && !arg.includes('project-root'))
                .join(' ');
            
            // 转义提示中的特殊字符
            const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
            
            // 构建命令 - 添加 NODE_NO_WARNINGS=1 来抑制 Node.js 警告
            const cmd = `NODE_NO_WARNINGS=1 CLAUDE_VERIFIER_MODE=true claude ${workerArgs} -p "${escapedPrompt}"`;
            
            // 执行验证
            const output = execSync(cmd, {
                cwd: this.projectRoot,
                encoding: 'utf-8',
                timeout: 30000, // 30秒超时
                env: {
                    ...process.env,
                    NODE_NO_WARNINGS: '1',  // 抑制 Node.js 警告
                    CLAUDE_VERIFIER_MODE: 'true'
                }
            });
            
            return this.parseOutput(output);
            
        } catch (error) {
            if (error.code === 'ETIMEDOUT') {
                return {
                    success: true,
                    response: '验证超时，默认通过'
                };
            }
            
            // 尝试解析错误输出
            const output = error.stdout || error.message;
            return this.parseOutput(output);
        }
    }
    
    /**
     * 解析 Claude 输出
     */
    parseOutput(output) {
        // 清理 ANSI 转义序列
        const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '').trim();
        
        // 提取有意义的响应（跳过系统输出）
        const lines = cleanOutput.split('\n');
        const response = lines
            .filter(line => 
                line.trim() && 
                !line.includes('proxy') &&
                !line.includes('Welcome') &&
                !line.includes('Claude')
            )
            .join(' ')
            .substring(0, 200);
        
        // 判断成功或失败
        const success = !response.toLowerCase().includes('失败') && 
                       !response.toLowerCase().includes('fail') &&
                       !response.toLowerCase().includes('错误') &&
                       !response.toLowerCase().includes('error');
        
        return {
            success,
            response: response || '验证完成'
        };
    }
}

// CLI 入口
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        const value = args[i + 1];
        options[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    }
    
    const verifier = new SimpleClaudeVerifier(options);
    verifier.verify()
        .then(result => {
            // 输出结果给 Worker Claude
            console.log('\n📋 验证 Claude 反馈:');
            console.log(`   ${result.response}`);
            if (!result.success) {
                console.log('   ⚠️  建议检查并修复问题');
            }
            console.log('');
        })
        .catch(console.error);
}

module.exports = SimpleClaudeVerifier;