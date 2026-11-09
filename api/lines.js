const { lines } = require("../lib/prim");

module.exports = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "s-maxage=86400");
    res.status(200).json(await lines(req.query));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
