"use client";

import { useState } from "react";
import type { Game, Score } from "../../_lib/supabase/types";

type GameData = { game: Game; scores: Score[] };

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function HallOfFameClient({ data }: { data: GameData[] }) {
  const [tab, setTab] = useState(data[0]?.game.id ?? "");

  const current = data.find((d) => d.game.id === tab);
  const rows = current?.scores ?? [];
  const game = current?.game;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {data.map(({ game: g }) => (
          <button
            key={g.id}
            className={`chip${tab === g.id ? " active" : ""}`}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows.length >= 3 && (
        <div className="podium">
          <div className="podium-slot silver">
            <div className="rank-num">02</div>
            <div className="name">{rows[1].nickname}</div>
            <div className="score">{rows[1].score.toLocaleString("es-ES")}</div>
            <div className="date">{formatDate(rows[1].created_at)}</div>
          </div>
          <div className="podium-slot gold">
            <div
              className="pixel"
              style={{
                fontSize: 9,
                color: "var(--gold)",
                letterSpacing: "0.18em",
              }}
            >
              CAMPEÓN
            </div>
            <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
              01
            </div>
            <div className="name">{rows[0].nickname}</div>
            <div className="score" style={{ fontSize: 20 }}>
              {rows[0].score.toLocaleString("es-ES")}
            </div>
            <div className="date">{formatDate(rows[0].created_at)}</div>
          </div>
          <div className="podium-slot bronze">
            <div className="rank-num">03</div>
            <div className="name">{rows[2].nickname}</div>
            <div className="score">{rows[2].score.toLocaleString("es-ES")}</div>
            <div className="date">{formatDate(rows[2].created_at)}</div>
          </div>
        </div>
      )}

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>

        {rows.length === 0 ? (
          <div
            style={{
              padding: "48px 0",
              textAlign: "center",
              color: "var(--ink-faint)",
              fontSize: 12,
              letterSpacing: "0.08em",
            }}
          >
            {game
              ? `Sin puntuaciones para ${game.title} aún. ¡Juega y sé el primero!`
              : "Sin puntuaciones aún."}
          </div>
        ) : (
          rows.map((r, i) => (
            <div
              key={r.id}
              className={`tr${i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : ""}`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
              <div className="pl">{r.nickname}</div>
              <div className="sc">{r.score.toLocaleString("es-ES")}</div>
              <div className="dt">{formatDate(r.created_at)}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <button className="btn lg" onClick={() => window.history.back()}>
          VOLVER A LA BIBLIOTECA
        </button>
      </div>
    </div>
  );
}
