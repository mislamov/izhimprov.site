document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav").forEach((nav) => {
    if (nav.querySelector(".nav-toggle") || !nav.querySelector(".menu")) return;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nav-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Открыть меню");
    toggle.innerHTML = '<span></span><span></span><span></span>';
    const logo = nav.querySelector('.logo');
    if (logo) logo.insertAdjacentElement('afterend', toggle);
    const menu = nav.querySelector('.menu');
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    });
  });
});
