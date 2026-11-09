// GET /api -> API info (JSON)
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json({
    name: "crypto-prices",
    description: "Simple crypto prices API (BTC, ETH, SOL and more) via CoinGecko.",
    endpoints: ["/api/price?ids=bitcoin,ethereum&vs=usd", "/api/time"],
    example: "/api/price?ids=bitcoin,ethereum&vs=usd",
  });
};
