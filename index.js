const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

let clients = [];

app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.flushHeaders();

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
});

app.post('/status-callback', (req, res) => {
  const { sid, status, to } = req.body;

  if (!sid || !status || !to) {
    console.error('❌ Invalid payload received from Twilio Function:', req.body);
    return res.status(400).send('Bad Request');
  }

  console.log(`📬 Twilio Status: ${sid} -> ${status} for ${to}`);

  const payload = JSON.stringify({
    sid,
    status: status.toLowerCase(),
    to
  });

  clients.forEach(client => client.write(`data: ${payload}\n\n`));

  res.status(200).send('OK');
});

app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
