# Build stage — Node 20 required by Vite 7
FROM node:20-alpine as build
WORKDIR /app

# Allow up to 1 GB heap; swap covers any overflow on t3.micro
ENV NODE_OPTIONS="--max-old-space-size=1024"

COPY package*.json ./

# Configure npm retries for flaky network (common on t3.micro)
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000

# FIX: Added legacy flag to bypass React 19 peer dependency conflicts
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
# Copy build artifacts (ensure your build output folder is indeed /dist)
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]