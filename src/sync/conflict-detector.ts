// src/sync/conflict-detector.ts
import type { TradeRecord } from "./types.js";

export interface ConflictResult {
  hasConflict: boolean;
  winner?: "local" | "remote";
  reason?: string;
  merged?: TradeRecord;
}

export class ConflictDetector {
  detectConflict(local: TradeRecord, remote: TradeRecord): ConflictResult {
    // Check if records are identical
    if (this.areEqual(local, remote)) {
      return { hasConflict: false };
    }

    // Timestamp-based resolution (last write wins)
    if (local.timestamp !== remote.timestamp) {
      const winner = local.timestamp > remote.timestamp ? "local" : "remote";
      return {
        hasConflict: true,
        winner,
        reason: `timestamp_priority_${winner}`,
        merged: winner === "local" ? local : remote,
      };
    }

    // If timestamps equal, prefer record with more fields populated
    const localFields = Object.values(local).filter((v) => v !== undefined).length;
    const remoteFields = Object.values(remote).filter((v) => v !== undefined).length;
    const winner = localFields >= remoteFields ? "local" : "remote";

    return {
      hasConflict: true,
      winner,
      reason: "completeness_priority",
      merged: winner === "local" ? local : remote,
    };
  }

  private areEqual(a: TradeRecord, b: TradeRecord): boolean {
    return (
      a.id === b.id &&
      a.symbol === b.symbol &&
      a.side === b.side &&
      a.entryPrice === b.entryPrice &&
      a.exitPrice === b.exitPrice &&
      a.shares === b.shares &&
      a.pnl === b.pnl &&
      a.outcome === b.outcome
    );
  }

  reconcileBatch(local: TradeRecord[], remote: TradeRecord[]): {
    merged: TradeRecord[];
    conflicts: Array<{ local: TradeRecord; remote: TradeRecord; winner: string }>;
  } {
    const merged: TradeRecord[] = [];
    const conflicts: Array<{ local: TradeRecord; remote: TradeRecord; winner: string }> = [];

    const localMap = new Map(local.map((t) => [t.id, t]));
    const remoteMap = new Map(remote.map((t) => [t.id, t]));
    const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

    for (const id of allIds) {
      const l = localMap.get(id);
      const r = remoteMap.get(id);

      if (!l) {
        merged.push(r!);
      } else if (!r) {
        merged.push(l);
      } else {
        const result = this.detectConflict(l, r);
        merged.push(result.merged!);
        if (result.hasConflict) {
          conflicts.push({ local: l, remote: r, winner: result.winner! });
        }
      }
    }

    return { merged, conflicts };
  }
}
