#!/bin/bash

# challenge.sh - 生成质询文件当验证失败时
# Part 5: 压力循环（简化版）

# 检查是否存在最新验证结果
if [ -f .proof/latest.json ]; then
  # 提取状态
  STATUS=$(grep status .proof/latest.json | cut -d'"' -f4)
  
  # 如果状态为失败，生成质询
  if [ "$STATUS" = "FAIL" ]; then
    # 获取当前commit（如果在git仓库中）
    if git rev-parse --git-dir > /dev/null 2>&1; then
      COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "none")
    else
      COMMIT="none"
    fi
    
    # 生成质询文件
    cat > CHALLENGE.md << EOF
## 验证失败 - 需要说明

### 检测到的问题
- 测试未通过
- Commit: $COMMIT
- 时间: $(date)

### 请提供
1. 失败原因（一句话）：
2. 修复计划：
3. 预计时间：

### 终端证据
\`\`\`
$(cd example-app && npm test 2>&1 | tail -20)
\`\`\`
EOF
    
    echo "❌ Challenge created: CHALLENGE.md"
    echo "   Please provide explanation for test failures"
    exit 1
  else
    echo "✅ Verification passed - no challenge needed"
    # 如果验证通过但存在旧的质询文件，清理它
    if [ -f CHALLENGE.md ]; then
      rm CHALLENGE.md
      echo "   Removed old CHALLENGE.md"
    fi
    exit 0
  fi
else
  echo "⚠️  No verification results found"
  echo "   Run ./verify.sh first"
  exit 1
fi