import React, { useState, useRef } from "react";
import { Plus, Check, ArrowUpRight } from "lucide-react";
import BookSearch, { CatalogCover } from "./BookSearch.jsx";
import { createOwnedCopy } from "./catalog.js";
export default function AddBook({ onSave, busy }) {
  const copyId = useRef(crypto.randomUUID());
  const [mode, setMode] = useState("search"),
    [selected, setSelected] = useState(null),
    [title, setTitle] = useState(""),
    [author, setAuthor] = useState(""),
    [error, setError] = useState("");
  const manual = () => {
    setMode("manual");
    setSelected(null);
    setError("");
  };
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await onSave({
        ...createOwnedCopy(
          {
            title,
            author,
            genre: f.get("genre"),
            note: f.get("note"),
            available: f.get("available") === "on",
            color: f.get("color"),
          },
          selected,
        ),
        id: copyId.current,
      });
    } catch (e) {
      setError(e.message);
    }
  }
  const showDetails = mode === "manual" || selected;
  return (
    <form onSubmit={submit} className="add-book-form">
      <fieldset className="form-fields" disabled={busy}>
        <h2>Make room for a new story.</h2>
        <p>Find your book, then add your copy to the shared shelf.</p>
        <div
          className="filter-tabs add-mode-tabs"
          aria-label="How to add a book"
        >
          <button
            type="button"
            className={mode === "search" ? "selected" : ""}
            aria-pressed={mode === "search"}
            onClick={() => {
              setMode("search");
              setError("");
            }}
          >
            Search books
          </button>
          <button
            type="button"
            className={mode === "manual" ? "selected" : ""}
            aria-pressed={mode === "manual"}
            onClick={manual}
          >
            Enter manually
          </button>
        </div>
        {mode === "search" && !selected && (
          <BookSearch
            onSelect={(book) => {
              setSelected(book);
              setTitle(book.title);
              setAuthor(book.author);
              setError("");
            }}
          />
        )}
        {selected && (
          <div className="selected-catalog-book">
            <CatalogCover book={selected} />
            <div>
              <span className="selection-label">
                <Check size={13} /> Your edition
              </span>
              <strong>{selected.title}</strong>
              <p>
                {[selected.publisher, selected.publishedDate?.slice(0, 4)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="selected-book-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setSelected(null)}
                >
                  Change book
                </button>
                {selected.sourceUrl && (
                  <a
                    className="text-button"
                    href={selected.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Daum Books <ArrowUpRight size={13} />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
        {showDetails && (
          <>
            <label className="field">
              Book title
              <input
                name="title"
                required
                maxLength={300}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                readOnly={!!selected}
                placeholder="What’s on your shelf?"
              />
            </label>
            <label className="field">
              Author
              <input
                name="author"
                required
                maxLength={300}
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                readOnly={!!selected && !!selected.author}
                placeholder="Who wrote it?"
              />
            </label>
            {selected && (selected.isbn13 || selected.isbn10) && (
              <p className="edition-isbn">
                ISBN {selected.isbn13 || selected.isbn10}
                {selected.translators?.length > 0 && (
                  <span>Translated by {selected.translators.join(", ")}</span>
                )}
              </p>
            )}
            <div className="form-columns">
              <label className="field">
                Genre
                <select
                  name="genre"
                  key={selected?.catalogId || "manual"}
                  defaultValue={selected ? "Other" : "Fiction"}
                >
                  <option>Fiction</option>
                  <option>Nonfiction</option>
                  <option>Memoir</option>
                  <option>Poetry</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="field">
                {selected?.coverUrl ? "Spine color" : "Cover color"}
                <input type="color" name="color" defaultValue="#693746" />
              </label>
            </div>
            <label className="field">
              A note for your clubmates{" "}
              <span className="optional">(optional)</span>
              <textarea
                name="note"
                maxLength={400}
                rows={3}
                placeholder="Why you love it, or anything a borrower should know…"
              />
            </label>
            <label className="checkbox-field">
              <input name="available" type="checkbox" defaultChecked />
              Available for clubmates to borrow
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button primary full"
              type="submit"
              disabled={busy}
            >
              <Plus size={17} /> Add to our bookshelf
            </button>
          </>
        )}
        {!showDetails && (
          <button
            type="button"
            className="quiet-button manual-fallback"
            onClick={manual}
          >
            Can’t find your book? Enter it manually.
          </button>
        )}
      </fieldset>
    </form>
  );
}
