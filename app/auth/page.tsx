"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "../_lib/user-context";
import { createClient } from "../_lib/supabase/client";
import { isStrongPassword, PASSWORD_HINT } from "../_lib/password";

type Tab = "in" | "up";

export default function AuthPage() {
  const router = useRouter();
  const { user, login } = useUser();
  const [supabase] = useState(createClient);

  // Already signed in with a real account → no reason to see login/registro.
  useEffect(() => {
    if (user && !user.isGuest) router.replace("/");
  }, [user, router]);

  const [tab, setTab] = useState<Tab>("in");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [busy, setBusy] = useState(false);

  const switchTab = (t: Tab) => {
    setTab(t);
    setError(null);
    setCheckEmail(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (tab === "in") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });
        if (error) {
          setError("Credenciales incorrectas.");
          return;
        }
        router.push("/");
        router.refresh();
        return;
      }

      // Registro
      if (!isStrongPassword(pass)) {
        setError(PASSWORD_HINT);
        return;
      }

      const nick = nickname.trim();
      if (nick.length < 1 || nick.length > 20) {
        setError("El nickname debe tener entre 1 y 20 caracteres.");
        return;
      }

      // Signup vía ruta propia → rate-limit por IP en proxy.ts (SPEC 14).
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: pass,
          nickname: nick,
          origin: window.location.origin,
        }),
      });
      if (res.status === 429) {
        setError("Demasiados intentos. Inténtalo más tarde.");
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo crear la cuenta.");
        return;
      }
      setCheckEmail(true);
    } finally {
      setBusy(false);
    }
  };

  const guest = () => {
    login((nickname || "PLAYER1").toUpperCase().slice(0, 10));
    router.push("/");
  };

  const oauth = async (provider: "google" | "github") => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={tab === "in" ? "on" : ""}
            onClick={() => switchTab("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            className={tab === "up" ? "on" : ""}
            onClick={() => switchTab("up")}
          >
            CREAR CUENTA
          </button>
        </div>

        {checkEmail ? (
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
              Te enviamos un enlace de confirmación a <strong>{email}</strong>.
              Ábrelo para activar tu cuenta y entrar al Vault.
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            {tab === "up" && (
              <div className="field slide-in">
                <label>Nickname</label>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="px_kai"
                  maxLength={20}
                />
              </div>
            )}

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

            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                required
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
              />
              {tab === "up" && (
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: "var(--ink-faint)",
                    letterSpacing: "0.04em",
                    marginTop: 6,
                    lineHeight: 1.5,
                  }}
                >
                  {PASSWORD_HINT}
                </div>
              )}
            </div>

            {tab === "in" && (
              <div
                style={{ textAlign: "right", marginTop: -4, marginBottom: 8 }}
              >
                <Link
                  href="/auth/reset"
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-faint)",
                    letterSpacing: "0.08em",
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            )}

            {error && (
              <div
                className="slide-in"
                style={{
                  color: "var(--neon-magenta, #ff4dd2)",
                  fontSize: 12,
                  margin: "4px 0 8px",
                  letterSpacing: "0.04em",
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
              {busy
                ? "..."
                : tab === "in"
                  ? "ENTRAR AL VAULT"
                  : "CREAR Y JUGAR"}
            </button>
          </form>
        )}

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={guest}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>

        <div className="social">
          <button
            className="btn ghost"
            type="button"
            onClick={() => oauth("google")}
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => oauth("github")}
          >
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
