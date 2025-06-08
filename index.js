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
  console.log('\n📩 Incoming /status-callback:', JSON.stringify(req.body, null, 2));

  const body = req.body || {};
  let payload, type, rawStatus;

  if (body.type && body.sid && body.status) {
    // ─── Forwarded JSON (from your Twilio Function) ─────────
    console.log('✅ Detected forwarded JSON payload');
    type      = body.type;        // 'sms' or 'voice'
    rawStatus = body.status;
    payload   = {
      type,
      sid:      body.sid,
      status:   String(rawStatus).toLowerCase(),
      to:       body.to,
      from:     body.from,
      timestamp: new Date().toISOString()
    };
  }
  else if (body.MessageSid) {
    // ─── Legacy SMS webhook ────────────────────────────────
    console.log('✅ Detected legacy SMS webhook');
    type      = 'sms';
    rawStatus = body.MessageStatus;
    payload   = {
      type,
      sid:      body.MessageSid,
      status:   String(rawStatus || '').toLowerCase(),
      to:       body.To,
      from:     body.From || 'N/A',
      timestamp: new Date().toISOString()
    };
  }
  else if (body.CallSid) {
    // ─── Legacy Voice webhook ──────────────────────────────
    console.log('✅ Detected legacy Voice webhook');
    type      = 'voice';
    rawStatus = body.CallStatus;
    payload   = {
      type,
      sid:      body.CallSid,
      status:   String(rawStatus || '').toLowerCase(),
      to:       body.To,
      from:     body.From || 'N/A',
      timestamp: new Date().toISOString()
    };
  }
  else {
    console.error('❌ Unrecognized callback format –', body);
    return res.status(400).send('Bad Request: Unknown format');
  }

  console.log(`📬 ${type.toUpperCase()} → SID: ${payload.sid}, status: ${payload.status}, to: ${payload.to}`);

  // now broadcast to SSE clients
  const sseData = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach(c => {
    try { c.write(sseData); }
    catch (err) { console.error('🔥 SSE write error:', err.message); }
  });

  res.sendStatus(200);
});


// ←–– Start the server
app.listen(PORT, () => {
  console.log(`🚀 SSE + status-callback server listening on port ${PORT}`);
});
