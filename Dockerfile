# Build stage
FROM node:20-alpine AS builder

# Install dependencies for native modules
RUN apk add --no-cache openssl

# Install bun
RUN npm install -g bun

WORKDIR /app

# Copy package files first for better caching
COPY package.json bun.lock ./
COPY mini-services/chat-service/package.json ./mini-services/chat-service/

# Install main dependencies
RUN bun install --frozen-lockfile

# Install chat service dependencies
RUN cd mini-services/chat-service && bun install

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN bun run db:generate

# Copy source code
COPY . .

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# Production stage
FROM node:20-alpine AS runner

# Install dependencies for runtime
RUN apk add --no-cache openssl su-exec

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone server
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy prisma for runtime
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy chat service
COPY --from=builder /app/mini-services/chat-service ./mini-services/chat-service

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Copy start script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/custom.db"

CMD ["./start.sh"]
