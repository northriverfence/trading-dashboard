/**
 * WebSocketFeeds Tests
 */

import { test, expect } from "bun:test";
import { WebSocketFeeds, WebSocketMessage } from "./websocket-feeds.js";

const createMockSubscriber = (id: string) => ({
  id,
  channels: ["prices", "trades"],
  messages: [] as WebSocketMessage[],
  send: function (msg: WebSocketMessage) {
    this.messages.push(msg);
  },
});

test("WebSocketFeeds subscribes clients", () => {
  const feeds = new WebSocketFeeds();
  const subscriber = createMockSubscriber("sub-1");

  feeds.subscribe(subscriber);

  expect(feeds.getStats().totalSubscribers).toBe(1);
  expect(feeds.getActiveChannels()).toContain("prices");
});

test("WebSocketFeeds unsubscribes clients", () => {
  const feeds = new WebSocketFeeds();
  const subscriber = createMockSubscriber("sub-1");

  feeds.subscribe(subscriber);
  feeds.unsubscribe(subscriber.id);

  expect(feeds.getStats().totalSubscribers).toBe(0);
});

test("WebSocketFeeds broadcasts to channel", () => {
  const feeds = new WebSocketFeeds();
  const sub1 = createMockSubscriber("sub-1");
  const sub2 = createMockSubscriber("sub-2");

  feeds.subscribe(sub1);
  feeds.subscribe(sub2);

  const message: WebSocketMessage = {
    type: "price",
    channel: "prices",
    timestamp: Date.now(),
    payload: { symbol: "AAPL", price: 150 },
  };

  feeds.broadcast("prices", message);

  expect(sub1.messages.length).toBe(1);
  expect(sub2.messages.length).toBe(1);
});

test("WebSocketFeeds sends only to specific channel subscribers", () => {
  const feeds = new WebSocketFeeds();
  const sub1 = createMockSubscriber("sub-1");
  sub1.channels = ["prices"];
  const sub2 = createMockSubscriber("sub-2");
  sub2.channels = ["trades"];

  feeds.subscribe(sub1);
  feeds.subscribe(sub2);

  const message: WebSocketMessage = {
    type: "price",
    channel: "prices",
    timestamp: Date.now(),
    payload: { symbol: "AAPL", price: 150 },
  };

  feeds.broadcast("prices", message);

  expect(sub1.messages.length).toBe(1);
  expect(sub2.messages.length).toBe(0);
});

test("WebSocketFeeds sends heartbeat", () => {
  const feeds = new WebSocketFeeds();
  const subscriber = createMockSubscriber("sub-1");

  feeds.subscribe(subscriber);
  feeds.sendHeartbeat();

  expect(subscriber.messages.length).toBe(1);
  expect(subscriber.messages[0].type).toBe("heartbeat");
});

test("WebSocketFeeds gets stats", () => {
  const feeds = new WebSocketFeeds();

  const sub1 = createMockSubscriber("sub-1");
  sub1.channels = ["prices"];
  const sub2 = createMockSubscriber("sub-2");
  sub2.channels = ["prices", "trades"];

  feeds.subscribe(sub1);
  feeds.subscribe(sub2);

  const stats = feeds.getStats();
  expect(stats.totalSubscribers).toBe(2);
  expect(stats.activeChannels).toContain("prices");
  expect(stats.activeChannels).toContain("trades");
});

test("WebSocketFeeds checks if has subscribers", () => {
  const feeds = new WebSocketFeeds();
  const subscriber = createMockSubscriber("sub-1");

  feeds.subscribe(subscriber);

  expect(feeds.hasSubscribers("prices")).toBe(true);
  expect(feeds.hasSubscribers("nonexistent")).toBe(false);
});

test("WebSocketFeeds updates subscriber channels", () => {
  const feeds = new WebSocketFeeds();
  const subscriber = createMockSubscriber("sub-1");

  feeds.subscribe(subscriber);
  feeds.updateSubscriberChannels(subscriber.id, ["prices", "alerts", "news"]);

  const stats = feeds.getStats();
  expect(stats.activeChannels).toContain("alerts");
  expect(stats.activeChannels).toContain("news");
});
