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
    SNAKE?: {
      pause: () => void;
      resume: () => void;
      restart: () => void;
      setSkin: (name: string) => void;
      getSkins: () => { key: string; label: string }[];
    };
  }
}

export interface SnakeHandle {
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
  { key: "clasico", label: "Clásico" },
  { key: "retro", label: "Retro" },
  { key: "neon", label: "Neón" },
];

const label: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 2,
  color: "#555570",
  fontWeight: 600,
};

const SnakeCanvas = forwardRef<SnakeHandle, Props>(function SnakeCanvas(
  { onScore, onLevel, onGameOver },
  ref
) {
  const cbScore = useRef(onScore);
  const cbLevel = useRef(onLevel);
  const cbGameOver = useRef(onGameOver);

  const [activeSkin, setActiveSkin] = useState(() => {
    try {
      const s = localStorage.getItem("snake-skin");
      return s && SKINS.find((x) => x.key === s) ? s : "clasico";
    } catch {
      return "clasico";
    }
  });

  cbScore.current = onScore;
  cbLevel.current = onLevel;
  cbGameOver.current = onGameOver;

  useImperativeHandle(ref, () => ({
    pause: () => window.SNAKE?.pause(),
    resume: () => window.SNAKE?.resume(),
    restart: () => window.SNAKE?.restart(),
  }));

  useEffect(() => {
    const handleScore = (e: Event) =>
      cbScore.current((e as CustomEvent<{ score: number }>).detail.score);
    const handleLevel = (e: Event) =>
      cbLevel.current((e as CustomEvent<{ level: number }>).detail.level);
    const handleGameOver = (e: Event) =>
      cbGameOver.current((e as CustomEvent<{ score: number }>).detail.score);

    window.addEventListener("av:score", handleScore);
    window.addEventListener("av:level", handleLevel);
    window.addEventListener("av:gameOver", handleGameOver);

    const sprites = document.createElement("script");
    sprites.src = "/games/snake/assets/sprites.js";

    sprites.onload = () => {
      const game = document.createElement("script");
      game.src = "/games/snake/game.js";
      document.body.appendChild(game);
    };

    document.body.appendChild(sprites);

    return () => {
      window.removeEventListener("av:score", handleScore);
      window.removeEventListener("av:level", handleLevel);
      window.removeEventListener("av:gameOver", handleGameOver);
      window.SNAKE?.pause();
      delete window.SNAKE;
      document.body
        .querySelectorAll(
          'script[src="/games/snake/assets/sprites.js"], script[src="/games/snake/game.js"]'
        )
        .forEach((s) => s.remove());
    };
  }, []);

  const handleSkinChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setActiveSkin(name);
    localStorage.setItem("snake-skin", name);
    window.SNAKE?.setSkin(name);
  };

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 8,
        height: "100%",
      }}
    >
      <canvas
        id="av-canvas"
        width={800}
        height={800}
        style={{
          display: "block",
          height: "100%",
          width: "auto",
          aspectRatio: "800/800",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 8,
          background: "rgba(10,10,15,0.7)",
          backdropFilter: "blur(2px)",
        }}
      >
        <span style={label}>SKIN</span>
        <select
          id="snake-skin-select"
          value={activeSkin}
          onChange={handleSkinChange}
          style={{
            background: "#1a1a25",
            color: "#e0e0e0",
            border: "1px solid #3a3a5a",
            borderRadius: 6,
            padding: "5px 8px",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            cursor: "pointer",
          }}
        >
          {SKINS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
});

export default SnakeCanvas;
