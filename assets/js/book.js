/* ============================================================================
   NEXUS CLINIC — Booking flow
   ========================================================================== */
(function () {
  const N = window.NEXUS;
  const I = window.NexusIcons;
  const WA = window.NexusWhatsApp;
  const Auth = window.NexusAuth;
  const Store = window.NexusStore;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const money = (n) => `${Number(n).toLocaleString("en-US")} ${N.booking.currency}`;

  /* ---------- Gatekeep: booking requires an account ---------- */
  const user = Auth.currentUser();
  if (!user) {
    location.replace("login.html?next=book");
    return;
  }
  // Show the signed-in account link in the nav.
  Auth.renderNavAccount(document.querySelector(".nav-actions"));

  const state = {
    step: 1,
    service: null,
    therapist: { id: "any", name: "First available" },
    date: null,
    time: null,
  };

  /* Flash an inline hint and nudge a button so a click never feels ignored. */
  function showHint(id, msg, btn) {
    const el = $("#" + id);
    if (el) el.textContent = msg;
    if (btn) {
      btn.classList.remove("nudge");
      void btn.offsetWidth; // reflow to restart animation
      btn.classList.add("nudge");
    }
  }
  function clearHint(id) {
    const el = $("#" + id);
    if (el) el.textContent = "";
  }

  /* ---------- WhatsApp nav link ---------- */
  $("#waNav").href = WA.chatLink();
  $("#hoursLine").textContent = N.brand.hours;

  /* ---------- Step 1: services ---------- */
  $("#serviceSelect").innerHTML = N.services
    .map(
      (s) => `
    <button type="button" class="select-card" data-service="${s.id}">
      <div class="sc-ico">${I[s.icon] || I.spark}</div>
      <div>
        <h4>${s.name}</h4>
        <div class="sc-sub">${s.short}</div>
        <div class="sc-meta"><span>${s.duration} min</span><span class="price">${money(s.price)}</span></div>
      </div>
      <span class="sc-check">✓</span>
    </button>`
    )
    .join("");

  $$("#serviceSelect .select-card").forEach((card) => {
    card.addEventListener("click", () => {
      $$("#serviceSelect .select-card").forEach((c) => c.classList.remove("sel"));
      card.classList.add("sel");
      state.service = N.services.find((s) => s.id === card.dataset.service);
      clearHint("hint1");
    });
  });

  /* ---------- Step 2: therapists ---------- */
  const therapistCards = [
    {
      id: "any",
      name: "First available",
      role: "Fastest booking",
      any: true,
    },
    ...N.team.map((t) => ({ id: t.id, name: t.name, role: t.role.split("·").pop().trim(), photo: t.photo, fallback: t.fallback })),
  ];
  $("#therapistSelect").innerHTML = therapistCards
    .map(
      (t) => `
    <button type="button" class="therapist-card${t.id === "any" ? " sel any" : ""}" data-therapist="${t.id}">
      ${
        t.any
          ? `<img alt="Any therapist" src="data:image/svg+xml,${encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 76"><rect width="76" height="76" fill="%23151c13"/><text x="38" y="48" font-size="34" text-anchor="middle" fill="%23c6ff3c" font-family="Anton">✦</text></svg>'
            )}" />`
          : `<img src="${t.photo}" alt="${t.name}"${t.fallback ? ` onerror="this.onerror=null;this.src='${t.fallback}'"` : ""} />`
      }
      <h4>${t.name}</h4>
      <div class="role">${t.role}</div>
    </button>`
    )
    .join("");

  $$("#therapistSelect .therapist-card").forEach((card) => {
    card.addEventListener("click", () => {
      $$("#therapistSelect .therapist-card").forEach((c) => c.classList.remove("sel"));
      card.classList.add("sel");
      const id = card.dataset.therapist;
      const found = therapistCards.find((t) => t.id === id);
      state.therapist = { id, name: found.name };
    });
  });

  /* ---------- Step 3: date & time ---------- */
  const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const nowMinutes = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
  // The last bookable slot today starts 30 min before closing; once that has
  // passed, today is over — no booking sessions in the past.
  const todayIsDone = () => nowMinutes() >= N.booking.closeHour * 60 - 30;

  function buildDays() {
    const wrap = $("#dayScroll");
    const days = [];
    const today = new Date();
    let added = 0;
    for (let i = 0; added < 14 && i < N.booking.daysAheadBookable + 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const closed =
        N.booking.closedWeekdays.includes(d.getDay()) || (i === 0 && todayIsDone());
      days.push({ d, closed });
      if (!closed) added++;
    }
    wrap.innerHTML = days
      .map((x) => {
        // Build the ISO date from LOCAL parts — toISOString() converts to UTC,
        // which shifts the date back a day for anyone browsing after midnight
        // in a UTC+ timezone (i.e. every night owl in Egypt).
        const iso = `${x.d.getFullYear()}-${String(x.d.getMonth() + 1).padStart(2, "0")}-${String(x.d.getDate()).padStart(2, "0")}`;
        return `<button type="button" class="day-pill${x.closed ? " off" : ""}" data-date="${iso}" ${
          x.closed ? "disabled" : ""
        }>
        <div class="dow">${x.d.toLocaleDateString("en-US", { weekday: "short" })}</div>
        <div class="dnum">${x.d.getDate()}</div>
        <div class="mon">${x.d.toLocaleDateString("en-US", { month: "short" })}</div>
      </button>`;
      })
      .join("");

    $$("#dayScroll .day-pill:not(.off)").forEach((p) => {
      p.addEventListener("click", () => {
        $$("#dayScroll .day-pill").forEach((x) => x.classList.remove("sel"));
        p.classList.add("sel");
        state.date = p.dataset.date;
        state.time = null;
        $("#timeLabel").textContent = "Time";
        buildSlots();
        clearHint("hint3");
      });
    });
  }

  function buildSlots() {
    const grid = $("#slotGrid");
    const slots = [];
    for (let h = N.booking.openHour; h < N.booking.closeHour; h++) {
      slots.push(`${String(h).padStart(2, "0")}:00`);
      slots.push(`${String(h).padStart(2, "0")}:30`);
    }
    // When today is selected, times that have already passed (plus a 30-min
    // lead so no one books a session starting in 2 minutes) are greyed out.
    const isToday = state.date === localISO(new Date());
    const cutoff = nowMinutes() + 30;
    const past = (t) => {
      const [h, m] = t.split(":").map(Number);
      return isToday && h * 60 + m < cutoff;
    };
    grid.innerHTML = slots
      .map((t) => {
        const off = past(t);
        return `<button type="button" class="slot${off ? " off" : ""}" data-time="${t}" ${off ? "disabled" : ""}>${WA.fmtTime12(t)}</button>`;
      })
      .join("");
    $$("#slotGrid .slot:not(.off)").forEach((s) => {
      s.addEventListener("click", () => {
        $$("#slotGrid .slot").forEach((x) => x.classList.remove("sel"));
        s.classList.add("sel");
        state.time = s.dataset.time;
        clearHint("hint3");
      });
    });
  }

  /* ---------- Step 4: summary + loyalty ---------- */
  function fillSummary() {
    $("#sumService").textContent = state.service.name;
    $("#sumTherapist").textContent = state.therapist.name;
    $("#sumDate").textContent = WA.fmtDateLong(state.date);
    $("#sumTime").textContent = WA.fmtTime12(state.time);
    $("#sumDuration").textContent = `${state.service.duration} min`;
    $("#sumPrice").textContent = money(state.service.price);
  }

  let loyaltyDebounce;
  async function refreshLoyalty() {
    const phone = $("#fPhone").value;
    const banner = $("#loyaltyBanner");
    if (Store.normalizePhone(phone).length < 6 || !N.loyalty.enabled) {
      banner.innerHTML = "";
      return;
    }
    const bookings = await Store.getBookings();
    const L = Store.loyaltyFor(bookings, phone);
    if (L.visits === 0) {
      banner.innerHTML = `
        <div class="loyalty-banner">
          <span class="lb-ico">🎁</span>
          <div class="lb-txt"><b>Welcome to Nexus rewards.</b>
          <span>This will be visit 1 of ${L.threshold}. Every ${L.threshold}th visit earns a free ${N.loyalty.rewardLabel.toLowerCase()}.</span></div>
        </div>`;
      return;
    }
    const dots = Array.from({ length: L.threshold }, (_, i) => {
      if (L.rewardReady) return '<i class="reward"></i>';
      return `<i class="${i < L.cyclePos ? "on" : ""}"></i>`;
    }).join("");
    banner.innerHTML = `
      <div class="loyalty-banner">
        <span class="lb-ico">${L.rewardReady ? "🏆" : "💚"}</span>
        <div class="lb-txt">
          <b>Welcome back!</b>
          <span>${
            L.rewardReady
              ? `You've earned a free ${N.loyalty.rewardLabel.toLowerCase()} — mention it at reception.`
              : `${L.visits} visits so far · ${L.toNext} more to your free ${N.loyalty.rewardLabel.toLowerCase()}.`
          }</span>
          <div class="loyalty-dots">${dots}</div>
        </div>
      </div>`;
  }
  $("#fPhone").addEventListener("input", () => {
    clearTimeout(loyaltyDebounce);
    loyaltyDebounce = setTimeout(refreshLoyalty, 400);
  });

  /* ---------- Navigation between steps ---------- */
  function goTo(step) {
    state.step = step;
    $$(".step-panel").forEach((p) =>
      p.classList.toggle("active", Number(p.dataset.panel) === step)
    );
    $$("#stepper .st").forEach((s) => {
      const n = Number(s.dataset.step);
      s.classList.toggle("active", n === step);
      s.classList.toggle("done", n < step);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (step === 4) fillSummary();
  }

  $("#next1").addEventListener("click", (e) => {
    if (!state.service) return showHint("hint1", "↑ Please choose a treatment first", e.currentTarget);
    goTo(2);
  });
  $("#next2").addEventListener("click", () => goTo(3));
  $("#next3").addEventListener("click", (e) => {
    if (!state.date) return showHint("hint3", "↑ Please pick a date", e.currentTarget);
    if (!state.time) return showHint("hint3", "↑ Please pick a time", e.currentTarget);
    goTo(4);
  });
  $$("[data-back]").forEach((b) =>
    b.addEventListener("click", () => goTo(state.step - 1))
  );

  /* ---------- Confirm ---------- */
  $("#confirmBtn").addEventListener("click", async () => {
    const name = $("#fName").value.trim();
    const phone = $("#fPhone").value.trim();
    if (!name) {
      $("#fName").focus();
      $("#fName").style.borderColor = "var(--coral)";
      return;
    }
    if (Store.normalizePhone(phone).length < 6) {
      $("#fPhone").focus();
      $("#fPhone").style.borderColor = "var(--coral)";
      return;
    }

    const bookings = await Store.getBookings();

    // Final cap check (in case another booking was made in another tab).
    const cap = Store.reservationCap(bookings, user);
    if (cap.atCap) {
      await enforceCap();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const L = Store.loyaltyFor(bookings, phone);
    const isReward = N.loyalty.enabled && L.rewardReady;

    const booking = {
      userId: user.id,
      name,
      phone,
      serviceId: state.service.id,
      serviceName: state.service.name,
      therapistId: state.therapist.id,
      therapistName: state.therapist.name,
      date: state.date,
      time: state.time,
      price: isReward && state.service.rewardEligible ? 0 : state.service.price,
      note: $("#fNote").value.trim(),
      isReward: isReward && state.service.rewardEligible,
    };

    const saved = await Store.addBooking(booking);
    const waUrl = WA.bookingLink(saved);

    // Fill confirmation ticket
    $("#tkService").textContent = saved.serviceName;
    $("#tkTherapist").textContent = `with ${saved.therapistName} · ${state.service.duration} min`;
    $("#tkDate").textContent = WA.fmtDateLong(saved.date);
    $("#tkTime").textContent = WA.fmtTime12(saved.time);
    $("#tkGuest").textContent = saved.name;
    $("#waConfirm").href = waUrl;

    // Loyalty result message
    const after = Store.loyaltyFor(await Store.getBookings(), phone);
    const lr = $("#loyaltyResult");
    if (N.loyalty.enabled) {
      if (saved.isReward) {
        lr.innerHTML = `<div class="loyalty-banner" style="justify-content:center;margin-bottom:22px;"><span class="lb-ico">🏆</span><div class="lb-txt"><b>Reward applied!</b><span>This session is on us. Enjoy 💚</span></div></div>`;
      } else {
        lr.innerHTML = `<div class="loyalty-banner" style="justify-content:center;margin-bottom:22px;"><span class="lb-ico">💚</span><div class="lb-txt"><b>Visit ${after.visits} of ${after.threshold}</b><span>${after.toNext === 0 ? "Your reward is ready next time!" : after.toNext + " more to a free " + N.loyalty.rewardLabel.toLowerCase() + "."}</span></div></div>`;
      }
    }

    goTo(5);
  });

  /* ---------- Deep link: ?service=xxx pre-selects ---------- */
  const params = new URLSearchParams(location.search);
  const preService = params.get("service");
  if (preService) {
    const card = $(`#serviceSelect .select-card[data-service="${preService}"]`);
    if (card) card.click();
  }

  /* ---------- Reservation cap: block the flow if the account is full ---------- */
  async function enforceCap() {
    const bookings = await Store.getBookings();
    const cap = Store.reservationCap(bookings, user);
    if (cap.atCap) {
      const waUrl = WA.chatLink(
        `Hi ${N.brand.name}, this is ${user.name}. I already have ${cap.max} bookings but I'd like to arrange another session — could you help me?`
      );
      const phoneTel = "tel:" + N.contact.phoneDisplay.replace(/\s/g, "");
      $("#bookFlow").style.display = "none";
      $("#bookGate").innerHTML = `
        <div class="cap-notice full big">
          <span class="lb-ico">⏳</span>
          <div>
            <b>You already have ${cap.count} upcoming reservations.</b>
            <span>Complete or cancel one of your upcoming sessions to book another online — or reach out to us directly and we'll arrange it for you.</span>
            <div class="gate-actions">
              <a href="account.html" class="btn">View my reservations</a>
              <a href="${waUrl}" target="_blank" rel="noopener" class="btn btn-wa">Contact us on WhatsApp</a>
            </div>
            <p class="gate-phone">Or call us: <a href="${phoneTel}">${N.contact.phoneDisplay}</a></p>
          </div>
        </div>`;
      return true;
    }
    return false;
  }

  /* ---------- Prefill the customer's details from their account ---------- */
  function prefill() {
    if ($("#fName") && user.name) $("#fName").value = user.name;
    if ($("#fPhone") && user.phone) $("#fPhone").value = user.phone;
  }

  /* ---------- init ---------- */
  buildDays();
  $("#slotGrid").innerHTML =
    '<div style="grid-column:1/-1;color:var(--faint);font-size:0.82rem;padding:14px 4px;">Select a date to see available times.</div>';
  prefill();
  enforceCap();
})();
