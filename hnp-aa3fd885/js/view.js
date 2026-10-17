window.Hnp = window.Hnp || {};

// Экран: сам вписывает разметку в переданный корень и рисует по состоянию игры.
// Здесь нет игровых правил: только показать то, что ему дали, и сообщить о нажатиях.
(function () {
  'use strict';
  const C = Hnp.config;

  const GROUP_ICONS = { dairy: '🥛', veg: '🥦', meat: '🍗', sweet: '🍰' };

  function fmt(ms) {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  function shelvesMarkup() {
    return C.GROUPS.map(
      (g) =>
        '<div class="sh" data-shelf="' + g + '">' +
        '<span class="tag">' + GROUP_ICONS[g] + ' ' + Hnp.items.groupLabels[g] + '</span>' +
        '<div class="row">' + '<span class="slot"></span>'.repeat(C.SHELF_CAPACITY) + '</div>' +
        '</div>'
    ).join('');
  }

  function markup() {
    return (
      '<div class="top">' +
        '<div class="lives">' +
          '<span class="hearts" data-role="hearts"></span>' +
          '<button class="add-life" data-role="add-life" hidden>+❤️ за рекламу</button>' +
          '<span class="tm" data-role="next-life"></span>' +
        '</div>' +
        '<div class="clock"><span class="lvl" data-role="level"></span><span class="timer" data-role="timer"></span></div>' +
      '</div>' +
      '<div class="heat"><i data-role="heat"></i></div>' +
      '<div class="hl" data-role="heat-label"></div>' +
      '<div class="room">' +
        '<div class="win">🌙</div><div class="plant">🪴</div><div class="glow"></div>' +
        '<div class="frg" data-role="fridge">' +
          '<div class="door" data-role="door" hidden></div>' +
          '<span class="hd2"></span><button class="hd" data-role="handle" aria-label="Открыть холодильник"></button>' +
          '<div class="fi">' + shelvesMarkup() + '</div>' +
        '</div>' +
        '<div class="tip tip-open" data-role="tip-open">нажми на ручку</div>' +
        '<div class="tip tip-close" data-role="tip-close" hidden>◀ нажми на дверь</div>' +
        '<div class="floor"></div>' +
      '</div>' +
      '<div class="bag" data-role="bag">' +
        '<div class="cur" data-role="bag-current"></div>' +
        '<div class="nx"><b data-role="bag-hint"></b><div>дальше: <span data-role="bag-next"></span></div></div>' +
      '</div>' +
      '<div class="toast" data-role="toast" hidden></div>' +
      '<div class="screen" data-screen="start" hidden>' +
        '<div class="card"><h1>Хаос на полках</h1><p data-role="start-level"></p>' +
        '<button class="big" data-role="play">Играть</button></div>' +
      '</div>' +
      '<div class="screen" data-screen="won" hidden>' +
        '<div class="card"><h1>Уровень пройден!</h1><p data-role="won-level"></p>' +
        '<button class="big" data-role="next">Дальше</button></div>' +
      '</div>' +
      '<div class="screen" data-screen="nolives" hidden>' +
        '<div class="card"><h1>Жизней нет</h1><p>Новая жизнь через <b data-role="wait-timer"></b></p>' +
        '<button class="big" data-role="watch-ad" hidden>+1 ❤️ за рекламу</button></div>' +
      '</div>'
    );
  }

  function create(root) {
    root.classList.add('hnp', 'door-closed');
    root.innerHTML = markup();

    const el = (role) => root.querySelector('[data-role=' + role + ']');
    const els = {
      hearts: el('hearts'), addLife: el('add-life'), nextLife: el('next-life'),
      level: el('level'), timer: el('timer'), heat: el('heat'), heatLabel: el('heat-label'),
      fridge: el('fridge'), door: el('door'), handle: el('handle'),
      tipOpen: el('tip-open'), tipClose: el('tip-close'),
      bag: el('bag'), bagCurrent: el('bag-current'), bagNext: el('bag-next'), bagHint: el('bag-hint'),
      toast: el('toast'), startLevel: el('start-level'), wonLevel: el('won-level'),
      waitTimer: el('wait-timer'), watchAd: el('watch-ad'),
    };
    const shelfEls = {};
    C.GROUPS.forEach((g) => {
      shelfEls[g] = root.querySelector('[data-shelf=' + g + ']');
    });
    const screens = ['start', 'won', 'nolives'].map((name) => ({ name, el: root.querySelector('[data-screen=' + name + ']') }));

    let handlers = {};
    let toastTimer = null;
    let wasOpen = false;

    // Меню браузера по правому клику и долгому нажатию не нужно (требование Яндекса 1.6.1.8 и 1.6.2.7).
    root.addEventListener('contextmenu', (e) => e.preventDefault());

    root.addEventListener('click', (e) => {
      const target = e.target.closest('[data-role], [data-shelf]');
      if (!target || !root.contains(target)) return;
      if (target.dataset.shelf) {
        if (handlers.shelf) handlers.shelf(target.dataset.shelf);
        return;
      }
      const map = {
        handle: 'handle', door: 'door', 'add-life': 'addLife', play: 'play', next: 'next', 'watch-ad': 'watchAd',
      };
      const name = map[target.dataset.role];
      if (name && handlers[name]) handlers[name]();
    });

    function pulse(node, cls, ms) {
      if (!node) return;
      node.classList.add(cls);
      setTimeout(() => node.classList.remove(cls), ms);
    }

    return {
      render(m) {
        const gs = m.gs;
        const open = !!(gs && gs.doorOpen);
        // Сразу после открытия под пальцем, нажавшим на ручку, оказывается полка: 300 мс полки не принимают нажатия,
        // иначе второй тап двойного нажатия положит туда продукт и отнимет жизнь.
        if (open && !wasOpen) {
          root.classList.add('just-opened');
          setTimeout(() => root.classList.remove('just-opened'), 300);
        }
        wasOpen = open;
        root.classList.toggle('door-open', open);
        root.classList.toggle('door-closed', !open);
        els.handle.hidden = open;
        els.door.hidden = !open;
        els.tipOpen.hidden = open;
        els.tipClose.hidden = !open;

        els.level.textContent = 'Уровень ' + m.level;
        els.timer.textContent = gs ? fmt(gs.timeLeftMs) : '';
        els.hearts.textContent = '❤️'.repeat(m.lives) + '🖤'.repeat(Math.max(0, C.MAX_LIVES - m.lives));
        els.nextLife.textContent = m.nextInMs === null || m.nextInMs === undefined ? '' : 'новая жизнь через ' + fmt(m.nextInMs);
        els.addLife.hidden = !(m.lives < C.MAX_LIVES && m.online);

        els.heat.style.width = Math.round((gs ? gs.heat : 0) * 100) + '%';
        els.heatLabel.textContent = open ? '🔥 Дверь открыта! Закрой скорее' : '❄️ Холодильник остывает';

        els.bagCurrent.textContent = gs && gs.bag.length ? gs.bag[0].emoji : '';
        els.bagNext.textContent = gs ? gs.bag.slice(1, 4).map((i) => i.emoji).join(' ') : '';
        els.bagHint.textContent = open ? 'Клади на полку' : 'Открой холодильник';

        C.GROUPS.forEach((g) => {
          const items = gs ? gs.shelves[g] : [];
          shelfEls[g].querySelectorAll('.slot').forEach((slot, i) => {
            slot.textContent = items[i] ? items[i].emoji : '';
            slot.classList.toggle('filled', !!items[i]);
          });
        });
      },

      bind(h) {
        handlers = h;
      },

      showScreen(name, data) {
        data = data || {};
        screens.forEach((s) => {
          s.el.hidden = s.name !== name;
        });
        if (name === 'start' && data.level !== undefined) els.startLevel.textContent = 'Уровень ' + data.level;
        if (name === 'won' && data.level !== undefined) els.wonLevel.textContent = 'Уровень ' + data.level;
        if (name === 'nolives') {
          els.waitTimer.textContent = data.nextInMs === null || data.nextInMs === undefined ? '' : fmt(data.nextInMs);
          els.watchAd.hidden = !data.canWatchAd;
        }
      },

      toast(text) {
        els.toast.textContent = text;
        els.toast.hidden = false;
        els.toast.classList.remove('show');
        void els.toast.offsetWidth; // перезапуск анимации
        els.toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
          els.toast.hidden = true;
        }, 2200);
      },

      shake(group) {
        pulse(group ? shelfEls[group] : els.bag, 'shake', 450);
      },

      slam() {
        pulse(els.fridge, 'slam', 500);
      },
    };
  }

  Hnp.view = Object.freeze({ create });
})();
