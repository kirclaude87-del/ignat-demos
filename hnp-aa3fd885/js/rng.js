window.Hnp = window.Hnp || {};

// Случайные числа с зерном (mulberry32): одно зерно даёт одну и ту же последовательность.
Hnp.rng = Object.freeze({
  seeded(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
});
