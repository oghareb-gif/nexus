/* ============================================================================
   NEXUS CLINIC — Customer account page
   ========================================================================== */
(function () {
  const N = window.NEXUS;
  const I = window.NexusIcons;
  const WA = window.NexusWhatsApp;
  const Auth = window.NexusAuth;
  const Store = window.NexusStore;
  const $ = (s) => document.querySelector(s);
  const money = (n) => `${Number(n).toLocaleString("en-US")} ${N.booking.currency}`;

  /* Gatekeep: must be signed in. */
  const user = Auth.currentUser();
  if (!user) {
    location.replace("login.html?next=account");
    return;
  }

  let bookings = [];

  $("#acHello").textContent = `Hello, ${user.name.split(" ")[0]} 👋`;
  $("#acContact").textContent = [user.email, user.phone].filter(Boolean).join("  ·  ");

  $("#logoutBtn").addEventListener("click", () => {
    Auth.logout();
    location.href = "index.html";
  });

  /* ---------- Loyalty card ---------- */
  function renderLoyalty() {
    const L = Store.loyaltyFor(bookings, user.phone);
    const card = $("#loyaltyCard");
    if (!N.loyalty.enabled) {
      card.style.display = "none";
      return;
    }
    const pct = L.rewardReady ? 100 : Math.round((L.cyclePos / L.threshold) * 100);
    const dots = Array.from({ length: L.threshold }, (_, i) => {
      if (L.rewardReady) return '<i class="reward"></i>';
      return `<i class="${i < L.cyclePos ? "on" : ""}"></i>`;
    }).join("");
    card.innerHTML = `
      <div class="lc-head">
        <div>
          <div class="eyebrow">Loyalty rewards</div>
          <h3>${L.rewardReady ? "You've earned a reward! 🏆" : "Your progress"}</h3>
        </div>
        <span class="lc-ico">${L.rewardReady ? "🏆" : "💚"}</span>
      </div>
      <div class="lc-count">${L.rewardReady ? L.threshold + " / " + L.threshold : L.cyclePos + " / " + L.threshold}</div>
      <div class="progress lg"><i style="width:${pct}%"></i></div>
      <div class="loyalty-dots big">${dots}</div>
      <p class="lc-note">${
        L.rewardReady
          ? `Mention this at reception on your next visit for a free ${N.loyalty.rewardLabel}.`
          : L.visits === 0
          ? `Every ${L.threshold} visits earns a free ${N.loyalty.rewardLabel}. Your first visit starts the clock.`
          : `${L.visits} visit${L.visits === 1 ? "" : "s"} so far · ${L.toNext} more to your free ${N.loyalty.rewardLabel}.`
      }</p>
      ${L.rewardsEarned ? `<div class="lc-badge">🎁 ${L.rewardsEarned} reward${L.rewardsEarned === 1 ? "" : "s"} earned to date</div>` : ""}`;
  }

  /* ---------- Stats ---------- */
  function renderStats() {
    const mine = Store.bookingsForUser(bookings, user);
    const completed = mine.filter((b) => b.status !== "cancelled" && !Store.isActive(b));
    const upcoming = Store.activeBookingsForUser(bookings, user);
    const spend = mine
      .filter((b) => b.status !== "cancelled" && !b.isReward)
      .reduce((s, b) => s + (b.price || 0), 0);
    const stats = [
      { n: upcoming.length, l: "Upcoming" },
      { n: completed.length, l: "Visits" },
      { n: money(spend), l: "Total spend", small: true },
    ];
    $("#acStats").innerHTML = stats
      .map(
        (s) =>
          `<div class="stat"><div class="n" style="${s.small ? "font-size:1.4rem;" : ""}">${s.n}</div><div class="l">${s.l}</div></div>`
      )
      .join("");
  }

  /* ---------- Reservation cards ---------- */
  function resvCard(b, past) {
    const treatments = Store.getTreatments(b);
    // Sum durations across every treatment in the booking.
    const totalDur = treatments.reduce((sum, name) => {
      const s = N.services.find((x) => x.name === name);
      return sum + (s ? s.duration : 0);
    }, 0);
    const dur = totalDur ? `${totalDur} min` : "";
    const promoTag = b.promoCode ? `<span class="badge">🏷️ ${b.promoCode}</span>` : "";
    const rewardTag = b.isReward ? '<span class="badge reward">🎁 Reward</span>' : "";
    const statusBadge =
      b.status === "cancelled"
        ? '<span class="badge">Cancelled</span>'
        : past
        ? '<span class="badge">Completed</span>'
        : '<span class="badge confirmed">✓ Confirmed</span>';
    const waUrl = WA.chatLink(
      `Hi ${N.brand.name}, this is ${user.name}. I'd like to ask about my ${b.serviceName} booking on ${WA.fmtDateLong(b.date)} at ${WA.fmtTime12(b.time)}.`
    );
    return `
      <div class="resv ${b.status === "cancelled" ? "cancelled" : ""}">
        <div class="resv-date">
          <span class="rd-day">${new Date(b.date + "T00:00:00").getDate()}</span>
          <span class="rd-mon">${new Date(b.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}</span>
        </div>
        <div class="resv-body">
          <div class="resv-top"><b>${treatments.join(", ")}</b> ${promoTag} ${rewardTag} ${statusBadge}</div>
          <div class="resv-meta">${WA.fmtDateLong(b.date)} · ${WA.fmtTime12(b.time)}${dur ? " · " + dur : ""}</div>
          <div class="resv-meta faint">${b.therapistName}${b.isReward ? "" : " · " + money(b.price)}</div>
        </div>
        <div class="resv-actions">
          <a class="icon-btn wa" href="${waUrl}" target="_blank" rel="noopener" title="Message clinic">${I.whatsapp}</a>
          ${!past && b.status !== "cancelled" ? `<button class="icon-btn" data-cancel="${b.id}" title="Cancel reservation">${I.trash}</button>` : ""}
        </div>
      </div>`;
  }

  function renderLists() {
    const mine = Store.bookingsForUser(bookings, user);
    const upcoming = mine.filter(Store.isActive).sort(
      (a, b) => new Date(`${a.date}T${a.time || "00:00"}`) - new Date(`${b.date}T${b.time || "00:00"}`)
    );
    const past = mine.filter((b) => !Store.isActive(b));

    $("#upcomingMeta").textContent = `${upcoming.length} booked`;
    $("#upcomingList").innerHTML = upcoming.length
      ? upcoming.map((b) => resvCard(b, false)).join("")
      : `<div class="empty-state">${I.calendar}<p>No upcoming reservations.</p>
         <a href="book.html" class="btn" style="margin-top:6px;">Book your first session</a></div>`;

    $("#pastMeta").textContent = `${past.length} total`;
    $("#pastList").innerHTML = past.length
      ? past.map((b) => resvCard(b, true)).join("")
      : `<div class="empty-state"><p>Nothing here yet.</p></div>`;
  }

  /* ---------- Cancel (event delegation) ---------- */
  document.addEventListener("click", async (e) => {
    const cancel = e.target.closest("[data-cancel]");
    if (!cancel) return;
    if (!confirm("Cancel this reservation?")) return;
    await Store.updateStatus(cancel.dataset.cancel, "cancelled");
    await refresh();
  });

  /* ---------- Refresh ---------- */
  async function refresh() {
    bookings = await Store.getBookings();
    renderLoyalty();
    renderStats();
    renderLists();
  }

  refresh();
})();
