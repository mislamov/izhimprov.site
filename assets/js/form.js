const WORKER_URL = "https://dark-brook-67a3.islamov-marat.workers.dev/";

function buildTelegramFallback(payload) {
  const lines = [
    "Здравствуйте! Хочу записаться.",
    "Меня зовут: " + (payload.fio || "—"),
    "Телефон: " + (payload.tel || "—"),
    payload.comment ? "Комментарий: " + payload.comment : "",
  ]
    .filter(Boolean)
    .join("\n");

  const text = encodeURIComponent(lines);
  const deep = "tg://resolve?domain=Maratsky&text=" + text;
  const share =
    "https://t.me/share/url?url=" +
    encodeURIComponent(location.href) +
    "&text=" +
    text;

  setTimeout(() => window.open(share, "_blank"), 450);
  try {
    window.location.href = deep;
  } catch (_) {}
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("form[data-form-type]").forEach((form) => {
    const formType = form.dataset.formType;
    const submitBtn = form.querySelector('button[type="submit"]');
    const defaultBtnText = submitBtn ? submitBtn.textContent : "";
    const agreement = form.querySelector('input[type="checkbox"][name="agree"]');
    const successBlock = form.parentElement.querySelector(".form-success");
    const errorBlock = form.parentElement.querySelector(".form-error");
    let startTracked = false;

    const track = (name, extra = {}) => {
      if (typeof window.trackEvent === "function") {
        window.trackEvent(name, { page_path: location.pathname, form_type: formType, ...extra });
      }
    };

    const trackStart = () => {
      if (startTracked) return;
      startTracked = true;
      track("form_" + formType + "_start");
    };

    form.addEventListener("focusin", trackStart, { once: true });
    form.addEventListener("input", trackStart, { once: true });

    // Russian custom validation messages
    form.querySelectorAll("input[required], textarea[required]").forEach((el) => {
      el.addEventListener("invalid", () => {
        if (el.validity.valueMissing) {
          const messages = {
            name: "Введите имя",
            phone: "Укажите телефон",
            agree: "Необходимо согласие на обработку данных",
          };
          el.setCustomValidity(messages[el.name] || "Заполните это поле");
        } else {
          el.setCustomValidity("");
        }
      });
      el.addEventListener("input", () => el.setCustomValidity(""));
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      if (agreement && !agreement.checked) {
        agreement.setCustomValidity("Необходимо согласие на обработку данных");
        agreement.reportValidity();
        return;
      }
      if (agreement) agreement.setCustomValidity("");

      if (successBlock) successBlock.hidden = true;
      if (errorBlock) errorBlock.hidden = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Отправляю...";
      }

      const nameVal = (form.querySelector('[name="name"]')?.value || "").trim();
      const phoneVal = (form.querySelector('[name="phone"]')?.value || "").trim();
      const contactVal = (form.querySelector('[name="contact"]')?.value || "").trim();
      const commentVal = (form.querySelector('[name="comment"], [name="company"]')?.value || "").trim();

      const commentParts = [
        commentVal,
        contactVal ? "Telegram/email: " + contactVal : "",
        formType !== "try" ? "Тип заявки: " + formType : "",
      ].filter(Boolean);

      const payload = {
        fio: nameVal,
        tel: phoneVal,
        comment: commentParts.join("\n") || "—",
      };

      try {
        const res = await fetch(WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (!data || data.success !== true) throw new Error("success=false");

        form.hidden = true;
        if (successBlock) successBlock.hidden = false;
        track("form_" + formType + "_submit_success");
      } catch (err) {
        if (errorBlock) errorBlock.hidden = false;
        track("form_" + formType + "_submit_error", { error_code: err.message });
        buildTelegramFallback(payload);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = defaultBtnText;
        }
      }
    });
  });
});
