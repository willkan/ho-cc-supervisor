/**
 * Project Analyzer - 深度项目分析模块
 * 用于理解项目结构、代码模式和质量要求
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

class ProjectAnalyzer {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.analysis = {
            structure: {},
            stack: {},
            patterns: {},
            testingFramework: null,
            qualityRules: [],
            dependencies: {},
            recentChanges: []
        };
    }
    
    /**
     * 执行完整项目分析
     */
    async analyze() {
        console.log('[Analyzer] Starting project analysis...');
        
        await this.analyzeStructure();
        await this.detectStack();
        await this.analyzeTestingSetup();
        await this.extractQualityRules();
        await this.analyzeRecentChanges();
        
        console.log('[Analyzer] Analysis complete');
        return this.analysis;
    }
    
    /**
     * 分析项目结构
     */
    async analyzeStructure() {
        const structure = {
            hasSource: false,
            hasTests: false,
            hasDocs: false,
            hasCI: false,
            mainDirs: [],
            testDirs: [],
            configFiles: []
        };
        
        // 检查常见目录
        const commonDirs = ['src', 'lib', 'app', 'test', 'tests', 'spec', 'docs', '.github'];
        
        for (const dir of commonDirs) {
            const dirPath = path.join(this.projectRoot, dir);
            if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
                if (['src', 'lib', 'app'].includes(dir)) {
                    structure.hasSource = true;
                    structure.mainDirs.push(dir);
                }
                if (['test', 'tests', 'spec'].includes(dir)) {
                    structure.hasTests = true;
                    structure.testDirs.push(dir);
                }
                if (dir === 'docs') {
                    structure.hasDocs = true;
                }
                if (dir === '.github') {
                    structure.hasCI = true;
                }
            }
        }
        
        // 查找配置文件
        const configPatterns = [
            'package.json',
            'tsconfig.json',
            '.eslintrc*',
            'jest.config.*',
            'webpack.config.*',
            '.prettierrc*'
        ];
        
        const files = fs.readdirSync(this.projectRoot);
        for (const file of files) {
            for (const pattern of configPatterns) {
                if (file.match(new RegExp(pattern.replace('*', '.*')))) {
                    structure.configFiles.push(file);
                }
            }
        }
        
        this.analysis.structure = structure;
    }
    
    /**
     * 检测技术栈
     */
    async detectStack() {
        const stack = {
            language: null,
            framework: null,
            testRunner: null,
            buildTool: null,
            packageManager: null
        };
        
        // 检查 package.json
        const packageJsonPath = path.join(this.projectRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            // 检测语言
            stack.language = 'JavaScript/Node.js';
            if (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript) {
                stack.language = 'TypeScript';
            }
            
            // 检测框架
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            if (deps.react) stack.framework = 'React';
            else if (deps.vue) stack.framework = 'Vue';
            else if (deps.angular) stack.framework = 'Angular';
            else if (deps.express) stack.framework = 'Express';
            else if (deps.next) stack.framework = 'Next.js';
            
            // 检测测试框架
            if (deps.jest) stack.testRunner = 'Jest';
            else if (deps.mocha) stack.testRunner = 'Mocha';
            else if (deps.vitest) stack.testRunner = 'Vitest';
            else if (deps.jasmine) stack.testRunner = 'Jasmine';
            
            // 检测构建工具
            if (deps.webpack) stack.buildTool = 'Webpack';
            else if (deps.vite) stack.buildTool = 'Vite';
            else if (deps.rollup) stack.buildTool = 'Rollup';
            else if (deps.parcel) stack.buildTool = 'Parcel';
            
            // 包管理器
            if (fs.existsSync(path.join(this.projectRoot, 'yarn.lock'))) {
                stack.packageManager = 'yarn';
            } else if (fs.existsSync(path.join(this.projectRoot, 'pnpm-lock.yaml'))) {
                stack.packageManager = 'pnpm';
            } else {
                stack.packageManager = 'npm';
            }
            
            this.analysis.dependencies = deps;
        }
        
        this.analysis.stack = stack;
    }
    
    /**
     * 分析测试设置
     */
    async analyzeTestingSetup() {
        const testing = {
            framework: this.analysis.stack.testRunner,
            testCommand: null,
            coverageEnabled: false,
            testPatterns: [],
            hasE2ETests: false,
            hasUnitTests: false,
            hasIntegrationTests: false
        };
        
        // 从 package.json 获取测试命令
        const packageJsonPath = path.join(this.projectRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            testing.testCommand = packageJson.scripts?.test;
            
            // 检查覆盖率
            if (packageJson.scripts?.coverage || 
                testing.testCommand?.includes('--coverage')) {
                testing.coverageEnabled = true;
            }
        }
        
        // 分析测试文件模式
        for (const testDir of this.analysis.structure.testDirs) {
            const testPath = path.join(this.projectRoot, testDir);
            if (fs.existsSync(testPath)) {
                const files = this.walkDir(testPath);
                
                for (const file of files) {
                    if (file.includes('.test.') || file.includes('.spec.')) {
                        testing.hasUnitTests = true;
                    }
                    if (file.includes('e2e') || file.includes('integration')) {
                        testing.hasE2ETests = true;
                    }
                    
                    // 提取测试模式
                    const pattern = path.basename(file).replace(/\.(js|ts|jsx|tsx)$/, '');
                    if (!testing.testPatterns.includes(pattern)) {
                        testing.testPatterns.push(pattern);
                    }
                }
            }
        }
        
        this.analysis.testingFramework = testing;
    }
    
    /**
     * 提取质量规则
     */
    async extractQualityRules() {
        const rules = [];
        
        // 检查 ESLint 配置
        const eslintConfigs = ['.eslintrc.js', '.eslintrc.json', '.eslintrc'];
        for (const config of eslintConfigs) {
            const configPath = path.join(this.projectRoot, config);
            if (fs.existsSync(configPath)) {
                rules.push({
                    type: 'linting',
                    tool: 'ESLint',
                    configFile: config
                });
                break;
            }
        }
        
        // 检查 Prettier 配置
        if (fs.existsSync(path.join(this.projectRoot, '.prettierrc'))) {
            rules.push({
                type: 'formatting',
                tool: 'Prettier',
                configFile: '.prettierrc'
            });
        }
        
        // 检查 TypeScript 配置
        if (fs.existsSync(path.join(this.projectRoot, 'tsconfig.json'))) {
            const tsconfig = JSON.parse(
                fs.readFileSync(path.join(this.projectRoot, 'tsconfig.json'), 'utf8')
            );
            
            if (tsconfig.compilerOptions?.strict) {
                rules.push({
                    type: 'type-checking',
                    level: 'strict',
                    tool: 'TypeScript'
                });
            }
        }
        
        // 检查 CI/CD 规则
        const githubWorkflowPath = path.join(this.projectRoot, '.github', 'workflows');
        if (fs.existsSync(githubWorkflowPath)) {
            const workflows = fs.readdirSync(githubWorkflowPath);
            for (const workflow of workflows) {
                if (workflow.includes('test') || workflow.includes('ci')) {
                    rules.push({
                        type: 'ci',
                        tool: 'GitHub Actions',
                        workflow: workflow
                    });
                }
            }
        }
        
        this.analysis.qualityRules = rules;
    }
    
    /**
     * 分析最近的更改
     */
    async analyzeRecentChanges() {
        try {
            // 获取最近的提交
            const { stdout: commits } = await execPromise(
                'git log --oneline -n 10',
                { cwd: this.projectRoot }
            );
            
            const recentCommits = commits.split('\n').filter(Boolean).map(line => {
                const [hash, ...messageParts] = line.split(' ');
                return {
                    hash: hash,
                    message: messageParts.join(' ')
                };
            });
            
            // 获取最近修改的文件
            const { stdout: changes } = await execPromise(
                'git diff --name-only HEAD~5..HEAD',
                { cwd: this.projectRoot }
            );
            
            const changedFiles = changes.split('\n').filter(Boolean);
            
            this.analysis.recentChanges = {
                commits: recentCommits,
                files: changedFiles,
                focusAreas: this.identifyFocusAreas(changedFiles)
            };
            
        } catch (error) {
            // Git 可能不可用或不是 git 仓库
            this.analysis.recentChanges = {
                commits: [],
                files: [],
                focusAreas: []
            };
        }
    }
    
    /**
     * 识别关注区域
     */
    identifyFocusAreas(files) {
        const areas = new Set();
        
        for (const file of files) {
            if (file.includes('test') || file.includes('spec')) {
                areas.add('testing');
            }
            if (file.includes('auth') || file.includes('security')) {
                areas.add('authentication');
            }
            if (file.includes('api') || file.includes('route')) {
                areas.add('api');
            }
            if (file.includes('component') || file.includes('view')) {
                areas.add('ui');
            }
            if (file.includes('model') || file.includes('schema')) {
                areas.add('data-model');
            }
        }
        
        return Array.from(areas);
    }
    
    /**
     * 递归遍历目录
     */
    walkDir(dir, fileList = []) {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                this.walkDir(filePath, fileList);
            } else if (stat.isFile()) {
                fileList.push(filePath);
            }
        }
        
        return fileList;
    }
    
    /**
     * 生成分析摘要
     */
    generateSummary() {
        const { structure, stack, testingFramework, qualityRules } = this.analysis;
        
        return {
            projectType: stack.framework || stack.language || 'Unknown',
            hasTests: structure.hasTests,
            testFramework: testingFramework.framework,
            qualityTools: qualityRules.map(r => r.tool),
            mainFocusAreas: this.analysis.recentChanges.focusAreas || [],
            recommendations: this.generateRecommendations()
        };
    }
    
    /**
     * 生成建议
     */
    generateRecommendations() {
        const recommendations = [];
        
        if (!this.analysis.structure.hasTests) {
            recommendations.push('Add test coverage - no test directory found');
        }
        
        if (!this.analysis.testingFramework.coverageEnabled) {
            recommendations.push('Enable test coverage reporting');
        }
        
        if (this.analysis.qualityRules.length === 0) {
            recommendations.push('Add code quality tools (ESLint, Prettier)');
        }
        
        if (!this.analysis.structure.hasCI) {
            recommendations.push('Setup CI/CD pipeline');
        }
        
        return recommendations;
    }
}

module.exports = ProjectAnalyzer;