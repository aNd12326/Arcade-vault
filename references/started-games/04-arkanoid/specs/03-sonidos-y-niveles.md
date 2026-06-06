# Spec 03 — Sonidos y niveles de juego

- **Estado:** Approved
- **Dependencias:** Spec 01 (MVP jugable), Spec 02 (animación destrucción bloques)
- **Fecha:** 2026-06-05
- **Objetivo (una frase):** Añadir efectos de sonido (rebote y ruptura) con botón mute HTML,
  y progresión de 3 niveles con velocidad creciente y layouts distintos de bloques,
  acumulando score y mostrando overlay entre niveles.

## Alcance

**Incluido:**
- Reproducir `assets/sounds/ball-bounce.mp3` en cada rebote de bola
  (paredes laterales, techo, paddle).
- Reproducir `assets/sounds/break-sound.mp3` al romper un bloque.
- Botón HTML "🔇 Mute" fuera del canvas; alterna silencio global sin recargar.
- 3 niveles fijos con layout de bloques distinto por nivel y velocidad de bola
  creciente en cada nivel.
- Score acumula entre niveles (no reinicia al pasar de nivel).
- Overlay de transición "Nivel N completado — continuar" al limpiar todos los bloques
  del nivel actual (excepto el último).
- Al completar el nivel 3: overlay de victoria global (el mismo overlay actual de "ganaste").

**NO incluido (diferido / fuera de alcance):**
- Control de volumen (slider); solo mute binario.
- Sonidos para pérdida de vida, overlays, o inicio de partida.
- Más de 3 niveles o niveles generados proceduralmente.
- Cambios en dificultad que no sean velocidad de bola (ej. paddle más chico,
  multi-golpe, power-ups).
- Persistencia de score entre sesiones (sigue sin localStorage).
- Indicador visual del nivel actual más allá del overlay (queda para otro spec si se necesita).
- Soporte móvil / táctil.

## Modelo de datos

### Niveles

Array fijo de 3 definiciones de nivel en `game.js`:

```js
const LEVELS = [
  {
    speed: 4,          // magnitud inicial de vx/vy de la bola (px/frame)
    rows: 4,
    cols: 10,
    colorByRow: [ 'red', 'yellow', 'green', 'cyan' ],
  },
  {
    speed: 5,
    rows: 5,
    cols: 10,
    colorByRow: [ 'magenta', 'red', 'yellow', 'green', 'cyan' ],
  },
  {
    speed: 6,
    rows: 6,
    cols: 10,
    colorByRow: [ 'hotpink', 'magenta', 'red', 'yellow', 'green', 'cyan' ],
  },
];
```

Índice de nivel activo en `game`:

```js
const game = {
  state: 'ready',   // 'ready' | 'playing' | 'level_complete' | 'won' | 'lost'
  score: 0,
  lives: 3,
  level: 0,         // índice en LEVELS (0-based)
};
```

**Notas:**
- Al pasar de nivel: `game.level++`, reconstruir `blocks` desde `LEVELS[game.level]`,
  reposicionar bola y paddle, `game.state = 'ready'`.
- Score NO reinicia entre niveles.
- Vidas NO reinician entre niveles.

### Audio

```js
const sounds = {
  bounce: new Audio( 'assets/sounds/ball-bounce.mp3' ),
  break:  new Audio( 'assets/sounds/break-sound.mp3' ),
};
let muted = false;

function playSound( key ) {
  if ( muted ) return;
  sounds[ key ].currentTime = 0;
  sounds[ key ].play();
}
```

**Notas:**
- `currentTime = 0` permite re-disparar el mismo sonido sin esperar que termine.
- Botón HTML `#btn-mute` alterna `muted` y actualiza su texto.
- Sin `AudioContext`; `new Audio` suficiente para este alcance.

## Plan de implementación

1. **Definir LEVELS y actualizar `game`.** Añadir array `LEVELS` (3 entradas) y campo
   `game.level = 0`. Actualizar `buildBlocks()` para leer filas/columnas/colores desde
   `LEVELS[game.level]`. Verificable: rejilla nivel 1 muestra 4 filas, nivel 2 cinco filas,
   nivel 3 seis filas.

2. **Velocidad de bola por nivel.** Al lanzar la bola (`stuck = false`), inicializar
   `vx/vy` desde `LEVELS[game.level].speed`. Verificable: bola nivel 3 notablemente más
   rápida que nivel 1.

3. **Detectar nivel completo.** En `update`, cuando `blocks.every( b => !b.alive )`:
   si `game.level < 2` → `game.state = 'level_complete'`; si `game.level === 2` →
   `game.state = 'won'`. Verificable: limpiar nivel 1/2 muestra overlay transición;
   limpiar nivel 3 muestra overlay victoria.

4. **Overlay de transición entre niveles.** En `draw`, cuando `state === 'level_complete'`,
   dibujar overlay semitransparente con "Nivel N completado — Click o espacio para continuar".
   Al recibir click/espacio: `game.level++`, reconstruir `blocks`, reposicionar paddle y bola
   (`stuck = true`), `game.state = 'ready'`. Verificable: overlay aparece, continuar carga
   siguiente nivel con bloques frescos y bola pegada.

5. **Score y vidas persisten entre niveles.** No reiniciar `game.score` ni `game.lives`
   al avanzar nivel. Verificable: score acumulado se refleja en HUD al entrar al nivel 2/3.

6. **Mostrar nivel actual en HUD.** Añadir "Nivel: N" al HUD (junto a score y vidas).
   Verificable: HUD refleja el nivel actual en todo momento.

7. **Sistema de audio.** Declarar `sounds` y `muted` en `game.js`. Implementar `playSound`.
   Llamar `playSound('bounce')` en cada rebote de pared/techo y rebote de paddle.
   Llamar `playSound('break')` al hacer `alive = false` en un bloque. Verificable: se
   escuchan sonidos distintos en cada evento.

8. **Botón mute HTML.** Añadir `<button id="btn-mute">🔊 Sonido</button>` en `index.html`
   fuera del canvas. Al click: alternar `muted`, actualizar texto del botón
   ("🔊 Sonido" / "🔇 Mute"). Verificable: toggle silencia/reactiva todos los sonidos.

9. **Integrar `resetGame` con niveles.** Al reiniciar desde overlay victoria/derrota:
   `game.level = 0`, `game.score = 0`, `game.lives = 3`, reconstruir bloques del nivel 1,
   reposicionar bola y paddle. Verificable: reiniciar desde cualquier overlay vuelve al
   nivel 1 con estado limpio.

## Criterios de aceptación

- [ ] Nivel 1 muestra 4 filas de bloques; nivel 2, 5 filas; nivel 3, 6 filas.
- [ ] Cada nivel tiene colores de fila distintos según `LEVELS[n].colorByRow`.
- [ ] La bola es notablemente más rápida en nivel 3 que en nivel 1.
- [ ] Al limpiar todos los bloques del nivel 1 o 2, aparece overlay "Nivel N completado".
- [ ] Desde el overlay de transición, click o espacio carga el siguiente nivel con bloques
      frescos y bola pegada al paddle.
- [ ] Al limpiar todos los bloques del nivel 3 aparece overlay de victoria global.
- [ ] El score acumula entre niveles (no reinicia al pasar de nivel).
- [ ] Las vidas acumulan entre niveles (no reinician al pasar de nivel).
- [ ] El HUD muestra nivel actual, score y vidas en todo momento.
- [ ] Se escucha `ball-bounce.mp3` al rebotar en paredes laterales, techo y paddle.
- [ ] Se escucha `break-sound.mp3` al romper un bloque.
- [ ] El botón mute fuera del canvas silencia todos los sonidos al activarse.
- [ ] El botón mute reactiva los sonidos al desactivarse; su texto refleja el estado.
- [ ] Reiniciar desde cualquier overlay vuelve al nivel 1 con score 0, 3 vidas y
      bloques frescos.
- [ ] Sin errores en consola durante una partida completa de 3 niveles.

## Decisiones tomadas y descartadas

| Decisión | Elegido | Descartado | Motivo |
|---|---|---|---|
| Spec único vs separados | Un spec combinado | Dos specs (03-sonidos, 04-niveles) | Usuario prefirió un spec |
| Número de niveles | 3 fijos | Procedural / configurable | Suficiente para probar progresión sin complejidad extra |
| Diferenciación entre niveles | Velocidad + layout (filas/colores) | Solo velocidad | Más sensación de progresión real |
| Score entre niveles | Acumula (no reinicia) | Reinicia por nivel | Decisión del usuario |
| Vidas entre niveles | Acumulan (no reinician) | Reinician por nivel | Consistente con score; no se especificó lo contrario |
| Botón mute | HTML fuera del canvas | Dibujado en canvas con Canvas 2D | Más simple; no complica el game loop |
| Control de volumen | Mute binario | Slider de volumen | Fuera de alcance |
| API de audio | `new Audio` + `currentTime = 0` | `AudioContext` / Web Audio API | Suficiente para efectos simples; sin latencia perceptible |
| Sonidos adicionales | Solo bounce y break | Sonido de vida perdida, victoria, inicio | Fuera de alcance; solo los dos archivos existentes |
| HUD nivel | "Nivel: N" en HUD existente | Pantalla separada / splash de nivel | Mínimo necesario; overlay de transición ya comunica el cambio |
| Indicador mute en botón | Texto + emoji (🔊/🔇) | Solo emoji / solo texto | Claro sin depender de CSS extra |

## Riesgos identificados

- **Autoplay bloqueado por el navegador.** Los navegadores modernos bloquean audio
  sin interacción previa del usuario. Mitigación: el primer sonido ocurre tras click
  (lanzar bola), que ya cuenta como interacción — no se necesita unlock manual.

- **Sonido cortado en rebotes rápidos.** Si la bola rebota varias veces por frame,
  `currentTime = 0` puede sonar entrecortado. Mitigación: aceptado para este alcance;
  `currentTime = 0` es suficiente para la velocidad de juego actual.

- **Estado `level_complete` interrumpe update.** Si el game loop sigue corriendo durante
  el overlay de transición, la bola podría moverse fuera de pantalla. Mitigación: cuando
  `state === 'level_complete'`, `update` no ejecuta física ni colisiones.

- **`LEVELS[game.level]` fuera de rango.** Si `game.level` supera 2 por bug, acceder
  a `LEVELS[3]` es `undefined`. Mitigación: la condición `game.level === 2` dispara
  victoria antes de cualquier `game.level++` adicional.
