-- Risk Configuration Table
CREATE TABLE IF NOT EXISTS risk_configs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk Checks Audit Log
CREATE TABLE IF NOT EXISTS risk_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    check_type VARCHAR(50) NOT NULL,
    symbol VARCHAR(20),
    passed BOOLEAN NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Circuit Breaker Events
CREATE TABLE IF NOT EXISTS circuit_breaker_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    breaker_type VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    resume_time TIMESTAMP,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    metadata JSONB
);

-- Portfolio Snapshots
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_value DECIMAL(15, 2),
    cash_balance DECIMAL(15, 2),
    daily_pnl DECIMAL(15, 2),
    total_pnl DECIMAL(15, 2),
    positions JSONB,
    risk_metrics JSONB
);

-- Stop Orders Tracking
CREATE TABLE IF NOT EXISTS stop_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL,
    stop_type VARCHAR(50) NOT NULL,
    stop_price DECIMAL(12, 4) NOT NULL,
    activation_price DECIMAL(12, 4),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    triggered_at TIMESTAMP,
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_risk_checks_timestamp ON risk_checks(timestamp);
CREATE INDEX IF NOT EXISTS idx_risk_checks_symbol ON risk_checks(symbol);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_triggered ON circuit_breaker_events(triggered_at);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_timestamp ON portfolio_snapshots(timestamp);
CREATE INDEX IF NOT EXISTS idx_stop_orders_symbol ON stop_orders(symbol);
