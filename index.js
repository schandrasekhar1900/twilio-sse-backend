const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

let clients = [];

app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders();

  clients.push(res);
  console.log('👂 Client connected to /events');

  req.on('close', () => {
    console.log('❌ Client disconnected from /events');
    clients = clients.filter(client => client !== res);
  });
});

app.post('/status-callback', (req, res) => {
  const { MessageSid, MessageStatus, To } = req.body;

  console.log(`📬 Twilio Status: ${MessageSid} -> ${MessageStatus} for ${To}`);

  const payload = JSON.stringify({
    sid: MessageSid,
    status: MessageStatus.toLowerCase(),
    to: To
  });

  clients.forEach(client => client.write(`data: ${payload}\n\n`));

  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
