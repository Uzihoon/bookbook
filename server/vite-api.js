// Adapt Node HTTP to the same Request/Response handlers used by Vercel.
export function apiMiddleware(routes) {
  return async (req, res, next) => {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    if (!routes[pathname]) return next();
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 4096) {
          res.writeHead(413, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
          res.end(
            JSON.stringify({ error: { message: "The form is too large." } }),
          );
          return;
        }
        chunks.push(chunk);
      }
      const method = req.method || "GET";
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const request = new Request(url, {
        method,
        headers: req.headers,
        ...(!["GET", "HEAD"].includes(method)
          ? { body: Buffer.concat(chunks) }
          : {}),
      });
      const response = await routes[pathname](request);
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(await response.text());
    } catch {
      res.writeHead(503, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          error: { message: "The service is unavailable. Please try again." },
        }),
      );
    }
  };
}
