import express from "express";
import cors from "cors";
import { createServer } from "http";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createAmmDatabase } from "./server/db";
import { createAmmRouter } from "./server/routes/ammRoutes";
import { createAdminAnalyticsRouter } from "./server/routes/adminAnalyticsRoutes";
import { apiMetricsMiddleware } from "./server/healthMonitor";
import { runAmmStrategyForMarket } from "./server/ammStrategy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  
  // Habilitar CORS para evitar "Failed to fetch" em ambientes de proxy/iframe
  app.use(cors());
  app.use(express.json());
  app.use(apiMetricsMiddleware);

  // Initialize authoritative AMM + CLOB + Double-Entry Accounting database
  const ammDb = createAmmDatabase();
  app.use("/api", createAmmRouter(ammDb));
  app.use("/api", createAdminAnalyticsRouter(ammDb));

  // Controlled autonomous AMM strategy loop (only executes when Master Admin enables AMM in SANDBOX)
  setInterval(() => {
    try {
      const settings = ammDb.prepare(`SELECT amm_enabled, emergency_halted FROM amm_settings WHERE id = 1`).get() as any;
      if (settings?.amm_enabled === 1 && settings?.emergency_halted === 0) {
        const approved = ammDb
          .prepare(`SELECT market_id FROM amm_market_allocations WHERE status = 'APPROVED' AND market_resolved = 0`)
          .all() as Array<{ market_id: string }>;
        for (const m of approved) {
          runAmmStrategyForMarket(ammDb, m.market_id);
        }
      }
    } catch (err) {
      console.error("AMM autonomous strategy cycle error:", err);
    }
  }, 15_000);

  const server = createServer(app);
  const PORT = 3000;

  // API Routes
  app.get("/api/health", (req, res) => {
    console.log('Health check requested');
    res.json({ status: "ok", platform_mode: "SANDBOX", timestamp: new Date().toISOString() });
  });

  app.get("/api/market-rates", async (req, res) => {
    console.log('Fetching market rates...');
    try {
      const symbols = ['USDAOA=X', 'EURAOA=X', 'BTC-USD', 'ETH-USD'];
      
      const fetchWithTimeout = async (symbol: string) => {
        try {
          // Yahoo Finance API
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          
          if (!response.ok) {
            console.error(`Yahoo API error for ${symbol}: ${response.status}`);
            return null;
          }
          return await response.json();
        } catch (e) {
          console.error(`Network error for ${symbol}:`, e);
          return null;
        }
      };

      const responses = await Promise.all(symbols.map(s => fetchWithTimeout(s)));

      const data: any = {};
      responses.forEach((resp: any, index) => {
        const symbol = symbols[index];
        if (resp && resp.chart?.result?.[0]?.meta?.regularMarketPrice) {
          data[symbol] = resp.chart.result[0].meta.regularMarketPrice;
        } else {
          // Fallbacks realistas caso a API falhe
          const fallbacks: any = { 'USDAOA=X': 954.5, 'EURAOA=X': 1032.12, 'BTC-USD': 65000, 'ETH-USD': 3500 };
          data[symbol] = fallbacks[symbol];
          console.warn(`Using fallback for ${symbol}`);
        }
      });

      const usdToAoa = data['USDAOA=X'] || 954.5;
      
      const rates = {
        'USD-AOA': usdToAoa,
        'EUR-AOA': data['EURAOA=X'] || (usdToAoa * 1.08),
        'BTC-AOA': (data['BTC-USD'] || 65000) * usdToAoa,
        'ETH-AOA': (data['ETH-USD'] || 3500) * usdToAoa
      };

      console.log('Rates fetched successfully');
      res.json(rates);
    } catch (error) {
      console.error('Critical error in /api/market-rates:', error);
      res.status(500).json({ error: 'Internal server error', message: String(error) });
    }
  });

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

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
