window.Hnp = window.Hnp || {};

// Все числа игры в одном месте. Подбираются при тестах, см. описание игры.
Hnp.config = Object.freeze({
  MAX_LIVES: 3,
  LIFE_REGEN_MS: 300000, // +1 жизнь каждые 5 минут
  SHELF_CAPACITY: 4,
  GROUPS: Object.freeze(['dairy', 'veg', 'meat', 'sweet']),
  COOL_MS: 4000, // за сколько закрытый холодильник остывает с полного нагрева до нуля
  TIME_START_S: 120, // время 1-го уровня
  TIME_STEP_S: 5, // на столько секунд меньше с каждым уровнем
  TIME_MIN_S: 60,
  ITEMS_MIN: 8, // продуктов на 1-м уровне
  ITEMS_MAX: 16, // продуктов на уровне DIFFICULTY_CAP_LEVEL и дальше
  DIFFICULTY_CAP_LEVEL: 10,
  HEAT_FILL_MS_EASY: 15000, // за сколько открытая дверь заполняет шкалу на 1-м уровне
  HEAT_FILL_MS_HARD: 8000, // то же на уровне DIFFICULTY_CAP_LEVEL и дальше
  INTERSTITIAL_EVERY: 2, // реклама после каждого 2-го пройденного уровня
  SAVE_VERSION: 1,
  FREE_LEVELS: 3, // на уровнях 1–3 ошибки и перегрев не отнимают жизнь (новичок не уходит после двух проигрышей)
  FREEZER_FROM_LEVEL: 6, // с этого уровня появляется полка «Заморозка»
  FREEZER_GROUP: 'frozen',
});
