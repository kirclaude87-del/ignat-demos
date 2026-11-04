window.Hnp = window.Hnp || {};

// Звёзды за уровень: 3 — без ошибок и быстро. Каждая ошибка −1 (но не больше двух),
// меньше 30% времени в запасе −1, меньше одной звезды не бывает.
// Карта лучших результатов: {номер уровня: звёзды}.
(function () {
  'use strict';
  const FAST_SHARE = 0.3;

  Hnp.stars = Object.freeze({
    compute(r) {
      const slow = r.timeLeftMs / r.timeLimitMs < FAST_SHARE ? 1 : 0;
      return Math.max(1, 3 - Math.min(2, r.mistakes) - slow);
    },
    // Новая карта: худший результат старый лучший не перезаписывает.
    best(map, level, stars) {
      const out = Object.assign({}, map);
      if (!(out[level] >= stars)) out[level] = stars;
      return out;
    },
    total(map) {
      return Object.keys(map).reduce((n, k) => n + map[k], 0);
    },
    line(stars) {
      return '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    },
  });
})();
