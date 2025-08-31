#!/bin/bash

# 真实 Claude Code 环境测试方案
# 用于验证 Stop hook 在实际 Claude Code 会话中的行为

echo "🧪 Supervisor-ME 真实环境测试方案"
echo "================================"
echo ""
echo "⚠️  此测试需要在 Claude Code 会话中手动执行"
echo ""

# 步骤1：验证 JSON 格式
echo "📝 步骤 1: 验证 JSON 输出格式"
echo "----------------------------"
echo "运行命令："
echo "  supervisor-me verify --json | python3 -m json.tool"
echo ""
echo "预期结果："
echo "  {
    \"continue\": true,
    \"systemMessage\": \"验证反馈内容...\"
  }"
echo ""
echo "❌ 不应包含 hookSpecificOutput 字段！"
echo ""

# 步骤2：测试 Stop hook
echo "📝 步骤 2: 测试 Stop hook 直接执行"
echo "----------------------------"
echo "运行命令："
echo "  bash .claude/hooks/stop.sh"
echo ""
echo "预期结果："
echo "  输出 JSON 格式，且 Claude Code 不报错"
echo ""

# 步骤3：验证 schema 兼容性
echo "📝 步骤 3: 验证 Stop hook schema"
echo "----------------------------"
echo "创建测试脚本 test-schema.js："
cat << 'EOF' > test-schema.js
const { execSync } = require('child_process');

// Stop hook 的有效字段
const VALID_FIELDS = [
  'continue',
  'suppressOutput', 
  'stopReason',
  'decision',
  'reason',
  'systemMessage',
  'permissionDecision'
];

try {
  const output = execSync('supervisor-me verify --json', { encoding: 'utf-8' });
  const json = JSON.parse(output);
  
  console.log('✅ JSON 解析成功');
  console.log('字段:', Object.keys(json).join(', '));
  
  // 检查无效字段
  const invalidFields = Object.keys(json).filter(f => !VALID_FIELDS.includes(f));
  
  if (invalidFields.length > 0) {
    console.error('❌ 包含无效字段:', invalidFields.join(', '));
    process.exit(1);
  }
  
  console.log('✅ 所有字段符合 Stop hook schema');
  
  if (json.systemMessage) {
    console.log('✅ systemMessage 内容:');
    console.log(json.systemMessage.substring(0, 100) + '...');
  }
} catch (error) {
  console.error('❌ 测试失败:', error.message);
  process.exit(1);
}
EOF

echo "运行命令："
echo "  node test-schema.js"
echo ""

# 步骤4：在 Claude Code 中测试
echo "📝 步骤 4: 在 Claude Code 会话中测试"
echo "----------------------------"
echo "1. 创建测试文件："
echo "   echo 'console.log(\"test\");' > test.js"
echo ""
echo "2. 让 Claude 修改文件："
echo "   你: '在 test.js 中添加一个 add 函数'"
echo ""
echo "3. Claude 完成后，观察是否有验证反馈"
echo ""
echo "预期结果："
echo "  应该看到 systemMessage 的内容显示在对话中"
echo ""

# 清理函数
echo "📝 清理测试文件"
echo "----------------------------"
echo "运行命令："
echo "  rm -f test-schema.js test.js"
echo ""

echo "================================"
echo "⚠️  重要提醒："
echo ""
echo "1. Stop hook 只能使用这些字段："
echo "   - continue, suppressOutput, stopReason"
echo "   - decision, reason, systemMessage, permissionDecision"
echo ""
echo "2. 不能使用 hookSpecificOutput（这是其他 hook 的格式）"
echo ""
echo "3. 验证反馈通过 systemMessage 传递"
echo ""
echo "================================"