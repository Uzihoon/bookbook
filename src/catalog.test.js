import test from "node:test";
import assert from "node:assert/strict";
import { createOwnedCopy, coverSource } from "./catalog.js";
test("two copies of the same edition have independent IDs and keep provider metadata", () => {
  const catalog = {
    catalogId: "kakao:9788936433598",
    title: "채식주의자",
    author: "한강",
    authors: ["한강"],
    isbn13: "9788936433598",
    publisher: "창비",
    coverUrl: "https://search1.kakaocdn.net/cover.jpg",
    source: "kakao",
    owner: "not the owner",
  };
  const details = {
    title: "채식주의자",
    author: "한강",
    genre: "Fiction",
    note: "My copy",
    available: true,
    color: "#713c4b",
  };
  const a = createOwnedCopy(details, catalog),
    b = createOwnedCopy(details, catalog);
  assert.notEqual(a.id, b.id);
  assert.equal(a.owner, "You");
  assert.equal(a.isbn13, "9788936433598");
  assert.equal(a.status, "available");
  assert.equal(a.catalogId, b.catalogId);
  assert.equal(a.coverUrl, catalog.coverUrl);
});
test("manual books have no catalog identity and can be unavailable", () => {
  const b = createOwnedCopy({
    title: " A book ",
    author: " Someone ",
    available: false,
  });
  assert.equal(b.title, "A book");
  assert.equal(b.author, "Someone");
  assert.equal(b.status, "unlisted");
  assert.equal(b.catalogId, null);
  assert.throws(() => createOwnedCopy({ title: " ", author: "a" }));
});
test("covers accept bundled files and HTTPS images, with a safe fallback", () => {
  assert.equal(coverSource({ cover: "midnight" }), "/covers/midnight.jpg");
  assert.equal(
    coverSource({ coverUrl: "https://example.com/cover.jpg" }),
    "https://example.com/cover.jpg",
  );
  assert.equal(coverSource({ coverUrl: "javascript:alert(1)" }), null);
  assert.equal(coverSource({ cover: "../bad" }), null);
});

test("large Kakao covers use the HTTPS original while ordinary covers retain the thumbnail", () => {
  const original =
    "http://t1.daumcdn.net/lbook/image/532683?timestamp=20260930111213";
  const thumbnail =
    "https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=" +
    encodeURIComponent(original);
  const book = { coverUrl: thumbnail };
  assert.equal(
    coverSource(book, { large: true }),
    "https://t1.daumcdn.net/lbook/image/532683?timestamp=20260930111213",
  );
  assert.equal(coverSource(book), thumbnail);
  assert.equal(book.coverUrl, thumbnail);
});
test("large cover upgrades only recognized Kakao book image URLs", () => {
  for (const source of [
    "https://evil.example/lbook/image/123",
    "https://t1.daumcdn.net.evil.example/lbook/image/123",
    "https://user:password@t1.daumcdn.net/lbook/image/123",
    "javascript:alert(1)",
    "https://t1.daumcdn.net/other/123",
  ]) {
    const coverUrl =
      "https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=" +
      encodeURIComponent(source);
    assert.equal(coverSource({ coverUrl }, { large: true }), coverUrl);
  }
  for (const coverUrl of [
    "https://example.com/cover.jpg",
    "https://search1.kakaocdn.net/cover.jpg",
    "https://search1.kakaocdn.net.evil.example/thumb/R120x174.q85/?fname=http://t1.daumcdn.net/lbook/image/123",
  ]) {
    assert.equal(coverSource({ coverUrl }, { large: true }), coverUrl);
  }
  assert.equal(
    coverSource({ cover: "midnight" }, { large: true }),
    "/covers/midnight.jpg",
  );
  assert.equal(coverSource({}, { large: true }), null);
});
