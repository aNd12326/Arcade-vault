import { lazy } from "react";

export const GAME_ENGINES: Record<string, React.LazyExoticComponent<any>> = {
  asteroids: lazy(() => import("../_games/asteroids/AsteroidsCanvas")),
};
