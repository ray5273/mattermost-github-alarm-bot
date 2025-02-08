import { Octokit } from '@octokit/rest';
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import pool from './db';

type PullRequest = RestEndpointMethodTypes['pulls']['list']['response']['data'][0];
type Review = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'][0];

class GithubCrawler {
  private octokit: Octokit;
  private pool: any;

  constructor(githubToken: string) {
    this.octokit = new Octokit({ auth: githubToken });
    this.pool = pool;
  }

  // 모든 활성화된 레포지토리 모니터링
  async monitorAllRepositories() {
    try {
      // 마지막 크롤링 시간 조회
      const lastCrawlQuery = `
        SELECT last_crawled_at 
        FROM crawler_status 
        ORDER BY last_crawled_at DESC 
        LIMIT 1
      `;
      const { rows } = await this.pool.query(lastCrawlQuery);
      const since = rows[0]?.last_crawled_at || new Date(Date.now() - 1 * 60 * 60 * 1000); // 기본값 1시간 전

      const repoQuery = `
        SELECT owner, repo 
        FROM github_repositories 
        WHERE active = true
      `;
      const { rows: repositories } = await this.pool.query(repoQuery);

      for (const repo of repositories) {
        await this.monitorPullRequests(repo.owner, repo.repo, since);
        await this.monitorWorkflowRuns(repo.owner, repo.repo, since);
      }

      // 현재 시간을 마지막 크롤링 시간으로 업데이트
      const updateTimeQuery = `
        INSERT INTO crawler_status (last_crawled_at) 
        VALUES ($1)
      `;
      await this.pool.query(updateTimeQuery, [new Date()]);

    } catch (error) {
      console.error('레포지토리 모니터링 중 에러 발생:', error);
    }
  }

  // 레포지토리 추가
  async addRepository(owner: string, repo: string) {
    try {
      const query = `
        INSERT INTO github_repositories (owner, repo)
        VALUES ($1, $2)
        ON CONFLICT (owner, repo) DO NOTHING
      `;
      await this.pool.query(query, [owner, repo]);
    } catch (error) {
      console.error('레포지토리 추가 중 에러 발생:', error);
    }
  }

  // 레포지토리 비활성화
  async deactivateRepository(owner: string, repo: string) {
    try {
      const query = `
        UPDATE github_repositories
        SET active = false
        WHERE owner = $1 AND repo = $2
      `;
      await this.pool.query(query, [owner, repo]);
    } catch (error) {
      console.error('레포지토리 비활성화 중 에러 발생:', error);
    }
  }

  // PR 이벤트 감지
  async monitorPullRequests(owner: string, repo: string, since: Date) {
    try {
      const { data: pullRequests } = await this.octokit.pulls.list({
        owner,
        repo,
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        since: since.toISOString()
      });

      for (const pr of pullRequests) {
        // PR 생성 이벤트 처리
        await this.handlePRCreation(pr);
        
        // PR 업데이트 이벤트 처리
        await this.handlePRUpdate(pr);
        
        // PR 리뷰 이벤트 처리
        await this.handlePRReviews(owner, repo, pr.number);
        
        // PR 머지 이벤트 처리
        if (pr.merged_at) {
          await this.handlePRMerge(pr);
        }
      }
    } catch (error) {
      console.error('PR 모니터링 중 에러 발생:', error);
    }
  }

  // CI/CD 빌드 상태 모니터링
  async monitorWorkflowRuns(owner: string, repo: string, since: Date) {
    try {
      const { data: workflows } = await this.octokit.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        created: `>=${since.toISOString()}`
      });

      for (const run of workflows.workflow_runs) {
        if (run.conclusion === 'failure') {
          await this.handleFailedBuild(run);
        }
      }
    } catch (error) {
      console.error('워크플로우 모니터링 중 에러 발생:', error);
    }
  }

  private async handlePRCreation(pr: any) {
    const query = `
      INSERT INTO pr_events (pr_id, type, title, url, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await this.pool.query(query, [
      pr.id,
      'created',
      pr.title,
      pr.html_url,
      new Date()
    ]);
  }

  private async handlePRUpdate(pr: any) {
    const query = `
      INSERT INTO pr_events (pr_id, type, title, url, updated_at)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await this.pool.query(query, [
      pr.id,
      'updated',
      pr.title,
      pr.html_url,
      new Date()
    ]);
  }

  private async handlePRReviews(owner: string, repo: string, prNumber: number) {
    const { data: reviews } = await this.octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber
    });

    for (const review of reviews as Review[]) {
      if (review.user) {
        const query = `
          INSERT INTO pr_reviews (review_id, pr_id, state, reviewer, submitted_at)
          VALUES ($1, $2, $3, $4, $5)
        `;
        await this.pool.query(query, [
          review.id,
          prNumber,
          review.state,
          review.user.login,
          review.submitted_at
        ]);
      }
    }
  }

  private async handlePRMerge(pr: any) {
    const query = `
      INSERT INTO pr_events (pr_id, type, title, url, merged_at)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await this.pool.query(query, [
      pr.id,
      'merged',
      pr.title,
      pr.html_url,
      pr.merged_at
    ]);
  }

  private async handleFailedBuild(run: any) {
    const query = `
      INSERT INTO github_action_events (run_id, status, workflow_name, html_url, failed_at)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await this.pool.query(query, [
      run.id,
      'failed',
      run.workflow_name,
      run.html_url,
      run.updated_at
    ]);
  }
}

export default GithubCrawler;
