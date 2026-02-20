import { test, expect } from "bun:test";
import { MemoryPruner } from "../../memory/pruner.js";

test("Pruner removes low importance entries", () => {
  const pruner = new MemoryPruner({ maxSize: 2 });

  const entries = [
    { id: "low", importance: 0.1 },
    { id: "medium", importance: 0.5 },
    { id: "high", importance: 0.9 },
  ];

  const pruned = pruner.prune(entries);
  expect(pruned.length).toBe(2);
  expect(pruned.some((e) => e.id === "low")).toBe(false);
});

test("Pruner keeps high importance entries", () => {
  const pruner = new MemoryPruner({ maxSize: 2 });

  const entries = [
    { id: "high1", importance: 0.9 },
    { id: "high2", importance: 0.8 },
    { id: "low", importance: 0.1 },
  ];

  const pruned = pruner.prune(entries);
  expect(pruned.some((e) => e.id === "high1")).toBe(true);
  expect(pruned.some((e) => e.id === "high2")).toBe(true);
});
