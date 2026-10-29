// Стакан наполняется, пока листаешь: progress 0..1 -> слои жидкости, слова, подписи.
(() => {
  const scene = document.getElementById("scene");
  if (!scene) return;

  const $ = (s) => [...scene.querySelectorAll(s)];
  const words = $(".word"), caps = $(".cap"), dots = $(".meter i");
  const layer = {
    esp: document.getElementById("lEsp"),
    milk: document.getElementById("lMilk"),
    foam: document.getElementById("lFoam"),
  };
  const ice = $(".cube");

  // Размеры слоёв в единицах рисунка: дно стакана y=496
  const BOTTOM = 496, H_ESP = 110, H_MILK = 230, H_FOAM = 60;
  // Где начинается и кончается каждый этап (доля прокрутки)
  const T = { esp: [0.10, 0.34], milk: [0.34, 0.60], foam: [0.60, 0.78], ice: [0.78, 0.95] };
  const STAGE_START = [0, 0.10, 0.34, 0.60, 0.78];

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const seg = (p, [a, b]) => ease(clamp((p - a) / (b - a)));

  function stageOf(p) {
    let s = 0;
    STAGE_START.forEach((start, i) => { if (p >= start) s = i; });
    return s;
  }

  function render(p) {
    window.__sloiState = Object.assign(window.__sloiState || {}, { p });
    window.__sloiGL?.onProgress?.(p);
    const yEsp = BOTTOM + 14 - (H_ESP + 14) * seg(p, T.esp); // +14: слой стартует ниже дна, размытие не просвечивает
    const yMilk = yEsp - H_MILK * seg(p, T.milk);
    const yFoam = yMilk - H_FOAM * seg(p, T.foam);
    // верх каждого слоя считается от верха слоя под ним, поэтому пустой этап ничего не рисует
    layer.esp.setAttribute("y", yEsp);
    layer.milk.setAttribute("y", yMilk);
    layer.foam.setAttribute("y", yFoam);

    const i = seg(p, T.ice);
    ice.forEach((c, n) => {
      const k = clamp(i * 1.6 - n * 0.12);
      c.style.opacity = k;
      c.style.scale = 0.6 + 0.4 * k;
    });
  }

  let shown = -1;
  function setStage(s) {
    if (s === shown) return;
    shown = s;
    window.__sloiState = Object.assign(window.__sloiState || {}, { stage: s });
    window.__sloiGL?.onStage?.(s);
    words.forEach((el, n) => el.classList.toggle("on", n === s));
    caps.forEach((el, n) => el.classList.toggle("on", n === s));
    dots.forEach((el, n) => el.classList.toggle("on", n === s));
  }

  // Стакан наливается один раз: прогресс только растёт, при прокрутке вверх он остаётся налитым
  let peak = 0;
  function target() {
    const r = scene.getBoundingClientRect();
    const total = scene.offsetHeight - window.innerHeight;
    peak = Math.max(peak, clamp(-r.top / total));
    window.__sloiState = Object.assign(window.__sloiState || {}, { peak });
    return peak;
  }

  // Режим для проверок: ?p=0.5 фиксирует прогресс (скриншоты, тесты)
  const forced = new URLSearchParams(location.search).get("p");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (forced !== null || reduce) {
    const p = forced !== null ? clamp(parseFloat(forced) || 0) : 1;
    if (forced === null) scene.classList.add("static");
    render(p);
    setStage(forced !== null ? stageOf(p) : 0);
    return;
  }

  let cur = 0, goal = target(), raf = 0;
  function tick() {
    cur += (goal - cur) * 0.14;
    if (Math.abs(goal - cur) < 0.0005) cur = goal;
    render(cur);
    setStage(stageOf(goal));
    raf = cur === goal ? 0 : requestAnimationFrame(tick);
  }
  function onScroll() {
    goal = target();
    setStage(stageOf(goal));
    if (!raf) raf = requestAnimationFrame(tick);
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  render(cur);
  onScroll();
})();

// Бронь столика: проверка полей и ответ на странице (демо, никуда не отправляем)
(() => {
  const form = document.getElementById("bookForm");
  if (!form) return;
  const sel = document.getElementById("timeSel");
  for (let h = 8; h <= 21; h++) {
    const o = document.createElement("option");
    o.textContent = `${String(h).padStart(2, "0")}:00`;
    if (h === 19) o.selected = true;
    sel.append(o);
  }
  const msg = document.getElementById("bookMsg");
  const say = (text, err) => { msg.textContent = text; msg.classList.toggle("err", !!err); };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    const digits = form.elements.phone.value.replace(/\D/g, "");
    form.elements.name.classList.toggle("bad", name.length < 2);
    form.elements.phone.classList.toggle("bad", digits.length < 10);
    if (name.length < 2) return say("Напиши имя, чтобы мы знали, как к тебе обращаться.", true);
    if (digits.length < 10) return say("В телефоне должно быть 10 цифр после +7.", true);
    say(`Готово, ${name}! Столик на ${form.elements.time.value}, гостей: ${form.elements.guests.value}. Это демо, заявка никуда не ушла.`);
    form.reset();
    sel.value = "19:00";
  });
})();
