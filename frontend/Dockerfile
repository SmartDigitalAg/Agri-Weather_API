# frontend/Dockerfile

# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# 의존성 파일 복사 및 설치
COPY package*.json ./
RUN npm ci

# 소스 코드 복사 및 빌드
COPY . .

# 환경변수 설정 (빌드 시 API URL 설정)
ARG VITE_API_URL=http://weather-rda.digitalag.kr:8001
ENV VITE_API_URL=$VITE_API_URL

# 빌드 최적화 (메모리 확보 + SWC 사용)
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npx vite build

# Production stage
FROM nginx:alpine

# Nginx 설정 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 빌드된 파일 복사
COPY --from=build /app/dist /usr/share/nginx/html

# 포트 노출
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
