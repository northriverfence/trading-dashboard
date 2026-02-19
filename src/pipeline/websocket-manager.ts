/**
 * WebSocket Manager
 * Handles WebSocket connections with auto-reconnect
 */

import type { ConnectionState } from "../adapters/types.js";
import type { ReconnectStrategy, PipelineConfig } from "./types.js";

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string = "";
  private config: PipelineConfig;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private state: ConnectionState = "disconnected";

  private messageCallbacks: ((data: unknown) => void)[] = [];
  private openCallbacks: (() => void)[] = [];
  private closeCallbacks: ((code: number, reason: string) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];

  constructor(config: PipelineConfig) {
    this.config = config;
  }

  async connect(url: string, protocols?: string[]): Promise<void> {
    if (this.state === "connected" || this.state === "connecting") {
      return;
    }

    this.url = url;
    this.state = "connecting";

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url, protocols);

        this.ws.onopen = () => {
          this.state = "connected";
          this.reconnectAttempt = 0;
          this.startHeartbeat();
          this.openCallbacks.forEach((cb) => {
            try {
              cb();
            } catch (error) {
              console.error("Error in open callback:", error);
            }
          });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string);
            this.messageCallbacks.forEach((cb) => {
              try {
                cb(data);
              } catch (error) {
                console.error("Error in message callback:", error);
              }
            });
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        this.ws.onclose = (event) => {
          this.state = "disconnected";
          this.stopHeartbeat();
          this.closeCallbacks.forEach((cb) => {
            try {
              cb(event.code, event.reason);
            } catch (error) {
              console.error("Error in close callback:", error);
            }
          });

          if (this.config.autoReconnect) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          this.state = "error";
          const err = error instanceof Error ? error : new Error("WebSocket error");
          this.errorCallbacks.forEach((cb) => {
            try {
              cb(err);
            } catch (e) {
              console.error("Error in error callback:", e);
            }
          });
          reject(err);
        };
      } catch (error) {
        this.state = "error";
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.clearReconnectTimer();
    this.stopHeartbeat();

    if (this.ws) {
      // Disable auto-reconnect before manual disconnect
      const wasAutoReconnect = this.config.autoReconnect;
      this.config.autoReconnect = false;

      this.ws.close();
      this.ws = null;

      // Restore auto-reconnect setting
      this.config.autoReconnect = wasAutoReconnect;
    }

    this.state = "disconnected";
  }

  isConnected(): boolean {
    return this.state === "connected" && this.ws?.readyState === WebSocket.OPEN;
  }

  getState(): ConnectionState {
    return this.state;
  }

  send(data: unknown): void {
    if (!this.isConnected() || !this.ws) {
      throw new Error("WebSocket not connected");
    }

    const message = typeof data === "string" ? data : JSON.stringify(data);
    this.ws.send(message);
  }

  // Event handlers
  onMessage(callback: (data: unknown) => void): void {
    this.messageCallbacks.push(callback);
  }

  onOpen(callback: () => void): void {
    this.openCallbacks.push(callback);
  }

  onClose(callback: (code: number, reason: string) => void): void {
    this.closeCallbacks.push(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  // Reconnect logic
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = this.calculateReconnectDelay();
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt + 1})`);

    this.state = "reconnecting";
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempt++;
      this.connect(this.url).catch((error) => {
        console.error("Reconnection failed:", error);
      });
    }, delay);
  }

  private calculateReconnectDelay(): number {
    if (this.reconnectAttempt >= this.config.maxReconnectAttempts) {
      return this.config.maxReconnectDelay;
    }

    switch (this.config.reconnectStrategy) {
      case "exponential":
        return Math.min(
          this.config.baseReconnectDelay * Math.pow(2, this.reconnectAttempt),
          this.config.maxReconnectDelay,
        );
      case "linear":
        return Math.min(this.config.baseReconnectDelay * (this.reconnectAttempt + 1), this.config.maxReconnectDelay);
      case "fixed":
      default:
        return this.config.baseReconnectDelay;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // Heartbeat
  private startHeartbeat(): void {
    if (!this.config.heartbeatInterval) return;

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.ping();
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  ping(): void {
    this.send({ action: "ping" });
  }

  pong(): void {
    this.send({ action: "pong" });
  }
}
