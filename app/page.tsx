"use client";

import { useState, useRef, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { GAMES, CATS, type Game } from "./_lib/data";

export default function LibraryPage() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("TODOS");

  const filtered = GAMES.filter((g) => {
    const matchCat = cat === "TODOS" || g.cat === cat;
    const matchQ = g.title.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  return (
    <>
      <section className="av-hero">
        <h1 className="pixel flicker">ARCADE VAULT</h1>
        <p className="sub">
          INSERT COIN &mdash; <span className="blink">▮</span> SELECT GAME
        </p>
      </section>

      <div className="av-filters">
        <div className="av-search">
          <span className="ico">▶</span>
          <input
            type="text"
            placeholder="BUSCAR JUEGO..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="av-chips">
          {CATS.map((c) => (
            <button
              key={c}
              className={`chip${cat === c ? " active" : ""}`}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {filtered.length === 0 ? (
          <p
            style={{
              fontFamily: "var(--pixel)",
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.14em",
              gridColumn: "1/-1",
              textAlign: "center",
              padding: "48px 0",
            }}
          >
            NO RESULTS FOUND
          </p>
        ) : (
          filtered.map((g) => <GameCard key={g.id} game={g} />)
        )}
      </div>
    </>
  );
}

function GameCard({ game }: { game: Game }) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(600px) rotateY(${x * 12}deg) rotateX(${-y * 10}deg) translateY(-6px)`;
  };

  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = "";
  };

  const colorMap: Record<string, string> = {
    cyan: "var(--cyan)",
    magenta: "var(--magenta)",
    yellow: "var(--yellow)",
    green: "var(--green)",
  };
  const accent = colorMap[game.color] ?? "var(--cyan)";

  return (
    <div
      ref={cardRef}
      className="card fade-in"
      onClick={() => router.push(`/games/${game.id}`)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <div className="cover">
        <div className={`cover-bg ${game.cover}`} />
        <span className="label">{game.cat}</span>
      </div>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <div className="score-badge">
            <span>MEJOR</span>
            <b>{game.best.toLocaleString()}</b>
          </div>
          <div className="score-badge" style={{ textAlign: "right" }}>
            <span>PARTIDAS</span>
            <b style={{ color: accent }}>{game.plays}</b>
          </div>
          <button
            className="btn"
            style={{ borderColor: accent, fontSize: 9, padding: "8px 14px" }}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/games/${game.id}`);
            }}
          >
            VER
          </button>
        </div>
      </div>
    </div>
  );
}
