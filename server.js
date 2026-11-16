import express from 'express';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const app = express();
const MESSAGES_FILE = 'data/messages.json';
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/contact', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '').trim();
  const message = String(req.body?.message ?? '').trim();

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Please fill in all fields.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email.' });
  }
  if (name.length > 100 || email.length > 200 || message.length > 2000) {
    return res.status(400).json({ error: 'Message is too long.' });
  }

  let messages = [];
  try {
    messages = JSON.parse(await readFile(MESSAGES_FILE, 'utf8'));
  } catch {
    // file doesn't exist yet
  }
  messages.push({ name, email, message, createdAt: new Date().toISOString() });

  await mkdir('data', { recursive: true });
  await writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Portfolio running at http://localhost:${PORT}`);
});
