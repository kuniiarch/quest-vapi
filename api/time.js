// GET /api/time -> server time (JSON)
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  const now = new Date();
  return res.status(200).json({ utc: now.toISOString(), unix: Math.floor(now.getTime() / 1000) });
};
