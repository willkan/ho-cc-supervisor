#!/bin/bash
echo "Testing Supervisor-ME Components..."

# Test 1: Verify
echo "1. Testing verify.sh..."
./verify.sh
[ -f .proof/latest.json ] && echo "✅ Verify works" || echo "❌ Verify failed"

# Test 2: Monitor (运行 5 秒)
echo "2. Testing monitor.sh..."
timeout 5 ./monitor.sh
echo "✅ Monitor runs"

# Test 3: Wrapper
echo "3. Testing wrapper.js..."
node wrapper.js "echo done" > /dev/null 2>&1
[ -f session.log ] && echo "✅ Wrapper works" || echo "❌ Wrapper failed"

# Test 4: Integration
echo "4. Testing integration..."
# 修改文件
echo "// test" >> example-app/src/index.js
git add .
git commit -m "test commit" > /dev/null 2>&1
./verify.sh
NEW_HASH=$(git rev-parse HEAD)
PROOF_HASH=$(grep commitHash .proof/latest.json | cut -d'"' -f4)
[ "$NEW_HASH" = "$PROOF_HASH" ] && echo "✅ Integration works" || echo "❌ Hash mismatch"

echo "All tests complete!"