import axios from 'axios';
import pool from './db'

class MattermostNotifier {
  private webhookUrl: string;
  private pool: any;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
    this.pool = pool;
  }
  
  private getKSTTime(): string {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
  }

  private formatDateTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  async sendNotifications() {
    try {
      await this.notifyNewPRs();
      await this.notifyPRUpdates();
      await this.notifyPRReviews();
      await this.notifyMergedPRs();
      await this.notifyFailedBuilds();
    } catch (error) {
      console.log(`[${this.getKSTTime()}] 알림 전송 중 에러 발생:`, error);
    }
  }


  private async notifyNewPRs() {
    console.log(`[${this.getKSTTime()}] notifyNewPRs 시작`);
    const query = `
      SELECT * FROM pr_events 
      WHERE type = 'created' 
      AND notified = false
    `;
    const { rows } = await this.pool.query(query);
    
    for (const pr of rows) {
      await this.sendMattermostMessage({
        text: `🆕 새로운 PR이 생성되었습니다!\n작성자: ${pr.author}\n제목: ${pr.title}\n시간: ${this.formatDateTime(pr.created_at)}\n링크: ${pr.url}`
      });
      
      await this.markAsNotified('pr_events', pr.id);
    }
  }

  private async notifyPRUpdates() {
    console.log(`[${this.getKSTTime()}] notifyPRUpdates 시작`);
    const query = `
      SELECT * FROM pr_events 
      WHERE type = 'updated' or type = 'author_comment'
      AND notified = false
    `;
    const { rows } = await this.pool.query(query);
    
    for (const pr of rows) {
      let message = '';
      if (pr.update_type === 'code' && pr.notified === false) {
        message = `📝 PR 코드가 업데이트되었습니다!\n작성자: ${pr.author}\n제목: ${pr.title}\n시간: ${this.formatDateTime(pr.updated_at)}\n링크: ${pr.url}`;
      } else if (pr.update_type === 'comment' && pr.notified === false) {
        message = `💬 PR 작성자가 코멘트를 남겼습니다!\n작성자: ${pr.author}\n제목: ${pr.title}\n시간: ${this.formatDateTime(pr.updated_at)}\n링크: ${pr.url}`;
      } else if (pr.notified === false) {
        message = `📝 PR이 업데이트되었습니다!\n작성자: ${pr.author}\n제목: ${pr.title}\n시간: ${this.formatDateTime(pr.updated_at)}\n링크: ${pr.url}`;
      } else {
        continue;
      }
      await this.sendMattermostMessage({ text: message });
      await this.markAsNotified('pr_events', pr.id);
    }
  }

  private async notifyPRReviews() {
    console.log(`[${this.getKSTTime()}] notifyPRReviews 시작`);
    const query = `
      SELECT * FROM pr_reviews r
      WHERE r.notified = false
    `;
    const { rows } = await this.pool.query(query);
    console.log(`[${this.getKSTTime()}] notifyPRReviews ${rows.length}개의 리뷰 발견`);
    
    for (const review of rows) {
      let emoji = '❔';
      let status = '알 수 없음';
      
      if (review.state.toLowerCase() === 'approved') {
        emoji = '✅';
        status = 'APPROVED';
      } else if (review.state.toLowerCase() === 'changes_requested') {
        emoji = '❌';
        status = 'CHANGES REQUESTED';
      } else if (review.state.toLowerCase() === 'commented') {
        emoji = '💭';
        status = 'COMMENTED';
      }
      
      await this.sendMattermostMessage({
        text: `👀 PR 리뷰가 등록되었습니다!\n상태: ${emoji} ${status}\n리뷰어: ${review.reviewer}\n시간: ${this.formatDateTime(review.submitted_at)}\n\nPR 제목: ${review.pr_title}\nPR 작성자: ${review.author}\n링크: ${review.review_url}`
      });
      
      await this.markAsNotified('pr_reviews', review.id);
    }
  }

  private async notifyMergedPRs() {
    console.log(`[${this.getKSTTime()}] notifyMergedPRs 시작`);
    const query = `
      SELECT * FROM pr_events 
      WHERE type = 'merged' 
      AND notified = false
    `;
    const { rows } = await this.pool.query(query);
    
    for (const pr of rows) {
      await this.sendMattermostMessage({
        text: `🎉 PR이 머지되었습니다!\n작성자: ${pr.author}\n제목: ${pr.title}\n시간: ${this.formatDateTime(pr.merged_at || pr.updated_at)}\n링크: ${pr.url}`
      });
      
      await this.markAsNotified('pr_events', pr.id);
    }
  }

  private async notifyFailedBuilds() {
    console.log(`[${this.getKSTTime()}] notifyFailedBuilds 시작`);
    const query = `
      SELECT * FROM github_action_events 
      WHERE status = 'failed' 
      AND notified = false
    `;
    const { rows } = await this.pool.query(query);
    
    for (const ghActions of rows) {
      await this.sendMattermostMessage({
        text: `❌ CI/CD 실패!\n워크플로우: ${ghActions.workflow_name}\n시간: ${this.formatDateTime(ghActions.failed_at)}\n링크: ${ghActions.html_url}`
      });
      
      await this.markAsNotified('github_action_events', ghActions.id);
    }
  }

  private async sendMattermostMessage(message: { text: string }) {
    console.log(`[${this.getKSTTime()}] sendMattermostMessage 시작`);
    try {
      await axios.post(this.webhookUrl, message);
    } catch (error) {
      console.log(`[${this.getKSTTime()}] Mattermost 메시지 전송 실패:`, error);
    }
  }

  private async markAsNotified(table: string, id: number) {
    console.log(`[${this.getKSTTime()}] markAsNotified 시작`);
    const query = `
      UPDATE ${table} 
      SET notified = true 
      WHERE id = $1
    `;
    await this.pool.query(query, [id]);
    console.log(`[${this.getKSTTime()}] markAsNotified 완료`);
  }
}


export default MattermostNotifier;
