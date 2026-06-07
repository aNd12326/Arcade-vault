"use client";

import { useState } from "react";

export interface KeyMap {
  up?: string;
  down?: string;
  left?: string;
  right?: string;
  a?: string;
  b?: string;
}

interface MobileGamepadProps {
  /** Game id (lowercase). Used to resolve window.<ID> + the "<id>-skin" key. */
  gameId: string;
  keyMap: KeyMap;
  paused: boolean;
  onPauseToggle: () => void;
}

const SKINS = [
  { key: "clasico", label: "Clásico" },
  { key: "retro", label: "Retro" },
  { key: "neon", label: "Neón" },
];

interface GameGlobal {
  setSkin?: (name: string) => void;
  getSkins?: () => { key: string; label: string }[];
}

/**
 * Map a KeyboardEvent.key to its physical KeyboardEvent.code.
 * Some engines listen on `e.key` (Arkanoid, Snake), others on `e.code`
 * (Asteroids, Tetris) — synthetic events must carry both.
 */
function keyToCode(key: string): string {
  if (key === " ") return "Space";
  if (/^[a-z]$/i.test(key)) return "Key" + key.toUpperCase();
  if (key === "Shift") return "ShiftLeft";
  return key; // Arrow* keys: key === code
}

/** Dispatch a synthetic keyboard event so each game's existing key listeners fire. */
function press(key?: string) {
  if (!key) return;
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key, code: keyToCode(key), bubbles: true })
  );
}
function release(key?: string) {
  if (!key) return;
  document.dispatchEvent(
    new KeyboardEvent("keyup", { key, code: keyToCode(key), bubbles: true })
  );
}

const padBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 56,
  height: 56,
  border: "1px solid #3a3a5a",
  borderRadius: 12,
  background: "#15151f",
  color: "#e0e0e0",
  fontFamily: "var(--pixel)",
  fontSize: 18,
  userSelect: "none",
  WebkitUserSelect: "none",
  touchAction: "none",
  cursor: "pointer",
};

export default function MobileGamepad({
  gameId,
  keyMap,
  paused,
  onPauseToggle,
}: MobileGamepadProps) {
  const [skin, setSkin] = useState(() => {
    try {
      const s = localStorage.getItem(`${gameId}-skin`);
      return s && SKINS.find((x) => x.key === s) ? s : "clasico";
    } catch {
      return "clasico";
    }
  });

  const changeSkin = (name: string) => {
    setSkin(name);
    try {
      localStorage.setItem(`${gameId}-skin`, name);
    } catch {
      /* ignore */
    }
    const g = (window as unknown as Record<string, GameGlobal | undefined>)[
      gameId.toUpperCase()
    ];
    g?.setSkin?.(name);
  };

  /**
   * Pointer Events unify mouse + touch in a single, non-passive code path,
   * so each tap fires press()/release() exactly once. (React registers
   * onTouchStart as passive, which both errors on preventDefault and lets the
   * browser fire emulated mouse events — double-firing the key.)
   * touch-action:none on the button stops scroll/zoom while pressing.
   */
  const pointerHandlers = (key: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      press(key);
    },
    onPointerUp: () => release(key),
    onPointerLeave: () => release(key),
    onPointerCancel: () => release(key),
  });

  /** Build the press/release handlers for one mapped key. */
  const dirBtn = (key: string | undefined, glyph: string) => {
    if (!key) return <span />;
    return (
      <button
        type="button"
        aria-label={glyph}
        style={padBtn}
        {...pointerHandlers(key)}
      >
        {glyph}
      </button>
    );
  };

  const actionBtn = (
    key: string | undefined,
    glyph: string,
    accent: string
  ) => {
    if (!key) return null;
    return (
      <button
        type="button"
        aria-label={`Botón ${glyph}`}
        style={{
          ...padBtn,
          width: 64,
          height: 64,
          borderRadius: "50%",
          borderColor: accent,
          color: accent,
          fontSize: 22,
          fontWeight: 700,
        }}
        {...pointerHandlers(key)}
      >
        {glyph}
      </button>
    );
  };

  return (
    <div className="mobile-gamepad">
      <div className="mobile-gamepad-row">
        {/* D-pad */}
        <div className="mobile-dpad">
          <span />
          {dirBtn(keyMap.up, "▲")}
          <span />
          {dirBtn(keyMap.left, "◀")}
          <span />
          {dirBtn(keyMap.right, "▶")}
          <span />
          {dirBtn(keyMap.down, "▼")}
          <span />
        </div>

        {/* Action buttons */}
        <div className="mobile-actions">
          {actionBtn(keyMap.b, "B", "var(--magenta)")}
          {actionBtn(keyMap.a, "A", "var(--cyan)")}
        </div>
      </div>

      <div className="mobile-gamepad-row mobile-gamepad-footer">
        <button type="button" className="btn yellow" onClick={onPauseToggle}>
          {paused ? "REANUDAR" : "PAUSA"}
        </button>
        <label className="mobile-skin">
          <span>SKIN</span>
          <select
            value={skin}
            onChange={(e) => changeSkin(e.target.value)}
            aria-label="Skin"
          >
            {SKINS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
