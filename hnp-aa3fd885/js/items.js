window.Hnp = window.Hnp || {};

// Продукты по группам. Только однозначные: мороженое и подобное не берём, чтобы игрок не спорил с игрой.
(function () {
  const labels = {
    dairy: 'Молочное и яйца',
    veg: 'Овощи и фрукты',
    meat: 'Мясо и рыба',
    sweet: 'Сладкое',
  };

  const raw = [
    ['milk', '🥛', 'dairy'],
    ['cheese', '🧀', 'dairy'],
    ['butter', '🧈', 'dairy'],
    ['egg', '🥚', 'dairy'],
    ['carrot', '🥕', 'veg'],
    ['broccoli', '🥦', 'veg'],
    ['tomato', '🍅', 'veg'],
    ['cucumber', '🥒', 'veg'],
    ['apple', '🍎', 'veg'],
    ['banana', '🍌', 'veg'],
    ['steak', '🥩', 'meat'],
    ['chicken', '🍗', 'meat'],
    ['fish', '🐟', 'meat'],
    ['bacon', '🥓', 'meat'],
    ['shrimp', '🦐', 'meat'],
    ['chocolate', '🍫', 'sweet'],
    ['cake', '🍰', 'sweet'],
    ['donut', '🍩', 'sweet'],
    ['cookie', '🍪', 'sweet'],
    ['candy', '🍬', 'sweet'],
    ['cupcake', '🧁', 'sweet'],
  ];

  const catalog = Object.freeze(raw.map(([id, emoji, group]) => Object.freeze({ id, emoji, group })));

  Hnp.items = Object.freeze({
    groupLabels: Object.freeze(labels),
    catalog,
    byGroup(group) {
      return catalog.filter((item) => item.group === group);
    },
  });
})();
