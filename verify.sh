#!/bin/bash

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "     Supervisor-ME Verification System"
echo "================================================"

# 检查 example-app 是否存在
if [ ! -d "example-app" ]; then
    echo -e "${RED}❌ Error: example-app directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found example-app directory${NC}"

# 确保 .proof 目录存在
mkdir -p .proof

# 进入 example-app 目录
cd example-app

# 检查 package.json 是否存在
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found in example-app${NC}"
    exit 1
fi

# 检查 node_modules 是否存在，如果不存在则安装依赖
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠ node_modules not found, installing dependencies...${NC}"
    npm install > /dev/null 2>&1
fi

# 运行测试并捕获输出
echo -e "\n${YELLOW}Running tests...${NC}"
TEST_OUTPUT=$(npm test 2>&1) || TEST_EXIT_CODE=$?

# 解析测试结果 - 优先从 Tests: 行获取（更准确）
TESTS_LINE=$(echo "$TEST_OUTPUT" | grep "Tests:")
if [ -n "$TESTS_LINE" ]; then
    TESTS_PASSED=$(echo "$TESTS_LINE" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' | head -1)
    TESTS_FAILED=$(echo "$TESTS_LINE" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' | head -1)
else
    # 备用方案：从其他行获取
    TESTS_PASSED=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' | head -1)
    TESTS_FAILED=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' | head -1)
fi

# 设置默认值
if [ -z "$TESTS_PASSED" ]; then
    TESTS_PASSED="0"
fi
if [ -z "$TESTS_FAILED" ]; then
    TESTS_FAILED="0"
fi
TESTS_TOTAL=$((TESTS_PASSED + TESTS_FAILED))

# 如果没有找到测试结果，尝试获取总数
if [ "$TESTS_TOTAL" -eq 0 ]; then
    # 尝试从 "Tests:" 行的 total 字段获取
    TESTS_TOTAL=$(echo "$TEST_OUTPUT" | grep "Tests:" | grep -oE '[0-9]+ total' | grep -oE '[0-9]+' | head -1)
    [ -z "$TESTS_TOTAL" ] && TESTS_TOTAL="0"
fi

# 获取 git commit hash（如果在 git 仓库中）
cd ..
COMMIT_HASH="none"
if [ -d ".git" ]; then
    COMMIT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "none")
fi

# 确定状态
STATUS="FAIL"
if [ "$TESTS_FAILED" -eq 0 ] && [ "$TESTS_TOTAL" -gt 0 ]; then
    STATUS="PASS"
fi

# 获取当前时间戳（ISO 8601 格式）
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 生成 JSON 报告
cat > .proof/latest.json << EOF
{
  "timestamp": "$TIMESTAMP",
  "commitHash": "$COMMIT_HASH",
  "tests": {
    "passed": $TESTS_PASSED,
    "failed": $TESTS_FAILED,
    "total": $TESTS_TOTAL
  },
  "status": "$STATUS"
}
EOF

# 输出结果摘要
echo ""
echo "================================================"
echo "              Verification Results"
echo "================================================"
echo -e "Timestamp: ${TIMESTAMP}"
echo -e "Commit: ${COMMIT_HASH:0:7}"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo -e "Total Tests: $TESTS_TOTAL"
echo ""

if [ "$STATUS" = "PASS" ]; then
    echo -e "${GREEN}✅ VERIFICATION PASSED${NC}"
    echo -e "${GREEN}All tests are passing!${NC}"
else
    echo -e "${RED}❌ VERIFICATION FAILED${NC}"
    if [ "$TESTS_TOTAL" -eq 0 ]; then
        echo -e "${RED}No tests found or tests could not run${NC}"
    else
        echo -e "${RED}$TESTS_FAILED test(s) are failing${NC}"
    fi
fi

echo ""
echo "Proof saved to: .proof/latest.json"
echo "================================================"

# 返回适当的退出码
if [ "$STATUS" = "PASS" ]; then
    exit 0
else
    exit 1
fi