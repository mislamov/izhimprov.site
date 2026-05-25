document.addEventListener("DOMContentLoaded", () => {
  const mobileCta = document.querySelector(".mobile-cta");
  if (mobileCta) {
    const heroBtn = document.querySelector(".hero .btn-row .btn-primary");
    if (heroBtn) {
      new IntersectionObserver(([entry]) => {
        mobileCta.classList.toggle("is-visible", !entry.isIntersecting);
      }).observe(heroBtn);
    } else {
      mobileCta.classList.add("is-visible");
    }
  }

  if (window.matchMedia("(max-width: 768px)").matches) {
    const revealTargets = Array.from(
      document.querySelectorAll("main > section:not(.hero), main > .logo-break")
    );

    function updateReveal() {
      if (window.scrollY < 10) {
        revealTargets.forEach((el) => el.classList.remove("is-visible"));
        return;
      }
      revealTargets.forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.96) {
          el.classList.add("is-visible");
        }
      });
    }

    window.addEventListener("scroll", updateReveal, { passive: true });
  }

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
