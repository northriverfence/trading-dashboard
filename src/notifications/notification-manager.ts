/**
 * Notification System
 * Slack, Discord, and Email integrations for trading alerts
 */

import { eventLogger } from "../reporting/event-logger.js";

export type NotificationChannel = "slack" | "discord" | "email" | "all";
export type NotificationLevel = "info" | "warning" | "error" | "critical";
export type NotificationType =
  | "trade_opened"
  | "trade_closed"
  | "position_alert"
  | "daily_summary"
  | "error"
  | "system_alert"
  | "strategy_signal";

export interface NotificationConfig {
  /** Enable/disable notifications */
  enabled: boolean;
  /** Minimum level to send */
  minLevel: NotificationLevel;
  /** Rate limit (notifications per minute) */
  rateLimit: number;
  /** Slack configuration */
  slack?: {
    webhookUrl: string;
    channel?: string;
    username?: string;
    iconEmoji?: string;
  };
  /** Discord configuration */
  discord?: {
    webhookUrl: string;
    username?: string;
    avatarUrl?: string;
  };
  /** Email configuration */
  email?: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    fromAddress: string;
    toAddresses: string[];
    useTls?: boolean;
  };
  /** Type-specific settings */
  typeSettings?: Partial<
    Record<NotificationType, { enabled: boolean; channels: NotificationChannel[] }>
  >;
}

export interface NotificationMessage {
  type: NotificationType;
  level: NotificationLevel;
  title: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  symbol?: string;
  strategy?: string;
  pnl?: number;
}

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  error?: string;
}

export class NotificationManager {
  private config: NotificationConfig;
  private lastNotificationTime: Map<NotificationType, number> = new Map();
  private notificationCount: Map<string, { count: number; resetTime: number }> = new Map();
  private sessionId: string;

  constructor(config: NotificationConfig) {
    this.config = config;
    this.sessionId = crypto.randomUUID();

    // Default type settings
    const defaultTypeSettings: Record<
      NotificationType,
      { enabled: boolean; channels: NotificationChannel[] }
    > = {
      trade_opened: { enabled: true, channels: ["slack", "discord"] },
      trade_closed: { enabled: true, channels: ["slack", "discord", "email"] },
      position_alert: { enabled: true, channels: ["slack", "email"] },
      daily_summary: { enabled: true, channels: ["email"] },
      error: { enabled: true, channels: ["slack", "discord", "email"] },
      system_alert: { enabled: true, channels: ["slack", "email"] },
      strategy_signal: { enabled: false, channels: ["slack"] },
    };

    this.config.typeSettings = { ...defaultTypeSettings, ...config.typeSettings };
  }

  /**
   * Send a notification to configured channels
   */
  async notify(message: NotificationMessage): Promise<NotificationResult[]> {
    if (!this.config.enabled) {
      return [];
    }

    // Check rate limit
    if (this.isRateLimited(message.type)) {
      return [];
    }

    // Check minimum level
    if (!this.shouldSendForLevel(message.level)) {
      return [];
    }

    // Check type settings
    const typeSetting = this.config.typeSettings?.[message.type];
    if (!typeSetting?.enabled) {
      return [];
    }

    const results: NotificationResult[] = [];

    for (const channel of typeSetting.channels) {
      try {
        const result = await this.sendToChannel(message, channel);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          channel,
          error: (error as Error).message,
        });
      }
    }

    // Log notification
    eventLogger.log(
      message.level === "error" || message.level === "critical" ? "error" : "info",
      "system",
      `Notification sent: ${message.title}`,
      {
        sessionId: this.sessionId,
        details: {
          type: message.type,
          level: message.level,
          channels: results.map((r) => r.channel),
          results: results.map((r) => ({ channel: r.channel, success: r.success })),
        },
      }
    );

    return results;
  }

  /**
   * Send notification to a specific channel
   */
  private async sendToChannel(
    message: NotificationMessage,
    channel: NotificationChannel
  ): Promise<NotificationResult> {
    switch (channel) {
      case "slack":
        if (!this.config.slack?.webhookUrl) {
          return { success: false, channel, error: "Slack not configured" };
        }
        return await this.sendSlack(message);

      case "discord":
        if (!this.config.discord?.webhookUrl) {
          return { success: false, channel, error: "Discord not configured" };
        }
        return await this.sendDiscord(message);

      case "email":
        if (!this.config.email) {
          return { success: false, channel, error: "Email not configured" };
        }
        return await this.sendEmail(message);

      case "all":
        // Send to all configured channels
        const results: NotificationResult[] = [];
        if (this.config.slack?.webhookUrl) {
          results.push(await this.sendSlack(message));
        }
        if (this.config.discord?.webhookUrl) {
          results.push(await this.sendDiscord(message));
        }
        if (this.config.email) {
          results.push(await this.sendEmail(message));
        }
        // Return the first successful result or first failure
        return results.find((r) => r.success) ?? results[0] ?? { success: false, channel: "all" };

      default:
        return { success: false, channel, error: "Unknown channel" };
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(message: NotificationMessage): Promise<NotificationResult> {
    const config = this.config.slack!;
    const color = this.getSlackColor(message.level);
    const emoji = this.getEmoji(message.type, message.level);

    const payload = {
      channel: config.channel,
      username: config.username ?? "Trading Bot",
      icon_emoji: config.iconEmoji ?? emoji,
      attachments: [
        {
          color,
          title: `${emoji} ${message.title}`,
          text: message.message,
          fields: this.buildSlackFields(message),
          footer: "Trading Agent",
          ts: Math.floor(message.timestamp.getTime() / 1000),
        },
      ],
    };

    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }

    return { success: true, channel: "slack" };
  }

  /**
   * Send Discord notification
   */
  private async sendDiscord(message: NotificationMessage): Promise<NotificationResult> {
    const config = this.config.discord!;
    const color = this.getDiscordColor(message.level);
    const emoji = this.getEmoji(message.type, message.level);

    const embed = {
      title: `${emoji} ${message.title}`,
      description: message.message,
      color,
      timestamp: message.timestamp.toISOString(),
      footer: {
        text: "Trading Agent",
      },
      fields: this.buildDiscordFields(message),
    };

    if (message.pnl !== undefined) {
      embed.color = message.pnl >= 0 ? 0x10b981 : 0xef4444;
    }

    const payload = {
      username: config.username ?? "Trading Bot",
      avatar_url: config.avatarUrl,
      embeds: [embed],
    };

    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
    }

    return { success: true, channel: "discord" };
  }

  /**
   * Send Email notification
   */
  private async sendEmail(message: NotificationMessage): Promise<NotificationResult> {
    const config = this.config.email!;

    // For Bun, we'll use a simple SMTP client
    // In production, use nodemailer or similar
    const subject = `[${message.level.toUpperCase()}] ${message.title}`;
    const body = this.buildEmailBody(message);

    try {
      // Simple email sending using Bun's TCP socket
      // This is a placeholder - in production, use a proper email library
      await this.sendSmtpEmail(config, subject, body);

      return { success: true, channel: "email" };
    } catch (error) {
      throw new Error(`Email send failed: ${(error as Error).message}`);
    }
  }

  /**
   * Send SMTP email (simplified implementation)
   */
  private async sendSmtpEmail(
    config: NonNullable<NotificationConfig["email"]>,
    subject: string,
    body: string
  ): Promise<void> {
    // In a production environment, use nodemailer or similar
    // For now, log the email that would be sent
    console.log(`[EMAIL] To: ${config.toAddresses.join(", ")}`);
    console.log(`[EMAIL] Subject: ${subject}`);
    console.log(`[EMAIL] Body: ${body.substring(0, 100)}...`);

    // Simulate success
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Build Slack attachment fields
   */
  private buildSlackFields(message: NotificationMessage): Array<{ title: string; value: string; short: boolean }> {
    const fields: Array<{ title: string; value: string; short: boolean }> = [];

    if (message.symbol) {
      fields.push({ title: "Symbol", value: message.symbol, short: true });
    }

    if (message.strategy) {
      fields.push({ title: "Strategy", value: message.strategy, short: true });
    }

    if (message.pnl !== undefined) {
      fields.push({
        title: "P&L",
        value: message.pnl >= 0 ? `+$${message.pnl.toFixed(2)}` : `-$${Math.abs(message.pnl).toFixed(2)}`,
        short: true,
      });
    }

    if (message.metadata) {
      for (const [key, value] of Object.entries(message.metadata)) {
        if (fields.length < 10) {
          fields.push({
            title: key.charAt(0).toUpperCase() + key.slice(1),
            value: String(value).substring(0, 100),
            short: true,
          });
        }
      }
    }

    return fields;
  }

  /**
   * Build Discord embed fields
   */
  private buildDiscordFields(message: NotificationMessage): Array<{ name: string; value: string; inline: boolean }> {
    const fields: Array<{ name: string; value: string; inline: boolean }> = [];

    if (message.symbol) {
      fields.push({ name: "Symbol", value: message.symbol, inline: true });
    }

    if (message.strategy) {
      fields.push({ name: "Strategy", value: message.strategy, inline: true });
    }

    if (message.pnl !== undefined) {
      fields.push({
        name: "P&L",
        value: message.pnl >= 0 ? `+$${message.pnl.toFixed(2)}` : `-$${Math.abs(message.pnl).toFixed(2)}`,
        inline: true,
      });
    }

    return fields;
  }

  /**
   * Build email body
   */
  private buildEmailBody(message: NotificationMessage): string {
    let body = `${message.message}\n\n`;
    body += `Time: ${message.timestamp.toISOString()}\n`;
    body += `Type: ${message.type}\n`;
    body += `Level: ${message.level}\n`;

    if (message.symbol) {
      body += `Symbol: ${message.symbol}\n`;
    }

    if (message.strategy) {
      body += `Strategy: ${message.strategy}\n`;
    }

    if (message.pnl !== undefined) {
      body += `P&L: $${message.pnl.toFixed(2)}\n`;
    }

    if (message.metadata) {
      body += `\nMetadata:\n`;
      for (const [key, value] of Object.entries(message.metadata)) {
        body += `  ${key}: ${value}\n`;
      }
    }

    return body;
  }

  /**
   * Check if rate limited
   */
  private isRateLimited(type: NotificationType): boolean {
    const now = Date.now();
    const key = type;
    const limit = this.config.rateLimit;

    const entry = this.notificationCount.get(key);
    if (!entry) {
      this.notificationCount.set(key, { count: 1, resetTime: now + 60000 });
      return false;
    }

    // Reset if minute has passed
    if (now > entry.resetTime) {
      this.notificationCount.set(key, { count: 1, resetTime: now + 60000 });
      return false;
    }

    // Check limit
    if (entry.count >= limit) {
      return true;
    }

    entry.count++;
    return false;
  }

  /**
   * Check if should send for level
   */
  private shouldSendForLevel(level: NotificationLevel): boolean {
    const levels: NotificationLevel[] = ["info", "warning", "error", "critical"];
    const minIndex = levels.indexOf(this.config.minLevel);
    const levelIndex = levels.indexOf(level);
    return levelIndex >= minIndex;
  }

  /**
   * Get Slack color for level
   */
  private getSlackColor(level: NotificationLevel): string {
    switch (level) {
      case "critical":
        return "danger";
      case "error":
        return "danger";
      case "warning":
        return "warning";
      case "info":
        return "good";
      default:
        return "#3b82f6";
    }
  }

  /**
   * Get Discord color for level
   */
  private getDiscordColor(level: NotificationLevel): number {
    switch (level) {
      case "critical":
        return 0xdc2626;
      case "error":
        return 0xef4444;
      case "warning":
        return 0xf59e0b;
      case "info":
        return 0x3b82f6;
      default:
        return 0x64748b;
    }
  }

  /**
   * Get emoji for notification
   */
  private getEmoji(type: NotificationType, level: NotificationLevel): string {
    // Level overrides
    if (level === "critical") return ":rotating_light:";
    if (level === "error") return ":x:";

    // Type-based
    switch (type) {
      case "trade_opened":
        return ":chart_with_upwards_trend:";
      case "trade_closed":
        return ":heavy_check_mark:";
      case "position_alert":
        return ":warning:";
      case "daily_summary":
        return ":calendar:";
      case "strategy_signal":
        return ":bell:";
      case "error":
        return ":x:";
      case "system_alert":
        return ":gear:";
      default:
        return ":information_source:";
    }
  }

  /**
   * Send trade opened notification
   */
  async notifyTradeOpened(symbol: string, side: "buy" | "sell", qty: number, price: number, strategy?: string): Promise<void> {
    await this.notify({
      type: "trade_opened",
      level: "info",
      title: "Position Opened",
      message: `${side.toUpperCase()} ${qty} shares of ${symbol} at $${price.toFixed(2)}`,
      timestamp: new Date(),
      symbol,
      strategy,
      metadata: { side, qty, price },
    });
  }

  /**
   * Send trade closed notification
   */
  async notifyTradeClosed(
    symbol: string,
    qty: number,
    entryPrice: number,
    exitPrice: number,
    pnl: number,
    strategy?: string
  ): Promise<void> {
    const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
    const isWin = pnl >= 0;

    await this.notify({
      type: "trade_closed",
      level: isWin ? "info" : "warning",
      title: `Position Closed - ${isWin ? "WIN" : "LOSS"}`,
      message: `Closed ${qty} shares of ${symbol} @ $${exitPrice.toFixed(2)}\nP&L: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`,
      timestamp: new Date(),
      symbol,
      strategy,
      pnl,
      metadata: { qty, entryPrice, exitPrice, pnlPercent },
    });
  }

  /**
   * Send error notification
   */
  async notifyError(error: Error, context?: string): Promise<void> {
    await this.notify({
      type: "error",
      level: "error",
      title: "Error Occurred",
      message: context ? `${context}: ${error.message}` : error.message,
      timestamp: new Date(),
      metadata: { stack: error.stack },
    });
  }

  /**
   * Send daily summary
   */
  async notifyDailySummary(summary: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnl: number;
    winRate: number;
  }): Promise<void> {
    const isPositive = summary.totalPnl >= 0;

    await this.notify({
      type: "daily_summary",
      level: "info",
      title: "Daily Trading Summary",
      message: `Trades: ${summary.totalTrades} | Wins: ${summary.winningTrades} | Losses: ${summary.losingTrades}\nTotal P&L: ${isPositive ? "+" : ""}$${summary.totalPnl.toFixed(2)} | Win Rate: ${(summary.winRate * 100).toFixed(1)}%`,
      timestamp: new Date(),
      pnl: summary.totalPnl,
      metadata: summary,
    });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export { NotificationManager };
