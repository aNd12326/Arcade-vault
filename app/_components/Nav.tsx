"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "../_lib/user-context";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useUser();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/games") return pathname.startsWith("/games");
    return pathname === href;
  };

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={() => setOpen(false)}>
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>

        <div className="links">
          <Link href="/" className={isActive("/") ? "active" : ""}>
            INICIO
          </Link>
          <Link href="/games" className={isActive("/games") ? "active" : ""}>
            GAMES
          </Link>
          <Link href="/about" className={isActive("/about") ? "active" : ""}>
            ABOUT
          </Link>
          <Link
            href="/hall-of-fame"
            className={isActive("/hall-of-fame") ? "active" : ""}
          >
            SALÓN
          </Link>
        </div>

        <div className="spacer" />

        <div className="coin-counter">
          <div className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>

        {user ? (
          <div className="account-wrap">
            <div className="acct-id">
              <div className="acct-avatar">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt={user.name} />
                ) : (
                  <span>{initials(user.name)}</span>
                )}
              </div>
              <span className="acct-id-name">{user.name}</span>
            </div>
            <button className="signout-inline" onClick={handleSignOut}>
              Cerrar sesión
            </button>
          </div>
        ) : (
          <Link href="/auth" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}

        <button
          className="btn ghost hamburger"
          aria-label="Menú"
          onClick={() => setOpen(true)}
        >
          ≡
        </button>
      </nav>

      <div
        className={`av-mobile-backdrop${open ? " open" : ""}`}
        onClick={() => setOpen(false)}
      />
      <aside className={`av-mobile-panel${open ? " open" : ""}`}>
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENÚ
        </div>
        <Link
          href="/"
          className={isActive("/") ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          INICIO
        </Link>
        <Link
          href="/games"
          className={isActive("/games") ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          GAMES
        </Link>
        <Link
          href="/about"
          className={isActive("/about") ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          ABOUT
        </Link>
        <Link
          href="/hall-of-fame"
          className={isActive("/hall-of-fame") ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          SALÓN
        </Link>
        {user ? (
          <button
            className="mobile-link"
            style={{
              background: "none",
              border: "none",
              textAlign: "left",
              cursor: "pointer",
              font: "inherit",
              color: "inherit",
              padding: 0,
            }}
            onClick={handleSignOut}
          >
            Cerrar sesión ({user.name})
          </button>
        ) : (
          <Link
            href="/auth"
            className={isActive("/auth") ? "active" : ""}
            onClick={() => setOpen(false)}
          >
            Iniciar Sesión
          </Link>
        )}
        <div style={{ flex: 1 }} />
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
          }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
