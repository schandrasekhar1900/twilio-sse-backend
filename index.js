const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.urlencoded({ extended: true })); // ✅ For Twilio x-www-form-urlencoded
app.use(express.json()); // ✅ For JSON payloads from your own app

// ←–– Create your in-memory list of SSE connections
let clients = [];

// ←–– NEW: SSE endpoint
app.get('/events', (req, res) => {
  // 1) Tell the browser this is an event-stream
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.flushHeaders();

  // 2) Add this connection to our list
  clients.push(res);
  console.log(`👂 SSE client connected, total: ${clients.length}`);

  // 3) When they disconnect, remove them
  req.on('close', () => {
    clients = clients.filter(c => c !== res);
    console.log(`❌ SSE client disconnected, remaining: ${clients.length}`);
  });
});

app.post('/status-callback', (req, res) => {
  console.log('📩 Raw Twilio webhook:', req.body);

  const b = req.body;
  let payload, type, raw;

  if (b.MessageSid) {
    type = 'sms';
    raw  = b.MessageStatus;
    payload = {
      type,
      sid:    b.MessageSid,
      status: (raw||'').toLowerCase(),
      to:     b.To,
      from:   b.From,
      timestamp: new Date().toISOString()
    };
  }
  else if (b.CallSid) {
    type = 'voice';
    raw  = b.CallStatus;
    payload = {
      type,
      sid:    b.CallSid,
      status: (raw||'').toLowerCase(),
      to:     b.To,
      from:   b.From,
      timestamp: new Date().toISOString()
    };
  }
  else {
    console.warn('⚠️ Unknown Twilio webhook:', b);
    return res.sendStatus(400);
  }

  console.log(`📬 ${type.toUpperCase()} callback →`, payload);

  // broadcast via SSE
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach(c => c.write(msg));

  res.sendStatus(200);
});



// ←–– Start the server
app.listen(PORT, () => {
  console.log(`🚀 SSE + status-callback server listening on port ${PORT}`);
});
