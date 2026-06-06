"use client";

import { useRouter } from "next/navigation";
import type { Game, ScoreRow } from "../../_lib/data";

const COLOR_MAP: Record<string, string> = {
  cyan: "var(--cyan)",
  magenta: "var(--magenta)",
  yellow: "var(--yellow)",
  green: "var(--green)",
};

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
  const accent = COLOR_MAP[game.color] ?? "var(--cyan)";

  return (
    <div className="av-detail fade-in">
      {/* left column */}
      <div>
        <div className="detail-cover">
          <div className={`cover-bg ${game.cover}`} style={{ position: "absolute", inset: 0 }} />
        </div>

        <div className="leaderboard" style={{ marginTop: 24 }}>
          <h3>▸ TOP SCORES</h3>
          {scores.map((row) => (
            <div key={row.rank} className={`lb-row${rankClass(row.rank)}`}>
              <span className="rk">#{row.rank}</span>
              <span className="pl">{row.name}</span>
              <span className="sc">{row.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* right column */}
      <div className="detail-info">
        <h2
          className="pixel"
          style={{ color: accent, textShadow: `0 0 10px ${accent}` }}
        >
          {game.title}
        </h2>

        <div className="detail-tags">
          <span>{game.cat}</span>
          <span>SINGLE PLAYER</span>
          <span>ARCADE MODE</span>
        </div>

        <p>{game.long}</p>

        <div className="stat-strip">
          <div>
            <div className="l">MEJOR SCORE</div>
            <div className="v">{game.best.toLocaleString()}</div>
          </div>
          <div>
            <div className="l">PARTIDAS</div>
            <div className="v">{game.plays}</div>
          </div>
          <div>
            <div className="l">JUGADORES</div>
            <div className="v" style={{ color: accent }}>{scores.length}</div>
          </div>
        </div>

        <div className="detail-actions">
          <button
            className="btn lg pulse"
            style={{ borderColor: accent }}
            onClick={() => router.push(`/games/${game.id}/play`)}
          >
            ▶ JUGAR AHORA
          </button>
          <button
            className="btn ghost"
            onClick={() => router.back()}
          >
            ← VOLVER
          </button>
        </div>
      </div>
    </div>
  );
}
