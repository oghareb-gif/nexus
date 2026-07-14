/* ============================================================================
   NEXUS CLINIC — Owner dashboard
   ========================================================================== */
(function () {
  const N = window.NEXUS;
  const I = window.NexusIcons;
  const WA = window.NexusWhatsApp;
  const Auth = window.NexusAuth;
  const Charts = window.NexusCharts;
  const Store = window.NexusStore;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const money = (n) => `${Number(n).toLocaleString("en-US")} ${N.booking.currency}`;
  // Escape user-typed values (client names, notes) before they land in the
  // dashboard's HTML — a booking name must never be able to run script here.
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  // Escaped, comma-joined treatment list (handles multi-treatment + legacy).
  const treatmentsLabel = (b) => esc(Store.getTreatments(b).join(", ") || b.serviceName || "");
  // Local-parts date string — toISOString() is UTC and reports the wrong
  // "today" between midnight and ~3 AM Egypt time.
  const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayISO = () => localISO(new Date());

  let bookings = [];
  let apptFilter = "upcoming";

  /* ---------- Owner password gate ----------
     Front-end only: keeps casual visitors out. Real security needs the
     backend. Password lives in config.js -> NEXUS.owner.password.        */
  const LOCK_KEY = "nexus_owner_ok_v1";
  const lockEl = $("#ownerLock");
  if (lockEl) {
    const needsLock = N.owner && N.owner.password && sessionStorage.getItem(LOCK_KEY) !== "1";
    if (!needsLock) lockEl.classList.add("hidden");
    else setTimeout(() => $("#lockPass").focus(), 60);
    $("#lockForm").addEventListener("submit", (e) => {
      e.preventDefault();
      if ($("#lockPass").value === String(N.owner.password)) {
        sessionStorage.setItem(LOCK_KEY, "1");
        lockEl.classList.add("hidden");
      } else {
        $("#lockMsg").textContent = "Wrong password — try again.";
        const card = $(".lock-card");
        card.classList.remove("nudge");
        void card.offsetWidth;
        card.classList.add("nudge");
        $("#lockPass").value = "";
        $("#lockPass").focus();
      }
    });
  }

  /* ---------- Sidebar nav labels ---------- */
  const navItems = [
    { view: "overview", label: "Overview", icon: "grid" },
    { view: "calendar", label: "Calendar", icon: "calendar" },
    { view: "whatsapp", label: "WhatsApp", icon: "whatsapp" },
    { view: "appointments", label: "Appointments", icon: "clipboard" },
    { view: "clients", label: "Clients", icon: "users" },
    { view: "members", label: "Members", icon: "users" },
    { view: "loyalty", label: "Loyalty", icon: "gift" },
  ];
  $$("#dashNav a").forEach((a) => {
    const item = navItems.find((n) => n.view === a.dataset.view);
    a.innerHTML = `${I[item.icon]}<span>${item.label}</span>`;
  });

  const hr = new Date().getHours();
  const greet = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  $("#todayStr").innerHTML =
    `<span class="greet">${greet}</span> · ` +
    new Date().toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

  /* ---------- Helpers ---------- */
  const dt = (b) => new Date(`${b.date}T${b.time || "00:00"}`);
  const isUpcoming = (b) => b.status !== "cancelled" && dt(b) >= new Date(Date.now() - 3600000);
  const initials = (name) => (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  /* Client name cell that opens the full profile card when tapped. Falls back
     to a plain cell for imported / phone-less events (nothing to open). */
  function clientCell(b) {
    const key = b.phoneKey || "";
    const inner = `<b>${esc(b.name)}</b><span>${esc(b.phone || "")}</span>`;
    return key
      ? `<td class="who client-open" data-client="${key}" title="See ${esc(b.name)}'s full profile">${inner}</td>`
      : `<td class="who">${inner}</td>`;
  }

  /* ---------- Toast ---------- */
  function toast(msg) {
    let t = document.getElementById("nexusToast");
    if (!t) { t = document.createElement("div"); t.id = "nexusToast"; t.className = "nexus-toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 3200);
  }
  window.NexusToast = toast;

  function clientTypeBadge(phoneKey) {
    const count = bookings.filter((b) => b.phoneKey === phoneKey && b.status !== "cancelled").length;
    return count > 1
      ? '<span class="badge returning">↻ Returning</span>'
      : '<span class="badge new">✦ New</span>';
  }

  /* ---------- KPIs ---------- */
  function renderKPIs() {
    const active = bookings.filter((b) => b.status !== "cancelled");
    const clients = Store.clientsFrom(bookings);
    const returning = clients.filter((c) => c.visits > 1).length;
    const todays = active.filter((b) => b.date === todayISO());
    const revenue = active.reduce((s, b) => s + (b.price || 0), 0);
    const rewardsEarned = clients.reduce((s, c) => s + c.loyalty.rewardsEarned, 0);
    const rewardsReady = clients.filter((c) => c.loyalty.rewardReady).length;

    const allUsers = Auth ? Auth.allUsers() : [];
    const members = allUsers.length;

    /* --- This-week activity (last 7 days) for the "active" delta chips --- */
    const weekAgo = Date.now() - 7 * 86400000;
    const inLastWeek = (iso) => new Date(iso + "T00:00:00").getTime() >= weekAgo;
    const weekActive = active.filter((b) => inLastWeek(b.date) && new Date(b.date + "T00:00:00") <= new Date());
    const revThisWeek = weekActive.reduce((s, b) => s + (b.isReward ? 0 : b.price || 0), 0);
    const visitsThisWeek = weekActive.length;
    const newMembers = allUsers.filter((u) => new Date(u.createdAt).getTime() >= weekAgo).length;
    const upDelta = (n, unit) => (n > 0 ? { dir: "up", text: `▲ ${money2(n)}${unit ? " " + unit : ""} this week` } : { dir: "flat", text: "— quiet this week" });
    const money2 = (n) => Number(n).toLocaleString("en-US");

    const kpis = [
      { label: "Today's sessions", val: todays.length, sub: `${bookings.filter((b) => isUpcoming(b)).length} upcoming total`, icon: "calendar", lime: true },
      { label: "Est. revenue", val: money(revenue), sub: `${rewardsReady} reward${rewardsReady === 1 ? "" : "s"} ready`, icon: "wallet", lime: true, small: true, delta: upDelta(revThisWeek, N.booking.currency) },
      { label: "Total visits", val: active.length, sub: `${clients.length} unique clients`, icon: "check", delta: upDelta(visitsThisWeek) },
      { label: "Returning clients", val: returning, sub: `${clients.length ? Math.round((returning / clients.length) * 100) : 0}% come back`, icon: "users" },
      { label: "Registered members", val: members, sub: `${clients.length} have booked`, icon: "users", delta: newMembers > 0 ? { dir: "up", text: `▲ ${newMembers} new this week` } : { dir: "flat", text: "— no new this week" } },
    ];
    $("#kpiGrid").innerHTML = kpis
      .map(
        (k) => `
      <div class="kpi">
        <div class="k-ico">${I[k.icon]}</div>
        <div class="k-label">${k.label}</div>
        <div class="k-val ${k.lime ? "lime" : ""}" style="${k.small ? "font-size:1.7rem;" : ""}">${k.val}</div>
        <div class="k-sub">${k.sub}</div>
        ${k.delta ? `<div class="k-delta ${k.delta.dir}">${k.delta.text}</div>` : ""}
      </div>`
      )
      .join("");
  }

  /* ---------- Charts (overview) ---------- */
  // Rolling 7-day buckets ending today — reused by the cards, the expanded
  // modals, and the revenue export.
  function buildBuckets(weeks) {
    const active = bookings.filter((b) => b.status !== "cancelled");
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const buckets = Array.from({ length: weeks }, (_, w) => {
      const start = new Date(now);
      start.setDate(now.getDate() - (weeks - 1 - w) * 7 - 6);
      return { label: `${start.getDate()}/${start.getMonth() + 1}`, rev: 0, visits: 0 };
    });
    active.forEach((b) => {
      const d = new Date(b.date + "T00:00:00");
      const daysAgo = Math.floor((now - d) / 86400000);
      if (daysAgo < 0 || daysAgo > weeks * 7 - 1) return; // ignore future & older
      const w = weeks - 1 - Math.floor(daysAgo / 7);
      if (w < 0 || w >= weeks) return;
      buckets[w].visits += 1;
      if (!b.isReward) buckets[w].rev += b.price || 0;
    });
    return buckets;
  }

  // Treatment mix with revenue per service (all active bookings).
  function buildMix() {
    const active = bookings.filter((b) => b.status !== "cancelled");
    const mix = {};
    active.forEach((b) => {
      const m = (mix[b.serviceName] ||= { count: 0, rev: 0 });
      m.count += 1;
      if (!b.isReward) m.rev += b.price || 0;
    });
    return Object.entries(mix)
      .map(([label, m]) => ({ label, value: m.count, rev: m.rev }))
      .sort((a, b) => b.value - a.value);
  }

  function renderCharts() {
    if (!Charts) return;
    const weeks = 8;
    const buckets = buildBuckets(weeks);
    const mixSegments = buildMix();
    const dn = Charts.donut(mixSegments, { centerSub: "bookings" });

    const revChart = Charts.bars(
      buckets.map((b) => ({ label: b.label, value: b.rev })),
      { unit: N.booking.currency, accent: "var(--lime)" }
    );
    const visitChart = Charts.area(
      buckets.map((b) => ({ label: b.label, value: b.visits })),
      { accent: "var(--lime)" }
    );

    const revTotal = buckets.reduce((s, b) => s + b.rev, 0);
    const visitTotal = buckets.reduce((s, b) => s + b.visits, 0);
    const expand = '<span class="cc-expand">⤢ expand</span>';

    $("#chartGrid").innerHTML = `
      <div class="chart-card" data-chart="rev" title="Click for the full breakdown">
        <div class="cc-head"><h4>Revenue ${expand}</h4><span class="cc-sub">Last ${weeks} weeks · ${money(revTotal)}</span></div>
        <div class="cc-body">${revChart}</div>
      </div>
      <div class="chart-card" data-chart="visits" title="Click for the full breakdown">
        <div class="cc-head"><h4>Visits ${expand}</h4><span class="cc-sub">Last ${weeks} weeks · ${visitTotal}</span></div>
        <div class="cc-body">${visitChart}</div>
      </div>
      <div class="chart-card" data-chart="mix" title="Click for the full breakdown">
        <div class="cc-head"><h4>Treatment mix ${expand}</h4><span class="cc-sub">All bookings</span></div>
        <div class="cc-body donut-body">
          <div class="donut-wrap">${dn.svg}</div>
          <div class="donut-legend">${dn.legend || '<span class="faint">No data yet</span>'}</div>
        </div>
      </div>`;
  }

  /* ---------- Expanded chart modal ---------- */
  function openChartModal(kind) {
    const body = $("#chartModalBody");
    const buckets = buildBuckets(12);
    if (kind === "rev") {
      const total = buckets.reduce((s, b) => s + b.rev, 0);
      const best = buckets.reduce((a, b) => (b.rev > a.rev ? b : a), buckets[0]);
      const avg = Math.round(total / buckets.length);

      // "Where the money comes from" — all-time, paid (non-reward) bookings.
      const paid = bookings.filter((b) => b.status !== "cancelled" && !b.isReward);
      const allRev = paid.reduce((s, b) => s + (b.price || 0), 0);
      const now = new Date();
      const monthRev = paid
        .filter((b) => { const d = new Date(b.date + "T00:00:00"); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
        .reduce((s, b) => s + (b.price || 0), 0);

      const agg = (keyFn) => {
        const m = {};
        paid.forEach((b) => { const k = keyFn(b) || "—"; (m[k] ||= { rev: 0, n: 0 }); m[k].rev += b.price || 0; m[k].n += 1; });
        return Object.entries(m).map(([label, v]) => ({ label, rev: v.rev, n: v.n })).sort((a, b) => b.rev - a.rev);
      };
      const byTreatment = agg((b) => b.serviceName);
      const byTherapist = agg((b) => b.therapistName);
      const topClients = Store.clientsFrom(bookings)
        .filter((c) => c.spend > 0)
        .sort((a, b) => b.spend - a.spend).slice(0, 5)
        .map((c) => ({ label: c.name, rev: c.spend }));

      const share = (v) => (allRev ? Math.round((v / allRev) * 100) : 0);
      const maxRev = (arr) => arr.reduce((m, x) => Math.max(m, x.rev), 0) || 1;
      const breakList = (items, fmt) => {
        const mx = maxRev(items);
        return `<div class="rev-break">${items.map((it) => `
          <div class="rb-row"><span class="rb-l">${esc(it.label)}</span>
            <span class="rb-bar"><i style="width:${Math.round((it.rev / mx) * 100)}%"></i></span>
            <span class="rb-v">${fmt(it)}</span></div>`).join("")}</div>`;
      };

      body.innerHTML = `
        <h3>Revenue — where it comes from</h3>
        <p class="sub">Weekly trend plus the treatments, therapists and clients bringing the money in. Free reward sessions excluded.</p>
        ${Charts.bars(buckets.map((b) => ({ label: b.label, value: b.rev })), { unit: N.booking.currency })}
        <div class="cm-stats">
          <div class="cm-stat"><div class="n">${money(monthRev)}</div><div class="l">This month so far</div></div>
          <div class="cm-stat"><div class="n">${money(total)}</div><div class="l">Total · 12 weeks</div></div>
          <div class="cm-stat"><div class="n">${money(avg)}</div><div class="l">Average / week</div></div>
          <div class="cm-stat"><div class="n">${money(best.rev)}</div><div class="l">Best week (${best.label})</div></div>
        </div>

        <h4 class="cm-subhead">By treatment</h4>
        ${byTreatment.length ? breakList(byTreatment, (it) => `${money(it.rev)} · ${share(it.rev)}%`) : '<p class="cm-none">No revenue yet.</p>'}

        <h4 class="cm-subhead">By therapist</h4>
        ${byTherapist.length ? breakList(byTherapist, (it) => `${money(it.rev)} · ${it.n} session${it.n === 1 ? "" : "s"}`) : '<p class="cm-none">No revenue yet.</p>'}

        <h4 class="cm-subhead">Top clients by spend</h4>
        ${topClients.length ? breakList(topClients, (it) => money(it.rev)) : '<p class="cm-none">No client spend yet.</p>'}

        <h4 class="cm-subhead">Week by week</h4>
        <table class="cm-table"><thead><tr><th>Week starting</th><th class="num">Visits</th><th class="num">Revenue</th></tr></thead>
        <tbody>${buckets.map((b) => `<tr><td>${b.label}</td><td class="num">${b.visits}</td><td class="num">${money(b.rev)}</td></tr>`).join("")}</tbody></table>`;
    } else if (kind === "visits") {
      const total = buckets.reduce((s, b) => s + b.visits, 0);
      const avg = Math.round((total / buckets.length) * 10) / 10;
      // Busiest weekday across all active bookings.
      const dayCount = {};
      bookings.filter((b) => b.status !== "cancelled").forEach((b) => {
        const d = new Date(b.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long" });
        dayCount[d] = (dayCount[d] || 0) + 1;
      });
      const busiest = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];
      body.innerHTML = `
        <h3>Visits — last 12 weeks</h3>
        <p class="sub">All confirmed &amp; completed sessions, week by week.</p>
        ${Charts.area(buckets.map((b) => ({ label: b.label, value: b.visits })))}
        <div class="cm-stats">
          <div class="cm-stat"><div class="n">${total}</div><div class="l">Total visits</div></div>
          <div class="cm-stat"><div class="n">${avg}</div><div class="l">Average / week</div></div>
          <div class="cm-stat"><div class="n">${busiest ? busiest[0] : "—"}</div><div class="l">Busiest day${busiest ? " · " + busiest[1] + " visits" : ""}</div></div>
        </div>
        <table class="cm-table"><thead><tr><th>Week starting</th><th class="num">Visits</th><th class="num">Revenue</th></tr></thead>
        <tbody>${buckets.map((b) => `<tr><td>${b.label}</td><td class="num">${b.visits}</td><td class="num">${money(b.rev)}</td></tr>`).join("")}</tbody></table>`;
    } else {
      const mixSegments = buildMix();
      const totalBookings = mixSegments.reduce((s, m) => s + m.value, 0);
      const totalRev = mixSegments.reduce((s, m) => s + m.rev, 0);
      const top = mixSegments[0];
      const dn = Charts.donut(mixSegments, { centerSub: "bookings" });
      body.innerHTML = `
        <h3>Treatment mix — all time</h3>
        <p class="sub">Which treatments bring people in, and what each earns.</p>
        <div class="donut-body" style="justify-content:center;margin:10px 0;">
          <div class="donut-wrap" style="width:180px;">${dn.svg}</div>
          <div class="donut-legend">${dn.legend || '<span class="faint">No data yet</span>'}</div>
        </div>
        <div class="cm-stats">
          <div class="cm-stat"><div class="n">${top ? top.label : "—"}</div><div class="l">Most booked</div></div>
          <div class="cm-stat"><div class="n">${totalBookings}</div><div class="l">Total bookings</div></div>
          <div class="cm-stat"><div class="n">${money(totalRev)}</div><div class="l">Total revenue</div></div>
        </div>
        <table class="cm-table"><thead><tr><th>Treatment</th><th class="num">Bookings</th><th class="num">Share</th><th class="num">Revenue</th></tr></thead>
        <tbody>${mixSegments
          .map((m) => `<tr><td>${esc(m.label)}</td><td class="num">${m.value}</td><td class="num">${totalBookings ? Math.round((m.value / totalBookings) * 100) : 0}%</td><td class="num">${money(m.rev)}</td></tr>`)
          .join("")}</tbody></table>`;
    }
    $("#chartModal").classList.add("show");
  }

  $("#chartGrid").addEventListener("click", (e) => {
    const card = e.target.closest(".chart-card");
    if (card && card.dataset.chart) openChartModal(card.dataset.chart);
  });
  $("#chartModalClose").addEventListener("click", () => $("#chartModal").classList.remove("show"));
  $("#chartModal").addEventListener("click", (e) => {
    if (e.target === $("#chartModal")) $("#chartModal").classList.remove("show");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") $("#chartModal").classList.remove("show");
  });

  /* ---------- Appointment row ---------- */
  function apptRow(b) {
    const when = dt(b);
    const dateLabel =
      b.date === todayISO()
        ? "Today"
        : when.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const waUrl = WA.chatLinkTo(
      b.phone,
      `Hi ${b.name.split(" ")[0]}, this is ${N.brand.name} confirming your ${b.serviceName} with ${b.therapistName} on ${WA.fmtDateLong(b.date)} at ${WA.fmtTime12(b.time)}. See you then! \u{1F49A}`
    );
    const rewardTag = b.isReward ? ' <span class="badge reward">🎁 Reward</span>' : "";
    const statusBadge =
      b.status === "cancelled"
        ? '<span class="badge">Cancelled</span>'
        : b.status === "completed"
        ? '<span class="badge">Completed</span>'
        : '<span class="badge confirmed">✓ Confirmed</span>';
    return `
      <tr>
        ${clientCell(b)}
        <td>${treatmentsLabel(b)}${rewardTag}<div style="font-size:0.74rem;color:var(--faint);font-family:'JetBrains Mono',monospace;">${esc(b.therapistName)}</div></td>
        <td>${dateLabel}<div style="font-size:0.74rem;color:var(--faint);font-family:'JetBrains Mono',monospace;">${WA.fmtTime12(b.time)}</div></td>
        <td>${clientTypeBadge(b.phoneKey)} ${statusBadge}</td>
        <td style="text-align:right;white-space:nowrap;">
          <a class="icon-btn wa" href="${waUrl}" target="_blank" rel="noopener" title="Message on WhatsApp">${I.whatsapp}</a>
          ${b.status === "confirmed" ? `<button class="icon-btn" data-complete="${b.id}" title="Mark done">${I.check}</button>` : ""}
          <button class="icon-btn" data-cancel="${b.id}" title="Cancel">${I.trash}</button>
        </td>
      </tr>`;
  }

  function tableWrap(rows, cols = ["Client", "Treatment", "When", "Status", ""]) {
    if (!rows.length) return emptyState();
    return `<table class="dash-table"><thead><tr>${cols
      .map((c) => `<th${c === "" ? ' style="text-align:right;"' : ""}>${c}</th>`)
      .join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
  }

  function emptyState() {
    return `<div class="empty-state">${I.calendar}<p>No bookings yet.</p>
      <button class="btn seed-btn" id="seedInline">Load demo data</button></div>`;
  }

  /* ---------- Schedule (overview) ----------
     Upcoming sessions grouped by day — Today first, then Tomorrow, then the
     rest of the week — each day sorted by time. */
  function schedRow(b) {
    const waUrl = WA.chatLinkTo(
      b.phone,
      `Hi ${b.name.split(" ")[0]}, this is ${N.brand.name} confirming your ${b.serviceName} with ${b.therapistName} on ${WA.fmtDateLong(b.date)} at ${WA.fmtTime12(b.time)}. See you then! \u{1F49A}`
    );
    return `
      <div class="sched-row">
        <span class="sched-time">${WA.fmtTime12(b.time)}</span>
        <div class="sched-body${b.phoneKey ? " client-open" : ""}"${b.phoneKey ? ` data-client="${b.phoneKey}" title="See ${esc(b.name)}'s full profile"` : ""}>
          <b>${esc(b.name)}${b.isReward ? " 🎁" : ""}</b>
          <span>${treatmentsLabel(b)} · ${esc(b.therapistName)}</span>
        </div>
        <div class="sched-actions">
          <a class="icon-btn wa" href="${waUrl}" target="_blank" rel="noopener" title="Message on WhatsApp">${I.whatsapp}</a>
          <button class="icon-btn" data-complete="${b.id}" title="Mark done">${I.check}</button>
          <button class="icon-btn" data-cancel="${b.id}" title="Cancel">${I.trash}</button>
        </div>
      </div>`;
  }

  function renderSchedule(upcoming) {
    if (!upcoming.length) return emptyState();
    const tISO = todayISO();
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    const tmrISO = localISO(tmr);
    const dayLabel = (iso) =>
      iso === tISO
        ? "Today"
        : iso === tmrISO
        ? "Tomorrow"
        : new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });

    const groups = new Map();
    upcoming.forEach((b) => {
      if (!groups.has(b.date)) groups.set(b.date, []);
      groups.get(b.date).push(b);
    });
    let html = "";
    // Always show a Today header so "who do I have today?" has an instant answer.
    if (!groups.has(tISO)) {
      html += `<div class="sched-day"><span>Today</span><span class="sc-n">no sessions</span></div>`;
    }
    [...groups.keys()]
      .sort()
      .forEach((iso) => {
        const list = groups.get(iso).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
        html += `<div class="sched-day"><span>${dayLabel(iso)}</span><span class="sc-n">${list.length} session${list.length === 1 ? "" : "s"}</span></div>`;
        html += list.map(schedRow).join("");
      });
    return html;
  }

  /* ---------- Renders per view ---------- */
  function renderOverview() {
    const upcoming = bookings.filter(isUpcoming).sort((a, b) => dt(a) - dt(b));
    const todayCount = upcoming.filter((b) => b.date === todayISO()).length;
    $("#upCount").textContent = `${todayCount} today · ${upcoming.length} scheduled`;
    $("#upcomingTable").innerHTML = renderSchedule(upcoming.slice(0, 12));

    // Loyalty watch — clients closest to reward (not yet ready, most visits)
    const clients = Store.clientsFrom(bookings)
      .filter((c) => c.loyalty.threshold)
      .sort((a, b) => b.loyalty.cyclePos - a.loyalty.cyclePos || b.visits - a.visits)
      .slice(0, 6);
    $("#loyaltyList").innerHTML =
      clients.length === 0
        ? '<div class="empty-state" style="padding:34px;"><p>No clients yet.</p></div>'
        : clients.map(loyaltyItem).join("");
  }

  function loyaltyItem(c) {
    const L = c.loyalty;
    const pct = L.rewardReady ? 100 : Math.round((L.cyclePos / L.threshold) * 100);
    const left = L.threshold - L.cyclePos;
    return `
      <div class="loyal-item ${L.rewardReady ? "ready" : ""}${c.phoneKey ? " client-open" : ""}"${c.phoneKey ? ` data-client="${c.phoneKey}" title="See ${esc(c.name)}'s full profile"` : ""}>
        <div class="li-ava">${esc(initials(c.name))}</div>
        <div class="li-main">
          <div class="li-top">
            <b>${esc(c.name)}</b>
            <span class="v">${L.rewardReady ? L.threshold + " / " + L.threshold : L.cyclePos + " / " + L.threshold}</span>
          </div>
          <div class="progress"><i style="width:${pct}%"></i></div>
          <div class="li-sub">${
            L.rewardReady
              ? `🎁 Free ${N.loyalty.rewardLabel} ready — mention it on their next visit`
              : `${left} visit${left === 1 ? "" : "s"} to a free session · ${c.visits} total`
          }</div>
        </div>
      </div>`;
  }

  function renderAppointments() {
    let list = [...bookings];
    if (apptFilter === "upcoming") list = list.filter(isUpcoming).sort((a, b) => dt(a) - dt(b));
    else if (apptFilter === "today") list = list.filter((b) => b.date === todayISO());
    else list = list.sort((a, b) => dt(b) - dt(a));
    $("#allTable").innerHTML = tableWrap(list.map(apptRow));
  }

  function renderClients() {
    const clients = Store.clientsFrom(bookings).sort((a, b) => b.visits - a.visits);
    $("#clientCount").textContent = `${clients.length} total`;
    const rows = clients.map((c) => {
      const waUrl = WA.chatLinkTo(c.phone, `Hi ${c.name.split(" ")[0]}, this is ${N.brand.name} \u{1F44B}`);
      return `<tr>
        ${clientCell(c)}
        <td>${c.visits} visit${c.visits === 1 ? "" : "s"} ${clientTypeBadge(c.phoneKey)}</td>
        <td>${money(c.spend)}</td>
        <td>${c.loyalty.rewardReady ? '<span class="badge reward">🎁 Reward ready</span>' : c.loyalty.cyclePos + "/" + c.loyalty.threshold + " to reward"}</td>
        <td style="text-align:right;"><a class="icon-btn wa" href="${waUrl}" target="_blank" rel="noopener">${I.whatsapp}</a></td>
      </tr>`;
    });
    $("#clientsTable").innerHTML = clients.length
      ? tableWrap(rows, ["Client", "Visits", "Spend", "Loyalty", ""])
      : emptyState();
  }

  function renderMembers() {
    const users = Auth ? Auth.allUsers() : [];
    $("#membersMeta").textContent = `${users.length} registered`;
    if (!users.length) {
      $("#membersTable").innerHTML = `<div class="empty-state">${I.users}<p>No one has created an account yet.</p>
        <span class="faint" style="font-size:0.8rem;">Members appear here when customers sign up on the site.</span></div>`;
      return;
    }
    const sorted = users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const rows = sorted.map((u) => {
      const L = Store.loyaltyFor(bookings, u.phone);
      const cap = Store.reservationCap(bookings, u);
      const mine = Store.bookingsForUser(bookings, u).filter((b) => b.status !== "cancelled");
      const joined = new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      const contact = [u.phone, u.email].filter(Boolean).join(" · ") || "—";
      const capBadge =
        cap.atCap
          ? `<span class="badge" style="color:var(--gold);border-color:var(--gold);">${cap.count}/${cap.max} · full</span>`
          : `<span class="badge">${cap.count}/${cap.max} active</span>`;
      const waUrl = u.phone ? WA.chatLinkTo(u.phone, `Hi ${u.name.split(" ")[0]}, this is ${N.brand.name} \u{1F44B}`) : "#";
      return `<tr>
        <td class="who${u.phoneKey ? " client-open" : ""}"${u.phoneKey ? ` data-client="${u.phoneKey}" title="See ${esc(u.name)}'s full profile"` : ""}><b>${esc(u.name)}</b><span>${esc(contact)}</span></td>
        <td>${mine.length} booking${mine.length === 1 ? "" : "s"}</td>
        <td>${capBadge}</td>
        <td>${L.rewardReady ? '<span class="badge reward">🎁 Reward ready</span>' : L.cyclePos + "/" + L.threshold + " to reward"}</td>
        <td><span class="faint" style="font-family:'JetBrains Mono',monospace;font-size:0.74rem;">${joined}</span></td>
        <td style="text-align:right;">${u.phone ? `<a class="icon-btn wa" href="${waUrl}" target="_blank" rel="noopener">${I.whatsapp}</a>` : ""}</td>
      </tr>`;
    });
    $("#membersTable").innerHTML = tableWrap(rows, ["Member", "Bookings", "Reservations", "Loyalty", "Joined", ""]);
  }

  function renderLoyalty() {
    const clients = Store.clientsFrom(bookings).sort(
      (a, b) => (b.loyalty.rewardReady - a.loyalty.rewardReady) || b.loyalty.cyclePos - a.loyalty.cyclePos
    );
    const ready = clients.filter((c) => c.loyalty.rewardReady).length;
    const savings = clients.reduce((s, c) => s + c.loyalty.rewardsEarned, 0) * N.loyalty.rewardValue;
    $("#loyaltyMeta").textContent = `${N.loyalty.threshold}-visit reward · ${ready} ready · ${money(savings)} gifted`;
    $("#loyaltyFull").innerHTML = clients.length
      ? clients.map(loyaltyItem).join("")
      : '<div class="empty-state">' + I.gift + "<p>No loyalty activity yet.</p></div>";
  }

  /* ---------- View switching ---------- */
  function setView(view) {
    $("#viewTitle").textContent = navItems.find((n) => n.view === view).label;
    $$("#dashNav a").forEach((a) => a.classList.toggle("active", a.dataset.view === view));
    $("#overviewCols").style.display = view === "overview" ? "grid" : "none";
    $("#chartGrid").style.display = view === "overview" ? "grid" : "none";
    $("#calendarPanel").style.display = view === "calendar" ? "block" : "none";
    $("#whatsappPanel").style.display = view === "whatsapp" ? "block" : "none";
    $("#appointmentsPanel").style.display = view === "appointments" ? "block" : "none";
    $("#clientsPanel").style.display = view === "clients" ? "block" : "none";
    $("#membersPanel").style.display = view === "members" ? "block" : "none";
    $("#loyaltyPanel").style.display = view === "loyalty" ? "block" : "none";
    $("#kpiGrid").style.display = view === "overview" ? "grid" : "none";
    if (view === "calendar" && window.NexusCalendar) NexusCalendar.render();
    if (view === "whatsapp" && window.NexusWaAuto) NexusWaAuto.render();
    if (view === "appointments") renderAppointments();
    if (view === "clients") renderClients();
    if (view === "members") renderMembers();
    if (view === "loyalty") renderLoyalty();
  }

  $$("#dashNav a").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      setView(a.dataset.view);
    })
  );

  $$("#apptFilters button").forEach((b) =>
    b.addEventListener("click", () => {
      $$("#apptFilters button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      apptFilter = b.dataset.filter;
      renderAppointments();
    })
  );

  /* ---------- Actions (event delegation) ---------- */
  document.addEventListener("click", async (e) => {
    const complete = e.target.closest("[data-complete]");
    const cancel = e.target.closest("[data-cancel]");
    const seed = e.target.closest("#seedInline");
    if (complete) {
      await Store.updateStatus(complete.dataset.complete, "completed");
      await refresh();
    } else if (cancel) {
      if (confirm("Cancel this appointment?")) {
        await Store.updateStatus(cancel.dataset.cancel, "cancelled");
        await refresh();
      }
    } else if (seed) {
      await seedDemo();
    }
  });

  /* ---------- Export (CSV — opens in Excel / Numbers / Google Sheets) ---------- */
  function csv(rows, cols) {
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [cols.map((c) => esc(c.h)).join(","), ...rows.map((r) => cols.map((c) => esc(c.f(r))).join(","))].join("\r\n");
  }

  function downloadCSV(name, text) {
    const a = document.createElement("a");
    // BOM so Excel opens it with the right encoding.
    a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* Write a real Excel workbook (SheetJS). Column order is preserved and each
     column gets a sensible width so names/phones/dates aren't clipped. Falls
     back to CSV if the SheetJS CDN didn't load. */
  function downloadSheet(base, sheetName, list, cols) {
    if (window.XLSX) {
      const header = cols.map((c) => c.h);
      const body = list.map((item) => cols.map((c) => c.f(item)));
      const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
      ws["!cols"] = cols.map((c) => ({ wch: c.w || 16 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${base}.xlsx`);
    } else {
      downloadCSV(`${base}.csv`, csv(list, cols));
    }
  }

  function exportData(kind) {
    const stamp = todayISO();
    if (kind === "appointments" || kind === "today") {
      let list = [...bookings].sort((a, b) => dt(a) - dt(b));
      if (kind === "today") list = list.filter((b) => b.date === todayISO() && b.status !== "cancelled");
      downloadSheet(`nexus-${kind}-${stamp}`, "Bookings", list, [
        { h: "Date", f: (b) => b.date, w: 12 },
        { h: "Time", f: (b) => WA.fmtTime12(b.time), w: 10 },
        { h: "Client", f: (b) => b.name, w: 22 },
        { h: "Phone", f: (b) => b.phone, w: 16 },
        { h: "Treatments", f: (b) => Store.getTreatments(b).join(", "), w: 34 },
        { h: "Therapist", f: (b) => b.therapistName, w: 20 },
        { h: "Promo code", f: (b) => b.promoCode || "", w: 12 },
        { h: `Price (${N.booking.currency})`, f: (b) => (b.isReward ? 0 : b.price || 0), w: 12 },
        { h: "Status", f: (b) => b.status, w: 12 },
        { h: "Reward session", f: (b) => (b.isReward ? "yes" : "no"), w: 14 },
      ]);
    } else if (kind === "clients") {
      const clients = Store.clientsFrom(bookings).sort((a, b) => b.visits - a.visits);
      downloadSheet(`nexus-clients-${stamp}`, "Clients", clients, [
        { h: "Client", f: (c) => c.name, w: 22 },
        { h: "Phone", f: (c) => c.phone, w: 16 },
        { h: "Visits", f: (c) => c.visits, w: 8 },
        { h: `Total spend (${N.booking.currency})`, f: (c) => c.spend, w: 16 },
        { h: "Loyalty progress", f: (c) => `${c.loyalty.cyclePos}/${c.loyalty.threshold}`, w: 15 },
        { h: "Reward ready", f: (c) => (c.loyalty.rewardReady ? "yes" : "no"), w: 12 },
      ]);
    } else if (kind === "members") {
      const users = Auth ? Auth.allUsers() : [];
      // Only safe fields — never passwords/hashes.
      downloadSheet(`nexus-members-${stamp}`, "Members", users, [
        { h: "Name", f: (u) => u.name, w: 22 },
        { h: "Phone", f: (u) => u.phone || "", w: 16 },
        { h: "Email", f: (u) => u.email || "", w: 26 },
        { h: "Joined", f: (u) => (u.createdAt || "").split("T")[0], w: 12 },
      ]);
    } else if (kind === "loyalty") {
      const clients = Store.clientsFrom(bookings).sort(
        (a, b) => b.loyalty.rewardReady - a.loyalty.rewardReady || b.loyalty.cyclePos - a.loyalty.cyclePos
      );
      downloadSheet(`nexus-loyalty-${stamp}`, "Loyalty", clients, [
        { h: "Client", f: (c) => c.name, w: 22 },
        { h: "Phone", f: (c) => c.phone, w: 16 },
        { h: "Visits", f: (c) => c.visits, w: 8 },
        { h: "Progress", f: (c) => `${c.loyalty.cyclePos}/${c.loyalty.threshold}`, w: 12 },
        { h: "Reward ready", f: (c) => (c.loyalty.rewardReady ? "yes" : "no"), w: 12 },
        { h: "Rewards earned", f: (c) => c.loyalty.rewardsEarned, w: 14 },
      ]);
    } else if (kind === "revenue") {
      downloadSheet(`nexus-revenue-${stamp}`, "Revenue", buildBuckets(12), [
        { h: "Week starting", f: (b) => b.label, w: 14 },
        { h: "Visits", f: (b) => b.visits, w: 8 },
        { h: `Revenue (${N.booking.currency})`, f: (b) => b.rev, w: 16 },
      ]);
    } else if (kind === "ics") {
      exportICS();
    }
  }

  /* ---------- .ics export — open the schedule in any calendar app ---------- */
  function exportICS() {
    const icsEsc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
    const stamp = (d) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
    const dur = N.booking.slotMinutes || 45;
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nexus Physio Clinic//Dashboard//EN", "X-WR-CALNAME:Nexus Clinic"];
    bookings
      .filter((b) => b.status !== "cancelled" && b.date)
      .forEach((b) => {
        const start = new Date(`${b.date}T${b.time || "12:00"}`);
        const end = new Date(start.getTime() + dur * 60000);
        lines.push(
          "BEGIN:VEVENT",
          `UID:${b.id}@nexusphysioclinic`,
          `DTSTAMP:${stamp(new Date())}`,
          `DTSTART:${stamp(start)}`,
          `DTEND:${stamp(end)}`,
          `SUMMARY:${icsEsc(`${b.name} — ${b.serviceName}${b.therapistName ? " (" + b.therapistName + ")" : ""}`)}`,
          `DESCRIPTION:${icsEsc([b.phone, b.isReward ? "Reward session" : `${b.price || 0} ${N.booking.currency}`, b.status, b.note].filter(Boolean).join(" · "))}`,
          "END:VEVENT"
        );
      });
    lines.push("END:VCALENDAR");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }));
    a.download = `nexus-calendar-${todayISO()}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  const exportWrap = $("#exportWrap");
  $("#exportBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    exportWrap.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#exportWrap")) exportWrap.classList.remove("open");
  });
  $$("#exportMenu [data-export]").forEach((b) =>
    b.addEventListener("click", () => {
      exportData(b.dataset.export);
      exportWrap.classList.remove("open");
    })
  );

  /* ---------- Demo data ---------- */
  async function seedDemo() {
    const names = [
      "Mariam Hassan", "Omar Sherif", "Nour Adel", "Youssef Kamal", "Laila Mostafa",
      "Ahmed Tarek", "Salma Fouad", "Karim Nabil", "Hana Wael", "Seif Ashraf",
    ];
    const phones = [
      "01011112222", "01022223333", "01033334444", "01044445555", "01055556666",
      "01066667777", "01077778888", "01088889999", "01099990000", "01012123434",
    ];
    const now = new Date();
    const records = [];
    names.forEach((name, i) => {
      const visits = [2, 5, 9, 1, 3, 10, 4, 1, 6, 2][i];
      for (let v = 0; v < visits; v++) {
        const svc = N.services[(i + v) % N.services.length];
        const th = N.team[(i + v) % N.team.length];
        const day = new Date(now);
        day.setDate(now.getDate() - (visits - v) * 7 + (i % 3));
        records.push({
          id: "demo_" + i + "_" + v,
          name, phone: phones[i], phoneKey: Store.normalizePhone(phones[i]),
          serviceId: svc.id, serviceName: svc.name,
          therapistId: th.id, therapistName: th.name,
          date: localISO(day),
          time: ["16:00", "17:30", "18:00", "19:30", "20:00"][(i + v) % 5],
          price: svc.price, status: "confirmed", isReward: false,
          createdAt: new Date(day).toISOString(),
        });
      }
    });
    // A few upcoming
    for (let i = 0; i < 5; i++) {
      const svc = N.services[i % N.services.length];
      const th = N.team[i % N.team.length];
      const day = new Date(now);
      day.setDate(now.getDate() + i + 1);
      records.push({
        id: "demo_up_" + i,
        name: names[i], phone: phones[i], phoneKey: Store.normalizePhone(phones[i]),
        serviceId: svc.id, serviceName: svc.name,
        therapistId: th.id, therapistName: th.name,
        date: localISO(day),
        time: ["16:00", "17:30", "18:00", "19:30", "20:00"][i % 5],
        price: svc.price, status: "confirmed", isReward: false,
        createdAt: new Date().toISOString(),
      });
    }
    localStorage.setItem("nexus_bookings_v1", JSON.stringify(records));

    // Seed a matching set of demo members (so the Members view isn't empty).
    // These are demo-only records with a placeholder password hash.
    const demoUsers = names.slice(0, 8).map((name, i) => ({
      id: "usrdemo_" + i,
      name,
      email: name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.com",
      emailKey: name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.com",
      phone: phones[i],
      phoneKey: Store.normalizePhone(phones[i]),
      salt: "demo",
      passHash: "fb$demo",
      createdAt: new Date(now.getTime() - i * 86400000 * 3).toISOString(),
    }));
    localStorage.setItem("nexus_users_v1", JSON.stringify(demoUsers));

    await refresh();
  }
  $("#seedBtn").addEventListener("click", seedDemo);

  /* ---------- Refresh everything ---------- */
  async function refresh() {
    bookings = await Store.getBookings();
    const backend = await fetch("/api/health").then((r) => r.ok).catch(() => false);
    $("#dataMode").textContent = backend ? "Live · synced to server" : "Local demo · this browser";
    const status = $("#sideStatus");
    if (status) status.classList.toggle("live", !!backend);
    renderKPIs();
    renderCharts();
    renderOverview();
    if (window.NexusCalendar) NexusCalendar.render();
    if (window.NexusWaAuto) {
      NexusWaAuto.render();
      updateWaBadge();
    }
    const active = $$("#dashNav a").find((a) => a.classList.contains("active"));
    if (active && active.dataset.view !== "overview") setView(active.dataset.view);
  }

  /* Due-message count bubble on the WhatsApp nav item. */
  function updateWaBadge() {
    const a = $$("#dashNav a").find((x) => x.dataset.view === "whatsapp");
    if (!a) return;
    let badge = a.querySelector(".nav-badge");
    const n = NexusWaAuto.dueCount();
    if (!badge) {
      badge = document.createElement("b");
      badge.className = "nav-badge";
      a.appendChild(badge);
    }
    badge.textContent = n;
    badge.style.display = n > 0 ? "" : "none";
  }

  if (window.NexusCalendar)
    NexusCalendar.init({ getBookings: () => bookings, onChanged: refresh });
  if (window.NexusWaAuto)
    NexusWaAuto.init({ getBookings: () => bookings, onChanged: refresh });
  if (window.NexusBookingForm)
    NexusBookingForm.init({ getBookings: () => bookings, refresh });
  if (window.NexusClientCard)
    NexusClientCard.init({ getBookings: () => bookings, refresh });

  /* ---------- Manual add + open-client (works from every view) ----------
     "New booking" in the topbar, "+ Add booking" in the appointments/clients
     views, and "+ New booking" inside a client's card all open the same form —
     so a phone-in booking can be typed anywhere. Tapping a client's name opens
     their full profile. */
  function openNewBooking() { if (window.NexusBookingForm) NexusBookingForm.open(); }
  const newBtn = $("#newBookingBtn");
  if (newBtn) newBtn.addEventListener("click", openNewBooking);
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-add-booking]")) { openNewBooking(); return; }
    const c = e.target.closest("[data-client]");
    if (c && c.dataset.client && window.NexusClientCard) NexusClientCard.open(c.dataset.client);
  });

  refresh();
})();
