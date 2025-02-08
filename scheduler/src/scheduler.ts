import cron from 'node-cron';
import axios from 'axios';

const CRAWLER_URL = 'http://github-crawler:3000/api/crawl';
const NOTIFIER_URL = 'http://mattermost-notifier:3001/api/notify';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 * * * *';  // 기본값: 매일 오전 11시

async function runScheduledTasks() {
  try {
    console.log('Starting crawler...');
    console.log('CRON_SCHEDULE is', CRON_SCHEDULE);
    // Crawler 실행
    await axios.post(CRAWLER_URL);
    console.log('Crawler finished');

    console.log('Starting notifier...');
    // Crawler 완료 후 Notifier 실행
    await axios.post(NOTIFIER_URL);
    console.log('Notifier finished');
  } catch (error) {
    console.error('Error in scheduled tasks:', error);
  }
}

// 매 시간마다 실행 (원하는 주기로 수정 가능)
cron.schedule(CRON_SCHEDULE, runScheduledTasks);

// 서버 시작시 최초 1회 실행
runScheduledTasks(); 