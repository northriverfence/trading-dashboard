/**
 * Test Alpaca API Connection
 *
 * Verifies that your API credentials are working correctly.
 */

import Alpaca from "@alpacahq/alpaca-trade-api";

// Load credentials from environment
const config = {
  keyId: process.env.ALPACA_API_KEY || "",
  secretKey: process.env.ALPACA_SECRET_KEY || "",
  paper: process.env.PAPER_TRADING !== "false",
};

console.log("\n" + "=".repeat(70));
console.log("🔍 Testing Alpaca API Connection");
console.log("=".repeat(70));
console.log(`Paper Trading: ${config.paper ? "✅ YES" : "❌ NO (LIVE)"}`);
console.log(`API Key: ${config.keyId.substring(0, 10)}...`);
console.log("=".repeat(70) + "\n");

// Check credentials exist
if (!config.keyId || !config.secretKey) {
  console.error("❌ ERROR: Missing API credentials!");
  console.error("Make sure your .env file is configured correctly.");
  process.exit(1);
}

// Create Alpaca client
const alpaca = new Alpaca(config);

async function testConnection() {
  try {
    // Test 1: Get account info
    console.log("📊 Testing Account Info...");
    const account = await alpaca.getAccount();
    console.log("✅ Account connected!");
    console.log(`   Account ID: ${account.id}`);
    console.log(`   Status: ${account.status}`);
    console.log(`   Buying Power: $${parseFloat(String(account.buying_power)).toFixed(2)}`);
    console.log(`   Cash: $${parseFloat(String(account.cash)).toFixed(2)}`);
    console.log(`   Portfolio Value: $${parseFloat(String(account.portfolio_value)).toFixed(2)}`);
    console.log(`   Equity: $${parseFloat(String(account.equity)).toFixed(2)}`);
    console.log("");

    // Test 2: Get market clock
    console.log("🕐 Testing Market Clock...");
    const clock = await alpaca.getClock();
    console.log("✅ Clock retrieved!");
    console.log(`   Market Open: ${clock.is_open ? "✅ YES" : "❌ CLOSED"}`);
    console.log(`   Next Open: ${clock.next_open}`);
    console.log(`   Next Close: ${clock.next_close}`);
    console.log("");

    // Test 3: Get positions
    console.log("📈 Testing Positions...");
    const positions = await alpaca.getPositions();
    console.log(`✅ Retrieved ${positions.length} positions`);
    if (positions.length > 0) {
      positions.forEach((pos: any) => {
        console.log(`   ${pos.symbol}: ${pos.qty} shares @ $${pos.avg_entry_price}`);
      });
    }
    console.log("");

    // Test 4: Get stock quote
    console.log("💹 Testing Stock Quote...");
    const quote: any = await alpaca.getLatestQuote("AAPL");
    console.log("✅ Quote retrieved!");
    console.log(`   Quote data:`, Object.keys(quote).join(", "));
    console.log("");

    console.log("=".repeat(70));
    console.log("✅ ALL CORE TESTS PASSED!");
    console.log("=".repeat(70));
    console.log("\nYour Alpaca API connection is working correctly!");
    console.log("You can now run the trading agent:");
    console.log("  bun run src/index.ts");
    console.log("");
  } catch (error: any) {
    console.error("\n❌ CONNECTION ERROR:");
    console.error(error.message || error);
    console.error("\nPlease check:");
    console.error("1. Your API keys are correct");
    console.error("2. Your Alpaca account is active");
    console.error("3. You have internet connectivity");
    process.exit(1);
  }
}

testConnection();
