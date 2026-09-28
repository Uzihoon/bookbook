const KAKAO_URL = "https://dapi.kakao.com/v3/search/book";
const PAGE_SIZE = 12;
const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const error = (status, code, message, headers = {}) =>
  Response.json(
    { error: { code, message } },
    { status, headers: { ...HEADERS, ...headers } },
  );
const text = (value) => (typeof value === "string" ? value.trim() : "");
const strings = (value) =>
  Array.isArray(value)
    ? value
        .filter((v) => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];
function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function normalizeBook(book) {
  if (!book || typeof book !== "object" || !text(book.title)) return null;
  const isbns = text(book.isbn).split(/\s+/);
  const isbn13 = isbns.find((v) => /^\d{13}$/.test(v)) || null;
  const isbn10 =
    isbns.find((v) => /^\d{9}[\dXx]$/.test(v))?.toUpperCase() || null;
  const authors = strings(book.authors);
  const sourceUrl = safeUrl(book.url);
  return {
    catalogId: `kakao:${isbn13 || isbn10 || sourceUrl || JSON.stringify([text(book.title), authors, text(book.publisher)])}`,
    title: text(book.title),
    author: authors.join(", "),
    authors,
    translators: strings(book.translators),
    publisher: text(book.publisher),
    publishedDate: /^\d{4}-\d{2}-\d{2}/.test(text(book.datetime))
      ? book.datetime.slice(0, 10)
      : null,
    isbn13,
    isbn10,
    description: text(book.contents),
    coverUrl: safeUrl(book.thumbnail),
    sourceUrl,
    source: "kakao",
  };
}
export function createBookSearchHandler({
  getApiKey = () => process.env.KAKAO_REST_API_KEY,
  fetchImpl = (...args) => fetch(...args),
  timeoutMs = 7000,
} = {}) {
  return async function searchBooks(request) {
    if (request.method !== "GET")
      return error(405, "METHOD_NOT_ALLOWED", "Use GET to search books.", {
        Allow: "GET",
      });
    const params = new URL(request.url).searchParams;
    for (const name of ["query", "page", "target"])
      if (params.getAll(name).length > 1)
        return error(
          400,
          "INVALID_QUERY",
          "Provide each search parameter only once.",
        );
    let query = (params.get("query") || "").trim();
    const pageText = params.get("page") ?? "1";
    const page = Number(pageText);
    let target = params.get("target") || "all";
    if (
      !query ||
      [...query].length > 200 ||
      /[\u0000-\u001f\u007f]/.test(query)
    )
      return error(
        400,
        "INVALID_QUERY",
        "Enter a search of 1 to 200 characters.",
      );
    if (!/^\d+$/.test(pageText) || page < 1 || page > 50)
      return error(
        400,
        "INVALID_PAGE",
        "Page must be a whole number between 1 and 50.",
      );
    if (!["all", "title", "person", "isbn"].includes(target))
      return error(
        400,
        "INVALID_TARGET",
        "Choose title, author, or ISBN search.",
      );
    const isbnQuery = query.replace(/[-\s]/g, "");
    if (
      target === "isbn" ||
      (target === "all" && /^(\d{13}|\d{9}[\dXx])$/.test(isbnQuery))
    ) {
      if (!/^(\d{13}|\d{9}[\dXx])$/.test(isbnQuery))
        return error(400, "INVALID_ISBN", "Enter a 10 or 13 character ISBN.");
      query = isbnQuery.toUpperCase();
      target = "isbn";
    }
    const key = text(getApiKey());
    if (!key)
      return error(
        503,
        "SEARCH_NOT_CONFIGURED",
        "Book search isn’t ready yet. You can still add a book manually.",
      );
    const url = new URL(KAKAO_URL);
    url.search = new URLSearchParams({
      query,
      page: String(page),
      size: String(PAGE_SIZE),
      sort: "accuracy",
      ...(target === "all" ? {} : { target }),
    }).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        headers: {
          Authorization: `KakaoAK ${key}`,
          Accept: "application/json",
        },
        signal: controller.signal,
        redirect: "error",
      });
      if (response.status === 429)
        return error(
          429,
          "SEARCH_RATE_LIMITED",
          "Book search has reached its request limit. Please try again later.",
          { "Retry-After": "60" },
        );
      if (response.status === 401 || response.status === 403)
        return error(
          503,
          "SEARCH_UNAVAILABLE",
          "Book search is temporarily unavailable. You can still add a book manually.",
        );
      if (!response.ok)
        return error(
          502,
          "SEARCH_UNAVAILABLE",
          "The book service is unavailable. Please try again.",
        );
      const body = await response.json();
      if (
        !Array.isArray(body?.documents) ||
        typeof body?.meta?.is_end !== "boolean" ||
        !Number.isFinite(body?.meta?.total_count)
      )
        return error(
          502,
          "SEARCH_UNAVAILABLE",
          "The book service returned an unexpected response. Please try again.",
        );
      const books = [
        ...new Map(
          body.documents
            .map(normalizeBook)
            .filter(Boolean)
            .map((b) => [b.catalogId, b]),
        ).values(),
      ];
      return Response.json(
        {
          books,
          page,
          hasMore: !body.meta.is_end && page < 50,
          total: body.meta.total_count,
        },
        { headers: HEADERS },
      );
    } catch {
      if (controller.signal.aborted)
        return error(
          504,
          "SEARCH_TIMEOUT",
          "Book search took too long. Please try again.",
        );
      return error(
        502,
        "SEARCH_UNAVAILABLE",
        "The book service is unavailable. Please try again.",
      );
    } finally {
      clearTimeout(timer);
    }
  };
}
