"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../_lib/supabase/client";

export default function ResetPage() {
  const router = useRouter();
  const [supabase] = useState(createClient);

  // recovery = the user arrived from the email link and has a recovery session,
  // so we show the "set a new password" form instead of the "send email" form.
  const [recovery, setRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setRecovery(true);
    });
    // Cover the case where the session is already restored before subscribing.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const sendEmail = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  const setNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">RECUPERAR ACCESO</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            {recovery ? "FIJA UNA NUEVA CONTRASEÑA" : "RESTABLECER CONTRASEÑA"}
          </div>
        </div>

        {recovery ? (
          <form onSubmit={setNewPassword}>
            <div className="field">
              <label>Nueva contraseña</label>
              <input
                type="password"
                required
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div
                className="slide-in"
                style={{
                  color: "var(--neon-magenta, #ff4dd2)",
                  fontSize: 12,
                  margin: "4px 0 8px",
                }}
              >
                {error}
              </div>
            )}
            <button
              className="btn lg"
              type="submit"
              disabled={busy}
              style={{ width: "100%", marginTop: 8 }}
            >
              {busy ? "..." : "GUARDAR Y ENTRAR"}
            </button>
          </form>
        ) : sent ? (
          <div
            className="slide-in"
            style={{ textAlign: "center", padding: "12px 0 4px" }}
          >
            <div
              className="neon-cyan"
              style={{ fontSize: 15, letterSpacing: "0.1em", marginBottom: 10 }}
            >
              REVISA TU CORREO
            </div>
            <p
              style={{
                fontSize: 12,
                color: "var(--ink-faint)",
                lineHeight: 1.6,
              }}
            >
              Te enviamos un enlace para restablecer tu contraseña a{" "}
              <strong>{email}</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={sendEmail}>
            <div className="field">
              <label>Correo electrónico</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
              />
            </div>
            {error && (
              <div
                className="slide-in"
                style={{
                  color: "var(--neon-magenta, #ff4dd2)",
                  fontSize: 12,
                  margin: "4px 0 8px",
                }}
              >
                {error}
              </div>
            )}
            <button
              className="btn lg"
              type="submit"
              disabled={busy}
              style={{ width: "100%", marginTop: 8 }}
            >
              {busy ? "..." : "ENVIAR ENLACE"}
            </button>
          </form>
        )}

        <div style={{ marginTop: 14, textAlign: "center" }}>
          <Link
            href="/auth"
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.08em",
            }}
          >
            ← Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
