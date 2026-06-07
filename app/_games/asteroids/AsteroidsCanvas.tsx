"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

declare global {
  interface Window {
    ASTEROIDS?: {
      pause: () => void;
      resume: () => void;
      restart: () => void;
    };
  }
}

export interface AsteroidsHandle {
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

const AsteroidsCanvas = forwardRef<AsteroidsHandle, Props>(
  function AsteroidsCanvas({ onScore, onLives, onLevel, onGameOver }, ref) {
    const cbScore = useRef(onScore);
    const cbLives = useRef(onLives);
    const cbLevel = useRef(onLevel);
    const cbGameOver = useRef(onGameOver);

    cbScore.current = onScore;
    cbLives.current = onLives;
    cbLevel.current = onLevel;
    cbGameOver.current = onGameOver;

    useImperativeHandle(ref, () => ({
      pause: () => window.ASTEROIDS?.pause(),
      resume: () => window.ASTEROIDS?.resume(),
      restart: () => window.ASTEROIDS?.restart(),
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

      const script = document.createElement("script");
      script.src = "/games/asteroids/game.js";
      document.body.appendChild(script);

      return () => {
        window.removeEventListener("av:score", handleScore);
        window.removeEventListener("av:lives", handleLives);
        window.removeEventListener("av:level", handleLevel);
        window.removeEventListener("av:gameOver", handleGameOver);
        window.ASTEROIDS?.pause();
        delete window.ASTEROIDS;
        document.body.removeChild(script);
      };
    }, []);

    return (
      <canvas
        id="av-canvas"
        width={800}
        height={600}
        style={{ display: "block", width: "100%", aspectRatio: "800/600" }}
      />
    );
  }
);

export default AsteroidsCanvas;
