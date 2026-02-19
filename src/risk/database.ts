/**
 * Risk Database Client
 * PostgreSQL persistence for risk management
 */

import { Pool, type PoolConfig } from "pg";
import type { RiskConfig, RiskCheck, CircuitBreakerResult } from "./types.js";

export interface DatabaseConfig extends PoolConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export class RiskDatabase {
  private pool: Pool;
  isConnected: boolean = false;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool(config);
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    await this.pool.query("SELECT 1");
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    this.isConnected = false;
  }

  async saveRiskConfig(name: string, config: RiskConfig): Promise<void> {
    await this.pool.query(
      `INSERT INTO risk_configs (name, config, is_active)
       VALUES ($1, $2, true)
       ON CONFLICT (name) DO UPDATE
       SET config = $2, updated_at = CURRENT_TIMESTAMP`,
      [name, JSON.stringify(config)],
    );
  }

  async getRiskConfig(name: string): Promise<RiskConfig | null> {
    const result = await this.pool.query("SELECT config FROM risk_configs WHERE name = $1", [name]);
    return result.rows[0]?.config ?? null;
  }

  async logRiskCheck(check: RiskCheck): Promise<void> {
    await this.pool.query(
      `INSERT INTO risk_checks (id, timestamp, check_type, symbol, passed, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [check.id, check.timestamp, check.type, check.symbol, check.passed, JSON.stringify(check.details)],
    );
  }

  async recordCircuitBreakerEvent(type: string, reason: string, result: CircuitBreakerResult): Promise<void> {
    await this.pool.query(
      `INSERT INTO circuit_breaker_events
       (breaker_type, reason, resume_time, metadata)
       VALUES ($1, $2, $3, $4)`,
      [type, reason, result.resumeTime ?? null, JSON.stringify(result)],
    );
  }

  async isCircuitBreakerActive(): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT COUNT(*) as count
       FROM circuit_breaker_events
       WHERE is_resolved = false
       AND (resume_time IS NULL OR resume_time > CURRENT_TIMESTAMP)`,
    );
    return parseInt(result.rows[0].count) > 0;
  }
}
