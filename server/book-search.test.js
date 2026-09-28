import test from "node:test";
import assert from "node:assert/strict";
import { createBookSearchHandler } from "./book-search.js";
const fixture = {
  meta: { total_count: 1, is_end: true },
  documents: [
    {
      title: "채식주의자",
      authors: ["한강"],
      translators: [],
      publisher: "창비",
      isbn: "8936433598 9788936433598",
      datetime: "2007-10-30T00:00:00.000+09:00",
      contents: "한국 소설",
      thumbnail: "https://search1.kakaocdn.net/cover.jpg",
      url: "https://search.daum.net/book/1",
    },
  ],
};
const request = (query = "query=한강") =>
  new Request("http://localhost/api/books?" + query);
const make = (fetchImpl = async () => Response.json(fixture), extra = {}) =>
  createBookSearchHandler({
    getApiKey: () => "test-secret-do-not-expose",
    fetchImpl,
    ...extra,
  });
test("validates input and methods before contacting Kakao", async () => {
  let calls = 0;
  const run = make(async () => {
    calls++;
    return Response.json(fixture);
  });
  for (const query of [
    "",
    "query=   ",
    "query=a&page=0",
    "query=a&page=51",
    "query=a&page=1.5",
    "query=a&target=bad",
    "query=a&query=b",
    "query=" + "가".repeat(201),
  ])
    assert.equal((await run(request(query))).status, 400);
  const response = await run(
    new Request("http://localhost/api/books?query=a", { method: "POST" }),
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET");
  assert.equal(calls, 0);
});
test("keeps credentials in the upstream header and normalizes Korean book metadata", async () => {
  let outgoing;
  const run = make(async (url, options) => {
    outgoing = { url: new URL(url), options };
    return Response.json(fixture);
  });
  const response = await run(
    request("query=%ED%95%9C%EA%B0%95&target=person&page=2"),
  );
  assert.equal(response.status, 200);
  assert.equal(outgoing.url.origin, "https://dapi.kakao.com");
  assert.equal(outgoing.url.searchParams.get("query"), "한강");
  assert.equal(outgoing.url.searchParams.get("target"), "person");
  assert.equal(outgoing.url.searchParams.get("page"), "2");
  assert.equal(
    outgoing.options.headers.Authorization,
    "KakaoAK test-secret-do-not-expose",
  );
  assert.ok(outgoing.options.signal);
  const text = await response.text();
  assert.ok(!text.includes("test-secret"));
  const result = JSON.parse(text);
  assert.equal(result.books[0].title, "채식주의자");
  assert.equal(result.books[0].author, "한강");
  assert.equal(result.books[0].isbn13, "9788936433598");
  assert.equal(result.books[0].isbn10, "8936433598");
  assert.equal(result.books[0].catalogId, "kakao:9788936433598");
  assert.equal(result.books[0].publishedDate, "2007-10-30");
  assert.equal(result.hasMore, false);
  assert.equal(result.page, 2);
});
test("returns useful configuration error without making a request", async () => {
  const response = await make(() => assert.fail("must not fetch"), {
    getApiKey: () => "",
  })(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "SEARCH_NOT_CONFIGURED");
});
test("detects ISBN search and bounds the final page", async () => {
  let outgoing;
  const run = make(async (url) => {
    outgoing = new URL(url);
    return Response.json({
      ...fixture,
      meta: { total_count: 999, is_end: false },
    });
  });
  const response = await run(request("query=978-89-364-3359-8&page=50"));
  assert.equal(outgoing.searchParams.get("target"), "isbn");
  assert.equal(outgoing.searchParams.get("query"), "9788936433598");
  assert.equal((await response.json()).hasMore, false);
});
test("maps provider failures without exposing the response or key", async () => {
  for (const [upstream, status, code] of [
    [401, 503, "SEARCH_UNAVAILABLE"],
    [403, 503, "SEARCH_UNAVAILABLE"],
    [429, 429, "SEARCH_RATE_LIMITED"],
    [500, 502, "SEARCH_UNAVAILABLE"],
  ]) {
    const response = await make(
      async () =>
        new Response("test-secret-do-not-expose", { status: upstream }),
    )(request());
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.error.code, code);
    assert.ok(!JSON.stringify(body).includes("test-secret"));
  }
});
test("handles malformed and incomplete provider results", async () => {
  for (const bad of [
    {},
    { meta: {}, documents: [] },
    { meta: { is_end: false, total_count: 1 }, documents: "bad" },
  ])
    assert.equal(
      (await make(async () => Response.json(bad))(request())).status,
      502,
    );
  const response = await make(async () =>
    Response.json({ meta: { is_end: true, total_count: 0 }, documents: [] }),
  )(request());
  assert.deepEqual((await response.json()).books, []);
});
test("times out stalled provider requests and returns a recoverable error", async () => {
  const run = make(
    (_url, { signal }) =>
      new Promise((resolve, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        }),
      ),
    { timeoutMs: 10 },
  );
  const response = await run(request());
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, "SEARCH_TIMEOUT");
});
test("filters missing titles, deduplicates editions and rejects unsafe image/source URLs", async () => {
  const a = {
    ...fixture.documents[0],
    thumbnail: "javascript:alert(1)",
    url: "data:text/html,bad",
  };
  const response = await make(async () =>
    Response.json({ ...fixture, documents: [a, a, { title: "" }] }),
  )(request());
  const { books } = await response.json();
  assert.equal(books.length, 1);
  assert.equal(books[0].coverUrl, null);
  assert.equal(books[0].sourceUrl, null);
});
