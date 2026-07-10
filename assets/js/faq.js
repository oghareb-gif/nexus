/* ============================================================================
   NEXUS CLINIC — FAQ page (dedicated /faq.html)
   Renders the FAQ accordion from config and wires the shared nav + footer.
   ========================================================================== */
(function () {
  const N = window.NEXUS;
  const WA = window.NexusWhatsApp;
  const Auth = window.NexusAuth;
  const $ = (s, r = document) => r.querySelector(s);

  /* ---- Account link in the nav (Sign in / My account) ---- */
  if (Auth) Auth.renderNavAccount(document.querySelector(".nav-actions"));

  /* ---- FAQ accordion ---- */
  if (N.faqs && $("#faqList")) {
    $("#faqList").innerHTML = N.faqs
      .map(
        (f) => `
      <details class="faq-item reveal">
        <summary><span>${f.q}</span><span class="faq-plus">+</span></summary>
        <div class="faq-a">${f.a}</div>
      </details>`
      )
      .join("");
  }

  /* ---- WhatsApp links ---- */
  const waLink = WA.chatLink(`Hi ${N.brand.name}, I have a question before booking a session.`);
  ["#waFaq", "#footWa"].forEach((sel) => {
    const el = $(sel);
    if (el) el.href = waLink;
  });

  /* ---- Footer contact ---- */
  $("#footAddress").textContent = N.brand.address;
  $("#footAddress").href = N.brand.mapsUrl;
  $("#footHours").textContent = N.brand.hours;
  $("#footPlus").textContent = "Plus code: " + N.brand.plusCode;
  $("#footPhone").textContent = N.contact.phoneDisplay;
  $("#footPhone").href = "tel:" + N.contact.phoneDisplay.replace(/\s/g, "");
  $("#footEmail").textContent = N.brand.email;
  $("#footEmail").href = "mailto:" + N.brand.email;
  $("#footIg").href = N.brand.instagram;
  $("#footFb").href = N.brand.facebook;
  $("#year").textContent = new Date().getFullYear();

  /* ---- Scroll reveal ---- */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.14 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
})();
