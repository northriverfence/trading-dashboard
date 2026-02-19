/**
 * Dashboard Server
 * WebSocket server for real-time trading dashboard
 */

import type { ServerWebSocket } from "bun";
import { eventLogger, type EventEntry } from "../reporting/event-logger.js";

export interface DashboardConfig {
  port: number;
  host: string;
  enableCors: boolean;
}

export interface DashboardData {
  type: "position" | "trade" | "equity" | "signal" | "market" | "system";
  timestamp: Date;
  data: unknown;
}

export interface PositionUpdate {
  symbol: string;
  side: "long" | "short";
  qty: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export interface EquityUpdate {
  totalEquity: number;
  cash: number;
  positionsValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  dailyReturn: number;
  totalReturn: number;
}

export interface TradeUpdate {
  id: string;
  timestamp: Date;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  pnl?: number;
}

export class DashboardServer {
  private config: DashboardConfig;
  private server: ReturnType<typeof Bun.serve> | null = null;
  private clients: Set<ServerWebSocket<unknown>> = new Set();
  private sessionId: string;

  constructor(config: Partial<DashboardConfig> = {}) {
    this.config = {
      port: 3001,
      host: "0.0.0.0",
      enableCors: true,
      ...config,
    };
    this.sessionId = crypto.randomUUID();
  }

  /**
   * Start the dashboard server
   */
  async start(): Promise<void> {
    const html = this.generateDashboardHTML();

    this.server = Bun.serve({
      port: this.config.port,
      hostname: this.config.host,
      routes: {
        "/": new Response(html, {
          headers: { "Content-Type": "text/html" },
        }),
        "/api/status": () => {
          return new Response(
            JSON.stringify({
              status: "running",
              clients: this.clients.size,
              sessionId: this.sessionId,
              timestamp: new Date().toISOString(),
            }),
            {
              headers: {
                "Content-Type": "application/json",
                ...(this.config.enableCors && { "Access-Control-Allow-Origin": "*" }),
              },
            }
          );
        },
      },
      websocket: {
        open: (ws) => {
          this.clients.add(ws);
          console.log(`Dashboard client connected. Total: ${this.clients.size}`);

          // Send welcome message
          ws.send(
            JSON.stringify({
              type: "connected",
              timestamp: new Date().toISOString(),
              message: "Connected to trading dashboard",
            })
          );
        },
        message: (ws, message) => {
          try {
            const data = JSON.parse(message.toString());
            this.handleClientMessage(ws, data);
          } catch {
            // Ignore invalid messages
          }
        },
        close: (ws) => {
          this.clients.delete(ws);
          console.log(`Dashboard client disconnected. Total: ${this.clients.size}`);
        },
      },
    });

    console.log(`📊 Dashboard server running at http://${this.config.host}:${this.config.port}`);

    eventLogger.log("info", "system", "Dashboard server started", {
      sessionId: this.sessionId,
      details: {
        port: this.config.port,
        host: this.config.host,
      },
    });
  }

  /**
   * Stop the dashboard server
   */
  async stop(): Promise<void> {
    // Close all client connections
    for (const client of Array.from(this.clients)) {
      client.close();
    }
    this.clients.clear();

    // Stop the server
    this.server?.stop();
    this.server = null;

    console.log("Dashboard server stopped");
  }

  /**
   * Broadcast data to all connected clients
   */
  broadcast(data: DashboardData): void {
    const message = JSON.stringify({
      ...data,
      timestamp: data.timestamp.toISOString(),
    });

    for (const client of Array.from(this.clients)) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  /**
   * Send position update
   */
  updatePosition(position: PositionUpdate): void {
    this.broadcast({
      type: "position",
      timestamp: new Date(),
      data: position,
    });
  }

  /**
   * Send equity update
   */
  updateEquity(equity: EquityUpdate): void {
    this.broadcast({
      type: "equity",
      timestamp: new Date(),
      data: equity,
    });
  }

  /**
   * Send trade update
   */
  updateTrade(trade: TradeUpdate): void {
    this.broadcast({
      type: "trade",
      timestamp: new Date(),
      data: trade,
    });
  }

  /**
   * Send signal update
   */
  updateSignal(signal: {
    strategy: string;
    symbol: string;
    action: string;
    confidence: number;
    timestamp: Date;
  }): void {
    this.broadcast({
      type: "signal",
      timestamp: new Date(),
      data: signal,
    });
  }

  /**
   * Send system status update
   */
  updateSystem(status: {
    memory: number;
    cpu: number;
    uptime: number;
    activeStrategies: number;
    openPositions: number;
  }): void {
    this.broadcast({
      type: "system",
      timestamp: new Date(),
      data: status,
    });
  }

  /**
   * Handle incoming client message
   */
  private handleClientMessage(
    ws: ServerWebSocket<unknown>,
    data: { type: string; payload?: unknown }
  ): void {
    switch (data.type) {
      case "ping":
        ws.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }));
        break;
      case "subscribe":
        // Handle subscription to specific data feeds
        break;
      case "unsubscribe":
        // Handle unsubscription
        break;
    }
  }

  /**
   * Generate the dashboard HTML
   */
  private generateDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trading Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            line-height: 1.6;
        }
        .header {
            background: #1e293b;
            padding: 1rem 2rem;
            border-bottom: 1px solid #334155;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .header h1 {
            font-size: 1.5rem;
            color: #3b82f6;
        }
        .status {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .container {
            padding: 2rem;
            max-width: 1400px;
            margin: 0 auto;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        .card {
            background: #1e293b;
            border-radius: 12px;
            padding: 1.5rem;
            border: 1px solid #334155;
        }
        .card h3 {
            color: #94a3b8;
            font-size: 0.875rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 1rem;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 0;
            border-bottom: 1px solid #334155;
        }
        .metric:last-child {
            border-bottom: none;
        }
        .metric-label {
            color: #64748b;
            font-size: 0.875rem;
        }
        .metric-value {
            font-weight: 600;
            font-size: 1.125rem;
        }
        .positive {
            color: #10b981;
        }
        .negative {
            color: #ef4444;
        }
        .neutral {
            color: #f59e0b;
        }
        .positions-table {
            width: 100%;
            border-collapse: collapse;
        }
        .positions-table th,
        .positions-table td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid #334155;
        }
        .positions-table th {
            color: #94a3b8;
            font-weight: 500;
            font-size: 0.875rem;
        }
        .positions-table tr:hover {
            background: #334155;
        }
        .log-container {
            background: #0f172a;
            border-radius: 8px;
            padding: 1rem;
            max-height: 300px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 0.875rem;
        }
        .log-entry {
            padding: 0.25rem 0;
            border-bottom: 1px solid #1e293b;
        }
        .log-time {
            color: #64748b;
        }
        .log-message {
            color: #e2e8f0;
        }
        .connection-status {
            position: fixed;
            bottom: 1rem;
            right: 1rem;
            padding: 0.75rem 1rem;
            background: #1e293b;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Trading Dashboard</h1>
        <div class="status">
            <div class="status-dot"></div>
            <span>Live</span>
        </div>
    </div>

    <div class="container">
        <!-- Summary Cards -->
        <div class="grid" id="summary-cards">
            <div class="card">
                <h3>Portfolio Value</h3>
                <div class="metric">
                    <span class="metric-label">Total Equity</span>
                    <span class="metric-value" id="total-equity">$0.00</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Cash</span>
                    <span class="metric-value" id="cash">$0.00</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Positions</span>
                    <span class="metric-value" id="positions-value">$0.00</span>
                </div>
            </div>

            <div class="card">
                <h3>Performance</h3>
                <div class="metric">
                    <span class="metric-label">Daily Return</span>
                    <span class="metric-value" id="daily-return">0.00%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Total Return</span>
                    <span class="metric-value" id="total-return">0.00%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Unrealized P&L</span>
                    <span class="metric-value" id="unrealized-pnl">$0.00</span>
                </div>
            </div>

            <div class="card">
                <h3>System Status</h3>
                <div class="metric">
                    <span class="metric-label">Active Strategies</span>
                    <span class="metric-value" id="active-strategies">0</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Open Positions</span>
                    <span class="metric-value" id="open-positions">0</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Uptime</span>
                    <span class="metric-value" id="uptime">00:00:00</span>
                </div>
            </div>
        </div>

        <!-- Positions -->
        <div class="card" style="margin-bottom: 1.5rem;">
            <h3>Open Positions</h3>
            <div id="positions-container">
                <p style="color: #64748b;">No open positions</p>
            </div>
        </div>

        <!-- Trade Log -->
        <div class="card">
            <h3>Recent Trades</h3>
            <div class="log-container" id="trade-log">
                <div class="log-entry">
                    <span class="log-time">--:--:--</span>
                    <span class="log-message">Waiting for trades...</span>
                </div>
            </div>
        </div>
    </div>

    <div class="connection-status">
        <div class="status-dot" id="connection-dot"></div>
        <span id="connection-text">Connecting...</span>
    </div>

    <script>
        const ws = new WebSocket('ws://' + window.location.host);

        ws.onopen = () => {
            console.log('Connected to dashboard');
            document.getElementById('connection-dot').style.background = '#10b981';
            document.getElementById('connection-text').textContent = 'Connected';
        };

        ws.onclose = () => {
            console.log('Disconnected from dashboard');
            document.getElementById('connection-dot').style.background = '#ef4444';
            document.getElementById('connection-text').textContent = 'Disconnected';
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            document.getElementById('connection-dot').style.background = '#f59e0b';
            document.getElementById('connection-text').textContent = 'Error';
        };

        const positions = new Map();
        const trades = [];

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            switch (message.type) {
                case 'connected':
                    console.log('Dashboard connected:', message);
                    break;

                case 'position':
                    updatePosition(message.data);
                    break;

                case 'equity':
                    updateEquity(message.data);
                    break;

                case 'trade':
                    addTrade(message.data);
                    break;

                case 'system':
                    updateSystem(message.data);
                    break;

                case 'signal':
                    addSignal(message.data);
                    break;
            }
        };

        function updatePosition(data) {
            positions.set(data.symbol, data);
            renderPositions();
        }

        function renderPositions() {
            const container = document.getElementById('positions-container');
            if (positions.size === 0) {
                container.innerHTML = '<p style="color: #64748b;">No open positions</p>';
                return;
            }

            let html = '<table class="positions-table"><thead><tr>';
            html += '<th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th><th>Current</th><th>P&L</th><th>P&L %</th>';
            html += '</tr></thead><tbody>';

            for (const pos of positions.values()) {
                const pnlClass = pos.unrealizedPnl >= 0 ? 'positive' : 'negative';
                html += \`
                    \u003ctr\u003e
                        \u003ctd\u003e\${pos.symbol}\u003c/td\u003e
                        \u003ctd\u003e\${pos.side.toUpperCase()}\u003c/td\u003e
                        \u003ctd\u003e\${pos.qty}\u003c/td\u003e
                        \u003ctd\u003e$\${pos.entryPrice.toFixed(2)}\u003c/td\u003e
                        \u003ctd\u003e$\${pos.currentPrice.toFixed(2)}\u003c/td\u003e
                        \u003ctd class="\${pnlClass}">$\${pos.unrealizedPnl.toFixed(2)}\u003c/td\u003e
                        \u003ctd class="\${pnlClass}">\${pos.unrealizedPnlPercent.toFixed(2)}%\u003c/td\u003e
                    \u003c/tr\u003e
                \`;
            }

            html += '</tbody></table>';
            container.innerHTML = html;
        }

        function updateEquity(data) {
            document.getElementById('total-equity').textContent = '$' + data.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            document.getElementById('cash').textContent = '$' + data.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            document.getElementById('positions-value').textContent = '$' + data.positionsValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            const dailyReturn = document.getElementById('daily-return');
            dailyReturn.textContent = (data.dailyReturn >= 0 ? '+' : '') + data.dailyReturn.toFixed(2) + '%';
            dailyReturn.className = 'metric-value ' + (data.dailyReturn >= 0 ? 'positive' : 'negative');

            const totalReturn = document.getElementById('total-return');
            totalReturn.textContent = (data.totalReturn >= 0 ? '+' : '') + data.totalReturn.toFixed(2) + '%';
            totalReturn.className = 'metric-value ' + (data.totalReturn >= 0 ? 'positive' : 'negative');

            const unrealized = document.getElementById('unrealized-pnl');
            unrealized.textContent = '$' + data.unrealizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            unrealized.className = 'metric-value ' + (data.unrealizedPnl >= 0 ? 'positive' : 'negative');
        }

        function addTrade(trade) {
            trades.unshift(trade);
            if (trades.length > 50) trades.pop();
            renderTrades();
        }

        function renderTrades() {
            const container = document.getElementById('trade-log');
            let html = '';

            for (const trade of trades) {
                const time = new Date(trade.timestamp).toLocaleTimeString();
                const pnl = trade.pnl ? (trade.pnl >= 0 ? '+' : '') + '$' + trade.pnl.toFixed(2) : '';
                const pnlClass = trade.pnl >= 0 ? 'positive' : 'negative';
                html += \`
                    \u003cdiv class="log-entry">
                        \u003cspan class="log-time">\${time}\u003c/span>
                        \u003cspan class="log-message">
                            \${trade.side.toUpperCase()} \${trade.qty} \${trade.symbol} @ $\${trade.price.toFixed(2)}
                            \${pnl ? \`\u003cspan class="\${pnlClass}">(\${pnl})\u003c/span>\` : ''}
                        \u003c/span>
                    \u003c/div\u003e
                \`;
            }

            container.innerHTML = html;
        }

        function updateSystem(data) {
            document.getElementById('active-strategies').textContent = data.activeStrategies;
            document.getElementById('open-positions').textContent = data.openPositions;
            document.getElementById('uptime').textContent = formatUptime(data.uptime);
        }

        function addSignal(data) {
            const container = document.getElementById('trade-log');
            const time = new Date(data.timestamp).toLocaleTimeString();
            const html = \`
                \u003cdiv class="log-entry">
                    \u003cspan class="log-time">\${time}\u003c/span>
                    \u003cspan class="log-message neutral">
                        SIGNAL: \${data.action.toUpperCase()} \${data.symbol} (\${data.strategy}) - Confidence: \${(data.confidence * 100).toFixed(0)}%
                    \u003c/span>
                \u003c/div\u003e
            \`;
            container.insertAdjacentHTML('afterbegin', html);
        }

        function formatUptime(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            return \`\${hours.toString().padStart(2, '0')}:\${minutes.toString().padStart(2, '0')}:\${secs.toString().padStart(2, '0')}\`;
        }

        // Ping server every 30 seconds to keep connection alive
        setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    </script>
</body>
</html>
`;
  }
}

