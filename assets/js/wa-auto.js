/* ============================================================================
   NEXUS CLINIC — WhatsApp automation centre (owner dashboard)

   What the clinic asked for:
     1. A confirmation message right after every booking.
     2. A reminder ~1 hour before each session ("reply CONFIRM").

   How it works TODAY (no API keys yet — "semi-automatic"):
     The dashboard watches the bookings and builds a queue of messages that
     are due. Each one is a single tap: it opens WhatsApp with the message
     already written to the right number, the owner hits send, and the item
     is marked done. Nothing is ever sent twice.

   How it goes FULLY automatic later:
     The same templates + timing rules live in server/whatsapp.js. When the
     clinic connects the WhatsApp Business API (Meta Cloud API or Twilio —
     see WHATSAPP-SETUP.md) the server sends these messages itself and this
     view becomes a log. The front-end needs zero changes.

   Used by dashboard.js:
     NexusWaAuto.init({ getBookings, onChanged })
     NexusWaAuto.render()
     NexusWaAuto.dueCount()
   ========================================================================== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$all = (s, r = document) => [...r.querySelectorAll(s)];
  const LOG_KEY = "nexus_wa_log_v1";       // { "<bookingId>:confirm": ts, ... }
  const TPL_KEY = "nexus_wa_templates_v1"; // owner-edited template overrides

  let N, WA, I;
  let getBookings = () => [];
  let onChanged = () => {};
  let tick = null;

  /* ---------- sent log ---------- */
  const readLog = () => {
    try { return JSON.parse(localStorage.getItem(LOG_KEY)) || {}; } catch { return {}; }
  };
  const writeLog = (log) => localStorage.setItem(LOG_KEY, JSON.stringify(log));
  const sentKey = (b, kind) => `${b.id}:${kind}`;
  const isSent = (log, b, kind) => !!log[sentKey(b, kind)];
  const markSent = (b, kind) => {
    const log = readLog();
    log[sentKey(b, kind)] = new Date().toISOString();
    writeLog(log);
  };

  /* ---------- templates ---------- */
  function templates() {
    let ov = {};
    try { ov = JSON.parse(localStorage.getItem(TPL_KEY)) || {}; } catch {}
    return {
      confirm: ov.confirm || N.whatsapp.templates.confirm,
      reminder: ov.reminder || N.whatsapp.templates.reminder,
    };
  }
  function renderTpl(tpl, b) {
    return tpl
      .replace(/\{name\}/g, (b.name || "").split(" ")[0])
      .replace(/\{service\}/g, b.serviceName || "your session")
      .replace(/\{therapist\}/g, b.therapistName || "our team")
      .replace(/\{date\}/g, WA.fmtDateLong(b.date))
      .replace(/\{time\}/g, WA.fmtTime12(b.time));
  }

  /* ---------- queue logic ---------- */
  const mins = (t) => { const [h, m] = (t || "0:0").split(":").map(Number); return h * 60 + m; };
  const startOf = (b) => new Date(`${b.date}T${b.time || "00:00"}`);

  function queue() {
    const now = Date.now();
    const remindMs = (N.whatsapp.reminderMinutes || 60) * 60000;
    const log = readLog();
    const eligible = getBookings().filter(
      (b) => b.status === "confirmed" && (b.phone || "").trim() && b.time && !b.imported
    );

    const confirms = [];  // new bookings that never got a confirmation
    const reminders = []; // sessions starting within the reminder window
    const later = [];     // later today — reminder will become due

    for (const b of eligible) {
      const start = startOf(b).getTime();
      const inFuture = start > now - 10 * 60000; // 10-min grace
      if (inFuture && !isSent(log, b, "confirm")) confirms.push(b);
      if (!isSent(log, b, "reminder") && start > now - 10 * 60000) {
        const untilMs = start - now;
        if (untilMs <= remindMs) reminders.push(b);
        else if (b.date === localToday()) later.push(b);
      }
    }
    const byStart = (a, b) => startOf(a) - startOf(b);
    confirms.sort(byStart); reminders.sort(byStart); later.sort(byStart);
    return { confirms, reminders, later };
  }

  function localToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function untilLabel(b) {
    const diff = Math.round((startOf(b).getTime() - Date.now()) / 60000);
    if (diff <= 0) return "now";
    if (diff < 60) return `in ${diff} min`;
    const h = Math.floor(diff / 60), m = diff % 60;
    if (diff < 24 * 60) return `in ${h}h${m ? " " + m + "m" : ""}`;
    return `in ${Math.round(diff / 1440)} day${diff >= 2880 ? "s" : ""}`;
  }

  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* ---------- rendering ---------- */
  function itemRow(b, kind) {
    const msg = renderTpl(templates()[kind], b);
    const link = WA.chatLinkTo ? WA.chatLinkTo(b.phone, msg) : waLink(b.phone, msg);
    return `
      <div class="waq-item">
        <div class="waq-when">
          <b>${WA.fmtTime12(b.time)}</b>
          <span>${b.date === localToday() ? untilLabel(b) : WA.fmtDateLong(b.date).split(" ").slice(0, 3).join(" ")}</span>
        </div>
        <div class="waq-main">
          <b>${esc(b.name)}</b>
          <span>${esc(b.serviceName)} · ${esc(b.therapistName)} · ${esc(b.phone)}</span>
          <details class="waq-preview"><summary>message preview</summary><pre>${esc(msg)}</pre></details>
        </div>
        <div class="waq-actions">
          <a class="btn waq-send" href="${link}" target="_blank" rel="noopener" data-wa-send="${b.id}" data-wa-kind="${kind}">
            ${I.whatsapp} Send</a>
          <button class="waq-skip" data-wa-skip="${b.id}" data-wa-kind="${kind}" title="Mark as handled without sending">mark done</button>
        </div>
      </div>`;
  }

  function waLink(phone, text) {
    const digits = String(phone).replace(/[^\d]/g, "").replace(/^0/, "20"); // 01x -> 201x
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }

  function section(title, sub, items, kind, emptyText) {
    return `
      <div class="waq-section">
        <div class="waq-head">
          <div><h4>${title}</h4><span>${sub}</span></div>
          <span class="waq-count ${items.length ? "hot" : ""}">${items.length}</span>
        </div>
        ${items.length ? items.map((b) => itemRow(b, kind)).join("") : `<div class="waq-empty">${emptyText}</div>`}
      </div>`;
  }

  function render() {
    const panel = $("#whatsappPanel");
    if (!panel || panel.style.display === "none") return;
    const q = queue();
    const t = templates();
    const connected = !!(N.whatsapp.api && N.whatsapp.api.provider);
    const sample = getBookings().find((b) => b.time && b.phone) || {
      name: "Mariam Hassan", serviceName: "Manual Therapy", therapistName: "Dr. Salma",
      date: localToday(), time: "18:00", phone: "01000000000",
    };

    panel.innerHTML = `
      <div class="wa-mode ${connected ? "live" : ""}">
        <span class="wa-mode-dot"></span>
        <div>
          <b>${connected ? "Connected — messages send automatically" : "Semi-automatic mode"}</b>
          <p>${connected
            ? "The WhatsApp Business API is connected. Confirmations and reminders go out with no tapping."
            : "Every due message below is <b>one tap</b> — it opens WhatsApp already written to the right client; you just press send. When the clinic connects the WhatsApp Business API these send themselves — the templates and timing below stay exactly the same (see <code>WHATSAPP-SETUP.md</code>)."}</p>
        </div>
      </div>

      ${section(
        "Booking confirmations",
        "New bookings that haven't received their ✅ message",
        q.confirms, "confirm",
        "All caught up — every upcoming booking has been confirmed."
      )}
      ${section(
        `Reminders due · next ${N.whatsapp.reminderMinutes || 60} min`,
        "Sessions about an hour away — ask the client to reply CONFIRM",
        q.reminders, "reminder",
        "No reminders due right now."
      )}
      ${section(
        "Later today",
        "Their reminder unlocks when the session is an hour away",
        q.later, "reminder",
        "Nothing else scheduled for today."
      )}

      <hr class="wa-divider" />

      <div class="waq-section wa-templates">
        <div class="waq-head"><div><h4>Message templates</h4>
          <span>Placeholders: {name} {service} {therapist} {date} {time} — each template is edited and saved on its own</span></div></div>
        ${tplCard("confirm", "Booking confirmation", "sent right after a booking", t.confirm, sample)}
        ${tplCard("reminder", "Reminder", "sent about an hour before the session", t.reminder, sample)}
      </div>`;

    // one card per template — each with its own live preview + save/reset
    $$all("[data-tpl]").forEach((ta) => {
      ta.addEventListener("input", () => {
        const kind = ta.dataset.tpl;
        const pre = $(`[data-tpl-preview="${kind}"]`);
        if (pre) pre.textContent = renderTpl(ta.value, sample);
      });
    });
    $$all("[data-tpl-save]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.dataset.tplSave;
        const ta = $(`[data-tpl="${kind}"]`);
        let ov = {};
        try { ov = JSON.parse(localStorage.getItem(TPL_KEY)) || {}; } catch {}
        ov[kind] = ta.value.trim();
        localStorage.setItem(TPL_KEY, JSON.stringify(ov));
        const msg = $(`[data-tpl-msg="${kind}"]`);
        if (msg) { msg.textContent = "Saved ✓"; setTimeout(() => { msg.textContent = ""; }, 2500); }
      });
    });
    $$all("[data-tpl-reset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.dataset.tplReset;
        let ov = {};
        try { ov = JSON.parse(localStorage.getItem(TPL_KEY)) || {}; } catch {}
        delete ov[kind];
        localStorage.setItem(TPL_KEY, JSON.stringify(ov));
        render();
      });
    });
  }

  /* One standalone, self-contained template editor card. */
  function tplCard(kind, label, when, value, sample) {
    return `
      <div class="wa-tpl-card" data-tpl-card="${kind}">
        <div class="wtc-head"><h5>${label}</h5><span class="wtc-when">${when}</span></div>
        <textarea data-tpl="${kind}" rows="5">${esc(value)}</textarea>
        <div class="wtc-foot">
          <pre data-tpl-preview="${kind}">${esc(renderTpl(value, sample))}</pre>
        </div>
        <div class="wtc-foot">
          <button class="btn sm" data-tpl-save="${kind}">Save</button>
          <button class="ghost" data-tpl-reset="${kind}">Reset to default</button>
          <span class="waq-saved" data-tpl-msg="${kind}"></span>
        </div>
      </div>`;
  }

  /* ---------- badge ---------- */
  function dueCount() {
    const q = queue();
    return q.confirms.length + q.reminders.length;
  }

  /* ---------- events (delegated once) ---------- */
  function bindOnce() {
    document.addEventListener("click", (e) => {
      const send = e.target.closest("[data-wa-send]");
      const skip = e.target.closest("[data-wa-skip]");
      if (send) {
        // let the link open WhatsApp, then mark handled
        const b = getBookings().find((x) => x.id === send.dataset.waSend);
        if (b) markSent(b, send.dataset.waKind);
        setTimeout(() => onChanged(), 400);
      } else if (skip) {
        const b = getBookings().find((x) => x.id === skip.dataset.waSkip);
        if (b) markSent(b, skip.dataset.waKind);
        onChanged();
      }
    });
  }

  window.NexusWaAuto = {
    init(opts) {
      N = window.NEXUS; WA = window.NexusWhatsApp; I = window.NexusIcons;
      getBookings = opts.getBookings;
      onChanged = opts.onChanged;
      bindOnce();
      // keep countdowns fresh while the dashboard is open
      if (!tick) tick = setInterval(() => render(), 60000);
    },
    render,
    dueCount,
  };
})();
