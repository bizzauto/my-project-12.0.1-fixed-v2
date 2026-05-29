FROM node:22-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install && npx prisma generate

COPY . .
RUN npm run build

FROM node:22-alpine

RUN apk add --no-cache openssl wget tini

# Create non-root user for security
RUN addgroup -g 1001 -S bizzauto && \
    adduser -S bizzauto -u 1001 -G bizzauto

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Create necessary directories
RUN mkdir -p uploads logs && chown -R bizzauto:bizzauto /app

USER bizzauto

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:4000/health/live || exit 1

# Use tini as init for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Only push schema if DATABASE_URL is available, otherwise skip
CMD ["sh", "-c", "if [ -n \"$DATABASE_URL\" ]; then npx prisma db push --accept-data-loss 2>/dev/null || true; fi; exec node dist/server/index.js"]
