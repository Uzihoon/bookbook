// Development-only adapter: run the same serverless handler with `npm run dev`.
export function bookSearchMiddleware(handler) {
  return async (req, res, next) => {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname !== "/api/books") return next();
    try {
      const response = await handler(new Request(url, { method: req.method }));
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(await response.text());
    } catch {
      res.writeHead(500, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          error: {
            code: "SEARCH_UNAVAILABLE",
            message: "Book search is unavailable. Please try again.",
          },
        }),
      );
    }
  };
}
