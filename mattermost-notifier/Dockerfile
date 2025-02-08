FROM node:18-alpine

WORKDIR /app

# mattermost-notifier 디렉토리의 파일들만 복사
COPY mattermost-notifier/package*.json ./
RUN npm install

COPY mattermost-notifier/. .
RUN npm run build

CMD ["node", "dist/server.js"] 