"use client";

import { useRouter } from "next/navigation";
import type { Game, ScoreRow } from "../../_lib/data";

function rankClass(rank: number) {
  if (rank === 1) return " top1";
  if (rank === 2) return " top2";
  if (rank === 3) return " top3";
  return "";
}

export default function GameDetailClient({
  game,
  scores,
}: {
  game: Game;
  scores: ScoreRow[];
}) {
  const router = useRouter();

  return (
    <div className="av-detail fade-in">
      {/* left column: cover + info */}
      <div>
        <div className="detail-cover">
          <div className={`cover-bg ${game.cover}`} style={{ position: "absolute", inset: 0 }} />
        </div>

        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>

          <h2 className="neon-cyan">{game.title}</h2>

          <p>{game.long}</p>

          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{game.plays}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div className="v" style={{ color: "var(--magenta)", textShadow: "0 0 6px rgba(255,0,110,0.5)" }}>
                {game.best.toLocaleString("es-ES")}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div className="v" style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}>
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>

          <div className="detail-actions">
            <button
              className="btn xl pulse"
              onClick={() => router.push(`/games/${game.id}/play`)}
            >
              ▶ JUGAR AHORA
            </button>
            <button className="btn ghost lg" onClick={() => router.back()}>
              VOLVER AL VAULT
            </button>
          </div>
        </div>
      </div>

      {/* right column: leaderboard */}
      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {scores.map((row, i) => (
            <div key={row.rank} className={`lb-row${rankClass(row.rank)}`}>
              <div className="rk">#{String(row.rank).padStart(2, "0")}</div>
              <div className="pl">
                {row.name}
                <div style={{ fontSize: 10, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>
                  {row.date}
                </div>
              </div>
              <div className="sc">{row.score.toLocaleString("es-ES")}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
