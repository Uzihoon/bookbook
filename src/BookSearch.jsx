import React, { useEffect, useState } from "react";
import {
  Search,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { coverSource } from "./catalog.js";
export function CatalogCover({ book }) {
  const [failed, setFailed] = useState(false);
  const src = coverSource(book);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? (
    <img
      className="catalog-cover"
      src={src}
      alt=""
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
    />
  ) : (
    <span className="catalog-cover missing-cover">
      <BookOpen size={22} />
    </span>
  );
}
export default function BookSearch({ onSelect }) {
  const [query, setQuery] = useState(""),
    [target, setTarget] = useState("all"),
    [page, setPage] = useState(1),
    [composing, setComposing] = useState(false),
    [retry, setRetry] = useState(0);
  const [result, setResult] = useState({
    phase: "idle",
    books: [],
    hasMore: false,
    total: 0,
    error: "",
  });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    if (!query.trim() || composing) {
      setResult({
        phase: "idle",
        books: [],
        hasMore: false,
        total: 0,
        error: "",
      });
      return () => controller.abort();
    }
    setResult({
      phase: "loading",
      books: [],
      hasMore: false,
      total: 0,
      error: "",
    });
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          query: query.trim(),
          target,
          page: String(page),
        });
        const response = await fetch(`/api/books?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.status === 401)
          window.dispatchEvent(new Event("bookbook:session-expired"));
        if (!response.ok)
          throw new Error(
            data.error?.message ||
              "Book search is unavailable. Please try again.",
          );
        if (!Array.isArray(data.books))
          throw new Error("Book search is unavailable. Please try again.");
        if (active) setResult({ ...data, phase: "ready", error: "" });
      } catch (error) {
        if (active && error.name !== "AbortError")
          setResult({
            phase: "error",
            books: [],
            hasMore: false,
            total: 0,
            error:
              error instanceof SyntaxError
                ? "Book search is unavailable. Please try again."
                : error.message === "Failed to fetch"
                  ? "Couldn’t connect to book search. Please try again."
                  : error.message,
          });
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, target, page, composing, retry]);
  return (
    <section className="catalog-search" aria-label="Search the book catalog">
      <div className="catalog-search-controls">
        <label className="field catalog-query">
          Search books
          <div className="catalog-input">
            <Search size={18} />
            <input
              value={query}
              maxLength={200}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!composing) setRetry((v) => v + 1);
                }
              }}
              placeholder="책 제목, 저자 또는 ISBN"
              autoFocus
            />
          </div>
        </label>
        <label className="field catalog-target">
          Search by
          <select
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All fields</option>
            <option value="title">Title</option>
            <option value="person">Author</option>
            <option value="isbn">ISBN</option>
          </select>
        </label>
      </div>
      <div className="catalog-results" aria-busy={result.phase === "loading"}>
        {result.phase === "idle" && (
          <p className="catalog-hint">
            Find your edition by its title, author, or ISBN. Korean titles
            welcome.
          </p>
        )}
        {result.phase === "loading" && (
          <p role="status" className="catalog-hint">
            Looking through the bookshelves…
          </p>
        )}
        {result.phase === "error" && (
          <div className="catalog-error" role="alert">
            <p>{result.error}</p>
            <button
              type="button"
              className="text-button"
              onClick={() => setRetry((v) => v + 1)}
            >
              Try again
            </button>
          </div>
        )}
        {result.phase === "ready" && result.books.length === 0 && (
          <p className="catalog-hint" role="status">
            No books found. Try a different title or ISBN, or enter your book
            manually.
          </p>
        )}
        {result.phase === "ready" && result.books.length > 0 && (
          <>
            <p className="catalog-result-count" role="status">
              {result.total.toLocaleString()} results · choose your edition
            </p>
            <div className="catalog-result-list">
              {result.books.map((book) => (
                <button
                  type="button"
                  className="catalog-result"
                  key={book.catalogId}
                  onClick={() => onSelect(book)}
                >
                  <CatalogCover book={book} />
                  <span className="catalog-result-copy">
                    <strong>{book.title}</strong>
                    <span>{book.author || "Author not listed"}</span>
                    <small>
                      {[book.publisher, book.publishedDate?.slice(0, 4)]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                    {(book.isbn13 || book.isbn10) && (
                      <small>ISBN {book.isbn13 || book.isbn10}</small>
                    )}
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              ))}
            </div>
            <div className="catalog-pagination">
              <button
                type="button"
                className="button secondary"
                disabled={page === 1}
                onClick={() => setPage((v) => v - 1)}
              >
                <ChevronLeft size={15} /> Previous
              </button>
              <span>Page {page}</span>
              <button
                type="button"
                className="button secondary"
                disabled={!result.hasMore}
                onClick={() => setPage((v) => v + 1)}
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
            <p className="catalog-attribution">
              Book information from Kakao / Daum Books
            </p>
          </>
        )}
      </div>
    </section>
  );
}
