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
    ARKANOID?: {
      pause: () => void;
      resume: () => void;
      restart: () => void;
      setSkin: (name: string) => void;
      getSkins: () => { key: string; label: string }[];
    };
  }
}

export interface ArkanoidHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
}

interface Props {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
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

const ArkanoidCanvas = forwardRef<ArkanoidHandle, Props>(
  function ArkanoidCanvas({ onScore, onLives, onLevel, onGameOver }, ref) {
    const cbScore = useRef(onScore);
    const cbLives = useRef(onLives);
    const cbLevel = useRef(onLevel);
    const cbGameOver = useRef(onGameOver);

    const [activeSkin, setActiveSkin] = useState(() => {
      try {
        const s = localStorage.getItem("arkanoid-skin");
        return s && SKINS.find((x) => x.key === s) ? s : "clasico";
      } catch {
        return "clasico";
      }
    });

    cbScore.current = onScore;
    cbLives.current = onLives;
    cbLevel.current = onLevel;
    cbGameOver.current = onGameOver;

    useImperativeHandle(ref, () => ({
      pause: () => window.ARKANOID?.pause(),
      resume: () => window.ARKANOID?.resume(),
      restart: () => window.ARKANOID?.restart(),
    }));

    useEffect(() => {
      const handleScore = (e: Event) =>
        cbScore.current((e as CustomEvent<{ score: number }>).detail.score);
      const handleLives = (e: Event) =>
        cbLives.current((e as CustomEvent<{ lives: number }>).detail.lives);
      const handleLevel = (e: Event) =>
        cbLevel.current((e as CustomEvent<{ level: number }>).detail.level);
      const handleGameOver = (e: Event) =>
        cbGameOver.current((e as CustomEvent<{ score: number }>).detail.score);

      window.addEventListener("av:score", handleScore);
      window.addEventListener("av:lives", handleLives);
      window.addEventListener("av:level", handleLevel);
      window.addEventListener("av:gameOver", handleGameOver);

      const spritesheet = document.createElement("script");
      spritesheet.src = "/games/arkanoid/assets/spritesheet.js";

      spritesheet.onload = () => {
        const game = document.createElement("script");
        game.src = "/games/arkanoid/game.js";
        document.body.appendChild(game);
      };

      document.body.appendChild(spritesheet);

      return () => {
        window.removeEventListener("av:score", handleScore);
        window.removeEventListener("av:lives", handleLives);
        window.removeEventListener("av:level", handleLevel);
        window.removeEventListener("av:gameOver", handleGameOver);
        window.ARKANOID?.pause();
        delete window.ARKANOID;
        document.body
          .querySelectorAll(
            'script[src="/games/arkanoid/assets/spritesheet.js"], script[src="/games/arkanoid/game.js"]'
          )
          .forEach((s) => s.remove());
      };
    }, []);

    const handleSkinChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const name = e.target.value;
      setActiveSkin(name);
      localStorage.setItem("arkanoid-skin", name);
      window.ARKANOID?.setSkin(name);
    };

    return (
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          height: "100%",
        }}
      >
        <canvas
          id="av-canvas"
          width={800}
          height={600}
          style={{ display: "block", width: "100%", aspectRatio: "800/600" }}
        />

        {/* Skin selector overlay */}
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
            id="arkanoid-skin-select"
            value={activeSkin}
            onChange={handleSkinChange}
            style={{
              background: "#1a1a25",
              color: "#e0e0e0",
              border: "1px solid #3a3a5a",
              borderRadius: 6,
              padding: "6px 10px",
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
  }
);

export default ArkanoidCanvas;
