import React, { useEffect, useRef, useState } from 'react';

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function detectTopMovers(snapshot) {
  const withChange = snapshot.map(s => ({
    ...s,
    pct: s.prevClose ? ((s.price - s.prevClose) / s.prevClose) * 100 : 0
  }));
  withChange.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  return withChange.slice(0, 10);
}

export default function App() {
  const wsRef = useRef(null);
  const [symbols, setSymbols] = useState(['AAPL','TSLA','AMD','NVDA']);
  const [snapshot, setSnapshot] = useState({});
  const [top, setTop] = useState([]);

  useEffect(() => {
    const wsUrl = `${window.location.origin.replace(/^http/, 'ws')}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to backend');
      symbols.forEach(sym => ws.send(JSON.stringify({ type: 'subscribe', symbol: sym })));
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.data) {
          const items = data.data || [];
          const next = { ...snapshot };
          items.forEach(it => {
            const sym = it.s || it.symbol;
            const price = it.p || it.price;
            const vol = it.v || it.volume || 0;
            if (!next[sym]) next[sym] = { symbol: sym, priceHistory: [], volume: 0, prevClose: price };
            next[sym].price = price;
            next[sym].priceHistory = [...(next[sym].priceHistory || []), price].slice(-200);
            next[sym].volume = (next[sym].volume || 0) + vol;
          });
          setSnapshot(next);
          const arr = Object.values(next).map(n => ({ symbol: n.symbol, price: n.price, prevClose: n.prevClose, volume: n.volume }));
          setTop(detectTopMovers(arr));
        }
      } catch (e) { console.warn('WS parse error', e); }
    };

    ws.onerror = (e) => console.warn('WS error', e);

    return () => { ws.close(); };
  }, [symbols]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Real-time Top Movers</h1>

      <div style={{ display: 'flex', gap: 40 }}>
        <div style={{ minWidth: 320 }}>
          <h3>Top movers</h3>
          <ol>
            {top.map(t => (
              <li key={t.symbol}>
                <strong>{t.symbol}</strong>: {t.price?.toFixed(2) ?? '—'} ({t.pct?.toFixed(2) ?? '0'}%), vol {t.volume ?? 0}
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h3>Watched</h3>
          <table>
            <thead><tr><th>Symbol</th><th>Price</th><th>Vol</th></tr></thead>
            <tbody>
              {Object.values(snapshot).map(s => (
                <tr key={s.symbol}><td>{s.symbol}</td><td>{s.price?.toFixed(2)}</td><td>{s.volume}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
