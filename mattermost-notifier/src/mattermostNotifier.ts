import axios from 'axios';
import pool from './db'

class MattermostNotifier {
  private webhookUrl: string;
  private pool: any;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
    this.pool = pool;
  }

  async sendNotifications() {
    try {
      await this.notifyNewPRs();
      await this.notifyPRUpdates();
      await this.notifyPRReviews();
      await this.notifyMergedPRs();
      await this.notifyFailedBuilds();
    } catch (error) {
      console.error('알림 전송 중 에러 발생:', error);
    }
  }

  private async notifyNewPRs() {
    const query = `
      SELECT * FROM pr_events 
      WHERE type = 'created' 
      AND notified = false
    `;
    const { rows } = await this.pool.query(query);
    
    for (const pr of rows) {
      await this.sendMattermostMessage({
        text: `🆕 새로운 PR이 생성되었습니다!\n제목: ${pr.title}\n링크: ${pr.url}`
      });
      
      await this.markAsNotified('pr_events', pr.id);
    }
  }

  private async notifyPRUpdates() {
    const query = `
      SELECT * FROM pr_events 
      WHERE type = 'updated' 
      AND notified = false
    `;
    const { rows } = await this.pool.query(query);
    
    for (const pr of rows) {
      await this.sendMattermostMessage({
        text: `📝 PR이 업데이트되었습니다!\n제목: ${pr.title}\n링크: ${pr.url}`
      });
      
      await this.markAsNotified('pr_events', pr.id);
    }
  }

  private async notifyPRReviews() {
    const query = `
      SELECT pr.*, r.state, r.reviewer 
      FROM pr_reviews r
      JOIN pr_events pr ON r.pr_id = pr.pr_id
      WHERE r.notified = false
    `;
    const { rows } = await this.pool.query(query);
    
    for (const review of rows) {
      const emoji = review.state === 'approved' ? '✅' : '💭';
      await this.sendMattermostMessage({
        text: `${emoji} PR 리뷰가 등록되었습니다!\n리뷰어: ${review.reviewer}\n상태: ${review.state}\n제목: ${review.title}\n링크: ${review.url}`
      });
      
      await this.markAsNotified('pr_reviews', review.id);
    }
  }

  private async notifyMergedPRs() {
    const query = `
      SELECT * FROM pr_events 
      WHERE type = 'merged' 
      AND notified = false
    `;
    const { rows } = await this.pool.query(query);
    
    for (const pr of rows) {
      await this.sendMattermostMessage({
        text: `🎉 PR이 머지되었습니다!\n제목: ${pr.title}\n링크: ${pr.url}`
      });
      
      await this.markAsNotified('pr_events', pr.id);
    }
  }

  private async notifyFailedBuilds() {
    const query = `
      SELECT * FROM github_action_events 
      WHERE status = 'failed' 
      AND notified = false
    `;
    const { rows } = await this.pool.query(query);
    
    for (const build of rows) {
      await this.sendMattermostMessage({
        text: `❌ CI/CD 실패!\n워크플로우: ${build.workflow_name}\n링크: ${build.html_url}`
      });
      
      await this.markAsNotified('github_action_events', build.id);
    }
  }

  private async sendMattermostMessage(message: { text: string }) {
    try {
      await axios.post(this.webhookUrl, message);
    } catch (error) {
      console.error('Mattermost 메시지 전송 실패:', error);
    }
  }

  private async markAsNotified(table: string, id: number) {
    const query = `
      UPDATE ${table} 
      SET notified = true 
      WHERE id = $1
    `;
    await this.pool.query(query, [id]);
  }
}

export default MattermostNotifier;
