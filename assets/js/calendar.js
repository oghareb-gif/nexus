/* ============================================================================
   NEXUS CLINIC — Owner calendar (TimeTree-style)
   Month / Week / Day views, colour-coded per therapist, tap a day to manage
   its sessions, quick-add bookings, and .ics import so an existing calendar
   (TimeTree via Google/Apple, or any calendar app) can be pulled in.

   Used by dashboard.js:
     NexusCalendar.init({ getBookings, onChanged })
     NexusCalendar.render()
   ========================================================================== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  let N, I, WA, Store;
  let getBookings = () => [];
  let onChanged = () => {};

  /* ---------- state ---------- */
  let mode = "month";            // month | week | day
  let anchor = new Date();       // any date inside the visible period
  let selectedISO = null;        // highlighted day (month view panel)
  let filterId = null;           // therapist id, "imported", or null = all

  /* ---------- date helpers (Egypt week: Saturday first) ---------- */
  const localISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayISO = () => localISO(new Date());
  const fromISO = (iso) => new Date(iso + "T00:00:00");
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const satIndex = (d) => (d.getDay() - 6 + 7) % 7; // Sat=0 … Fri=6
  const weekStart = (d) => addDays(d, -satIndex(d));
  const mins = (t) => { const [h, m] = (t || "0:0").split(":").map(Number); return h * 60 + m; };
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DOW = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

  /* ---------- therapist colours ---------- */
  const PALETTE = ["#c6ff3c", "#6ee7ff", "#ffa94d", "#d0a5ff", "#ff7eb6"];
  const IMPORT_COLOR = "#9aa5a0";
  function colorFor(b) {
    if (!b.therapistId) return IMPORT_COLOR;
    const i = N.team.findIndex((t) => t.id === b.therapistId);
    return i >= 0 ? PALETTE[i % PALETTE.length] : IMPORT_COLOR;
  }

  /* ---------- data ---------- */
  function visible() {
    let list = getBookings().filter((b) => b.status !== "cancelled");
    if (filterId === "imported") list = list.filter((b) => b.imported);
    else if (filterId) list = list.filter((b) => b.therapistId === filterId);
    return list;
  }
  function byDay(list) {
    const map = new Map();
    list.forEach((b) => {
      if (!map.has(b.date)) map.set(b.date, []);
      map.get(b.date).push(b);
    });
    map.forEach((l) => l.sort((a, b) => mins(a.time) - mins(b.time)));
    return map;
  }
  const hasImported = () => getBookings().some((b) => b.imported && b.status !== "cancelled");

  /* ---------- shell ---------- */
  function shell() {
    const panel = $("#calendarPanel");
    panel.innerHTML = `
      <div class="cal-toolbar">
        <div class="cal-nav">
          <button class="cal-btn" id="calPrev" aria-label="Previous">‹</button>
          <button class="cal-btn today" id="calGoToday">Today</button>
          <button class="cal-btn" id="calNext" aria-label="Next">›</button>
          <h3 id="calTitle"></h3>
        </div>
        <div class="cal-actions">
          <div class="cal-views" id="calViews">
            <button data-mode="month">Month</button>
            <button data-mode="week">Week</button>
            <button data-mode="day">Day</button>
          </div>
          <button class="cal-btn" id="calImportBtn" title="Import a .ics calendar file (Google / Apple / TimeTree export)">⇪ Import</button>
          <input type="file" id="calImportFile" accept=".ics,text/calendar" hidden />
          <button class="btn cal-add" id="calAddBtn">+ Add</button>
        </div>
      </div>
      <div class="cal-legend" id="calLegend"></div>
      <div id="calBody"></div>
      <div id="calDayPanel"></div>
      <div class="cal-toast" id="calToast"></div>`;

    $("#calPrev").addEventListener("click", () => nav(-1));
    $("#calNext").addEventListener("click", () => nav(1));
    $("#calGoToday").addEventListener("click", () => { anchor = new Date(); selectedISO = todayISO(); render(); });
    $$("#calViews button").forEach((b) =>
      b.addEventListener("click", () => { mode = b.dataset.mode; render(); })
    );
    $("#calAddBtn").addEventListener("click", () => openAdd(selectedISO || todayISO()));
    $("#calImportBtn").addEventListener("click", () => $("#calImportFile").click());
    $("#calImportFile").addEventListener("change", onImportFile);

    $("#calBody").addEventListener("click", (e) => {
      // Tapping a client's name on the calendar opens their full profile card
      // (and does NOT also select/drill the day underneath).
      const nameChip = e.target.closest("[data-cal-client]");
      if (nameChip && nameChip.dataset.calClient) {
        if (window.NexusClientCard) window.NexusClientCard.open(nameChip.dataset.calClient);
        return;
      }
      const cell = e.target.closest("[data-day]");
      const ev = e.target.closest("[data-ev-day]");
      if (ev) { // week/day event chip -> jump to that day
        anchor = fromISO(ev.dataset.evDay);
        selectedISO = ev.dataset.evDay;
        mode = "day";
        render();
      } else if (cell) {
        selectedISO = cell.dataset.day;
        if (mode === "month") render();
        else { anchor = fromISO(cell.dataset.day); mode = "day"; render(); }
      }
    });
    $("#calDayPanel").addEventListener("click", (e) => {
      const add = e.target.closest("[data-add-day]");
      if (add) openAdd(add.dataset.addDay);
    });
    $("#calLegend").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-filter-id]");
      if (!chip) return;
      const id = chip.dataset.filterId;
      filterId = filterId === id ? null : id;
      render();
    });
  }

  function nav(dir) {
    if (mode === "month") anchor = new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
    else if (mode === "week") anchor = addDays(anchor, dir * 7);
    else anchor = addDays(anchor, dir);
    if (mode === "day") selectedISO = localISO(anchor);
    render();
  }

  function toast(msg, bad) {
    const t = $("#calToast");
    t.textContent = msg;
    t.classList.toggle("bad", !!bad);
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 4200);
  }

  /* ---------- legend ---------- */
  function renderLegend() {
    const chips = N.team.map((t, i) => {
      const on = filterId === t.id;
      return `<button class="cal-chip ${on ? "on" : ""}" data-filter-id="${t.id}">
        <i style="background:${PALETTE[i % PALETTE.length]}"></i>${esc(t.name)}</button>`;
    });
    if (hasImported())
      chips.push(`<button class="cal-chip ${filterId === "imported" ? "on" : ""}" data-filter-id="imported">
        <i style="background:${IMPORT_COLOR}"></i>Imported</button>`);
    chips.push(`<span class="cal-hint">${filterId ? "showing one filter — tap again for everyone" : "tap a name to filter"}</span>`);
    $("#calLegend").innerHTML = chips.join("");
    $$("#calViews button").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  }

  /* ---------- month view ---------- */
  function renderMonth() {
    const y = anchor.getFullYear(), m = anchor.getMonth();
    $("#calTitle").textContent = `${MONTHS[m]} ${y}`;
    const first = new Date(y, m, 1);
    const start = weekStart(first);
    const days = byDay(visible());
    const tISO = todayISO();
    const closed = N.booking.closedWeekdays || [];

    let cells = "";
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const iso = localISO(d);
      const evs = days.get(iso) || [];
      const isDim = d.getMonth() !== m;
      const cls = [
        "cal-cell",
        isDim ? "dim" : "",
        iso === tISO ? "today" : "",
        iso === selectedISO ? "sel" : "",
        closed.includes(d.getDay()) ? "closed" : "",
      ].join(" ");
      const shown = evs.slice(0, 3);
      const extra = evs.length - shown.length;
      cells += `<div class="${cls}" data-day="${iso}">
        <span class="cal-d">${d.getDate()}</span>
        <div class="cal-evs">
          ${shown.map((b) => `
            <span class="cal-ev ${b.status === "completed" ? "done" : ""}${b.phoneKey ? " client-open" : ""}" style="--c:${colorFor(b)}"${b.phoneKey ? ` data-cal-client="${b.phoneKey}" title="See ${esc(b.name)}'s profile"` : ""}>
              <em>${b.time ? WA.fmtTime12(b.time).replace(" ", "") : "all-day"}</em> ${esc(b.name.split(" ")[0])}
            </span>`).join("")}
          ${extra > 0 ? `<span class="cal-more">+${extra} more</span>` : ""}
        </div>
        <div class="cal-dots">
          ${evs.slice(0, 5).map((b) => `<i style="background:${colorFor(b)}"></i>`).join("")}
          ${evs.length > 5 ? `<b>+${evs.length - 5}</b>` : ""}
        </div>
      </div>`;
    }
    $("#calBody").innerHTML = `
      <div class="cal-month">
        <div class="cal-dow">${DOW.map((d) => `<span class="${d === "Fri" ? "fri" : ""}">${d}</span>`).join("")}</div>
        <div class="cal-grid">${cells}</div>
      </div>`;
    renderDayPanel(selectedISO);
  }

  /* ---------- day panel (under month grid) ---------- */
  function dayRow(b) {
    const canWA = !!(b.phone || "").trim();
    const waUrl = canWA
      ? WA.chatLinkTo(b.phone, `Hi ${b.name.split(" ")[0]}, this is ${N.brand.name} confirming your ${b.serviceName} with ${b.therapistName} on ${WA.fmtDateLong(b.date)} at ${WA.fmtTime12(b.time)}. See you then! \u{1F49A}`)
      : "#";
    return `
      <div class="cal-day-row ${b.status === "completed" ? "done" : ""}" style="--c:${colorFor(b)}">
        <span class="cd-time">${b.time ? WA.fmtTime12(b.time) : "All day"}</span>
        <div class="cd-main${b.phoneKey ? " client-open" : ""}"${b.phoneKey ? ` data-client="${b.phoneKey}" title="See ${esc(b.name)}'s full profile"` : ""}>
          <b>${esc(b.name)}${b.isReward ? " 🎁" : ""}</b>
          <span>${esc(b.serviceName)}${b.therapistName ? " · " + esc(b.therapistName) : ""}${b.imported ? " · imported" : ""}</span>
        </div>
        <div class="cd-actions">
          ${canWA ? `<a class="icon-btn wa" href="${waUrl}" target="_blank" rel="noopener" title="WhatsApp">${I.whatsapp}</a>` : ""}
          ${b.status === "confirmed" ? `<button class="icon-btn" data-complete="${b.id}" title="Mark done">${I.check}</button>` : ""}
          <button class="icon-btn" data-cancel="${b.id}" title="Cancel">${I.trash}</button>
        </div>
      </div>`;
  }

  function renderDayPanel(iso) {
    const panel = $("#calDayPanel");
    if (!iso || mode !== "month") { panel.innerHTML = ""; return; }
    const evs = (byDay(visible()).get(iso) || []);
    const d = fromISO(iso);
    const label = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    const closed = (N.booking.closedWeekdays || []).includes(d.getDay());
    panel.innerHTML = `
      <div class="cal-day-head">
        <div>
          <h4>${iso === todayISO() ? "Today · " : ""}${label}</h4>
          <span class="cal-day-sub">${evs.length ? `${evs.length} session${evs.length === 1 ? "" : "s"}` : closed ? "Clinic closed (Friday)" : "Nothing booked"}</span>
        </div>
        <button class="cal-btn" data-add-day="${iso}">+ Add here</button>
      </div>
      ${evs.map(dayRow).join("")}`;
  }

  /* ---------- overlap layout for time grids ---------- */
  function layout(evs, dur) {
    // Greedy interval-graph colouring: events that overlap in time share the
    // row width; each gets a column so nothing hides behind anything.
    const items = evs
      .filter((b) => b.time)
      .map((b) => ({ b, s: mins(b.time), e: mins(b.time) + dur }));
    items.sort((a, b) => a.s - b.s);
    let cluster = [], maxCol = 0, out = [];
    const flush = () => {
      cluster.forEach((it) => (it.width = maxCol + 1));
      out = out.concat(cluster);
      cluster = []; maxCol = 0;
    };
    let clusterEnd = -1;
    items.forEach((it) => {
      if (cluster.length && it.s >= clusterEnd) flush();
      const used = cluster.filter((c) => c.e > it.s).map((c) => c.col);
      let col = 0;
      while (used.includes(col)) col++;
      it.col = col;
      maxCol = Math.max(maxCol, col);
      clusterEnd = Math.max(clusterEnd, it.e);
      cluster.push(it);
    });
    flush();
    return out;
  }

  /* ---------- week + day views (time grid) ---------- */
  function timeGrid(daysArr) {
    const openM = (N.booking.openHour || 14) * 60;
    const closeM = ((N.booking.closeHour || 22) + 1) * 60;
    const HOUR = 48;
    const dur = N.booking.slotMinutes || 45;
    const days = byDay(visible());
    const tISO = todayISO();
    const closed = N.booking.closedWeekdays || [];
    const single = daysArr.length === 1;

    const hours = [];
    for (let mm = openM; mm < closeM; mm += 60)
      hours.push(`<span style="top:${((mm - openM) / 60) * HOUR}px">${WA.fmtTime12(`${Math.floor(mm / 60)}:00`)}</span>`);

    const cols = daysArr.map((d) => {
      const iso = localISO(d);
      const evs = days.get(iso) || [];
      const allday = evs.filter((b) => !b.time);
      const placed = layout(evs, dur);
      const blocks = placed.map((it) => {
        const top = Math.max(0, ((it.s - openM) / 60) * HOUR);
        const h = Math.max(20, (dur / 60) * HOUR - 3);
        const w = 100 / it.width;
        const b = it.b;
        return `<div class="tg-ev ${b.status === "completed" ? "done" : ""}" data-ev-day="${iso}"${b.phoneKey ? ` data-cal-client="${b.phoneKey}" title="See ${esc(b.name)}'s profile"` : ""}
          style="--c:${colorFor(b)};top:${top}px;height:${h}px;left:${it.col * w}%;width:${w}%">
          <b>${WA.fmtTime12(b.time)}</b> ${esc(single ? b.name : b.name.split(" ")[0])}${single ? ` <span class="tg-sub">· ${esc(b.serviceName)}</span>` : ""}
        </div>`;
      }).join("");
      const lines = hours.map((_, i) => `<i style="top:${i * HOUR}px"></i>`).join("");
      const isClosed = closed.includes(d.getDay());
      return `<div class="tg-col ${iso === tISO ? "today" : ""} ${isClosed ? "closed" : ""}" data-day="${iso}" style="height:${((closeM - openM) / 60) * HOUR}px">
        ${lines}${blocks}
        ${isClosed && !evs.length ? '<span class="tg-closed">closed</span>' : ""}
        ${allday.length ? `<div class="tg-allday">${allday.map((b) => `<span class="cal-ev" style="--c:${colorFor(b)}">${esc(b.name.split(" ")[0])}</span>`).join("")}</div>` : ""}
      </div>`;
    }).join("");

    const heads = daysArr.map((d) => {
      const iso = localISO(d);
      const n = (days.get(iso) || []).length;
      return `<div class="tg-head ${iso === tISO ? "today" : ""}" data-day="${iso}">
        <span class="tg-dow">${DOW[satIndex(d)]}</span>
        <span class="tg-date">${d.getDate()}</span>
        ${n ? `<span class="tg-n">${n}</span>` : ""}
      </div>`;
    }).join("");

    return `<div class="tg ${single ? "tg-single" : ""}">
      <div class="tg-corner"></div>
      <div class="tg-heads">${heads}</div>
      <div class="tg-times" style="height:${((closeM - openM) / 60) * HOUR}px">${hours.join("")}</div>
      <div class="tg-cols">${cols}</div>
    </div>`;
  }

  function renderWeek() {
    const start = weekStart(anchor);
    const end = addDays(start, 6);
    const fmt = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    $("#calTitle").textContent = `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
    $("#calBody").innerHTML = timeGrid([0, 1, 2, 3, 4, 5, 6].map((i) => addDays(start, i)));
    $("#calDayPanel").innerHTML = "";
  }

  function renderDay() {
    const iso = localISO(anchor);
    selectedISO = iso;
    $("#calTitle").textContent = anchor.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    $("#calBody").innerHTML = timeGrid([new Date(anchor)]);
    // details list under the grid (with actions)
    const evs = byDay(visible()).get(iso) || [];
    $("#calDayPanel").innerHTML = `
      <div class="cal-day-head">
        <div><h4>Sessions</h4><span class="cal-day-sub">${evs.length || "none"} ${evs.length === 1 ? "session" : "booked"}</span></div>
        <button class="cal-btn" data-add-day="${iso}">+ Add here</button>
      </div>
      ${evs.map(dayRow).join("")}`;
  }

  /* ---------- quick add ---------- */
  function ensureAddModal() {
    if ($("#calAddModal")) return;
    const wrap = document.createElement("div");
    wrap.className = "modal-overlay";
    wrap.id = "calAddModal";
    wrap.innerHTML = `
      <div class="modal cal-add-modal">
        <button class="modal-close" id="calAddClose" aria-label="Close">✕</button>
        <h3>New booking</h3>
        <p class="sub">Walk-in or phone booking — goes straight onto the calendar and counts toward loyalty.</p>
        <form id="calAddForm" class="cal-form">
          <div class="cf-grid">
            <label>Client name<input type="text" id="cfName" required placeholder="e.g. Mariam Hassan" /></label>
            <label>Phone<input type="tel" id="cfPhone" required placeholder="01xxxxxxxxx" /></label>
            <label>Treatment<select id="cfService"></select></label>
            <label>Therapist<select id="cfTherapist"></select></label>
            <label>Date<input type="date" id="cfDate" required /></label>
            <label>Time<input type="time" id="cfTime" required step="900" /></label>
            <label>Price (${window.NEXUS.booking.currency})<input type="number" id="cfPrice" min="0" /></label>
            <label>Note<input type="text" id="cfNote" placeholder="optional" /></label>
          </div>
          <div class="cal-form-msg" id="cfMsg"></div>
          <button type="submit" class="btn block">Add to calendar</button>
        </form>
      </div>`;
    document.body.appendChild(wrap);
    $("#cfService").innerHTML = N.services.map((s) => `<option value="${s.id}">${esc(s.name)} — ${s.price} ${N.booking.currency}</option>`).join("");
    $("#cfTherapist").innerHTML = N.team.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
    $("#cfService").addEventListener("change", () => {
      const s = N.services.find((x) => x.id === $("#cfService").value);
      if (s) $("#cfPrice").value = s.price;
    });
    $("#cfDate").addEventListener("change", () => {
      const d = fromISO($("#cfDate").value || todayISO());
      $("#cfMsg").textContent = (N.booking.closedWeekdays || []).includes(d.getDay())
        ? "Heads up: that's a Friday — the clinic is normally closed." : "";
    });
    $("#calAddClose").addEventListener("click", () => wrap.classList.remove("show"));
    wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.classList.remove("show"); });
    $("#calAddForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const svc = N.services.find((x) => x.id === $("#cfService").value);
      const th = N.team.find((x) => x.id === $("#cfTherapist").value);
      await Store.addBooking({
        name: $("#cfName").value,
        phone: $("#cfPhone").value,
        serviceId: svc.id, serviceName: svc.name,
        therapistId: th.id, therapistName: th.name,
        date: $("#cfDate").value, time: $("#cfTime").value,
        price: Number($("#cfPrice").value) || svc.price,
        note: $("#cfNote").value,
      });
      wrap.classList.remove("show");
      selectedISO = $("#cfDate").value;
      anchor = fromISO(selectedISO);
      await onChanged();
      toast(`Added — ${$("#cfName").value.trim()} on ${WA.fmtDateLong(selectedISO)} at ${WA.fmtTime12($("#cfTime").value)}`);
      $("#calAddForm").reset();
    });
  }

  function openAdd(iso, time) {
    // Prefer the shared booking form (richer — status, reward, editing) so a
    // walk-in / phone booking looks the same everywhere. Falls back to the
    // built-in quick-add if the shared form isn't loaded.
    if (window.NexusBookingForm) {
      window.NexusBookingForm.open({
        date: iso || todayISO(),
        time: time || "16:00",
        // Jump the calendar to wherever the booking actually landed.
        onSaved(saved) {
          if (saved && saved.date) {
            selectedISO = saved.date;
            anchor = fromISO(saved.date);
            render();
          }
        },
      });
      return;
    }
    ensureAddModal();
    $("#cfDate").value = iso || todayISO();
    $("#cfTime").value = "16:00";
    const s = N.services[0];
    $("#cfService").value = s.id;
    $("#cfPrice").value = s.price;
    $("#cfMsg").textContent = "";
    $("#calAddModal").classList.add("show");
    setTimeout(() => $("#cfName").focus(), 60);
  }

  /* ---------- .ics import ---------- */
  function parseICS(text) {
    // Unfold wrapped lines, then walk VEVENT blocks.
    const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
    const events = [];
    let cur = null;
    const unesc = (s) => s.replace(/\\n/gi, " · ").replace(/\\([,;\\])/g, "$1").trim();
    for (const line of lines) {
      if (line === "BEGIN:VEVENT") { cur = {}; continue; }
      if (line === "END:VEVENT") { if (cur) events.push(cur); cur = null; continue; }
      if (!cur) continue;
      const i = line.indexOf(":");
      if (i < 0) continue;
      const left = line.slice(0, i), val = line.slice(i + 1);
      const prop = left.split(";")[0].toUpperCase();
      if (prop === "UID") cur.uid = val.trim();
      else if (prop === "SUMMARY") cur.summary = unesc(val);
      else if (prop === "LOCATION") cur.location = unesc(val);
      else if (prop === "DESCRIPTION") cur.description = unesc(val);
      else if (prop === "DTSTART") { cur.dtstart = val.trim(); cur.dtparams = left.toUpperCase(); }
    }
    // convert DTSTART to {date, time, allDay}
    return events.map((ev) => {
      const v = ev.dtstart || "";
      let date = null, time = "", allDay = false;
      let m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
      if (m) {
        if (/Z$/.test(v)) { // UTC -> local
          const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
          date = localISO(d);
          time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        } else { // floating / TZID — treat as local wall time
          date = `${m[1]}-${m[2]}-${m[3]}`;
          time = `${m[4]}:${m[5]}`;
        }
      } else if ((m = v.match(/^(\d{4})(\d{2})(\d{2})$/))) {
        date = `${m[1]}-${m[2]}-${m[3]}`;
        allDay = true;
      }
      return { ...ev, date, time, allDay };
    }).filter((ev) => ev.date);
  }

  async function onImportFile(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    let text;
    try { text = await file.text(); } catch { toast("Couldn't read that file.", true); return; }
    const events = parseICS(text);
    if (!events.length) { toast("No events found — is that a .ics calendar file?", true); return; }

    const existing = getBookings();
    const seen = new Set(existing.map((b) => b.icsUid).filter(Boolean));
    existing.forEach((b) => seen.add(`${b.date}|${b.time}|${(b.name || "").toLowerCase()}`));

    const records = [];
    for (const ev of events) {
      const name = ev.summary || "Imported event";
      const key = `${ev.date}|${ev.time}|${name.toLowerCase()}`;
      if ((ev.uid && seen.has(ev.uid)) || seen.has(key)) continue;
      seen.add(key); if (ev.uid) seen.add(ev.uid);
      records.push({
        id: "ics_" + Math.random().toString(36).slice(2, 10),
        icsUid: ev.uid || null,
        userId: null,
        name, phone: "", phoneKey: "",
        serviceId: null, serviceName: "Imported event",
        therapistId: null, therapistName: ev.location || "",
        date: ev.date, time: ev.allDay ? "" : ev.time,
        price: 0,
        note: (ev.description || "").slice(0, 300),
        status: "confirmed", isReward: false, imported: true,
        createdAt: new Date().toISOString(),
      });
    }
    if (!records.length) { toast(`All ${events.length} events are already on the calendar.`); return; }
    await Store.addMany(records);
    await onChanged();
    const skipped = events.length - records.length;
    toast(`Imported ${records.length} event${records.length === 1 ? "" : "s"}${skipped ? ` · ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped` : ""} ✓`);
  }

  /* ---------- render ---------- */
  function render() {
    if (!$("#calendarPanel") || !$("#calBody")) return;
    renderLegend();
    if (mode === "month") renderMonth();
    else if (mode === "week") renderWeek();
    else renderDay();
  }

  /* ---------- public ---------- */
  window.NexusCalendar = {
    init(opts) {
      N = window.NEXUS; I = window.NexusIcons; WA = window.NexusWhatsApp; Store = window.NexusStore;
      getBookings = opts.getBookings;
      onChanged = opts.onChanged;
      selectedISO = todayISO();
      shell();
    },
    render,
    openAdd,
  };
})();
