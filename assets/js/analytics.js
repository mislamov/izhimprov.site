const METRIKA_ID = 104673964;

function trackEvent(name, params = {}) {
  if (typeof ym !== "undefined") {
    ym(METRIKA_ID, "reachGoal", name, params);
  } else {
    console.log("[analytics]", name, params);
  }
}

window.trackEvent = trackEvent;

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-track]").forEach((el) => {
    const event = el.dataset.track;
    el.addEventListener("click", () => {
      trackEvent(event, { page_path: location.pathname });
    });
  });

  document.querySelectorAll("details[data-track]").forEach((el) => {
    el.addEventListener("toggle", () => {
      if (el.open) {
        trackEvent(el.dataset.track, { page_path: location.pathname });
      }
    });
  });
});
