# Build stage
FROM node:18-alpine as build
WORKDIR /app
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