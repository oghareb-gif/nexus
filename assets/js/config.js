/* ============================================================================
   NEXUS CLINIC — Central configuration
   Everything the site reads about the business lives here.
   Edit this one file to change phone numbers, prices, services, staff, etc.
   ========================================================================== */

window.NEXUS = {
  /* --- Business identity --- */
  brand: {
    name: "Nexus Clinic",
    legalName: "Nexus Physio Clinic",
    tagline: "Move Beyond",
    hashtag: "#MOVEBEYOND",
    city: "Heliopolis, Cairo",
    address: "31 El-Imam Ali, Almazah, Heliopolis, Cairo Governorate 11736",
    plusCode: "38WM+7G Heliopolis",
    mapsUrl: "https://www.google.com/maps/place/Nexus+Physio+Clinic/@30.095679,31.3337638,17z",
    hours: "Sat–Thu · 2:00 PM – 10:00 PM",
    email: "nexusphysioclinic.info@gmail.com",
    instagram: "https://www.instagram.com/nexus.physioclinic/",
    instagramHandle: "@nexus.physioclinic",
    facebook: "https://www.facebook.com/profile.php?id=61586709835472",
  },

  /* --- Phone / WhatsApp ---
     whatsapp must be full international format, digits only (no +, no spaces).
     +20 10 35411305  ->  201035411305                                        */
  contact: {
    whatsapp: "201035411305",
    phoneDisplay: "+20 10 35411305",
    altPhoneDisplay: "011 1126 4152",
  },

  /* --- Social proof --- */
  proof: {
    googleRating: 5.0,
    googleReviews: 95,
    instagramFollowers: "1,541",
    sessionsRun: 2400,      // shown as an animated counter (adjust to real figure)
    recoveryRate: 96,       // % — adjust to real figure
  },

  /* --- Services / treatments ---
     price in EGP. duration in minutes. icon = key used by the SVG icon set.  */
  services: [
    {
      id: "sports",
      name: "Sports Injury & Performance",
      icon: "bolt",
      duration: 60,
      price: 900,
      short: "Get athletes back to competition — faster and stronger.",
      desc: "Sport-specific assessment and return-to-play programming for tendinopathies, sprains, and performance limits. Trusted by national-team athletes.",
      rewardEligible: false,
    },
    {
      id: "rehab",
      name: "Pre & Post-Surgical Rehab",
      icon: "heart",
      duration: 60,
      price: 850,
      short: "Structured recovery before and after surgery.",
      desc: "Evidence-based rehabilitation protocols that protect the repair, restore range of motion, and rebuild strength on schedule.",
      rewardEligible: false,
    },
    {
      id: "manual",
      name: "Manual Therapy",
      icon: "hands",
      duration: 45,
      price: 700,
      short: "Hands-on treatment for pain and stiffness.",
      desc: "Joint mobilisation, soft-tissue release, and targeted techniques to unlock movement and calm pain fast.",
      rewardEligible: true,
    },
    {
      id: "cupping",
      name: "Cupping (Hijama)",
      icon: "cup",
      duration: 45,
      price: 600,
      short: "Traditional cupping for recovery and circulation.",
      desc: "Dry and wet cupping delivered in a clean, clinical setting to support recovery, circulation, and muscle tension.",
      rewardEligible: true,
    },
    {
      id: "recovery",
      name: "Recovery & Everyday Pain",
      icon: "spark",
      duration: 45,
      price: 650,
      short: "For back, neck, and the aches of daily life.",
      desc: "Movement-first treatment for everyday pain — desk posture, low-back pain, stiff necks — so you can get back to living.",
      rewardEligible: true,
    },
    {
      id: "assessment",
      name: "Full Assessment",
      icon: "clipboard",
      duration: 60,
      price: 500,
      short: "A clear diagnosis and a plan you understand.",
      desc: "A thorough first visit: history, testing, diagnosis, and a step-by-step plan explained in plain language.",
      rewardEligible: false,
    },
  ],

  /* --- Team ---
     `photo` points to a LOCAL file — drop the real headshot (from the clinic's
     Instagram/Facebook) into assets/img/team/ with that exact filename and it
     appears automatically. Until the file exists, `fallback` (stock) shows.  */
  team: [
    {
      id: "salma",
      name: "Dr. Salma",
      role: "Rehabilitation Specialist",
      bio: "Known for being clever, honest, and explaining every detail. Leads Nexus's rehab philosophy.",
      photo: "assets/img/team/salma.jpg",
      fallback: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400&q=80",
      tags: ["Post-surgical", "Manual therapy"],
    },
    {
      id: "badran",
      name: "Dr. Ahmed Badran",
      role: "Sports Injury Specialist",
      bio: "Outstanding, professional, and knowledgeable — trusted by athletes across Cairo.",
      photo: "assets/img/team/badran.jpg",
      fallback: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&q=80",
      tags: ["Sports rehab", "Performance"],
    },
    {
      id: "eyad",
      name: "Dr. Eyad",
      role: "Physiotherapist",
      bio: "Helpful, attentive, and patient-first care through every stage of recovery.",
      photo: "assets/img/team/eyad.jpg",
      fallback: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&q=80",
      tags: ["Recovery", "Everyday pain"],
    },
  ],

  /* --- Real reviews (from Google, 5.0 · 95 reviews) --- */
  reviews: [
    {
      name: "Hassan Reda",
      source: "Google",
      stars: 5,
      text: "I am very grateful to Dr. Badran and his staff. Dr. Badran is outstanding and his team is very professional, friendly and knowledgeable. I cannot recommend them more highly!",
    },
    {
      name: "Hagar Ashraf",
      source: "Google",
      stars: 5,
      text: "Very good clinic. Dr Salma is extremely clever, nice, honest, and explains everything in detail.",
    },
    {
      name: "Mustafa Ahmed",
      source: "Google · Local Guide",
      stars: 5,
      text: "All the staff are friendly and professional. Great & clean clinic. I had shoulder pain and took 12 sessions with Dr Badran — he treated me well and was supportive. The reception team was smiley and friendly too.",
    },
    {
      name: "Aly Yasser",
      source: "Google",
      stars: 5,
      text: "Best clinic out there, highly recommended with an amazing friendly staff — especially the lovely receptionist Ms. Noura 🌹",
    },
    {
      name: "Hussien Elrawy",
      source: "Google",
      stars: 5,
      text: "Good clinic with helpful staff. Thank you Dr Eyad.",
    },
  ],

  /* Chips surfaced on Google as common review themes */
  reviewThemes: ["clean clinic", "professional doctors", "clever doctor", "dr salma"],

  /* --- Athlete showcase ---
     Mariam is the featured story (real, from the clinic's own post). The rest
     form a "trusted by" grid. `photo` points to a LOCAL file — save the real
     photo (from the clinic's Instagram) into assets/img/athletes/ with that
     exact filename and it appears automatically; until then `fallback` shows. */
  athletes: [
    {
      name: "Mariam Metwally",
      sport: "Volleyball",
      title: "Egyptian National Team · UYBA Volley (Italy)",
      story: "Came to Nexus after a challenging season complicated by Achilles tendinopathy and a knee injury. Today she's back on court — pain-free, stronger, and ready for what's next.",
      photo: "assets/img/athletes/mariam.jpg",
      fallback: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=900&q=80",
      tag: "Back on court",
      featured: true,
    },
    {
      name: "Seif Hesham",
      sport: "Water Polo",
      title: "National Championship winner",
      photo: "assets/img/athletes/seif.jpg",
      fallback: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=700&q=80",
      tag: "Champion",
    },
    {
      name: "Nada Walid",
      sport: "Volleyball",
      title: "Al Ahly SC · Egyptian National Team",
      photo: "assets/img/athletes/nada.jpg",
      fallback: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=700&q=80",
      tag: "Back on court",
    },
    {
      name: "Nexus Athletes",
      sport: "Multi-sport",
      title: "Footballers, swimmers & lifters",
      photo: "assets/img/athletes/group.jpg",
      fallback: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=700&q=80",
      tag: "#MOVEBEYOND",
    },
  ],

  /* --- Instagram content strip ---
     Cards link to the real profile. When you have specific reel/post URLs,
     drop them into `href` for direct links (or I can embed them properly).     */
  instagram: {
    handle: "@nexus.physioclinic",
    url: "https://www.instagram.com/nexus.physioclinic/",
    followers: "1,541",
    // Real Instagram reels/posts — add the shortcode from the URL:
    // instagram.com/reel/DaVC_-FuMFC/  ->  "DaVC_-FuMFC"
    // (Only the first 3 are shown — one clean row.)
    reels: ["DaVC_-FuMFC", "DXoy6VMCFL4", "DUQyPrdiMwa"],
    posts: [
      { label: "Evidence in Motion — Ep. 1", accent: "#c6ff3c", img: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=500&q=80" },
      { label: "#NexusAthletes — Mariam", accent: "#ff5c57", img: "https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?w=500&q=80" },
      { label: "Focused Care, Real Expertise", accent: "#c6ff3c", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500&q=80" },
      { label: "Recovery & Rehab in action", accent: "#ffd166", img: "https://images.unsplash.com/photo-1584982751601-97dcc096659c?w=500&q=80" },
    ],
  },

  /* --- Loyalty program ---
     Every `threshold` completed visits earns one free reward-eligible session. */
  loyalty: {
    enabled: true,
    threshold: 10,           // visits needed to earn a reward
    rewardLabel: "recovery or massage session",
    rewardValue: 600,        // EGP value, used in dashboard savings tally
  },

  /* --- Booking availability --- */
  booking: {
    openHour: 14,            // 2 PM
    closeHour: 22,           // 10 PM
    slotMinutes: 45,
    daysAheadBookable: 30,
    closedWeekdays: [5],     // 0=Sun ... 5=Fri (clinic closed Friday)
    currency: "EGP",
  },

  /* --- Customer accounts ---
     Sign-in is required to book. Each customer gets their own page with their
     bookings + loyalty. maxActiveReservations caps how many upcoming (not yet
     completed / cancelled) bookings a single account may hold at once — this
     stops the same person spamming the calendar. */
  account: {
    enabled: true,
    maxActiveReservations: 2,
  },

  /* --- Payments ---
     Shown as simple chips in the Visit section. Edit to match reality. */
  payment: {
    methods: ["Cash", "Visa", "InstaPay", "Vodafone Cash"],
  },

  /* --- Owner dashboard access ---
     The dashboard asks for this password before opening. NOTE: this is a
     front-end gate only (keeps casual visitors out) — real security needs
     the backend. Change it any time. */
  owner: {
    password: "12345",
  },

  /* --- Location / map ---
     coords power the embedded map (no API key needed). Pull them from your
     Google Maps link: .../@30.095679,31.3337638,17z  ->  lat, lng below. */
  location: {
    lat: 30.095679,
    lng: 31.3337638,
    parking: "Street parking available on El-Imam Ali; we're a short walk from Almaza.",
  },

  /* --- FAQ ---
     Real questions patients ask the clinic — grounded in the services,
     hours, team and booking flow. Edit freely. */
  faqs: [
    {
      q: "Do I need a doctor's referral to book?",
      a: "No. You can book directly with us. If you have recent scans, X-rays, or a doctor's report, bring them along — they help us tailor your plan, but they're not required.",
    },
    {
      q: "What happens in my first session?",
      a: "Your first visit is a full assessment (about 60 minutes): your history, hands-on testing, a clear diagnosis, and a step-by-step recovery plan explained in plain language — so you leave knowing exactly what's wrong and what we'll do about it.",
    },
    {
      q: "Do you only treat athletes?",
      a: "Not at all. Alongside our sports work we treat everyday back and neck pain, post-surgery recovery, desk-posture problems and more — most of our patients aren't professional athletes.",
    },
    {
      q: "How many sessions will I need?",
      a: "It depends on your condition — we'll give you an honest estimate after your first assessment. Many people feel real improvement within the first few visits.",
    },
    {
      q: "Can I choose my therapist?",
      a: "Yes. When you book online you can pick Dr. Salma, Dr. Ahmed Badran or Dr. Eyad directly — or choose \"first available\" and we'll match you with the right specialist for your case.",
    },
    {
      q: "What should I wear?",
      a: "Comfortable clothing you can move in — like you'd wear to the gym. For some assessments we may need access to the area being treated, and we always make sure you're comfortable.",
    },
    {
      q: "How do I pay?",
      a: "Cash, Visa, InstaPay or Vodafone Cash — payment is per session at the clinic, no packages required. Ask us about multi-session plans if you'd like one.",
    },
    {
      q: "When are you open?",
      a: "Saturday to Thursday, 2:00 PM to 10:00 PM — we're closed on Fridays. You can book online any time, day or night, and we'll confirm on WhatsApp.",
    },
  ],
};
