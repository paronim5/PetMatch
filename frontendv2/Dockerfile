# Build stage
FROM node:18-alpine as build
WORKDIR /app

# Cap Node.js heap to 400 MB so the build doesn't OOM on t3.micro
ENV NODE_OPTIONS="--max-old-space-size=400"

COPY package*.json ./

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