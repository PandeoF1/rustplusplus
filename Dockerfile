# Multi-stage build for smaller final image
FROM node:18-alpine AS builder

# Install build dependencies (Alpine uses apk instead of apt-get)
RUN apk add --no-cache python3 make g++ graphicsmagick

WORKDIR /app

# Copy only package files first for better layer caching
COPY package.json package-lock.json ./

# Use npm ci for faster, more reliable installs in CI/Docker
RUN npm ci --only=production

# Copy TypeScript config for build
COPY tsconfig.json ./

# Copy source code
COPY . .

# Production stage - smaller final image
FROM node:18-alpine

# Install only runtime dependencies
RUN apk add --no-cache graphicsmagick

WORKDIR /app

# Copy installed node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY --from=builder /app .

# Create volume directories
VOLUME [ "/app/credentials" ]
VOLUME [ "/app/instances" ]
VOLUME [ "/app/database" ]
VOLUME [ "/app/logs" ]
VOLUME [ "/app/maps" ]

CMD ["npm", "start"]
