/* ============================================================================
   NEXUS CLINIC — WhatsApp Business API sender (zero dependencies)

   This is the FULL-AUTO half of the WhatsApp system. The owner dashboard
   already queues confirmations + 1-hour reminders as one-tap sends; once the
   clinic has WhatsApp Business API credentials, this module sends the exact
   same messages automatically from the server.

   Supported providers (pick one, set env vars, restart the server):

   ── Meta WhatsApp Cloud API (recommended — free tier) ──────────────────────
     WA_PROVIDER=meta
     WA_META_TOKEN=<permanent access token>
     WA_META_PHONE_ID=<phone number ID from the Meta app dashboard>

   ── Twilio WhatsApp ────────────────────────────────────────────────────────
     WA_PROVIDER=twilio
     WA_TWILIO_SID=<account SID>
     WA_TWILIO_AUTH=<auth token>
     WA_TWILIO_FROM=whatsapp:+14155238886   (your Twilio WhatsApp number)

   Full setup walkthrough: ../WHATSAPP-SETUP.md
   ========================================================================== */

const https = require("https");
const fs = require("fs");
const path = require("path");

const LOG = path.join(__dirname, "data", "wa-log.json"); // { "<id>:confirm": ts }
const REMINDER_MINUTES = 60;

/* ---------- message templates (keep in sync with assets/js/config.js) ----
   Emojis are written as escaped code points so the message stays correct no
   matter how this file is saved/transferred/deployed (same rule as the
   frontend templates in assets/js/config.js). */
const TEMPLATES = {
  confirm:
    "Hi {name}! \u{1F44B} This is Nexus Physio Clinic.\nYour booking is confirmed \u{2705}\n• {service} with {therapist}\n• {date} at {time}\n\u{1F4CD} 31 El-Imam Ali St, Almazah, Heliopolis\nSee you then! \u{1F49A}",
  reminder:
    "Hi {name}! \u{23F0} Reminder from Nexus Physio Clinic — your {service} with {therapist} is today at {time} (about an hour from now).\nPlease reply *CONFIRM* so we hold your slot \u{1F49A}",
};

function renderTemplate(tpl, b) {
  const d = new Date(b.date + "T00:00:00");
  const dateLong = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const [h, m] = (b.time || "0:0").split(":").map(Number);
  const time12 = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  // Multi-treatment bookings store every name in b.treatments (same shape as
  // Store.getTreatments on the frontend); b.serviceName is the single-treatment
  // fallback kept for older records.
  const service =
    Array.isArray(b.treatments) && b.treatments.length
      ? b.treatments.join(", ")
      : b.serviceName || "your session";
  return tpl
    .replace(/\{name\}/g, (b.name || "").split(" ")[0])
    .replace(/\{service\}/g, service)
    .replace(/\{therapist\}/g, b.therapistName || "our team")
    .replace(/\{date\}/g, dateLong)
    .replace(/\{time\}/g, time12);
}

/* ---------- provider config ---------- */
function provider() {
  const p = (process.env.WA_PROVIDER || "").toLowerCase();
  if (p === "meta" && process.env.WA_META_TOKEN && process.env.WA_META_PHONE_ID) return "meta";
  if (p === "twilio" && process.env.WA_TWILIO_SID && process.env.WA_TWILIO_AUTH && process.env.WA_TWILIO_FROM) return "twilio";
  return null; // not configured — dashboard stays in semi-automatic mode
}

/* Egyptian local (01xxxxxxxxx) -> international digits (201xxxxxxxxx). */
function intl(phone) {
  let d = String(phone || "").replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "20" + d.slice(1);
  else if (d.length === 10 && d.startsWith("1")) d = "20" + d;
  return d;
}

/* ---------- raw send ---------- */
function post(options, payload) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let out = "";
      res.on("data", (c) => (out += c));
      res.on("end", () =>
        res.statusCode >= 200 && res.statusCode < 300
          ? resolve(out)
          : reject(new Error(`HTTP ${res.statusCode}: ${out.slice(0, 300)}`))
      );
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function sendWhatsApp(to, text) {
  const p = provider();
  if (!p) throw new Error("WhatsApp API not configured (see WHATSAPP-SETUP.md)");
  const number = intl(to);

  if (p === "meta") {
    const payload = JSON.stringify({
      messaging_product: "whatsapp",
      to: number,
      type: "text",
      text: { body: text },
    });
    return post(
      {
        hostname: "graph.facebook.com",
        path: `/v20.0/${process.env.WA_META_PHONE_ID}/messages`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WA_META_TOKEN}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      payload
    );
  }

  // twilio
  const form = new URLSearchParams({
    From: process.env.WA_TWILIO_FROM,
    To: `whatsapp:+${number}`,
    Body: text,
  }).toString();
  return post(
    {
      hostname: "api.twilio.com",
      path: `/2010-04-01/Accounts/${process.env.WA_TWILIO_SID}/Messages.json`,
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${process.env.WA_TWILIO_SID}:${process.env.WA_TWILIO_AUTH}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(form),
      },
    },
    form
  );
}

/* ---------- sent log (so nothing is ever sent twice) ---------- */
function readLog() {
  try { return JSON.parse(fs.readFileSync(LOG, "utf8")); } catch { return {}; }
}
function writeLog(log) {
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.writeFileSync(LOG, JSON.stringify(log, null, 2));
}

/* ---------- the automation loop ----------
   Call startLoop(readBookings) once from server.js. Every minute it:
   1. sends a confirmation for any new booking that hasn't had one, and
   2. sends the reminder when a session is REMINDER_MINUTES away.        */
function startLoop(readBookings) {
  if (!provider()) {
    console.log("[whatsapp] API not configured — dashboard stays in semi-automatic mode.");
    return;
  }
  console.log(`[whatsapp] auto-send ON via ${provider()} — confirmations + ${REMINDER_MINUTES}-min reminders`);

  const tick = async () => {
    const log = readLog();
    const now = Date.now();
    const list = readBookings().filter(
      (b) => b.status === "confirmed" && b.phone && b.time && !b.imported
    );
    for (const b of list) {
      const start = new Date(`${b.date}T${b.time}`).getTime();
      try {
        if (start > now && !log[`${b.id}:confirm`]) {
          await sendWhatsApp(b.phone, renderTemplate(TEMPLATES.confirm, b));
          log[`${b.id}:confirm`] = new Date().toISOString();
          console.log(`[whatsapp] confirmation -> ${b.name} (${b.phone})`);
        }
        const untilMin = (start - now) / 60000;
        if (untilMin > 0 && untilMin <= REMINDER_MINUTES && !log[`${b.id}:reminder`]) {
          await sendWhatsApp(b.phone, renderTemplate(TEMPLATES.reminder, b));
          log[`${b.id}:reminder`] = new Date().toISOString();
          console.log(`[whatsapp] reminder -> ${b.name} (${b.phone})`);
        }
      } catch (err) {
        console.error(`[whatsapp] send failed for ${b.name}: ${err.message}`);
      }
    }
    writeLog(log);
  };

  tick();
  setInterval(tick, 60 * 1000);
}

/* ---------- inbound webhook (Meta Cloud API) ----------
   When a client replies "CONFIRM", mark their next booking as confirmed by
   the client. Wire this into server.js:
     GET  /api/wa-webhook  -> verifyWebhook(req, res)      (Meta verification)
     POST /api/wa-webhook  -> handleInbound(body, bookings, saveBookings)   */
function verifyWebhook(query, res) {
  const token = process.env.WA_META_VERIFY_TOKEN || "nexus-verify";
  if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === token) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(query["hub.challenge"]);
  } else {
    res.writeHead(403);
    res.end();
  }
}

function handleInbound(payload, bookings, saveBookings) {
  try {
    const msg = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg || msg.type !== "text") return null;
    const from = msg.from; // international digits
    const text = (msg.text?.body || "").trim().toLowerCase();
    if (!/^(confirm|yes|ok|\u{1F44D}|تمام|اكد|أكد)/u.test(text)) return null;
    const now = Date.now();
    const next = bookings
      .filter((b) => intl(b.phone) === from && b.status === "confirmed" && new Date(`${b.date}T${b.time || "00:00"}`).getTime() > now - 600000)
      .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`))[0];
    if (next) {
      next.clientConfirmed = new Date().toISOString();
      saveBookings(bookings);
      console.log(`[whatsapp] ${next.name} confirmed their ${next.date} ${next.time} session ✓`);
      return next;
    }
  } catch (err) {
    console.error("[whatsapp] inbound parse failed:", err.message);
  }
  return null;
}

module.exports = { sendWhatsApp, startLoop, verifyWebhook, handleInbound, renderTemplate, TEMPLATES, intl };
