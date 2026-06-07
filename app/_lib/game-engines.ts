import { lazy } from "react";
import type {
  ForwardRefExoticComponent,
  RefAttributes,
  LazyExoticComponent,
} from "react";
import type { AsteroidsHandle } from "../_games/asteroids/AsteroidsCanvas";

export interface GameCanvasProps {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (score: number) => void;
}

export type GameCanvasRef = AsteroidsHandle;

type GameCanvasComponent = ForwardRefExoticComponent<
  GameCanvasProps & RefAttributes<GameCanvasRef>
>;

export const GAME_ENGINES: Partial<
  Record<string, LazyExoticComponent<GameCanvasComponent>>
> = {
  asteroids: lazy(() => import("../_games/asteroids/AsteroidsCanvas")),
  tetris: lazy(() => import("../_games/tetris/TetrisCanvas")),
  arkanoid: lazy(() => import("../_games/arkanoid/ArkanoidCanvas")),
};
