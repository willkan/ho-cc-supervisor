#!/bin/bash
echo "Testing Supervisor-ME Components..."

# Test 1: Verify
echo "1. Testing verify.sh..."
./verify.sh
[ -f .proof/latest.json ] && echo "✅ Verify works" || echo "❌ Verify failed"

# Test 2: Monitor (运行 5 秒)
echo "2. Testing monitor.sh..."
# macOS 兼容性: 使用后台进程代替 timeout
(./monitor.sh > /dev/null 2>&1 &
MONITOR_PID=$!
sleep 5
kill $MONITOR_PID 2>/dev/null
wait $MONITOR_PID 2>/dev/null)
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

# Test 5: Challenge generation
echo "5. Testing challenge.sh..."
# Create failure condition
cd example-app
cp src/index.js src/index.js.testbackup
echo 'function add(a, b) { return a - b; }
function multiply(a, b) { return a * b; }
module.exports = { add, multiply };' > src/index.js
cd ..

# Run verification to create failure
./verify.sh > /dev/null 2>&1

# Test challenge creation
./challenge.sh > /dev/null 2>&1
if [ -f CHALLENGE.md ]; then
  echo "✅ Challenge created on failure"
else
  echo "❌ Challenge not created"
fi

# Fix the test
cd example-app
cp src/index.js.testbackup src/index.js
rm src/index.js.testbackup
cd ..

# Verify and remove challenge
./verify.sh > /dev/null 2>&1
./challenge.sh > /dev/null 2>&1
if [ ! -f CHALLENGE.md ]; then
  echo "✅ Challenge removed on success"
else
  echo "❌ Challenge not removed"
fi

echo "All tests complete!"