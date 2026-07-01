import { normalizeLanguage } from "../i18n.js";

const PUBLIC_PAGE_CONTENT = Object.freeze({
  en: {
    companyDetails: Object.freeze([
      "Last updated: 29 May 2026",
      "Operator: Vervus Interactive",
      "Trading name: Vervus",
      "Chamber of Commerce: 42031691",
      "VAT number: NL005444162B31",
      "Website: vervus.live",
      "General inquiries: info@vervus.live",
      "Support: support@vervus.live"
    ]),
    faqItems: Object.freeze([
      {
        question: "What is Vervus?",
        paragraphs: [
          "Vervus is a phone-first social multiplayer platform built for instant access and real-time play.",
          "One player hosts. Everyone else joins instantly."
        ],
        bullets: ["No downloads.", "No setup.", "Just play."]
      },
      {
        question: "Do I need to download an app?",
        paragraphs: [
          "No.",
          "Vervus runs directly in your browser on mobile devices. Just open a link and join instantly."
        ]
      },
      {
        question: "Do I need an account?",
        paragraphs: [
          "No.",
          "Just join and play. Sessions are designed to work instantly without requiring account creation."
        ]
      },
      {
        question: "How does it work?",
        paragraphs: ["Built for real-time social play."],
        steps: ["Start a room.", "Friends join instantly.", "Try a free preview", "Keep playing."]
      },
      {
        question: "How much does Vervus cost?",
        paragraphs: [
          "One player pays. Everyone joins.",
          "EUR 3.99 - 1 experience",
          "Unlock 1 experience and all included modes for 24 hours.",
          "EUR 5.99 - 2 experiences",
          "Unlock 2 experiences and all included modes for 24 hours.",
          "EUR 6.99 - All experiences",
          "Unlock all experiences and modes for 24 hours.",
          "Current experiences include:"
        ],
        bullets: [
          "GLiTCH! - reaction pressure and escalating chaos",
          "Ghost - suspense, timing and rising tension",
          "Curse - ritual panic, blame and social chaos"
        ],
        outro: "3 modes per experience. 9 ways to play."
      },
      {
        question: "Do all players need to pay?",
        paragraphs: [
          "No.",
          "Only the host purchases access for the room/session. Friends can join the active room without needing separate purchases."
        ]
      },
      {
        question: "Is Vervus a subscription?",
        paragraphs: [
          "No.",
          "Vervus uses temporary access unlocks."
        ]
      },
      {
        question: "What devices are supported?",
        paragraphs: ["Vervus is designed for smartphones and mobile browsers, including iPhone and Android devices."]
      },
      {
        question: "How many players do I need?",
        paragraphs: ["Vervus works best with 2-4 players, depending on the game and mode."]
      },
      {
        question: "Can I play with people remotely?",
        paragraphs: [
          "Yes.",
          "While Vervus is primarily designed around people playing together in the same room, players can also join remotely through platforms like Discord or other voice chat services."
        ]
      },
      {
        question: "What if someone disconnects?",
        paragraphs: ["Vervus includes reconnect and session recovery systems where possible, depending on the game and mode."]
      },
      {
        question: "What makes Vervus different?",
        paragraphs: ["Vervus is designed around:"],
        bullets: ["pressure", "hesitation", "timing", "social tension", "fast decisions", "group chaos"],
        outroParagraphs: [
          "Some games are competitive.",
          "Some are cooperative.",
          "Some are both at the same time.",
          "Blaming your friends is part of the experience."
        ]
      },
      {
        question: "Can I stream or record Vervus?",
        paragraphs: [
          "Yes, personal and non-commercial sharing is allowed.",
          "You can:"
        ],
        bullets: ["stream gameplay", "record clips", "share screenshots", "post reactions/content online"]
      },
      {
        question: "Does Vervus change over time?",
        paragraphs: [
          "Yes. Vervus is a live platform. Experiences, modes, balancing, timers, visuals, features and pricing may change over time as the platform develops.",
          "New experiences will be added regularly as Vervus expands."
        ]
      },
      {
        question: "Is Vervus safe for children?",
        paragraphs: ["Yes, but purchases should only be made by adults or with permission from a parent or guardian."]
      },
      {
        question: "How do refunds work?",
        paragraphs: [
          "Because Vervus delivers digital access immediately after activation, refunds are generally not available once access has been used.",
          "However, we may review refund requests in cases such as:"
        ],
        bullets: ["duplicate payments", "failed purchases", "major technical issues"],
        outro: "For help, contact support."
      },
      {
        question: "How do I contact Vervus?",
        paragraphs: [
          "General inquiries: info@vervus.live",
          "Support: support@vervus.live",
          "Or use our contact form."
        ]
      }
    ]),
    termsSections: Object.freeze([
      {
        title: "1. About Vervus",
        blocks: [
          { type: "p", text: "Vervus is a browser-based social multiplayer platform that allows users to create and join real-time game sessions on supported devices." },
          { type: "p", text: "Vervus includes platform systems such as:" },
          { type: "list", items: ["rooms", "lobbies", "session management", "reconnect systems", "entitlement systems", "payment flows", "multiplayer infrastructure"] },
          { type: "p", text: "Vervus may also include games, modes, events, experiences and future interactive content such as:" },
          { type: "list", items: ["GLiTCH!", "Ghost", "Curse", "future experiences or modes"] },
          { type: "p", text: "Vervus is provided for entertainment purposes only." }
        ]
      },
      {
        title: "2. Acceptance of These Terms",
        blocks: [
          { type: "p", text: "By accessing or using Vervus, you agree to these Terms." },
          { type: "p", text: "If you do not agree, you may not use Vervus." }
        ]
      },
      {
        title: "3. Eligibility",
        blocks: [
          { type: "p", text: "You must be at least 13 years old to use Vervus." },
          { type: "p", text: "Purchases may only be made by:" },
          { type: "list", items: ["adults, or", "minors with permission from a parent or legal guardian."] },
          { type: "p", text: "We may restrict or terminate access if we reasonably believe these requirements are not met." }
        ]
      },
      {
        title: "4. Accounts and Session Data",
        blocks: [
          { type: "p", text: "Vervus may operate without permanent user accounts." },
          { type: "p", text: "To operate the platform, we may temporarily process or store:" },
          { type: "list", items: ["display names", "room identifiers", "session identifiers", "entitlement/payment states", "gameplay events", "reconnect states", "technical/browser/device information"] },
          { type: "p", text: "Users are responsible for the names or identifiers they choose." }
        ]
      },
      {
        title: "5. Access and Technical Requirements",
        blocks: [
          { type: "p", text: "Vervus requires:" },
          { type: "list", items: ["a supported browser", "a compatible device", "internet access"] },
          { type: "p", text: "We do not guarantee uninterrupted availability, latency-free gameplay, or compatibility with all devices or browsers." },
          { type: "p", text: "Performance may be affected by:" },
          { type: "list", items: ["internet quality", "browser limitations", "device performance", "server load", "battery-saving settings", "third-party services", "technical failures"] }
        ]
      },
      {
        title: "6. Rooms and Sessions",
        blocks: [
          { type: "p", text: "A Host may create a room or multiplayer session." },
          { type: "p", text: "Players may join through:" },
          { type: "list", items: ["QR codes", "join codes", "invitation links", "other supported methods"] },
          { type: "p", text: "Rooms and sessions are temporary and may expire, reset, disconnect or terminate automatically." },
          { type: "p", text: "We may suspend, reset or terminate sessions in cases involving:" },
          { type: "list", items: ["technical problems", "fraud", "abuse", "cheating", "security risks", "violations of these Terms"] }
        ]
      },
      {
        title: "7. Purchases and Digital Access",
        blocks: [
          { type: "p", text: "Vervus may offer paid digital access such as:" },
          { type: "list", items: ["temporary unlocks", "party packs", "game access", "experiences", "premium features", "timed access periods"] },
          { type: "p", text: "Prices are shown before purchase and may include VAT where required by law." },
          { type: "p", text: "Payments are processed through third-party payment providers such as Stripe." },
          { type: "p", text: "Purchases grant only the specifically described digital access for the stated duration." },
          { type: "p", text: "Purchases do not transfer ownership of:" },
          { type: "list", items: ["software", "games", "content", "assets", "intellectual property", "accounts", "platform systems"] }
        ]
      },
      {
        title: "8. Digital Delivery and Withdrawal Rights",
        blocks: [
          { type: "p", text: "Vervus provides digital services and digital content." },
          { type: "p", text: "EU consumers normally have a statutory 14-day withdrawal right for online purchases. However, under EU consumer law, this right may be lost for digital content or digital services once performance begins after the consumer has given prior express consent and acknowledged the loss of the withdrawal right." },
          { type: "p", text: "During checkout, users may therefore be required to:" },
          { type: "list", items: ["expressly consent to immediate digital delivery; and", "acknowledge that they lose their withdrawal right once access is activated."] },
          { type: "p", text: "Once digital access has been activated or substantially used, refunds are generally not available unless required by law." }
        ]
      },
      {
        title: "9. Refunds",
        blocks: [
          { type: "p", text: "Refunds are generally not provided after digital access has been activated or used." },
          { type: "p", text: "We may issue refunds at our reasonable discretion in cases such as:" },
          { type: "list", items: ["duplicate payments", "failed delivery of purchased access", "major technical failures caused by Vervus", "legal obligations"] },
          { type: "p", text: "Refunds are generally not provided for:" },
          { type: "list", items: ["connection problems", "incompatible devices", "browser issues", "players leaving sessions", "dissatisfaction with gameplay", "missed sessions", "user error"] }
        ]
      },
      {
        title: "10. User Conduct",
        blocks: [
          { type: "p", text: "Users may not:" },
          { type: "list", items: ["harass or threaten others", "use hateful, abusive or discriminatory content", "impersonate others", "spam or disrupt sessions", "cheat or exploit gameplay", "reverse engineer or tamper with the platform", "use bots, scripts or automation", "bypass payments or restrictions", "distribute malware or harmful code", "violate applicable laws"] },
          { type: "p", text: "We may restrict, suspend or terminate access at any time where reasonably necessary to protect:" },
          { type: "list", items: ["users", "sessions", "the platform", "platform integrity", "security", "legal compliance"] }
        ]
      },
      {
        title: "11. Fair Play and Anti-Cheat",
        blocks: [
          { type: "p", text: "Vervus may use server-authoritative systems, anti-cheat systems and automated fraud detection." },
          { type: "p", text: "Users may not manipulate:" },
          { type: "list", items: ["gameplay", "timers", "scores", "inputs", "payment states", "session states", "entitlement systems"] },
          { type: "p", text: "We may invalidate scores, sessions or access where abuse or irregularities are detected." }
        ]
      },
      {
        title: "12. Updates and Changes",
        blocks: [
          { type: "p", text: "Vervus is an evolving live platform. Some features, systems or experiences may be experimental, modified or discontinued over time." },
          { type: "p", text: "We may modify, rebalance, remove or add:" },
          { type: "list", items: ["games", "modes", "timers", "pricing", "visuals", "systems", "rewards", "access models", "platform functionality"] },
          { type: "p", text: "We may also perform maintenance that temporarily interrupts access." }
        ]
      },
      {
        title: "13. User Content and Social Sharing",
        blocks: [
          { type: "p", text: "Users remain responsible for content they submit or share within Vervus, including:" },
          { type: "list", items: ["display names", "text", "messages", "shared media"] },
          { type: "p", text: "Users may create and share screenshots, clips and gameplay footage for personal and non-commercial social sharing, provided they comply with applicable laws and the rights of others." },
          { type: "p", text: "By submitting content within Vervus, users grant Vervus a limited, non-exclusive, worldwide license to host, display and process that content solely for operation of the platform and sessions." }
        ]
      },
      {
        title: "14. Intellectual Property",
        blocks: [
          { type: "p", text: "All rights relating to Vervus remain the property of Vervus Interactive or its licensors, including:" },
          { type: "list", items: ["software", "code", "branding", "logos", "UI", "visuals", "games", "audio", "designs", "gameplay systems", "databases", "trademarks"] },
          { type: "p", text: "Users receive a limited, non-exclusive, non-transferable right to access and use Vervus in accordance with these Terms." }
        ]
      },
      {
        title: "15. Privacy",
        blocks: [
          { type: "p", text: "Personal data is processed in accordance with the Vervus Privacy Policy." },
          { type: "p", text: "This may include:" },
          { type: "list", items: ["IP address", "browser/device information", "gameplay events", "session identifiers", "payment status", "analytics", "technical logs", "security logs", "support communications"] },
          { type: "p", text: "Vervus generally does not store full payment card information." }
        ]
      },
      {
        title: "16. Availability Disclaimer",
        blocks: [
          { type: "p", text: "Vervus is provided on an \"as is\" and \"as available\" basis to the fullest extent permitted by law." },
          { type: "p", text: "We do not guarantee:" },
          { type: "list", items: ["uninterrupted availability", "error-free operation", "continuous uptime", "perfect synchronization", "permanent access"] },
          { type: "p", text: "Access to Vervus may occasionally be temporarily limited or suspended for maintenance, security or technical reasons." }
        ]
      },
      {
        title: "17. Limitation of Liability",
        blocks: [
          { type: "p", text: "To the fullest extent permitted by law, Vervus is not liable for:" },
          { type: "list", items: ["indirect damages", "lost profits", "lost data", "interrupted gameplay", "failed sessions", "third-party outages", "internet failures", "device incompatibilities", "payment provider failures"] },
          { type: "p", text: "Nothing in these Terms limits liability where such limitation is prohibited by applicable law." },
          { type: "p", text: "Where legally permitted, total liability is limited to the amount paid by the user to Vervus during the three months preceding the relevant claim, up to a maximum of EUR 250." }
        ]
      },
      {
        title: "18. Suspension and Termination",
        blocks: [
          { type: "p", text: "We may suspend or terminate access where reasonably necessary due to:" },
          { type: "list", items: ["abuse", "cheating", "fraud", "security concerns", "payment issues", "violations of these Terms", "harmful behavior toward users or the platform"] }
        ]
      },
      {
        title: "19. Governing Law",
        blocks: [
          { type: "p", text: "These Terms are governed by Dutch law." },
          { type: "p", text: "Consumers within the EU retain mandatory consumer protections applicable in their country of residence." },
          { type: "p", text: "Disputes shall be submitted to the competent courts of the Netherlands unless mandatory law requires otherwise." }
        ]
      },
      {
        title: "20. Contact",
        blocks: [
          { type: "p", text: "General inquiries: info@vervus.live" },
          { type: "p", text: "Support: support@vervus.live" },
          { type: "p", text: "Or use our contact form." }
        ]
      }
    ]),
    privacySections: Object.freeze([
      {
        title: "1. Introduction",
        blocks: [
          { type: "p", text: "This Privacy Policy explains how Vervus collects, uses, stores and protects personal data when users access or use the Vervus platform." },
          { type: "p", text: "Vervus is a browser-based social multiplayer platform that enables real-time multiplayer sessions, rooms, games and interactive social experiences." },
          { type: "p", text: "By using Vervus, you acknowledge this Privacy Policy." }
        ]
      },
      {
        title: "2. Data We Collect",
        blocks: [
          { type: "p", text: "Depending on how Vervus is used, we may process:" },
          { type: "label", text: "Technical and device information" },
          { type: "list", items: ["IP address", "browser type/version", "operating system", "device type", "language settings", "session identifiers", "connection status", "crash/error logs"] },
          { type: "label", text: "Gameplay and platform data" },
          { type: "list", items: ["display names", "room/session identifiers", "gameplay events", "reconnect states", "entitlement states", "timestamps", "matchmaking/session activity", "anti-cheat/security events"] },
          { type: "label", text: "Payment-related data" },
          { type: "p", text: "Payments are processed by third-party payment providers such as Stripe." },
          { type: "p", text: "We may receive limited payment-related information such as:" },
          { type: "list", items: ["payment status", "transaction identifiers", "country/region", "entitlement confirmation"] },
          { type: "p", text: "Vervus generally does not store full payment card information." },
          { type: "label", text: "Analytics and usage data" },
          { type: "p", text: "We may collect analytics data relating to:" },
          { type: "list", items: ["platform usage", "gameplay behavior", "session duration", "interaction flows", "technical performance", "crashes/errors", "feature usage"] },
          { type: "p", text: "Where reasonably possible, analytics data may be aggregated, pseudonymized or processed in a privacy-friendly manner." }
        ]
      },
      {
        title: "3. How We Use Data",
        blocks: [
          { type: "p", text: "We use personal data to:" },
          { type: "list", items: ["operate multiplayer sessions", "maintain platform functionality", "process purchases", "deliver digital access", "restore sessions/reconnect states", "improve gameplay and balancing", "prevent fraud and abuse", "maintain security", "provide customer support", "analyze platform performance", "comply with legal obligations"] }
        ]
      },
      {
        title: "4. Legal Bases",
        blocks: [
          { type: "p", text: "Depending on the situation, we process data based on:" },
          { type: "list", items: ["performance of a contract", "legitimate interests", "legal obligations", "user consent where required"] },
          { type: "label", text: "Legitimate interests may include:" },
          { type: "list", items: ["fraud prevention", "platform security", "analytics", "service improvement", "abuse prevention", "technical stability"] }
        ]
      },
      {
        title: "5. Cookies and Local Storage",
        blocks: [
          { type: "p", text: "Vervus may use:" },
          { type: "list", items: ["cookies", "local storage", "session storage", "similar technologies"] },
          { type: "p", text: "These may be used for:" },
          { type: "list", items: ["session persistence", "reconnect systems", "authentication states", "gameplay continuity", "analytics", "preferences", "security"] },
          { type: "p", text: "Some cookies or storage technologies may be essential for multiplayer functionality, reconnect systems and session continuity. Where legally required, we request consent before using non-essential cookies or tracking technologies." }
        ]
      },
      {
        title: "6. Third-Party Services",
        blocks: [
          { type: "p", text: "Vervus may use third-party providers including:" },
          { type: "list", items: ["payment processors", "hosting providers", "analytics providers", "cloud infrastructure", "monitoring/security tools", "customer support systems"] },
          { type: "p", text: "Examples may include:" },
          { type: "list", items: ["Stripe", "Cloudflare", "PostHog"] },
          { type: "p", text: "These providers may process data on our behalf under their own privacy policies and agreements." }
        ]
      },
      {
        title: "7. Anti-Cheat, Security and Moderation",
        blocks: [
          { type: "p", text: "To protect platform integrity, Vervus may monitor:" },
          { type: "list", items: ["suspicious gameplay behavior", "exploit attempts", "botting/automation", "session manipulation", "abuse reports", "security events"] },
          { type: "p", text: "We may store technical logs necessary for:" },
          { type: "list", items: ["fraud prevention", "moderation", "abuse handling", "legal compliance", "platform security"] }
        ]
      },
      {
        title: "8. Data Retention",
        blocks: [
          { type: "p", text: "We retain data only as long as reasonably necessary for:" },
          { type: "list", items: ["platform operation", "legal obligations", "dispute resolution", "security", "analytics", "fraud prevention"] },
          { type: "p", text: "Temporary session data may be deleted automatically after sessions expire." },
          { type: "p", text: "Some technical, payment or security-related logs may be retained longer where reasonably necessary." }
        ]
      },
      {
        title: "9. International Transfers",
        blocks: [
          { type: "p", text: "Vervus and its service providers may process data in countries outside the user's country of residence." },
          { type: "p", text: "Where required, we use appropriate safeguards for international data transfers." }
        ]
      },
      {
        title: "10. Your Rights",
        blocks: [
          { type: "p", text: "Depending on applicable law, users may have rights including:" },
          { type: "list", items: ["access", "correction", "deletion", "restriction", "objection", "portability", "withdrawal of consent"] },
          { type: "p", text: "Requests may be submitted to:" },
          { type: "label", text: "support@vervus.live" },
          { type: "p", text: "We may require verification before responding to certain requests." }
        ]
      },
      {
        title: "11. Children",
        blocks: [
          { type: "p", text: "Vervus is not intended for children below the minimum age required under applicable law." },
          { type: "p", text: "If we become aware that personal data has been collected unlawfully from minors, we may delete that data." },
          { type: "p", text: "Parents or guardians may contact us regarding concerns about minors using Vervus." }
        ]
      },
      {
        title: "12. Security",
        blocks: [
          { type: "p", text: "We use reasonable technical and organizational measures to protect personal data." },
          { type: "p", text: "However, no online service can guarantee absolute security." },
          { type: "p", text: "Users are responsible for maintaining the security of their own devices, browsers and internet connections." }
        ]
      },
      {
        title: "13. Changes to This Policy",
        blocks: [
          { type: "p", text: "We may update this Privacy Policy from time to time." },
          { type: "p", text: "Updated versions may be posted on the Vervus website or platform." },
          { type: "p", text: "Where required by law, we may notify users of material changes to this Privacy Policy." }
        ]
      },
      {
        title: "14. Contact",
        blocks: [
          { type: "p", text: "General inquiries: info@vervus.live" },
          { type: "p", text: "Privacy: support@vervus.live" },
          { type: "p", text: "Or use our contact form." }
        ]
      }
    ])
  },
  af: {
    companyDetails: Object.freeze([
      "Laas opgedateer: 29 Mei 2026",
      "Operateur: Vervus Interactive",
      "Handelsnaam: Vervus",
      "Kamer van Koophandel: 42031691",
      "BTW-nommer: NL005444162B31",
      "Webwerf: vervus.live",
      "Algemene navrae: info@vervus.live",
      "Ondersteuning: support@vervus.live"
    ]),
    faqItems: Object.freeze([
      {
        question: "Wat is Vervus?",
        paragraphs: [
          "Vervus is 'n selfoon-eerste sosiale multispelerplatform wat vir onmiddellike toegang en regstreekse spel ontwerp is.",
          "Een speler skep die kamer. Almal anders sluit onmiddellik aan."
        ],
        bullets: ["Geen aflaaie nie.", "Geen opstelling nie.", "Speel net."]
      },
      {
        question: "Moet ek 'n app aflaai?",
        paragraphs: [
          "Nee.",
          "Vervus werk direk in jou selfoonblaaier. Maak net 'n skakel oop en sluit onmiddellik aan."
        ]
      },
      {
        question: "Het ek 'n rekening nodig?",
        paragraphs: [
          "Nee.",
          "Sluit net aan en speel. Sessies is ontwerp om onmiddellik te werk sonder rekeningregistrasie."
        ]
      },
      {
        question: "Hoe werk dit?",
        paragraphs: ["Gebou vir regstreekse sosiale spel."],
        steps: ["Begin 'n kamer.", "Vriende sluit onmiddellik aan.", "Probeer 'n gratis voorskou", "Hou aan speel."]
      },
      {
        question: "Hoeveel kos Vervus?",
        paragraphs: [
          "Een speler betaal. Almal sluit aan.",
          "EUR 3.99 - 1 ervaring",
          "Ontsluit 1 ervaring en al die ingeslote modusse vir 24 uur.",
          "EUR 5.99 - 2 ervarings",
          "Ontsluit 2 ervarings en al die ingeslote modusse vir 24 uur.",
          "EUR 6.99 - Alle ervarings",
          "Ontsluit alle ervarings en modusse vir 24 uur.",
          "Huidige ervarings sluit in:"
        ],
        bullets: [
          "GLiTCH! - reaksiedruk en toenemende chaos",
          "Ghost - spanning, tydsberekening en stygende druk",
          "Curse - rituele paniek, blaam en sosiale chaos"
        ],
        outro: "3 modusse per ervaring. 9 maniere om te speel."
      },
      {
        question: "Moet alle spelers betaal?",
        paragraphs: [
          "Nee.",
          "Slegs die gasheer koop toegang vir die kamer of sessie. Vriende kan by die aktiewe kamer aansluit sonder afsonderlike aankope."
        ]
      },
      {
        question: "Is Vervus 'n intekening?",
        paragraphs: [
          "Nee.",
          "Vervus gebruik tydelike toegang-ontsluitings."
        ]
      },
      {
        question: "Watter toestelle word ondersteun?",
        paragraphs: ["Vervus is ontwerp vir slimfone en mobiele blaaiers, insluitend iPhone- en Android-toestelle."]
      },
      {
        question: "Hoeveel spelers het ek nodig?",
        paragraphs: ["Vervus werk die beste met 2-4 spelers, afhangend van die spel en modus."]
      },
      {
        question: "Kan ek met mense op afstand speel?",
        paragraphs: [
          "Ja.",
          "Hoewel Vervus hoofsaaklik ontwerp is vir mense wat saam in dieselfde kamer speel, kan spelers ook op afstand aansluit deur platforms soos Discord of ander stemkletsdienste."
        ]
      },
      {
        question: "Wat as iemand ontkoppel?",
        paragraphs: ["Vervus bevat waar moontlik herverbindings- en sessieherstelstelsels, afhangend van die spel en modus."]
      },
      {
        question: "Wat maak Vervus anders?",
        paragraphs: ["Vervus is ontwerp rondom:"],
        bullets: ["druk", "huiwering", "tydsberekening", "sosiale spanning", "vinnige besluite", "groepschaos"],
        outroParagraphs: [
          "Sommige spele is mededingend.",
          "Sommige is samewerkend.",
          "Sommige is albei terselfdertyd.",
          "Om jou vriende te blameer is deel van die ervaring."
        ]
      },
      {
        question: "Kan ek Vervus stroom of opneem?",
        paragraphs: [
          "Ja, persoonlike en nie-kommersiële deel is toegelaat.",
          "Jy kan:"
        ],
        bullets: ["spel stroom", "snitte opneem", "skermgrepe deel", "reaksies of inhoud aanlyn plaas"]
      },
      {
        question: "Verander Vervus oor tyd?",
        paragraphs: [
          "Ja. Vervus is 'n regstreekse platform. Ervarings, modusse, balans, tydhouers, beeldmateriaal, funksies en pryse kan oor tyd verander soos die platform ontwikkel.",
          "Nuwe ervarings sal gereeld bygevoeg word soos Vervus uitbrei."
        ]
      },
      {
        question: "Is Vervus veilig vir kinders?",
        paragraphs: ["Ja, maar aankope moet slegs deur volwassenes of met toestemming van 'n ouer of voog gemaak word."]
      },
      {
        question: "Hoe werk terugbetalings?",
        paragraphs: [
          "Omdat Vervus digitale toegang onmiddellik ná aktivering lewer, is terugbetalings oor die algemeen nie beskikbaar sodra toegang gebruik is nie.",
          "Ons kan egter terugbetalingsversoeke in gevalle soos die volgende hersien:"
        ],
        bullets: ["duplikaatbetalings", "mislukte aankope", "groot tegniese probleme"],
        outro: "Kontak ondersteuning vir hulp."
      },
      {
        question: "Hoe kontak ek Vervus?",
        paragraphs: [
          "Algemene navrae: info@vervus.live",
          "Ondersteuning: support@vervus.live",
          "Of gebruik ons kontakvorm."
        ]
      }
    ]),
    termsSections: Object.freeze([
      {
        title: "1. Oor Vervus",
        blocks: [
          { type: "p", text: "Vervus is 'n blaaiergebaseerde sosiale multispelerplatform wat gebruikers toelaat om regstreekse speelsessies op ondersteunde toestelle te skep en daarby aan te sluit." },
          { type: "p", text: "Vervus sluit platformsisteme in soos:" },
          { type: "list", items: ["kamers", "voorportale", "sessiebestuur", "herverbindingsisteme", "toegangstelsels", "betaalvloeie", "multispeler-infrastruktuur"] },
          { type: "p", text: "Vervus kan ook spele, modusse, gebeure, ervarings en toekomstige interaktiewe inhoud insluit soos:" },
          { type: "list", items: ["GLiTCH!", "Ghost", "Curse", "toekomstige ervarings of modusse"] },
          { type: "p", text: "Vervus word slegs vir vermaakdoeleindes verskaf." }
        ]
      },
      {
        title: "2. Aanvaarding van Hierdie Bepalings",
        blocks: [
          { type: "p", text: "Deur Vervus te gebruik of toegang daartoe te verkry, stem jy in tot hierdie Bepalings." },
          { type: "p", text: "As jy nie instem nie, mag jy nie Vervus gebruik nie." }
        ]
      },
      {
        title: "3. Geskiktheid",
        blocks: [
          { type: "p", text: "Jy moet minstens 13 jaar oud wees om Vervus te gebruik." },
          { type: "p", text: "Aankope mag slegs gemaak word deur:" },
          { type: "list", items: ["volwassenes, of", "minderjariges met toestemming van 'n ouer of wettige voog."] },
          { type: "p", text: "Ons kan toegang beperk of beëindig indien ons redelikerwys glo hierdie vereistes word nie nagekom nie." }
        ]
      },
      {
        title: "4. Rekeninge en Sessiedata",
        blocks: [
          { type: "p", text: "Vervus kan sonder permanente gebruikersrekeninge funksioneer." },
          { type: "p", text: "Om die platform te bedryf, kan ons tydelik die volgende verwerk of stoor:" },
          { type: "list", items: ["vertoonnames", "kameridentifiseerders", "sessie-identifiseerders", "toegang- of betaalstatusse", "spelgebeure", "herverbindingsstatusse", "tegniese blaaier- of toestel-inligting"] },
          { type: "p", text: "Gebruikers is verantwoordelik vir die name of identifiseerders wat hulle kies." }
        ]
      },
      {
        title: "5. Toegang en Tegniese Vereistes",
        blocks: [
          { type: "p", text: "Vervus vereis:" },
          { type: "list", items: ["'n ondersteunde blaaier", "'n versoenbare toestel", "internettoegang"] },
          { type: "p", text: "Ons waarborg nie ononderbroke beskikbaarheid, spel sonder vertraging, of versoenbaarheid met alle toestelle of blaaiers nie." },
          { type: "p", text: "Werkverrigting kan beïnvloed word deur:" },
          { type: "list", items: ["internetgehalte", "blaaierbeperkings", "toestelwerkverrigting", "bedienerlas", "batterybesparingsinstellings", "derdepartydienste", "tegniese foute"] }
        ]
      },
      {
        title: "6. Kamers en Sessies",
        blocks: [
          { type: "p", text: "'n Gasheer kan 'n kamer of multispelersessie skep." },
          { type: "p", text: "Spelers kan aansluit deur:" },
          { type: "list", items: ["QR-kodes", "aansluitkodes", "uitnodigingskakels", "ander ondersteunde metodes"] },
          { type: "p", text: "Kamers en sessies is tydelik en kan outomaties verval, herstel, ontkoppel of beëindig word." },
          { type: "p", text: "Ons kan sessies opskort, herstel of beëindig in gevalle wat die volgende behels:" },
          { type: "list", items: ["tegniese probleme", "bedrog", "misbruik", "kullery", "sekuriteitsrisiko's", "skending van hierdie Bepalings"] }
        ]
      },
      {
        title: "7. Aankope en Digitale Toegang",
        blocks: [
          { type: "p", text: "Vervus kan betaalde digitale toegang bied soos:" },
          { type: "list", items: ["tydelike ontsluitings", "party packs", "speltoegang", "ervarings", "premium funksies", "tydelike toegangsperiodes"] },
          { type: "p", text: "Pryse word voor aankoop gewys en kan BTW insluit waar die wet dit vereis." },
          { type: "p", text: "Betalings word deur derdepartybetaalverskaffers soos Stripe verwerk." },
          { type: "p", text: "Aankope verleen slegs die spesifiek beskryfde digitale toegang vir die aangeduide duur." },
          { type: "p", text: "Aankope dra nie eienaarskap oor van:" },
          { type: "list", items: ["sagteware", "spele", "inhoud", "bates", "intellektuele eiendom", "rekeninge", "platformstelsels"] }
        ]
      },
      {
        title: "8. Digitale Lewering en Herroepingsregte",
        blocks: [
          { type: "p", text: "Vervus verskaf digitale dienste en digitale inhoud." },
          { type: "p", text: "EU-verbruikers het normaalweg 'n statutêre 14-dae-herroepingsreg vir aanlynaankope. Onder EU-verbruikersreg kan hierdie reg egter verval vir digitale inhoud of digitale dienste sodra uitvoering begin nadat die verbruiker vooraf uitdruklike toestemming gegee en die verlies van die herroepingsreg erken het." },
          { type: "p", text: "Tydens betaalproses kan gebruikers dus verplig wees om:" },
          { type: "list", items: ["uitdruklik in te stem tot onmiddellike digitale lewering; en", "te erken dat hulle hul herroepingsreg verloor sodra toegang geaktiveer word."] },
          { type: "p", text: "Sodra digitale toegang geaktiveer of wesenlik gebruik is, is terugbetalings oor die algemeen nie beskikbaar nie tensy die wet dit vereis." }
        ]
      },
      {
        title: "9. Terugbetalings",
        blocks: [
          { type: "p", text: "Terugbetalings word oor die algemeen nie verskaf nadat digitale toegang geaktiveer of gebruik is nie." },
          { type: "p", text: "Ons kan na redelike goeddunke terugbetalings toestaan in gevalle soos:" },
          { type: "list", items: ["duplikaatbetalings", "mislukte lewering van gekoopte toegang", "groot tegniese foute wat deur Vervus veroorsaak is", "wetlike verpligtinge"] },
          { type: "p", text: "Terugbetalings word oor die algemeen nie verskaf vir:" },
          { type: "list", items: ["verbindingsprobleme", "onversoenbare toestelle", "blaaierprobleme", "spelers wat sessies verlaat", "ontevredenheid met spel", "gemiste sessies", "gebruikersfout"] }
        ]
      },
      {
        title: "10. Gebruikersgedrag",
        blocks: [
          { type: "p", text: "Gebruikers mag nie:" },
          { type: "list", items: ["ander teister of bedreig", "haatlike, beledigende of diskriminerende inhoud gebruik", "ander naboots", "sessies spam of ontwrig", "spel manipuleer of uitbuit", "die platform omgekeerd ontwerp of daaraan peuter", "bots, skrifte of outomatisering gebruik", "betalings of beperkings omseil", "wanware of skadelike kode versprei", "toepaslike wette oortree"] },
          { type: "p", text: "Ons kan toegang te eniger tyd beperk, opskort of beëindig waar dit redelikerwys nodig is om die volgende te beskerm:" },
          { type: "list", items: ["gebruikers", "sessies", "die platform", "platformintegriteit", "sekuriteit", "wetlike nakoming"] }
        ]
      },
      {
        title: "11. Billike Spel en Anti-Kullery",
        blocks: [
          { type: "p", text: "Vervus kan bediener-gesaghebbende stelsels, anti-kullery-stelsels en outomatiese bedrogopsporing gebruik." },
          { type: "p", text: "Gebruikers mag nie die volgende manipuleer nie:" },
          { type: "list", items: ["spel", "tydhouers", "tellings", "insette", "betaalstatusse", "sessiestatusse", "toegangstelsels"] },
          { type: "p", text: "Ons kan tellings, sessies of toegang ongeldig verklaar waar misbruik of onreëlmatighede opgespoor word." }
        ]
      },
      {
        title: "12. Opdaterings en Veranderinge",
        blocks: [
          { type: "p", text: "Vervus is 'n ontwikkelende regstreekse platform. Sommige funksies, stelsels of ervarings kan eksperimenteel wees of met verloop van tyd gewysig of gestaak word." },
          { type: "p", text: "Ons kan die volgende verander, herbelyn, verwyder of byvoeg:" },
          { type: "list", items: ["spele", "modusse", "tydhouers", "pryse", "beeldmateriaal", "stelsels", "belonings", "toegangsmodelle", "platformfunksionaliteit"] },
          { type: "p", text: "Ons kan ook onderhoud uitvoer wat toegang tydelik onderbreek." }
        ]
      },
      {
        title: "13. Gebruikersinhoud en Sosiale Deel",
        blocks: [
          { type: "p", text: "Gebruikers bly verantwoordelik vir inhoud wat hulle binne Vervus indien of deel, insluitend:" },
          { type: "list", items: ["vertoonnames", "teks", "boodskappe", "gedeelde media"] },
          { type: "p", text: "Gebruikers mag skermgrepe, snitte en spelmateriaal skep en deel vir persoonlike en nie-kommersiële sosiale deel, mits hulle toepaslike wette en die regte van ander respekteer." },
          { type: "p", text: "Deur inhoud binne Vervus in te dien, verleen gebruikers aan Vervus 'n beperkte, nie-eksklusiewe, wêreldwye lisensie om daardie inhoud slegs vir die werking van die platform en sessies te huisves, vertoon en verwerk." }
        ]
      },
      {
        title: "14. Intellektuele Eiendom",
        blocks: [
          { type: "p", text: "Alle regte met betrekking tot Vervus bly die eiendom van Vervus Interactive of sy lisensiehouers, insluitend:" },
          { type: "list", items: ["sagteware", "kode", "handelsmerk", "logo's", "UI", "beeldmateriaal", "spele", "klank", "ontwerpe", "spelstelsels", "databasisse", "handelsmerke"] },
          { type: "p", text: "Gebruikers ontvang 'n beperkte, nie-eksklusiewe, nie-oordraagbare reg om Vervus te gebruik en toegang daartoe te verkry in ooreenstemming met hierdie Bepalings." }
        ]
      },
      {
        title: "15. Privaatheid",
        blocks: [
          { type: "p", text: "Persoonlike data word verwerk in ooreenstemming met die Vervus Privaatheidsbeleid." },
          { type: "p", text: "Dit kan die volgende insluit:" },
          { type: "list", items: ["IP-adres", "blaaier- of toestelinligting", "spelgebeure", "sessie-identifiseerders", "betaalstatus", "analise", "tegniese logs", "sekuriteitslogs", "ondersteuningskommunikasie"] },
          { type: "p", text: "Vervus stoor oor die algemeen nie volledige betaalkaartinligting nie." }
        ]
      },
      {
        title: "16. Beskikbaarheidsvrywaring",
        blocks: [
          { type: "p", text: "Vervus word verskaf op 'n \"soos dit is\" en \"soos beskikbaar\" basis tot die volle mate wat deur die wet toegelaat word." },
          { type: "p", text: "Ons waarborg nie:" },
          { type: "list", items: ["ononderbroke beskikbaarheid", "foutvrye werking", "deurlopende beskikbaarheid", "perfekte sinkronisasie", "permanente toegang"] },
          { type: "p", text: "Toegang tot Vervus kan soms tydelik beperk of opgeskort word vir onderhoud, sekuriteit of tegniese redes." }
        ]
      },
      {
        title: "17. Beperking van Aanspreeklikheid",
        blocks: [
          { type: "p", text: "Tot die volle mate wat deur die wet toegelaat word, is Vervus nie aanspreeklik vir:" },
          { type: "list", items: ["indirekte skade", "verlies aan wins", "verlies aan data", "onderbroke spel", "mislukte sessies", "derdeparty-onderbrekings", "internetfoute", "toestelonversoenbaarheid", "mislukkings van betaalverskaffers"] },
          { type: "p", text: "Niks in hierdie Bepalings beperk aanspreeklikheid waar sodanige beperking deur toepaslike wet verbied word nie." },
          { type: "p", text: "Waar wetlik toegelaat, is totale aanspreeklikheid beperk tot die bedrag wat die gebruiker in die drie maande voor die betrokke eis aan Vervus betaal het, tot 'n maksimum van EUR 250." }
        ]
      },
      {
        title: "18. Opskorting en Beëindiging",
        blocks: [
          { type: "p", text: "Ons kan toegang opskort of beëindig waar dit redelikerwys nodig is weens:" },
          { type: "list", items: ["misbruik", "kullery", "bedrog", "sekuriteitskwessies", "betaalprobleme", "skending van hierdie Bepalings", "skadelike gedrag teenoor gebruikers of die platform"] }
        ]
      },
      {
        title: "19. Toepaslike Reg",
        blocks: [
          { type: "p", text: "Hierdie Bepalings word deur Nederlandse reg beheer." },
          { type: "p", text: "Verbruikers binne die EU behou verpligte verbruikersbeskerming wat in hul land van verblyf van toepassing is." },
          { type: "p", text: "Geskille word aan die bevoegde howe van Nederland voorgelê tensy verpligte wet anders vereis." }
        ]
      },
      {
        title: "20. Kontak",
        blocks: [
          { type: "p", text: "Algemene navrae: info@vervus.live" },
          { type: "p", text: "Ondersteuning: support@vervus.live" },
          { type: "p", text: "Of gebruik ons kontakvorm." }
        ]
      }
    ]),
    privacySections: Object.freeze([
      {
        title: "1. Inleiding",
        blocks: [
          { type: "p", text: "Hierdie Privaatheidsbeleid verduidelik hoe Vervus persoonlike data versamel, gebruik, stoor en beskerm wanneer gebruikers die Vervus-platform gebruik of toegang daartoe verkry." },
          { type: "p", text: "Vervus is 'n blaaiergebaseerde sosiale multispelerplatform wat regstreekse multispelersessies, kamers, spele en interaktiewe sosiale ervarings moontlik maak." },
          { type: "p", text: "Deur Vervus te gebruik, erken jy hierdie Privaatheidsbeleid." }
        ]
      },
      {
        title: "2. Data Wat Ons Versamel",
        blocks: [
          { type: "p", text: "Afhangend van hoe Vervus gebruik word, kan ons die volgende verwerk:" },
          { type: "label", text: "Tegniese en toestelinligting" },
          { type: "list", items: ["IP-adres", "blaaiertipe of weergawe", "bedryfstelsel", "toesteltipe", "taalinstellings", "sessie-identifiseerders", "verbindingsstatus", "fout- of omvalverslae"] },
          { type: "label", text: "Spel- en platformdata" },
          { type: "list", items: ["vertoonnames", "kamer- of sessie-identifiseerders", "spelgebeure", "herverbindingsstatusse", "toegangstatusse", "tydstempels", "sessie- of wedstrydaktiwiteit", "anti-kullery- of sekuriteitsgebeure"] },
          { type: "label", text: "Betaalverwante data" },
          { type: "p", text: "Betalings word deur derdepartybetaalverskaffers soos Stripe verwerk." },
          { type: "p", text: "Ons kan beperkte betaalverwante inligting ontvang soos:" },
          { type: "list", items: ["betaalstatus", "transaksie-identifiseerders", "land of streek", "bevestiging van toegang"] },
          { type: "p", text: "Vervus stoor oor die algemeen nie volledige betaalkaartinligting nie." },
          { type: "label", text: "Analise- en gebruiksdata" },
          { type: "p", text: "Ons kan analisedata versamel wat verband hou met:" },
          { type: "list", items: ["platformgebruik", "spelgedrag", "sessieduur", "interaksievloeie", "tegniese werkverrigting", "foute of omvalle", "funksiegebruik"] },
          { type: "p", text: "Waar dit redelikerwys moontlik is, kan analisedata saamgevoeg, gepseudonimiseer of op 'n privaatheidsvriendelike manier verwerk word." }
        ]
      },
      {
        title: "3. Hoe Ons Data Gebruik",
        blocks: [
          { type: "p", text: "Ons gebruik persoonlike data om:" },
          { type: "list", items: ["multispelersessies te bedryf", "platformfunksionaliteit te handhaaf", "aankope te verwerk", "digitale toegang te lewer", "sessies of herverbindingsstatusse te herstel", "spel en balans te verbeter", "bedrog en misbruik te voorkom", "sekuriteit te handhaaf", "klanteondersteuning te verskaf", "platformwerkverrigting te ontleed", "aan wetlike verpligtinge te voldoen"] }
        ]
      },
      {
        title: "4. Regsgronde",
        blocks: [
          { type: "p", text: "Afhangend van die situasie verwerk ons data op grond van:" },
          { type: "list", items: ["uitvoering van 'n kontrak", "regmatige belange", "wetlike verpligtinge", "gebruikers-toestemming waar vereis"] },
          { type: "label", text: "Regmatige belange kan die volgende insluit:" },
          { type: "list", items: ["bedrogvoorkoming", "platformsekuriteit", "analise", "diensverbetering", "misbruikvoorkoming", "tegniese stabiliteit"] }
        ]
      },
      {
        title: "5. Koekies en Plaaslike Berging",
        blocks: [
          { type: "p", text: "Vervus kan die volgende gebruik:" },
          { type: "list", items: ["koekies", "plaaslike berging", "sessieberging", "soortgelyke tegnologieë"] },
          { type: "p", text: "Dit kan gebruik word vir:" },
          { type: "list", items: ["sessievolharding", "herverbindingsisteme", "verifikasiestatusse", "spelkontinuïteit", "analise", "voorkeure", "sekuriteit"] },
          { type: "p", text: "Sommige koekies of bergingstegnologieë kan noodsaaklik wees vir multispelerfunksionaliteit, herverbindingsisteme en sessiekontinuïteit. Waar die wet dit vereis, vra ons toestemming voordat nie-noodsaaklike koekies of opsporingstegnologieë gebruik word." }
        ]
      },
      {
        title: "6. Derdepartydienste",
        blocks: [
          { type: "p", text: "Vervus kan derdepartydiensverskaffers gebruik, insluitend:" },
          { type: "list", items: ["betaalverwerkers", "gasheerverskaffers", "analiseverskaffers", "wolk-infrastruktuur", "moniterings- of sekuriteitsnutsmiddels", "klanteondersteuningstelsels"] },
          { type: "p", text: "Voorbeelde kan die volgende insluit:" },
          { type: "list", items: ["Stripe", "Cloudflare", "PostHog"] },
          { type: "p", text: "Hierdie verskaffers kan data namens ons verwerk onder hul eie privaatheidsbeleide en ooreenkomste." }
        ]
      },
      {
        title: "7. Anti-Kullery, Sekuriteit en Moderering",
        blocks: [
          { type: "p", text: "Om platformintegriteit te beskerm, kan Vervus die volgende monitor:" },
          { type: "list", items: ["verdagte spelgedrag", "uitbuitingspogings", "bots of outomatisering", "sessiemanipulasie", "misbruikverslae", "sekuriteitsgebeure"] },
          { type: "p", text: "Ons kan tegniese logs stoor wat nodig is vir:" },
          { type: "list", items: ["bedrogvoorkoming", "moderering", "hantering van misbruik", "wetlike nakoming", "platformsekuriteit"] }
        ]
      },
      {
        title: "8. Databehoud",
        blocks: [
          { type: "p", text: "Ons behou data slegs so lank as wat redelikerwys nodig is vir:" },
          { type: "list", items: ["platformbedryf", "wetlike verpligtinge", "geskilbeslegting", "sekuriteit", "analise", "bedrogvoorkoming"] },
          { type: "p", text: "Tydelike sessiedata kan outomaties uitgevee word nadat sessies verval." },
          { type: "p", text: "Sommige tegniese, betaal- of sekuriteitsverwante logs kan langer behou word waar dit redelikerwys nodig is." }
        ]
      },
      {
        title: "9. Internasionale Oordragte",
        blocks: [
          { type: "p", text: "Vervus en sy diensverskaffers kan data verwerk in lande buite die gebruiker se land van verblyf." },
          { type: "p", text: "Waar vereis, gebruik ons toepaslike waarborge vir internasionale data-oordragte." }
        ]
      },
      {
        title: "10. Jou Regte",
        blocks: [
          { type: "p", text: "Afhangend van toepaslike wet kan gebruikers regte hê wat die volgende insluit:" },
          { type: "list", items: ["toegang", "regstelling", "verwydering", "beperking", "beswaar", "oordraagbaarheid", "intrekking van toestemming"] },
          { type: "p", text: "Versoeke kan gestuur word aan:" },
          { type: "label", text: "support@vervus.live" },
          { type: "p", text: "Ons kan verifiëring vereis voordat ons op sekere versoeke reageer." }
        ]
      },
      {
        title: "11. Kinders",
        blocks: [
          { type: "p", text: "Vervus is nie bedoel vir kinders onder die minimum ouderdom wat deur toepaslike wet vereis word nie." },
          { type: "p", text: "As ons bewus word dat persoonlike data onwettig van minderjariges versamel is, kan ons daardie data verwyder." },
          { type: "p", text: "Ouers of voogde kan ons kontak indien hulle bekommerd is oor minderjariges wat Vervus gebruik." }
        ]
      },
      {
        title: "12. Sekuriteit",
        blocks: [
          { type: "p", text: "Ons gebruik redelike tegniese en organisatoriese maatreëls om persoonlike data te beskerm." },
          { type: "p", text: "Geen aanlyndiens kan egter absolute sekuriteit waarborg nie." },
          { type: "p", text: "Gebruikers is verantwoordelik vir die veiligheid van hul eie toestelle, blaaiers en internetverbindings." }
        ]
      },
      {
        title: "13. Veranderinge aan Hierdie Beleid",
        blocks: [
          { type: "p", text: "Ons kan hierdie Privaatheidsbeleid van tyd tot tyd opdateer." },
          { type: "p", text: "Bygewerkte weergawes kan op die Vervus-webwerf of platform gepubliseer word." },
          { type: "p", text: "Waar die wet dit vereis, kan ons gebruikers in kennis stel van wesenlike veranderinge aan hierdie Privaatheidsbeleid." }
        ]
      },
      {
        title: "14. Kontak",
        blocks: [
          { type: "p", text: "Algemene navrae: info@vervus.live" },
          { type: "p", text: "Privaatheid: support@vervus.live" },
          { type: "p", text: "Of gebruik ons kontakvorm." }
        ]
      }
    ])
  }
});

export function getPublicPageContent(language) {
  const normalizedLanguage = normalizeLanguage(language);
  return PUBLIC_PAGE_CONTENT[normalizedLanguage] || PUBLIC_PAGE_CONTENT.en;
}
