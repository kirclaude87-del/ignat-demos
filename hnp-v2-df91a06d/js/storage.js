window.Hnp = window.Hnp || {};

// Сохранения: облако Яндекса (если есть) плюс локальная копия. Побеждает запись, сохранённая позже.
// Progress = {v, level, lives: {lives, nextAt}, savedAt}, где level — уровень, который игрок пройдёт следующим.
(function () {
  'use strict';
  const C = Hnp.config;
  const KEY = 'hnp-progress';

  function defaults(nowMs) {
    return { v: C.SAVE_VERSION, level: 1, lives: { lives: C.MAX_LIVES, nextAt: null }, stars: {}, savedAt: nowMs };
  }

  function isObject(x) {
    return typeof x === 'object' && x !== null && !Array.isArray(x);
  }

  function isNumber(x) {
    return typeof x === 'number' && Number.isFinite(x);
  }

  // Звёзды {уровень: 1..3}: всё кривое выбрасываем.
  function parseStars(raw) {
    const out = {};
    if (!isObject(raw)) return out;
    Object.keys(raw).forEach((k) => {
      const level = Number(k);
      const s = raw[k];
      if (Number.isInteger(level) && level >= 1 && Number.isInteger(s) && s >= 1 && s <= 3) out[level] = s;
    });
    return out;
  }
  // Разбирает запись и чинит поля; null, если это не наша запись (не объект или чужая версия).
  function parse(raw, nowMs) {
    if (!isObject(raw) || raw.v !== C.SAVE_VERSION) return null;
    const level = isNumber(raw.level) ? Math.max(1, Math.floor(raw.level)) : 1;
    const l = isObject(raw.lives) ? raw.lives : {};
    const lives = isNumber(l.lives) ? Math.min(C.MAX_LIVES, Math.max(0, Math.floor(l.lives))) : C.MAX_LIVES;
    let nextAt = isNumber(l.nextAt) ? l.nextAt : null;
    if (lives >= C.MAX_LIVES) nextAt = null;
    else if (nextAt === null) nextAt = nowMs + C.LIFE_REGEN_MS;
    return { v: C.SAVE_VERSION, level, lives: { lives, nextAt }, stars: parseStars(raw.stars), savedAt: isNumber(raw.savedAt) ? raw.savedAt : 0 };
  }

  function validate(raw, nowMs) {
    return parse(raw, nowMs) || defaults(nowMs);
  }

  function createStore(deps) {
    const timeoutMs = deps.timeoutMs === undefined ? 3000 : deps.timeoutMs;

    function readLocal() {
      try {
        const s = deps.local.getItem(KEY);
        return s === null ? null : JSON.parse(s);
      } catch (e) {
        return null;
      }
    }

    // Облако может упасть, бросить сразу или вообще не ответить: во всех случаях отдаём null.
    function readCloud() {
      if (!deps.cloud) return Promise.resolve(null);
      let pending;
      try {
        pending = Promise.resolve(deps.cloud.getData());
      } catch (e) {
        return Promise.resolve(null);
      }
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), timeoutMs);
        pending.then(
          (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          () => {
            clearTimeout(timer);
            resolve(null);
          }
        );
      });
    }

    return {
      async load() {
        const now = deps.now();
        const cloudRaw = await readCloud();
        const found = [parse(cloudRaw, now), parse(readLocal(), now)].filter(Boolean);
        if (found.length === 0) return defaults(now);
        return found.reduce((best, c) => (c.savedAt > best.savedAt ? c : best));
      },

      // Локальная запись сразу, облако «в фоне»: игра не ждёт ответа облака.
      save(progress) {
        const record = Object.assign({}, progress, { v: C.SAVE_VERSION, savedAt: deps.now() });
        try {
          deps.local.setItem(KEY, JSON.stringify(record));
        } catch (e) {
          // localStorage может быть недоступен (приватный режим): тогда живём на облаке
        }
        if (deps.cloud) {
          try {
            Promise.resolve(deps.cloud.setData(record)).catch(() => {});
          } catch (e) {
            // облако недоступно: локальная копия уже записана
          }
        }
        return Promise.resolve();
      },
    };
  }

  Hnp.storage = Object.freeze({ defaults, validate, createStore });
})();
