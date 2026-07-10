/* ============================================================================
   NEXUS CLINIC — Sign in / Create account
   ========================================================================== */
(function () {
  const Auth = window.NexusAuth;
  const $ = (s) => document.querySelector(s);

  const params = new URLSearchParams(location.search);
  const next = params.get("next"); // e.g. "book" → book.html after auth
  const startTab = params.get("tab") === "register" ? "register" : "login";

  /* Already signed in? Skip straight to where they were headed. */
  if (Auth.currentUser()) {
    location.replace(destination());
    return;
  }

  function destination() {
    if (next === "book") return "book.html";
    if (next === "account") return "account.html";
    return "account.html";
  }

  /* ---------- Tabs ---------- */
  function setTab(tab) {
    document.querySelectorAll("#authTabs button").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === tab)
    );
    document.querySelectorAll(".auth-form").forEach((f) =>
      f.classList.toggle("active", f.dataset.form === tab)
    );
    $("#authTitle").textContent = tab === "register" ? "Create your account" : "Welcome back";
    $("#authLede").textContent =
      tab === "register"
        ? "One account to book sessions and collect loyalty rewards."
        : "Sign in to book a session and track your rewards.";
  }
  document.querySelectorAll("#authTabs button").forEach((b) =>
    b.addEventListener("click", () => setTab(b.dataset.tab))
  );
  document.querySelectorAll("[data-goto]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      setTab(a.dataset.goto);
    })
  );
  setTab(startTab);

  function showMsg(id, text, ok) {
    const el = $("#" + id);
    el.textContent = text;
    el.className = "auth-msg " + (ok ? "ok" : "err") + (text ? " show" : "");
  }

  /* ---------- Sign in ---------- */
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#loginBtn");
    btn.disabled = true;
    try {
      await Auth.login({ identifier: $("#liId").value, password: $("#liPass").value });
      showMsg("loginMsg", "Signed in — taking you through…", true);
      location.href = destination();
    } catch (err) {
      showMsg("loginMsg", err.message || "Could not sign in.", false);
      btn.disabled = false;
    }
  });

  /* ---------- Register ---------- */
  $("#registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#registerBtn");
    btn.disabled = true;
    try {
      await Auth.register({
        name: $("#rgName").value,
        email: $("#rgEmail").value,
        phone: $("#rgPhone").value,
        password: $("#rgPass").value,
      });
      showMsg("registerMsg", "Account created — welcome to Nexus!", true);
      location.href = destination();
    } catch (err) {
      showMsg("registerMsg", err.message || "Could not create account.", false);
      btn.disabled = false;
    }
  });
})();
