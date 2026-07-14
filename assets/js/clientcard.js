/* ============================================================================
   NEXUS CLINIC — Client profile card (owner dashboard)

   Click a client anywhere — calendar event, schedule row, appointment, client
   list — and see EVERYTHING about them in one panel: contact, lifetime visits
   and spend, loyalty progress, first/last visit, and their full booking history
   with per-booking actions. Plus one-tap WhatsApp and "new booking for them".

     NexusClientCard.init({ getBookings, refresh })
     NexusClientCard.open(phoneKey)
   ========================================================================== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  let N, I, WA, Store, Auth;
  let getBookings = () => [];
  let refresh = () => {};

  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const money = (n) => `${Number(n || 0).toLocaleString("en-US")} ${N.booking.currency}`;
  const initials = (name) => (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const dt = (b) => new Date(`${b.date}T${b.time || "00:00"}`);
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

  let currentKey = null;

  function ensureModal() {
    if ($("#clientModal")) return;
    const wrap = document.createElement("div");
    wrap.className = "modal-overlay";
    wrap.id = "clientModal";
    wrap.innerHTML = `
      <div class="modal client-modal">
        <button class="modal-close" id="ccClose" aria-label="Close">✕</button>
        <div id="ccBody"></div>
      </div>`;
    document.body.appendChild(wrap);
    $("#ccClose").addEventListener("click", () => wrap.classList.remove("show"));
    wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.classList.remove("show"); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && wrap.classList.contains("show")) wrap.classList.remove("show"); });

    // action delegation inside the card
    $("#ccBody").addEventListener("click", async (e) => {
      const nb = e.target.closest("[data-cc-new]");
      const edit = e.target.closest("[data-cc-edit]");
      const done = e.target.closest("[data-cc-done]");
      const cancel = e.target.closest("[data-cc-cancel]");
      if (nb) {
        const c = clientData(currentKey);
        window.NexusBookingForm.open({ client: { name: c.name, phone: c.phone }, onSaved: () => open(currentKey) });
      } else if (edit) {
        const b = getBookings().find((x) => x.id === edit.dataset.ccEdit);
        if (b) window.NexusBookingForm.open({ booking: b, onSaved: () => open(currentKey) });
      } else if (done) {
        await Store.updateStatus(done.dataset.ccDone, "completed");
        await refresh(); open(currentKey);
      } else if (cancel) {
        if (confirm("Cancel this appointment?")) {
          await Store.updateStatus(cancel.dataset.ccCancel, "cancelled");
          await refresh(); open(currentKey);
        }
      }
    });
  }

  /* Aggregate one client from all their bookings. Members who registered but
     haven't booked yet have no booking records — fall back to their account. */
  function clientData(phoneKey) {
    const mine = getBookings().filter((b) => (b.phoneKey || "") === phoneKey);
    mine.sort((a, b) => dt(b) - dt(a));
    const active = mine.filter((b) => b.status !== "cancelled");
    const member0 = Auth ? (Auth.allUsers() || []).find((u) => (u.phoneKey || "") === phoneKey) : null;
    const name = (mine.find((b) => b.name) || {}).name || (member0 && member0.name) || "Client";
    const phone = (mine.find((b) => b.phone) || {}).phone || (member0 && member0.phone) || "";
    const visits = active.filter((b) => !b.isReward).length;
    const spend = active.reduce((s, b) => s + (b.isReward ? 0 : b.price || 0), 0);
    const cancelled = mine.filter((b) => b.status === "cancelled").length;
    const loyalty = Store.loyaltyFor(getBookings(), phone);
    const member = member0;
    const dates = active.map((b) => b.date).sort();
    const now = Date.now();
    const upcoming = active.filter((b) => dt(b).getTime() > now - 3600000).sort((a, b) => dt(a) - dt(b));
    return {
      phoneKey, name, phone, email: member ? member.email : "",
      member, visits, spend, cancelled, loyalty, bookings: mine,
      firstVisit: dates[0], lastVisit: dates[dates.length - 1],
      nextUp: upcoming[0] || null,
    };
  }

  function bookingRow(b) {
    const when = dt(b);
    const dateLabel = b.date === todayISO() ? "Today" : when.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const status = b.status === "cancelled" ? '<span class="badge">Cancelled</span>'
      : b.status === "completed" ? '<span class="badge">Completed</span>'
      : dt(b).getTime() > Date.now() - 3600000 ? '<span class="badge confirmed">✓ Upcoming</span>'
      : '<span class="badge">Past</span>';
    return `
      <div class="cc-book ${b.status === "cancelled" ? "void" : ""}">
        <div class="cc-book-when">
          <b>${dateLabel}</b>
          <span>${b.time ? WA.fmtTime12(b.time) : ""}</span>
        </div>
        <div class="cc-book-main">
          <b>${esc(Store.getTreatments(b).join(", ") || b.serviceName || "")}${b.isReward ? " 🎁" : ""}${b.promoCode ? " · 🏷️ " + esc(b.promoCode) : ""}</b>
          <span>${esc(b.therapistName || "")}${b.note ? " · " + esc(b.note) : ""}</span>
        </div>
        <div class="cc-book-price">${b.isReward ? "Free" : money(b.price)}</div>
        <div class="cc-book-status">${status}</div>
        <div class="cc-book-actions">
          <button class="icon-btn" data-cc-edit="${b.id}" title="Edit">${I.clipboard || "✎"}</button>
          ${b.status === "confirmed" ? `<button class="icon-btn" data-cc-done="${b.id}" title="Mark done">${I.check}</button>` : ""}
          ${b.status !== "cancelled" ? `<button class="icon-btn" data-cc-cancel="${b.id}" title="Cancel">${I.trash}</button>` : ""}
        </div>
      </div>`;
  }

  function open(phoneKey) {
    ensureModal();
    currentKey = phoneKey;
    const c = clientData(phoneKey);
    const L = c.loyalty;
    const pct = L.rewardReady ? 100 : Math.round((L.cyclePos / L.threshold) * 100);
    const waUrl = c.phone ? WA.chatLinkTo(c.phone, `Hi ${c.name.split(" ")[0]}, this is ${N.brand.name} \u{1F44B}`) : "#";
    const fmtDate = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
    const returning = c.visits > 1;

    $("#ccBody").innerHTML = `
      <div class="cc-hero">
        <div class="cc-ava">${initials(c.name)}</div>
        <div class="cc-id">
          <h3>${esc(c.name)}</h3>
          <div class="cc-contact">
            ${c.phone ? `<span>${esc(c.phone)}</span>` : ""}
            ${c.email ? `<span>${esc(c.email)}</span>` : ""}
            ${returning ? '<span class="badge returning">↻ Returning</span>' : '<span class="badge new">✦ New</span>'}
            ${c.member ? '<span class="badge">Has account</span>' : '<span class="badge">Phone / walk-in</span>'}
          </div>
        </div>
        <div class="cc-hero-actions">
          ${c.phone ? `<a class="btn wa-btn" href="${waUrl}" target="_blank" rel="noopener">${I.whatsapp} WhatsApp</a>` : ""}
          <button class="ghost" data-cc-new>+ New booking</button>
        </div>
      </div>

      <div class="cc-stats">
        <div class="cc-stat"><div class="n">${c.visits}</div><div class="l">Visits</div></div>
        <div class="cc-stat"><div class="n lime">${money(c.spend)}</div><div class="l">Total spend</div></div>
        <div class="cc-stat"><div class="n">${L.rewardsEarned}</div><div class="l">Rewards earned</div></div>
        <div class="cc-stat"><div class="n">${c.cancelled}</div><div class="l">Cancelled</div></div>
      </div>

      <div class="cc-loyal ${L.rewardReady ? "ready" : ""}">
        <div class="cc-loyal-top">
          <b>${L.rewardReady ? `🎁 Free ${N.loyalty.rewardLabel} ready!` : `${L.threshold - L.cyclePos} visit${L.threshold - L.cyclePos === 1 ? "" : "s"} to a free session`}</b>
          <span>${L.rewardReady ? L.threshold + " / " + L.threshold : L.cyclePos + " / " + L.threshold}</span>
        </div>
        <div class="progress"><i style="width:${pct}%"></i></div>
      </div>

      <div class="cc-meta">
        <span>First visit · <b>${fmtDate(c.firstVisit)}</b></span>
        <span>Last visit · <b>${fmtDate(c.lastVisit)}</b></span>
        ${c.nextUp ? `<span>Next · <b>${fmtDate(c.nextUp.date)} ${WA.fmtTime12(c.nextUp.time)}</b></span>` : ""}
      </div>

      <div class="cc-history-head">
        <h4>Booking history</h4>
        <span>${c.bookings.length} total</span>
      </div>
      <div class="cc-history">
        ${c.bookings.length ? c.bookings.map(bookingRow).join("") : '<div class="cc-empty">No bookings yet.</div>'}
      </div>`;
    $("#clientModal").classList.add("show");
  }

  window.NexusClientCard = {
    init(ctx) {
      N = window.NEXUS; I = window.NexusIcons; WA = window.NexusWhatsApp; Store = window.NexusStore; Auth = window.NexusAuth;
      getBookings = ctx.getBookings; refresh = ctx.refresh;
    },
    open,
  };
})();
