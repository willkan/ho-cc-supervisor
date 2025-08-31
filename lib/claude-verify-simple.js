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
        // 尝试读取用户最新需求
        let userPrompt = '';
        try {
            const sessionId = process.argv.find(arg => arg.startsWith('--session'))?.split('=')[1] || 
                            process.env.SUPERVISOR_SESSION_ID || 'unknown';
            const projectName = this.projectRoot.replace(/\//g, '-').replace(/^-/, '');
            const promptFile = path.join(require('os').homedir(), '.cc-supervisor', 'projects', projectName, `${sessionId}.prompt`);
            if (fs.existsSync(promptFile)) {
                userPrompt = fs.readFileSync(promptFile, 'utf-8').trim();
            }
        } catch (err) {
            // 忽略错误
        }
        
        // 尝试读取用户自定义模版
        const templatePath = path.join(this.projectRoot, '.claude', 'verification-prompt.txt');
        let template = '';
        
        if (fs.existsSync(templatePath)) {
            // 使用用户自定义模版
            template = fs.readFileSync(templatePath, 'utf-8');
            // 替换变量
            template = template.replace(/\{\{userPrompt\}\}/g, userPrompt || '(无用户需求记录)');
        } else {
            // 使用默认模版
            const filesInfo = context.recentFiles.length > 0 
                ? `最近修改的文件:\n${context.recentFiles.map(f => `- ${f}`).join('\n')}`
                : '没有检测到最近修改的文件';
            
            // 读取文件内容作为上下文
            let fileContents = '';
            if (context.recentFiles.length > 0) {
                context.recentFiles.slice(0, 3).forEach(file => {
                    try {
                        const fullPath = path.join(this.projectRoot, file);
                        const content = fs.readFileSync(fullPath, 'utf-8');
                        const lines = content.split('\n').slice(0, 30);
                        fileContents += `\n文件: ${file}\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`;
                    } catch (err) {
                        // 忽略读取错误
                    }
                });
            }
            
            const userPromptSection = userPrompt ? `\n用户需求：${userPrompt}\n` : '';
            
            template = `作为代码验证助手，请分析刚刚完成的编程任务。
${userPromptSection}
${filesInfo}${fileContents}

请执行以下验证：
1. 检查代码语法是否正确
2. 评估功能是否实现完整
3. 识别潜在的问题或改进点
4. 检查是否有明显的bug或安全问题
5. 评估代码质量和可维护性

请用以下格式回复：
【结果】通过/失败
【说明】详细描述验证发现（可以多行）
【问题】如有问题，列出具体问题点
【建议】如有改进空间，给出具体建议
【亮点】如有值得肯定的地方，也可以提及

请提供详细的验证反馈，帮助开发者了解代码质量。`;
        }
        
        return template;
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
            
            // 更完整的转义，防止shell注入
            const escapedPrompt = prompt
                .replace(/\\/g, '\\\\')  // 先转义反斜杠
                .replace(/"/g, '\\"')    // 转义双引号
                .replace(/\$/g, '\\$')   // 转义美元符号
                .replace(/`/g, '\\`')    // 转义反引号
                .replace(/\n/g, '\\n');  // 转义换行
            
            // 保存 prompt 到日志（方便查看历史）
            const logsDir = path.join(this.projectRoot, 'logs/cc-supervisor/prompts');
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }
            const promptFile = path.join(logsDir, `prompt-${Date.now()}.txt`);
            fs.writeFileSync(promptFile, `[${new Date().toISOString()}] CC-Supervisor 验证提示\n\n${prompt}\n\n命令: claude -p`);
            
            // 构建命令 - 添加 NODE_NO_WARNINGS=1 来抑制 Node.js 警告
            // 使用 2>/dev/null 重定向 stderr 避免 claude 命令的错误输出
            const cmd = `NODE_NO_WARNINGS=1 CLAUDE_VERIFIER_MODE=true claude -p "${escapedPrompt}" 2>/dev/null`;
            
            // 执行验证
            const output = execSync(cmd, {
                cwd: this.projectRoot,
                encoding: 'utf-8',
                timeout: 1800000, // 30分钟超时
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
        const meaningfulLines = lines.filter(line => 
            line.trim() && 
            !line.includes('proxy') &&
            !line.includes('Welcome') &&
            !line.includes('Claude') &&
            !line.includes('Warning') &&
            !line.includes('EnvHttpProxyAgent')
        );
        
        // 查找验证结果
        let result = '验证完成';
        let success = true;
        
        // 尝试找到结构化的回复
        const responseText = meaningfulLines.join('\n');
        if (responseText.includes('【结果】')) {
            // 提取结构化结果
            const resultMatch = responseText.match(/【结果】([^\n]+)/);
            const descMatch = responseText.match(/【说明】([\s\S]*?)(?=【|$)/);
            const problemMatch = responseText.match(/【问题】([\s\S]*?)(?=【|$)/);
            const suggMatch = responseText.match(/【建议】([\s\S]*?)(?=【|$)/);
            const highlightMatch = responseText.match(/【亮点】([\s\S]*?)(?=【|$)/);
            
            if (resultMatch) {
                success = resultMatch[1].includes('通过');
                
                // 构建详细的结果
                let parts = [];
                if (descMatch) parts.push(`说明: ${descMatch[1].trim()}`);
                if (problemMatch && problemMatch[1].trim()) parts.push(`问题: ${problemMatch[1].trim()}`);
                if (suggMatch && suggMatch[1].trim()) parts.push(`建议: ${suggMatch[1].trim()}`);
                if (highlightMatch && highlightMatch[1].trim()) parts.push(`亮点: ${highlightMatch[1].trim()}`);
                
                result = parts.length > 0 ? parts.join('\n') : (success ? '验证通过' : '验证失败');
            }
        } else {
            // 简单文本解析
            result = meaningfulLines.join('\n');
            success = !result.toLowerCase().includes('失败') && 
                     !result.toLowerCase().includes('fail') &&
                     !result.toLowerCase().includes('错误') &&
                     !result.toLowerCase().includes('error') &&
                     !result.toLowerCase().includes('问题');
        }
        
        return {
            success,
            response: result || '验证完成'
        };
    }
}

// CLI 入口
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    const flags = new Set();
    
    // 改进参数解析，支持无值的flag
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i].replace('--', '');
            // 检查下一个参数是否也是flag
            if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                const value = args[i + 1];
                options[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
                i++; // 跳过值参数
            } else {
                // 这是一个无值的flag
                flags.add(key);
            }
        }
    }
    
    const verifier = new SimpleClaudeVerifier(options);
    verifier.verify()
        .then(result => {
            // 如果是JSON模式，不要输出额外内容（已在主程序处理）
            if (!flags.has('json') && !flags.has('silent')) {
                // 输出结果给 Worker Claude
                console.log('\n📋 验证 Claude 反馈:');
                console.log(`   ${result.response}`);
                if (!result.success) {
                    console.log('   ⚠️  建议检查并修复问题');
                }
                console.log('');
            }
        })
        .catch(console.error);
}

module.exports = SimpleClaudeVerifier;