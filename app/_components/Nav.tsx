"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "../_lib/user-context";

const LINKS = [
  { href: "/", label: "BIBLIOTECA" },
  { href: "/hall-of-fame", label: "SALÓN" },
  { href: "/auth", label: "CUENTA" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useUser();
  const [open, setOpen] = useState(false);

  const handleSignOut = () => {
    signOut();
    router.push("/");
  };

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={() => setOpen(false)}>
          <div className="logo-mark" />
          <span className="logo-text">ARCADE VAULT</span>
        </Link>

        <div className="links">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname === l.href ? "active" : ""}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="spacer" />

        <div className="coin-counter">
          <div className="coin" />
          <span>99 CRÉDITOS</span>
        </div>

        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                fontFamily: "var(--pixel)",
                fontSize: 9,
                color: "var(--cyan)",
                letterSpacing: "0.1em",
              }}
            >
              {user.name}
            </span>
            <button className="btn ghost auth-btn" onClick={handleSignOut}>
              SALIR
            </button>
          </div>
        ) : (
          <Link href="/auth" className="btn auth-btn">
            LOGIN
          </Link>
        )}

        <button
          className="btn ghost hamburger"
          aria-label="Abrir menú"
          onClick={() => setOpen(true)}
        >
          ☰
        </button>
      </nav>

      <div
        className={`av-mobile-backdrop${open ? " open" : ""}`}
        onClick={() => setOpen(false)}
      />
      <div className={`av-mobile-panel${open ? " open" : ""}`}>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 8,
          }}
        >
          <button
            className="btn ghost"
            style={{ fontSize: 12 }}
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>

        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={pathname === l.href ? "active" : ""}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
        ))}

        <div style={{ marginTop: 16 }}>
          {user ? (
            <button
              className="btn ghost"
              style={{ width: "100%" }}
              onClick={() => {
                handleSignOut();
                setOpen(false);
              }}
            >
              SALIR ({user.name})
            </button>
          ) : (
            <Link
              href="/auth"
              className="btn"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => setOpen(false)}
            >
              LOGIN
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
