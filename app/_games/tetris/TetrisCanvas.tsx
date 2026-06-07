"use client";

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";

declare global {
  interface Window {
    TETRIS?: {
      pause: () => void;
      resume: () => void;
      restart: () => void;
      setSkin: (name: string) => void;
      getSkins: () => { key: string; label: string }[];
    };
  }
}

export interface TetrisHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
}

interface Props {
  onScore: (score: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (score: number) => void;
}

const SKINS = [
  { key: "retro", label: "Retro" },
  { key: "neon", label: "Neón" },
  { key: "pastel", label: "Pastel" },
  { key: "pixel", label: "Pixel art" },
];

const label: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 2,
  color: "#555570",
  fontWeight: 600,
};

const kbd: React.CSSProperties = {
  background: "#22223a",
  border: "1px solid #3a3a5a",
  borderRadius: 3,
  padding: "1px 6px",
  fontSize: 11,
  color: "#aaa",
  whiteSpace: "nowrap",
};

const TetrisCanvas = forwardRef<TetrisHandle, Props>(function TetrisCanvas(
  { onScore, onLevel, onGameOver },
  ref
) {
  const cbScore = useRef(onScore);
  const cbLevel = useRef(onLevel);
  const cbGameOver = useRef(onGameOver);
  const [combo, setCombo] = useState(0);
  const [activeSkin, setActiveSkin] = useState(() => {
    try {
      const s = localStorage.getItem("tetris-skin");
      return s && SKINS.find((x) => x.key === s) ? s : "retro";
    } catch {
      return "retro";
    }
  });

  cbScore.current = onScore;
  cbLevel.current = onLevel;
  cbGameOver.current = onGameOver;

  useImperativeHandle(ref, () => ({
    pause: () => window.TETRIS?.pause(),
    resume: () => window.TETRIS?.resume(),
    restart: () => window.TETRIS?.restart(),
  }));

  useEffect(() => {
    const handleScore = (e: Event) =>
      cbScore.current((e as CustomEvent<{ score: number }>).detail.score);
    const handleLevel = (e: Event) =>
      cbLevel.current((e as CustomEvent<{ level: number }>).detail.level);
    const handleGameOver = (e: Event) =>
      cbGameOver.current((e as CustomEvent<{ score: number }>).detail.score);
    const handleCombo = (e: Event) =>
      setCombo((e as CustomEvent<{ combo: number }>).detail.combo);

    window.addEventListener("av:score", handleScore);
    window.addEventListener("av:level", handleLevel);
    window.addEventListener("av:gameOver", handleGameOver);
    window.addEventListener("av:combo", handleCombo);

    const script = document.createElement("script");
    script.src = "/games/tetris/game.js";
    document.body.appendChild(script);

    return () => {
      window.removeEventListener("av:score", handleScore);
      window.removeEventListener("av:level", handleLevel);
      window.removeEventListener("av:gameOver", handleGameOver);
      window.removeEventListener("av:combo", handleCombo);
      window.TETRIS?.pause();
      delete window.TETRIS;
      document.body.removeChild(script);
    };
  }, []);

  const handleSkinChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setActiveSkin(name);
    window.TETRIS?.setSkin(name);
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: 20,
        padding: 16,
      }}
    >
      <canvas
        id="board"
        width={300}
        height={600}
        style={{
          display: "block",
          height: "100%",
          width: "auto",
          flexShrink: 0,
          border: "1px solid #2a2a3a",
          borderRadius: 4,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          paddingTop: 4,
          flexShrink: 0,
          width: 140,
        }}
      >
        {/* NEXT piece */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={label}>NEXT</span>
          <canvas
            id="next-canvas"
            width={120}
            height={120}
            style={{
              display: "block",
              border: "1px solid #2a2a3a",
              borderRadius: 4,
              background: "#1a1a25",
            }}
          />
        </div>

        {/* COMBO */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={label}>COMBO</span>
          <span
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 22,
              fontWeight: 700,
              color: combo > 1 ? "#ffd54f" : "#555570",
            }}
          >
            {combo > 1 ? `x${combo}` : "—"}
          </span>
        </div>

        {/* SKIN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={label}>SKIN</span>
          <select
            id="skin-select"
            value={activeSkin}
            onChange={handleSkinChange}
            style={{
              background: "#1a1a25",
              color: "#e0e0e0",
              border: "1px solid #3a3a5a",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 1,
              cursor: "pointer",
              width: "100%",
            }}
          >
            {SKINS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* CONTROLS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={label}>CONTROLS</span>
          {[
            ["← →", "mover"],
            ["↑ / X", "rotar"],
            ["↓", "bajar"],
            ["Space", "caída"],
          ].map(([key, lbl]) => (
            <div
              key={key}
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                fontSize: 11,
                color: "#888",
              }}
            >
              <span style={kbd}>{key}</span>
              {lbl}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default TetrisCanvas;
