// Crypto prices API protected by x402 (pay-per-call, USDC on Base).
// Deploy on Vercel: this file is api/index.js, plus package.json and vercel.json
// at the repo root. All /api/* routes are handled by this single Express app
// (vercel.json rewrites /api/:path* to /api/index.js).
//
// Price: $0.01 USDC per call. Payout wallet: the vAPI agent wallet (main).
// Network: Base mainnet (eip155:8453). Asset: USDC on Base (default for exact scheme).
// Without payment the API returns HTTP 402 with an x402 payment challenge.
// With a valid x402 payment it returns the data.
//
// Endpoints:
//   GET /api              -> API info (x402 protected, $0.01)
//   GET /api/price        -> crypto prices via CoinGecko (x402 protected, $0.01)
//   GET /api/time         -> server time (x402 protected, $0.01)
//   GET /api/openapi.json -> OpenAPI spec (FREE, so clients/vAPI can discover the API)

const express = require("express");
const { paymentMiddleware, x402ResourceServer } = require("@x402/express");
const { ExactEvmScheme } = require("@x402/evm/exact/server");
const { HTTPFacilitatorClient } = require("@x402/core/server");

const app = express();
app.use(express.json());

// CORS: expose the x402 payment headers so browser callers can read them.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-PAYMENT, X-PAYMENT-RESPONSE");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-REQUIRED, X-PAYMENT-RESPONSE"
  );
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

const PAY_TO = "0x4f94f74dc606a30547a3ceeda2fe4c8304c17fcf"; // owner wallet (connected in browser) — user can sign for it with MetaMask; agent wallet 0x52F7… cannot sign in a browser
const NETWORK = "eip155:8453"; // Base mainnet
const PRICE = "$0.01";

const facilitatorClient = new HTTPFacilitatorClient({ url: "https://facilitator-xpay.llc" });
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  NETWORK,
  new ExactEvmScheme()
);

// x402 protection for the data routes. Unpaid calls get HTTP 402 + payment challenge.
// NOTE: vAPI's "Check endpoint" probes with POST, not only GET — so both
// GET and POST must be protected, otherwise POST falls through to Express 404.
app.use(
  paymentMiddleware(
    {
      "GET /api": {
        accepts: [{ scheme: "exact", price: PRICE, network: NETWORK, payTo: PAY_TO }],
        description: "Crypto prices API info",
      },
      "POST /api": {
        accepts: [{ scheme: "exact", price: PRICE, network: NETWORK, payTo: PAY_TO }],
        description: "Crypto prices API info",
      },
      "GET /api/price": {
        accepts: [{ scheme: "exact", price: PRICE, network: NETWORK, payTo: PAY_TO }],
        description: "Live crypto prices (BTC, ETH, SOL and more) via CoinGecko",
      },
      "POST /api/price": {
        accepts: [{ scheme: "exact", price: PRICE, network: NETWORK, payTo: PAY_TO }],
        description: "Live crypto prices (BTC, ETH, SOL and more) via CoinGecko",
      },
      "GET /api/time": {
        accepts: [{ scheme: "exact", price: PRICE, network: NETWORK, payTo: PAY_TO }],
        description: "Server time (UTC + unix timestamp)",
      },
      "POST /api/time": {
        accepts: [{ scheme: "exact", price: PRICE, network: NETWORK, payTo: PAY_TO }],
        description: "Server time (UTC + unix timestamp)",
      },
    },
    resourceServer
  )
);

// Free OpenAPI spec (not protected) so vAPI and clients can discover the API.
app.get("/api/openapi.json", (req, res) => {
  res.json({
    openapi: "3.0.0",
    info: {
      title: "crypto-prices",
      version: "1.0.0",
      description: "Simple crypto prices API (BTC, ETH, SOL and more) via CoinGecko. Pay-per-call with x402 ($0.01 USDC on Base).",
    },
    servers: [{ url: "https://quest-vapi-uwzi.vercel.app" }],
    paths: {
      "/api": {
        get: {
          summary: "API info",
          responses: { 200: { description: "API info" }, 402: { description: "Payment required (x402)" } },
        },
      },
      "/api/price": {
        get: {
          summary: "Crypto prices",
          parameters: [
            { name: "ids", in: "query", description: "Comma-separated CoinGecko ids, e.g. bitcoin,ethereum", schema: { type: "string", default: "bitcoin,ethereum" } },
            { name: "vs", in: "query", description: "vs currency, e.g. usd", schema: { type: "string", default: "usd" } },
          ],
          responses: { 200: { description: "Prices" }, 402: { description: "Payment required (x402)" } },
        },
      },
      "/api/time": {
        get: {
          summary: "Server time",
          responses: { 200: { description: "Server time" }, 402: { description: "Payment required (x402)" } },
        },
      },
    },
  });
});

app.get("/api", (req, res) => {
  res.json({
    name: "crypto-prices",
    description: "Simple crypto prices API (BTC, ETH, SOL and more) via CoinGecko. Pay-per-call with x402 ($0.01 USDC on Base).",
    endpoints: ["/api/price?ids=bitcoin,ethereum&vs=usd", "/api/time"],
    example: "/api/price?ids=bitcoin,ethereum&vs=usd",
    openapi: "/api/openapi.json",
    price: "$0.01 USDC per call",
    network: "Base (eip155:8453)",
  });
});

app.get("/api/price", async (req, res) => {
  try {
    const ids = req.query.ids || "bitcoin,ethereum";
    const vs = req.query.vs || "usd";
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vs)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!r.ok) throw new Error("CoinGecko HTTP " + r.status);
    const data = await r.json();
    res.json({ ids, vs_currencies: vs, prices: data });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});

app.get("/api/time", (req, res) => {
  const now = new Date();
  res.json({ utc: now.toISOString(), unix: Math.floor(now.getTime() / 1000) });
});

// POST handlers (same data as GET) — vAPI probes with POST, and a paid POST
// must return data, not 404. Query params may also arrive in the JSON body.
app.post("/api", (req, res) => {
  res.json({
    name: "crypto-prices",
    description: "Simple crypto prices API (BTC, ETH, SOL and more) via CoinGecko. Pay-per-call with x402 ($0.01 USDC on Base).",
    endpoints: ["/api/price?ids=bitcoin,ethereum&vs=usd", "/api/time"],
    example: "/api/price?ids=bitcoin,ethereum&vs=usd",
    openapi: "/api/openapi.json",
    price: "$0.01 USDC per call",
    network: "Base (eip155:8453)",
  });
});

app.post("/api/price", async (req, res) => {
  try {
    const body = req.body || {};
    const ids = req.query.ids || body.ids || "bitcoin,ethereum";
    const vs = req.query.vs || body.vs || "usd";
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vs)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!r.ok) throw new Error("CoinGecko HTTP " + r.status);
    const data = await r.json();
    res.json({ ids, vs_currencies: vs, prices: data });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});

app.post("/api/time", (req, res) => {
  const now = new Date();
  res.json({ utc: now.toISOString(), unix: Math.floor(now.getTime() / 1000) });
});

// Vercel serverless: export the Express app.
module.exports = app;

// Local dev: node api/index.js
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`crypto-prices API (x402) listening on http://localhost:${port}`));
}
