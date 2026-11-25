import express from 'express';
import { neon } from '@neondatabase/serverless';

const app = express();
const sql = neon(process.env.DATABASE_URL);
const PORT = process.env.PORT || 3000;

app.use(express.json());
const publicDir = new URL('./public', import.meta.url).pathname;

// Page assets use relative URLs, so serve at /info without a trailing slash.
app.get('/info', (req, res, next) => {
  if (req.originalUrl.split('?')[0].endsWith('/')) return res.redirect(301, '/info');
  res.sendFile('index.html', { root: publicDir });
});

app.use(express.static(publicDir));

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

  try {
    await sql`INSERT INTO messages (name, email, message) VALUES (${name}, ${email}, ${message})`;
  } catch (err) {
    console.error('Saving message failed:', err);
    return res.status(500).json({ error: 'Could not save your message. Please try again later.' });
  }

  // The message is already saved, so an email failure must not fail the request.
  // Awaited because serverless functions can be frozen once the response is sent.
  const { RESEND_API_KEY, NOTIFY_EMAIL } = process.env;
  if (RESEND_API_KEY && NOTIFY_EMAIL) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'Portfolio <onboarding@resend.dev>',
          to: [NOTIFY_EMAIL],
          reply_to: email,
          subject: `Portfolio message from ${name.replace(/[\r\n]+/g, ' ')}`,
          text: `From: ${name} <${email}>\n\n${message}`,
        }),
      });
      if (!r.ok) throw new Error(`Resend responded ${r.status}: ${await r.text()}`);
    } catch (err) {
      console.error('Email notification failed:', err);
    }
  }

  res.json({ ok: true });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Portfolio running at http://localhost:${PORT}`);
  });
}

export default app;
