import React, { useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";

const dateLabel = (value) =>
  new Date(value).toLocaleString("en-US", {
    timeZone: "America/Vancouver",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function BookComments({ bookId, comments, busy, onSave }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [visible, setVisible] = useState(10);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const pending = useRef(null);
  const entries = comments.filter((comment) => comment.bookId === bookId);
  const post = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (busy || !body || body.length > 2000) return;
    setError("");
    setStatus("");
    // Keep the same ID when retrying an unchanged draft after a lost response.
    if (pending.current?.body !== body)
      pending.current = { id: crypto.randomUUID(), body };
    try {
      await onSave({ action: "addComment", bookId, ...pending.current });
      setDraft("");
      pending.current = null;
      setStatus("Your comment was posted.");
    } catch (error) {
      setError(error.message);
    }
  };
  return (
    <section className="book-comments" aria-labelledby="book-comments-title">
      <div className="comments-heading">
        <h3 id="book-comments-title">
          <MessageCircle size={20} /> Club conversation
        </h3>
        <span>
          {entries.length} {entries.length === 1 ? "comment" : "comments"}
        </span>
      </div>
      <form onSubmit={post} className="comment-form">
        <label className="field">
          Leave a comment
          <textarea
            rows={3}
            maxLength={2000}
            placeholder="What stayed with you? Share a thought with the club…"
            value={draft}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            aria-describedby="comment-hint"
          />
        </label>
        <div className="comment-form-footer">
          <span id="comment-hint">
            Visible to all club members · {draft.length.toLocaleString()}/2,000
          </span>
          <button
            className="button primary"
            disabled={busy || !draft.trim()}
            type="submit"
          >
            <Send size={15} /> Post comment
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <p role="status" className="comment-status">
        {status}
      </p>
      {!entries.length && (
        <p className="comments-empty">
          No comments yet. Start the conversation.
        </p>
      )}
      <ol className="comment-list">
        {entries.slice(0, visible).map((comment) => (
          <li key={comment.id}>
            <div className="comment-meta">
              <strong>
                {comment.author}
                {comment.isMine ? " (you)" : ""}
              </strong>
              <time dateTime={comment.createdAt} title="Vancouver time">
                {dateLabel(comment.createdAt)}
              </time>
            </div>
            <p className="comment-body">{comment.body}</p>
            {comment.isMine &&
              (confirmDelete === comment.id ? (
                <div className="comment-delete-confirm">
                  <span>Delete your comment? This cannot be undone.</span>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={async () => {
                      setError("");
                      setStatus("");
                      try {
                        await onSave({
                          action: "deleteComment",
                          id: comment.id,
                        });
                        setConfirmDelete(null);
                        setStatus("Your comment was deleted.");
                      } catch (error) {
                        setError(error.message);
                      }
                    }}
                  >
                    Delete comment
                  </button>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => setConfirmDelete(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="text-button comment-delete"
                  disabled={busy}
                  onClick={() => setConfirmDelete(comment.id)}
                >
                  Delete
                </button>
              ))}
          </li>
        ))}
      </ol>
      {entries.length > visible && (
        <button
          className="text-button"
          onClick={() => setVisible(visible + 10)}
        >
          Show older comments
        </button>
      )}
    </section>
  );
}
