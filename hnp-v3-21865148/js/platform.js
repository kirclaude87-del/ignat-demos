window.Hnp = window.Hnp || {};

// Всё общение с SDK Яндекс Игр — только здесь. Без SDK (открыли файл локально) работает заглушка.
// Platform = {isStub, loadingReady, gameplayStart, gameplayStop, onPause, onResume,
//             showInterstitial: Promise<boolean>, showRewarded: Promise<'rewarded'|'closed'|'error'>, cloud, isOnline}
// Промисы рекламы никогда не отклоняются: любая беда превращается в false или 'error'.
(function () {
  'use strict';

  // Заглушка для игры без Яндекса и для тестов. calls хранит вызовы по порядку.
  function createStub(opts) {
    opts = opts || {};
    const rewarded = opts.rewarded || 'rewarded';
    let online = opts.online !== false;
    const calls = [];
    const pauseCallbacks = [];
    const resumeCallbacks = [];
    return {
      isStub: true,
      calls,
      loadingReady() {
        calls.push('ready');
      },
      gameplayStart() {
        calls.push('gameplayStart');
      },
      gameplayStop() {
        calls.push('gameplayStop');
      },
      onPause(cb) {
        pauseCallbacks.push(cb);
      },
      onResume(cb) {
        resumeCallbacks.push(cb);
      },
      showInterstitial() {
        calls.push('interstitial');
        return Promise.resolve(opts.interstitial !== false);
      },
      showRewarded() {
        calls.push('rewarded');
        return Promise.resolve(rewarded);
      },
      cloud: null,
      isOnline() {
        return online;
      },
      setOnline(value) {
        online = !!value;
      },
      firePause() {
        pauseCallbacks.forEach((cb) => cb());
      },
      fireResume() {
        resumeCallbacks.forEach((cb) => cb());
      },
    };
  }

  // SDK может зависнуть и не ответить никогда: ждём не дольше ms, иначе считаем это отказом.
  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('SDK не ответил за ' + ms + ' мс')), ms);
      Promise.resolve(promise).then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  async function makeCloud(ysdk, timeoutMs) {
    try {
      const player = await withTimeout(ysdk.getPlayer(), timeoutMs);
      return {
        async getData() {
          const data = await player.getData(['progress']);
          return (data && data.progress) || null;
        },
        setData(progress) {
          return player.setData({ progress });
        },
      };
    } catch (e) {
      return null;
    }
  }

  // Заглушка для запуска без Яндекса: свёрнутая вкладка работает как пауза платформы.
  function stubFor(win, opts) {
    const stub = createStub(opts);
    const doc = win && win.document;
    if (doc && doc.addEventListener) {
      doc.addEventListener('visibilitychange', () => (doc.hidden ? stub.firePause() : stub.fireResume()));
    }
    return stub;
  }

  // Запуск на Яндексе, но SDK сломался или молчит: играть можно, а рекламы нет (жизни за рекламу не выдаём даром).
  const NO_ADS = { online: false, rewarded: 'error', interstitial: false };

  // opts.timeoutMs: сколько ждать SDK и игрока (по умолчанию 5 секунд).
  async function create(win, opts) {
    const timeoutMs = opts && opts.timeoutMs !== undefined ? opts.timeoutMs : 5000;
    if (!win || !win.YaGames) return stubFor(win);
    let ysdk;
    try {
      ysdk = await withTimeout(win.YaGames.init(), timeoutMs);
    } catch (e) {
      return stubFor(win, NO_ADS);
    }
    const features = ysdk.features || {};
    const cloud = await makeCloud(ysdk, timeoutMs);

    return {
      isStub: false,
      loadingReady() {
        if (features.LoadingAPI) features.LoadingAPI.ready();
      },
      gameplayStart() {
        if (features.GameplayAPI) features.GameplayAPI.start();
      },
      gameplayStop() {
        if (features.GameplayAPI) features.GameplayAPI.stop();
      },
      onPause(cb) {
        ysdk.on('game_api_pause', cb);
      },
      onResume(cb) {
        ysdk.on('game_api_resume', cb);
      },
      showInterstitial() {
        return new Promise((resolve) => {
          try {
            ysdk.adv.showFullscreenAdv({
              callbacks: {
                onClose: (wasShown) => resolve(!!wasShown),
                onError: () => resolve(false),
              },
            });
          } catch (e) {
            resolve(false);
          }
        });
      },
      // Награда засчитывается только если сработал onRewarded; закрыли раньше — 'closed'.
      showRewarded() {
        return new Promise((resolve) => {
          let rewarded = false;
          try {
            ysdk.adv.showRewardedVideo({
              callbacks: {
                onRewarded: () => {
                  rewarded = true;
                },
                onClose: () => resolve(rewarded ? 'rewarded' : 'closed'),
                onError: () => resolve('error'),
              },
            });
          } catch (e) {
            resolve('error');
          }
        });
      },
      cloud,
      isOnline() {
        return win.navigator ? win.navigator.onLine !== false : true;
      },
    };
  }

  Hnp.platform = Object.freeze({ create, createStub });
})();
