window.Hnp = window.Hnp || {};

// Формулы уровня и набор продуктов. Сложность растёт до DIFFICULTY_CAP_LEVEL, дальше не меняется.
(function () {
  const C = Hnp.config;

  function lvl(level) {
    return Math.max(1, Math.floor(level));
  }

  // Доля пути от лёгкого уровня (0) до потолка сложности (1).
  function ramp(level) {
    const k = Math.min(lvl(level), C.DIFFICULTY_CAP_LEVEL);
    return (k - 1) / (C.DIFFICULTY_CAP_LEVEL - 1);
  }

  function shuffle(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  Hnp.level = Object.freeze({
    // Полки уровня: с FREEZER_FROM_LEVEL сверху добавляется «Заморозка».
    groups(level) {
      return lvl(level) >= C.FREEZER_FROM_LEVEL ? [C.FREEZER_GROUP].concat(C.GROUPS) : C.GROUPS;
    },
    timeLimitMs(level) {
      return Math.max(C.TIME_MIN_S, C.TIME_START_S - C.TIME_STEP_S * (lvl(level) - 1)) * 1000;
    },

    itemCount(level) {
      return Math.round(C.ITEMS_MIN + (C.ITEMS_MAX - C.ITEMS_MIN) * ramp(level));
    },

    heatFillMs(level) {
      return Math.round(C.HEAT_FILL_MS_EASY - (C.HEAT_FILL_MS_EASY - C.HEAT_FILL_MS_HARD) * ramp(level));
    },

    // Продукты поровну по 4 группам (лишние достаются случайным группам), внутри группы разные, общий порядок случайный.
    generateBag(level, rng) {
      const n = Hnp.level.itemCount(level);
      const groups = shuffle(Hnp.level.groups(level), rng);
      const base = Math.floor(n / groups.length);
      const extra = n % groups.length;
      const picked = [];
      groups.forEach((group, i) => {
        const count = base + (i < extra ? 1 : 0);
        picked.push(...shuffle(Hnp.items.byGroup(group), rng).slice(0, count));
      });
      return shuffle(picked, rng);
    },
  });
})();
