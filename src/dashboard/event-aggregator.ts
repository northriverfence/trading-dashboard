/**
 * EventAggregator
 * Aggregates and routes dashboard events
 */

export interface DashboardEvent {
  id: string;
  type: "trade" | "alert" | "system" | "market" | "performance";
  severity: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  timestamp: Date;
  source: string;
  data?: Record<string, unknown>;
  acknowledged?: boolean;
}

export interface EventFilter {
  types?: DashboardEvent["type"][];
  severities?: DashboardEvent["severity"][];
  sources?: string[];
  since?: Date;
  acknowledged?: boolean;
}

export interface EventStats {
  total: number;
  byType: Record<DashboardEvent["type"], number>;
  bySeverity: Record<DashboardEvent["severity"], number>;
  bySource: Record<string, number>;
  unacknowledged: number;
}

export class EventAggregator {
  private events: DashboardEvent[] = [];
  private maxEvents = 1000;
  private handlers: Map<DashboardEvent["type"], ((event: DashboardEvent) => void)[]> = new Map();

  /**
   * Add an event
   */
  addEvent(event: Omit<DashboardEvent, "id" | "timestamp" | "acknowledged">): DashboardEvent {
    const fullEvent: DashboardEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.events.push(fullEvent);

    // Trim if needed
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Notify handlers
    this.notifyHandlers(fullEvent);

    return fullEvent;
  }

  /**
   * Register event handler
   */
  on(type: DashboardEvent["type"], handler: (event: DashboardEvent) => void): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Get events with filter
   */
  getEvents(filter?: EventFilter, limit = 100): DashboardEvent[] {
    let filtered = [...this.events];

    if (filter) {
      if (filter.types) {
        filtered = filtered.filter((e) => filter.types!.includes(e.type));
      }
      if (filter.severities) {
        filtered = filtered.filter((e) => filter.severities!.includes(e.severity));
      }
      if (filter.sources) {
        filtered = filtered.filter((e) => filter.sources!.includes(e.source));
      }
      if (filter.since) {
        filtered = filtered.filter((e) => e.timestamp >= filter.since!);
      }
      if (filter.acknowledged !== undefined) {
        filtered = filtered.filter((e) => e.acknowledged === filter.acknowledged);
      }
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
  }

  /**
   * Acknowledge event
   */
  acknowledge(eventId: string): boolean {
    const event = this.events.find((e) => e.id === eventId);
    if (!event) return false;
    event.acknowledged = true;
    return true;
  }

  /**
   * Acknowledge all events
   */
  acknowledgeAll(filter?: EventFilter): number {
    let toAcknowledge = this.events;

    if (filter) {
      toAcknowledge = this.getEvents(filter, this.maxEvents);
    }

    let count = 0;
    for (const event of toAcknowledge) {
      if (!event.acknowledged) {
        event.acknowledged = true;
        count++;
      }
    }

    return count;
  }

  /**
   * Get event statistics
   */
  getStats(): EventStats {
    const byType: Record<DashboardEvent["type"], number> = {
      trade: 0,
      alert: 0,
      system: 0,
      market: 0,
      performance: 0,
    };

    const bySeverity: Record<DashboardEvent["severity"], number> = {
      info: 0,
      warning: 0,
      error: 0,
      success: 0,
    };

    const bySource: Record<string, number> = {};
    let unacknowledged = 0;

    for (const event of this.events) {
      byType[event.type]++;
      bySeverity[event.severity]++;

      if (!bySource[event.source]) {
        bySource[event.source] = 0;
      }
      bySource[event.source]++;

      if (!event.acknowledged) {
        unacknowledged++;
      }
    }

    return {
      total: this.events.length,
      byType,
      bySeverity,
      bySource,
      unacknowledged,
    };
  }

  /**
   * Get unacknowledged events
   */
  getUnacknowledged(limit = 50): DashboardEvent[] {
    return this.getEvents({ acknowledged: false }, limit);
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit = 10): DashboardEvent[] {
    return this.getEvents({ severities: ["error"] }, limit);
  }

  /**
   * Get events by source
   */
  getBySource(source: string, limit = 50): DashboardEvent[] {
    return this.getEvents({ sources: [source] }, limit);
  }

  /**
   * Search events by text
   */
  search(query: string): DashboardEvent[] {
    const lowerQuery = query.toLowerCase();
    return this.events.filter(
      (e) =>
        e.message.toLowerCase().includes(lowerQuery) ||
        e.title.toLowerCase().includes(lowerQuery) ||
        e.source.toLowerCase().includes(lowerQuery),
    );
  }

  /**
   * Get events for time range
   */
  getForTimeRange(start: Date, end: Date): DashboardEvent[] {
    return this.events.filter((e) => e.timestamp >= start && e.timestamp <= end);
  }

  /**
   * Clear old events
   */
  clearOld(before: Date): number {
    const initialCount = this.events.length;
    this.events = this.events.filter((e) => e.timestamp >= before);
    return initialCount - this.events.length;
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Export events
   */
  export(): DashboardEvent[] {
    return [...this.events];
  }

  /**
   * Import events
   */
  import(events: DashboardEvent[]): void {
    this.events.push(...events);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  private notifyHandlers(event: DashboardEvent): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (err) {
          console.error(`Event handler error: ${err}`);
        }
      }
    }
  }
}
