/* ============================================================================
   NEXUS CLINIC — WhatsApp handoff
   Builds a click-to-chat link (wa.me) with a pre-filled booking message aimed
   at the clinic's real WhatsApp number. No API keys, no approval — works today
   on mobile and desktop WhatsApp.
   ========================================================================== */

(function () {
  function fmtDateLong(dateStr) {
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    } catch {
      return dateStr;
    }
  }

  function fmtTime12(t) {
    const [h, m] = (t || "").split(":");
    const hour = parseInt(h, 10);
    if (isNaN(hour)) return t;
    return `${((hour + 11) % 12) + 1}:${m} ${hour >= 12 ? "PM" : "AM"}`;
  }

  /* Emojis as escaped code points so the message is correct no matter how the
     source file happens to be saved on disk. encodeURIComponent (below) then
     turns them into valid UTF-8 percent-escapes exactly once. */
  const EMOJI = {
    wave: "\u{1F44B}",   // 👋
    gift: "\u{1F381}",   // 🎁
    heart: "\u{1F49A}",  // 💚
    tag: "\u{1F3F7}\u{FE0F}", // 🏷️
  };

  /* Treatments for a booking as an array of names — mirrors Store.getTreatments
     but stays self-contained so whatsapp.js has no hard dependency. */
  function treatmentsOf(b) {
    if (window.NexusStore && window.NexusStore.getTreatments)
      return window.NexusStore.getTreatments(b);
    if (Array.isArray(b.treatments) && b.treatments.length) return b.treatments;
    return b.serviceName ? [b.serviceName] : [];
  }

  /* Compose the customer -> clinic message. */
  function bookingMessage(b) {
    const N = window.NEXUS;
    const treatments = treatmentsOf(b);
    const lines = [
      `Hi ${N.brand.name} ${EMOJI.wave} I'd like to confirm a booking:`,
      ``,
      `• Name: ${b.name}`,
      `• ${treatments.length > 1 ? "Treatments" : "Treatment"}: ${treatments.join(", ")}`,
      `• With: ${b.therapistName}`,
      `• Date: ${fmtDateLong(b.date)}`,
      `• Time: ${fmtTime12(b.time)}`,
    ];
    if (b.promoCode) lines.push(`• ${EMOJI.tag} Promo code: ${b.promoCode}`);
    if (b.isReward) lines.push(`• ${EMOJI.gift} Loyalty reward session`);
    if (b.note) lines.push(`• Note: ${b.note}`);
    lines.push(``, `Sent from the Nexus website ${EMOJI.heart}`);
    return lines.join("\n");
  }

  function link(number, message) {
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  window.NexusWhatsApp = {
    fmtDateLong,
    fmtTime12,
    bookingMessage,
    /* Full link for a booking to the clinic. */
    bookingLink(b) {
      return link(window.NEXUS.contact.whatsapp, bookingMessage(b));
    },
    /* Generic link (e.g. "I have a question"). */
    chatLink(text) {
      return link(
        window.NEXUS.contact.whatsapp,
        text || `Hi ${window.NEXUS.brand.name}, I have a question.`
      );
    },
    /* Link to a CLIENT's number (owner dashboard -> customer). Accepts local
       Egyptian numbers (01xxxxxxxxx) or full international, normalizes both. */
    chatLinkTo(phone, text) {
      let d = String(phone || "").replace(/[^\d]/g, "");
      if (d.startsWith("00")) d = d.slice(2);
      if (d.startsWith("0")) d = "20" + d.slice(1);      // 01x… -> 201x…
      else if (d.length === 10 && d.startsWith("1")) d = "20" + d;
      return link(d, text || "");
    },
  };
})();
