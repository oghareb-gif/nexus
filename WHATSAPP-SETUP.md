# WhatsApp automation — how it works & how to switch it to full-auto

The clinic asked for two automated messages:

1. **Booking confirmation** — sent right after a client books.
2. **1-hour reminder** — sent ~60 minutes before the session, asking the client
   to reply **CONFIRM**.

Both are built. What changes with the API is only *who presses send*.

---

## Today: semi-automatic (works right now, zero cost, zero setup)

Open **Dashboard → WhatsApp**. The site watches every booking and queues what's
due:

- **Booking confirmations** — every new booking that hasn't received its ✅ message
- **Reminders due** — sessions starting within the next 60 minutes
- **Later today** — what will become due, so nothing sneaks up on you

Each item is **one tap**: it opens WhatsApp with the message already written to
the right client — you just hit send. Sent items are remembered and never
queued twice. The message templates are editable right on that page (or in
`assets/js/config.js → whatsapp.templates`).

> Why can't a plain website send WhatsApp messages by itself? WhatsApp only
> allows sending through the official **WhatsApp Business API**, which requires
> a server + registered business account. That's the upgrade below.

---

## Full-auto: the WhatsApp Business API

When you're ready, pick ONE provider. The server code is already written
(`server/whatsapp.js`) — you only add credentials.

### Option A — Meta WhatsApp Cloud API (recommended)

**Cost:** free tier ≈ 1,000 service conversations/month, then pay-per-conversation
(fractions of a cent for utility messages in Egypt).
**Effort:** ~1–2 hours + Meta business verification (can take a few days).

1. Go to [developers.facebook.com](https://developers.facebook.com) → create an
   app → type **Business**.
2. Add the **WhatsApp** product. Meta gives you a test number instantly —
   you can send real messages to up to 5 verified numbers the same day
   (perfect for demoing to the partners!).
3. To go live with the clinic's own number **+20 10 35411305**:
   - Verify the business in Business Manager (commercial register / utility bill).
   - Add and verify the phone number (it must NOT be simultaneously registered
     in the normal WhatsApp app — the clinic migrates it to the API or uses a
     second number).
4. Create a **permanent access token** (System User token with `whatsapp_business_messaging`).
5. On the server, set env vars and start:

   ```bash
   export WA_PROVIDER=meta
   export WA_META_TOKEN=EAAG...        # permanent token
   export WA_META_PHONE_ID=1234567890  # from the app dashboard
   node server/server.js
   ```

6. For the **CONFIRM replies**: in the Meta app dashboard set the webhook URL to
   `https://<your-server>/api/wa-webhook` with verify token `nexus-verify`
   (or set `WA_META_VERIFY_TOKEN`). When a client replies CONFIRM (or تمام/اكد),
   the booking is marked *client-confirmed* automatically.

**Note on templates:** messages sent >24 h after the client last wrote to you
must use Meta-approved **message templates** (they approve them in ~minutes to
hours). The confirmation + reminder texts in `server/whatsapp.js` are exactly
what you'd submit.

### Option B — Twilio WhatsApp

**Cost:** no free tier — ~$0.005 Twilio fee + Meta conversation fee per message.
**Effort:** ~30 min sandbox, days for the real number (Twilio handles Meta paperwork).

```bash
export WA_PROVIDER=twilio
export WA_TWILIO_SID=ACxxxxxxxx
export WA_TWILIO_AUTH=xxxxxxxx
export WA_TWILIO_FROM=whatsapp:+14155238886
node server/server.js
```

Twilio's **sandbox** works in minutes (clients must first send "join <code>" to
the sandbox number — fine for testing, not for production).

### What the server does once configured

Every minute (`server/whatsapp.js`):
- new booking with no confirmation on file → sends the confirmation;
- session 60 min away with no reminder on file → sends the reminder;
- logs every send in `server/data/wa-log.json` so nothing repeats;
- inbound "CONFIRM" replies mark the booking client-confirmed.

The dashboard's WhatsApp view stays useful as the log/override, and the
templates stay in one place.

---

# TimeTree — what's possible

**Live sync is not possible for anyone anymore:** TimeTree
[shut down their public API on 22 Dec 2023](https://timetreeapp.com/intl/en/newsroom/2023-12-14/connect-app-api-202312),
so no app can legally read a TimeTree calendar in real time.

**But the schedule can absolutely be moved over:**

1. **Import into the site (built ✅):** the community tool
   [timetree-exporter](https://github.com/eoleedi/TimeTree-Exporter)
   (`pip install timetree-exporter`, needs Python 3.10+) logs in with the
   clinic's TimeTree account and produces a standard `.ics` file. Then on
   **Dashboard → Calendar → ⇪ Import**, pick the file — every event lands on
   the calendar (greyed as "Imported", duplicates skipped automatically).
   The same Import button accepts exports from Google/Apple/Outlook calendars.

2. **Export from the site (built ✅):** **Dashboard → Export → Calendar file
   (.ics)** downloads the whole clinic schedule. Opening it on a phone adds it
   to Apple/Google Calendar — and TimeTree can display the phone's OS calendar
   alongside its own. So during the transition the team can keep peeking at
   TimeTree while the website becomes the source of truth.

The pitch to the partners: the dashboard **Calendar view now does what TimeTree
does** (shared month/week/day, colour per therapist) **plus** what TimeTree
can't: bookings appear on it by themselves, walk-ins added there count toward
loyalty and revenue, every session has the client's phone + WhatsApp one tap
away, and it exports to Excel.

---

# Where should customer data live?

Right now (GitHub Pages, static): bookings + accounts are stored **in each
visitor's own browser** (localStorage). Fine for demos — not a real database:
the owner can't see bookings made on other people's phones.

To make the data real, the site needs a small backend + database. Options, in
order of recommendation:

| Option | Where data lives | Cost | Why / why not |
|---|---|---|---|
| **Supabase** (recommended) | Managed Postgres, EU region (Frankfurt — closest to Egypt) | Free tier: 500 MB DB, plenty for years of bookings | Real database + built-in auth (can even do WhatsApp/phone OTP) + REST API out of the box. The site's `store.js` already talks to an API, so swapping localStorage → Supabase is a contained change. Daily backups on paid tier ($25/mo when they outgrow free). |
| **Firebase** (Google) | Google Cloud, `europe-west` | Free tier generous | Similar; Firestore is fine but auth+SQL exports are weaker for "give me Excel" requests, and Google can retire products. |
| **VPS in/near Egypt** (e.g. Hetzner Falkenstein, DigitalOcean AMS, or Egyptian hosts) | Your own server | ~$5–8/mo | Full control, runs `server/server.js` as-is + the WhatsApp loop. But YOU are responsible for backups, updates, security. Good later, not first. |
| Keep GitHub Pages only | Visitors' browsers | $0 | Only OK for the pitch/demo phase — data is not shared. |

**Recommendation:** Supabase free tier (Frankfurt) + keep GitHub Pages for the
site itself. That gives: one shared database for all bookings/accounts, the
owner sees everything live from any device, proper backups, and room to add
phone-OTP verification later. Egypt has no data-residency law blocking this
(the Personal Data Protection Law 151/2020 requires consent + security, not
in-country storage — a simple privacy line on the booking page covers consent).

The WhatsApp full-auto server can run as a free Supabase Edge Function /
scheduled job, or on the same small VPS if you go that route.
