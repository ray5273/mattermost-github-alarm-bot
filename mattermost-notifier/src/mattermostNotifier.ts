import axios from 'axios';
import pool from './db'

class MattermostNotifier {
  private botToken: string;
  private pool: any;

  constructor(botToken: string) {
    this.botToken = botToken;
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
        const message = `🆕 새로운 PR이 생성되었습니다!`;
        const fields = [
            {
                title: "제목",
                value: pr.title,
                short: false
            },
            {
                title: "작성자",
                value: pr.author,
                short: true
            },
            {
                title: "시간",
                value: this.formatDateTime(pr.created_at),
                short: true
            },
            {
                title: "링크",
                value: pr.url,
                short: false
            }
        ];
        await this.sendMattermostMessage({ text: message, fields });
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
          message = `📝 PR 코드가 업데이트되었습니다!`;
        } else if (pr.update_type === 'comment' && pr.notified === false) {
          message = `💬 PR 작성자가 코멘트를 남겼습니다!`;
        } else if (pr.notified === false) {
          message = `📝 PR이 업데이트되었습니다!`; // 살짝 중복 냄새남
        } else {
          continue;
        }
        const fields = [  
            {
                title: "제목",
                value: pr.title,
                short: false
            },
            {
                title: "작성자",
                value: pr.author,
                short: true
            },
            {
                title: "시간",
                value: this.formatDateTime(pr.updated_at),
                short: true
            },
            {
                title: "링크",
                value: pr.url,
                short: false
            }
        ];
        await this.sendMattermostMessage({ text: message, fields });
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
        
        const message = `👀 PR 리뷰가 등록되었습니다! `;
        const fields = [
            {
                title: "리뷰 상태",
                value: `${emoji} ${status}`,
                short: true
            },
            {
                title: "리뷰어",
                value: review.reviewer,
                short: true
            },
            {
                title: "시간",
                value: this.formatDateTime(review.submitted_at),
                short: true
            },
            {
                title: "PR 제목",
                value: review.pr_title,
                short: false
            },
            {
                title: "PR 작성자",
                value: review.author,
                short: true
            },
            {
                title: "링크",
                value: review.review_url,
                short: false
            }
        ];
        await this.sendMattermostMessage({ text: message, fields });
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
        const message = `🎉 PR이 머지되었습니다!`;
        const fields = [
            {
                title: "제목",
                value: pr.title,
                short: true
            },
            {
                title: "작성자",
                value: pr.author,
                short: true
            },
            {
                title: "시간",
                value: this.formatDateTime(pr.merged_at || pr.updated_at),
                short: true
            },
            {
                title: "링크",
                value: pr.url,
                short: false
            }
        ];
        await this.sendMattermostMessage({ text: message, fields });
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
        const message = `❌ CI/CD 실패!`;
        const fields = [
            {
                title: "워크플로우",
                value: ghActions.workflow_name,
                short: true
            },
            {
                title: "시간",
                value: this.formatDateTime(ghActions.failed_at),
                short: true
            },
            {
                title: "링크",
                value: ghActions.html_url,
                short: false
            }
        ];
        await this.sendMattermostMessage({ text: message, fields });
        await this.markAsNotified('github_action_events', ghActions.id);
    }
  }

  private async getActiveChannels(): Promise<string[]> {
    const query = `
      SELECT channel_id 
      FROM mattermost_channels 
      WHERE active = true
    `;
    const { rows } = await this.pool.query(query);
    return rows.map((row: { channel_id: string }) => row.channel_id);
  }

  private async sendMattermostMessage(message: { text: string; fields: Array<{ title: string; value: string; short: boolean }> }) {
    console.log(`[${this.getKSTTime()}] sendMattermostMessage 시작`);
    try {
        const channels = await this.getActiveChannels();

        for (const channelId of channels) {
            await axios.post(`${process.env.MATTERMOST_SERVER_URL}/api/v4/posts`, {
                channel_id: channelId,
                props: {
                    attachments: [
                        {
                            fallback: "알림 메시지",
                            color: "#009d31", // github 색깔
                            fields: message.fields,
                            title: `${message.text}`,            
                            author_name: "Github Review, CI/CD 실패 알림",  
                        }
                    ]
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${this.botToken}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[${this.getKSTTime()}] 채널 ${channelId}에 메시지 전송 완료`);
        }
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
