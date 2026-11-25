"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, HeartHandshake, LockKeyhole, ShieldCheck } from "lucide-react";
import { adminFetch } from "@/lib/admin/client";

type SetupState = {
  setupRequired: boolean;
  sessionConfigured: boolean;
  bootstrapConfigured: boolean;
  demoMode?: boolean;
  demoEmail?: string;
  demoPassword?: string;
};

export default function LoginScreen() {
  const router = useRouter();
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    adminFetch<SetupState>("/api/admin/init")
      .then(setSetup)
      .catch((problem: Error) => setError(problem.message))
      .finally(() => setInitializing(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!setup?.sessionConfigured) {
      setError("Administrator sessions are not configured on this server.");
      return;
    }
    if (setup.setupRequired && password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      if (setup.setupRequired) {
        await adminFetch("/api/admin/bootstrap", {
          method: "POST",
          body: JSON.stringify({ name, email, password, token }),
        });
      } else {
        await adminFetch("/api/admin/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
      }
      router.replace("/");
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const createAdmin = Boolean(setup?.setupRequired);
  const ready = !initializing && Boolean(setup?.sessionConfigured) && (!createAdmin || Boolean(setup?.bootstrapConfigured));

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <div className="brand-mark"><HeartHandshake size={21} strokeWidth={1.8} /></div>
          <div><div className="brand-name">AI Food Bridge</div><div className="brand-caption">Care, shared thoughtfully</div></div>
        </div>
        <div className="login-quote">
          <div className="eyebrow" style={{ color: "#f0ccd3" }}>A better way to serve</div>
          <h1>Good food. Kind hands. A little more care.</h1>
          <p>A quiet workspace for the people coordinating donations, community partners, volunteers, and animal care.</p>
        </div>
        <div className="login-footer">Administrator access · Private and audited</div>
      </section>

      <section className="login-form-side">
        <div className="login-card">
          <div className="eyebrow">Administrator access</div>
          <h2>{initializing ? "Checking access…" : createAdmin ? "Set up your admin" : "Welcome back"}</h2>
          <p>{createAdmin ? "Create the first administrator. This one-time setup needs the server’s bootstrap token." : "Sign in with your administrator account to continue."}</p>
          {error && <div className="error-banner" role="alert">{error}</div>}
          {!initializing && !setup?.sessionConfigured && (
            <div className="notice">A server administrator must set a random <strong>ADMIN_SESSION_SECRET</strong> of at least 32 characters before the console can accept sign-ins.</div>
          )}
          {!initializing && createAdmin && !setup?.bootstrapConfigured && (
            <div className="notice" style={{ marginTop: 10 }}>First-admin creation is disabled until <strong>ADMIN_BOOTSTRAP_TOKEN</strong> is configured on the server.</div>
          )}
          {!initializing && setup?.demoMode && (
            <div className="notice" style={{ marginTop: 10 }}>
              Frontend demo login: <strong>{setup.demoEmail}</strong> / <strong>{setup.demoPassword}</strong>
            </div>
          )}
          <form className="login-fields" onSubmit={submit} style={{ marginTop: 18 }}>
            {createAdmin && (
              <label>
                <span className="field-label">Your name</span>
                <input className="input-control" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
              </label>
            )}
            <label>
              <span className="field-label">Email address</span>
              <input className="input-control" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            {createAdmin && (
              <label>
                <span className="field-label">One-time setup token</span>
                <input className="input-control" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} required />
              </label>
            )}
            <label>
              <span className="field-label">Password</span>
              <input className="input-control" type="password" autoComplete={createAdmin ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={createAdmin ? 12 : 1} maxLength={256} />
              {createAdmin && <span className="field-hint">At least 12 characters. The password is stored as a scrypt hash.</span>}
            </label>
            {createAdmin && (
              <label>
                <span className="field-label">Confirm password</span>
                <input className="input-control" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={12} maxLength={256} />
              </label>
            )}
            <button className="btn btn-primary login-submit" type="submit" disabled={!ready || loading}>
              {loading ? "Please wait…" : createAdmin ? "Create administrator" : "Sign in"}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>
          <div className="login-security"><ShieldCheck size={16} /><span>Passwords are never sent to the browser’s data API. Sessions are signed, HTTP-only, and expire after eight hours.</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 13, color: "#969188", fontSize: 9.5 }}><LockKeyhole size={12} /> Protected administrator workspace</div>
        </div>
      </section>
    </main>
  );
}
