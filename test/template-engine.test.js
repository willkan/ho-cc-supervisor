/**
 * 模板引擎单元测试
 */

const TemplateEngine = require('../lib/template-engine');
const assert = require('assert');

describe('TemplateEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new TemplateEngine();
    });

    describe('Variable Replacement', () => {
        it('should replace simple variables', () => {
            const template = 'Hello {{name}}!';
            const result = engine.render(template, { name: 'World' });
            assert.strictEqual(result, 'Hello World!');
        });

        it('should handle nested object paths', () => {
            const template = 'User: {{user.name}}, Email: {{user.email}}';
            const result = engine.render(template, {
                user: { name: 'Alice', email: 'alice@example.com' }
            });
            assert.strictEqual(result, 'User: Alice, Email: alice@example.com');
        });

        it('should serialize objects to JSON', () => {
            const template = 'Data: {{data}}';
            const result = engine.render(template, {
                data: { key: 'value', num: 123 }
            });
            assert(result.includes('"key": "value"'));
            assert(result.includes('"num": 123'));
        });

        it('should handle arrays', () => {
            const template = 'Items: {{items}}';
            const result = engine.render(template, {
                items: ['a', 'b', 'c']
            });
            assert(result.includes('["a","b","c"]') || result.includes('[\n  "a",\n  "b",\n  "c"\n]'));
        });
    });

    describe('Conditionals', () => {
        it('should render content when condition is true', () => {
            const template = '{{#if show}}Visible{{/if}}';
            const result = engine.render(template, { show: true });
            assert.strictEqual(result, 'Visible');
        });

        it('should not render content when condition is false', () => {
            const template = '{{#if show}}Hidden{{/if}}';
            const result = engine.render(template, { show: false });
            assert.strictEqual(result, '');
        });

        it('should handle nested conditions', () => {
            const template = '{{#if user}}Hello {{user.name}}{{/if}}';
            const result = engine.render(template, {
                user: { name: 'Bob' }
            });
            assert.strictEqual(result, 'Hello Bob');
        });
    });

    describe('Loops', () => {
        it('should iterate over arrays', () => {
            const template = '{{#each items}}{{item}} {{/each}}';
            const result = engine.render(template, {
                items: ['a', 'b', 'c']
            });
            assert.strictEqual(result, 'a b c ');
        });

        it('should provide index in loops', () => {
            const template = '{{#each items}}{{index}}:{{item}} {{/each}}';
            const result = engine.render(template, {
                items: ['x', 'y']
            });
            assert.strictEqual(result, '0:x 1:y ');
        });

        it('should handle empty arrays', () => {
            const template = '{{#each items}}{{item}}{{/each}}Empty';
            const result = engine.render(template, { items: [] });
            assert.strictEqual(result, 'Empty');
        });

        it('should handle non-arrays gracefully', () => {
            const template = '{{#each items}}{{item}}{{/each}}Done';
            const result = engine.render(template, { items: 'not-array' });
            assert.strictEqual(result, 'Done');
        });
    });

    describe('Built-in Variables', () => {
        it('should provide DATE variable', () => {
            const template = 'Today: {{DATE}}';
            const result = engine.render(template);
            assert(result.match(/Today: \d{4}-\d{2}-\d{2}/));
        });

        it('should provide YEAR variable', () => {
            const template = 'Year: {{YEAR}}';
            const result = engine.render(template);
            const currentYear = new Date().getFullYear();
            assert.strictEqual(result, `Year: ${currentYear}`);
        });

        it('should provide TIMESTAMP variable', () => {
            const template = 'Time: {{TIMESTAMP}}';
            const result = engine.render(template);
            assert(result.startsWith('Time: '));
            assert(result.includes('T'));
        });
    });

    describe('Global Variables', () => {
        it('should set and use global variables', () => {
            engine.setVariable('global', 'value');
            const template = 'Global: {{global}}';
            const result = engine.render(template);
            assert.strictEqual(result, 'Global: value');
        });

        it('should set multiple variables at once', () => {
            engine.setVariable({
                var1: 'value1',
                var2: 'value2'
            });
            const template = '{{var1}} and {{var2}}';
            const result = engine.render(template);
            assert.strictEqual(result, 'value1 and value2');
        });

        it('should allow context to override global variables', () => {
            engine.setVariable('name', 'Global');
            const template = 'Name: {{name}}';
            const result = engine.render(template, { name: 'Local' });
            assert.strictEqual(result, 'Name: Local');
        });
    });

    describe('Complex Templates', () => {
        it('should handle mixed conditionals and loops', () => {
            const template = `
{{#if hasUsers}}
Users:
{{#each users}}
- {{item.name}} ({{item.age}})
{{/each}}
{{/if}}`;
            const result = engine.render(template, {
                hasUsers: true,
                users: [
                    { name: 'Alice', age: 30 },
                    { name: 'Bob', age: 25 }
                ]
            });
            assert(result.includes('Alice (30)'));
            assert(result.includes('Bob (25)'));
        });

        it('should handle deeply nested objects', () => {
            const template = 'Value: {{a.b.c.d.e}}';
            const result = engine.render(template, {
                a: { b: { c: { d: { e: 'deep' } } } }
            });
            assert.strictEqual(result, 'Value: deep');
        });
    });
});

// 如果直接运行此文件，执行简单测试
if (require.main === module) {
    console.log('运行模板引擎单元测试...\n');
    
    let passed = 0;
    let failed = 0;
    
    function test(name, fn) {
        try {
            fn();
            console.log(`✅ ${name}`);
            passed++;
        } catch (error) {
            console.log(`❌ ${name}`);
            console.log(`   ${error.message}`);
            failed++;
        }
    }
    
    const engine = new TemplateEngine();
    
    // 基础测试
    test('变量替换', () => {
        const result = engine.render('Hello {{name}}!', { name: 'World' });
        assert.strictEqual(result, 'Hello World!');
    });
    
    test('条件渲染', () => {
        const result = engine.render('{{#if show}}Yes{{/if}}', { show: true });
        assert.strictEqual(result, 'Yes');
    });
    
    test('循环渲染', () => {
        const result = engine.render('{{#each items}}{{item}},{{/each}}', { 
            items: [1, 2, 3] 
        });
        assert.strictEqual(result, '1,2,3,');
    });
    
    test('对象序列化', () => {
        const result = engine.render('{{obj}}', { 
            obj: { a: 1, b: 2 } 
        });
        assert(result.includes('"a": 1'));
    });
    
    test('嵌套路径', () => {
        const result = engine.render('{{user.info.name}}', { 
            user: { info: { name: 'Test' } } 
        });
        assert.strictEqual(result, 'Test');
    });
    
    test('内置变量', () => {
        const result = engine.render('Year: {{YEAR}}');
        assert(result.includes(String(new Date().getFullYear())));
    });
    
    console.log(`\n测试结果: ${passed} 通过, ${failed} 失败`);
    
    if (failed > 0) {
        process.exit(1);
    }
}