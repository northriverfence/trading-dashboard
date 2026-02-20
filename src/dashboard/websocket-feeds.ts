/**
 * WebSocketFeeds
 * Manages real-time WebSocket data feeds for the dashboard
 */

export interface WebSocketMessage {
  type: "price" | "trade" | "position" | "alert" | "metric" | "heartbeat";
  channel: string;
  timestamp: number;
  payload: unknown;
}

export interface FeedSubscriber {
  id: string;
  channels: string[];
  send: (message: WebSocketMessage) => void;
}

export interface FeedStats {
  totalSubscribers: number;
  messagesPerSecond: number;
  activeChannels: string[];
  connectionCount: number;
}

export class WebSocketFeeds {
  private subscribers: Map<string, FeedSubscriber> = new Map();
  private channelSubscriptions: Map<string, Set<string>> = new Map();
  private messageCount = 0;
  private lastStatsTime = Date.now();
  private statsResetInterval: Timer | null = null;

  constructor() {
    this.startStatsReset();
  }

  /**
   * Register a new subscriber
   */
  subscribe(subscriber: FeedSubscriber): void {
    this.subscribers.set(subscriber.id, subscriber);

    // Subscribe to channels
    for (const channel of subscriber.channels) {
      if (!this.channelSubscriptions.has(channel)) {
        this.channelSubscriptions.set(channel, new Set());
      }
      this.channelSubscriptions.get(channel)!.add(subscriber.id);
    }
  }

  /**
   * Remove a subscriber
   */
  unsubscribe(subscriberId: string): void {
    const subscriber = this.subscribers.get(subscriberId);
    if (!subscriber) return;

    // Remove from channels
    for (const channel of subscriber.channels) {
      this.channelSubscriptions.get(channel)?.delete(subscriberId);
    }

    this.subscribers.delete(subscriberId);
  }

  /**
   * Update subscriber channels
   */
  updateChannels(subscriberId: string, channels: string[]): void {
    const subscriber = this.subscribers.get(subscriberId);
    if (!subscriber) return;

    // Remove from old channels
    for (const channel of subscriber.channels) {
      this.channelSubscriptions.get(channel)?.delete(subscriberId);
    }

    // Add to new channels
    subscriber.channels = channels;
    for (const channel of channels) {
      if (!this.channelSubscriptions.has(channel)) {
        this.channelSubscriptions.set(channel, new Set());
      }
      this.channelSubscriptions.get(channel)!.add(subscriberId);
    }
  }

  /**
   * Broadcast message to channel subscribers
   */
  broadcast(channel: string, payload: unknown, type: WebSocketMessage["type"] = "metric"): void {
    const subscriberIds = this.channelSubscriptions.get(channel);
    if (!subscriberIds || subscriberIds.size === 0) return;

    const message: WebSocketMessage = {
      type,
      channel,
      timestamp: Date.now(),
      payload,
    };

    for (const subscriberId of subscriberIds) {
      const subscriber = this.subscribers.get(subscriberId);
      if (subscriber) {
        try {
          subscriber.send(message);
        } catch (error) {
          // Subscriber disconnected
          this.unsubscribe(subscriberId);
        }
      }
    }

    this.messageCount++;
  }

  /**
   * Send message to specific subscriber
   */
  sendTo(subscriberId: string, message: WebSocketMessage): boolean {
    const subscriber = this.subscribers.get(subscriberId);
    if (!subscriber) return false;

    try {
      subscriber.send(message);
      this.messageCount++;
      return true;
    } catch (error) {
      this.unsubscribe(subscriberId);
      return false;
    }
  }

  /**
   * Get feed statistics
   */
  getStats(): FeedStats {
    const elapsed = (Date.now() - this.lastStatsTime) / 1000;
    const mps = elapsed > 0 ? this.messageCount / elapsed : 0;

    return {
      totalSubscribers: this.subscribers.size,
      messagesPerSecond: Math.round(mps * 10) / 10,
      activeChannels: Array.from(this.channelSubscriptions.keys()),
      connectionCount: this.subscribers.size,
    };
  }

  /**
   * Get subscribers for channel
   */
  getChannelSubscribers(channel: string): string[] {
    return Array.from(this.channelSubscriptions.get(channel) || []);
  }

  /**
   * Check if channel has subscribers
   */
  hasSubscribers(channel: string): boolean {
    return (this.channelSubscriptions.get(channel)?.size || 0) > 0;
  }

  /**
   * Get all active channels
   */
  getActiveChannels(): string[] {
    return Array.from(this.channelSubscriptions.keys()).filter((channel) => this.hasSubscribers(channel));
  }

  /**
   * Send heartbeat to all subscribers
   */
  sendHeartbeat(): void {
    const message: WebSocketMessage = {
      type: "heartbeat",
      channel: "system",
      timestamp: Date.now(),
      payload: { status: "connected" },
    };

    for (const subscriber of this.subscribers.values()) {
      try {
        subscriber.send(message);
      } catch {
        // Ignore errors for heartbeat
      }
    }
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const subscriberId of this.subscribers.keys()) {
      this.unsubscribe(subscriberId);
    }
    this.subscribers.clear();
    this.channelSubscriptions.clear();

    if (this.statsResetInterval) {
      clearInterval(this.statsResetInterval);
      this.statsResetInterval = null;
    }
  }

  private startStatsReset(): void {
    this.statsResetInterval = setInterval(() => {
      this.lastStatsTime = Date.now();
      this.messageCount = 0;
    }, 60000); // Reset every minute
  }
}
