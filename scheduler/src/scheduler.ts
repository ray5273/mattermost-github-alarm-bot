import cron from 'node-cron';
import axios from 'axios';
import Holidays from 'date-holidays';

const CRAWLER_URL = 'http://github-crawler:3000/api/crawl';
const NOTIFIER_URL = 'http://mattermost-notifier:3001/api/notify';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 * * * *';  // 기본값: 매일 오전 11시

// Holidays 인스턴스 생성
const hd = new Holidays('KR'); // 'KR'은 한국을 의미합니다.

async function runScheduledTasks() {
  const now = new Date();

  // 오늘이 공휴일인지 확인
  if (hd.isHoliday(now)) {
      console.log(`[${now.toISOString()}] 오늘은 공휴일입니다. 작업을 건너뜁니다.`);
      return; // 공휴일이면 작업을 건너뜁니다.
  }

  try {
    console.log(`[${new Date().toISOString()}] Starting crawler...`);
    console.log(`[${new Date().toISOString()}] CRON_SCHEDULE is`, CRON_SCHEDULE);
    // Crawler 실행
    await axios.post(CRAWLER_URL);
    console.log(`[${new Date().toISOString()}] Crawler finished`);

    console.log(`[${new Date().toISOString()}] Starting notifier...`);
    // Crawler 완료 후 Notifier 실행
    await axios.post(NOTIFIER_URL);
    console.log(`[${new Date().toISOString()}] Notifier finished`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in scheduled tasks:`, error);
  }
}


// 매 시간마다 실행 (원하는 주기로 수정 가능)
cron.schedule(CRON_SCHEDULE, runScheduledTasks);

// 서버 시작시 최초 1회 실행
runScheduledTasks(); 