# Bohlweg Platform Dockerfile
# Multi-stage build for optimized image size

# Stage 1: Builder
FROM node:20-bookworm AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and lockfile
COPY package.json package-lock.json ./

# Configure npm for better reliability
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-timeout 300000 && \
    npm config set maxsockets 5

# Install ALL dependencies and rebuild native modules with retries
RUN npm ci --prefer-offline --no-audit --loglevel=verbose || \
    (sleep 10 && npm ci --prefer-offline --no-audit) || \
    (sleep 20 && npm ci --no-audit)

# Rebuild native modules
RUN npm rebuild better-sqlite3

# Copy application code (node_modules excluded via .dockerignore)
COPY . .

# Build Next.js application
RUN npm run build

# Stage 2: Runner
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Install Playwright system dependencies for Chromium (Debian 12) and su-exec
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    python3 \
    make \
    g++ \
    su-exec \
    && rm -rf /var/lib/apt/lists/*

# Playwright wird die Browser selbst installieren - kein Skip
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scrapers ./scrapers
COPY --from=builder /app/lib ./lib

# Create public directory (Next.js may need it even if empty)
RUN mkdir -p /app/public

# Create data directory for SQLite database and fontconfig cache
RUN mkdir -p /app/data /app/.cache/fontconfig && \
    chown -R nextjs:nodejs /app/data /app/.cache

# Install Playwright browsers (Chromium für headless scraping)
# Muss als root ausgeführt werden, bevor zu nextjs gewechselt wird
RUN npx playwright install chromium

# Set fontconfig cache directory for non-root user
ENV FONTCONFIG_PATH=/app/.cache/fontconfig
ENV XDG_CACHE_HOME=/app/.cache

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/stats', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use entrypoint to set permissions and switch to nextjs user
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Start application
CMD ["node", "server.js"]
