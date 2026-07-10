/* ============================================================================
   NEXUS CLINIC — Data store
   A tiny persistence layer for bookings + clients + loyalty.

   Default mode: browser localStorage (works with zero setup — just open the
   HTML files). If the optional Node backend is running on the same origin,
   the store transparently uses it instead so data is shared across devices.
   ========================================================================== */

(function () {
  const LS_KEY = "nexus_bookings_v1";
  const API_BASE = "/api"; // used only if a backend is detected

  let backendReady = null; // null = unknown, true/false once probed

  /* ---------- helpers ---------- */
  const uid = () =>
    "bk_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const normalizePhone = (raw) =>
    (raw || "").replace(/[^\d]/g, "").replace(/^0+/, "");

  function readLS() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY)) || [];
    } catch {
      return [];
    }
  }
  function writeLS(list) {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  }

  async function probeBackend() {
    if (backendReady !== null) return backendReady;
    try {
      const r = await fetch(`${API_BASE}/health`, { method: "GET" });
      backendReady = r.ok;
    } catch {
      backendReady = false;
    }
    return backendReady;
  }

  /* ---------- public API ---------- */
  const Store = {
    normalizePhone,

    /* Save a booking. Returns the stored record (with id + loyalty snapshot). */
    async addBooking(data) {
      const record = {
        id: uid(),
        userId: data.userId || null,
        name: (data.name || "").trim(),
        phone: (data.phone || "").trim(),
        phoneKey: normalizePhone(data.phone),
        serviceId: data.serviceId,
        serviceName: data.serviceName,
        therapistId: data.therapistId,
        therapistName: data.therapistName,
        date: data.date, // YYYY-MM-DD
        time: data.time, // HH:MM
        price: Number(data.price) || 0,
        note: (data.note || "").trim(),
        status: "confirmed",
        isReward: !!data.isReward,
        createdAt: new Date().toISOString(),
      };

      if (await probeBackend()) {
        try {
          const r = await fetch(`${API_BASE}/bookings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(record),
          });
          if (r.ok) return await r.json();
        } catch {
          /* fall through to localStorage */
        }
      }

      const list = readLS();
      list.push(record);
      writeLS(list);
      return record;
    },

    /* All bookings, newest first. */
    async getBookings() {
      if (await probeBackend()) {
        try {
          const r = await fetch(`${API_BASE}/bookings`);
          if (r.ok) return await r.json();
        } catch {}
      }
      return readLS().sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    },

    async deleteBooking(id) {
      if (await probeBackend()) {
        try {
          await fetch(`${API_BASE}/bookings/${id}`, { method: "DELETE" });
          return;
        } catch {}
      }
      writeLS(readLS().filter((b) => b.id !== id));
    },

    async updateStatus(id, status) {
      if (await probeBackend()) {
        try {
          await fetch(`${API_BASE}/bookings/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          });
          return;
        } catch {}
      }
      const list = readLS();
      const b = list.find((x) => x.id === id);
      if (b) {
        b.status = status;
        writeLS(list);
      }
    },

    /* Loyalty snapshot for a phone number, based on completed visits.
       A visit counts once it is not cancelled. */
    loyaltyFor(bookings, phone) {
      const cfg = window.NEXUS.loyalty;
      const key = normalizePhone(phone);
      const visits = bookings.filter(
        (b) => b.phoneKey === key && b.status !== "cancelled" && !b.isReward
      ).length;
      const threshold = cfg.threshold;
      const cyclePos = threshold ? visits % threshold : 0;
      const rewardsEarned = threshold ? Math.floor(visits / threshold) : 0;
      const toNext = threshold ? threshold - cyclePos : 0;
      return {
        visits,
        threshold,
        cyclePos,
        toNext: cyclePos === 0 && visits > 0 ? 0 : toNext,
        rewardReady: threshold ? visits > 0 && cyclePos === 0 : false,
        rewardsEarned,
        rewardLabel: cfg.rewardLabel,
      };
    },

    /* Roll bookings up into unique clients (keyed by phone). */
    clientsFrom(bookings) {
      const map = new Map();
      for (const b of bookings) {
        const key = b.phoneKey || normalizePhone(b.phone);
        if (!key) continue;
        if (!map.has(key)) {
          map.set(key, {
            phoneKey: key,
            name: b.name,
            phone: b.phone,
            visits: 0,
            spend: 0,
            lastVisit: b.date,
            firstSeen: b.createdAt,
          });
        }
        const c = map.get(key);
        if (b.status !== "cancelled") {
          if (!b.isReward) c.visits += 1;
          c.spend += b.isReward ? 0 : b.price;
        }
        if (b.name) c.name = b.name;
        if (b.date > c.lastVisit) c.lastVisit = b.date;
        if (new Date(b.createdAt) < new Date(c.firstSeen))
          c.firstSeen = b.createdAt;
      }
      return [...map.values()].map((c) => ({
        ...c,
        loyalty: Store.loyaltyFor(bookings, c.phone),
      }));
    },

    /* Is an appointment still "active" — i.e. upcoming and not cancelled or
       completed? Used to cap how many open reservations one account can hold. */
    isActive(b) {
      if (!b || b.status === "cancelled" || b.status === "completed") return false;
      const when = new Date(`${b.date}T${b.time || "00:00"}`);
      // Keep it "active" until an hour after the slot start.
      return when >= new Date(Date.now() - 3600000);
    },

    /* Every booking belonging to one account (by userId, with phone fallback
       so pre-account guest history still shows up), newest first. */
    bookingsForUser(bookings, user) {
      if (!user) return [];
      const phoneKey = user.phoneKey || normalizePhone(user.phone);
      return bookings
        .filter(
          (b) =>
            (user.id && b.userId === user.id) ||
            (phoneKey && b.phoneKey === phoneKey)
        )
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    /* Active (upcoming) reservations for an account. */
    activeBookingsForUser(bookings, user) {
      return Store.bookingsForUser(bookings, user).filter(Store.isActive);
    },

    /* Reservation-cap check. Returns { count, max, atCap, remaining }. */
    reservationCap(bookings, user) {
      const max = (window.NEXUS.account && window.NEXUS.account.maxActiveReservations) || 2;
      const count = Store.activeBookingsForUser(bookings, user).length;
      return { count, max, atCap: count >= max, remaining: Math.max(0, max - count) };
    },
  };

  window.NexusStore = Store;
})();
