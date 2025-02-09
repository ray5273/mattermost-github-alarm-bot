import { Octokit } from '@octokit/rest';
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import pool from './db';

type PullRequest = RestEndpointMethodTypes['pulls']['list']['response']['data'][0];
type Review = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'][0];

class GithubCrawler {
  private octokit: Octokit;
  private pool: any;

  constructor(githubToken: string) {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
      request: {
        timeout: 10000,
        retries: 3,
      }
    });
    this.pool = pool;
  }

  private getKSTTime(): string {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
  }

  // 모든 활성화된 레포지토리 모니터링
  async monitorAllRepositories() {
    console.log(`[${this.getKSTTime()}] monitorAllRepositories 시작`);
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
      console.log(`[${this.getKSTTime()}] [monitorAllRepositories] ${repositories.length}개의 활성화된 레포지토리 조회됨`);

      for (const repo of repositories) {
        await this.monitorPullRequests(repo.owner, repo.repo, since);
        await this.monitorWorkflowRuns(repo.owner, repo.repo, since);
      }

      // 현재 시간을 마지막 크롤링 시간으로 업데이트
      const updateTimeQuery = `
        INSERT INTO crawler_status (last_crawled_at)  
        VALUES (CURRENT_TIMESTAMP)
      `;
      await this.pool.query(updateTimeQuery);

    } catch (error) {
      console.log(`[${this.getKSTTime()}] 레포지토리 모니터링 중 에러 발생:`, error);
    }
  }

  // 레포지토리 추가
  async addRepository(owner: string, repo: string) {
    console.log(`[${this.getKSTTime()}] [addRepository] 시작 - ${owner}/${repo}`);
    try {
      const query = `
        INSERT INTO github_repositories (owner, repo)
        VALUES ($1, $2)
        ON CONFLICT (owner, repo) DO NOTHING
      `;
      await this.pool.query(query, [owner, repo]);
      console.log(`[${this.getKSTTime()}] [addRepository] ${owner}/${repo} 추가 완료`);
    } catch (error) {
      console.log(`[${this.getKSTTime()}] 레포지토리 추가 중 에러 발생:`, error);
    }
  }


  // 레포지토리 비활성화
  async deactivateRepository(owner: string, repo: string) {
    console.log(`[${this.getKSTTime()}] [deactivateRepository] 시작 - ${owner}/${repo}`);
    try {
      const query = `
        UPDATE github_repositories
        SET active = false
        WHERE owner = $1 AND repo = $2
      `;
      await this.pool.query(query, [owner, repo]);
      console.log(`[${this.getKSTTime()}] [deactivateRepository] ${owner}/${repo} 비활성화 완료`);
    } catch (error) {
      console.log(`[${this.getKSTTime()}] 레포지토리 비활성화 중 에러 발생:`, error);
    }
  }

  // PR 이벤트 감지
  async monitorPullRequests(owner: string, repo: string, since: Date) {
    console.log(`[${this.getKSTTime()}] [monitorPullRequests] 시작 - ${owner}/${repo}`);
    try {
      const { data: pullRequests } = await this.octokit.pulls.list({
        owner,
        repo,
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        since: since.toISOString()
      });
      
      console.log(`[${this.getKSTTime()}] [monitorPullRequests] PR ${pullRequests.length}개 조회됨`);

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
      console.log(`[${this.getKSTTime()}] [monitorPullRequests] 에러 발생: ${error}`);
      throw error;
    }
  }

  // CI/CD 빌드 상태 모니터링
  async monitorWorkflowRuns(owner: string, repo: string, since: Date) {
    console.log(`[${this.getKSTTime()}] [monitorWorkflowRuns] 시작 - ${owner}/${repo}`);
    try {
      // 워크플로우 실행 목록 조회, 24시간 전부터 조회
      const { data: workflows } = await this.octokit.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        created: `>=${new Date(since.getTime() - 24 * 60 * 60 * 1000).toISOString()}`
      });
      
      console.log(`[${this.getKSTTime()}] [monitorWorkflowRuns] ${workflows.workflow_runs.length}개의 워크플로우 발견`);

      for (const run of workflows.workflow_runs) {
        // 워크플로우가 아직 진행 중인지 확인
        if (run.status === 'in_progress' || run.status === 'queued' || run.status === 'waiting') {
          console.log(`[${this.getKSTTime()}] [monitorWorkflowRuns] 워크플로우 #${run.id}가 아직 진행 중 (${run.status})`);
          continue;
        }

        // 워크플로우 결과에 따른 처리
        if (run.conclusion === 'failure' || run.conclusion === 'cancelled' || run.conclusion === 'timed_out') {
          await this.handleGithubActionFailed(run);
        } else {
          console.log(`[${this.getKSTTime()}] [monitorWorkflowRuns] 워크플로우 #${run.id} ${run.conclusion}`);
        }
      }

    } catch (error) {
      console.log(`[${this.getKSTTime()}] [monitorWorkflowRuns] 에러 발생: ${error}`);
      throw error;
    }
  }

  private async handlePRCreation(pr: PullRequest) {
    console.log(`[${this.getKSTTime()}] [handlePRCreation] 시작 - PR #${pr.number} (${pr.base.repo.owner.login}/${pr.base.repo.name})`);
    try {
      // 이미 생성 이벤트가 있는지 확인
      const checkQuery = `
        SELECT id FROM pr_events 
        WHERE pr_id = $1 AND type = 'created'
      `;
      const { rows } = await this.pool.query(checkQuery, [pr.id]);
      
      if (rows.length === 0) {
        console.log(`[${this.getKSTTime()}] [handlePRCreation] PR #${pr.number} 생성 이벤트 추가`);
        const query = `
          INSERT INTO pr_events (pr_id, type, title, url, created_at, author)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await this.pool.query(query, [
          pr.id,
          'created',
          pr.title,
          pr.html_url,
          pr.created_at,
          pr.user?.login
        ]);
      } else {
        console.log(`[${this.getKSTTime()}] [handlePRCreation] PR #${pr.number} 이미 생성 이벤트 존재, 건너뜀`);
      }
    } catch (error) {
      console.error(`[${this.getKSTTime()}] [handlePRCreation] 에러 발생: ${error}`);
      throw error;
    }
  }

  private async handlePRUpdate(pr: PullRequest) {
    console.log(`[${this.getKSTTime()}] [handlePRUpdate] 시작 - PR #${pr.number} (${pr.base.repo.owner.login}/${pr.base.repo.name})`);
    try {
      // 마지막 크롤링 시간 조회
      const lastCrawlQuery = `
        SELECT last_crawled_at 
        FROM crawler_status 
        ORDER BY last_crawled_at DESC 
        LIMIT 1
      `;
      const { rows: lastCrawl } = await this.pool.query(lastCrawlQuery);
      const since = lastCrawl[0]?.last_crawled_at || new Date(Date.now() - 1 * 60 * 60 * 1000);

      // PR의 모든 코멘트 확인
      const { data: comments } = await this.octokit.issues.listComments({
        owner: pr.base.repo.owner.login,
        repo: pr.base.repo.name,
        issue_number: pr.number
      });

      // 마지막 크롤링 이후의 작성자 코멘트 찾기
      const recentAuthorComments = comments.filter(comment => 
        comment.user?.login === pr.user?.login &&
        new Date(comment.created_at) > since
      );
      
      // 작성자의 새로운 코멘트가 있다면 각각에 대해 이벤트 생성
      for (const comment of recentAuthorComments) {
        console.log(`[${this.getKSTTime()}] [handlePRUpdate] PR #${pr.number}의 작성자 코멘트 감지됨`);
        const insertQuery = `
          INSERT INTO pr_events (pr_id, type, title, url, updated_at, update_type, comment_id, author)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (pr_id, type, comment_id) DO NOTHING
        `;
        await this.pool.query(insertQuery, [
          pr.id,
          'author_comment',
          pr.title,
          comment.html_url,
          comment.created_at,
          'comment',
          comment.id,
          pr.user?.login
        ]);
      }

      // 최신 커밋 해시 확인
      const { data: commits } = await this.octokit.pulls.listCommits({
        owner: pr.base.repo.owner.login,
        repo: pr.base.repo.name,
        pull_number: pr.number
      });
      
      const latestCommitHash = commits[commits.length - 1]?.sha;
      
      // 이전 커밋 해시 확인
      const checkQuery = `
        SELECT commit_hash 
        FROM pr_events 
        WHERE pr_id = $1 
        AND type = 'updated' 
        AND update_type = 'code'
        ORDER BY updated_at DESC 
        LIMIT 1
      `;
      const { rows } = await this.pool.query(checkQuery, [pr.id]);
      
      // 커밋 해시가 다른 경우에만 새로운 이벤트 추가
      if (!rows.length || rows[0].commit_hash !== latestCommitHash) {
        console.log(`[${this.getKSTTime()}] [handlePRUpdate] PR #${pr.number}의 새로운 코드 변경사항 감지됨`);
        const insertQuery = `
          INSERT INTO pr_events (pr_id, type, title, url, updated_at, update_type, commit_hash, author)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        await this.pool.query(insertQuery, [
          pr.id,
          'updated',
          pr.title,
          pr.html_url,
          pr.updated_at,
          'code',
          latestCommitHash,
          pr.user?.login
        ]);
      } else {
        console.log(`[${this.getKSTTime()}] [handlePRUpdate] PR #${pr.number}의 코드 변경사항 없음, 건너뜀`);
      }
    } catch (error) {
      console.error(`[${this.getKSTTime()}] [handlePRUpdate] 에러 발생: ${error}`);
      throw error;
    }
  }

  private async handlePRReviews(owner: string, repo: string, prNumber: number) {
    console.log(`[${this.getKSTTime()}] [handlePRReviews] 시작 - PR #${prNumber} (${owner}/${repo})`);
    try {
      // PR 리뷰 조회
      const { data: reviews } = await this.octokit.pulls.listReviews({
        owner,
        repo,
        pull_number: prNumber
      });
      
      console.log(`[${this.getKSTTime()}] [handlePRReviews] ${reviews.length}개의 리뷰 발견`);

      // PR 정보 조회
      const { data: pr } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });

      // 마지막 크롤링 시간 조회
      const lastCrawlQuery = `
        SELECT last_crawled_at 
        FROM crawler_status 
        ORDER BY last_crawled_at DESC 
        LIMIT 1
      `;
      const { rows: lastCrawl } = await this.pool.query(lastCrawlQuery);
      const since = lastCrawl[0]?.last_crawled_at || new Date(Date.now() - 1 * 60 * 60 * 1000);

      // PR의 코멘트 조회
      const { data: comments } = await this.octokit.issues.listComments({
        owner,
        repo,
        issue_number: prNumber
      });

      // 기존 리뷰 처리
      for (const review of reviews) {
        if (review.user) {
          const checkQuery = `
            SELECT id FROM pr_reviews 
            WHERE review_id = $1
          `;
          const { rows } = await this.pool.query(checkQuery, [review.id]);
          
          if (rows.length === 0) {
            console.log(`[${this.getKSTTime()}] [handlePRReviews] PR #${prNumber}의 새로운 리뷰 추가 (리뷰어: ${review.user.login})`);
            const query = `
              INSERT INTO pr_reviews (review_id, pr_id, state, reviewer, submitted_at, is_author, pr_title, review_url, author)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `;
            await this.pool.query(query, [
              review.id,
              prNumber,
              review.state,
              review.user.login,
              review.submitted_at,
              review.user.login === pr.user.login,  // PR 작성자와 리뷰어가 같으면 true
              pr.title,
              review.html_url,
              pr.user?.login
            ]);

          } else {
            console.log(`[${this.getKSTTime()}] [handlePRReviews] PR #${prNumber}의 리뷰 이미 존재, 건너뜀 (리뷰어: ${review.user.login})`);
          }
        }
      }
    } catch (error) {
      console.error(`[${this.getKSTTime()}] [handlePRReviews] 에러 발생: ${error}`);
      throw error;
    }
  }

  private async handlePRMerge(pr: PullRequest) {
    console.log(`[${this.getKSTTime()}] [handlePRMerge] 시작 - PR #${pr.number} (${pr.base.repo.owner.login}/${pr.base.repo.name})`);
    try {
      // 이미 머지 이벤트가 있는지 확인
      const checkQuery = `
        SELECT id FROM pr_events 
        WHERE pr_id = $1 AND type = 'merged'
      `;
      const { rows } = await this.pool.query(checkQuery, [pr.id]);
      
      if (rows.length === 0) {
        console.log(`[${this.getKSTTime()}] [handlePRMerge] PR #${pr.number} 머지 이벤트 추가`);
        const query = `
          INSERT INTO pr_events (pr_id, type, title, url, merged_at, author)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await this.pool.query(query, [
          pr.id,
          'merged',
          pr.title,
          pr.html_url,
          pr.merged_at,
          pr.user?.login
        ]);
      } else {
        console.log(`[${this.getKSTTime()}] [handlePRMerge] PR #${pr.number} 이미 머지 이벤트 존재, 건너뜀`);
      }
    } catch (error) {
      console.error(`[${this.getKSTTime()}] [handlePRMerge] 에러 발생: ${error}`);
      throw error;
    }
  }

  private async handleGithubActionFailed(run: any) {
    console.log(`[${this.getKSTTime()}] [handleGithubActionFailed] 시작 - 워크플로우 #${run.id}`);
    try {
      // 이미 실패 이벤트가 있는지 확인
      const checkQuery = `
        SELECT id FROM github_action_events 
        WHERE run_id = $1
        LIMIT 1
      `;
      const { rows } = await this.pool.query(checkQuery, [run.id]);
      
      if (rows.length === 0) {
        console.log(`[${this.getKSTTime()}] [handleGithubActionFailed] 워크플로우 #${run.id} 실패 이벤트 추가`);
        const query = `
          INSERT INTO github_action_events (run_id, status, workflow_name, html_url, failed_at)
          VALUES ($1, $2, $3, $4, $5)
        `;
        await this.pool.query(query, [
          run.id,
          'failed',
          run.name,
          run.html_url,
          run.updated_at
        ]);
      } else {
        console.log(`[${this.getKSTTime()}] [handleGithubActionFailed] 워크플로우 #${run.id} 이미 실패 이벤트 존재, 건너뜀`);
      }
    } catch (error) {
      console.error(`[${this.getKSTTime()}] [handleGithubActionFailed] 에러 발생: ${error}`);
      throw error;
    }
  }
}

export default GithubCrawler;
