import type { Order, OrderStatus } from "./types.js";

export class OrderManager {
    private orders: Map<string, Order> = new Map();

    addOrder(order: Order): void {
        this.orders.set(order.id, order);
    }

    getOrder(id: string): Order | null {
        return this.orders.get(id) ?? null;
    }

    getAllOrders(): Order[] {
        return Array.from(this.orders.values());
    }

    getOrdersBySymbol(symbol: string): Order[] {
        return this.getAllOrders().filter((o) => o.symbol === symbol);
    }

    getOpenOrders(): Order[] {
        return this.getAllOrders().filter(
            (o) => o.status === "pending" || o.status === "partially_filled"
        );
    }

    updateOrderStatus(
        id: string,
        status: OrderStatus,
        updates?: { filledQty?: number; avgPrice?: number }
    ): void {
        const order = this.orders.get(id);
        if (!order) return;

        order.status = status;
        order.updatedAt = new Date();

        if (updates?.filledQty !== undefined) {
            order.filledQty = updates.filledQty;
        }
        if (updates?.avgPrice !== undefined) {
            order.avgPrice = updates.avgPrice;
        }

        this.orders.set(id, order);
    }

    cancelOrder(id: string): boolean {
        const order = this.orders.get(id);
        if (!order || order.status !== "pending") return false;

        order.status = "canceled";
        order.updatedAt = new Date();
        this.orders.set(id, order);
        return true;
    }

    clear(): void {
        this.orders.clear();
    }
}
