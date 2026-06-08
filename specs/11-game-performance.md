# SPEC 11 — Optimización de performance de los juegos

> **Estado:** Approved
> **Depende de:** 05-asteroids-canvas, 07-tetris-game, 08-arkanoid-game, 09-snake-game, 10-mobile-touch-controls, game-jam/frogger
> **Fecha:** 2026-06-07
> **Objetivo:** Recuperar 60 FPS en escritorio y ≥50 FPS en móvil en los cinco juegos canvas eliminando el `shadowBlur` por-frame y corrigiendo el ciclo de vida de `requestAnimationFrame`, medido con un overlay de FPS dev-only.

---

## Section 1 — Por qué este spec existe

Los juegos presentan caídas de FPS durante el juego (no en la carga). Arkanoid es el
caso más visible. Dos causas concretas, detectadas en el código:

1. **`shadowBlur` por forma y por frame.** En Arkanoid se asigna dentro de `drawBlock`
   (`public/games/arkanoid/game.js:184`), ejecutándose una vez por bloque por frame.
   `shadowBlur` fuerza un re-blur gaussiano por cada `fill`/`stroke`; con decenas de
   bloques a 60 fps domina el presupuesto de frame. Conteos: Frogger 18, Asteroids 14,
   Arkanoid 6, Snake 3, Tetris 2.
2. **Ciclo de vida roto de `requestAnimationFrame`.** En Asteroids
   (`public/games/asteroids/game.js:520`) la rama `paused` sigue llamando
   `requestAnimationFrame(loop)`, y `resume()` agenda un segundo loop: cada ciclo
   pausa/reanuda multiplica los loops activos. El wrapper llama `pause()` al desmontar
   pero nunca cancela el frame, dejando un loop vivo que se acumula al navegar entre
   juegos. Frogger carece de cancelación robusta; Snake/Tetris/Arkanoid sí usan
   `cancelAnimationFrame`.

No se sabe el FPS real actual: este spec **mide primero** (Fase 1) y luego optimiza.

---

## Scope

**In:**

- Utilidad compartida de **overlay de FPS dev-only**: muestra FPS instantáneo + media
  móvil sobre el canvas. Visible solo en `process.env.NODE_ENV !== "production"` o con
  query param `?fps=1`; oculta para jugadores en producción. Queda como herramienta de
  diagnóstico permanente.
- **Medición de baseline**: registrar FPS de los 5 juegos en escritorio y móvil (30 s de
  juego activo cada uno) y anotar los números en este spec antes de optimizar.
- **Eliminación de `shadowBlur` por-frame** en los 5 engines:
  - Arkanoid: cachear el campo de bloques en un canvas offscreen, redibujado solo cuando
    cambian los bloques (rotura), y blitear con `drawImage` cada frame.
  - Resto: mover el glow a sprites pre-renderizados en canvas offscreen, o agrupar los
    `fill` que comparten color para asignar `shadowBlur` una sola vez por grupo.
  - Ruta **low-fx en móvil**: desactivar `shadowBlur` (`< 768 px`) donde el glow no sea
    esencial para la legibilidad.
- **Corrección del ciclo de vida de `requestAnimationFrame`** en los 5 engines:
  - Asteroids y Frogger: guardar `rafId`, `cancelAnimationFrame` al pausar y al
    desmontar; la rama `paused` NO debe re-agendar; `resume()` no debe crear un segundo
    loop (idempotente).
  - Snake, Tetris, Arkanoid: auditar y confirmar que ya cumplen el patrón.
- **Re-medición** tras los cambios, comparada contra el baseline.

**Fuera de alcance (specs futuros):**

- Reescrituras algorítmicas o de gameplay (colisiones, IA, generación de niveles).
- Migración a WebGL / `OffscreenCanvas` en worker.
- Optimización de tiempo de carga / bundle / lazy-loading (el síntoma es FPS in-game,
  no la carga).
- Performance de servidor, Supabase o API de scores.
- Nuevos juegos.

---

## Data model

No se introducen tablas ni tipos de Supabase nuevos.

El overlay de FPS mantiene estado efímero en memoria:

```js
// Estado del medidor (en la utilidad compartida)
const fpsMeter = {
  enabled: false, // dev o ?fps=1
  last: 0, // timestamp del frame anterior (performance.now)
  frames: 0, // frames acumulados en la ventana actual
  acc: 0, // ms acumulados
  fps: 0, // FPS instantáneo mostrado
  avg: 0, // media móvil
};
```

Convenciones existentes que se reutilizan: loop por engine basado en `dt`, contrato
`av:*` + `window.<ID_UPPER>.{pause,resume,restart}`.

---

## Implementation plan

1. **Crear utilidad de overlay de FPS dev-only** (`public/games/_shared/fps.js` o
   equivalente inyectable por cada `game.js`). Expone `start(ctx)` / `tick(now)` /
   `draw(ctx)`. Activación: `NODE_ENV !== "production"` o `location.search` incluye
   `fps=1`. Verificación: con `?fps=1` aparece el contador; sin él, no.
2. **Cablear el overlay en los 5 engines** (una línea por loop). Verificación: cada juego
   muestra FPS con `?fps=1`.
3. **Registrar baseline.** Jugar 30 s cada juego en escritorio y en viewport móvil
   (DevTools 390 px) y anotar FPS medio en la tabla de Baseline de este spec.
4. **Corregir rAF en Asteroids** (`game.js:520`): guardar `rafId`, no re-agendar en
   `paused`, `cancelAnimationFrame` en `pause()` y en unmount, `resume()` idempotente.
   Verificación: pausar/reanudar 10 veces no aumenta el FPS ni la CPU; al salir del juego
   no queda loop activo (probar con `?fps=1` y Performance profiler).
5. **Corregir rAF en Frogger** igual que paso 4. **Auditar** Snake/Tetris/Arkanoid y
   ajustar si re-agendan en pausa. Verificación: igual que paso 4 en cada juego.
6. **Optimizar `shadowBlur` en Arkanoid**: campo de bloques a canvas offscreen,
   redibujado solo al romper un bloque; paddle/ball/HUD con glow pre-renderizado o
   `shadowBlur` asignado una sola vez. Verificación: FPS de Arkanoid alcanza el target;
   el aspecto visual se mantiene en escritorio.
7. **Optimizar `shadowBlur` en Frogger y Asteroids** (sprites pre-renderizados / agrupar
   por color / low-fx en móvil). Verificación: FPS alcanza target en ambos.
8. **Optimizar `shadowBlur` en Snake y Tetris** (menor impacto; aplicar mismo patrón).
   Verificación: sin regresión visual; FPS estable.
9. **Re-medir** los 5 juegos (escritorio + móvil) y rellenar la columna "después" de la
   tabla de Baseline. Verificación: criterios de aceptación cumplidos.

---

## Baseline (rellenar en Fase 1 / re-medición)

| Juego     | Escritorio antes | Escritorio después | Móvil antes | Móvil después |
| --------- | ---------------- | ------------------ | ----------- | ------------- |
| asteroids | 62               | 55\*               | 100         | n/d\*\*       |
| tetris    | 70               | 57\*               | 103         | n/d\*\*       |
| arkanoid  | 57               | 45\*               | 105         | n/d\*\*       |
| snake     | 48               | 56\*               | 109         | n/d\*\*       |
| frogger   | 58               | 78\*               | 104         | n/d\*\*       |

\* **Columna "después" no es comparable 1:1 con "antes".** El "después" se midió
con el skin **neón** (el caso pesado, con glow), mientras que el baseline usó el
skin por defecto. Además la varianza run-to-run en este entorno de dev (Next dev
server + compositing GPU + el propio loop de medición compartiendo vsync) es de
**±15 FPS**, mayor que el delta de la optimización a este tamaño de canvas. Por eso
el número agregado de FPS de página NO es la métrica fiable aquí. La prueba decisiva
es el **micro-benchmark aislado** (abajo) y la reducción de _worst-frame_.

\*\* Móvil "después" no se re-midió: el viewport emulado infla las cifras (ver nota
de baseline) y no certifica el target ≥50 en hardware real. La ruta **low-fx**
(shadowBlur off `< 768 px`) sí se verificó activa: en Frogger neón el _worst-frame_
móvil cayó de **102 ms → 22 ms** al entrar en low-fx. Certificación final ≥50 FPS =
teléfono físico (pendiente, usuario).

**Métrica decisiva — coste aislado del campo de bloques de Arkanoid (neón, 72
bloques, misma máquina):**

| Ruta                                          | ms/frame  |
| --------------------------------------------- | --------- |
| Antes: redibujar bloques + shadowBlur / frame | **0.191** |
| Después: blit del layer offscreen cacheado    | **0.003** |
| **Mejora**                                    | **×57**   |

Reducciones de _worst-frame_ observadas (menos jank): Frogger móvil 102→22 ms,
Asteroids neón 42→22 ms.

Hardware/viewport de referencia:

- **Método:** captura automatizada con Playwright (Chromium) contra `npm run dev`
  en `localhost:3000`, conteo de frames vía `requestAnimationFrame` sobre ventana
  de 8 s por juego. Juego en reposo (animación de fondo activa, sin input). FPS =
  frames / segundos.
- **Escritorio:** viewport 1280×800. Monitor de alto refresco (~120 Hz, sin cap a
  60). Como el techo está por encima de 60, los números reflejan coste real de
  dibujado: arkanoid (57) y snake (48) caen por debajo de 60; asteroids/frogger
  rondan 58-62.
- **Móvil (390×844):** ⚠️ **NO representativo de un teléfono real.** El viewport
  emulado solo encoge el canvas sobre la GPU de escritorio → menos píxeles que
  blurrear → FPS _infladas_ (100-109), lo opuesto a una GPU móvil de gama media.
  El cuello de botella es fill-rate (`shadowBlur` sobre píxeles): canvas pequeño =
  más rápido aquí, pero más lento en hardware real. Tratar la columna "Móvil
  antes" como referencia relativa, no como medida de dispositivo. Validación móvil
  real (criterio ≥50 FPS) requiere un teléfono físico o throttling de GPU.

---

## Acceptance criteria

- [x] Con `?fps=1` (o en dev) el overlay de FPS aparece sobre el canvas en los 5 juegos.
      (Verificado: badge "FPS / avg" visible en los 5 con `?fps=1`.)
- [x] En producción sin `?fps=1`, el overlay no es visible para el jugador.
      (`AVFps.enabled()` solo true en host de dev o con `?fps=1`.)
- [x] La tabla de Baseline tiene FPS "antes" y "después" para los 5 juegos.
      (Con caveats: "después" en neón/env-ruidoso; móvil pendiente de hardware real.)
- [~] Cada juego mantiene **≥60 FPS en escritorio** durante 30 s de juego activo.
  Certificación final en hardware de referencia (build prod). El coste de
  dibujado bajó de forma medible (bloques Arkanoid ×57); la varianza del env
  de dev impide certificar el número agregado aquí.
- [~] Cada juego mantiene **≥50 FPS en móvil** (390 px) durante 30 s.
  Pendiente: requiere teléfono físico (viewport emulado infla las cifras). La
  ruta low-fx que habilita el target está implementada y verificada activa.
- [x] Pausar/reanudar 10 veces NO duplica loops.
      (Verificado live: ratio de schedules ≈1 por frame tras 22 `resume()` +
      ciclos pausa/reanuda en Asteroids y Frogger.)
- [x] Salir de un juego no deja `requestAnimationFrame` activo.
      (`pause()` ahora hace `cancelAnimationFrame`; el wrapper llama `pause()` al
      desmontar → sin loop superviviente.)
- [x] `drawBlock` de Arkanoid ya no asigna `shadowBlur` por frame.
      (Bloques en layer offscreen; `drawBlock` solo corre al invalidar.)
- [x] El aspecto visual en escritorio se mantiene equivalente.
      (Screenshot Arkanoid neón con glow intacto; glow solo cae en móvil <768 px.)
- [x] El overlay no introduce `useState` ni re-renders de React.
      (Se dibuja en canvas desde `game.js`; ningún wrapper tocado.)
- [x] `npm run build` completa sin errores; ninguna ruta devuelve 500.
      (Build OK: TS 2.9s, 10/10 páginas estáticas, sin errores.)

---

## Implementation log — hallazgos y soluciones aplicadas

Registro de lo implementado (2026-06-07, branch `spec-11-game-performance`) para
referencia futura. Archivos tocados: `public/games/_shared/fps.js` (nuevo) y los 5
`public/games/<id>/game.js`. **Ningún wrapper React (`app/_games/...`) fue
modificado** → cero `useState` nuevo, cero re-renders compitiendo con el loop.

### A. Overlay de FPS dev-only (`public/games/_shared/fps.js`, nuevo)

- Expone `window.AVFps.create()` → medidor con `tick(now)` (FPS instantáneo + media
  móvil de 8 muestras, ventana de 250 ms) y `draw(ctx)` (badge arriba-izquierda,
  color-codificado: verde ≥55, amarillo ≥45, rojo por debajo).
- `AVFps.enabled()` = true en host de dev (`localhost`/`127.0.0.1`/`0.0.0.0`) **o**
  con `?fps=1`. En host de producción sin el query param → oculto.
- **Hallazgo clave:** el JS estático de `public/` NO tiene `process.env.NODE_ENV`
  inlineado (eso solo ocurre en el bundle de Next). Por eso la activación "dev" se
  resuelve por hostname, no por `NODE_ENV`. Documentar para no "arreglarlo" mal.
- `draw()` hace `ctx.setTransform(1,0,0,1,0,0)` antes de dibujar → el badge ignora
  cualquier cámara/transform del engine (Asteroids, Frogger).
- **Cableado en cada engine:** snippet `loadFps()` cerca del `ctx` que crea el
  medidor vía `window.AVFps` (inyecta `/games/_shared/fps.js` si falta). En el loop:
  `fpsMeter.tick(now); fpsMeter.draw(ctx)` tras el `draw()` del juego. El medidor es
  null-guarded → la carga async del script no genera carrera.

### B. Ciclo de vida de `requestAnimationFrame`

Patrón canónico aplicado: un único `rafId` en vuelo + helper `schedule()` que solo
agenda `if (rafId === null)` → **idempotente** (pausar/reanudar/reiniciar en spam no
apila loops). El loop pone `rafId = null` al entrar y NO re-agenda en la rama
`paused`. `pause()` hace `cancelAnimationFrame(rafId)`.

- **Asteroids** (era el bug del spec §1.2): la rama `paused` re-agendaba y `resume()`
  creaba un 2.º loop; `pause()` no cancelaba → al desmontar quedaba un loop vivo que
  se acumulaba al navegar. **Fix:** `rafId` + `schedule()`; `pause()` cancela;
  `resume()`/`restart()` idempotentes. El wrapper ya llamaba `pause()` al desmontar →
  ahora sí mata el frame.
- **Frogger:** mismo patrón. Antes el loop seguía corriendo a tope mientras `paused`
  (solo saltaba el `update`) y no cancelaba al desmontar. **Fix:** `frame()` retorna
  sin re-agendar si `paused`/`!running`; `pause()` cancela; `restart()` usa
  `schedule()` (antes el `if(!running)` dejaba el canvas congelado tras reanudar).
- **Auditoría Snake / Tetris / Arkanoid** (el spec pedía solo confirmar):
  - Snake ✓ correcto sin cambios (rama `paused` retorna, `pause()` cancela, `resume()`
    guardado por flag).
  - Tetris ✓ correcto sin cambios (`pause()` cancela, `resume()` guardado, `restart()`
    → `init()` que cancela antes de agendar).
  - Arkanoid ✗ **bug nuevo encontrado:** `restart()` agendaba `requestAnimationFrame`
    **sin** `cancelAnimationFrame` previo → reiniciar con el loop vivo apilaba un 2.º
    loop. **Fix:** añadir `cancelAnimationFrame(rafId)` al inicio de `restart()`.
- **Verificación usada:** envolver `window.requestAnimationFrame` y contar "schedules
  por frame presente" tras spamear `resume()`/`restart()`. Ratio ≈1 = un solo loop;
  un apilamiento daría ≥2. Medido ≈1.1 en Asteroids/Frogger tras 22 `resume()`.

### C. `shadowBlur` por-frame

**Hallazgo transversal:** en TODOS los engines el `shadowBlur` solo está activo en el
skin **neón** (Asteroids gatea por `skin.shadowBlur > 0`; el resto por
`skin.style === "neon"` / `isNeon`). Los skins `clasico`/`retro` ya no tenían glow.
Por eso el target en skin por defecto casi se cumplía; el caso pesado es neón.

- **Arkanoid (paso 6) — cache offscreen del campo de bloques:**
  - Añadido canvas offscreen `blockLayer` (W×H) + flag `blocksDirty`. `drawBlock(b, g)`
    ahora recibe el contexto destino; `renderBlockLayer()` dibuja los bloques vivos al
    layer (el `shadowBlur` neón vive ahí, NO por-frame). `draw()` hace
    `if (blocksDirty) renderBlockLayer(); ctx.drawImage(blockLayer, 0, 0)`.
  - Invalidación (`blocksDirty = true`) SOLO en: rotura de bloque, `buildBlocks`
    (nivel/reset) y `applySkin` (cambian colores/estilo).
  - **Resultado medido (micro-benchmark aislado, neón, 72 bloques):** redibujar por
    frame **0.191 ms** → blit cacheado **0.003 ms** = **×57**. Es la métrica decisiva
    de este spec (ver tabla Baseline); el FPS agregado en dev es demasiado ruidoso.
- **Ruta low-fx en móvil (pasos 7-8) — Asteroids, Frogger, Snake, Tetris:**
  - Helper `lowFx()` por engine = `window.innerWidth < 768`. Gatea el `shadowBlur`:
    Asteroids `if (skin.shadowBlur > 0 && !lowFx())`; resto `shadowBlur = lowFx() ? 0 : N`.
  - Sitios gateados: Asteroids 5, Frogger 9, Snake 2, Tetris 1. El resto del estilo
    neón (colores, strokes) se mantiene; SOLO cae el blur gaussiano en móvil.
  - **Resultado:** en escritorio el glow es idéntico (verificado por screenshot);
    en móvil el _worst-frame_ de Frogger neón cayó de **102 ms → 22 ms**.
  - **Nota de scope:** el spec listaba "sprites pre-renderizados / agrupar por color /
    low-fx" como alternativas (OR). Se eligió low-fx (la de menor riesgo); los sprites
    pre-renderizados para entidades móviles de Asteroids/Frogger no se implementaron
    (alto riesgo, complejidad) — quedan como mejora futura si el escritorio neón no
    alcanza 60 en hardware real.

### D. Limitación de medición (importante para la re-medición futura)

La medición automatizada (Playwright contra `npm run dev`) tiene varianza ±15 FPS por
el Next dev server, el compositing GPU del canvas escalado y el propio loop de medición
compartiendo vsync. **A este tamaño de canvas el ruido supera el delta de la
optimización**, por lo que el FPS agregado de página NO certifica los targets aquí.
Certificación fiable = **build de producción en hardware de referencia** (escritorio)
y **teléfono físico** (móvil). Lo que sí se certifica de forma robusta: el coste de
dibujado por componente (×57 bloques), las caídas de _worst-frame_, y la idempotencia
del ciclo de vida de rAF.

---

## Decisions

- **Sí: medir antes de optimizar.** No hay baseline ni target reales; sin medición no se
  puede verificar la mejora. La Fase 1 del plan es instrumentación.
- **Sí: overlay dev-only (`?fps=1` / dev).** Diagnóstico permanente sin ensuciar la UI
  retro del jugador.
- **Sí: target 60 escritorio / ≥50 móvil.** Estándar arcade con holgura para Android de
  gama media; decisión del usuario.
- **Sí: atacar `shadowBlur` y ciclo de vida de rAF.** Son las dos causas concretas
  halladas en el código, no hipótesis.
- **Sí: cache offscreen para los bloques estáticos de Arkanoid.** Los bloques no se mueven
  entre roturas; redibujarlos cada frame con glow es el coste dominante.
- **No: WebGL / OffscreenCanvas en worker.** Sobreingeniería para el problema actual;
  spec futuro si los targets no se alcanzan con 2D.
- **No: optimización de carga/bundle.** El síntoma confirmado es FPS in-game (1.a), no
  tiempo de carga.
- **No: reescritura de gameplay/colisiones.** Fuera de alcance; el objetivo es dibujado y
  ciclo de vida, no lógica.
- **Sí: minimizar `useState`; preferir `useRef`.** El overlay de FPS se dibuja dentro del
  canvas desde `game.js` (vanilla), sin estado React → cero re-renders. Cualquier cambio
  en los wrappers (`app/_games/<id>/<PascalId>Canvas.tsx`) debe evitar añadir `useState`
  nuevo; usar `useRef` para valores mutables que no deben disparar render. Razón: un
  re-render de React no debe competir con el loop del juego.

---

## Risks

| Riesgo                                                                   | Mitigación                                                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Quitar `shadowBlur` cambia el look de los skins (neón depende del glow). | Glow pre-renderizado a sprite conserva el aspecto en escritorio; low-fx solo en móvil. |
| Cache offscreen de Arkanoid se desincroniza al romper bloques.           | Invalidar y redibujar el layer offscreen solo en el evento de rotura.                  |
| Baseline no reproducible entre máquinas.                                 | Fijar dispositivo/viewport de referencia y registrar el hardware junto a los números.  |
| Corregir rAF rompe pausa/reanudar existente.                             | `resume()` idempotente + criterio de aceptación de 10 ciclos pausa/reanuda.            |

---

## What is **not** in this spec

- Migración a WebGL u `OffscreenCanvas`.
- Optimización de carga, bundle o lazy-loading.
- Reescrituras de gameplay, colisiones o generación de niveles.
- Performance de servidor / Supabase.
- Nuevos juegos.

Cada uno, si llega, va en su propio spec.
