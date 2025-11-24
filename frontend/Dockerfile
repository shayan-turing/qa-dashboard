# syntax=docker/dockerfile:1

###############
# 1) BUILD STAGE
###############
FROM node:18-alpine AS build

# Workdir inside container
WORKDIR /app

# Install deps (cached when package files don't change)
COPY package.json package-lock.json ./
# RUN npm ci
RUN npm install --legacy-peer-deps

# Copy source and build
COPY . .
RUN npm run build


###############
# 2) RUNTIME STAGE
###############
FROM nginx:1.27-alpine AS runtime

# Optional: clean default nginx site config and add our own SPA config
# (see nginx.conf below)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files from build stage
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
