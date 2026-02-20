// src/trading/types.ts

export type OrderSide = "buy" | "sell";

export type OrderType = "market" | "limit" | "stop" | "stop_limit";

export type OrderStatus = "pending" | "filled" | "partially_filled" | "canceled" | "rejected";

export type TimeInForce = "day" | "gtc" | "ioc" | "fok";

export interface Order {
    id: string;
    symbol: string;
    side: OrderSide;
    qty: number;
    type: OrderType;
    limitPrice?: number;
    stopPrice?: number;
    timeInForce: TimeInForce;
    status: OrderStatus;
    filledQty?: number;
    avgPrice?: number;
    createdAt: Date;
    updatedAt?: Date;
}

export interface Position {
    symbol: string;
    side: "long" | "short";
    qty: number;
    avgEntryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    realizedPnl: number;
    openedAt: Date;
}

export interface Portfolio {
    cash: number;
    equity: number;
    buyingPower: number;
    positions: Position[];
    dailyPnl: number;
    totalPnl: number;
}

export interface Quote {
    symbol: string;
    bid: number;
    ask: number;
    lastPrice: number;
    lastSize?: number;
    volume: number;
    timestamp: Date;
}

export interface Trade {
    id: string;
    orderId: string;
    symbol: string;
    side: OrderSide;
    qty: number;
    price: number;
    timestamp: Date;
}
