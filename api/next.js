const { next } = require("../lib/prim");

module.exports = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "s-maxage=10");
    res.status(200).json(await next(req.query));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
