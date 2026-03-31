const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const port = Number(process.env.PORT || 8787);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'reaction-speed-trainer-backend', ts: Date.now() });
});

app.post('/api/ping', (req, res) => {
  res.json({
    ok: true,
    serverReceivedAt: Date.now(),
    clientSentAt: Number(req.body?.clientSentAt || 0),
  });
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
