window.Hnp = window.Hnp || {};

// Жизни: максимум 3, +1 каждые 5 минут, даже когда игра закрыта.
// Запись {lives, nextAt}: nextAt — момент прихода следующей жизни (null, если жизней максимум).
// Все функции чистые: время nowMs приходит снаружи, входная запись не меняется.
(function () {
  'use strict';
  const C = Hnp.config;

  function sync(rec, nowMs) {
    if (rec.lives >= C.MAX_LIVES) return { lives: C.MAX_LIVES, nextAt: null };
    let lives = rec.lives;
    // Часы могли перевести назад: таймер не бывает дальше одного периода вперёд.
    let nextAt = rec.nextAt === null ? nowMs + C.LIFE_REGEN_MS : Math.min(rec.nextAt, nowMs + C.LIFE_REGEN_MS);
    if (nextAt <= nowMs) {
      const gained = 1 + Math.floor((nowMs - nextAt) / C.LIFE_REGEN_MS);
      lives = Math.min(C.MAX_LIVES, lives + gained);
      nextAt += gained * C.LIFE_REGEN_MS;
    }
    return lives >= C.MAX_LIVES ? { lives: C.MAX_LIVES, nextAt: null } : { lives, nextAt };
  }

  Hnp.lives = Object.freeze({
    initial() {
      return { lives: C.MAX_LIVES, nextAt: null };
    },

    sync,

    lose(rec, nowMs) {
      const cur = sync(rec, nowMs);
      const lives = Math.max(0, cur.lives - 1);
      return { lives, nextAt: cur.nextAt === null ? nowMs + C.LIFE_REGEN_MS : cur.nextAt };
    },

    add(rec, nowMs) {
      const cur = sync(rec, nowMs);
      const lives = Math.min(C.MAX_LIVES, cur.lives + 1);
      return { lives, nextAt: lives >= C.MAX_LIVES ? null : cur.nextAt };
    },

    msUntilNext(rec, nowMs) {
      if (rec.lives >= C.MAX_LIVES || rec.nextAt === null) return null;
      return Math.min(C.LIFE_REGEN_MS, Math.max(0, rec.nextAt - nowMs));
    },
  });
})();
