/* ============================================================================
   NEXUS CLINIC — Customer accounts (auth)

   A lightweight, dependency-free auth layer for the customer portal.
   Users + the current session live in the browser's localStorage.

   ⚠️  IMPORTANT — this is a PROTOTYPE store:
   Everything runs in the browser, so passwords (hashed, never stored in the
   clear) live on the device only. This is perfect for a demo / single-device
   clinic setup, but it is NOT a substitute for a real server + database when
   you take real customer passwords to production. When you host a proper
   backend, this module is the one piece to swap out.

   Login works with EITHER an email OR a phone number, plus a password.
   ========================================================================== */

(function () {
  const USERS_KEY = "nexus_users_v1";
  const SESSION_KEY = "nexus_session_v1";

  /* ---------- storage helpers ---------- */
  function readUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch {
      return [];
    }
  }
  function writeUsers(list) {
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
  }

  const uid = () =>
    "usr_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const normalizePhone = (raw) =>
    (raw || "").replace(/[^\d]/g, "").replace(/^0+/, "");

  const normalizeEmail = (raw) => (raw || "").trim().toLowerCase();

  const looksLikeEmail = (v) => /\S+@\S+\.\S+/.test((v || "").trim());

  /* ---------- password hashing (SHA-256 + per-user salt) ---------- */
  function randomSalt() {
    if (window.crypto && crypto.getRandomValues) {
      const a = new Uint8Array(16);
      crypto.getRandomValues(a);
      return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  async function hashPassword(password, salt) {
    const input = salt + ":" + password;
    if (window.crypto && crypto.subtle) {
      try {
        const data = new TextEncoder().encode(input);
        const buf = await crypto.subtle.digest("SHA-256", data);
        return (
          "sha256$" +
          [...new Uint8Array(buf)]
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
        );
      } catch {
        /* fall through to non-crypto fallback (e.g. file:// in some browsers) */
      }
    }
    // Fallback (non-cryptographic) — only used where SubtleCrypto is unavailable.
    let h = 5381;
    for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
    return "fb$" + h.toString(16);
  }

  /* Strip the secret fields before handing a user object to page code. */
  function publicUser(u) {
    if (!u) return null;
    const { passHash, salt, ...safe } = u;
    return safe;
  }

  /* ---------- public API ---------- */
  const Auth = {
    normalizePhone,
    looksLikeEmail,

    /* Create an account and sign the person in. Throws Error(message) on
       validation problems so the UI can show a friendly message. */
    async register({ name, email, phone, password }) {
      name = (name || "").trim();
      const emailKey = normalizeEmail(email);
      const phoneKey = normalizePhone(phone);

      if (!name) throw new Error("Please enter your name.");
      // Phone is REQUIRED — it's the anti-abuse anchor: one real number = one
      // account = capped bookings. (Duplicate numbers are rejected below.)
      if (!phoneKey) throw new Error("A phone number is required.");
      if (phoneKey.length < 8)
        throw new Error("That phone number looks too short.");
      if (emailKey && !looksLikeEmail(emailKey))
        throw new Error("That email doesn't look right.");
      if (!password || password.length < 6)
        throw new Error("Password must be at least 6 characters.");

      const users = readUsers();
      if (emailKey && users.some((u) => u.emailKey === emailKey))
        throw new Error("An account with that email already exists.");
      if (phoneKey && users.some((u) => u.phoneKey === phoneKey))
        throw new Error("An account with that phone number already exists.");

      const salt = randomSalt();
      const passHash = await hashPassword(password, salt);
      const user = {
        id: uid(),
        name,
        email: emailKey || "",
        emailKey: emailKey || "",
        phone: (phone || "").trim(),
        phoneKey: phoneKey || "",
        salt,
        passHash,
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      writeUsers(users);
      this._setSession(user.id);
      return publicUser(user);
    },

    /* Sign in with email OR phone + password. Throws on failure. */
    async login({ identifier, password }) {
      identifier = (identifier || "").trim();
      if (!identifier || !password)
        throw new Error("Enter your login and password.");

      const users = readUsers();
      const byEmail = normalizeEmail(identifier);
      const byPhone = normalizePhone(identifier);
      const user = users.find(
        (u) =>
          (u.emailKey && u.emailKey === byEmail) ||
          (u.phoneKey && byPhone && u.phoneKey === byPhone)
      );
      if (!user) throw new Error("No account found with those details.");

      const attempt = await hashPassword(password, user.salt);
      if (attempt !== user.passHash) throw new Error("Incorrect password.");

      this._setSession(user.id);
      return publicUser(user);
    },

    logout() {
      localStorage.removeItem(SESSION_KEY);
    },

    /* The signed-in user (safe fields only), or null. */
    currentUser() {
      let sess;
      try {
        sess = JSON.parse(localStorage.getItem(SESSION_KEY));
      } catch {
        sess = null;
      }
      if (!sess || !sess.userId) return null;
      const user = readUsers().find((u) => u.id === sess.userId);
      return publicUser(user);
    },

    isLoggedIn() {
      return !!this.currentUser();
    },

    /* All accounts (safe fields) — used by the owner dashboard. */
    allUsers() {
      return readUsers().map(publicUser);
    },

    _setSession(userId) {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ userId, at: new Date().toISOString() })
      );
    },

    /* Inject the right account control into a nav bar.
       Pass the element that should hold the link (e.g. the nav-actions div). */
    renderNavAccount(container) {
      if (!container) return;
      const u = this.currentUser();
      const existing = container.querySelector("[data-account-link]");
      if (existing) existing.remove();
      const a = document.createElement("a");
      a.setAttribute("data-account-link", "");
      a.className = "ghost";
      a.style.padding = "8px 13px";
      a.style.fontSize = "0.78rem";
      if (u) {
        a.href = "account.html";
        a.textContent = u.name.split(" ")[0] + " · Account";
      } else {
        a.href = "login.html";
        a.textContent = "Sign in";
      }
      // Place it before the last child (usually the primary "Book" button).
      container.insertBefore(a, container.lastElementChild);
    },
  };

  window.NexusAuth = Auth;
})();
