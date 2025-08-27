#!/bin/bash

# Start Worker Claude with session logging
echo "🚀 Starting Worker Claude..."
echo "📝 Session will be logged to .super/worker-session.log"

# Show passed arguments if any
if [ $# -gt 0 ]; then
    echo "📌 Arguments: $@"
fi
echo ""

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Pass all arguments to worker-wrapper
node "$SCRIPT_DIR/lib/worker-wrapper.js" "$@"