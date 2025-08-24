#!/bin/bash

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "================================================"
echo "     Supervisor-ME Complete Test Suite"
echo "================================================"
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

# 测试函数
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "${BLUE}Testing:${NC} $test_name"
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅ PASSED${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "  ${RED}❌ FAILED${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# 1. 测试项目结构
echo -e "${YELLOW}1. Project Structure Tests${NC}"
echo "----------------------------------------"

run_test "example-app directory exists" "[ -d example-app ]"
run_test "example-app/src directory exists" "[ -d example-app/src ]"
run_test "example-app/tests directory exists" "[ -d example-app/tests ]"
run_test ".proof directory exists" "[ -d .proof ]"
run_test "verify.sh exists and is executable" "[ -x verify.sh ]"
run_test "monitor.sh exists and is executable" "[ -x monitor.sh ]"
run_test "wrapper.js exists and is executable" "[ -x wrapper.js ]"

echo ""

# 2. 测试 example-app
echo -e "${YELLOW}2. Example App Tests${NC}"
echo "----------------------------------------"

run_test "package.json exists" "[ -f example-app/package.json ]"
run_test "src/index.js exists" "[ -f example-app/src/index.js ]"
run_test "tests/index.test.js exists" "[ -f example-app/tests/index.test.js ]"
run_test "node_modules installed" "[ -d example-app/node_modules ]"

# 运行 npm test
echo -e "${BLUE}Testing:${NC} npm test runs successfully"
cd example-app
if npm test > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "  ${RED}❌ FAILED${NC}"
    ((TESTS_FAILED++))
fi
cd ..

echo ""

# 3. 测试 verify.sh
echo -e "${YELLOW}3. Verify Script Tests${NC}"
echo "----------------------------------------"

echo -e "${BLUE}Testing:${NC} verify.sh runs successfully"
if ./verify.sh > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "  ${RED}❌ FAILED${NC}"
    ((TESTS_FAILED++))
fi

run_test "latest.json created" "[ -f .proof/latest.json ]"

# 验证 JSON 格式
echo -e "${BLUE}Testing:${NC} latest.json is valid JSON"
if python3 -m json.tool .proof/latest.json > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "  ${RED}❌ FAILED${NC}"
    ((TESTS_FAILED++))
fi

# 验证 JSON 内容
echo -e "${BLUE}Testing:${NC} latest.json contains required fields"
if grep -q '"timestamp"' .proof/latest.json && \
   grep -q '"commitHash"' .proof/latest.json && \
   grep -q '"tests"' .proof/latest.json && \
   grep -q '"status"' .proof/latest.json; then
    echo -e "  ${GREEN}✅ PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "  ${RED}❌ FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo ""

# 4. 测试故障场景
echo -e "${YELLOW}4. Failure Scenario Tests${NC}"
echo "----------------------------------------"

# 临时破坏测试
echo -e "${BLUE}Testing:${NC} verify.sh detects test failures"

# 备份原始文件
cp example-app/src/index.js example-app/src/index.js.backup

# 破坏代码
cat > example-app/src/index.js << 'EOF'
function add(a, b) {
  return a - b; // 故意错误
}

function multiply(a, b) {
  return a * b;
}

module.exports = {
  add,
  multiply
};
EOF

# 运行验证，应该失败
if ! ./verify.sh > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ PASSED${NC} (correctly detected failure)"
    ((TESTS_PASSED++))
    
    # 检查状态是否为 FAIL
    if grep -q '"status": "FAIL"' .proof/latest.json; then
        echo -e "${BLUE}Testing:${NC} status correctly set to FAIL"
        echo -e "  ${GREEN}✅ PASSED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${BLUE}Testing:${NC} status correctly set to FAIL"
        echo -e "  ${RED}❌ FAILED${NC}"
        ((TESTS_FAILED++))
    fi
else
    echo -e "  ${RED}❌ FAILED${NC} (should have detected failure)"
    ((TESTS_FAILED++))
fi

# 恢复原始文件
mv example-app/src/index.js.backup example-app/src/index.js

echo ""

# 5. 测试 wrapper.js
echo -e "${YELLOW}5. Wrapper Script Tests${NC}"
echo "----------------------------------------"

echo -e "${BLUE}Testing:${NC} wrapper.js shows help"
if node wrapper.js 2>&1 | grep -q "Supervisor-ME Claude Code Wrapper"; then
    echo -e "  ${GREEN}✅ PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "  ${RED}❌ FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo -e "${BLUE}Testing:${NC} wrapper.js executes commands"
if node wrapper.js "echo test" 2>&1 | grep -q "test"; then
    echo -e "  ${GREEN}✅ PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "  ${RED}❌ FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo ""

# 6. 清理测试
echo -e "${YELLOW}6. Cleanup Tests${NC}"
echo "----------------------------------------"

# 运行最终验证确保一切恢复正常
echo -e "${BLUE}Testing:${NC} final verification passes"
if ./verify.sh > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ PASSED${NC}"
    ((TESTS_PASSED++))
    
    # 检查最终状态
    if grep -q '"status": "PASS"' .proof/latest.json; then
        echo -e "${BLUE}Testing:${NC} final status is PASS"
        echo -e "  ${GREEN}✅ PASSED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${BLUE}Testing:${NC} final status is PASS"
        echo -e "  ${RED}❌ FAILED${NC}"
        ((TESTS_FAILED++))
    fi
else
    echo -e "  ${RED}❌ FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo "================================================"
echo "              Test Results Summary"
echo "================================================"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))

echo -e "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
    echo "The Supervisor-ME system is working correctly."
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo "Please review the failures above."
    exit 1
fi