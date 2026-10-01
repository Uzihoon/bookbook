import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearLegacyCollections,
  clubRequest,
  displaySnapshot,
} from "./club-state.js";
export default function useClub(memberId) {
  const [snapshot, setSnapshot] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const current = useRef(null),
    writing = useRef(false),
    epoch = useRef(0),
    alive = useRef(false);
  const accept = useCallback((next) => {
    if (
      alive.current &&
      (!current.current || next.revision >= current.current.revision)
    ) {
      current.current = next;
      setSnapshot(next);
    }
  }, []);
  const failure = useCallback((e) => {
    if (!alive.current) return;
    if (e.status === 401)
      window.dispatchEvent(new Event("bookbook:session-expired"));
    setError(e.message);
  }, []);
  const refresh = useCallback(async () => {
    if (writing.current) return;
    const id = ++epoch.current;
    try {
      const next = await clubRequest();
      if (id === epoch.current && alive.current) {
        accept(next);
        setError("");
      }
    } catch (e) {
      if (id === epoch.current) failure(e);
    }
  }, [accept, failure]);
  useEffect(() => {
    alive.current = true;
    try {
      clearLegacyCollections(window.localStorage);
    } catch {}
    refresh();
    const visible = () => {
      if (!document.hidden) refresh();
    };
    const timer = setInterval(visible, 30000);
    window.addEventListener("focus", visible);
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive.current = false;
      epoch.current++;
      clearInterval(timer);
      window.removeEventListener("focus", visible);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  const mutate = async (command) => {
    if (writing.current || !current.current)
      throw new Error("Please wait for the club to finish loading or saving.");
    writing.current = true;
    epoch.current++;
    setBusy(true);
    setError("");
    try {
      accept(
        await clubRequest({
          ...command,
          revision: command.revision ?? current.current.revision,
        }),
      );
    } catch (e) {
      // The write may have completed even if its response was lost. Reconcile first.
      try {
        accept(await clubRequest());
      } catch {}
      failure(e);
      throw e;
    } finally {
      writing.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return {
    state: useMemo(
      () => snapshot && displaySnapshot(snapshot, memberId),
      [snapshot, memberId],
    ),
    error,
    busy,
    refresh,
    mutate,
  };
}
