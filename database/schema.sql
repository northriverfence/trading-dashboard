-- Historical Market Data Schema
-- PostgreSQL database for storing bars, trades, and quotes

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schema
CREATE SCHEMA IF NOT EXISTS market_data;

-- Symbols table
CREATE TABLE market_data.symbols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255),
    exchange VARCHAR(50),
    asset_class VARCHAR(20) DEFAULT 'us_equity',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Historical bars table (OHLCV)
CREATE TABLE market_data.bars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol_id UUID NOT NULL REFERENCES market_data.symbols(id),
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    timeframe VARCHAR(10) NOT NULL, -- '1m', '5m', '1h', '1d', etc.
    open DECIMAL(18, 8) NOT NULL,
    high DECIMAL(18, 8) NOT NULL,
    low DECIMAL(18, 8) NOT NULL,
    close DECIMAL(18, 8) NOT NULL,
    volume BIGINT NOT NULL,
    vwap DECIMAL(18, 8),
    trades_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(symbol, timestamp, timeframe)
);

-- Trades table (time and sales)
CREATE TABLE market_data.trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol_id UUID NOT NULL REFERENCES market_data.symbols(id),
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    price DECIMAL(18, 8) NOT NULL,
    size INTEGER NOT NULL,
    side VARCHAR(4), -- 'buy', 'sell', or NULL if unknown
    exchange VARCHAR(20),
    trade_id VARCHAR(100), -- Exchange-specific trade ID
    conditions TEXT[], -- Array of trade conditions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Quotes table (bid/ask)
CREATE TABLE market_data.quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol_id UUID NOT NULL REFERENCES market_data.symbols(id),
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    bid DECIMAL(18, 8) NOT NULL,
    ask DECIMAL(18, 8) NOT NULL,
    bid_size INTEGER NOT NULL,
    ask_size INTEGER NOT NULL,
    exchange VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX idx_bars_symbol_timestamp ON market_data.bars(symbol, timestamp DESC);
CREATE INDEX idx_bars_symbol_timeframe ON market_data.bars(symbol, timeframe, timestamp DESC);
CREATE INDEX idx_bars_timestamp ON market_data.bars(timestamp DESC);

CREATE INDEX idx_trades_symbol_timestamp ON market_data.trades(symbol, timestamp DESC);
CREATE INDEX idx_trades_timestamp ON market_data.trades(timestamp DESC);

CREATE INDEX idx_quotes_symbol_timestamp ON market_data.quotes(symbol, timestamp DESC);
CREATE INDEX idx_quotes_timestamp ON market_data.quotes(timestamp DESC);

-- Partitioning for large tables (optional, for production)
-- Partition bars by month for faster queries
CREATE TABLE market_data.bars_2024_01 PARTITION OF market_data.bars
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Create more partitions as needed
-- CREATE TABLE market_data.bars_2024_02 PARTITION OF market_data.bars
--     FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Functions
CREATE OR REPLACE FUNCTION market_data.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_symbols_updated_at
    BEFORE UPDATE ON market_data.symbols
    FOR EACH ROW
    EXECUTE FUNCTION market_data.update_updated_at();

-- Views for common queries
CREATE VIEW market_data.daily_bars AS
SELECT
    symbol,
    date_trunc('day', timestamp) as date,
    first_value(open) OVER (PARTITION BY symbol, date_trunc('day', timestamp) ORDER BY timestamp) as open,
    max(high) OVER (PARTITION BY symbol, date_trunc('day', timestamp)) as high,
    min(low) OVER (PARTITION BY symbol, date_trunc('day', timestamp)) as low,
    last_value(close) OVER (PARTITION BY symbol, date_trunc('day', timestamp) ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as close,
    sum(volume) OVER (PARTITION BY symbol, date_trunc('day', timestamp)) as volume
FROM market_data.bars
WHERE timeframe = '1m';

-- Insert sample symbols
INSERT INTO market_data.symbols (symbol, name, exchange, asset_class) VALUES
    ('AAPL', 'Apple Inc.', 'NASDAQ', 'us_equity'),
    ('GOOGL', 'Alphabet Inc.', 'NASDAQ', 'us_equity'),
    ('MSFT', 'Microsoft Corporation', 'NASDAQ', 'us_equity'),
    ('AMZN', 'Amazon.com Inc.', 'NASDAQ', 'us_equity'),
    ('TSLA', 'Tesla Inc.', 'NASDAQ', 'us_equity'),
    ('SPY', 'SPDR S&P 500 ETF', 'NYSE', 'etf'),
    ('QQQ', 'Invesco QQQ Trust', 'NASDAQ', 'etf')
ON CONFLICT (symbol) DO NOTHING;
