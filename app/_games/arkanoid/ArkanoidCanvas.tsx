"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

declare global {
  interface Window {
    ARKANOID?: {
      pause: () => void;
      resume: () => void;
      restart: () => void;
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

const ArkanoidCanvas = forwardRef<ArkanoidHandle, Props>(
  function ArkanoidCanvas({ onScore, onLives, onLevel, onGameOver }, ref) {
    const cbScore = useRef(onScore);
    const cbLives = useRef(onLives);
    const cbLevel = useRef(onLevel);
    const cbGameOver = useRef(onGameOver);

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

export default ArkanoidCanvas;
