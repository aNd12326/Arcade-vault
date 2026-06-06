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
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </p>
      </section>

      <div className="av-filters">
        <div className="av-search">
          <span className="ico">⌕</span>
          <input
            type="text"
            placeholder="Buscar un juego por nombre…"
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
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 80, color: "var(--ink-faint)" }}>
            <div className="pixel" style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}>NO HAY RESULTADOS</div>
            <div>Intenta otra búsqueda o categoría.</div>
          </div>
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
            <span>MEJOR PUNTUACIÓN</span>
            <b>{game.best.toLocaleString("es-ES")}</b>
          </div>
          <button
            className={`btn${game.color === "magenta" ? " magenta" : game.color === "yellow" ? " yellow" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/games/${game.id}`);
            }}
          >
            JUGAR
          </button>
        </div>
      </div>
    </div>
  );
}
