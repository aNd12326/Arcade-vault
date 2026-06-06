# Spec 02 — Animación de destrucción de bloques

- **Estado:** Implementado
- **Dependencias:** Spec 01 (MVP jugable). Usa `EXPLOSION_FRAMES`, `EXPLOSION_DURATION` y `drawFrame` de `assets/spritesheet.js`.
- **Fecha:** 2026-06-05
- **Objetivo (una frase):** Reemplazar la desaparición instantánea del bloque roto por una animación de explosión de 4 frames (150ms) que se reproduce de forma puramente visual, sin afectar colisiones ni añadir audio.

## Alcance

**Incluido:**
- Al romper un bloque, lanzar animación de explosión de **4 frames** leyendo **`EXPLOSION_FRAMES[color]` ya existente en `assets/spritesheet.js`** y dibujando con `drawFrame`. **No se crean ni modifican sprites nuevos.**
- Duración total **`EXPLOSION_DURATION` (150ms)**, ~37ms por frame.
- Explosión dibujada en el **mismo rect del bloque** (72×36) que reemplaza.
- **Múltiples explosiones en paralelo**, independientes.
- Cada explosión **se autoelimina** al terminar sus 4 frames.
- Color de la explosión **coincide con el color del bloque** roto (`EXPLOSION_FRAMES[ b.color ]`).

**NO incluido (diferido / fuera de alcance):**
- Audio de ruptura (`break-sound.mp3`) — excluido.
- Cambios en colisión: el bloque deja de colisionar al instante; la animación no participa en física.
- Partículas, escombros, sacudida de pantalla u otros efectos.
- Sprites/frames nuevos — solo se reutilizan los de `assets`.
- Animaciones para paddle, bola, paredes o pérdida de vida.
- Animación de aparición de bloques o transición de niveles.

## Modelo de datos

Una estructura nueva: array `explosions`, independiente de `blocks`.

```js
// Explosiones activas (animación visual, sin colisión)
let explosions = [];

// Al romper un bloque se hace push de:
{
  color: 'red',   // clave de EXPLOSION_FRAMES (= color del bloque)
  x, y,           // posición = rect del bloque roto
  w: 72, h: 36,   // mismo tamaño que el bloque
  start: 0,       // timestamp (ms) de inicio; now del rAF o performance.now()
}
```

**Notas:**
- El bloque mantiene su flujo actual: al golpe `alive = false` (sale de colisión al instante). La explosión es un objeto **separado** que vive en `explosions`.
- `frame index = floor( elapsed / (EXPLOSION_DURATION / 4) )`, con `elapsed = now - start`, clamp 0–3.
- Cuando `elapsed >= EXPLOSION_DURATION`, la explosión se elimina del array.
- Varias entradas en `explosions` coexisten → paralelo.
- Sin persistencia: estado en memoria; `resetGame()` debe vaciar `explosions = []`.

## Plan de implementación

1. **Estado de explosiones.** Declarar `let explosions = []` en `game.js`. Vaciarlo en `resetGame()` (`explosions = []`). *Verificable: sin errores; reiniciar no arrastra explosiones viejas.*

2. **Disparar explosión al romper.** En el bloque de colisión bola-bloque (tras `b.alive = false`), hacer `explosions.push({ color: b.color, x: b.x, y: b.y, w: b.w, h: b.h, start: now })`. *Verificable: al romper un bloque se crea una entrada en `explosions`.*

3. **Fuente de tiempo.** Pasar el timestamp del rAF al loop: `function loop( now ) { update( now ); draw( now ); requestAnimationFrame( loop ); }`, usando `now` (ms) como reloj. Alternativa equivalente: `performance.now()`. *Verificable: `start` y el avance de frames usan un reloj consistente.*

4. **Avanzar y limpiar.** En `update`, recorrer `explosions` y eliminar las que cumplan `now - start >= EXPLOSION_DURATION` (filtrar el array). *Verificable: cada explosión desaparece ~150ms después de crearse.*

5. **Dibujar explosiones.** En `draw`, tras los bloques, por cada explosión calcular `frame = floor( (now - start) / (EXPLOSION_DURATION / 4) )` (clamp 0–3) y `drawFrame( ctx, EXPLOSION_FRAMES[ color ][ frame ], x, y, w, h )`. *Verificable: el bloque roto muestra los 4 frames de explosión en su sitio.*

6. **Verificación de paralelo.** Romper varios bloques casi a la vez y confirmar que cada explosión anima independiente sin parpadeos ni colisiones residuales. *Verificable: múltiples explosiones simultáneas correctas.*

## Criterios de aceptación

- [x] Al romper un bloque se reproduce una animación de explosión en la posición del bloque.
- [x] La explosión usa `EXPLOSION_FRAMES[ color ]` del color del bloque roto (sin sprites nuevos).
- [x] La animación recorre los 4 frames en orden y termina en ~150ms (`EXPLOSION_DURATION`).
- [x] La explosión se dibuja en el mismo rect del bloque (72×36).
- [x] El bloque deja de colisionar al instante del golpe; la animación no causa rebotes ni doble colisión.
- [x] Romper varios bloques a la vez muestra varias explosiones independientes en paralelo.
- [x] Cada explosión se autoelimina al terminar; `explosions` no crece sin límite.
- [x] Reiniciar la partida vacía las explosiones (no quedan animaciones de la partida anterior).
- [x] No se reproduce ningún sonido.
- [x] Sin errores en consola durante una partida con muchas roturas.

## Decisiones tomadas y descartadas

| Decisión | Elegido | Descartado | Motivo |
|---|---|---|---|
| Colisión vs animación | Bloque sale de colisión al instante; animación solo visual | Colisionar hasta fin de animación | Evita rebotes raros / doble colisión |
| Estructura de datos | Array `explosions` separado | Campos en el propio bloque | Limpio de iterar y autoeliminar |
| Duración | `EXPLOSION_DURATION` (150ms) | Duración custom | Reusar valor ya definido en assets |
| Sprites | Reutilizar `EXPLOSION_FRAMES` de assets | Crear sprites nuevos | Ya existen; fuera de alcance crear arte |
| Tamaño explosión | Mismo rect del bloque (72×36) | Centrado con otro tamaño | Reemplazo visual directo del bloque |
| Concurrencia | Múltiples explosiones en paralelo | Una a la vez / cola | Roturas simultáneas son normales |
| Audio | Sin sonido | `break-sound.mp3` | Usuario excluyó audio |
| Reloj | Timestamp del rAF (`now`) | `Date.now()` por explosión | Consistente y barato |

## Riesgos identificados

- **Fuga de memoria en `explosions`.** Si la limpieza falla, el array crece sin fin. Mitigación: filtrar por `elapsed >= EXPLOSION_DURATION` cada frame (criterio de aceptación lo cubre).
- **Índice de frame fuera de rango.** En el último ms, `floor` podría dar 4. Mitigación: clamp del índice a 0–3.
- **Explosión sobre bloque vivo.** Si el rect coincide con otro bloque, la animación se dibuja encima. Bajo riesgo (rejilla fija sin solape); aceptado.
