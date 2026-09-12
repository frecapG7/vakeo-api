# Dockerfile Optimization Guide

## Key Lessons from Vakeo API Dockerization

### 1. The KISS Principle (Keep It Simple)
**❌ Problem:** Over-engineered multi-stage builds with complex node_modules handling
**✅ Solution:** Copy entire application and use .dockerignore for exclusions

### 2. Common Error Patterns

#### Module Not Found Errors
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/app/config/passportConfig.mjs'
```
**Root Cause:** Selective file copying missed entire directories
**Fix:** Copy entire build context: `COPY --from=build /build ./`

#### Build Stage Issues
```
ERROR: process "/bin/sh -c rm -rf ./node_modules && cp -r /app/node_modules ./node_modules" did not complete successfully
```
**Root Cause:** Trying to copy from non-existent path
**Fix:** Simplify to single copy operation

### 3. Working Dockerfile Pattern

```dockerfile
# Build stage
FROM node:18-alpine as build
WORKDIR /build

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Build if needed (for packages like link-preview-js)
RUN npm rebuild

# Production stage
FROM node:18-alpine
WORKDIR /app

# Copy everything from build
COPY --from=build /build ./

# Set production environment
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "index.mjs"]
```

### 4. Essential .dockerignore

```
# Dependency directories
node_modules

# Version control
.git

# Logs
*.log

# Vibe internal files
.vibe

# Documentation build
@doc

# Environment files
.env
.env.local

# IDE files
.idea
.vscode
*.swp

# Build artifacts
build
dist
coverage

# Docker files (prevent infinite recursion)
Dockerfile
.dockerignore

# OS files
.DS_Store
Thumbs.db
```

### 5. Debugging Checklist

1. **Verify file structure:**
   ```bash
   docker run -it your-image sh
   ls -la /app
   ```

2. **Check .dockerignore:**
   ```bash
   # Test what gets copied
   docker build --no-cache -t test-image .
   ```

3. **Test locally first:**
   ```bash
   docker build -t vakeo-api .
   docker run -p 3000:3000 vakeo-api
   ```

4. **Check Node.js version compatibility:**
   ```dockerfile
   # Use specific version, not 'latest'
   FROM node:18-alpine
   ```

### 6. Performance Optimization

- **Image size:** Alpine base reduces from ~1GB to ~200MB
- **Build cache:** Copy package files before source for better caching
- **Production only:** `NODE_ENV=production` strips dev dependencies

### 7. VPS Deployment Tips

```bash
# Pull and run
docker pull your-registry/vakeo-api:latest

# Run with proper settings
docker run -d \
  --name vakeo-api \
  -p 3000:3000 \
  --restart unless-stopped \
  -v /path/to/logs:/app/logs \
  your-registry/vakeo-api:latest

# Update strategy
docker pull your-registry/vakeo-api:latest
docker stop vakeo-api
docker rm vakeo-api
docker run -d --name vakeo-api ... (same as above)
```

### 8. Common Pitfalls to Avoid

1. **Assuming file structure** - Always verify what files exist
2. **Over-optimizing layers** - More layers = more complexity
3. **Ignoring .dockerignore** - Can bloat build context
4. **Using 'latest' tags** - Causes reproducibility issues
5. **Complex node_modules handling** - Usually unnecessary

### 9. When to Use Multi-Stage Builds

**Use when:**
- You have build tools that shouldn't be in production
- Significant size reduction needed
- Building frontend assets

**Avoid when:**
- Simple Node.js applications
- The complexity outweighs benefits
- You're not actually reducing image size

### 10. Final Recommendation

For most Node.js APIs like Vakeo:
1. Start with simple single-stage build
2. Add multi-stage only if image size > 500MB
3. Always test locally before deploying
4. Document your Docker setup (like this file!)