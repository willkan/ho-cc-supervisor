#!/bin/bash

# CC-Supervisor 完整测试套件
# 用于 CI/CD 和本地验证

set -e  # 遇到错误立即退出

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  CC-Supervisor 测试套件               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 运行测试函数
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "${YELLOW}▶ 运行: $test_name${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if $test_command; then
        echo -e "${GREEN}  ✅ $test_name 通过${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}  ❌ $test_name 失败${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# 1. 基础功能测试
echo -e "${BLUE}[1/5] 基础功能测试${NC}"
run_test "CLI 命令帮助" "cc-supervisor --help > /dev/null 2>&1"
run_test "验证命令可用" "cc-supervisor verify --help > /dev/null 2>&1"

# 2. 模板引擎测试
echo -e "\n${BLUE}[2/5] 模板引擎测试${NC}"
template_test() {
    node -e 'const TemplateEngine = require("./lib/template-engine"); const engine = new TemplateEngine(); const result = engine.render("{{name}}", {name: "test"}); if (result !== "test") { console.error("Expected test, got", result); process.exit(1); } console.log("Template test OK");'
}
run_test "模板引擎渲染" "template_test"

# 3. 验证链路测试
echo -e "\n${BLUE}[3/5] 验证链路测试${NC}"
run_test "验证链路完整性" "node test/verification-chain.test.js"

# 4. Hook 脚本测试
echo -e "\n${BLUE}[4/5] Hook 脚本测试${NC}"
run_test "Stop Hook 可执行" "test -x .claude/hooks/stop.sh"
run_test "Post Tool Use Hook 可执行" "test -x .claude/hooks/post-tool-use.sh"
run_test "Prompt Submit Hook 可执行" "test -x .claude/hooks/user-prompt-submit.sh"

# 5. 配置文件测试
echo -e "\n${BLUE}[5/5] 配置文件测试${NC}"
settings_test() {
    node -e 'const fs = require("fs"); JSON.parse(fs.readFileSync(".claude/settings.json")); console.log("Settings valid");' > /dev/null 2>&1
}
package_test() {
    node -e 'const fs = require("fs"); JSON.parse(fs.readFileSync("package.json")); console.log("Package valid");' > /dev/null 2>&1
}
run_test "Settings.json 有效" "settings_test"
run_test "Package.json 有效" "package_test"

# 总结
echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}测试总结:${NC}"
echo -e "  总计: $TOTAL_TESTS"
echo -e "  ${GREEN}通过: $PASSED_TESTS${NC}"
if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "  ${RED}失败: $FAILED_TESTS${NC}"
fi

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 所有测试通过！${NC}"
    exit 0
else
    echo -e "\n${RED}❌ 有 $FAILED_TESTS 个测试失败${NC}"
    exit 1
fi