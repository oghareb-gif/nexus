/* ============================================================================
   NEXUS CLINIC — Shared mobile navigation
   Adds a hamburger menu on small screens. On desktop the nav is untouched.
   Include this LAST on every public page (after any script that injects nav
   items, e.g. auth.renderNavAccount) so those items get relocated too.
   ========================================================================== */
(function () {
  const nav = document.querySelector("nav");
  if (!nav) return;
  const wrap = nav.querySelector(".wrap");
  const links = nav.querySelector(".nav-links");
  const actions = nav.querySelector(".nav-actions");
  if (!wrap || (!links && !actions)) return;

  /* Hamburger button (three bars) */
  const toggle = document.createElement("button");
  toggle.className = "mobile-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Open menu");
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = "<span></span><span></span><span></span>";
  wrap.appendChild(toggle);

  /* Drawer that holds the links + actions on mobile */
  const drawer = document.createElement("div");
  drawer.className = "nav-drawer";
  nav.appendChild(drawer);

  const mq = window.matchMedia("(max-width: 900px)");
  let placement = "bar";

  /* The primary CTA (Book a session / Home) stays visible in the bar on
     mobile instead of hiding inside the drawer — booking is one tap away. */
  const barCta = actions ? actions.querySelector(".btn") : null;

  function toBar() {
    if (placement === "bar") return;
    if (links) wrap.insertBefore(links, toggle);
    if (actions) wrap.insertBefore(actions, toggle);
    if (barCta) {
      barCta.classList.remove("nav-bar-cta");
      actions.appendChild(barCta);
    }
    placement = "bar";
  }
  function toDrawer() {
    if (placement === "drawer") return;
    if (links) drawer.appendChild(links);
    if (actions) drawer.appendChild(actions);
    if (barCta) {
      barCta.classList.add("nav-bar-cta");
      wrap.insertBefore(barCta, toggle);
    }
    placement = "drawer";
  }
  function close() {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
  }
  function apply() {
    if (mq.matches) {
      toDrawer();
    } else {
      close();
      toBar();
    }
  }

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });

  /* Tapping any link/button inside the drawer closes it. */
  drawer.addEventListener("click", (e) => {
    if (e.target.closest("a, button")) close();
  });

  if (mq.addEventListener) mq.addEventListener("change", apply);
  else if (mq.addListener) mq.addListener(apply);

  /* Fallback: some environments don't reliably fire matchMedia "change".
     A debounced resize listener keeps placement correct across the breakpoint. */
  let rafPending = false;
  window.addEventListener("resize", () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      apply();
    });
  });

  apply();
})();
