FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# ─── Runtime ──────────────────────────────────────────────────────────────────

FROM node:20-alpine

WORKDIR /app

# Install nginx for the agent to manage
RUN apk add --no-cache nginx

# Copy dependencies and source from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/agent.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/nginx-template.ts ./

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create directories for nginx and certs
RUN mkdir -p /etc/nginx/sites-enabled /etc/ssl/changerawr /var/lib/nginx/logs /etc/nginx/http.d

# Expose the agent port
EXPOSE 7842

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:7842/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Use entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
