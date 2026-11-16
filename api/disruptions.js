const { disruptions } = require("../lib/prim");

module.exports = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "s-maxage=60");
    res.status(200).json(await disruptions(req.query));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
