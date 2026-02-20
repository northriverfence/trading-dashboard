/**
 * PanelManager
 * Manages dashboard panels and layouts
 */

export interface Panel {
  id: string;
  title: string;
  type: "chart" | "table" | "metrics" | "list" | "news" | "alerts";
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, unknown>;
  refreshInterval?: number; // seconds
  dataSource?: string;
}

export interface Layout {
  id: string;
  name: string;
  panels: Panel[];
  default?: boolean;
}

export interface PanelUpdate {
  panelId: string;
  data: unknown;
  timestamp: Date;
}

export class PanelManager {
  private layouts: Map<string, Layout> = new Map();
  private activeLayout: string | null = null;
  private panelData: Map<string, PanelUpdate> = new Map();
  private defaultLayout: string | null = null;

  constructor() {
    this.initializeDefaultLayouts();
  }

  /**
   * Create new layout
   */
  createLayout(name: string, panels: Panel[] = []): Layout {
    const layout: Layout = {
      id: `layout-${Date.now()}`,
      name,
      panels,
    };

    this.layouts.set(layout.id, layout);
    return layout;
  }

  /**
   * Get layout by ID
   */
  getLayout(id: string): Layout | undefined {
    return this.layouts.get(id);
  }

  /**
   * Get all layouts
   */
  getAllLayouts(): Layout[] {
    return Array.from(this.layouts.values());
  }

  /**
   * Set active layout
   */
  setActiveLayout(id: string): boolean {
    if (!this.layouts.has(id)) return false;
    this.activeLayout = id;
    return true;
  }

  /**
   * Get active layout
   */
  getActiveLayout(): Layout | null {
    if (!this.activeLayout) return null;
    return this.layouts.get(this.activeLayout) || null;
  }

  /**
   * Add panel to layout
   */
  addPanel(layoutId: string, panel: Panel): boolean {
    const layout = this.layouts.get(layoutId);
    if (!layout) return false;

    layout.panels.push(panel);
    return true;
  }

  /**
   * Remove panel from layout
   */
  removePanel(layoutId: string, panelId: string): boolean {
    const layout = this.layouts.get(layoutId);
    if (!layout) return false;

    const index = layout.panels.findIndex((p) => p.id === panelId);
    if (index === -1) return false;

    layout.panels.splice(index, 1);
    this.panelData.delete(panelId);
    return true;
  }

  /**
   * Update panel configuration
   */
  updatePanel(layoutId: string, panelId: string, updates: Partial<Panel>): boolean {
    const layout = this.layouts.get(layoutId);
    if (!layout) return false;

    const panel = layout.panels.find((p) => p.id === panelId);
    if (!panel) return false;

    Object.assign(panel, updates);
    return true;
  }

  /**
   * Move panel to new position
   */
  movePanel(layoutId: string, panelId: string, position: Panel["position"]): boolean {
    return this.updatePanel(layoutId, panelId, { position });
  }

  /**
   * Resize panel
   */
  resizePanel(layoutId: string, panelId: string, w: number, h: number): boolean {
    const layout = this.layouts.get(layoutId);
    if (!layout) return false;

    const panel = layout.panels.find((p) => p.id === panelId);
    if (!panel) return false;

    panel.position.w = w;
    panel.position.h = h;
    return true;
  }

  /**
   * Update panel data
   */
  updatePanelData(panelId: string, data: unknown): void {
    this.panelData.set(panelId, {
      panelId,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Get panel data
   */
  getPanelData(panelId: string): PanelUpdate | undefined {
    return this.panelData.get(panelId);
  }

  /**
   * Get all panel data for layout
   */
  getLayoutData(layoutId: string): Map<string, PanelUpdate> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return new Map();

    const data = new Map<string, PanelUpdate>();
    for (const panel of layout.panels) {
      const panelData = this.panelData.get(panel.id);
      if (panelData) {
        data.set(panel.id, panelData);
      }
    }

    return data;
  }

  /**
   * Clone layout
   */
  cloneLayout(layoutId: string, newName: string): Layout | null {
    const layout = this.layouts.get(layoutId);
    if (!layout) return null;

    const cloned: Layout = {
      id: `layout-${Date.now()}`,
      name: newName,
      panels: layout.panels.map((p) => ({
        ...p,
        id: `panel-${Date.now()}-${Math.random()}`,
      })),
    };

    this.layouts.set(cloned.id, cloned);
    return cloned;
  }

  /**
   * Delete layout
   */
  deleteLayout(id: string): boolean {
    const layout = this.layouts.get(id);
    if (!layout) return false;

    // Clean up panel data
    for (const panel of layout.panels) {
      this.panelData.delete(panel.id);
    }

    this.layouts.delete(id);

    if (this.activeLayout === id) {
      this.activeLayout = this.defaultLayout;
    }

    return true;
  }

  /**
   * Set default layout
   */
  setDefaultLayout(id: string): boolean {
    if (!this.layouts.has(id)) return false;

    // Clear previous default
    for (const layout of this.layouts.values()) {
      layout.default = false;
    }

    // Set new default
    const layout = this.layouts.get(id)!;
    layout.default = true;
    this.defaultLayout = id;

    return true;
  }

  /**
   * Get default layout
   */
  getDefaultLayout(): Layout | null {
    if (this.defaultLayout) {
      return this.layouts.get(this.defaultLayout) || null;
    }
    return null;
  }

  /**
   * Get panel by ID
   */
  getPanel(panelId: string): { panel: Panel; layout: Layout } | null {
    for (const layout of this.layouts.values()) {
      const panel = layout.panels.find((p) => p.id === panelId);
      if (panel) {
        return { panel, layout };
      }
    }
    return null;
  }

  /**
   * Find panels by type
   */
  findPanelsByType(type: Panel["type"]): { panel: Panel; layout: Layout }[] {
    const results: { panel: Panel; layout: Layout }[] = [];

    for (const layout of this.layouts.values()) {
      for (const panel of layout.panels) {
        if (panel.type === type) {
          results.push({ panel, layout });
        }
      }
    }

    return results;
  }

  /**
   * Export layout configuration
   */
  exportLayout(layoutId: string): Layout | null {
    const layout = this.layouts.get(layoutId);
    return layout ? JSON.parse(JSON.stringify(layout)) : null;
  }

  /**
   * Import layout configuration
   */
  importLayout(layout: Layout): Layout {
    const imported: Layout = {
      ...layout,
      id: `layout-${Date.now()}`,
    };

    this.layouts.set(imported.id, imported);
    return imported;
  }

  /**
   * Get layout statistics
   */
  getStats(): {
    totalLayouts: number;
    totalPanels: number;
    panelsByType: Record<Panel["type"], number>;
  } {
    const panelsByType: Record<Panel["type"], number> = {
      chart: 0,
      table: 0,
      metrics: 0,
      list: 0,
      news: 0,
      alerts: 0,
    };

    let totalPanels = 0;

    for (const layout of this.layouts.values()) {
      for (const panel of layout.panels) {
        totalPanels++;
        panelsByType[panel.type]++;
      }
    }

    return {
      totalLayouts: this.layouts.size,
      totalPanels,
      panelsByType,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.layouts.clear();
    this.panelData.clear();
    this.activeLayout = null;
    this.defaultLayout = null;
  }

  private initializeDefaultLayouts(): void {
    // Create trading dashboard layout
    const tradingLayout = this.createLayout("Trading Dashboard", [
      {
        id: "panel-equity",
        title: "Equity Curve",
        type: "chart",
        position: { x: 0, y: 0, w: 6, h: 4 },
        config: { chartType: "equity" },
        refreshInterval: 5,
        dataSource: "portfolio",
      },
      {
        id: "panel-positions",
        title: "Positions",
        type: "table",
        position: { x: 6, y: 0, w: 6, h: 4 },
        config: { columns: ["symbol", "qty", "pnl", "entry"] },
        refreshInterval: 1,
        dataSource: "positions",
      },
      {
        id: "panel-performance",
        title: "Performance Metrics",
        type: "metrics",
        position: { x: 0, y: 4, w: 4, h: 3 },
        config: { metrics: ["winRate", "sharpe", "maxDrawdown"] },
        refreshInterval: 60,
        dataSource: "performance",
      },
      {
        id: "panel-activity",
        title: "Recent Activity",
        type: "list",
        position: { x: 4, y: 4, w: 4, h: 3 },
        config: { maxItems: 10 },
        refreshInterval: 5,
        dataSource: "trades",
      },
      {
        id: "panel-alerts",
        title: "Active Alerts",
        type: "alerts",
        position: { x: 8, y: 4, w: 4, h: 3 },
        config: { severityFilter: ["high", "medium"] },
        refreshInterval: 5,
        dataSource: "alerts",
      },
    ]);

    this.setDefaultLayout(tradingLayout.id);
    this.setActiveLayout(tradingLayout.id);

    // Create analytics layout
    this.createLayout("Analytics", [
      {
        id: "panel-distribution",
        title: "Trade Distribution",
        type: "chart",
        position: { x: 0, y: 0, w: 6, h: 4 },
        config: { chartType: "distribution" },
        refreshInterval: 300,
        dataSource: "trades",
      },
      {
        id: "panel-monthly",
        title: "Monthly Returns",
        type: "chart",
        position: { x: 6, y: 0, w: 6, h: 4 },
        config: { chartType: "monthly" },
        refreshInterval: 300,
        dataSource: "returns",
      },
      {
        id: "panel-drawdown",
        title: "Drawdown Analysis",
        type: "chart",
        position: { x: 0, y: 4, w: 6, h: 4 },
        config: { chartType: "drawdown" },
        refreshInterval: 300,
        dataSource: "equity",
      },
      {
        id: "panel-symbols",
        title: "Performance by Symbol",
        type: "table",
        position: { x: 6, y: 4, w: 6, h: 4 },
        config: { sortBy: "pnl", sortDesc: true },
        refreshInterval: 300,
        dataSource: "symbolPerformance",
      },
    ]);
  }
}
