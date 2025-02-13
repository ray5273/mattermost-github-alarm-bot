import express from 'express';
import MattermostNotifier from './mattermostNotifier';
import dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

// 필수 환경변수 체크
const requiredEnvVars = ['MATTERMOST_BOT_TOKEN', 'MATTERMOST_SERVER_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} is not defined in environment variables`);
  }
}

const app = express();
app.use(express.json());

// 타입 체크를 통과했으므로 non-null assertion operator (!)를 사용
const notifier = new MattermostNotifier(process.env.MATTERMOST_BOT_TOKEN!);

app.post('/api/notify', async (req, res) => {
  try {
    await notifier.sendNotifications();
    res.json({ success: true });
  } catch (error) {
    console.error('Notifier error:', error);
    res.status(500).json({ error: 'Notification failed' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Notifier server running on port ${PORT}`);
}); 