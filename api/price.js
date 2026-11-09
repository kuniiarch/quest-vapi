// GET /api/price?ids=bitcoin,ethereum&vs=usd -> crypto prices (CoinGecko, no key)
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  try {
    const u = new URL(req.url, "http://localhost");
    const ids = u.searchParams.get("ids") || "bitcoin,ethereum";
    const vs = u.searchParams.get("vs") || "usd";
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vs)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!r.ok) throw new Error("CoinGecko HTTP " + r.status);
    const data = await r.json();
    return res.status(200).json({ ids, vs_currencies: vs, prices: data });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
