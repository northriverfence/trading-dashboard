// Type declarations for @alpacahq/alpaca-trade-api

declare module "@alpacahq/alpaca-trade-api" {
  export interface AlpacaCredentials {
    key: string;
    secret: string;
    paper?: boolean;
  }

  export interface AlpacaConfig {
    keyId: string;
    secretKey: string;
    paper?: boolean;
    useProxy?: boolean;
  }

  export interface Clock {
    timestamp: string;
    is_open: boolean;
    next_open: string;
    next_close: string;
  }

  export interface Quote {
    symbol: string;
    bidPrice: number;
    bidSize: number;
    askPrice: number;
    askSize: number;
    timestamp: string;
  }

  export interface Bar {
    t: string; // timestamp
    o: number; // open
    h: number; // high
    l: number; // low
    c: number; // close
    v: number; // volume
    n?: number; // number of trades
    vw?: number; // volume weighted average price
  }

  export interface Account {
    id: string;
    account_number: string;
    status: string;
    currency: string;
    buying_power: number;
    regt_buying_power: number;
    daytrading_buying_power: number;
    cash: number;
    portfolio_value: number;
    pattern_day_trader: boolean;
    trading_blocked: boolean;
    transfers_blocked: boolean;
    account_blocked: boolean;
    trade_suspended_by_user: boolean;
    shorting_enabled: boolean;
    equity: number;
    last_equity: number;
    long_market_value: number;
    short_market_value: number;
    initial_margin: number;
    maintenance_margin: number;
    last_maintenance_margin: number;
    daytrade_count: number;
  }

  export interface Position {
    asset_id: string;
    symbol: string;
    exchange: string;
    asset_class: string;
    asset_marginable: boolean;
    qty: string;
    avg_entry_price: string;
    side: "long" | "short";
    market_value: string;
    cost_basis: string;
    unrealized_pl: string;
    unrealized_plpc: string;
    unrealized_intraday_pl: string;
    unrealized_intraday_plpc: string;
    current_price: string;
    lastday_price: string;
    change_today: string;
    swap_rate?: string;
    avg_entry_swap_rate?: string;
    qty_available?: string;
  }

  export interface Order {
    id: string;
    client_order_id: string;
    created_at: string;
    updated_at: string;
    submitted_at: string;
    filled_at: string | null;
    expired_at: string | null;
    canceled_at: string | null;
    failed_at: string | null;
    replaced_at: string | null;
    replaced_by: string | null;
    replaces: string | null;
    asset_id: string;
    symbol: string;
    asset_class: string;
    notional: string | null;
    qty: string;
    filled_qty: string;
    filled_avg_price: string | null;
    order_class: string;
    order_type: string;
    type: string;
    side: "buy" | "sell";
    time_in_force: string;
    limit_price: string | null;
    stop_price: string | null;
    status: string;
    extended_hours: boolean;
    legs: Order[] | null;
    trail_percent: string | null;
    trail_price: string | null;
    hwm: string | null;
  }

  export interface PlaceOrderRequest {
    symbol: string;
    qty?: number;
    notional?: number;
    side: "buy" | "sell";
    type: "market" | "limit" | "stop" | "stop_limit" | "trailing_stop";
    time_in_force: "day" | "gtc" | "opg" | "cls" | "ioc" | "fok";
    limit_price?: number;
    stop_price?: number;
    trail_percent?: number;
    trail_price?: number;
    extended_hours?: boolean;
    client_order_id?: string;
    order_class?: "simple" | "bracket" | "oco" | "oto";
    take_profit?: {
      limit_price: number;
    };
    stop_loss?: {
      stop_price: number;
      limit_price?: number;
    };
  }

  export interface GetBarsRequest {
    timeframe: string;
    start?: string;
    end?: string;
    limit?: number;
    page_token?: string;
    feed?: string;
  }

  export interface GetBarsResponse {
    bars: Bar[];
    next_page_token?: string;
  }

  export class Alpaca {
    constructor(config: AlpacaConfig);

    // Account
    getAccount(): Promise<Account>;

    // Positions
    getPositions(): Promise<Position[]>;
    getPosition(symbol: string): Promise<Position>;

    // Orders
    createOrder(order: PlaceOrderRequest): Promise<Order>;
    getOrders(options?: {
      status?: "open" | "closed" | "all";
      limit?: number;
      after?: string;
      until?: string;
      direction?: "asc" | "desc";
      nested?: boolean;
      symbols?: string;
      side?: "buy" | "sell";
    }): Promise<Order[]>;
    getOrder(orderId: string): Promise<Order>;
    cancelOrder(orderId: string): Promise<void>;
    cancelAllOrders(): Promise<void>;

    // Clock
    getClock(): Promise<Clock>;

    // Market Data
    getLatestQuote(symbol: string): Promise<Quote>;
    getLatestTrade(symbol: string): Promise<any>;
    getBars(symbol: string, options: GetBarsRequest): Promise<{ bars: Bar[]; next_page_token?: string }>;

    // Assets
    getAssets(options?: { status?: "active" | "inactive"; asset_class?: string; exchange?: string }): Promise<any[]>;
    getAsset(symbol: string): Promise<any>;

    // Watchlists
    getWatchlists(): Promise<any[]>;
    getWatchlist(watchlistId: string): Promise<any>;
    addToWatchlist(watchlistId: string, symbol: string): Promise<any>;
    removeFromWatchlist(watchlistId: string, symbol: string): Promise<any>;

    // Calendar
    getCalendar(options?: { start?: string; end?: string }): Promise<any[]>;
  }

  export default Alpaca;
}
