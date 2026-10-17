// Запуск в браузере: собираем настоящие зависимости и крутим кадры.
(async function () {
  let local;
  try {
    local = window.localStorage;
  } catch (e) {
    local = { getItem: () => null, setItem: () => {} }; // доступ к localStorage запрещён
  }
  const platform = await Hnp.platform.create(window);
  const store = Hnp.storage.createStore({ cloud: platform.cloud, local, now: Date.now });
  const audio = Hnp.audio.create(window.AudioContext || window.webkitAudioContext);
  const app = Hnp.app.create({ root: document.getElementById('app'), platform, store, now: Date.now, rng: Math.random, audio });
  await app.start();

  let prev = null;
  function frame(ts) {
    // не больше 100 мс за кадр, чтобы после паузы время не прыгало
    if (prev !== null) app.step(Math.min(ts - prev, 100));
    prev = ts;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
