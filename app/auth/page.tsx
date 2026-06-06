"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../_lib/user-context";

type Tab = "login" | "registro";

export default function AuthPage() {
  const router = useRouter();
  const { login } = useUser();

  const [tab, setTab] = useState<Tab>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    login(name.trim().toUpperCase());
    router.push("/");
  };

  const handleGuest = () => {
    router.push("/");
  };

  return (
    <div className="av-auth-wrap">
      <div className="auth-card fade-in">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="pixel">ARCADE VAULT</h2>
          <p
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.14em",
              marginTop: 6,
            }}
          >
            IDENTIFICATE PARA GUARDAR SCORES
          </p>
        </div>

        <div className="auth-tabs">
          <button
            className={tab === "login" ? "on" : ""}
            onClick={() => setTab("login")}
          >
            LOGIN
          </button>
          <button
            className={tab === "registro" ? "on" : ""}
            onClick={() => setTab("registro")}
          >
            REGISTRO
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>NOMBRE DE JUGADOR</label>
            <input
              type="text"
              placeholder="XARK_99"
              value={name}
              maxLength={12}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              autoFocus
            />
          </div>

          {tab === "registro" && (
            <div className="field slide-in">
              <label>EMAIL</label>
              <input
                type="email"
                placeholder="player@arcade.vault"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          <button
            className="btn yellow lg"
            type="submit"
            style={{ width: "100%", marginTop: 8 }}
            disabled={!name.trim()}
          >
            {tab === "login" ? "▶ ENTRAR" : "▶ CREAR CUENTA"}
          </button>
        </form>

        <div className="auth-divider">O CONTINÚA SIN CUENTA</div>

        <button
          className="btn ghost"
          style={{ width: "100%" }}
          onClick={handleGuest}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">ACCESO SOCIAL</div>

        <div className="social">
          <button className="btn ghost">G GOOGLE</button>
          <button className="btn ghost">⬡ DISCORD</button>
        </div>
      </div>
    </div>
  );
}
