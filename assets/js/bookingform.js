/* ============================================================================
   NEXUS CLINIC — Shared booking add / edit form (owner dashboard)

   One modal used everywhere the owner needs to put a booking in by hand — the
   calendar, the topbar "New booking" button, a client's profile, the schedule,
   the appointments list. Handles phone-in clients (no customer account needed),
   walk-ins, and editing an existing booking.

     NexusBookingForm.init({ getBookings, refresh })
     NexusBookingForm.open()                       // blank new booking (today)
     NexusBookingForm.open({ date, time })         // new booking, prefilled slot
     NexusBookingForm.open({ client })             // new booking for a client
     NexusBookingForm.open({ booking })            // EDIT an existing booking
   ========================================================================== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  let N, WA, Store;
  let getBookings = () => [];
  let refresh = () => {};
  let onSaved = null; // optional one-shot callback after a save

  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayISO = () => localISO(new Date());

  function ensureModal() {
    if ($("#bkFormModal")) return;
    const wrap = document.createElement("div");
    wrap.className = "modal-overlay";
    wrap.id = "bkFormModal";
    wrap.innerHTML = `
      <div class="modal cal-add-modal">
        <button class="modal-close" id="bkClose" aria-label="Close">✕</button>
        <h3 id="bkTitle">New booking</h3>
        <p class="sub" id="bkSub">Walk-in or phone booking — goes straight onto the calendar and counts toward loyalty.</p>
        <form id="bkForm" class="cal-form">
          <div class="cf-grid">
            <label>Client name<input type="text" id="bkName" required placeholder="e.g. Mariam Hassan" autocomplete="off" /></label>
            <label>Phone<input type="tel" id="bkPhone" required placeholder="01xxxxxxxxx" autocomplete="off" /></label>
            <label>Treatment<select id="bkService"></select></label>
            <label>Therapist<select id="bkTherapist"></select></label>
            <label>Date<input type="date" id="bkDate" required /></label>
            <label>Time<input type="time" id="bkTime" required step="900" /></label>
            <label>Price (${window.NEXUS.booking.currency})<input type="number" id="bkPrice" min="0" /></label>
            <label>Status<select id="bkStatus">
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed (done)</option>
              <option value="cancelled">Cancelled</option>
            </select></label>
            <label class="cf-wide">Note<input type="text" id="bkNote" placeholder="optional — e.g. referred by Dr. X, knee follow-up" /></label>
          </div>
          <label class="cf-check"><input type="checkbox" id="bkReward" /> <span>Free loyalty reward session (not charged, doesn't add to visit count)</span></label>
          <div class="cal-form-msg" id="bkMsg"></div>
          <div class="bk-actions">
            <button type="submit" class="btn block" id="bkSubmit">Add to calendar</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(wrap);

    $("#bkService").innerHTML = N.services.map((s) => `<option value="${s.id}">${esc(s.name)} — ${s.price} ${N.booking.currency}</option>`).join("");
    $("#bkTherapist").innerHTML = N.team.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("");

    $("#bkService").addEventListener("change", () => {
      if ($("#bkReward").checked) return;
      const s = N.services.find((x) => x.id === $("#bkService").value);
      if (s) $("#bkPrice").value = s.price;
    });
    $("#bkReward").addEventListener("change", () => {
      if ($("#bkReward").checked) $("#bkPrice").value = 0;
      else {
        const s = N.services.find((x) => x.id === $("#bkService").value);
        if (s) $("#bkPrice").value = s.price;
      }
    });
    $("#bkDate").addEventListener("change", () => {
      const d = new Date(($("#bkDate").value || todayISO()) + "T00:00:00");
      $("#bkMsg").textContent = (N.booking.closedWeekdays || []).includes(d.getDay())
        ? "Heads up: that's a Friday — the clinic is normally closed." : "";
    });
    $("#bkClose").addEventListener("click", close);
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && wrap.classList.contains("show")) close(); });
    $("#bkForm").addEventListener("submit", submit);
  }

  function close() { $("#bkFormModal").classList.remove("show"); }

  let editingId = null;

  function open(opts = {}) {
    ensureModal();
    const b = opts.booking || null;
    editingId = b ? b.id : null;
    onSaved = opts.onSaved || null;

    $("#bkTitle").textContent = b ? "Edit booking" : "New booking";
    $("#bkSub").textContent = b
      ? "Change any detail — updates everywhere instantly."
      : "Walk-in or phone booking — goes straight onto the calendar and counts toward loyalty.";
    $("#bkSubmit").textContent = b ? "Save changes" : "Add to calendar";
    $("#bkStatus").closest("label").style.display = b ? "" : "none";

    const client = opts.client || null;
    $("#bkName").value = b ? b.name || "" : client ? client.name || "" : "";
    $("#bkPhone").value = b ? b.phone || "" : client ? client.phone || "" : "";
    $("#bkService").value = b && b.serviceId ? b.serviceId : N.services[0].id;
    $("#bkTherapist").value = b && b.therapistId ? b.therapistId : N.team[0].id;
    $("#bkDate").value = b ? b.date : opts.date || todayISO();
    $("#bkTime").value = b ? b.time || "16:00" : opts.time || "16:00";
    $("#bkReward").checked = b ? !!b.isReward : false;
    const svc = N.services.find((x) => x.id === $("#bkService").value);
    $("#bkPrice").value = b ? (b.price != null ? b.price : svc ? svc.price : 0) : svc ? svc.price : 0;
    $("#bkNote").value = b ? b.note || "" : "";
    $("#bkStatus").value = b ? b.status || "confirmed" : "confirmed";
    $("#bkMsg").textContent = "";

    $("#bkFormModal").classList.add("show");
    setTimeout(() => $("#bkName").focus(), 60);
  }

  async function submit(e) {
    e.preventDefault();
    const svc = N.services.find((x) => x.id === $("#bkService").value);
    const th = N.team.find((x) => x.id === $("#bkTherapist").value);
    const reward = $("#bkReward").checked;
    const data = {
      name: $("#bkName").value.trim(),
      phone: $("#bkPhone").value.trim(),
      serviceId: svc.id, serviceName: svc.name,
      therapistId: th.id, therapistName: th.name,
      date: $("#bkDate").value, time: $("#bkTime").value,
      price: reward ? 0 : Number($("#bkPrice").value) || svc.price,
      note: $("#bkNote").value.trim(),
      isReward: reward,
    };
    let saved;
    if (editingId) {
      data.status = $("#bkStatus").value;
      saved = await Store.updateBooking(editingId, data);
    } else {
      saved = await Store.addBooking(data);
    }
    close();
    await refresh();
    if (onSaved) { try { onSaved(saved); } catch {} onSaved = null; }
    if (window.NexusToast) window.NexusToast(
      editingId ? `Saved — ${data.name}` : `Added — ${data.name} on ${WA.fmtDateLong(data.date)} at ${WA.fmtTime12(data.time)}`
    );
    editingId = null;
  }

  window.NexusBookingForm = {
    init(ctx) {
      N = window.NEXUS; WA = window.NexusWhatsApp; Store = window.NexusStore;
      getBookings = ctx.getBookings; refresh = ctx.refresh;
    },
    open,
  };
})();
