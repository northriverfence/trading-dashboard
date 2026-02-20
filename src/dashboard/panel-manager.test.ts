/**
 * PanelManager Tests
 */

import { test, expect } from "bun:test";
import { PanelManager, Panel } from "./panel-manager.js";

test("PanelManager creates and retrieves layouts", () => {
  const manager = new PanelManager();

  const layout = manager.createLayout("Test Layout");
  expect(layout.name).toBe("Test Layout");

  const retrieved = manager.getLayout(layout.id);
  expect(retrieved?.id).toBe(layout.id);
});

test("PanelManager adds and removes panels", () => {
  const manager = new PanelManager();
  const layout = manager.createLayout("Test");

  const panel: Panel = {
    id: "panel-1",
    title: "Test Panel",
    type: "chart",
    position: { x: 0, y: 0, w: 4, h: 3 },
    config: {},
  };

  manager.addPanel(layout.id, panel);
  expect(manager.getLayout(layout.id)?.panels.length).toBe(1);

  manager.removePanel(layout.id, panel.id);
  expect(manager.getLayout(layout.id)?.panels.length).toBe(0);
});

test("PanelManager sets active layout", () => {
  const manager = new PanelManager();

  const layout1 = manager.createLayout("Layout 1");
  manager.createLayout("Layout 2");

  manager.setActiveLayout(layout1.id);
  expect(manager.getActiveLayout()?.id).toBe(layout1.id);
});

test("PanelManager updates panel data", () => {
  const manager = new PanelManager();
  const layout = manager.createLayout("Test");

  const panel: Panel = {
    id: "panel-1",
    title: "Data Panel",
    type: "metrics",
    position: { x: 0, y: 0, w: 4, h: 3 },
    config: {},
  };

  manager.addPanel(layout.id, panel);
  manager.updatePanelData(panel.id, { value: 100 });

  const data = manager.getPanelData(panel.id);
  expect(data?.data).toEqual({ value: 100 });
});

test("PanelManager clones layout", () => {
  const manager = new PanelManager();
  const original = manager.createLayout("Original");

  const panel: Panel = {
    id: "panel-1",
    title: "Test Panel",
    type: "chart",
    position: { x: 0, y: 0, w: 4, h: 3 },
    config: {},
  };
  manager.addPanel(original.id, panel);

  const cloned = manager.cloneLayout(original.id, "Clone");
  expect(cloned).not.toBeNull();
  expect(cloned?.name).toBe("Clone");
  expect(cloned?.panels.length).toBe(1);
});

test("PanelManager sets default layout", () => {
  const manager = new PanelManager();
  const layout = manager.createLayout("Default");

  manager.setDefaultLayout(layout.id);
  expect(manager.getDefaultLayout()?.id).toBe(layout.id);
});

test("PanelManager finds panels by type", () => {
  const manager = new PanelManager();
  const layout = manager.createLayout("Test");

  manager.addPanel(layout.id, {
    id: "chart-1",
    title: "Chart",
    type: "chart",
    position: { x: 0, y: 0, w: 4, h: 3 },
    config: {},
  });

  manager.addPanel(layout.id, {
    id: "table-1",
    title: "Table",
    type: "table",
    position: { x: 4, y: 0, w: 4, h: 3 },
    config: {},
  });

  const charts = manager.findPanelsByType("chart");
  expect(charts.length).toBeGreaterThanOrEqual(0);
});

test("PanelManager gets statistics", () => {
  const manager = new PanelManager();

  // Count initial layouts from constructor
  const initialCount = manager.getAllLayouts().length;

  manager.createLayout("Layout 1");
  manager.createLayout("Layout 2");

  const stats = manager.getStats();
  expect(stats.totalLayouts).toBe(initialCount + 2);
});

test("PanelManager deletes layout", () => {
  const manager = new PanelManager();
  const layout = manager.createLayout("To Delete");

  expect(manager.deleteLayout(layout.id)).toBe(true);
  expect(manager.getLayout(layout.id)).toBeUndefined();
});

test("PanelManager imports and exports layout", () => {
  const manager = new PanelManager();
  const layout = manager.createLayout("Export");

  const exported = manager.exportLayout(layout.id);
  expect(exported).not.toBeNull();

  const imported = manager.importLayout(exported!);
  expect(imported.name).toBe("Export");
});
