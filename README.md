# Mattermost GitHub Alarm Bot

## Prerequisites
- docker
- docker-compose

## Environment Setup
Before running the project, create a `.env` file and define the following variables:

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
CRON_SCHEDULE='0 8-18 * * 1-5'  # every hour on weekdays 8am-6pm
```

Variable details:
- `GITHUB_TOKEN`: GitHub Personal Access Token
- `JWT_SECRET`: secret key for generating JWT tokens
- `CRON_SCHEDULE`: check interval for notifications (default: 1 minute)
- `MATTERMOST_BOT_TOKEN`: token for the review bot
- `MATTERMOST_SERVER_URL`: domain of the Mattermost server

## System Overview
This project consists of the following components:

### 1. GitHub Crawler (`github-crawler/src/githubCrawler.ts`)
- Monitors PRs and workflow status of specified repositories via the GitHub API
- Key features:
  - Detects PR create/update/review/merge events
  - Monitors GitHub Actions workflow results
  - Stores all events in a PostgreSQL database

### 2. Mattermost Notifier (`mattermost-notifier/src/mattermostNotifier.ts`)
- Sends notifications to Mattermost based on events saved in the database
- Notification types:
  - New PR creation
  - PR code updates
  - PR reviews
  - PR merge completion
  - GitHub Actions build failures

### 3. Database (PostgreSQL)
- Stores event data
- Tables:
  - `github_repositories`: repositories to monitor
  - `pr_events`: PR-related events
  - `pr_reviews`: PR review information
  - `github_action_events`: GitHub Actions results
  - `crawler_status`: crawler status information
  - `mattermost_channels`: Mattermost channel data (`channel_type` differentiates PR and CI/CD channels)

### 4. API (PostgREST)
- Provides a REST API for the database
- API documentation via Swagger UI

### 5. Scheduler
- Runs crawling and notification tasks according to `CRON_SCHEDULE`

## Notification Features
1. PR Notifications:
   - 🆕 New PR created
   - 📝 PR code updated
   - 💬 Comment from PR author
   - 👀 PR review (✅ approve, ❌ request changes, 💭 comment)
   - 🎉 PR merged

2. GitHub Actions Notifications:
   - ❌ CI/CD build failed

## Usage
```bash
# Start the project
docker-compose up -d

# Initialize the DB or apply schema changes
docker-compose run --rm db-init

# View logs
docker-compose logs -f

# Stop the project
docker-compose down
```

## API Documentation
- Swagger UI: http://localhost:8080
- PostgREST API: http://localhost:3002

For the original Korean documentation, see [README.kr.md](README.kr.md).
