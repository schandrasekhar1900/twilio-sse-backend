const express = require('express');
const cors = require('cors');
const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true })); // Handles Twilio's x-www-form-urlencoded
app.use(express.json());

const PORT = process.env.PORT || 3000;
let clients = [];

// ✅ SSE endpoint for frontend to connect to
app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.flushHeaders();

  console.log('👂 New frontend client connected to /events');
  clients.push(res);

  req.on('close', () => {
    console.log('❌ Frontend client disconnected');
    clients = clients.filter(client => client !== res);
  });
});

// ✅ POST endpoint to receive status updates from Twilio Function
app.post('/status-callback', (req, res) => {
  console.log('📩 Incoming /status-callback POST body:', req.body);

  const { MessageSid, MessageStatus, To } = req.body;

  if (!MessageSid || !MessageStatus || !To) {
    console.error('❌ Missing expected fields in body:', {
      MessageSid,
      MessageStatus,
      To
    });
    return res.status(400).send('Missing required fields');
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

// ✅ Start the server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
