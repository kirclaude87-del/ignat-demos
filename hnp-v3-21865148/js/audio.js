window.Hnp = window.Hnp || {};

// Звуки без файлов: короткие тоны WebAudio. Контекст создаётся только в unlock() (первое нажатие игрока),
// иначе iPhone не даёт звук. Любая беда с аудио молча глотается: игра важнее звука.
// Audio = {play(name), setMuted(bool), unlock()}
(function () {
  'use strict';

  // Каждый звук: набор нот {f: частота Гц, t: старт в секундах, d: длительность, type: форма волны}
  const SOUNDS = {
    open: [{ f: 320, t: 0, d: 0.08, type: 'triangle' }, { f: 480, t: 0.07, d: 0.1, type: 'triangle' }],
    close: [{ f: 420, t: 0, d: 0.07, type: 'triangle' }, { f: 260, t: 0.06, d: 0.1, type: 'triangle' }],
    place: [{ f: 660, t: 0, d: 0.07 }, { f: 880, t: 0.06, d: 0.09 }],
    wrong: [{ f: 180, t: 0, d: 0.22, type: 'sawtooth' }],
    slam: [{ f: 110, t: 0, d: 0.25, type: 'square' }],
    win: [{ f: 523, t: 0, d: 0.1 }, { f: 659, t: 0.1, d: 0.1 }, { f: 784, t: 0.2, d: 0.2 }],
    timeup: [{ f: 300, t: 0, d: 0.12, type: 'triangle' }, { f: 220, t: 0.12, d: 0.22, type: 'triangle' }],
  };

  function create(AudioCtor) {
    let ctx = null;
    let muted = false;

    return {
      unlock() {
        if (!AudioCtor) return;
        try {
          if (!ctx) ctx = new AudioCtor();
          if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
        } catch (e) {
          ctx = null;
        }
      },

      setMuted(value) {
        muted = !!value;
      },

      play(name) {
        const notes = SOUNDS[name];
        if (!ctx || muted || !notes) return;
        try {
          const start = ctx.currentTime;
          notes.forEach((n) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = n.type || 'sine';
            osc.frequency.value = n.f;
            gain.gain.setValueAtTime(0.12, start + n.t);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + n.t + n.d);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start + n.t);
            osc.stop(start + n.t + n.d + 0.02);
          });
        } catch (e) {
          // звук не получился: ничего страшного
        }
      },
    };
  }

  Hnp.audio = Object.freeze({ create });
})();
