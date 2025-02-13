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
MATTERMOST_BOT_TOKEN=your_mattermost_bot_token
MATTERMOST_SERVER_URL=http://your_mattermost_server
JWT_SECRET=your_jwt_secret
CRON_SCHEDULE='* * * * *'  # 매 1분 
```

각 환경변수 설정 방법:
- `GITHUB_TOKEN`: GitHub Personal Access Token을 발급받아 입력
- `JWT_SECRET`: JWT 토큰 생성을 위한 비밀키 설정
- `CRON_SCHEDULE`: 알림 체크 주기 설정 (기본값: 1분)
- `MATTERMOST_BOT_TOKEN` : 알림을 위한 review bot의 token
- `MATTERMOST_SERVER_URL` : mattermost 서버 도메인 주소

## 시스템 구조

이 프로젝트는 다음과 같은 주요 컴포넌트로 구성되어 있습니다:

### 1. GitHub Crawler (github-crawler/src/githubCrawler.ts)
- GitHub API를 사용하여 지정된 저장소의 PR과 워크플로우 상태를 모니터링
- 주요 기능:
  - PR 생성/수정/리뷰/머지 이벤트 감지
  - GitHub Actions 워크플로우 실행 결과 모니터링
  - 모든 이벤트를 PostgreSQL 데이터베이스에 저장

### 2. Mattermost Notifier (mattermost-notifier/src/mattermostNotifier.ts)
- 데이터베이스에 저장된 이벤트를 기반으로 Mattermost에 알림 전송
- 알림 종류:
  - 새로운 PR 생성
  - PR 코드 업데이트
  - PR 리뷰 등록
  - PR 머지 완료
  - GitHub Actions 빌드 실패

### 3. 데이터베이스 (PostgreSQL)
- 이벤트 데이터 저장
- 테이블 구조:
  - github_repositories: 모니터링할 저장소 정보
  - pr_events: PR 관련 이벤트
  - pr_reviews: PR 리뷰 정보
  - github_action_events: GitHub Actions 실행 결과
  - crawler_status: 크롤링 상태 정보

### 4. API (PostgREST)
- 데이터베이스 REST API 제공
- Swagger UI를 통한 API 문서화

### 5. 스케줄러
- 설정된 주기(CRON_SCHEDULE)에 따라 크롤링 및 알림 전송 작업 실행

## 알림 기능

1. PR 관련 알림:
   - 🆕 새로운 PR 생성
   - 📝 PR 코드 업데이트
   - 💬 PR 작성자 코멘트
   - 👀 PR 리뷰 (✅ 승인, ❌ 변경 요청, 💭 코멘트)
   - 🎉 PR 머지 완료

2. GitHub Actions 관련 알림:
   - ❌ CI/CD 빌드 실패

## 실행 방법

```bash
# 프로젝트 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 프로젝트 중지
docker-compose down
```

## API 문서
- Swagger UI: http://localhost:8080
- PostgREST API: http://localhost:3002
