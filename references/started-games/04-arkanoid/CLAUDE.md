# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Browser Arkanoid/Breakout game — plain HTML, CSS, JavaScript, **zero dependencies**. Canvas 2D API, no build step, no package manager, no framework.

## Current state

| File | Status |
|------|--------|
| `index.html` | Exists — main entry point |
| `style.css` | Exists — layout/styles |
| `game.js` | Exists — full game loop, 3 levels, physics, scoring |
| `assets/spritesheet.js` | Exists — rendering layer |

**Specs implemented:**
- `specs/01-mvp-jugable.md` — Estado: `aprovado` (MVP jugable, canvas 800×600, paddle, bola, 10×6 bloques, 3 vidas, score)
- `specs/02-animacion-destruccion-bloques.md` — Estado: `Implementado` (animación explosión 4 frames al romper bloque)
- `specs/03-sonidos-y-niveles.md` — Estado: `Approved` (pendiente implementar: sonidos + 3 niveles con velocidad creciente)

To run: `xdg-open index.html` or `python3 -m http.server`.

## Spec-driven workflow

Two-phase method via skills in `.agents/skills/` (`skills-lock.json` pins them):

1. `/spec <description>` — Diseña spec sección a sección, hace preguntas primero. **No escribe código.** Guarda en `specs/NN-slug.md` en estado `Draft`. Template: `.agents/skills/spec/template.md`.
2. `/spec-impl <NN-slug>` — Implementa spec **aprobado**. Rechaza si estado no significa "Approved". Crea branch `spec-NN-slug`, implementa **un paso a la vez pausando para review del diff**.

Constraints:
- Estado avanza a `Approved` / `Implemented` **el humano, no el agente**.
- `/spec`: nunca escribir código. `/spec-impl`: implementar exactamente lo que dice el spec — expresar desacuerdos como observaciones, no cambiar silenciosamente.
- Replies en el idioma del prompt inicial (README en español → esperar español).

## Assets and rendering

`assets/spritesheet.js` define globals (cargar via `<script>`, no módulos):

- `loadSpritesheet(cb)` — carga async el PNG, dispara `cb`. Llamar antes de dibujar; todas las fn no-op hasta cargar.
- `drawSprite(ctx, name, x, y, w, h)` — `name` es key de `SPRITES` (`paddle`, `ball`) o `block_<color>` (ej. `block_red`).
- `drawFrame(ctx, frame, x, y, w, h)` — dibuja rect arbitrario `{sx,sy,sw,sh}`; usado para animaciones.
- `EXPLOSION_FRAMES` (por color, 4 frames) + `EXPLOSION_DURATION` (150ms) — animación ruptura bloque.

Colores disponibles: `gray, red, yellow, cyan, magenta, hotpink, green`.  
Sonidos en `assets/sounds/`: `ball-bounce.mp3`, `break-sound.mp3`.

## Code style

2-space indent, spaces inside parens (`fn( arg )`), single quotes. Seguir convenciones de `game.js`.
