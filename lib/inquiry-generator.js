/**
 * Inquiry Generator - 智能询问生成器
 * 基于上下文生成自然、针对性的询问
 */

class InquiryGenerator {
    constructor() {
        // 询问模板库
        this.templates = {
            test_failure: {
                specific: [
                    "我看到 {test_name} 测试失败了，错误信息是 {error}，是不是 {possible_cause}？",
                    "刚跑了下测试，{test_name} 过不了，提示 {error}，要不要看看？",
                    "{test_name} 这个测试一直失败，好像是 {possible_cause}，能修复下吗？"
                ],
                generic: [
                    "测试好像有问题，能看看吗？",
                    "有几个测试失败了，需要修复下",
                    "测试没通过，要不要调试下？"
                ]
            },
            
            missing_edge_case: [
                "这个 {function_name} 函数如果输入 {edge_case} 会怎样？",
                "考虑过 {edge_case} 的情况吗？",
                "如果 {condition}，代码会正常工作吗？",
                "{edge_case} 这种边界情况处理了吗？"
            ],
            
            error_handling: [
                "这里如果 {error_scenario} 会抛异常吗？",
                "{function_name} 的错误处理看起来不完整，{error_scenario} 的情况考虑了吗？",
                "如果 {dependency} 不可用，会有合适的错误提示吗？",
                "网络请求失败的情况处理了吗？"
            ],
            
            performance: [
                "这个 {operation} 在大数据量下性能如何？",
                "{function_name} 看起来有点慢，要不要优化下？",
                "这里会不会有内存泄漏的风险？",
                "循环嵌套有点深，O(n²) 的复杂度能接受吗？"
            ],
            
            security: [
                "这个输入有做验证吗？会不会有注入风险？",
                "{data_source} 的数据是可信的吗？",
                "敏感信息有加密存储吗？",
                "这个 API 端点需要认证吗？"
            ],
            
            code_quality: [
                "这个函数有点长，要不要拆分下？",
                "变量名 {var_name} 不太直观，能改个更清晰的吗？",
                "这段代码和 {other_file} 里的很像，要不要抽取成公共函数？",
                "注释有点少，其他人能看懂这段逻辑吗？"
            ],
            
            missing_tests: [
                "这个新功能的测试写了吗？",
                "{function_name} 函数好像没有对应的测试？",
                "单元测试覆盖率够吗？",
                "集成测试跑过了吗？"
            ],
            
            api_contract: [
                "这个 API 的返回格式改了，前端知道吗？",
                "接口文档更新了吗？",
                "破坏性变更需要版本控制吧？",
                "向后兼容性考虑了吗？"
            ],
            
            concurrency: [
                "这里有并发访问，会不会有竞态条件？",
                "多线程环境下这个代码安全吗？",
                "需要加锁吗？",
                "这个共享资源的访问是线程安全的吗？"
            ],
            
            dependencies: [
                "新加的这个依赖包有必要吗？",
                "这个库的许可证兼容吗？",
                "依赖版本锁定了吗？",
                "有更轻量的替代方案吗？"
            ]
        };
        
        // 前缀变化（增加自然度）
        this.prefixes = [
            "",
            "Hey, ",
            "BTW, ",
            "Quick question - ",
            "Just noticed, ",
            "Hmm, ",
            "One thing, ",
            "小问题 - ",
            "对了，",
            "顺便问下，"
        ];
        
        // 后缀变化
        this.suffixes = [
            "",
            " 😊",
            " 🤔",
            "？",
            "...",
            " 谢谢！",
            " 不急的话",
        ];
        
        // 上下文记忆
        this.context = {
            recentTopics: [],
            askedQuestions: [],
            projectInfo: null
        };
    }
    
    /**
     * 生成智能询问
     * @param {Object} issue - 问题详情
     * @param {Object} projectContext - 项目上下文
     */
    generate(issue, projectContext = null) {
        // 更新上下文
        if (projectContext) {
            this.context.projectInfo = projectContext;
        }
        
        // 选择合适的模板类别
        const category = this.categorizeIssue(issue);
        
        // 获取模板
        let templates = this.templates[category];
        if (!templates) {
            templates = this.getFallbackTemplates();
        }
        
        // 如果是对象，选择合适的子类别
        if (templates.specific && templates.generic) {
            templates = issue.details ? templates.specific : templates.generic;
        }
        
        // 随机选择一个模板
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        // 填充模板
        let question = this.fillTemplate(template, issue);
        
        // 添加自然变化
        question = this.addNaturalVariation(question);
        
        // 记录已问过的问题（避免重复）
        this.context.askedQuestions.push(question);
        if (this.context.askedQuestions.length > 50) {
            this.context.askedQuestions.shift();
        }
        
        return question;
    }
    
    /**
     * 分类问题
     */
    categorizeIssue(issue) {
        const { type, category, keywords } = issue;
        
        // 直接匹配类型
        if (type && this.templates[type]) {
            return type;
        }
        
        // 关键词匹配
        if (keywords) {
            for (const keyword of keywords) {
                if (keyword.includes('test') || keyword.includes('fail')) {
                    return 'test_failure';
                }
                if (keyword.includes('performance') || keyword.includes('slow')) {
                    return 'performance';
                }
                if (keyword.includes('security') || keyword.includes('auth')) {
                    return 'security';
                }
                if (keyword.includes('error') || keyword.includes('exception')) {
                    return 'error_handling';
                }
            }
        }
        
        // 默认类别
        return 'code_quality';
    }
    
    /**
     * 填充模板
     */
    fillTemplate(template, issue) {
        let result = template;
        
        // 提取所有占位符
        const placeholders = template.match(/\{([^}]+)\}/g) || [];
        
        for (const placeholder of placeholders) {
            const key = placeholder.slice(1, -1); // 移除花括号
            const value = this.getValueForPlaceholder(key, issue);
            result = result.replace(placeholder, value);
        }
        
        return result;
    }
    
    /**
     * 获取占位符的值
     */
    getValueForPlaceholder(key, issue) {
        // 从 issue 中获取
        if (issue.details && issue.details[key]) {
            return issue.details[key];
        }
        
        // 生成默认值
        const defaults = {
            test_name: issue.testName || '测试',
            function_name: issue.functionName || '这个函数',
            error: issue.error || '错误',
            possible_cause: issue.cause || '参数验证问题',
            edge_case: issue.edgeCase || '空值',
            condition: '特殊情况',
            error_scenario: '网络断开',
            dependency: '外部服务',
            operation: '这个操作',
            data_source: '用户输入',
            var_name: 'temp',
            other_file: '其他模块'
        };
        
        return defaults[key] || key;
    }
    
    /**
     * 添加自然变化
     */
    addNaturalVariation(question) {
        // 随机添加前缀
        if (Math.random() < 0.3) {
            const prefix = this.prefixes[Math.floor(Math.random() * this.prefixes.length)];
            question = prefix + question;
        }
        
        // 随机添加后缀
        if (Math.random() < 0.2) {
            const suffix = this.suffixes[Math.floor(Math.random() * this.suffixes.length)];
            question = question + suffix;
        }
        
        // 随机变化语气
        if (Math.random() < 0.1) {
            question = this.varyTone(question);
        }
        
        return question;
    }
    
    /**
     * 变化语气
     */
    varyTone(question) {
        const variations = [
            (q) => q.replace('能', '可以'),
            (q) => q.replace('吗？', '呢？'),
            (q) => q.replace('要不要', '需要'),
            (q) => q.replace('看看', '检查下'),
            (q) => q.replace('好像', '似乎'),
            (q) => q.replace('有点', '可能有些')
        ];
        
        const variation = variations[Math.floor(Math.random() * variations.length)];
        return variation(question);
    }
    
    /**
     * 获取后备模板
     */
    getFallbackTemplates() {
        return [
            "代码看起来不错，不过有个小细节想确认下",
            "这个实现挺好的，就是有个地方不太确定",
            "功能实现了，但可能还有优化空间",
            "整体没问题，有个边界情况要考虑下"
        ];
    }
    
    /**
     * 生成基于具体代码的询问
     */
    generateCodeSpecificInquiry(code, issue) {
        // 分析代码特征
        const features = this.analyzeCode(code);
        
        // 基于特征生成询问
        if (features.hasAsyncAwait && !features.hasTryCatch) {
            return "这个 async 函数没有 try-catch，异步错误怎么处理？";
        }
        
        if (features.hasLoop && features.loopDepth > 2) {
            return `嵌套循环有 ${features.loopDepth} 层，会不会影响性能？`;
        }
        
        if (features.hasHardcodedValues) {
            return "这些硬编码的值要不要抽取成配置？";
        }
        
        if (features.functionLength > 50) {
            return "这个函数有点长，要不要拆分成几个小函数？";
        }
        
        // 默认询问
        return this.generate(issue);
    }
    
    /**
     * 分析代码特征
     */
    analyzeCode(code) {
        return {
            hasAsyncAwait: /async|await/.test(code),
            hasTryCatch: /try\s*\{/.test(code),
            hasLoop: /for|while/.test(code),
            loopDepth: (code.match(/for|while/g) || []).length,
            hasHardcodedValues: /["']\d+["']|["']\w+@\w+\.com["']/.test(code),
            functionLength: code.split('\n').length
        };
    }
    
    /**
     * 生成跟进询问
     */
    generateFollowUp(previousQuestion, response) {
        const followUps = [
            "明白了，那 {aspect} 这方面呢？",
            "好的，顺便问下 {related_issue}",
            "了解，还有个相关的问题...",
            "OK，那这个改动会影响 {component} 吗？"
        ];
        
        const template = followUps[Math.floor(Math.random() * followUps.length)];
        
        // 基于之前的问题生成相关询问
        return template.replace('{aspect}', '性能')
                      .replace('{related_issue}', '测试覆盖率够吗')
                      .replace('{component}', '其他模块');
    }
}

module.exports = InquiryGenerator;