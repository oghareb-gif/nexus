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

  /* Compose the customer -> clinic message. */
  function bookingMessage(b) {
    const N = window.NEXUS;
    const lines = [
      `Hi ${N.brand.name} 👋 I'd like to confirm a booking:`,
      ``,
      `• Name: ${b.name}`,
      `• Treatment: ${b.serviceName}`,
      `• With: ${b.therapistName}`,
      `• Date: ${fmtDateLong(b.date)}`,
      `• Time: ${fmtTime12(b.time)}`,
    ];
    if (b.isReward) lines.push(`• 🎁 Loyalty reward session`);
    if (b.note) lines.push(`• Note: ${b.note}`);
    lines.push(``, `Sent from the Nexus website`);
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
  };
})();
