import { test, expect } from "bun:test";
import { RetryManager } from "../../sync/retry-manager";

test("RetryManager calculates exponential backoff", () => {
  const manager = new RetryManager({ maxRetries: 5, baseDelayMs: 100, maxDelayMs: 1600 });
  expect(manager.getDelay(0)).toBe(100);
  expect(manager.getDelay(1)).toBe(200);
  expect(manager.getDelay(2)).toBe(400);
  expect(manager.getDelay(4)).toBe(1600);
  expect(manager.getDelay(5)).toBe(1600); // capped at max
});

test("RetryManager shouldRetry returns correct values", () => {
  const manager = new RetryManager({ maxRetries: 3, baseDelayMs: 100, maxDelayMs: 1000 });
  expect(manager.shouldRetry(0)).toBe(true);
  expect(manager.shouldRetry(2)).toBe(true);
  expect(manager.shouldRetry(3)).toBe(false);
  expect(manager.shouldRetry(4)).toBe(false);
});
