FROM node:18-alpine

WORKDIR /app

# github-crawler 디렉토리의 파일들만 복사
COPY github-crawler/package*.json ./
RUN npm install

COPY github-crawler/. .
RUN npm run build

CMD ["node", "dist/server.js"] 