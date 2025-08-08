const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 5000;
const FINNHUB_TOKEN = process.env.FINNHUB_TOKEN;
const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']; // You can expand this list

const path = require('path');

app.use(express.static(path.join(__dirname, '../client/build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

let clients = [];

wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.push(ws);

  ws.on('close', () => {
    console.log('Client disconnected');
    clients = clients.filter(client => client !== ws);
  });
});

// Function to simulate stock trend analysis and emit advice
async function fetchAndBroadcastData() {
  try {
    const prices = {};

    for (const symbol of symbols) {
      const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_TOKEN}`;
      const response = await axios.get(url);
      const data = response.data;

      prices[symbol] = {
        current: data.c,
        previousClose: data.pc,
        changePercent: (((data.c - data.pc) / data.pc) * 100).toFixed(2)
      };
    }

    // Simple logic: signal buy if up > 3%, sell if down > 3%
    const advice = Object.entries(prices).map(([symbol, data]) => {
      let action = 'HOLD';
      if (data.changePercent >= 3) action = 'BUY';
      else if (data.changePercent <= -3) action = 'SELL';

      return {
        symbol,
        currentPrice: data.current,
        changePercent: data.changePercent,
        advice: action
      };
    });

    const message = JSON.stringify({ type: 'stockUpdate', data: advice });

    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

  } catch (error) {
    console.error('Error fetching stock data:', error.message);
  }
}

// Fetch data every 15 seconds
setInterval(fetchAndBroadcastData, 15000);

// Start the server
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
