# Spec 01 — MVP jugable de Arkanoid

- **Estado:** aprovado
- **Dependencias:** ninguna (usa `assets/spritesheet.js` y `assets/sounds/` ya existentes)
- **Fecha:** 2026-06-05
- **Objetivo (una frase):** Construir un Arkanoid jugable de una sola pantalla (canvas 800×600) con paddle controlable por mouse y teclado, bola con física predecible, una rejilla de 10×6 bloques rompibles, 3 vidas, puntuación de 10 pts por bloque y overlays de victoria/derrota.

## Alcance

**Incluido:**
- Canvas único 800×600, sin build ni dependencias.
- Paddle controlable simultáneamente por **mouse** (sigue el cursor en X) y **teclado** (flechas / A-D).
- Bola con física predecible: rebote en paredes (reflejo) y rebote en paddle estilo Arkanoid (el punto de impacto define el ángulo horizontal).
- Bola arranca **pegada** al paddle; se lanza con **click o espacio**.
- Rejilla fija de **10 columnas × 6 filas** de bloques, coloreados por fila usando los sprites existentes.
- Todos los bloques se rompen de **un golpe**; al romper, el bloque **desaparece** (sin animación).
- **3 vidas.** Perder la bola por abajo descuenta una vida y re-pega la bola al paddle.
- Puntuación: **+10 por bloque** roto.
- **Overlays** superpuestos sobre el canvas: victoria (todos los bloques rotos) y derrota (0 vidas), con opción de reiniciar.

**NO incluido (diferido a otros specs):**
- Múltiples niveles / progresión.
- Bloques duros (multi-golpe), power-ups, items que caen.
- Animación de explosión al romper bloque (`EXPLOSION_FRAMES`).
- Audio / sonido (`ball-bounce.mp3`, `break-sound.mp3`).
- Persistencia: highscores, guardado entre sesiones.
- Menú de inicio, pantallas separadas, dificultad configurable.
- Responsive / escalado del canvas, soporte táctil/móvil.
- Marcador online, multijugador.

## Modelo de datos

Estructuras en memoria (sin persistencia). Nombres concretos para `game.js`:

Estado global `game`:

```js
const game = {
  state: 'ready',   // 'ready' | 'playing' | 'won' | 'lost'
  score: 0,
  lives: 3,
};
```

Paddle:

```js
const paddle = {
  x, y,            // y fijo cerca del fondo
  w: 162, h: 14,   // tamaño sprite paddle
  speed,           // px/frame para control por teclado
};
```

Bola:

```js
const ball = {
  x, y,
  w: 16, h: 16,
  vx, vy,          // velocidad px/frame
  stuck: true,     // pegada al paddle hasta lanzar
};
```

Bloques — array generado desde rejilla 10×6:

```js
// colorByRow: 6 colores, uno por fila
const blocks = [
  {
    x, y,
    w: 32, h: 16,   // tamaño sprite bloque
    color: 'red',   // clave de SPRITES.blocks
    alive: true,    // al romper -> false (desaparece, sin animación)
  },
  // ... 60 bloques
];
```

**Notas:**
- Sin estructura de explosiones: romper bloque = `alive = false` (desaparece).
- Tamaños de sprite desde `SPRITES` en `assets/spritesheet.js`.
- `colorByRow` mapea 6 filas → 6 colores; orden a fijar en implementación.
- Espaciado de rejilla calculado para encajar 10 columnas en 800px.

## Plan de implementación

1. **Andamiaje.** Crear `index.html` (canvas 800×600 + `<script>` de `spritesheet.js` y `game.js`) y CSS mínimo para centrar el canvas. `game.js` arranca `loadSpritesheet` y dibuja canvas en negro. *Verificable: canvas 800×600 vacío en navegador.*

2. **Render estático.** Definir `game`, `paddle`, `ball` y rejilla `blocks` (10×6, color por fila). Dibujar paddle, bola (pegada) y bloques con `drawSprite`. *Verificable: paddle abajo, bola encima, rejilla completa.*

3. **Game loop.** `requestAnimationFrame` con update + draw, sin movimiento. *Verificable: loop sin errores en consola.*

4. **Control del paddle.** Mouse (X cursor) y teclado (flechas / A-D) simultáneos, con clamp a bordes. *Verificable: paddle se mueve con ambos, no se sale.*

5. **Lanzar y mover bola.** Bola pegada sigue al paddle; click o espacio la lanza (`stuck=false`). Movimiento por `vx/vy` y rebote en paredes laterales y techo. *Verificable: bola se lanza y rebota en 3 paredes.*

6. **Rebote en paddle.** Colisión bola-paddle; punto de impacto define ángulo horizontal (centro=recto, bordes=diagonal). *Verificable: distintas zonas cambian ángulo de salida.*

7. **Colisión con bloques.** Detección bola-bloque; al impactar: `alive=false`, `score += 10`, rebote vertical. *Verificable: romper bloques suma 10 y desaparecen.*

8. **Vidas y pérdida de bola.** Bola bajo el borde inferior: `lives -= 1`, re-pegar bola (`stuck=true`). *Verificable: perder bola descuenta vida y la re-pega.*

9. **HUD.** Dibujar score y vidas sobre el canvas. *Verificable: HUD refleja score y vidas en vivo.*

10. **Estados y overlays.** `won` (todos rotos) y `lost` (`lives===0`): overlay con mensaje y reinicio (tecla/click reinicia estado completo). *Verificable: victoria/derrota muestran overlay; reiniciar vuelve a jugar.*

## Criterios de aceptación

- [ ] El juego abre en navegador sin build ni dependencias (abrir `index.html` o servir estático).
- [ ] Canvas mide exactamente 800×600.
- [ ] Se renderizan paddle, bola y rejilla de exactamente 60 bloques (10×6), con color por fila.
- [ ] El paddle se mueve con mouse y con teclado (flechas / A-D), y no se sale del canvas.
- [ ] La bola arranca pegada al paddle y se lanza con click o espacio.
- [ ] La bola rebota en las dos paredes laterales y el techo.
- [ ] El rebote en el paddle cambia según el punto de impacto (centro recto, bordes diagonal).
- [ ] Al golpear un bloque: desaparece, suma +10 al score y la bola rebota.
- [ ] El score muestra +10 por cada bloque roto.
- [ ] Empieza con 3 vidas; perder la bola por abajo descuenta 1 y re-pega la bola.
- [ ] Con 0 vidas aparece overlay de derrota.
- [ ] Al romper todos los bloques aparece overlay de victoria.
- [ ] Desde el overlay se puede reiniciar y volver a jugar con estado limpio (score 0, 3 vidas, bloques restaurados).
- [ ] No hay sonido.
- [ ] Sin errores en consola durante una partida completa.

## Decisiones tomadas y descartadas

| Decisión | Elegido | Descartado | Motivo |
|---|---|---|---|
| Niveles | Un nivel fijo 10×6 | Multinivel/progresión | MVP; multinivel merece su propio spec |
| Control paddle | Mouse + teclado simultáneos | Solo uno | Comodidad sin coste extra |
| Rebote paddle | Ángulo por punto de impacto | Reflejo puro | Predecible y se siente mejor (Arkanoid clásico) |
| Inicio de bola | Pegada, lanza con click/espacio | Arranque automático | Da control al jugador |
| Bloques | Todos un golpe | Bloques duros multi-golpe | Simplicidad MVP |
| Romper bloque | Desaparece sin animación | `EXPLOSION_FRAMES` | Reduce alcance; visual no esencial al MVP |
| Audio | Sin sonido | `ball-bounce` / `break-sound` | Recortado del MVP por decisión del usuario |
| Pantallas | Una pantalla + overlays | Menú/pantallas separadas | Overlay suficiente |
| Persistencia | Ninguna (estado en memoria) | localStorage / highscores | Fuera de alcance MVP |
| Puntuación | +10 fijo por bloque | Puntaje por color/combo | Básico para MVP |

## Riesgos identificados

- **Túnel de la bola (tunneling).** A velocidad alta la bola puede atravesar bloque/paddle entre frames. Mitigación: velocidad moderada y clamp; CCD queda fuera de MVP.
- **Bola atascada en ángulo casi horizontal.** Rebotes repetidos sin progreso vertical. Mitigación: imponer componente `vy` mínima tras rebote en paddle.
- **Conflicto mouse vs teclado.** Ambos controlan X a la vez. Mitigación: última entrada gana por frame; definir prioridad en implementación.
- **Spritesheet no carga.** `drawSprite` hace no-op si no cargó; canvas queda en negro. Mitigación: dibujar solo tras `loadSpritesheet`.
