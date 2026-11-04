window.Hnp = window.Hnp || {};

// Один раунд: дверь, нагрев, время, раскладка. Жизни тут не трогаются:
// 'wrong' и 'heat_full' — сигналы для app.js, он решает, что с ними делать.
(function () {
  'use strict';
  const C = Hnp.config;

  function emptyShelves(level) {
    const shelves = {};
    Hnp.level.groups(level).forEach((g) => {
      shelves[g] = [];
    });
    return shelves;
  }

  Hnp.state = Object.freeze({
    create(level, rng) {
      const bag = Hnp.level.generateBag(level, rng);
      return {
        level,
        bag: bag.slice(),
        initialBag: bag.slice(),
        shelves: emptyShelves(level),
        doorOpen: false,
        heat: 0,
        timeLeftMs: Hnp.level.timeLimitMs(level),
        status: 'playing',
        mistakes: 0, // не та полка или перегрев: для звёзд
      };
    },

    toggleDoor(gs) {
      if (gs.status === 'won') return;
      gs.doorOpen = !gs.doorOpen;
    },

    // 'ok' — продукт лёг на полку; 'wrong' — не та полка; 'closed' — дверь закрыта; 'done' — уровень уже пройден.
    place(gs, group) {
      if (gs.status === 'won') return 'done';
      if (!gs.doorOpen) return 'closed';
      const item = gs.bag[0];
      if (item.group !== group) {
        gs.mistakes += 1;
        return 'wrong';
      }
      gs.bag.shift();
      gs.shelves[group].push(item);
      if (gs.bag.length === 0) gs.status = 'won';
      return 'ok';
    },

    // null — ничего не случилось; 'timeout' — время вышло (уровень надо начать заново);
    // 'heat_full' — шкала полна: дверь захлопнулась сама, шкала сброшена (минус жизнь).
    tick(gs, dtMs) {
      if (gs.status !== 'playing') return null;
      gs.timeLeftMs = Math.max(0, gs.timeLeftMs - dtMs);
      if (gs.doorOpen) {
        gs.heat = Math.min(1, gs.heat + dtMs / Hnp.level.heatFillMs(gs.level));
      } else {
        gs.heat = Math.max(0, gs.heat - dtMs / C.COOL_MS);
      }
      if (gs.timeLeftMs <= 0) return 'timeout';
      if (gs.heat >= 1) {
        gs.doorOpen = false;
        gs.heat = 0;
        gs.mistakes += 1;
        return 'heat_full';
      }
      return null;
    },

    restart(gs) {
      gs.bag = gs.initialBag.slice();
      gs.shelves = emptyShelves(gs.level);
      gs.mistakes = 0;
      gs.doorOpen = false;
      gs.heat = 0;
      gs.timeLeftMs = Hnp.level.timeLimitMs(gs.level);
      gs.status = 'playing';
    },
  });
})();
