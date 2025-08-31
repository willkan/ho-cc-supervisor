/**
 * CC-Supervisor 简单模板引擎
 * 提供基础的模板渲染功能
 */

const fs = require('fs');
const path = require('path');

class TemplateEngine {
    constructor(options = {}) {
        this.options = {
            templatesDir: options.templatesDir || path.join(__dirname, '..', 'templates'),
            ...options
        };
        this.variables = new Map();
    }

    /**
     * 设置模板变量
     */
    setVariable(key, value) {
        if (typeof key === 'object') {
            Object.entries(key).forEach(([k, v]) => {
                this.variables.set(k, v);
            });
        } else {
            this.variables.set(key, value);
        }
    }

    /**
     * 渲染模板
     */
    render(template, context = {}) {
        const fullContext = {
            ...Object.fromEntries(this.variables),
            ...context,
            DATE: new Date().toISOString().split('T')[0],
            TIMESTAMP: new Date().toISOString(),
            YEAR: new Date().getFullYear()
        };

        let result = template;

        // 处理条件渲染 {{#if condition}}...{{/if}}
        result = this.processConditionals(result, fullContext);

        // 处理循环 {{#each array}}...{{/each}}
        result = this.processLoops(result, fullContext);

        // 处理变量替换 {{variable}}
        result = this.processVariables(result, fullContext);

        return result;
    }

    /**
     * 处理条件渲染
     */
    processConditionals(template, context) {
        const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
        
        return template.replace(conditionalRegex, (match, condition, content) => {
            const value = this.getValueFromPath(condition, context);
            return value ? content : '';
        });
    }

    /**
     * 处理循环
     */
    processLoops(template, context) {
        const loopRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
        
        return template.replace(loopRegex, (match, arrayName, content) => {
            const array = this.getValueFromPath(arrayName, context);
            
            if (!Array.isArray(array)) {
                return '';
            }
            
            return array.map((item, index) => {
                const itemContext = {
                    ...context,
                    item,
                    index,
                    first: index === 0,
                    last: index === array.length - 1
                };
                
                return this.processVariables(content, itemContext);
            }).join('');
        });
    }

    /**
     * 处理变量替换（支持对象JSON序列化）
     */
    processVariables(template, context) {
        const variableRegex = /\{\{(\w+(?:\.\w+)*)\}\}/g;
        
        return template.replace(variableRegex, (match, path) => {
            const value = this.getValueFromPath(path, context);
            
            if (value === undefined) {
                return match;
            }
            
            // 对象和数组序列化为JSON
            if (value !== null && typeof value === 'object') {
                return JSON.stringify(value, null, 2);
            }
            
            return String(value);
        });
    }

    /**
     * 从路径获取值
     */
    getValueFromPath(path, context) {
        const parts = path.split('.');
        let value = context;
        
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    /**
     * 加载模板文件
     */
    loadTemplate(templatePath) {
        try {
            const fullPath = path.isAbsolute(templatePath) 
                ? templatePath 
                : path.join(this.options.templatesDir, templatePath);
            
            return fs.readFileSync(fullPath, 'utf-8');
        } catch (error) {
            console.warn(`Template not found: ${templatePath}`);
            return '';
        }
    }

    /**
     * 渲染模板文件
     */
    renderFile(templatePath, context = {}) {
        const template = this.loadTemplate(templatePath);
        return this.render(template, context);
    }
}

module.exports = TemplateEngine;