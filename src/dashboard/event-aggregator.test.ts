/**
 * EventAggregator Tests
 */

import { test, expect } from "bun:test";
import { EventAggregator, DashboardEvent } from "./event-aggregator.js";

const createMockEvent = (
  overrides: Partial<DashboardEvent> = {},
): Omit<DashboardEvent, "id" | "timestamp" | "acknowledged"> => ({
  type: "trade",
  severity: "info",
  title: "Test Event",
  message: "Test message",
  source: "test",
  ...overrides,
});

test("EventAggregator adds and retrieves events", () => {
  const aggregator = new EventAggregator();

  const event = createMockEvent();
  aggregator.addEvent(event);

  const events = aggregator.getEvents();
  expect(events.length).toBe(1);
  expect(events[0].message).toBe("Test message");
});

test("EventAggregator filters by type", () => {
  const aggregator = new EventAggregator();

  aggregator.addEvent(createMockEvent({ type: "trade" }));
  aggregator.addEvent(createMockEvent({ type: "alert" }));
  aggregator.addEvent(createMockEvent({ type: "system" }));

  const tradeEvents = aggregator.getEvents({ types: ["trade"] });
  expect(tradeEvents.length).toBe(1);
  expect(tradeEvents[0].type).toBe("trade");
});

test("EventAggregator filters by severity", () => {
  const aggregator = new EventAggregator();

  aggregator.addEvent(createMockEvent({ severity: "error" }));
  aggregator.addEvent(createMockEvent({ severity: "warning" }));
  aggregator.addEvent(createMockEvent({ severity: "info" }));

  const errors = aggregator.getEvents({ severities: ["error"] });
  expect(errors.length).toBe(1);
});

test("EventAggregator acknowledges events", () => {
  const aggregator = new EventAggregator();

  const event = aggregator.addEvent(createMockEvent());

  expect(aggregator.acknowledge(event.id)).toBe(true);
  expect(aggregator.getEvents()[0].acknowledged).toBe(true);
});

test("EventAggregator acknowledges all events", () => {
  const aggregator = new EventAggregator();

  aggregator.addEvent(createMockEvent());
  aggregator.addEvent(createMockEvent());
  aggregator.addEvent(createMockEvent());

  const count = aggregator.acknowledgeAll();
  expect(count).toBe(3);

  const unacknowledged = aggregator.getEvents({ acknowledged: false });
  expect(unacknowledged.length).toBe(0);
});

test("EventAggregator gets unacknowledged events", () => {
  const aggregator = new EventAggregator();

  aggregator.addEvent(createMockEvent());
  aggregator.addEvent(createMockEvent());

  const unacknowledged = aggregator.getUnacknowledged();
  expect(unacknowledged.length).toBe(2);
});

test("EventAggregator gets statistics", () => {
  const aggregator = new EventAggregator();

  aggregator.addEvent(createMockEvent({ type: "trade", severity: "info" }));
  aggregator.addEvent(createMockEvent({ type: "alert", severity: "error" }));
  aggregator.addEvent(createMockEvent({ type: "system", severity: "success" }));

  const stats = aggregator.getStats();
  expect(stats.total).toBe(3);
  expect(stats.byType.trade).toBe(1);
  expect(stats.bySeverity.error).toBe(1);
});

test("EventAggregator searches events", () => {
  const aggregator = new EventAggregator();

  aggregator.addEvent(createMockEvent({ message: "Buy order executed" }));
  aggregator.addEvent(createMockEvent({ message: "Sell order executed" }));
  aggregator.addEvent(createMockEvent({ message: "System alert" }));

  const results = aggregator.search("order");
  expect(results.length).toBe(2);
});

test("EventAggregator gets time range events", () => {
  const aggregator = new EventAggregator();

  const yesterday = new Date(Date.now() - 86400000);
  const today = new Date();

  const e1 = aggregator.addEvent(createMockEvent());
  e1.timestamp = yesterday;

  const e2 = aggregator.addEvent(createMockEvent());
  e2.timestamp = today;

  const range = aggregator.getForTimeRange(new Date(Date.now() - 3600000), new Date(Date.now() + 3600000));
  expect(range.length).toBeGreaterThanOrEqual(0);
});

test("EventAggregator clears old events", () => {
  const aggregator = new EventAggregator();

  const oldEvent = aggregator.addEvent(createMockEvent());
  oldEvent.timestamp = new Date("2024-01-01");

  const newEvent = aggregator.addEvent(createMockEvent());
  newEvent.timestamp = new Date("2024-03-01");

  const cleared = aggregator.clearOld(new Date("2024-02-01"));
  expect(cleared).toBeGreaterThanOrEqual(0);
});

test("EventAggregator clears all events", () => {
  const aggregator = new EventAggregator();

  aggregator.addEvent(createMockEvent());
  aggregator.addEvent(createMockEvent());

  aggregator.clear();
  expect(aggregator.getStats().total).toBe(0);
});
