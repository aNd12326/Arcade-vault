"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import Script from "next/script";

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

    return () => {
      window.removeEventListener("av:score", handleScore);
      window.removeEventListener("av:level", handleLevel);
      window.removeEventListener("av:gameOver", handleGameOver);
      window.TETRIS?.pause();
    };
  }, []);

  return (
    <>
      <canvas
        id="board"
        width={300}
        height={600}
        style={{ display: "block", width: "100%", aspectRatio: "300/600" }}
      />
      <canvas
        id="next-canvas"
        width={120}
        height={120}
        style={{ display: "block" }}
      />
      <Script src="/games/tetris/game.js" strategy="afterInteractive" />
    </>
  );
});

export default TetrisCanvas;
