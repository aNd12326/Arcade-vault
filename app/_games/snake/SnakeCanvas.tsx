"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

declare global {
  interface Window {
    SNAKE?: {
      pause: () => void;
      resume: () => void;
      restart: () => void;
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

const SnakeCanvas = forwardRef<SnakeHandle, Props>(function SnakeCanvas(
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

  return (
    <canvas
      id="av-canvas"
      width={800}
      height={800}
      style={{ display: "block", width: "100%", aspectRatio: "800/800" }}
    />
  );
});

export default SnakeCanvas;
