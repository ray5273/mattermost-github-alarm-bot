import express from 'express';
import MattermostNotifier from './mattermostNotifier';

const app = express();
app.use(express.json());

const notifier = new MattermostNotifier(process.env.MATTERMOST_WEBHOOK_URL!);

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