/* ============================================================================
   NEXUS CLINIC — Homepage rendering & interactions
   ========================================================================== */
(function () {
  const N = window.NEXUS;
  const I = window.NexusIcons;
  const WA = window.NexusWhatsApp;
  const Auth = window.NexusAuth;
  const $ = (s, r = document) => r.querySelector(s);
  const money = (n) => `${Number(n).toLocaleString("en-US")} ${N.booking.currency}`;

  /* ---- Account link in the nav (Sign in / My account) ---- */
  if (Auth) Auth.renderNavAccount(document.querySelector(".nav-actions"));

  /* ---- Hero trust stats ---- */
  $("#heroTrust").innerHTML = [
    { n: `<b>${N.proof.googleRating.toFixed(1)}</b>`, l: `Google · ${N.proof.googleReviews} reviews` },
    { n: `${N.proof.recoveryRate}<b>%</b>`, l: "Recovery rate" },
  ]
    .map((s) => `<div class="trust-item"><div class="n">${s.n}</div><div class="l">${s.l}</div></div>`)
    .join("");

  /* ---- Marquee ---- */
  const words = [
    "Sports Injury", "Post-Surgical Rehab", "Manual Therapy", "Cupping · Hijama",
    "Recovery", "Performance", "Move Beyond",
  ];
  const line = words.map((w) => `${w} <span class="dot">✕</span>`).join(" ");
  $("#marquee").innerHTML = `<span>${line}</span><span>${line}</span>`;

  /* ---- Services ---- */
  $("#servicesGrid").innerHTML = N.services
    .map(
      (s) => `
    <div class="service-card reveal">
      <div class="service-ico">${I[s.icon] || I.spark}</div>
      <h3>${s.name}</h3>
      <p>${s.desc}</p>
      <div class="service-meta">
        <span>${s.duration} min</span>
        <span class="price">${money(s.price)}</span>
      </div>
    </div>`
    )
    .join("");

  /* ---- Athlete showcase: featured story + trusted-by grid ----
     Photos load from local files (assets/img/…) and fall back to the stock
     shot until the real one is dropped in. */
  const imgFall = (item) =>
    item.fallback ? ` onerror="this.onerror=null;this.src='${item.fallback}'"` : "";
  const featured = N.athletes.find((x) => x.featured) || N.athletes[0];
  $("#athleteShowcase").innerHTML = `
    <div class="athlete reveal">
      <div class="a-media">
        <img src="${featured.photo}" alt="${featured.name}" loading="lazy"${imgFall(featured)} />
        <span class="tag">${featured.tag || "Back on court"}</span>
      </div>
      <div class="a-body">
        <div class="quote-mark">“</div>
        <h3>${featured.name}</h3>
        <div class="who">${featured.title}</div>
        <p>${featured.story}</p>
      </div>
    </div>`;

  $("#athleteGrid").innerHTML = N.athletes
    .filter((x) => !x.featured)
    .map(
      (a) => `
    <div class="athlete-card reveal">
      <div class="ac-media"><img src="${a.photo}" alt="${a.name}" loading="lazy"${imgFall(a)} /><span class="ac-tag">${a.tag || ""}</span></div>
      <div class="ac-body">
        <h4>${a.name}</h4>
        <div class="ac-sport">${a.sport}</div>
        <p>${a.title}</p>
      </div>
    </div>`
    )
    .join("");

  /* ---- Instagram strip ---- */
  if (N.instagram) {
    $("#igFollow").textContent = `Follow ${N.instagram.handle} — ${N.instagram.followers} strong.`;

    // Real embedded posts/reels (if any shortcodes are configured).
    // The /p/<code>/embed/ endpoint renders both feed posts and reels.
    const reels = (N.instagram.reels || []).slice(0, 3); // one clean row of three
    if (reels.length) {
      $("#igReels").innerHTML = reels
        .map(
          (id) => `
        <div class="ig-reel reveal">
          <iframe src="https://www.instagram.com/p/${id}/embed/" loading="lazy"
            title="Instagram post from ${N.instagram.handle}"
            scrolling="no" allowtransparency="true" frameborder="0"
            allow="encrypted-media; clipboard-write"></iframe>
        </div>`
        )
        .join("");
      // Real content present — retire the stock placeholder cards.
      const g = $("#igGrid");
      if (g) g.remove();
    } else {
      const r = $("#igReels");
      if (r) r.remove();
      $("#igGrid").innerHTML = N.instagram.posts
        .map(
          (p) => `
        <a class="ig-card reveal" href="${N.instagram.url}" target="_blank" rel="noopener" style="--accent:${p.accent}">
          <img src="${p.img}" alt="${p.label}" loading="lazy" />
          <span class="ig-play">▶</span>
          <span class="ig-label">${p.label}</span>
        </a>`
        )
        .join("");
    }
    $("#igCta").href = N.instagram.url;
  }

  /* ---- Reviews ---- */
  $("#scoreBig").textContent = N.proof.googleRating.toFixed(1);
  $("#scoreCount").textContent = `${N.proof.googleReviews} Google reviews`;
  $("#reviewThemes").innerHTML = N.reviewThemes
    .map((t) => `<span class="chip lime">“${t}”</span>`)
    .join("");
  $("#reviewsBelt").innerHTML =
    N.reviews
      .map(
        (r) => `
    <div class="review-card reveal">
      <div class="stars">${"★".repeat(r.stars)}</div>
      <p>“${r.text}”</p>
      <div class="r-foot">
        <b>${r.name}</b>
        <span class="src"><span class="verified">✓</span> ${r.source}</span>
      </div>
    </div>`
      )
      .join("") +
    `
    <a class="review-card review-cta reveal" href="${N.brand.mapsUrl}" target="_blank" rel="noopener">
      <span class="rc-score">${N.proof.googleRating.toFixed(1)}</span>
      <span class="rc-stars">★★★★★</span>
      <span class="rc-txt">Read all ${N.proof.googleReviews} reviews on Google →</span>
      <span class="rc-sub">Verified · never edited</span>
    </a>`;

  /* ---- Team ---- */
  $("#teamGrid").innerHTML = N.team
    .map(
      (m) => `
    <div class="team-card reveal">
      <div class="t-photo"><img src="${m.photo}" alt="${m.name}" loading="lazy"${imgFall(m)} /></div>
      <div class="t-body">
        <h4>${m.name}</h4>
        <div class="role">${m.role}</div>
        <p>${m.bio}</p>
        <div class="team-tags">${m.tags.map((t) => `<span class="chip">${t}</span>`).join("")}</div>
      </div>
    </div>`
    )
    .join("");

  /* ---- FAQ (accordion) ---- */
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

  /* ---- Visit: embedded map + location & payment details ---- */
  if (N.location && $("#mapFrame")) {
    const { lat, lng } = N.location;
    // Google Maps embed — no API key required.
    $("#mapFrame").src = `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  }
  if ($("#visitInfo")) {
    const P = N.payment || {};
    const tel = "tel:" + N.contact.phoneDisplay.replace(/\s/g, "");
    const waLink = WA.chatLink(`Hi ${N.brand.name}, I'd like to visit the clinic — could you help with directions?`);
    const row = (icon, label, value) =>
      `<div class="vi-row">${I[icon] || ""}<div><b>${label}</b>${value}</div></div>`;
    $("#visitInfo").innerHTML = `
      ${row("pin", "Address", `<a href="${N.brand.mapsUrl}" target="_blank" rel="noopener">${N.brand.address}</a>`)}
      ${row("clock", "Hours", `<span>${N.brand.hours}</span>`)}
      ${row("phone", "Call us", `<a href="${tel}">${N.contact.phoneDisplay}</a>`)}
      ${row("whatsapp", "WhatsApp", `<a href="${waLink}" target="_blank" rel="noopener">Message us</a>`)}
      ${N.location.parking ? row("pin", "Parking", `<span>${N.location.parking}</span>`) : ""}
      <a class="btn block" href="${N.brand.mapsUrl}" target="_blank" rel="noopener" style="margin-top:6px;">Get directions →</a>
      ${
        P.methods
          ? `<div class="pay-card">
              <div class="pay-head">${I.wallet}<b>We accept</b></div>
              <div class="pay-chips">${P.methods.map((m) => `<span class="chip">${m}</span>`).join("")}</div>
            </div>`
          : ""
      }`;
  }

  /* ---- WhatsApp links ---- */
  const waLink = WA.chatLink(`Hi ${N.brand.name}, I'd like to ask about booking a session.`);
  ["#waHero", "#waCta", "#waAuto", "#footWa"].forEach((sel) => {
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

  /* ---- WhatsApp demo animation (loops) ---- */
  const typing = $("#waTyping");
  const reply = $("#waReply");
  function runDemo() {
    if (!typing || !reply) return;
    reply.style.display = "none";
    typing.style.display = "flex";
    setTimeout(() => {
      typing.style.display = "none";
      reply.style.display = "flex"; // .wa-more is a flex column of bubbles
    }, 1400);
  }
  const demoObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          runDemo();
          setInterval(runDemo, 6000);
          demoObs.disconnect();
        }
      });
    },
    { threshold: 0.4 }
  );
  const demoEl = $("#automation");
  if (demoEl) demoObs.observe(demoEl);
})();
