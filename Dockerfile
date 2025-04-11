# Use Node.js base image
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Runtime image with minimal footprint
FROM node:20-slim

WORKDIR /app

# Copy only necessary files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Set non-root user for security
USER node

# Set environment variables
ENV NODE_ENV=production

# Run the application
ENTRYPOINT ["node", "dist/index.js"]
