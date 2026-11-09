// Dev local uniquement. Usage : PRIM_KEY=xxx node server.js → http://localhost:3000
const http = require("http");
const fs = require("fs");
const path = require("path");
const lib = require("./lib/prim");

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const name = u.pathname.replace("/api/", "");
  if (u.pathname.startsWith("/api/") && lib[name]) {
    try {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(await lib[name](Object.fromEntries(u.searchParams))));
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(fs.readFileSync(path.join(__dirname, "index.html")));
}).listen(process.env.PORT || 3000, () => console.log("→ http://localhost:3000"));
