"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

declare global {
  interface Window {
    TETRIS?: {
      pause: () => void;
      resume: () => void;
      restart: () => void;
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

const TetrisCanvas = forwardRef<TetrisHandle, Props>(function TetrisCanvas(
  { onScore, onLevel, onGameOver },
  ref
) {
  const cbScore = useRef(onScore);
  const cbLevel = useRef(onLevel);
  const cbGameOver = useRef(onGameOver);

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

    window.addEventListener("av:score", handleScore);
    window.addEventListener("av:level", handleLevel);
    window.addEventListener("av:gameOver", handleGameOver);

    const script = document.createElement("script");
    script.src = "/games/tetris/game.js";
    document.body.appendChild(script);

    return () => {
      window.removeEventListener("av:score", handleScore);
      window.removeEventListener("av:level", handleLevel);
      window.removeEventListener("av:gameOver", handleGameOver);
      window.TETRIS?.pause();
      delete window.TETRIS;
      document.body.removeChild(script);
    };
  }, []);

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
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: 2,
              color: "#555570",
              fontWeight: 600,
            }}
          >
            NEXT
          </span>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: 2,
              color: "#555570",
              fontWeight: 600,
            }}
          >
            CONTROLS
          </span>
          {[
            ["← →", "mover"],
            ["↑ / X", "rotar"],
            ["↓", "bajar"],
            ["Space", "caída"],
            ["P", "pausa"],
          ].map(([key, label]) => (
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
              <kbd
                style={{
                  background: "#22223a",
                  border: "1px solid #3a3a5a",
                  borderRadius: 3,
                  padding: "1px 6px",
                  fontSize: 11,
                  color: "#aaa",
                  whiteSpace: "nowrap",
                }}
              >
                {key}
              </kbd>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default TetrisCanvas;
