#!/bin/sh
# Startup script - runs prisma migrate deploy then starts server
set -e

# Show Redis configuration status
echo "=== Redis Config ==="
echo "REDIS_URL set: $([ -n \"$REDIS_URL\" ] && echo 'YES' || echo 'NO')"
echo "REDIS_PASSWORD set: $([ -n \"$REDIS_PASSWORD\" ] && echo 'YES' || echo 'NO')"

# If REDIS_URL exists but has NO password (no @ sign), treat it as unauthenticated
if [ -n "$REDIS_URL" ] && echo "$REDIS_URL" | grep -qE '^redis://[^@]*$'; then
  echo "WARNING: REDIS_URL has no password — clearing it to prevent NOAUTH errors"
  unset REDIS_URL
fi

# Build REDIS_URL only if not already set
if [ -z "$REDIS_URL" ]; then
  if [ -n "$REDIS_PASSWORD" ]; then
    host="${REDIS_HOST:-coolify-redis}"
    port="${REDIS_PORT:-6379}"
    export REDIS_URL="redis://:${REDIS_PASSWORD}@${host}:${port}"
    echo "Built REDIS_URL with password for ${host}:${port}"
  else
    echo "No REDIS_URL or REDIS_PASSWORD set — Redis will be disabled"
    unset REDIS_HOST 2>/dev/null || true
  fi
fi

echo "Running Prisma setup..."
# Ensure Prisma client is generated
if [ ! -f node_modules/.prisma/client/index.js ]; then
  echo "Prisma client missing, regenerating..."
  npx prisma generate 2>&1 || echo "Warning: Prisma generate failed, continuing..."
else
  echo "Prisma client already generated."
fi

# Apply pending migrations (safe for production — only applies, never modifies schema)
echo "Running prisma migrate deploy..."
npx prisma migrate deploy 2>&1 || echo "Warning: prisma migrate deploy failed, continuing..."

echo "Starting server..."
exec node dist/server/index.js
