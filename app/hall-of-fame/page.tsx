"use client";

import { useState } from "react";
import { GAMES, seededScores, type ScoreRow } from "../_lib/data";
import { useUser } from "../_lib/user-context";

function gameSeed(id: string) {
  return id.charCodeAt(0) * 31 + id.length;
}

function rankClass(rank: number) {
  if (rank === 1) return " top1";
  if (rank === 2) return " top2";
  if (rank === 3) return " top3";
  return "";
}

export default function HallOfFamePage() {
  const { user } = useUser();
  const [activeId, setActiveId] = useState(GAMES[0].id);

  const scores: ScoreRow[] = seededScores(gameSeed(activeId), 12);
  const top3 = scores.slice(0, 3);

  const podiumOrder = [top3[1], top3[0], top3[2]]; // 2nd · 1st · 3rd
  const podiumMeta = [
    { cls: "silver", num: "2" },
    { cls: "gold",   num: "1" },
    { cls: "bronze", num: "3" },
  ];

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1 className="pixel">SALÓN DE LA FAMA</h1>
        <p>LOS MEJORES JUGADORES DE ARCADE VAULT</p>
      </div>

      {/* game tabs */}
      <div className="hall-tabs">
        {GAMES.map((g) => (
          <button
            key={g.id}
            className={`chip${activeId === g.id ? " active" : ""}`}
            onClick={() => setActiveId(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {/* podium */}
      <div className="podium">
        {podiumOrder.map((row, i) =>
          row ? (
            <div
              key={row.rank}
              className={`podium-slot ${podiumMeta[i].cls}`}
            >
              <div className="rank-num">{podiumMeta[i].num}</div>
              <div className="name">{row.name}</div>
              <div className="score">{row.score.toLocaleString()}</div>
              <div className="date">{row.date}</div>
            </div>
          ) : null
        )}
      </div>

      {/* full table */}
      <div className="hall-table">
        <div className="th">
          <span>RANK</span>
          <span>JUGADOR</span>
          <span>SCORE</span>
          <span>FECHA</span>
        </div>

        {scores.map((row, idx) => (
          <div
            key={row.rank}
            className={`tr${rankClass(row.rank)}`}
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            <span className="rk">#{row.rank}</span>
            <span className="pl">{row.name}</span>
            <span className="sc">{row.score.toLocaleString()}</span>
            <span className="dt">{row.date}</span>
          </div>
        ))}

        {user && (
          <>
            <div className="tr you-label">▸ TU POSICIÓN</div>
            <div className="tr you" style={{ animationDelay: `${scores.length * 30}ms` }}>
              <span className="rk">—</span>
              <span className="pl">{user.name}</span>
              <span className="sc" style={{ color: "var(--yellow)" }}>
                —
              </span>
              <span className="dt">HOY</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
