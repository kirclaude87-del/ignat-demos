// «Ладошка»: ростомер на стене, появление частей раздела, выбор времени приёма. Всё это улучшение: без скриптов страница читается целиком.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // 1. Появление частей раздела по очереди
  const parts = $$(".col h2, .col .lead, .col .intro, .slip, .prices details, .letter > *, .facts, .faq details, .cta-row, .photos, .team .pic, .doclist li, .team .small, .docs li, .docs .wide, .docs .pair, .small-hero h1")
    .concat($$(".zapis .picker > *, .zapis .card"));
  parts.forEach((el, i) => { el.classList.add("rv"); el.style.setProperty("--d", String(i % 5)); });
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
  parts.forEach((el) => io.observe(el));

  // 2. Ростомер: отметка поднимается вместе с разделами, ладошка встаёт на текущую
  const marks = $$(".mark");
  const hand = $("#hand");
  const yOf = (i) => (marks[i] ? parseFloat($("line", marks[i]).getAttribute("y1")) : 0);
  function setMark(i) {
    marks.forEach((m, k) => m.classList.toggle("on", k <= i));
    if (hand) hand.style.transform = `translateY(${yOf(i)}px)`;
  }
  const secs = $$("[data-mark]");
  if (secs.length && marks.length) {
    setMark(+secs[0].dataset.mark);
    const mo = new IntersectionObserver((es) => {
      es.filter((e) => e.isIntersecting).forEach((e) => setMark(+e.target.dataset.mark));
    }, { rootMargin: "-40% 0px -45% 0px" });
    secs.forEach((s) => mo.observe(s));
  }

  // 3. Имя-слово чуть уменьшается, пока первый экран уходит (только на широком экране)
  const wm = $(".wm");
  if (wm && !reduce) {
    const onScroll = () => {
      if (innerWidth <= 900) { wm.style.transform = ""; return; }
      const k = Math.min(1, scrollY / (innerHeight * 0.9));
      wm.style.transform = `scale(${1 - 0.07 * k})`;
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // 4. Выбор времени приёма (живая вещь страницы)
  const picker = $("#picker");
  if (!picker) return;
  const specs = $$("#spec button");
  const daysEl = $("#days"), timesEl = $("#times"), sum = $("#sum"), msg = $("#msg"), form = $("#req"), phone = $("#phone");
  const MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  // дни приёма по направлениям (1 = пн … 6 = сб, воскресенье выходной), совпадают с графиком врачей
  const SPEC_DAYS = [[1, 2, 3, 4, 5, 6], [2, 4, 6], [1, 2, 4], [2, 4, 6], [1, 2, 3, 4, 5, 6]];
  const now = new Date();
  const days = [];
  // после 18:00 сегодняшний день уже не предлагаем
  for (let d = now.getHours() >= 18 ? 1 : 0; days.length < 6 && d < 14; d++) {
    const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    if (x.getDay() !== 0) days.push(x);
  }
  const slots = [];
  for (let h = 9; h < 19; h++) for (const m of [0, 30]) slots.push(h * 60 + m);
  const hhmm = (t) => `${Math.floor(t / 60)}:${t % 60 ? "30" : "00"}`;
  // время, которое вообще есть в этот день: в субботу до 16:00, сегодня не раньше чем через час
  const inDay = (di, si) => {
    const x = days[di], t = slots[si];
    if (x.getDay() === 6 && t >= 16 * 60) return false;
    if (x.toDateString() === now.toDateString() && t < now.getHours() * 60 + now.getMinutes() + 60) return false;
    return true;
  };
  // «занято» считается по дате и врачу, чтобы картина не менялась при каждом заходе
  const busy = (spec, di, si) => ((spec * 7 + di * 13 + si * 5) % 4) === 0;
  const works = (spec, di) => SPEC_DAYS[spec].includes(days[di].getDay());
  const label = (x) => `${WD[x.getDay()]}, ${x.getDate()} ${MON[x.getMonth()]}`;
  const firstDay = (spec) => Math.max(0, days.findIndex((x, i) => works(spec, i)));
  const state = { spec: 0, day: firstDay(0), time: null };

  function draw() {
    daysEl.innerHTML = days.map((x, i) => `<button type="button" aria-pressed="${i === state.day}" data-i="${i}" ${works(state.spec, i) ? "" : "disabled"}>${label(x)}</button>`).join("");
    timesEl.innerHTML = slots.map((t, i) => inDay(state.day, i) ? `<button type="button" aria-pressed="${state.time === i}" data-i="${i}" ${busy(state.spec, state.day, i) ? "disabled" : ""}>${hhmm(t)}</button>` : "").join("");
    const sp = specs[state.spec].textContent;
    sum.textContent = state.time === null ? "Выберите время приёма" : `${sp}, ${label(days[state.day])}, ${hhmm(slots[state.time])}`;
  }
  function pickSpec(i, day = firstDay(i), time = null) { state.spec = i; state.day = day; state.time = time; specs.forEach((x, k) => x.setAttribute("aria-pressed", k === i)); draw(); }
  specs.forEach((b, i) => b.addEventListener("click", () => pickSpec(i)));

  // врачи: ближайшее свободное время по их графику; нажатие открывает запись к этому врачу
  $$(".doclist a[data-spec]").forEach((a) => {
    const spec = +a.dataset.spec, wd = a.dataset.days.split(",").map(Number);
    let next = null;
    for (let di = 0; di < days.length && !next; di++) {
      if (!wd.includes(days[di].getDay())) continue;
      const si = slots.findIndex((t, k) => inDay(di, k) && !busy(spec, di, k));
      if (si >= 0) next = { di, si };
    }
    $(".nx", a).textContent = next ? `Ближайшая запись: ${label(days[next.di])}, ${hhmm(slots[next.si])}` : "";
    // сразу подставляем это время в запись: остаётся оставить телефон
    a.addEventListener("click", () => (next ? pickSpec(spec, next.di, next.si) : pickSpec(spec)));
  });
  daysEl.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && !b.disabled) { state.day = +b.dataset.i; state.time = null; draw(); } });
  timesEl.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && !b.disabled) { state.time = +b.dataset.i; draw(); } });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const digits = phone.value.replace(/\D/g, "");
    phone.classList.toggle("bad", digits.length < 10);
    msg.classList.remove("err");
    if (state.time === null) { msg.textContent = "Сначала выберите время приёма."; msg.classList.add("err"); return; }
    if (digits.length < 10) { msg.textContent = "В номере должно быть 10 цифр после +7."; msg.classList.add("err"); return; }
    msg.textContent = `Готово: ${sum.textContent}. Это демо, заявка никуда не отправлена.`;
    form.reset();
  });
  draw();
})();
