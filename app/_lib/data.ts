export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
};

export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string;
};

export const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;

export const PLAYERS = [
  "XARK", "NEON_V", "BLITZ", "PRISM", "DARKSTAR",
  "RAVEN", "VOLT", "CIPHER", "SPECTER", "FUSE",
  "ORBIT", "GLITCH", "NOVA", "PHASE", "AXIOM",
  "PIXEL", "SURGE", "ECHO", "DRIFT", "FLARE",
];

export const GAMES: Game[] = [
  {
    id: "bloque-buster",
    title: "BLOQUE BUSTER",
    short: "Rompe todos los bloques antes de que el tiempo se acabe.",
    long: "Clásico de bloques con paleta y bola. Ocho niveles de dificultad creciente, power-ups y bloques indestructibles. El tiempo corre — cada segundo cuenta.",
    cat: "ARCADE",
    cover: "cover-bricks",
    color: "cyan",
    best: 184200,
    plays: "18.2K",
  },
  {
    id: "tetro-caos",
    title: "TETRO CAOS",
    short: "Piezas cayendo a velocidad supersónica.",
    long: "Versión extrema del rompecabezas de piezas geométricas. Modo caos activa bloques fantasma, piezas espejo y líneas bomba que hacen explotar todo a su alrededor.",
    cat: "PUZZLE",
    cover: "cover-tetro",
    color: "magenta",
    best: 320500,
    plays: "24.7K",
  },
  {
    id: "serpiente-nx",
    title: "SERPIENTE NX",
    short: "La serpiente clásica con giro neón.",
    long: "Come píxeles, crece, no te choques. Pero ahora hay portales, obstáculos giratorios y manzanas que invierten los controles. ¿Cuánto aguantas?",
    cat: "ARCADE",
    cover: "cover-snake",
    color: "green",
    best: 97400,
    plays: "12.4K",
  },
  {
    id: "glot-runner",
    title: "GLOT RUNNER",
    short: "Esquiva obstáculos a velocidad de luz.",
    long: "Runner infinito donde el personaje avanza solo. Salta, agáchate y gira para evitar paredes de píxeles que se generan de forma procedural. Cada run es única.",
    cat: "ARCADE",
    cover: "cover-glot",
    color: "yellow",
    best: 58900,
    plays: "9.8K",
  },
  {
    id: "invasores-z",
    title: "INVASORES Z",
    short: "Defiende la Tierra de las hordas alienígenas.",
    long: "Inspirado en el shooter espacial clásico. Oleadas de enemigos con patrones cada vez más complejos, escudos que se degradan y un boss final que lo cambia todo.",
    cat: "SHOOTER",
    cover: "cover-invaders",
    color: "green",
    best: 412800,
    plays: "31.1K",
  },
  {
    id: "campo-de-rocas",
    title: "CAMPO DE ROCAS",
    short: "Navega el campo de asteroides sin ser destruido.",
    long: "Tu nave está atrapada en un cinturón de asteroides. Dispara, esquiva y recoge cristales de energía para activar el hiperimpulso. Sobrevive el mayor tiempo posible.",
    cat: "SHOOTER",
    cover: "cover-rocas",
    color: "cyan",
    best: 267300,
    plays: "15.6K",
  },
  {
    id: "caida",
    title: "CAÍDA",
    short: "Plataformas que desaparecen bajo tus pies.",
    long: "Baja por un pozo infinito saltando entre plataformas que se disuelven. El ritmo aumenta con cada sección. Una caída al vacío y todo termina.",
    cat: "ARCADE",
    cover: "cover-rana",
    color: "green",
    best: 143600,
    plays: "20.3K",
  },
  {
    id: "duelo-pixel",
    title: "DUELO PIXEL",
    short: "Enfréntate al oponente en duelo de reacción.",
    long: "Dos jugadores, una pantalla, un ganador. Pulsa en el momento exacto cuando la señal aparezca. El más rápido vive. Modos torneo y práctica contra la IA.",
    cat: "VERSUS",
    cover: "cover-duelo",
    color: "magenta",
    best: 9999,
    plays: "7.2K",
  },
];

export function seededScores(seed: number, count: number): ScoreRow[] {
  const rows: ScoreRow[] = [];
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return Math.abs(s);
  };
  const baseScore = 50000 + (seed % 300000);
  for (let i = 0; i < count; i++) {
    const score = Math.max(1000, baseScore - i * (next() % 4000 + 1500));
    const playerIdx = next() % PLAYERS.length;
    const day = (next() % 28) + 1;
    const month = (next() % 6) + 1;
    rows.push({
      rank: i + 1,
      name: PLAYERS[playerIdx],
      score,
      date: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/2026`,
    });
  }
  return rows;
}
