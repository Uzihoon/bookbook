import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Library,
  CalendarDays,
  ArrowLeftRight,
  Bookmark,
  SlidersHorizontal,
  Leaf,
  CheckCheck,
} from "lucide-react";
import useClub from "./useClub.js";
import { pageForPath, pathForPage } from "./navigation.js";
import AddBook from "./AddBook.jsx";
import { coverSource } from "./catalog.js";
const monthLabel = (value, short = false) =>
  new Date(value + "-02T12:00:00").toLocaleDateString("en-US", {
    month: short ? "short" : "long",
    year: "numeric",
  });
const initials = (name) => name.slice(0, 2).toUpperCase();
function Avatar({ name, small = false }) {
  return (
    <span
      className={`avatar ${small ? "small" : ""} avatar-${name.toLowerCase()}`}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
function BookCover({ book, sources }) {
  const [failedSources, setFailedSources] = useState([]);
  const imageSource = sources.find(
    (source) => source && !failedSources.includes(source),
  );
  return imageSource ? (
    <img
      key={imageSource}
      src={imageSource}
      referrerPolicy="no-referrer"
      alt=""
      onError={() => setFailedSources((failed) => [...failed, imageSource])}
    />
  ) : (
    <div className="fallback-cover">
      <span>
        BOOKBOOK
        <br />
        SHARED LIBRARY
      </span>
      <strong>{book.title}</strong>
      <em>{book.author}</em>
    </div>
  );
}
function Book({ book, large = false }) {
  const sources = [coverSource(book, { large }), coverSource(book)];
  return (
    <div className={`book-scene ${large ? "large" : ""}`} aria-hidden="true">
      <div
        className="physical-book"
        style={{ "--book-color": book.color || "#693746" }}
      >
        <div className="book-back" />
        <div className="book-pages" />
        <div className="book-front">
          <BookCover
            key={JSON.stringify(sources)}
            book={book}
            sources={sources}
          />
        </div>
        <div className="book-spine" />
      </div>
      <div className="book-shadow" />
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
  wide = false,
  busy = false,
  error = "",
}) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onClose();
      }}
    >
      <div className="modal-top">
        <span className="eyebrow">BOOKBOOK / {title}</span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
          disabled={busy}
        >
          <X size={20} />
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {children}
    </dialog>
  );
}
export default function App({ member, onLogout, signingOut, logoutError }) {
  const { state, error, busy, refresh, mutate } = useClub(member.id);
  const [page, setPage] = useState(() => pageForPath(window.location.pathname)),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("recent"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  const notify = (message) => setToast(message);
  useEffect(() => {
    const restorePage = () => {
      setPage(pageForPath(window.location.pathname));
      setModal(null);
    };
    window.addEventListener("popstate", restorePage);
    return () => window.removeEventListener("popstate", restorePage);
  }, []);
  const navigate = (next) => {
    const path = pathForPage(next);
    if (window.location.pathname !== path)
      window.history.pushState(null, "", path);
    setPage(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const transact = async (command, message) => {
    try {
      await mutate(command);
      notify(message);
    } catch {
      /* Shared error banner retains the failure. */
    }
  };
  if (!state)
    return (
      <main className="empty-state club-loading">
        <BookOpen size={32} />
        <h1>Opening our shared shelf.</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="button primary" onClick={refresh}>
              Retry
            </button>
          </>
        ) : (
          <p role="status">Loading your club…</p>
        )}
        <button
          className="quiet-button"
          disabled={signingOut}
          onClick={onLogout}
        >
          Log out
        </button>
      </main>
    );
  const incoming = state.loans.filter(
    (l) =>
      l.status === "pending" &&
      state.books.find((b) => b.id === l.bookId)?.isMine,
  );
  const current = [...state.picks].sort((a, b) =>
    b.month.localeCompare(a.month),
  )[0];
  const featured = state.books.find((b) => b.id === current?.bookId);
  let visible = state.books.filter(
    (b) =>
      (filter === "all" ||
        (filter === "available" && b.status === "available") ||
        (filter === "mine" && b.isMine)) &&
      `${b.title} ${b.author} ${b.owner}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  if (sort === "title")
    visible = [...visible].sort((a, b) => a.title.localeCompare(b.title));
  const changeLoan = (id, status) =>
    transact(
      { action: "changeLoan", loanId: id, status },
      {
        accepted: "Request accepted. Arrange a handoff with your clubmate.",
        declined: "Request declined.",
        lent: "Book marked as lent. Happy reading!",
        returned: "Book returned to the shelf.",
        cancelled: "Request cancelled.",
      }[status],
    );
  const bookInModal =
    modal?.type === "book" ? state.books.find((b) => b.id === modal.id) : null;
  const openPick = (mode = "upcoming", value = null) =>
    setModal({ type: "pick", mode, value });
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => navigate("shelf")}
            aria-label="Bookbook home"
          >
            <BookOpen size={28} strokeWidth={1.7} />
            <span>
              bookbook<span className="brand-period">.</span>
            </span>
          </button>
          <nav aria-label="Main navigation">
            {[
              ["shelf", "Bookshelf", Library],
              ["picks", "Monthly picks", CalendarDays],
              ["loans", "Borrowing", ArrowLeftRight],
            ].map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => navigate(key)}
                aria-current={page === key ? "page" : undefined}
                className={page === key ? "active" : ""}
              >
                <Icon size={17} />
                <span>{label}</span>
                {key === "loans" && incoming.length > 0 && (
                  <b className="nav-count">{incoming.length}</b>
                )}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <span className="club-name">THE SUNDAY BOOK CLUB</span>
            <button
              className="profile-button"
              onClick={() => setModal({ type: "profile" })}
              aria-label="Your profile"
            >
              <Avatar name={member.name} />
            </button>
          </div>
        </div>
      </header>
      <main>
        {error && (
          <div className="club-error" role="alert">
            {error}{" "}
            <button className="text-button" onClick={refresh} disabled={busy}>
              Refresh club
            </button>
          </div>
        )}
        <div className="club-sync" role="status">
          {busy ? "Saving to the shared club…" : "Shared with all club members"}{" "}
          <button
            className="text-button"
            onClick={() => setModal({ type: "members" })}
          >
            {state.members.length} members
          </button>
        </div>
        <div className="page-intro">
          <div>
            <div className="eyebrow intro-eyebrow">
              <span className="little-line" /> OUR LITTLE READING CORNER
            </div>
            <h1>
              {page === "shelf"
                ? "A shelf worth sharing."
                : page === "picks"
                  ? "One book. Many perspectives."
                  : "Good stories travel."}
            </h1>
            <p>
              {page === "shelf"
                ? "Lend a favorite. Find your next read. Turn a page together."
                : page === "picks"
                  ? "The books we’ve shared, and the chapters still to come."
                  : "Keep track of the books making their way around the club."}
            </p>
          </div>
          <button
            className="button primary"
            onClick={() => setModal({ type: "add" })}
          >
            <Plus size={17} /> Add a book
          </button>
        </div>
        {page === "shelf" && (
          <>
            <section
              className="club-overview"
              aria-label="This month in the club"
            >
              <article
                className={`monthly-feature${featured ? "" : " is-empty"}`}
              >
                {featured ? (
                  <>
                    <div className="feature-copy">
                      <span className="eyebrow">
                        <span className="status-dot" /> OUR{" "}
                        {monthLabel(current.month, true)
                          .split(" ")[0]
                          .toUpperCase()}{" "}
                        READ
                      </span>
                      <h2>{featured.title}</h2>
                      <p className="feature-author">by {featured.author}</p>
                      <p className="feature-description">
                        {featured.note ||
                          featured.description ||
                          "Our latest story to read and share together."}
                      </p>
                      <div className="chosen-by">
                        <Avatar name={current.chooser} small />
                        <span>
                          Picked by <strong>{current.chooser}</strong>
                        </span>
                      </div>
                      <button
                        className="text-button"
                        onClick={() =>
                          setModal({ type: "book", id: featured.id })
                        }
                      >
                        Meet this month’s book <ArrowUpRight size={18} />
                      </button>
                    </div>
                    <button
                      className="feature-art"
                      onClick={() =>
                        setModal({ type: "book", id: featured.id })
                      }
                      aria-label={`View ${featured.title}`}
                    >
                      <div className="art-halo" />
                      <Book book={featured} large />
                      <span className="feature-edition">
                        {monthLabel(current.month).toUpperCase()}
                        <span>THE CLUB COLLECTION</span>
                      </span>
                    </button>
                  </>
                ) : (
                  <div className="feature-copy">
                    <span className="eyebrow">OUR FIRST CHAPTER</span>
                    <h2>A new story starts here.</h2>
                    <p className="feature-description">
                      Our reading journal is waiting for its first book.
                    </p>
                    <button
                      className="text-button"
                      onClick={() =>
                        state.books.length
                          ? openPick("record")
                          : setModal({ type: "add" })
                      }
                    >
                      {state.books.length
                        ? "Record our first read"
                        : "Add the first book"}{" "}
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                )}
              </article>
              <aside className="next-card">
                <div className="next-heading">
                  <span className="eyebrow">THE NEXT CHAPTER</span>
                  <Bookmark size={18} />
                </div>
                <h2>Who’s picking next?</h2>
                <div className="chooser-list">
                  {!state.queue.length && (
                    <p>
                      No upcoming picks yet. Plan a month when you’re ready.
                    </p>
                  )}
                  {state.queue.slice(0, 3).map((item, i) => (
                    <div
                      className={`chooser ${i === 0 ? "first" : ""}`}
                      key={item.month}
                    >
                      <span className="order-number">0{i + 1}</span>
                      <Avatar name={item.name} />
                      <div>
                        <strong>
                          {item.name}
                          {i === 0 && item.chooserId === member.id && (
                            <span className="your-turn">Your turn</span>
                          )}
                        </strong>
                        <span>{monthLabel(item.month)}</span>
                        {item.bookId && (
                          <span className="queue-book-title">
                            {
                              state.books.find((b) => b.id === item.bookId)
                                ?.title
                            }
                          </span>
                        )}
                      </div>
                      {i === 0 && <span className="chooser-dot" />}
                    </div>
                  ))}
                </div>
                <button
                  className="button secondary choose-button"
                  onClick={() => openPick()}
                >
                  Choose the next book <ArrowRight size={16} />
                </button>
                <button
                  className="quiet-button"
                  onClick={() => navigate("picks")}
                >
                  View our reading journey <ChevronRight size={14} />
                </button>
              </aside>
            </section>
            <section
              className="library-section"
              aria-labelledby="library-title"
            >
              <div className="section-heading">
                <div className="heading-inline">
                  <h2 id="library-title">The shared bookshelf</h2>
                  <span className="number-tag">{state.books.length} books</span>
                </div>
                <div className="shelf-note">
                  <Leaf size={15} /> Better when passed along
                </div>
              </div>
              <div className="shelf-toolbar">
                <div className="filter-tabs" aria-label="Filter books">
                  {[
                    ["all", "All books"],
                    ["available", "Available now"],
                    ["mine", "My books"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className={filter === key ? "selected" : ""}
                      aria-pressed={filter === key}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="search-sort">
                  <label className="search-box">
                    <Search size={17} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Find a book or author…"
                      aria-label="Search books"
                    />
                    {query && (
                      <button
                        aria-label="Clear search"
                        onClick={() => setQuery("")}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </label>
                  <label className="sort-box">
                    <SlidersHorizontal size={15} />
                    <select
                      aria-label="Sort books"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="recent">Shelf order</option>
                      <option value="title">Title: A–Z</option>
                    </select>
                    <ChevronDown size={13} />
                  </label>
                </div>
              </div>
              <div className="books-grid">
                {visible.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onClick={() => setModal({ type: "book", id: book.id })}
                    requested={state.loans.some(
                      (l) =>
                        l.bookId === book.id &&
                        l.isBorrower &&
                        ["pending", "accepted"].includes(l.status),
                    )}
                  />
                ))}
              </div>
              {visible.length === 0 && (
                <div className="empty-state">
                  <Search />
                  <h3>No books on this shelf yet.</h3>
                  <p>
                    {!state.books.length
                      ? "Start with a book you’d like to share."
                      : query
                        ? "Try another title, author, or clubmate."
                        : "Add a book or try a different filter."}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (!state.books.length) {
                        setModal({ type: "add" });
                        return;
                      }
                      setQuery("");
                      setFilter("all");
                    }}
                  >
                    {state.books.length
                      ? "Show all books"
                      : "Add the first book"}{" "}
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>
          </>
        )}
        {page === "picks" && (
          <section className="picks-layout">
            <div>
              <div className="section-heading">
                <h2>Our reading journal</h2>
                <button
                  className="text-button"
                  onClick={() => openPick("record")}
                >
                  <Plus size={16} /> Record a month
                </button>
              </div>
              <div className="journal-grid">
                {!state.picks.length && (
                  <div className="empty-state">
                    <BookOpen />
                    <h3>No monthly reads yet.</h3>
                    <p>Record your first selection to begin the journal.</p>
                  </div>
                )}
                {[...state.picks]
                  .sort((a, b) => b.month.localeCompare(a.month))
                  .map((pick, i) => {
                    const b = state.books.find((b) => b.id === pick.bookId);
                    return (
                      <article className="journal-card" key={pick.month}>
                        <div className="journal-month">
                          <span>{monthLabel(pick.month)}</span>
                          {i === 0 && (
                            <span className="current-tag">Latest read</span>
                          )}
                        </div>
                        <button
                          className="journal-book"
                          onClick={() => setModal({ type: "book", id: b.id })}
                          aria-label={`View ${b.title}`}
                        >
                          <Book book={b} />
                        </button>
                        <h3>{b.title}</h3>
                        <p>{b.author}</p>
                        <div className="journal-footer">
                          <span>
                            <Avatar name={pick.chooser} small /> Picked by{" "}
                            {pick.chooser}
                          </span>
                          <button
                            className="text-button"
                            onClick={() => openPick("record", pick)}
                          >
                            Edit
                          </button>
                        </div>
                      </article>
                    );
                  })}
              </div>
            </div>
            <aside className="queue-panel">
              <div className="eyebrow">PASSING THE BOOKMARK</div>
              <h2>The picking order</h2>
              <p>Everyone gets a turn to bring a story to the table.</p>
              {!state.queue.length && <p>No turns planned yet.</p>}
              <button
                className="text-button"
                onClick={() => openPick("upcoming", {})}
              >
                <Plus size={16} /> Plan a month
              </button>
              {state.queue.map((item, i) => (
                <div className="queue-item" key={item.month}>
                  <div className="queue-person">
                    <Avatar name={item.name} />
                    <div>
                      <strong>{item.name}</strong>
                      <span>{monthLabel(item.month)}</span>
                    </div>
                    <div className="reorder-buttons">
                      <button
                        aria-label={`Move ${item.name} earlier`}
                        disabled={busy || i === 0}
                        onClick={() =>
                          transact(
                            {
                              action: "swapTurns",
                              month: item.month,
                              otherMonth: state.queue[i - 1].month,
                            },
                            "Picking order updated.",
                          )
                        }
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        aria-label={`Move ${item.name} later`}
                        disabled={busy || i === state.queue.length - 1}
                        onClick={() =>
                          transact(
                            {
                              action: "swapTurns",
                              month: item.month,
                              otherMonth: state.queue[i + 1].month,
                            },
                            "Picking order updated.",
                          )
                        }
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>
                  </div>
                  <button
                    className="queue-pick"
                    onClick={() => openPick("upcoming", item)}
                  >
                    {item.bookId
                      ? state.books.find((b) => b.id === item.bookId)?.title
                      : "Choose a book"}
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              ))}
              {state.queue.length > 1 && (
                <p className="queue-hint">
                  Use the arrows to swap turns. A chosen book stays with its
                  chooser.
                </p>
              )}
            </aside>
          </section>
        )}
        {page === "loans" && (
          <Borrowing
            state={state}
            onBook={(id) => setModal({ type: "book", id })}
            onChange={changeLoan}
            incoming={incoming}
            busy={busy}
          />
        )}
        <footer>
          <div className="footer-brand">
            <BookOpen size={18} />
            <span>A good book is only the beginning.</span>
          </div>
          <span>
            Made for our little club <span className="footer-flower">✳</span>
          </span>
          <button onClick={() => setModal({ type: "profile" })}>
            Saved to our shared club
          </button>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal?.type === "add" && (
        <Modal
          title="ADD TO THE SHELF"
          busy={busy}
          onClose={() => setModal(null)}
        >
          <AddBook
            busy={busy}
            onSave={async (book) => {
              await mutate({ action: "addBook", book });
              setModal(null);
              navigate("shelf");
              setFilter("mine");
              setQuery("");
              notify("Your book is on the shared shelf.");
            }}
          />
        </Modal>
      )}
      {bookInModal && (
        <Modal
          title="FROM OUR SHARED SHELF"
          wide
          busy={busy}
          error={error}
          onClose={() => setModal(null)}
        >
          <div className="book-details">
            <div className="detail-art">
              <Book book={bookInModal} large />
            </div>
            <div className="detail-copy">
              <span className="eyebrow">{bookInModal.genre}</span>
              <h2>{bookInModal.title}</h2>
              <p className="detail-author">{bookInModal.author}</p>
              <div className="detail-owner">
                <Avatar name={bookInModal.owner} />
                <div>
                  <small>ON THE SHELF OF</small>
                  <strong>{bookInModal.owner}</strong>
                </div>
                <Availability book={bookInModal} />
              </div>
              {bookInModal.description && <p>{bookInModal.description}</p>}
              {bookInModal.note && (
                <blockquote>
                  “{bookInModal.note}”
                  <span>
                    — {bookInModal.isMine ? "Your note" : bookInModal.owner}
                  </span>
                </blockquote>
              )}
              <BookAction
                book={bookInModal}
                state={state}
                onRequest={() =>
                  transact(
                    { action: "requestLoan", bookId: bookInModal.id },
                    "Borrowing request sent. You can follow it in Borrowing.",
                  )
                }
                onLoans={() => {
                  setModal(null);
                  navigate("loans");
                }}
                onAvailability={() =>
                  transact(
                    {
                      action: "availability",
                      bookId: bookInModal.id,
                      status:
                        bookInModal.status === "unlisted"
                          ? "available"
                          : "unlisted",
                    },
                    "Book availability updated.",
                  )
                }
                busy={busy}
              />
            </div>
          </div>
        </Modal>
      )}
      {modal?.type === "pick" && (
        <Modal
          title={
            modal.mode === "record" ? "READING JOURNAL" : "THE NEXT CHAPTER"
          }
          busy={busy}
          onClose={() => setModal(null)}
        >
          {state.books.length || modal.mode === "upcoming" ? (
            <PickForm
              mode={modal.mode}
              value={modal.value}
              state={state}
              memberId={member.id}
              busy={busy}
              onSave={async (value, revision) => {
                await mutate({
                  revision,
                  action: "saveSelection",
                  kind: modal.mode === "record" ? "history" : "upcoming",
                  ...value,
                });
                setModal(null);
                notify("Your reading journey is updated.");
              }}
            />
          ) : (
            <div className="empty-state">
              <BookOpen />
              <h2>Add a book first.</h2>
              <p>Then choose it for your monthly read.</p>
              <button
                className="button primary"
                onClick={() => setModal({ type: "add" })}
              >
                Add a book
              </button>
            </div>
          )}
        </Modal>
      )}
      {modal?.type === "members" && (
        <Modal title="OUR CLUB MEMBERS" onClose={() => setModal(null)}>
          <h2>The people behind the shelf.</h2>
          <ul className="member-list">
            {state.members.map((person) => (
              <li key={person.id}>
                <Avatar name={person.name} />
                <div>
                  <strong>
                    {person.name}
                    {person.id === member.id ? " (you)" : ""}
                  </strong>
                  <span>
                    {state.books.filter((b) => b.ownerId === person.id).length}{" "}
                    books on the shelf
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {modal?.type === "profile" && (
        <Modal title="YOUR READING CORNER" onClose={() => setModal(null)}>
          <div className="profile-info">
            <Avatar name={member.name} />
            <h2>Hello, {member.name}.</h2>
            <p>
              You’re signed in to Bookbook. Your books and reading plans are
              saved to our shared club.
            </p>
            <div className="demo-info">
              <strong>One club, wherever you read.</strong>
              <p>
                All members can see the bookshelf and reading plans. Borrowing
                requests appear in the owner’s Borrowing tab.
              </p>
            </div>
            {logoutError && (
              <p className="form-error" role="alert">
                {logoutError}
              </p>
            )}
            <button
              className="button primary"
              disabled={signingOut}
              onClick={onLogout}
            >
              {signingOut ? "Logging out…" : "Log out"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Availability({ book, requested = false }) {
  return (
    <span
      className={`availability ${book.status === "available" && !requested ? "available" : ""}`}
    >
      <span />
      {requested
        ? "Requested"
        : book.status === "available"
          ? "Available"
          : book.status === "lent"
            ? "Being enjoyed"
            : book.status === "reserved"
              ? "Reserved"
              : "Not lending"}
    </span>
  );
}
function BookCard({ book, onClick, requested }) {
  return (
    <article className="book-card">
      <button
        className="book-card-art"
        onClick={onClick}
        aria-label={`View ${book.title}`}
      >
        <Book book={book} />
        {book.isMine && <span className="owned-label">Your copy</span>}
        <span className="book-open-icon">
          <ArrowUpRight size={19} />
        </span>
      </button>
      <button className="book-title-button" onClick={onClick}>
        <h3>{book.title}</h3>
      </button>
      <p className="book-author">{book.author}</p>
      <div className="book-card-bottom">
        <span className="book-owner">
          <Avatar name={book.owner} small />
          {book.owner}
        </span>
        <Availability book={book} requested={requested} />
      </div>
    </article>
  );
}
function BookAction({ book, state, onRequest, onLoans, onAvailability, busy }) {
  const loan = state.loans.find(
    (l) =>
      l.bookId === book.id &&
      l.isBorrower &&
      ["pending", "accepted", "lent"].includes(l.status),
  );
  if (loan)
    return (
      <button className="button primary full" onClick={onLoans}>
        {loan.status === "pending"
          ? "Request pending"
          : loan.status === "accepted"
            ? "Ready for your handoff"
            : "You’re borrowing this"}
        <ArrowRight size={17} />
      </button>
    );
  if (book.isMine)
    return (
      <>
        <button className="button primary full" onClick={onLoans}>
          Manage your borrowing requests
          <ArrowRight size={17} />
        </button>
        {["available", "unlisted"].includes(book.status) && (
          <button
            className="quiet-button"
            disabled={busy}
            onClick={onAvailability}
          >
            {book.status === "unlisted"
              ? "Make available to borrow"
              : "Pause lending this copy"}
          </button>
        )}
      </>
    );
  return (
    <>
      <button
        className="button primary full"
        disabled={busy || book.status !== "available"}
        onClick={onRequest}
      >
        {book.status === "available"
          ? "Request to borrow"
          : "This copy isn’t available"}
        <ArrowUpRight size={17} />
      </button>
      {book.status === "available" && (
        <small className="handoff-note">
          Once accepted, arrange a handoff with {book.owner}.
        </small>
      )}
    </>
  );
}
function PickForm({ mode, value, state, onSave, memberId, busy }) {
  const editingRevision = useRef(state.revision);
  const initial = value || (mode === "upcoming" ? state.queue[0] : null) || {};
  const today = new Date();
  const defaultDate = new Date(
    today.getFullYear(),
    today.getMonth() + (mode === "upcoming" ? 1 : 0),
    1,
  );
  const defaultMonth = `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(initial.month || defaultMonth),
    [bookId, setBookId] = useState(
      (mode === "record" ? value?.bookId : initial.bookId) || "",
    ),
    [chooserId, setChooserId] = useState(initial.chooserId || memberId),
    [saveError, setSaveError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setSaveError("");
        try {
          await onSave(
            { month, bookId: bookId || null, chooserId },
            editingRevision.current ?? state.revision,
          );
        } catch (error) {
          editingRevision.current = null;
          setSaveError(error.message);
        }
      }}
    >
      <h2>
        {mode === "record"
          ? "A chapter to remember."
          : "What should we read next?"}
      </h2>
      <p>
        {mode === "record"
          ? "Add or update a book in our monthly reading journal."
          : "Give the club something to look forward to."}
      </p>
      <label className="field">
        Month
        <input
          type="month"
          min="2000-01"
          max="2099-12"
          disabled={busy || !!initial.month}
          required
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </label>
      <label className="field">
        Book
        <select
          required={mode === "record"}
          disabled={busy}
          value={bookId}
          onChange={(e) => setBookId(e.target.value)}
        >
          <option value="" disabled={mode === "record"}>
            {mode === "record"
              ? "Select from our bookshelf"
              : "Book to be decided"}
          </option>
          {state.books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title} — {b.author}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {mode === "record" ? "Chosen by" : "Who’s choosing?"}
        <select
          required
          value={chooserId}
          disabled={busy}
          onChange={(e) => setChooserId(e.target.value)}
        >
          {state.members.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
              {person.id === memberId ? " (you)" : ""}
            </option>
          ))}
        </select>
      </label>
      {bookId && (
        <div className="pick-preview">
          <Book book={state.books.find((b) => b.id === bookId)} />
          <div>
            <strong>{state.books.find((b) => b.id === bookId).title}</strong>
            <p>{state.books.find((b) => b.id === bookId).author}</p>
          </div>
        </div>
      )}
      {mode === "record" && state.picks.some((p) => p.month === month) && (
        <p className="form-hint">
          This will update the existing pick for {monthLabel(month)}.
        </p>
      )}
      {saveError && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}
      <button className="button primary full" type="submit" disabled={busy}>
        <Check size={17} /> Save {mode === "record" ? "monthly" : "upcoming"}{" "}
        pick
      </button>
    </form>
  );
}
function Borrowing({ state, onBook, onChange, incoming, busy }) {
  const [tab, setTab] = useState("active");
  const active = ["pending", "accepted", "lent"];
  const relevant = state.loans.filter(
    (l) =>
      state.books.some((b) => b.id === l.bookId) &&
      (l.isBorrower || state.books.find((b) => b.id === l.bookId).isMine),
  );
  const loans = relevant.filter((l) =>
    tab === "active" ? active.includes(l.status) : !active.includes(l.status),
  );
  return (
    <section className="borrowing-section">
      <div className="borrowing-heading">
        <div>
          <h2>A book’s next adventure</h2>
          <p>
            {incoming.length
              ? `${incoming.length} clubmate ${incoming.length === 1 ? "is" : "are"} waiting to borrow from your shelf.`
              : "Every shared story starts with a handoff."}
          </p>
        </div>
        <div className="filter-tabs">
          {[
            ["active", "Current"],
            ["history", "Past borrowing"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "selected" : ""}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="loan-list">
        {loans.map((l) => {
          const b = state.books.find((b) => b.id === l.bookId),
            mine = b.isMine;
          return (
            <article className="loan-card" key={l.id}>
              <button
                className="loan-cover"
                aria-label={`View ${b.title}`}
                onClick={() => onBook(b.id)}
              >
                <Book book={b} />
              </button>
              <div className="loan-copy">
                <span className="eyebrow">
                  {mine ? "FROM YOUR SHELF" : "ON YOUR READING PILE"}
                </span>
                <h3>{b.title}</h3>
                <p>
                  {mine
                    ? `${l.borrower} ${l.status === "pending" ? "would like to borrow your copy" : l.status === "lent" ? "is reading your copy" : l.status === "returned" ? "returned your copy" : l.status === "accepted" ? "is ready to collect your copy" : "requested your copy"}`
                    : `${l.status === "lent" ? "Borrowed from" : l.status === "returned" ? "Returned to" : "Your request to"} ${b.owner}`}
                </p>
                <span className={`loan-status status-${l.status}`}>
                  {
                    {
                      pending: "Awaiting approval",
                      accepted: "Accepted · arrange a handoff",
                      lent: "Currently on loan",
                      returned: "Returned to the shelf",
                      declined: "Request declined",
                      cancelled: "Request cancelled",
                    }[l.status]
                  }
                </span>
              </div>
              <fieldset className="loan-actions" disabled={busy}>
                {mine && l.status === "pending" && (
                  <>
                    <button
                      className="button primary"
                      onClick={() => onChange(l.id, "accepted")}
                    >
                      <Check size={16} /> Accept request
                    </button>
                    <button
                      className="quiet-button"
                      onClick={() => onChange(l.id, "declined")}
                    >
                      Decline
                    </button>
                  </>
                )}
                {mine && l.status === "accepted" && (
                  <button
                    className="button primary"
                    onClick={() => onChange(l.id, "lent")}
                  >
                    Mark as handed over <ArrowRight size={16} />
                  </button>
                )}
                {mine && l.status === "lent" && (
                  <button
                    className="button secondary"
                    onClick={() => onChange(l.id, "returned")}
                  >
                    <CheckCheck size={16} /> Mark returned
                  </button>
                )}
                {!mine && ["pending", "accepted"].includes(l.status) && (
                  <button
                    className="button secondary"
                    onClick={() => onChange(l.id, "cancelled")}
                  >
                    Cancel request
                  </button>
                )}
              </fieldset>
            </article>
          );
        })}
      </div>
      {!loans.length && (
        <div className="empty-state">
          <BookOpen size={32} />
          <h3>
            {tab === "active" ? "All caught up." : "A fresh reading history."}
          </h3>
          <p>
            {tab === "active"
              ? "Your borrowing requests and loans will appear here."
              : "Returned, declined, and cancelled requests will appear here."}
          </p>
        </div>
      )}
    </section>
  );
}
