# Mattermost github alarm bot

## Prerequisites
- docker
- docker-compose

## 환경 설정

프로젝트를 실행하기 전에 `.env` 파일을 생성하고 다음과 같은 환경변수들을 설정해야 합니다:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432 
GITHUB_TOKEN=your_github_token
MATTERMOST_WEBHOOK_URL=your_webhook_url
JWT_SECRET=your_jwt_secret
CRON_SCHEDULE='* * * * *'  # 매 1분 
```

각 환경변수 설정 방법:
- `GITHUB_TOKEN`: GitHub Personal Access Token을 발급받아 입력
- `MATTERMOST_WEBHOOK_URL`: Mattermost Incoming Webhook URL 입력
- `JWT_SECRET`: JWT 토큰 생성을 위한 비밀키 설정
- `CRON_SCHEDULE`: 알림 체크 주기 설정 (기본값: 1분)
