// Табло «До экзамена осталось», план по месяцам, запись на пробный урок.
const DEMO = true;
const EXAMS = {  // по проекту расписания 2027 года
  ege: {name: 'ЕГЭ', date: new Date(2027, 5, 1)},
  oge: {name: 'ОГЭ', date: new Date(2027, 5, 2)},
};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let exam = 'ege', pace = 2;

function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

function daysLeft(date) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((date - now) / 864e5));
}

// Цифры табло — ленты 0–9, сдвигаются шагом с небольшим перелётом
const tiles = $$('[data-days] .d');
tiles.forEach(t => {
  const reel = document.createElement('span');
  reel.className = 'reel';
  for (let i = 0; i <= 9; i++) reel.insertAdjacentHTML('beforeend', `<i data-n="${i}"></i>`);
  t.textContent = ''; t.append(reel);
});
function setDigits(n) {
  const s = String(Math.min(n, 999)).padStart(3, '0');
  tiles.forEach((t, i) => { t.firstChild.style.transform = `translateY(${-s[i] * 1.08}em)`; });
}

function render() {
  const e = EXAMS[exam], d = daysLeft(e.date);
  const lessons = Math.floor(d / 7 * pace);
  setDigits(d);
  $('[data-days-text]').textContent = `${d} ${plural(d, 'день', 'дня', 'дней')}`;
  $('[data-days-unit]').textContent = plural(d, 'день', 'дня', 'дней');
  $('[data-exam-name]').textContent = e.name;
  $('[data-lessons]').textContent = `${lessons} ${plural(lessons, 'занятие', 'занятия', 'занятий')}`;
}

function pick(attr, value) {
  $$(`[data-${attr}]`).forEach(b => {
    const on = b.dataset[attr] === String(value);
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
  });
}
$$('[data-exam]').forEach(b => b.addEventListener('click', () => { exam = b.dataset.exam; pick('exam', exam); render(); }));
$$('[data-pace]').forEach(b => b.addEventListener('click', () => { pace = +b.dataset.pace; pick('pace', pace); render(); }));

// Первое появление: табло докручивается с нуля
setDigits(0);
if (reduce) render(); else requestAnimationFrame(() => setTimeout(render, 350));

// План: прошедшие месяцы зачёркнуты, текущий отмечен
const ym = d => d.getFullYear() * 12 + d.getMonth();
const month = s => { const [y, m] = s.split('-'); return +y * 12 + (+m - 1); };
const today = ym(new Date());
$$('.months li').forEach(li => {
  if (month(li.dataset.to) < today) li.classList.add('past');
  else if (month(li.dataset.from) <= today) li.classList.add('now');
});

// Появление разделов
if (!reduce && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('rv');
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), {rootMargin: '0px 0px -10% 0px'});
  $$('section').forEach(sec => sec.querySelectorAll('[data-reveal]').forEach((el, i) => {
    el.style.setProperty('--i', i); io.observe(el);
  }));
}

// Подсказки демо-режима
let timer;
function toast(text) {
  const t = $('#toast'); t.textContent = text; t.classList.add('on');
  clearTimeout(timer); timer = setTimeout(() => t.classList.remove('on'), 3800);
}
$$('[data-vk]').forEach(a => a.addEventListener('click', e => {
  if (!DEMO) return;
  e.preventDefault(); toast('На настоящем сайте откроется VK репетитора');
}));
$('[data-call]').addEventListener('click', e => {
  if (!DEMO) return;
  e.preventDefault(); toast('На настоящем сайте здесь будет звонок репетитору');
});

// Запись: готовое сообщение
const form = $('#form'), err = $('#err'), preview = $('#preview');
form.addEventListener('submit', e => {
  e.preventDefault();
  const name = form.student.value.trim();
  form.student.setAttribute('aria-invalid', !name);
  err.hidden = !!name;
  if (!name) { form.student.focus(); return; }
  const via = e.submitter ? e.submitter.dataset.via : 'VK';
  const text = `Здравствуйте! Хочу записаться на пробный урок по английскому. Ученик: ${name}, ${form.grade.value} класс, готовимся к ${form.exam.value}. Удобно ${form.when.value}.`;
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  preview.hidden = false;
  preview.textContent = DEMO
    ? `На настоящем сайте откроется ${via} репетитора, а это сообщение уже будет скопировано: «${text}»`
    : `Сообщение скопировано, вставьте его в чат: «${text}»`;
});
