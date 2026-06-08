// Arcade Vault — dev-only FPS overlay (SPEC 11).
// Shared diagnostic util injected by each engine's game.js. Draws instant FPS
// + moving average on top of the canvas. Visible only in dev (localhost) or
// with the ?fps=1 query param — never for players in production.
//
// API (per engine):
//   const meter = window.AVFps.create();   // once, after engine setup
//   meter.tick(now);                        // each frame, with performance.now()
//   meter.draw(ctx);                        // each frame, after the game draws
//
// No React state, no re-renders: drawn straight into the canvas 2D context.
(function () {
  "use strict";

  // Activation: dev host OR explicit ?fps=1. public/ static JS has no inlined
  // process.env.NODE_ENV, so localhost stands in for "not production".
  function enabled() {
    try {
      if (/(?:^|[?&])fps=1(?:&|$)/.test(location.search)) return true;
    } catch (e) {}
    try {
      var h = location.hostname;
      if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "")
        return true;
    } catch (e) {}
    return false;
  }

  function create() {
    var on = enabled();
    var last = 0; // performance.now() of previous frame
    var frames = 0; // frames accumulated in current window
    var acc = 0; // ms accumulated in current window
    var fps = 0; // instant FPS shown
    var avg = 0; // moving average
    var samples = [];

    return {
      enabled: on,

      // Capture a context up-front if the engine prefers start()/draw() with
      // no arg; draw(ctx) below still accepts an explicit ctx.
      start: function () {},

      tick: function (now) {
        if (!on) return;
        if (last === 0) {
          last = now;
          return;
        }
        var dt = now - last;
        last = now;
        frames++;
        acc += dt;
        if (acc >= 250) {
          fps = Math.round((frames * 1000) / acc);
          samples.push(fps);
          if (samples.length > 8) samples.shift();
          var sum = 0;
          for (var i = 0; i < samples.length; i++) sum += samples[i];
          avg = Math.round(sum / samples.length);
          frames = 0;
          acc = 0;
        }
      },

      draw: function (ctx) {
        if (!on || !ctx) return;
        var txt = "FPS " + fps + "  avg " + avg;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // ignore any engine camera transform
        ctx.font = "bold 12px monospace";
        var w = ctx.measureText(txt).width + 12;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(6, 6, w, 20);
        ctx.fillStyle =
          fps >= 55 ? "#39ff14" : fps >= 45 ? "#ffd54f" : "#ff5050";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(txt, 12, 17);
        ctx.restore();
      },
    };
  }

  window.AVFps = { create: create, enabled: enabled };
})();
