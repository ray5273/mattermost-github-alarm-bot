FROM node:18-alpine

WORKDIR /app

# scheduler 디렉토리의 파일들만 복사
COPY scheduler/package*.json ./
RUN npm install

COPY scheduler/. .
RUN npm run build

CMD ["node", "dist/scheduler.js"]