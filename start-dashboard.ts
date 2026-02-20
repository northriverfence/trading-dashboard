/**
 * Start Dashboard Server Script
 */
import { DashboardServer } from "./src/dashboard/dashboard-server";

const server = new DashboardServer({
  port: 3003,
  host: "31.220.22.79",
  enableCors: true,
});

console.log("Starting Trading Dashboard Server...");

await server.start();

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down dashboard server...");
  await server.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down dashboard server...");
  await server.stop();
  process.exit(0);
});

// Simulate some demo data
let counter = 0;
const demoInterval = setInterval(() => {
  counter++;

  // Send equity update
  server.updateEquity({
    totalEquity: 100000 + Math.sin(counter * 0.1) * 1000,
    cash: 25000,
    positionsValue: 75000 + Math.sin(counter * 0.1) * 1000,
    unrealizedPnl: Math.sin(counter * 0.1) * 1000,
    realizedPnl: 500 + counter * 10,
    dailyReturn: Math.sin(counter * 0.05) * 0.5,
    totalReturn: 5 + counter * 0.01,
  });

  // Send system status
  server.updateSystem({
    memory: 128 + Math.random() * 50,
    cpu: 15 + Math.random() * 10,
    uptime: counter * 2,
    activeStrategies: 3,
    openPositions: 2 + Math.floor(Math.random() * 3),
  });

  // Occasionally send trade
  if (counter % 10 === 0) {
    server.updateTrade({
      id: `trade-${counter}`,
      timestamp: new Date(),
      symbol: ["AAPL", "TSLA", "NVDA"][Math.floor(Math.random() * 3)],
      side: Math.random() > 0.5 ? "buy" : "sell",
      qty: 10 + Math.floor(Math.random() * 100),
      price: 100 + Math.random() * 200,
      pnl: (Math.random() - 0.3) * 500,
    });
  }

  // Occasionally send position update
  if (counter % 5 === 0) {
    server.updatePosition({
      symbol: "AAPL",
      side: "long",
      qty: 100,
      entryPrice: 150,
      currentPrice: 150 + Math.sin(counter * 0.1) * 10,
      unrealizedPnl: Math.sin(counter * 0.1) * 1000,
      unrealizedPnlPercent: Math.sin(counter * 0.1) * 5,
    });
  }
}, 2000);

console.log("Demo data streaming started (updates every 2 seconds)");
console.log("Press Ctrl+C to stop");
