import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("poly.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS markets (
    id TEXT PRIMARY KEY,
    question TEXT,
    category TEXT,
    imageUrl TEXT,
    volume REAL,
    endDate TEXT,
    yesPrice REAL,
    noPrice REAL,
    resolved INTEGER DEFAULT 0,
    resolutionOutcome TEXT,
    tags TEXT
  );

  CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    marketId TEXT,
    userId TEXT,
    side TEXT,
    outcome TEXT,
    amount REAL,
    shares REAL,
    price REAL,
    timestamp TEXT
  );
`);

// Seed initial data if empty
const marketCount = db.prepare("SELECT COUNT(*) as count FROM markets").get() as { count: number };
if (marketCount.count === 0) {
  const initialMarkets = [
    {
      id: '1',
      question: 'Will Donald Trump win the 2024 US Presidential Election?',
      category: 'Politics',
      imageUrl: 'https://picsum.photos/seed/trump/400/200',
      volume: 125000000,
      endDate: '2024-11-05T23:59:59Z',
      yesPrice: 0.52,
      noPrice: 0.48,
      tags: JSON.stringify(['US Election', 'Trump', '2024']),
    },
    {
      id: '2',
      question: 'Will Bitcoin reach $100,000 in 2024?',
      category: 'Crypto',
      imageUrl: 'https://picsum.photos/seed/bitcoin/400/200',
      volume: 45000000,
      endDate: '2024-12-31T23:59:59Z',
      yesPrice: 0.35,
      noPrice: 0.65,
      tags: JSON.stringify(['BTC', 'Crypto', 'Price Prediction']),
    },
    {
      id: '3',
      question: 'Will the Federal Reserve cut interest rates in June 2024?',
      category: 'Business',
      imageUrl: 'https://picsum.photos/seed/fed/400/200',
      volume: 12000000,
      endDate: '2024-06-15T23:59:59Z',
      yesPrice: 0.15,
      noPrice: 0.85,
      tags: JSON.stringify(['Economy', 'Fed', 'Interest Rates']),
    },
    {
      id: '4',
      question: 'Will OpenAI release GPT-5 in 2024?',
      category: 'Science',
      imageUrl: 'https://picsum.photos/seed/openai/400/200',
      volume: 8500000,
      endDate: '2024-12-31T23:59:59Z',
      yesPrice: 0.42,
      noPrice: 0.58,
      tags: JSON.stringify(['AI', 'OpenAI', 'GPT-5']),
    },
    {
      id: '5',
      question: 'Will Taylor Swift announce a new album by July 2024?',
      category: 'Entertainment',
      imageUrl: 'https://picsum.photos/seed/taylor/400/200',
      volume: 5200000,
      endDate: '2024-07-31T23:59:59Z',
      yesPrice: 0.68,
      noPrice: 0.32,
      tags: JSON.stringify(['Music', 'Taylor Swift', 'Pop Culture']),
    },
    {
      id: '6',
      question: 'Will the Lakers win the NBA Championship 2024?',
      category: 'Sports',
      imageUrl: 'https://picsum.photos/seed/lakers/400/200',
      volume: 22000000,
      endDate: '2024-06-30T23:59:59Z',
      yesPrice: 0.08,
      noPrice: 0.92,
      tags: JSON.stringify(['NBA', 'Lakers', 'Basketball']),
    },
    {
      id: '7',
      question: 'Will Ethereum transition to Proof of Stake by 2022?',
      category: 'Crypto',
      imageUrl: 'https://picsum.photos/seed/eth/400/200',
      volume: 500000000,
      endDate: '2022-12-31T23:59:59Z',
      yesPrice: 1,
      noPrice: 0,
      resolved: 1,
      resolutionOutcome: 'Yes',
      tags: JSON.stringify(['ETH', 'Merge', 'Crypto']),
    },
    {
      id: '8',
      question: 'Will it rain in London on June 1st, 2024?',
      category: 'Science',
      imageUrl: 'https://picsum.photos/seed/rain/400/200',
      volume: 150000,
      endDate: '2024-06-01T23:59:59Z',
      yesPrice: 0.45,
      noPrice: 0.55,
      tags: JSON.stringify(['Weather', 'London']),
    }
  ];

  const insert = db.prepare("INSERT INTO markets (id, question, category, imageUrl, volume, endDate, yesPrice, noPrice, resolved, resolutionOutcome, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  initialMarkets.forEach(m => insert.run(m.id, m.question, m.category, m.imageUrl, m.volume, m.endDate, m.yesPrice, m.noPrice, m.resolved || 0, m.resolutionOutcome || null, m.tags));
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/markets", (req, res) => {
    const markets = db.prepare("SELECT * FROM markets").all().map((m: any) => ({ ...m, tags: JSON.parse(m.tags), resolved: !!m.resolved }));
    res.json(markets);
  });

  app.get("/api/markets/:id", (req, res) => {
    const market = db.prepare("SELECT * FROM markets WHERE id = ?").get(req.params.id) as any;
    if (market) {
      res.json({ ...market, tags: JSON.parse(market.tags), resolved: !!market.resolved });
    } else {
      res.status(404).json({ error: "Market not found" });
    }
  });

  // WebSocket handling
  wss.on("connection", (ws) => {
    console.log("Client connected");
    
    const markets = db.prepare("SELECT * FROM markets").all().map((m: any) => ({ ...m, tags: JSON.parse(m.tags), resolved: !!m.resolved }));
    ws.send(JSON.stringify({ type: 'INITIAL_MARKETS', markets }));

    ws.on("message", (message) => {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'TRADE') {
        const { marketId, outcome, amount, side, userId } = data;
        const market = db.prepare("SELECT * FROM markets WHERE id = ?").get(marketId) as any;
        
        if (market && !market.resolved) {
          const priceImpact = (amount / market.volume) * 0.1;
          let newYesPrice = market.yesPrice;
          let newNoPrice = market.noPrice;

          if (outcome === 'Yes') {
            newYesPrice = Math.min(0.99, market.yesPrice + (side === 'Buy' ? priceImpact : -priceImpact));
            newNoPrice = 1 - newYesPrice;
          } else {
            newNoPrice = Math.min(0.99, market.noPrice + (side === 'Buy' ? priceImpact : -priceImpact));
            newYesPrice = 1 - newNoPrice;
          }
          
          const newVolume = market.volume + amount;
          
          db.prepare("UPDATE markets SET yesPrice = ?, noPrice = ?, volume = ? WHERE id = ?").run(newYesPrice, newNoPrice, newVolume, marketId);
          
          // Record trade
          const tradeId = Date.now().toString();
          const shares = amount / (outcome === 'Yes' ? newYesPrice : newNoPrice);
          db.prepare("INSERT INTO trades (id, marketId, userId, side, outcome, amount, shares, price, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .run(tradeId, marketId, userId, side, outcome, amount, shares, outcome === 'Yes' ? newYesPrice : newNoPrice, new Date().toISOString());

          const updatedMarket = { ...market, yesPrice: newYesPrice, noPrice: newNoPrice, volume: newVolume, tags: JSON.parse(market.tags), resolved: !!market.resolved };
          
          // Broadcast update
          const update = { type: 'MARKET_UPDATE', market: updatedMarket };
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(update));
            }
          });
        }
      }
    });
  });

  // Simulate price fluctuations
  setInterval(() => {
    const markets = db.prepare("SELECT * FROM markets WHERE resolved = 0").all() as any[];
    markets.forEach(market => {
      const change = (Math.random() - 0.5) * 0.005;
      const newYesPrice = Math.max(0.01, Math.min(0.99, market.yesPrice + change));
      const newNoPrice = 1 - newYesPrice;
      
      db.prepare("UPDATE markets SET yesPrice = ?, noPrice = ? WHERE id = ?").run(newYesPrice, newNoPrice, market.id);
      
      const updatedMarket = { ...market, yesPrice: newYesPrice, noPrice: newNoPrice, tags: JSON.parse(market.tags), resolved: !!market.resolved };
      const update = { type: 'MARKET_UPDATE', market: updatedMarket };
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(update));
        }
      });
    });
  }, 10000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
