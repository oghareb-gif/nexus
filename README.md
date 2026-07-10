# Nexus Clinic — Website

A complete website for **Nexus Physio Clinic** (Heliopolis, Cairo): a marketing
site, an online booking flow that hands off to WhatsApp, a loyalty program, and
an owner dashboard.

Built to work **immediately** with no setup — and to scale up to a shared
server when you want it.

---

## 📁 What's inside

| File | What it is |
|------|------------|
| `index.html` | The main website (hero, treatments, athletes, reviews, team) |
| `book.html` | The booking page — 4 steps, ends in a WhatsApp confirmation |
| `dashboard.html` | The **owner dashboard** — who's coming, clients, loyalty |
| `assets/js/config.js` | **⭐ Edit this** to change phone numbers, prices, services, staff |
| `assets/css/nexus.css` | All the styling |
| `server/` | Optional backend for shared data across devices (see below) |

---

## ▶️ How to use it (the easy way)

Just **double-click `index.html`** — it opens in your browser and everything
works: browsing, booking, the dashboard, and the loyalty program.

- Bookings are saved in that browser and appear in `dashboard.html`.
- Confirming a booking opens **WhatsApp** with the details pre-filled, addressed
  to the clinic's real number.

> In this "easy mode", data lives in **one browser**. Great for testing and for
> a single reception computer. For bookings from customers' own phones to reach
> your dashboard, use the server below.

---

## 🌐 Putting it online

To let real customers book from their phones and have it all land in one shared
dashboard, run the included server (needs **Node.js** — free, from nodejs.org):

```bash
cd nexus/server
node server.js
```

Then open **http://localhost:3000**. Bookings now save on the computer running
the server (`server/data/bookings.json`) and show up in the dashboard from any
device. No database, no `npm install` needed.

To publish it on the internet, host this folder on any static/Node host
(Vercel, Netlify, Render, a VPS, etc.). Ask and I can walk you through it.

---

## ✏️ Common edits (in `assets/js/config.js`)

- **WhatsApp number** → `contact.whatsapp` (format: `201035411305`, digits only)
- **Prices / services** → the `services` list
- **Therapists** → the `team` list (swap in real photos)
- **Loyalty rule** → `loyalty.threshold` (currently every **10th** visit earns a
  free recovery/massage session)
- **Reviews / ratings** → `reviews` and `proof`

After editing, refresh the page — no build step.

---

## 🎁 How the loyalty program works

- Every visit is counted per phone number.
- After **10 completed visits**, the client's **next** reward-eligible session
  (recovery or massage) is **free** — it's detected automatically at booking and
  flagged in the dashboard.
- Change the "10" in `config.js → loyalty.threshold`.

---

## 📸 Swapping in real photos

The site currently uses stock images. Replace the image URLs in:
`config.js` (team + athletes) and `index.html` (hero + gym photos)
with your own Instagram photos for a fully real site.

---

*Real clinic details (address, phones, 5.0★ Google rating, team, athlete stories)
are already filled in from your Instagram, Facebook and Google listings.*
