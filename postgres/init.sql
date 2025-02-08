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
    pr_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'created', 'updated', 'merged' 중 하나
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    merged_at TIMESTAMP,
    notified BOOLEAN DEFAULT false
);

-- PR 리뷰 정보를 저장하는 테이블
CREATE TABLE IF NOT EXISTS pr_reviews (
    id SERIAL PRIMARY KEY,
    review_id INTEGER NOT NULL,
    pr_id INTEGER NOT NULL,
    state VARCHAR(20) NOT NULL, -- 'approved', 'changes_requested', 'commented' 등
    reviewer VARCHAR(100) NOT NULL,
    submitted_at TIMESTAMP NOT NULL,
    notified BOOLEAN DEFAULT false
);

-- 빌드 이벤트를 저장하는 테이블
CREATE TABLE IF NOT EXISTS github_action_events (
    id SERIAL PRIMARY KEY,
    run_id INTEGER NOT NULL,
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