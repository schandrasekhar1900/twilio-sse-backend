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
  console.log('\n📩 === Incoming /status-callback ===');
  console.log('🕓 Time:', new Date().toISOString());
  console.log('📭 Incoming headers:', req.headers);
  console.log('📦 Raw Body:', JSON.stringify(req.body, null, 2));

  const body = req.body || {};
  let payload = {};
  let type = "";

  if (body.MessageSid) {
    // 📨 Handling SMS status update
    console.log('✅ Detected SMS callback');
    type = "sms";

    payload = {
      type,
      sid: body.MessageSid,
      status: typeof body.MessageStatus === 'string' ? body.MessageStatus.toLowerCase() : 'unknown',
      to: body.To,
      from: body.From || 'N/A',
      timestamp: new Date().toISOString()
    };

    console.log(`📝 SMS Status Extracted:
      SID: ${payload.sid}
      To: ${payload.to}
      From: ${payload.from}
      Status: ${payload.status}`);
  }

  else if (body.CallSid) {
    // 📞 Handling Voice status update
    console.log('✅ Detected Voice callback');
    type = "voice";

    payload = {
      type,
      sid: body.CallSid,
      status: typeof body.CallStatus === 'string' ? body.CallStatus.toLowerCase() : 'unknown',
      to: body.To,
      from: body.From || 'N/A',
      timestamp: new Date().toISOString()
    };

    console.log(`📝 Voice Call Status Extracted:
      SID: ${payload.sid}
      To: ${payload.to}
      From: ${payload.from}
      Status: ${payload.status}`);
  }

  else {
    console.error('❌ Unrecognized status callback format. Missing MessageSid or CallSid.');
    console.log('🔎 Body was:', JSON.stringify(body, null, 2));
    return res.status(400).send('Missing required identifiers (MessageSid or CallSid)');
  }

  // Broadcast to all active clients
  const ssePayload = `data: ${JSON.stringify(payload)}\n\n`;
  console.log(`📡 Broadcasting to ${clients.length} client(s):`, ssePayload);

  clients.forEach(client => {
    try {
      client.write(ssePayload);
    } catch (err) {
      console.error('🔥 Error writing to SSE client:', err.message);
    }
  });

  console.log('✅ Callback handled successfully.\n');
  res.status(200).send('OK');
});


// ←–– Start the server
app.listen(PORT, () => {
  console.log(`🚀 SSE + status-callback server listening on port ${PORT}`);
});
