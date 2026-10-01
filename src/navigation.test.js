import test from "node:test";
import assert from "node:assert/strict";
import { pageForPath, pathForPage } from "./navigation.js";
test("each main view has a stable URL that restores the same view", () => {
  for (const [page, path] of [
    ["shelf", "/"],
    ["picks", "/monthly-picks"],
    ["loans", "/borrowing"],
  ]) {
    assert.equal(pathForPage(page), path);
    assert.equal(pageForPath(path), page);
    assert.equal(pageForPath(path === "/" ? "/" : path + "/"), page);
  }
});
test("unknown paths fall back to the bookshelf", () => {
  assert.equal(pageForPath("/unknown"), "shelf");
  assert.equal(pathForPage("unknown"), "/");
});
