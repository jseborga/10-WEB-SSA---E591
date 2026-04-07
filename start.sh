#!/bin/sh
set -e

cd /app

# Wait for file system to be ready
sleep 2

CHAT_PID=""
trap '[ -n "$CHAT_PID" ] && kill "$CHAT_PID" 2>/dev/null' EXIT

# Run database migrations/push
echo "Setting up database..."
npx prisma db push --skip-generate 2>/dev/null || echo "Database already configured"

# Start chat service in background (use compiled JS for production)
echo "Starting chat service..."
if [ -f /app/mini-services/chat-service/index.js ]; then
  node /app/mini-services/chat-service/index.js &
else
  cd /app/mini-services/chat-service && node index.ts &
fi
CHAT_PID=$!
echo "Chat service started with PID $CHAT_PID"

# Give chat service time to start
sleep 2

# Start Next.js server
echo "Starting Next.js server..."
cd /app
node server.js
