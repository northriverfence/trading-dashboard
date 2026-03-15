import { test, expect } from "bun:test";
import { RateLimiter } from "../../sync/rate-limiter";

test("RateLimiter allows burst then throttles", async () => {
  const limiter = new RateLimiter({ burstLimit: 3, sustainedLimit: 1, windowMs: 1000 });

  expect(await limiter.tryAcquire()).toBe(true);
  expect(await limiter.tryAcquire()).toBe(true);
  expect(await limiter.tryAcquire()).toBe(true);
  expect(await limiter.tryAcquire()).toBe(false); // burst exhausted
});

test("RateLimiter refills tokens over time", async () => {
  const limiter = new RateLimiter({ burstLimit: 2, sustainedLimit: 10, windowMs: 100 });

  expect(await limiter.tryAcquire()).toBe(true);
  expect(await limiter.tryAcquire()).toBe(true);
  expect(await limiter.tryAcquire()).toBe(false);

  await new Promise((r) => setTimeout(r, 110));
  expect(await limiter.tryAcquire()).toBe(true); // refilled
});
