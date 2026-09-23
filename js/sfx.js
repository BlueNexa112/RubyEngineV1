/* =========================================
   RubyEngine — SFX Engine v3.1
   Premium · Layered · Punchy · Louder
   + 5 method baru untuk game (jump, hit, shoot, explode, flip)
========================================= */
(function () {
  'use strict';

  var CONFIG = {
    enabled: true,
    volume: 0.5
  };

  var ctx = null;
  var master = null;

  function getCtx() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = CONFIG.volume;
      master.connect(ctx.destination);
    } catch (e) { return null; }
    return ctx;
  }

  function resume() {
    var ac = getCtx();
    if (ac && ac.state === 'suspended') ac.resume().catch(function () {});
  }

  function updateMaster() {
    if (master) master.gain.value = CONFIG.volume;
  }

  function play(n) {
    if (!CONFIG.enabled) return;
    var ac = getCtx();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume().catch(function () {});

    var t    = ac.currentTime + (n.at || 0);
    var dur  = n.dur || 0.1;
    var vol  = n.vol != null ? n.vol : 1;
    var atk  = n.atk != null ? n.atk : 0.005;
    var rel  = n.rel != null ? n.rel : dur;

    try {
      var osc  = ac.createOscillator();
      var gain = ac.createGain();

      osc.type = n.type || 'sine';
      osc.frequency.setValueAtTime(n.freq, t);
      if (n.slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, n.slideTo), t + dur);
      }

      var last = gain;
      if (n.filter) {
        var f = ac.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(n.filter, t);
        if (n.filterTo) {
          f.frequency.exponentialRampToValueAtTime(Math.max(20, n.filterTo), t + dur);
        }
        f.Q.value = n.q || 1;
        gain.connect(f);
        last = f;
      }

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + atk);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + atk + rel);

      osc.connect(gain);
      last.connect(master);

      osc.start(t);
      osc.stop(t + atk + rel + 0.03);
    } catch (e) {}
  }

  function noise(cfg) {
    if (!CONFIG.enabled) return;
    var ac = getCtx();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume().catch(function () {});

    var t   = ac.currentTime + (cfg.at || 0);
    var dur = cfg.dur || 0.05;

    try {
      var buf  = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * dur)), ac.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      var src  = ac.createBufferSource();
      src.buffer = buf;

      var filt = ac.createBiquadFilter();
      filt.type = cfg.type || 'highpass';
      filt.frequency.value = cfg.freq || 2000;
      filt.Q.value = cfg.q || 0.8;

      var g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(cfg.vol != null ? cfg.vol : 0.5, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      src.connect(filt);
      filt.connect(g);
      g.connect(master);

      src.start(t);
      src.stop(t + dur + 0.01);
    } catch (e) {}
  }

  function seq(notes) {
    for (var i = 0; i < notes.length; i++) play(notes[i]);
  }

  var SFX = {

    /* ---------- UI ---------- */
    tap: function () {
      noise({ freq: 3200, dur: 0.02, vol: 0.42, q: 1.2 });
      play({ freq: 240, slideTo: 110, type: 'sine', dur: 0.09, vol: 0.95, atk: 0.002 });
      play({ freq: 1800, type: 'triangle', dur: 0.015, vol: 0.25 });
    },
    pick: function () {
      play({ freq: 660, slideTo: 990, type: 'triangle', dur: 0.1, vol: 0.9 });
      noise({ freq: 5000, dur: 0.01, vol: 0.2 });
    },
    hover: function () {
      noise({ freq: 4800, dur: 0.012, vol: 0.28 });
    },
    scroll: function () {
      noise({ freq: 6500, dur: 0.008, vol: 0.32, q: 1.5 });
    },
    pop: function () {
      play({ freq: 950, slideTo: 220, type: 'sine', dur: 0.12, vol: 0.95 });
      noise({ freq: 2500, dur: 0.015, vol: 0.35 });
    },
    tick: function () {
      noise({ freq: 4200, dur: 0.015, vol: 0.55, q: 3 });
      play({ freq: 1800, type: 'square', dur: 0.012, vol: 0.3 });
    },

    /* ---------- Feedback ---------- */
    ok: function () {
      seq([
        { freq: 659.25, type: 'triangle', dur: 0.10, vol: 0.75, at: 0 },
        { freq: 987.77, type: 'triangle', dur: 0.18, vol: 0.80, at: 0.08 },
        { freq: 1318.5, type: 'sine',     dur: 0.14, vol: 0.30, at: 0.09 }
      ]);
    },
    err: function () {
      play({
        freq: 320, slideTo: 140, type: 'sawtooth',
        dur: 0.22, vol: 0.65,
        filter: 1400, filterTo: 300, q: 2
      });
      play({
        freq: 160, slideTo: 90, type: 'square',
        dur: 0.24, vol: 0.55, at: 0.02,
        filter: 800
      });
      noise({ freq: 600, dur: 0.03, vol: 0.15, at: 0 });
    },
    win: function () {
      var notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      for (var i = 0; i < notes.length; i++) {
        var f = notes[i];
        var at = i * 0.075;
        play({ freq: f, type: 'triangle', dur: 0.2, vol: 0.8, at: at, atk: 0.006 });
        play({ freq: f * 2, type: 'sine', dur: 0.16, vol: 0.22, at: at + 0.01 });
      }
      play({ freq: 2093, type: 'sine', dur: 0.5, vol: 0.18, at: 0.42, atk: 0.02 });
    },
    lose: function () {
      play({
        freq: 440, slideTo: 220, type: 'sawtooth',
        dur: 0.32, vol: 0.65,
        filter: 1800, filterTo: 300, q: 1.5
      });
      play({
        freq: 220, slideTo: 110, type: 'triangle',
        dur: 0.42, vol: 0.6, at: 0.06
      });
    },
    coin: function () {
      play({ freq: 987.77, type: 'square', dur: 0.075, vol: 0.6, atk: 0.002 });
      play({ freq: 1318.51, type: 'square', dur: 0.22, vol: 0.6, at: 0.06 });
      play({ freq: 493.88, type: 'triangle', dur: 0.08, vol: 0.3, at: 0 });
    },
    pickup: function () {
      play({ freq: 800, slideTo: 1700, type: 'triangle', dur: 0.1, vol: 0.85 });
      noise({ freq: 5500, dur: 0.015, vol: 0.28 });
      play({ freq: 2400, type: 'sine', dur: 0.06, vol: 0.15, at: 0.02 });
    },

    /* =========================================
       GAME METHODS — baru di v3.1
    ========================================= */

    /* Lompat (Flappy, Star Run) — Mario-style ascend */
    jump: function () {
      play({
        freq: 380, slideTo: 920, type: 'triangle',
        dur: 0.14, vol: 0.95, atk: 0.004
      });
      play({
        freq: 760, slideTo: 1500, type: 'sine',
        dur: 0.1, vol: 0.3, at: 0.02
      });
      noise({ freq: 3500, dur: 0.015, vol: 0.22, at: 0 });
    },

    /* Tabrakan (Ping Pong, Air Hockey, Billiard, Flappy) */
    hit: function () {
      noise({ freq: 2600, dur: 0.035, vol: 0.55, q: 1.2 });
      play({
        freq: 320, slideTo: 130, type: 'square',
        dur: 0.09, vol: 0.65, atk: 0.002,
        filter: 1400, filterTo: 400, q: 1.5
      });
    },

    /* Tembakan (Space Shooter, Ping Pong, Air Hockey) — laser pew */
    shoot: function () {
      play({
        freq: 1500, slideTo: 280, type: 'square',
        dur: 0.1, vol: 0.4,
        filter: 3200, filterTo: 800, q: 2
      });
      noise({ freq: 4200, dur: 0.02, vol: 0.22, q: 1.5 });
    },

    /* Ledakan (Space Shooter) — boom tebal */
    explode: function () {
      noise({ freq: 350, dur: 0.38, vol: 0.75, type: 'lowpass', q: 1.5 });
      play({
        freq: 200, slideTo: 55, type: 'sawtooth',
        dur: 0.38, vol: 0.55,
        filter: 900, filterTo: 180
      });
      play({
        freq: 80, slideTo: 40, type: 'triangle',
        dur: 0.3, vol: 0.4, at: 0.04
      });
    },

    /* Balik kartu (Memory Card, Tic Tac Toe) — chirp naik lalu turun */
    flip: function () {
      play({
        freq: 640, slideTo: 1280, type: 'triangle',
        dur: 0.075, vol: 0.75, atk: 0.003
      });
      play({
        freq: 1280, slideTo: 620, type: 'sine',
        dur: 0.06, vol: 0.4, at: 0.045
      });
    },

    /* Legacy alias */
    click: function () { SFX.tap(); },

    /* Controls */
    enable:    function () { CONFIG.enabled = true; },
    disable:   function () { CONFIG.enabled = false; },
    setVolume: function (v) {
      CONFIG.volume = Math.max(0, Math.min(1, v));
      updateMaster();
    },
    getVolume: function () { return CONFIG.volume; }
  };

  ['click', 'touchstart', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, resume, { once: true, passive: true });
  });

  window.SFX = SFX;
})();