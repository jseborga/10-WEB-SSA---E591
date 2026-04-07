#!/bin/sh
set -e

cd /app

# Wait for file system to be ready
sleep 2

CHAT_PID=""
trap '[ -n "$CHAT_PID" ] && kill "$CHAT_PID" 2>/dev/null' EXIT

if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:/app/data/custom.db"
fi

mkdir -p /app/data
chown -R nextjs:nodejs /app/data
chmod -R u+rwX,g+rwX /app/data

touch /app/data/.write-test
rm -f /app/data/.write-test

# Run database migrations/push
echo "Setting up database..."
if [ ! -f /app/node_modules/prisma/build/index.js ]; then
  echo "Prisma CLI not found at /app/node_modules/prisma/build/index.js"
  exit 1
fi
su-exec nextjs:nodejs node /app/node_modules/prisma/build/index.js db push --skip-generate

# Start chat service in background (use compiled JS for production)
echo "Starting chat service..."
if [ -f /app/mini-services/chat-service/index.js ]; then
  su-exec nextjs:nodejs node /app/mini-services/chat-service/index.js &
else
  cd /app/mini-services/chat-service && su-exec nextjs:nodejs node index.ts &
fi
CHAT_PID=$!
echo "Chat service started with PID $CHAT_PID"

# Give chat service time to start
sleep 2

# Start Next.js server
echo "Starting Next.js server..."
cd /app
exec su-exec nextjs:nodejs node server.js
