// Демо: фасад, окна услуг, появление блоков, формы без сервера
(function () {
  var root = document.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // окна услуг на фасаде зажигаются вместе с открытой услугой
  var wins = [].slice.call(document.querySelectorAll(".svc-facade .win.svc"));
  var items = [].slice.call(document.querySelectorAll(".svc-item"));
  function sync() {
    var open = items.filter(function (d) { return d.open; }).map(function (d) { return +d.dataset.svc; });
    wins.forEach(function (w) { w.classList.toggle("on", open.indexOf(+w.dataset.svc) > -1); });
  }
  items.forEach(function (d) {
    d.addEventListener("toggle", function () {
      if (d.open) items.forEach(function (o) { if (o !== d) o.open = false; });
      sync();
    });
    d.addEventListener("mouseenter", function () {
      wins.forEach(function (w) { w.classList.toggle("on", +w.dataset.svc === +d.dataset.svc || (d.open && false)); });
    });
    d.addEventListener("mouseleave", sync);
  });
  sync();

  // появление: заголовок, потом текст, потом картинка
  var targets = [].slice.call(document.querySelectorAll(".sec h2, .sub, .svc-item, .svc-pic, .person, .quote, .job-list li, .form, .note"));
  targets.forEach(function (el, i) { el.classList.add("rv"); el.style.setProperty("--i", String(Math.min(i % 4, 3))); });
  if (!reduce && "IntersectionObserver" in window) {
    root.classList.add("go");
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    targets.forEach(function (el) { io.observe(el); });
  }

  // формы-демо: ничего никуда не отправляем
  [].forEach.call(document.querySelectorAll("form[data-demo]"), function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      f.querySelector(".done").hidden = false;
      f.querySelector("button").disabled = true;
    });
  });
})();
