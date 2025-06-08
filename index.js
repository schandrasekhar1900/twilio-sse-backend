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
  console.log('📩 Raw Twilio webhook:', JSON.stringify(req.body, null, 2));
  const b = req.body || {};
  let payload;

  if (b.type && b.sid && b.status) {
    // ←– Handle your forwarded JSON
    console.log('✅ Detected forwarded JSON payload');
    payload = {
      type:      b.type,                  // "sms" or "voice"
      sid:       b.sid,
      status:    String(b.status).toLowerCase(),
      to:        b.to,
      from:      b.from,
      timestamp: new Date().toISOString()
    };
  }
  else if (b.MessageSid) {
    // ←– Legacy SMS webhook
    console.log('✅ Detected legacy SMS webhook');
    payload = {
      type:      'sms',
      sid:       b.MessageSid,
      status:    String(b.MessageStatus||'').toLowerCase(),
      to:        b.To,
      from:      b.From||'N/A',
      timestamp: new Date().toISOString()
    };
  }
  else if (b.CallSid) {
    // ←– Legacy Voice webhook
    console.log('✅ Detected legacy Voice webhook');
    payload = {
      type:      'voice',
      sid:       b.CallSid,
      status:    String(b.CallStatus||'').toLowerCase(),
      to:        b.To,
      from:      b.From||'N/A',
      timestamp: new Date().toISOString()
    };
  }
  else {
    console.error('❌ Unrecognized callback format:', b);
    return res.status(400).send('Bad Request');
  }

  console.log(`📬 ${payload.type.toUpperCase()} → SID:${payload.sid} status:${payload.status}`);
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach(c => c.write(msg));
  res.sendStatus(200);
});



// ←–– Start the server
app.listen(PORT, () => {
  console.log(`🚀 SSE + status-callback server listening on port ${PORT}`);
});
