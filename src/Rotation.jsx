import React, { useRef, useState } from "react";
import { ArrowUp, ArrowDown, Trash2, Check } from "lucide-react";
import { addMonths } from "../shared/rotation.js";
const label = (month) =>
  new Date(month + "-02T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
export function RotationEditor({ state, busy, onSave }) {
  const [ids, setIds] = useState(state.rotationOrder),
    [error, setError] = useState("");
  const revision = useRef(state.revision),
    anchor = useRef(state.currentMonth);
  const move = (i, delta) =>
    setIds((values) => {
      const next = [...values];
      [next[i], next[i + delta]] = [next[i + delta], next[i]];
      return next;
    });
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await onSave({
            memberIds: ids,
            anchorMonth: anchor.current ?? state.currentMonth,
            revision: revision.current ?? state.revision,
          });
        } catch (e) {
          revision.current = null;
          anchor.current = null;
          setError(e.message);
        }
      }}
    >
      <h2>Everyone gets a turn.</h2>
      <p>
        Set the order starting this month. It repeats automatically each month
        in Vancouver time. Saved monthly selections stay unchanged.
      </p>
      <fieldset className="form-fields" disabled={busy}>
        <ol className="rotation-editor-list">
          {ids.map((id, i) => {
            const person = state.members.find((m) => m.id === id);
            return (
              <li key={id}>
                <div>
                  <strong>{person?.name || "Club member"}</strong>
                  <span>{label(addMonths(state.currentMonth, i))}</span>
                </div>
                <div className="rotation-controls">
                  <button
                    type="button"
                    className="icon-button"
                    disabled={!i}
                    aria-label={`Move ${person?.name} earlier`}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={i === ids.length - 1}
                    aria-label={`Move ${person?.name} later`}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${person?.name} from rotation`}
                    onClick={() => setIds(ids.filter((value) => value !== id))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        {!ids.length && (
          <p>No one is in the rotation yet. Add members below to begin.</p>
        )}
        <label className="field">
          Add a member
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) setIds([...ids, e.target.value]);
            }}
          >
            <option value="" disabled>
              Select a club member
            </option>
            {state.members
              .filter((m) => !ids.includes(m.id))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </label>
        <p className="form-hint">
          Removing someone only removes them from the repeating order. Their
          account, books, and saved picks stay intact.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" type="submit">
          <Check size={17} /> Save rotation
        </button>
      </fieldset>
    </form>
  );
}
export function SavedMonths({ state, onEdit, onClear }) {
  return (
    <>
      <h2>Your saved months.</h2>
      <p>
        Edit a saved month or clear its selection. The repeating member order
        stays intact.
      </p>
      <ul className="saved-month-list">
        {[...state.selections]
          .sort(
            (a, b) =>
              b.month.localeCompare(a.month) || a.kind.localeCompare(b.kind),
          )
          .map((item) => (
            <li key={`${item.kind}:${item.month}`}>
              <div>
                <strong>{label(item.month)}</strong>
                <span>
                  {item.name} ·{" "}
                  {item.kind === "history"
                    ? "Reading journal"
                    : "Planned selection"}
                </span>
                <p>
                  {state.books.find((b) => b.id === item.bookId)?.title ||
                    "Book to be decided"}
                </p>
              </div>
              <div className="saved-month-actions">
                <button className="text-button" onClick={() => onEdit(item)}>
                  Edit month
                </button>
                <button className="text-button" onClick={() => onClear(item)}>
                  Clear selection
                </button>
              </div>
            </li>
          ))}
      </ul>
      {!state.selections.length && (
        <p>
          No saved selections yet. Your rotation still repeats automatically.
        </p>
      )}
    </>
  );
}
export function ClearSelection({ month, busy, onConfirm, revision }) {
  const expectedRevision = useRef(revision);
  const [error, setError] = useState("");
  return (
    <>
      <h2>Clear {label(month)}?</h2>
      <p>
        This deletes the saved selection for this month, including any
        reading-journal entry. The book stays on the shelf, and the rotation
        supplies the default chooser again.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button primary full"
        disabled={busy}
        onClick={async () => {
          try {
            await onConfirm(expectedRevision.current);
          } catch (e) {
            expectedRevision.current = null;
            setError(e.message);
          }
        }}
      >
        <Trash2 size={17} /> Clear month selection
      </button>
    </>
  );
}
