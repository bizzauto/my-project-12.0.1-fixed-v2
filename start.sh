#!/bin/sh
# Startup script - runs prisma db push then starts server
set -e

# Debug: Show what env vars are available
echo "=== Redis Debug ==="
echo "REDIS_URL set: $([ -n \"$REDIS_URL\" ] && echo 'YES' || echo 'NO')"
echo "REDIS_PASSWORD set: $([ -n \"$REDIS_PASSWORD\" ] && echo 'YES' || echo 'NO')"
echo "REDIS_HOST set: $([ -n \"$REDIS_HOST\" ] && echo 'YES' || echo 'NO')"
echo "All env vars with REDIS: $(env | grep -i redis | head -5)"

# If REDIS_URL exists but has NO password (no @ sign), treat it as unauthenticated
if [ -n "$REDIS_URL" ] && echo "$REDIS_URL" | grep -qE '^redis://[^@]*$'; then
  echo "WARNING: REDIS_URL has no password ($REDIS_URL) — clearing it to prevent NOAUTH errors"
  unset REDIS_URL
fi

# Coolify quirk: sometimes injects full Redis URL into REDIS_USERNAME
if [ -z "$REDIS_URL" ] && [ -n "$REDIS_USERNAME" ] && echo "$REDIS_USERNAME" | grep -qE '^redis://'; then
  export REDIS_URL="$REDIS_USERNAME"
  echo "Detected Redis URL from REDIS_USERNAME (Coolify quirk)"
fi

# Build REDIS_URL only if not already set
# IMPORTANT: Only build URL WITH auth. Never connect without password.
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

# Auto-enable REDIS_ENABLED if we have a valid URL with auth
if [ -n "$REDIS_URL" ] && echo "$REDIS_URL" | grep -q '@'; then
  if [ -z "$REDIS_ENABLED" ]; then
    export REDIS_ENABLED=true
    echo "Auto-enabled REDIS_ENABLED=true (valid URL with auth detected)"
  fi
fi

echo "Redis URL present: $([ -n \"$REDIS_URL\" ] && echo 'YES' || echo 'NO')"
echo "Running Prisma generate + db push..."
# Prisma generate is already done during Docker build (RUN step)
# Only retry if .prisma/client is missing (e.g. volume mount overwrote node_modules)
if [ ! -f node_modules/.prisma/client/index.js ]; then
  echo "Prisma client missing, regenerating..."
  npx prisma generate 2>&1 || echo "Warning: Prisma generate failed, continuing..."
else
  echo "Prisma client already generated, skipping."
fi
timeout 60 npx prisma migrate deploy 2>&1 || echo "Warning: Prisma migrate deploy failed or timed out, continuing..."

echo "Starting server..."
exec node dist/server/index.js
