import React, { useCallback, useEffect, useState, useRef } from "react";
import { BookOpen, ArrowRight, Eye, EyeOff } from "lucide-react";
async function authRequest(action, body) {
  const response = await fetch(
    `/api/auth${action ? "?action=" + action : ""}`,
    {
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      ...(action
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body || {}),
          }
        : {}),
    },
  );
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Couldn’t connect to member login. Please try again.");
  }
  if (!response.ok)
    throw new Error(
      data.error?.message || "Member login is unavailable. Please try again.",
    );
  return data.member;
}
const messageFor = (error) =>
  error.name === "TimeoutError"
    ? "Login took too long. Please try again."
    : error.message === "Failed to fetch"
      ? "Couldn’t connect. Check your connection and try again."
      : error.message;
export default function AuthGate({ children }) {
  const [member, setMember] = useState(null),
    [checking, setChecking] = useState(true),
    [sessionError, setSessionError] = useState(""),
    [signingOut, setSigningOut] = useState(false);
  const revision = useRef(0);
  const loggingOut = useRef(false);
  const check = useCallback(async () => {
    if (loggingOut.current) return;
    const current = ++revision.current;
    try {
      const next = await authRequest();
      if (current !== revision.current) return;
      setMember(next);
      setSessionError("");
    } catch (error) {
      if (current !== revision.current) return;
      setMember(null);
      setSessionError(messageFor(error));
    } finally {
      if (current === revision.current) setChecking(false);
    }
  }, []);
  useEffect(() => {
    check();
  }, [check]);
  useEffect(() => {
    const expire = () => {
      revision.current++;
      setMember(null);
      setSessionError("Please log in again to continue.");
    };
    window.addEventListener("bookbook:session-expired", expire);
    // Revalidate when the member returns or another tab may have logged out.
    const onFocus = () => {
      if (member) check();
    };
    window.addEventListener("focus", onFocus);
    const timer = member ? setInterval(check, 60000) : null;
    return () => {
      window.removeEventListener("bookbook:session-expired", expire);
      window.removeEventListener("focus", onFocus);
      if (timer) clearInterval(timer);
    };
  }, [member?.id, check]);
  async function logout() {
    loggingOut.current = true;
    revision.current++;
    setSigningOut(true);
    setSessionError("");
    try {
      await authRequest("logout");
      setMember(null);
    } catch (error) {
      setSessionError(messageFor(error));
    } finally {
      loggingOut.current = false;
      setSigningOut(false);
    }
  }
  if (member)
    return children({
      member,
      onLogout: logout,
      signingOut,
      logoutError: sessionError,
    });
  return (
    <main className="auth-page">
      <a className="auth-brand" href="/" aria-label="Bookbook home">
        <BookOpen size={27} />
        <span>
          bookbook<span className="brand-dot">.</span>
        </span>
      </a>
      <div className="auth-layout">
        <section className="auth-welcome">
          <p className="eyebrow">A LITTLE CLUB. A LOT OF STORIES.</p>
          <h1>
            Good books.
            <br />
            Better company.
          </h1>
          <p>
            A place for our books, our next read,
            <br className="auth-desktop-break" /> and the stories we pass
            around.
          </p>
          <div className="auth-book-stack" aria-hidden="true">
            <div className="auth-spine spine-wine">
              ONE MORE CHAPTER <span>01</span>
            </div>
            <div className="auth-spine spine-sage">
              THE SHARED SHELF <span>02</span>
            </div>
            <div className="auth-spine spine-cream">
              BETWEEN FRIENDS <span>03</span>
            </div>
          </div>
          <span className="auth-club-note">
            A private reading corner, just for our club.
          </span>
        </section>
        <section className="auth-card" aria-label="Member access">
          {checking ? (
            <p className="auth-loading" role="status">
              Opening your reading corner…
            </p>
          ) : (
            <LoginForm
              initialError={sessionError}
              onMember={(value) => {
                revision.current++;
                setSessionError("");
                setMember(value);
              }}
            />
          )}
        </section>
      </div>
      <footer className="auth-footer">
        A good book is only the beginning.
      </footer>
    </main>
  );
}
function LoginForm({ onMember, initialError }) {
  const [joining, setJoining] = useState(false),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [inviteCode, setInviteCode] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(initialError);
  useEffect(() => setError(initialError), [initialError]);
  function changeMode(value) {
    setJoining(value);
    setError("");
    setPassword("");
    setInviteCode("");
    setShowPassword(false);
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      onMember(
        await authRequest(joining ? "signup" : "login", {
          name,
          password,
          ...(joining ? { inviteCode } : {}),
        }),
      );
    } catch (error) {
      setError(messageFor(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="auth-tabs" aria-label="Member access options">
        <button
          type="button"
          aria-pressed={!joining}
          disabled={busy}
          onClick={() => changeMode(false)}
        >
          Log in
        </button>
        <button
          type="button"
          aria-pressed={joining}
          disabled={busy}
          onClick={() => changeMode(true)}
        >
          Join the club
        </button>
      </div>
      <p className="eyebrow">
        {joining
          ? "YOUR NEXT CHAPTER STARTS HERE"
          : "THERE’S A PLACE FOR YOU HERE"}
      </p>
      <h2>{joining ? "Pull up a chair." : "Welcome back."}</h2>
      <p className="auth-intro">
        {joining
          ? "Choose your name and bring the code from your club organizer."
          : "Your shelf is waiting. Come on in."}
      </p>
      <form onSubmit={submit}>
        <label className="field">
          Name
          <input
            name="username"
            autoComplete="username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={60}
            required
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Your name or nickname"
            disabled={busy}
            aria-describedby={joining ? "name-help" : undefined}
          />
        </label>
        {joining && (
          <p className="auth-field-hint" id="name-help">
            Korean names welcome. Pick a unique name—you’ll use it to log in.
          </p>
        )}
        <label className="field">
          Password
          <span className="auth-password">
            <input
              name="password"
              aria-label="Password"
              type={showPassword ? "text" : "password"}
              autoComplete={joining ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={joining ? 12 : 1}
              maxLength={128}
              placeholder={joining ? "At least 12 characters" : "Your password"}
              disabled={busy}
              aria-describedby={joining ? "password-help" : undefined}
            />
            <button
              type="button"
              className="icon-button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        {joining && (
          <p className="auth-field-hint" id="password-help">
            A few words together make a memorable password.
          </p>
        )}
        {joining && (
          <label className="field">
            Club code
            <input
              name="inviteCode"
              aria-label="Club code"
              type="password"
              autoComplete="off"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              placeholder="From your club organizer"
              disabled={busy}
            />
            <span className="auth-field-hint">
              You only need this when joining.
            </span>
          </label>
        )}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button primary full" disabled={busy}>
          {busy ? "One moment…" : joining ? "Join the club" : "Log in"}
          {!busy && <ArrowRight size={17} />}
        </button>
      </form>
      <p className="auth-bottom-note">
        {joining ? "Already a member?" : "Have a club code?"}{" "}
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => changeMode(!joining)}
        >
          {joining ? "Log in" : "Join us"}
        </button>
      </p>
    </>
  );
}
