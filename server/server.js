import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const FINNHUB_TOKEN = process.env.FINNHUB_TOKEN;
if (!FINNHUB_TOKEN) {
  console.error('Missing FINNHUB_TOKEN in environment variables.');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve frontend build
app.use(express.static(path.resolve('client', 'build')));

// Relay Finnhub WebSocket data
wss.on('connection', (ws) => {
  console.log('Frontend connected');

  const providerWs = new WebSocket(`wss://ws.finnhub.io?token=${FINNHUB_TOKEN}`);

  providerWs.on('open', () => {
    console.log('Connected to Finnhub');
    ws.send(JSON.stringify({ type: 'info', message: 'Connected to data stream' }));
  });

  providerWs.on('message', (msg) => {
    try { ws.send(msg.toString()); } catch(e){ console.warn('send err', e); }
  });

  ws.on('message', (msg) => {
    try { providerWs.send(msg.toString()); } catch(e){ console.warn('provider send err', e); }
  });

  ws.on('close', () => providerWs.close());
});

// Fallback for React Router
app.get('*', (req, res) => {
  res.sendFile(path.resolve('client', 'build', 'index.html'));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
