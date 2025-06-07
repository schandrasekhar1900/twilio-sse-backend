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
  const { MessageSid, MessageStatus, To } = req.body;

  if (!MessageSid || !MessageStatus || !To) {
    console.error('❌ Invalid payload:', req.body);
    return res.status(400).send('Bad Request: Missing fields');
  }

  console.log(`📬 Twilio Status: ${MessageSid} -> ${MessageStatus} for ${To}`);

  const payload = JSON.stringify({
    sid: MessageSid,
    status: MessageStatus.toLowerCase(),
    to: To
  });

  clients.forEach(client => client.write(`data: ${payload}\n\n`));

  res.status(200).send('OK');
});

app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
