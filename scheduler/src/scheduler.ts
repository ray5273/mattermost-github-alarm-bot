import cron from 'node-cron';
import axios from 'axios';
import Holidays from 'date-holidays';

const CRAWLER_URL = 'http://github-crawler:3000/api/crawl';
const NOTIFIER_URL = 'http://mattermost-notifier:3001/api/notify';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 8-18 * * 1-5';  // 기본값: 매 시간 0분에 실행, 월요일부터 금요일까지만 실행

console.log('Scheduler started with CRON_SCHEDULE:', CRON_SCHEDULE);

// Holidays 인스턴스 생성
const hd = new Holidays('KR'); // 'KR'은 한국을 의미합니다.

async function runScheduledTasks() {
  const now = new Date();
  const localNow = now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
  const localNowDate = new Date(localNow);

  console.log(`[${localNowDate.toISOString()}] Running scheduled tasks...`);

  // 오늘이 공휴일인지 확인
  if (hd.isHoliday(localNow)) {
      console.log(`[${localNowDate.toISOString()}] 오늘은 공휴일입니다. 작업을 건너뜁니다.`);
      return; // 공휴일이면 작업을 건너뜁니다.
  }

  try {
    console.log(`[${localNowDate.toISOString()}] Starting crawler...`);
    console.log(`[${localNowDate.toISOString()}] CRON_SCHEDULE is`, CRON_SCHEDULE);
    // Crawler 실행
    await axios.post(CRAWLER_URL);
    console.log(`[${localNowDate.toISOString()}] Crawler finished`);

    console.log(`[${localNowDate.toISOString()}] Starting notifier...`);
    // Crawler 완료 후 Notifier 실행
    await axios.post(NOTIFIER_URL);
    console.log(`[${localNowDate.toISOString()}] Notifier finished`);

  } catch (error) {
    console.error(`[${localNowDate.toISOString()}] Error in scheduled tasks:`, error);
  }
}


// 매 시간마다 실행 (원하는 주기로 수정 가능)
cron.schedule(CRON_SCHEDULE, runScheduledTasks);

// 서버 시작시 최초 1회 실행
runScheduledTasks(); // 주석 처리