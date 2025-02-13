-- GitHub 레포지토리 정보를 저장하는 테이블
CREATE TABLE IF NOT EXISTS github_repositories (
    id SERIAL PRIMARY KEY,
    owner VARCHAR(100) NOT NULL,
    repo VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT true,
    UNIQUE(owner, repo)
);

-- PR 이벤트를 저장하는 테이블
CREATE TABLE IF NOT EXISTS pr_events (
    id SERIAL PRIMARY KEY,
    pr_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'created', 'updated', 'merged', 'author_comment' 중 하나
    update_type VARCHAR(20), -- 'code', 'comment' 중 하나
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    merged_at TIMESTAMP,
    notified BOOLEAN DEFAULT false,
    commit_hash VARCHAR(40),
    comment_id BIGINT,
    author VARCHAR(100),
    UNIQUE(pr_id, type, comment_id)
);

-- PR 리뷰 정보를 저장하는 테이블
CREATE TABLE IF NOT EXISTS pr_reviews (
    id SERIAL PRIMARY KEY,
    review_id BIGINT NOT NULL,
    pr_id BIGINT NOT NULL,
    state VARCHAR(20) NOT NULL, -- 'approved', 'changes_requested', 'commented' 등
    reviewer VARCHAR(100) NOT NULL,
    submitted_at TIMESTAMP NOT NULL,
    notified BOOLEAN DEFAULT false,
    is_author BOOLEAN DEFAULT FALSE,
    pr_title TEXT NOT NULL,
    review_url TEXT NOT NULL,
    author VARCHAR(100) NOT NULL
);



-- 빌드 이벤트를 저장하는 테이블
CREATE TABLE IF NOT EXISTS github_action_events (
    id SERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    workflow_name TEXT NOT NULL,
    html_url TEXT NOT NULL,
    failed_at TIMESTAMP NOT NULL,
    notified BOOLEAN DEFAULT false
);
-- 사용자 정보를 저장하는 테이블

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    github_id VARCHAR(100) NOT NULL UNIQUE,
    knox_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    team_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT true
);

-- 크롤러 상태를 저장하는 테이블
CREATE TABLE IF NOT EXISTS crawler_status (
    id SERIAL PRIMARY KEY,
    last_crawled_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_pr_events_pr_id ON pr_events(pr_id);
CREATE INDEX IF NOT EXISTS idx_pr_events_type ON pr_events(type);
CREATE INDEX IF NOT EXISTS idx_pr_events_notified ON pr_events(notified);

CREATE INDEX IF NOT EXISTS idx_pr_reviews_pr_id ON pr_reviews(pr_id);
CREATE INDEX IF NOT EXISTS idx_pr_reviews_notified ON pr_reviews(notified);

CREATE INDEX IF NOT EXISTS idx_github_action_events_run_id ON github_action_events(run_id);
CREATE INDEX IF NOT EXISTS idx_github_action_events_notified ON github_action_events(notified);

CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_users_knox_id ON users(knox_id);
CREATE INDEX IF NOT EXISTS idx_users_team_name ON users(team_name);

-- 중복 데이터 방지를 위한 유니크 제약조건
ALTER TABLE pr_reviews ADD CONSTRAINT unique_review_id UNIQUE (review_id);
ALTER TABLE github_action_events ADD CONSTRAINT unique_run_id UNIQUE (run_id); 

-- 초기 레포지토리 데이터 추가
INSERT INTO github_repositories (owner, repo) 
VALUES ('ray5273', 'mattermost-github-alarm-bot')
ON CONFLICT (owner, repo) DO NOTHING;
INSERT INTO github_repositories (owner, repo)
VALUES ('ray5273', 'docusaurus-template')
ON CONFLICT (owner, repo) DO NOTHING;

-- Mattermost 채널 정보를 저장하는 테이블
CREATE TABLE IF NOT EXISTS mattermost_channels (
    id SERIAL PRIMARY KEY,
    channel_id VARCHAR(100) NOT NULL,
    team_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT true,
    UNIQUE(channel_id)
);

CREATE INDEX IF NOT EXISTS idx_mattermost_channels_team_name ON mattermost_channels(team_name);

INSERT INTO mattermost_channels (channel_id, team_name) 
VALUES ('e5mz14djfif18rftxfshgdy8xr', 'firstteam');