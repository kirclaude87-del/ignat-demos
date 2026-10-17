window.Hnp = window.Hnp || {};

// Связывает всё: экран, правила раунда, жизни, сохранения и платформу.
// Время приходит снаружи (deps.now и вызовы step), поэтому игру можно проверять тестами без ожидания.
(function () {
  'use strict';

  const C = Hnp.config;

  function create(deps) {
    const { platform, store, now, rng } = deps;
    const audio = deps.audio || { play() {}, setMuted() {}, unlock() {} }; // без звука тоже можно
    const view = Hnp.view.create(deps.root);
    let progress = null; // Progress: уровень, жизни, момент сохранения
    let gs = null; // GameState текущего уровня
    let screen = null; // 'start' | 'won' | 'nolives' | null (null — идёт игра)
    let busy = false; // идёт реклама: повторные нажатия игнорируем, время стоит
    let paused = false; // платформа поставила игру на паузу (реклама, свёрнутая вкладка)
    let completedSinceInterstitial = 0; // пройдено уровней с последней рекламы между уровнями
    let rewardedDuringLevel = false; // на этом уровне уже смотрели рекламу за жизнь

    function nextInMs() {
      return Hnp.lives.msUntilNext(progress.lives, now());
    }

    function render() {
      view.render({
        level: gs ? gs.level : progress.level,
        gs,
        lives: progress.lives.lives,
        nextInMs: nextInMs(),
        online: platform.isOnline(),
      });
    }

    function setScreen(name, data) {
      screen = name;
      view.showScreen(name, data);
    }

    // Сохраняем только при потере жизни, победе и выдаче жизни, не каждый кадр.
    function save() {
      store.save(progress).catch(() => {});
    }

    function startLevel() {
      gs = Hnp.state.create(progress.level, rng);
      platform.gameplayStart();
      setScreen(null);
      render();
    }

    function showNoLives() {
      platform.gameplayStop();
      setScreen('nolives', { nextInMs: nextInMs(), canWatchAd: platform.isOnline() });
      render();
    }

    // Жизнь пришла, пока висел экран «Жизней нет»: тот же уровень начинается заново.
    function resumeAfterNoLives() {
      if (gs) {
        Hnp.state.restart(gs);
        platform.gameplayStart();
        setScreen(null);
        render();
      } else {
        startLevel();
      }
    }

    function loseLife() {
      progress.lives = Hnp.lives.lose(progress.lives, now());
      save();
      if (progress.lives.lives === 0) showNoLives();
      else render();
    }

    // Жизнь за рекламу: и с экрана «Жизней нет», и кнопкой «+❤️» посреди уровня.
    // Награда только по результату 'rewarded'; любой другой исход жизни не даёт, игра продолжается.
    async function requestLifeByAd() {
      if (busy || !progress || !platform.isOnline() || progress.lives.lives >= C.MAX_LIVES) return;
      busy = true;
      const wasPlaying = playing();
      if (wasPlaying) platform.gameplayStop();
      audio.setMuted(true);
      try {
        const result = await platform.showRewarded();
        if (result !== 'error') rewardedDuringLevel = true;
        if (result === 'rewarded') {
          progress.lives = Hnp.lives.add(progress.lives, now());
          save();
          if (screen === 'nolives') {
            resumeAfterNoLives();
          } else {
            if (wasPlaying) platform.gameplayStart();
            render();
          }
        } else {
          view.toast(result === 'closed' ? 'Жизнь даётся за просмотр до конца' : 'Реклама недоступна, подожди новую жизнь');
          if (wasPlaying) platform.gameplayStart();
        }
      } finally {
        busy = false;
        audio.setMuted(paused);
      }
    }

    function onWin() {
      audio.play('win');
      progress.level += 1;
      completedSinceInterstitial += 1;
      save();
      platform.gameplayStop();
      setScreen('won', { level: gs.level });
      render();
    }

    const playing = () => screen === null && gs !== null && gs.status === 'playing';

    view.bind({
      handle() {
        if (!playing() || gs.doorOpen) return;
        Hnp.state.toggleDoor(gs);
        audio.play('open');
        render();
      },
      door() {
        if (!playing() || !gs.doorOpen) return;
        Hnp.state.toggleDoor(gs);
        audio.play('close');
        render();
      },
      shelf(group) {
        if (!playing()) return;
        const result = Hnp.state.place(gs, group);
        if (result === 'ok') {
          audio.play('place');
          render();
          if (gs.status === 'won') onWin();
        } else if (result === 'closed') {
          view.toast('Открой холодильник');
        } else if (result === 'wrong') {
          audio.play('wrong');
          view.shake(null);
          loseLife();
        }
      },
      play() {
        if (screen !== 'start') return;
        audio.unlock(); // первое нажатие игрока: теперь можно включать звук
        progress.lives = Hnp.lives.sync(progress.lives, now());
        if (progress.lives.lives === 0) showNoLives();
        else startLevel();
      },
      next() {
        if (screen !== 'won' || busy) return;
        const showAd = Hnp.adsPolicy.shouldShowInterstitial({
          completedSinceInterstitial,
          rewardedSinceLastLevel: rewardedDuringLevel,
          online: platform.isOnline(),
        });
        rewardedDuringLevel = false;
        if (!showAd) {
          startLevel();
          return;
        }
        busy = true;
        audio.setMuted(true);
        platform
          .showInterstitial()
          .catch(() => false)
          .then(() => {
            completedSinceInterstitial = 0;
            busy = false;
            audio.setMuted(paused);
            startLevel();
          });
      },
      addLife: requestLifeByAd,
      watchAd: requestLifeByAd,
    });

    // Пока платформа держит паузу (реклама, свёрнутая вкладка), step ничего не двигает.
    const pause = () => {
      paused = true;
      audio.setMuted(true);
    };
    const resume = () => {
      paused = false;
      audio.setMuted(false);
    };
    platform.onPause(pause);
    platform.onResume(resume);

    return {
      async start() {
        progress = await store.load();
        progress.lives = Hnp.lives.sync(progress.lives, now());
        setScreen('start', { level: progress.level });
        render();
        platform.loadingReady();
      },

      // Один кадр игры: dtMs миллисекунд прошло с прошлого кадра.
      step(dtMs) {
        if (!progress || paused || busy) return;
        progress.lives = Hnp.lives.sync(progress.lives, now());
        if (screen === 'nolives') {
          if (progress.lives.lives > 0) {
            resumeAfterNoLives();
          } else {
            view.showScreen('nolives', { nextInMs: nextInMs(), canWatchAd: platform.isOnline() });
            render();
          }
          return;
        }
        if (!playing()) {
          render();
          return;
        }
        const event = Hnp.state.tick(gs, dtMs);
        if (event === 'heat_full') {
          audio.play('slam');
          view.slam();
          loseLife();
        } else if (event === 'timeout') {
          audio.play('timeup');
          view.toast('Время вышло, начинаем заново');
          Hnp.state.restart(gs);
        }
        render();
      },

      pause,
      resume,
      gs: () => gs,
      screen: () => screen,
      progress: () => Object.assign({}, progress, { lives: Object.assign({}, progress.lives) }),
    };
  }

  Hnp.app = Object.freeze({ create });
})();
