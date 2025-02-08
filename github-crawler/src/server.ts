import express from 'express';
import GithubCrawler from './githubCrawler.ts';

const app = express();
app.use(express.json());

const crawler = new GithubCrawler(process.env.GITHUB_TOKEN!);

app.post('/api/crawl', async (req, res) => {
  try {
    await crawler.monitorAllRepositories(); // 모든 활성 레포지토리 모니터링
    res.json({ success: true });
  } catch (error) {
    console.error('Crawler error:', error);
    res.status(500).json({ error: 'Crawler failed' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Crawler server running on port ${PORT}`);
}); 