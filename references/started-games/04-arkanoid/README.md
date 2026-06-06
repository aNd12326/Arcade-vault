# Arkanoid

Juego de Arkanoid en el navegador — HTML, CSS y JavaScript puro, cero dependencias.

## Cómo jugar

```bash
# Opción A: abrir directo
xdg-open index.html

# Opción B: servidor local
python3 -m http.server
# Luego abrir http://localhost:8000
```

**Controles:**
- Mouse — mueve el paddle
- ← → / A D — mueve el paddle con teclado
- Click / Espacio — lanza la bola, avanza nivel, reinicia

## Estado actual

Juego completo y jugable con:

- Canvas 800×600, sprites via `assets/spritesheet-breakout.png`
- Paddle con física de ángulo por punto de impacto
- **3 niveles** con velocidad y layout de bloques creciente (4→5→6 filas)
- Animación de explosión al romper bloques (4 frames, 150ms)
- Efectos de sonido (rebote, ruptura) con botón mute
- HUD: score, nivel, vidas (iconos)
- Overlays de victoria, derrota y nivel completado
- 10 pts por bloque, score acumulado entre niveles

## Arquitectura

```
index.html          — entrada, carga scripts
style.css           — layout y estilos
game.js             — loop principal, física, colisiones, HUD
assets/
  spritesheet.js    — API de rendering sobre el spritesheet
  spritesheet-breakout.png
  sounds/
    ball-bounce.mp3
    break-sound.mp3
specs/              — specs del flujo spec-driven
```

## Flujo de desarrollo

Repo usa método spec-driven de dos fases:

1. `/spec <descripción>` — diseña spec, no escribe código. Guarda en `specs/NN-slug.md`.
2. `/spec-impl <NN-slug>` — implementa spec aprobado, un paso a la vez con review de diff.

El estado del spec lo avanza el humano (`Draft` → `Approved` → `Implementado`).
