#!/bin/bash

# Start Supervisor to monitor Worker session
echo "🔍 Starting Supervisor..."
echo "📊 Monitoring Worker session"

# Show usage if help is requested
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    echo ""
    echo "Usage: $0 [session-file]"
    echo ""
    echo "Options:"
    echo "  session-file    Path to worker session log (default: .super/worker-session.log)"
    echo ""
    echo "Example:"
    echo "  $0                    # Use default session file"
    echo "  $0 /tmp/session.log   # Use custom session file"
    exit 0
fi

echo ""

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if first argument looks like a Claude parameter (starts with --)
if [[ "$1" == --* ]]; then
    echo "⚠️  Note: Supervisor doesn't need Claude parameters"
    echo "   Using default session file: .super/worker-session.log"
    SESSION_FILE=".super/worker-session.log"
else
    # Optional: specify custom session file as first argument
    SESSION_FILE="${1:-.super/worker-session.log}"
fi

# Run the session monitor with correct path
node "$SCRIPT_DIR/lib/session-monitor.js" "$SESSION_FILE"