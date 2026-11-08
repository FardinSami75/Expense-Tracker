/* Expense Tracker engine: statement reading, categories, and expected pay.
   Plain functions with no page code, so they can be tested on their own. */
(function (root) {
"use strict";

/* ---------- categories ---------- */
// fixed: a bill that comes once a month, so it isn't projected forward like day-to-day spending
const CATEGORIES = [
  { name: "Groceries",          color: "#2f9e5b" },
  { name: "Eating out",         color: "#e8743b" },
  { name: "Gas & transport",    color: "#3b7dd8" },
  { name: "Shopping",           color: "#c2459b" },
  { name: "Rent & housing",     color: "#7a5cd6", fixed: true },
  { name: "Bills & phone",      color: "#1f9fb3", fixed: true },
  { name: "Subscriptions",      color: "#5867e8", fixed: true },
  { name: "Transfers to people",color: "#d4a017" },
  { name: "Travel",             color: "#0f8a7e" },
  { name: "Health & personal",  color: "#d6455d" },
  { name: "Entertainment",      color: "#9b59b6" },
  { name: "Education",          color: "#4f7a28" },
  { name: "Donations",          color: "#b5651d" },
  { name: "Fees & interest",    color: "#8a6d3b", fixed: true },
  { name: "Other",              color: "#7b8494" }
];
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.name, c]));

// kind: which rows count as spending
const KINDS = {
  spend:    "Spending",
  payment:  "Card payment",
  transfer: "Between my accounts",
  income:   "Pay / money in",
  plan:     "On an instalment plan",
  ignore:   "Don't count"
};

/* ---------- built-in shop rules ---------- */
const BUILTIN = [
  [/INSTAL?L?MENT FEE|ANNUAL FEE|MONTHLY FEE|SERVICE CHARGE|PURCHASE INTEREST|INTEREST CHARGE|CASH ADVANCE INTEREST|^INTEREST\b|NSF|OVERDRAFT|FOREIGN TRANSACTION FEE|ACCOUNT FEE|PLAN FEE/, "Fees & interest"],
  [/CHEXY|RENTMOOLA|\bRENT\b|LANDLORD|PROPERTY MGMT|PROPERTY MANAGEMENT|TENANT INSURANCE|SQUARE ONE INS/, "Rent & housing"],
  [/TELUS|ROGERS|\bBELL\b|BELL CANADA|FIDO|KOODO|FREEDOM MOBILE|PUBLIC MOBILE|VIRGIN PLUS|LUCKY MOBILE|CHATR|\bSHAW\b|ENMAX|ATCO|DIRECT ENERGY|EPCOR|CITY OF CALGARY|UTILITIES|HYDRO|ENERGY/, "Bills & phone"],
  [/OPENAI|CHATGPT|ANTHROPIC|CLAUDE\.AI|NETFLIX|SPOTIFY|APPLE\.COM\/BILL|APPLE\.COM|ITUNES|YOUTUBE|GOOGLE \*|GOOGLE PLAY|DISNEY|PRIME VIDEO|AMAZON PRIME|PRIME MEMBER|AMZN DIGITAL|ADOBE|ICLOUD|CRAVE|PARAMOUNT|MICROSOFT|XBOX|PLAYSTATION|NINTENDO|PATREON|CANVA|NOTION|GITHUB|DUOLINGO|AUDIBLE|LINKEDIN/, "Subscriptions"],
  [/SKIP ?THE ?DISHES|UBER ?EATS|DOORDASH|TIM HORTONS|TIMHORTONS|MCDONALD|STARBUCKS|\bA ?& ?W\b|SUBWAY|PIZZA|DOMINO|WENDY|BURGER|KFC|POPEYES|TACO|CHIPOTLE|SHAWARMA|BIRYANI|KEBAB|KITCH|KITCHEN|RESTAURANT|RESTO|CAFE|COFFEE|BAKERY|GRILL|DINER|SUSHI|RAMEN|PHO\b|BBQ|WINGS|BOBA|BUBBLE TEA|CHATIME|TST-|TST\*|DAIRY QUEEN|PANAGO|FIVE GUYS|COBS|BOSTON PIZZA|EARLS|CACTUS CLUB|MUCHO BURRITO|FRESHII|MARY BROWN|HARVEY|OSMOWS|THAI|INDIAN|DHABA|SWEETS/, "Eating out"],
  [/SAFEWAY|FRESHCO|SUPERSTORE|REAL CDN|SOBEYS|NO FRILLS|NOFRILLS|COSTCO|SAVE ?ON|CO-?OP(?! GAS)|T ?& ?T|WALMART SUPERCENTER|LOBLAW|FOOD BASICS|FRESH ST|BANGLA BAZAR|BAZAR|BAZAAR|GROCERY|GROCER|FOODS?\b|MARKET|INSTACART|VOILA|SUNTERRA|H MART|SPICE|HALAL|MEAT/, "Groceries"],
  [/SHELL|PETRO-?CANADA|PETRO CAN|ESSO|HUSKY|CO-?OP GAS|FAS GAS|MOBIL|CHEVRON|CIRCLE K|7-ELEVEN.*GAS|CALGARY TRANSIT|CTRAIN|COMPASS|\bUBER\b(?!.*EATS)|UBER TRIP|LYFT|PARKING|IMPARK|PARK PLUS|CALGARY PARKING|INDIGO PARK|ENTERPRISE|BUDGET RENT|AVIS|HERTZ|EVO CAR|COMMUNAUTO|AUTO|TIRE|JIFFY|MIDAS|CARWASH|CAR WASH|REGISTRY|INSURANCE/, "Gas & transport"],
  [/AIR ?CANADA|WESTJET|FLAIR|LYNX|EMIRATES|QATAR|ETIHAD|TURKISH|BIMAN|US-BANGLA|EXPEDIA|BOOKING\.COM|AIRBNB|HOTEL|MARRIOTT|HILTON|IHG|TRIP\.COM|AGODA|FLIGHT|AIRLINE|AIRPORT|YYC|DUTY FREE|GREYHOUND|RIDER EXPRESS|VIA RAIL/, "Travel"],
  [/SHOPPERS|PHARMA|REXALL|LONDON DRUGS|DRUG MART|CLINIC|DENTAL|DENTIST|OPTOMETR|MEDICAL|HEALTH|BARBER|SALON|HAIR|SPA\b|GYM|GOODLIFE|ANYTIME FITNESS|FIT FOR LESS|PLANET FITNESS|YMCA|FITNESS|SEPHORA|LUSH/, "Health & personal"],
  [/CINEPLEX|LANDMARK CINEMAS|THEATRE|THEATER|TICKETMASTER|EVENTBRITE|STEAM|EPIC GAMES|BOWLING|ESCAPE|TOPGOLF|CALGARY ZOO|STAMPEDE PARK|FLAMES|SADDLEDOME|CONCERT|MUSEUM/, "Entertainment"],
  [/UNIVERSITY OF CALGARY|UOFC|U OF C|BOOKSTORE|TUITION|PEARSON|MCGRAW|CENGAGE|WILEY|CHEGG|COURSERA|UDEMY|LEETCODE/, "Education"],
  [/UNICEF|DONAT|RED CROSS|CHARITY|FOUNDATION|ZAKAT|MOSQUE|MASJID|CHURCH|GOFUNDME|WORLD VISION|DOCTORS WITHOUT|SICKKIDS|FOOD BANK/, "Donations"],
  [/AMAZON|AMZN|TEMU|SHEIN|ALIEXPRESS|EBAY|ETSY|WINNERS|MARSHALLS|HOMESENSE|HOME SENSE|WALMART|DOLLARAMA|DOLLAR TREE|BEST BUY|BESTBUY|CANADIAN TIRE|IKEA|STAPLES|LONDON|DENIM|LEVI|H ?& ?M|UNIQLO|ZARA|GAP\b|OLD NAVY|AMERICAN EAGLE|AERIE|ROOTS|NIKE|ADIDAS|SPORT CHEK|SPORTCHEK|LULULEMON|ARITZIA|SIMONS|HUDSON|THE BAY|MEC\b|APPLE STORE|SAMSUNG|MEMORY EXPRESS|CANADA COMPUTERS|SEPHORA|TOYS|INDIGO|CHAPTERS|MICHAELS|DOLLAR|PAYPAL|SHOP|STORE|OUTLET|BOUTIQUE|MALL|CROSSIRON|CHINOOK|MARKET MALL|SMITH/, "Shopping"]
];

const ETRANSFER = /E-?\s?TRANSFER|E-?TFR|ETFR|EMAIL TRF|EMAIL TRANSFER|EMAIL MONEY|AUTODEPOSIT|AUTO-DEPOSIT|INTERAC (SEND|SENT|RECEIVED|REQUEST|MONEY)/;
const ETRANSFER_G = new RegExp(ETRANSFER.source, "g");
// Words banks put in front of debit-card purchases: "Point of Sale - Interac RETAIL PURCHASE 000001 SAFEWAY"
const POS_PREFIX = /^(?:\s|-|:|\d+\b|POINT OF SALE|POS\b|IDP\b|INTERAC\b|RETAIL PURCHASE|PURCHASE\b|VISA DEBIT|DEBIT CARD|DEBIT PURCHASE|CONTACTLESS|ONLINE PURCHASE|APPLE PAY|GOOGLE PAY)+/;
const CARD_PAYMENT = /PAYMENT RECEIVED|PAYMENT - THANK|PAYMENT THANK YOU|PAYMENT, THANK|PAIEMENT|AUTOPAY|AUTO PAY|CREDIT CARD PAYMENT|CARD PAYMENT|PAYMENT FROM|^PAYMENT\b|ONLINE PAYMENT|PAYMENT RECV|PMT RECEIVED/;
const PAYS_A_CARD = /AMEX|AMERICAN EXPRESS|\bVISA\b|MASTERCARD|MASTER CARD|NEO FINANCIAL|NEO CARD|CREDIT CARD|\bCC PAYMENT|BILL PAYMENT.*(AMEX|VISA|MASTERCARD|NEO)/;
const OWN_TRANSFER = /TRANSFER TO|TRANSFER FROM|TFR-TO|TFR-FR|TFR TO|TFR FROM|ONLINE TRANSFER|INTERNET TRANSFER|ONLINE BANKING TRANSFER|WWW TRF|INTERNAL TRANSFER|TO SAVINGS|FROM SAVINGS|TO CHEQUING|FROM CHEQUING|TANGERINE TRANSFER|SIMPLII TRANSFER/;
const PLAN_LINE = /PLAN IT|PLANIT|INSTAL?L?MENT(?!.*FEE)|EQUAL PAYMENT|PAYMENT PLAN(?!.*FEE)/;
const PAY_IN = /PAYROLL|\bPAY\b|SALARY|DIRECT DEP|DIRECT DEPOSIT|DEPOSIT|UNIVERSITY OF CALGARY|U OF C|TJX|WINNERS MERCH|MERCOR|PAYONEER|DEEL|WISE|CANADA FED|GST|CCB|CRA|INTEREST EARNED|INTEREST PAID|CASHBACK|CASH BACK|REWARD/;

/* ---------- small helpers ---------- */
const pad = n => String(n).padStart(2, "0");
const up = s => String(s == null ? "" : s).toUpperCase();
const clean = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

function fnv(str, seed) { let h = seed >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, "0"); }
const hashOf = s => fnv(s, 2166136261) + fnv(s, 33554467);

/* ---------- CSV ---------- */
function parseCSV(text) {
  text = String(text || "").replace(/^﻿/, "");
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(x => x.trim())).filter(r => r.some(x => x !== ""));
}

/* ---------- dates and amounts ---------- */
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  janv: 1, fevr: 2, fev: 2, mars: 3, avr: 4, mai: 5, juin: 6, juil: 7, aout: 8, oct: 10, nov: 11, dec: 12 };
const iso = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1990 && y < 2100) ? `${y}-${pad(m)}-${pad(d)}` : null;
const fixYear = y => y < 100 ? 2000 + y : y;

// order: "MDY" or "DMY" for dates like 03/04/2026
function parseDate(v, order) {
  if (v == null || v === "") return null;
  if (typeof v === "number" || /^\d{5}(\.\d+)?$/.test(String(v).trim())) { // Excel serial date
    const n = Number(v); if (n < 20000 || n > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 864e5);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(v).trim().toLowerCase().replace(/\./g, "").replace(/[éè]/g, "e").replace(/û/g, "u");
  let m;
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[\s-]+([a-z]+)[\s-,]+(\d{2,4})/))) return MONTHS[m[2].slice(0, 4)] || MONTHS[m[2].slice(0, 3)] ? iso(fixYear(+m[3]), MONTHS[m[2].slice(0, 4)] || MONTHS[m[2].slice(0, 3)], +m[1]) : null;
  if ((m = s.match(/^([a-z]+)[\s-]+(\d{1,2}),?[\s-]+(\d{2,4})/))) return MONTHS[m[1].slice(0, 3)] ? iso(fixYear(+m[3]), MONTHS[m[1].slice(0, 3)], +m[2]) : null;
  if ((m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/))) {
    const a = +m[1], b = +m[2], y = fixYear(+m[3]);
    if (a > 12) return iso(y, b, a);
    if (b > 12) return iso(y, a, b);
    return order === "DMY" ? iso(y, b, a) : iso(y, a, b);
  }
  return null;
}

// Works out whether a column of slash dates is month-first or day-first.
function guessOrder(values) {
  let mdy = 0, dmy = 0;
  values.forEach(v => { const m = String(v || "").trim().match(/^(\d{1,2})[/-](\d{1,2})[/-]\d{2,4}/); if (!m) return; if (+m[1] > 12) dmy++; if (+m[2] > 12) mdy++; });
  return dmy > mdy ? "DMY" : "MDY";
}

function parseAmount(v) {
  if (v == null) return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v).trim(); if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/\bCR\b|CREDIT$/i.test(s)) { neg = !neg; s = s.replace(/\bCR\b|CREDIT$/ig, ""); }
  if (/-\s*$/.test(s)) { neg = !neg; s = s.replace(/-\s*$/, ""); }
  if (/^\s*[-−–]/.test(s) || /^[^\d]*[-−–]/.test(s)) { neg = !neg; }
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;
  if (/,\d{2}$/.test(s) && !/\./.test(s)) s = s.replace(",", "."); else s = s.replace(/,/g, "");
  const n = Number(s);
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}

/* ---------- bank layouts ---------- */
const norm = h => up(h).replace(/[^A-Z0-9$]/g, "");
const findCol = (hdr, ...tests) => { for (const t of tests) { const i = hdr.findIndex(h => t.test(h)); if (i >= 0) return i; } return -1; };

// Each preset: does this header match, and how to read it. sign "out-positive" means purchases are positive numbers.
const PRESETS = [
  { id: "amex", name: "Amex", account: "Amex", type: "card",
    match: h => h.includes("DATE") && h.includes("DESCRIPTION") && h.includes("AMOUNT") && (h.includes("DATEPROCESSED") || h.includes("CARDMEMBER") || h.includes("EXTENDEDDETAILS") || h.length <= 5),
    map: h => ({ date: h.indexOf("DATE"), desc: [h.indexOf("DESCRIPTION")], amount: h.indexOf("AMOUNT"), sign: "out-positive" }) },
  { id: "rbc", name: "RBC", account: "RBC", type: "bank",
    match: h => h.includes("TRANSACTIONDATE") && h.includes("DESCRIPTION1") && (h.includes("CAD$") || h.includes("CAD")),
    map: h => ({ date: h.indexOf("TRANSACTIONDATE"), desc: [h.indexOf("DESCRIPTION1"), h.indexOf("DESCRIPTION2")].filter(i => i >= 0), amount: h.indexOf("CAD$") >= 0 ? h.indexOf("CAD$") : h.indexOf("CAD"), sign: "out-negative", typeCol: h.indexOf("ACCOUNTTYPE"), acctCol: h.indexOf("ACCOUNTNUMBER") }) },
  { id: "tangerine", name: "Tangerine", account: "Tangerine", type: "bank",
    match: h => h.includes("TRANSACTIONDATE") && h.includes("NAME") && h.includes("MEMO") && h.includes("AMOUNT"),
    map: h => ({ date: h.indexOf("TRANSACTIONDATE"), desc: [h.indexOf("NAME"), h.indexOf("MEMO")], amount: h.indexOf("AMOUNT"), sign: "out-negative" }) },
  { id: "simplii", name: "Simplii", account: "Simplii", type: "bank",
    match: h => h.includes("TRANSACTIONDETAILS") && h.includes("FUNDSOUT") && h.includes("FUNDSIN"),
    map: h => ({ date: h.indexOf("DATE"), desc: [h.indexOf("TRANSACTIONDETAILS")], debit: h.indexOf("FUNDSOUT"), credit: h.indexOf("FUNDSIN") }) },
  { id: "neo", name: "Neo", account: "Neo", type: "card",
    match: h => h.some(x => x.includes("NEO")) || (h.includes("TRANSACTIONDATE") && h.includes("DESCRIPTION") && h.includes("CATEGORY") && h.includes("AMOUNT")),
    map: h => ({ date: findCol(h, /^TRANSACTIONDATE$/, /DATE/), desc: [findCol(h, /^DESCRIPTION$/, /MERCHANT/, /DESC/)], amount: h.indexOf("AMOUNT"), sign: "auto" }) }
];

function signatureOf(header, headerless) { return headerless ? "nohdr:" + header.length : header.map(norm).join("|"); }

function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const h = rows[i].map(norm);
    if (h.some(x => /DATE|POSTED|^DAY$|^WHEN$/.test(x)) && h.some(x => /AMOUNT|DEBIT|CREDIT|FUNDS|CAD|WITHDRAW|DEPOSIT|PAID|SPENT|MONEY|CHARGE|VALUE|TOTAL/.test(x))) return i;
  }
  return -1;
}

// Returns { mapping, headerIndex, signature, header, known } for a table of rows.
function detectLayout(rows, saved) {
  saved = saved || {};
  const hi = findHeader(rows);
  if (hi < 0) {
    // CIBC: no header row. date, description, money out, money in, (card number)
    const r0 = rows[0] || [];
    const sig = signatureOf(r0, true);
    if (saved[sig]) return { mapping: saved[sig], headerIndex: -1, signature: sig, header: r0.map((_, i) => "Column " + (i + 1)), known: true };
    if (parseDate(r0[0]) && r0.length >= 4 && r0.length <= 6) {
      return { mapping: { name: "CIBC", account: "CIBC", type: r0.length >= 5 ? "card" : "bank", date: 0, desc: [1], debit: 2, credit: 3 }, headerIndex: -1, signature: sig, header: r0.map((_, i) => "Column " + (i + 1)), known: true, preset: "cibc" };
    }
    return { mapping: guessMapping(r0.map((_, i) => "COLUMN" + i), rows), headerIndex: -1, signature: sig, header: r0.map((_, i) => "Column " + (i + 1)), known: false };
  }
  const header = rows[hi], h = header.map(norm), sig = signatureOf(header, false);
  if (saved[sig]) return { mapping: saved[sig], headerIndex: hi, signature: sig, header, known: true };
  for (const p of PRESETS) if (p.match(h)) {
    const mp = Object.assign({ name: p.name, account: p.account, type: p.type }, p.map(h));
    if (mp.sign === "auto") mp.sign = guessSign(rows.slice(hi + 1), mp.amount);
    return { mapping: mp, headerIndex: hi, signature: sig, header, known: true, preset: p.id };
  }
  return { mapping: guessMapping(h, rows.slice(hi + 1)), headerIndex: hi, signature: sig, header, known: false };
}

function guessMapping(h, body) {
  const date = findCol(h, /^(TRANSACTION)?DATE$/, /TRANS.*DATE/, /DATE/, /POSTED/, /^DAY$/, /^WHEN$/);
  const desc = findCol(h, /DESCRIPTION/, /DETAILS/, /MERCHANT/, /PAYEE/, /NAME/, /MEMO/, /NARRATIVE/);
  const amount = findCol(h, /^AMOUNT$/, /AMOUNT/, /^CAD/);
  const debit = findCol(h, /DEBIT/, /WITHDRAW/, /FUNDSOUT/, /MONEYOUT/, /PAIDOUT/, /SPENT/);
  const credit = findCol(h, /CREDIT/, /DEPOSIT/, /FUNDSIN/, /MONEYIN/, /PAIDIN/, /RECEIVED/);
  const mp = { name: "", account: "", type: "card", date: date >= 0 ? date : 0, desc: [desc >= 0 ? desc : 1] };
  if (amount >= 0 || debit < 0) { mp.amount = amount >= 0 ? amount : 2; mp.sign = guessSign(body, mp.amount); }
  else { mp.debit = debit; mp.credit = credit; }
  return mp;
}

// Most lines on a statement are purchases, so the more common sign is "money out".
function guessSign(body, col) {
  let pos = 0, neg = 0;
  body.forEach(r => { const a = parseAmount(r[col]); if (a > 0) pos++; else if (a < 0) neg++; });
  return neg > pos ? "out-negative" : "out-positive";
}

// Turns raw rows into { date, desc, amount (+ = money out), type, line }.
function readRows(rows, det) {
  const mp = det.mapping, body = rows.slice(det.headerIndex + 1);
  const order = guessOrder(body.map(r => r[mp.date]));
  const out = [], skipped = [];
  body.forEach((r, i) => {
    const date = parseDate(r[mp.date], mp.order || order);
    const desc = (mp.desc || []).map(c => String(r[c] == null ? "" : r[c]).trim()).filter(Boolean).join("  ");
    let amount = null;
    if (mp.amount != null && mp.amount >= 0) {
      const a = parseAmount(r[mp.amount]);
      if (a != null) amount = mp.sign === "out-negative" ? -a : a;
    } else {
      const d = parseAmount(r[mp.debit]), c = parseAmount(r[mp.credit]);
      if (d) amount = Math.abs(d); else if (c) amount = -Math.abs(c);
      else if (d === 0 || c === 0) amount = 0;
    }
    if (!date || amount == null || amount === 0 || !desc) { skipped.push(i + det.headerIndex + 2); return; }
    let type = mp.type || "card";
    if (mp.typeCol != null && mp.typeCol >= 0) { const t = up(r[mp.typeCol]); if (/VISA|MASTERCARD|CREDIT|AMEX/.test(t)) type = "card"; else if (t) type = "bank"; }
    const row = { date, desc, amount: Math.round(amount * 100) / 100, type, line: i + det.headerIndex + 2 };
    // One file with several accounts (RBC): name each line's account, e.g. "RBC Chequing 4567".
    if (mp.acctCol != null && mp.acctCol >= 0 && r[mp.acctCol]) {
      const digits = String(r[mp.acctCol]).replace(/\D/g, ""), kind = mp.typeCol >= 0 ? titleCase(String(r[mp.typeCol] || "").trim()) : "";
      row.account = clean([mp.account || mp.name, kind, digits.slice(-4)].filter(Boolean).join(" "));
    }
    out.push(row);
  });
  return { rows: out, skipped };
}

/* ---------- shop names ---------- */
const PROCESSORS = /^(PAYPAL|PP|SQ|SP|TST|SUMUP|ZTL|CLV|GOOGLE|APPLE PAY|IZ|EB|WWW)\s*[*\-]\s*/;
const PLACES = new Set(["CALGARY", "EDMONTON", "TORONTO", "VANCOUVER", "MONTREAL", "OTTAWA", "WINNIPEG", "HALIFAX", "AIRDRIE", "COCHRANE", "OKOTOKS", "CHESTERMERE", "BANFF", "CANMORE", "MISSISSAUGA",
  "AB", "BC", "ON", "QC", "MB", "SK", "NS", "NB", "CA", "CAN", "USA", "US", "SAN", "FRANCISCO", "SEATTLE", "NEW", "YORK", "MID-HAR", "INTERNET", "ONLINE", "WWW"]);
const PRETTY = { SKIPTHEDISHES: "SkipTheDishes", OPENAI: "OpenAI (ChatGPT)", ANTHROPIC: "Anthropic (Claude)", "AMAZON.CA": "Amazon", AMAZON: "Amazon", AMZN: "Amazon", TEMU: "Temu", INSTACART: "Instacart",
  CHEXY: "Chexy (rent)", "CHEXY FEE": "Chexy fee", TELUS: "Telus", "TIM HORTONS": "Tim Hortons", FRESHCO: "FreshCo", UBER: "Uber", "UBER EATS": "Uber Eats", DOORDASH: "DoorDash", MCDONALDS: "McDonald's", "MCDONALD'S": "McDonald's" };

// A short, stable name for the shop, used to group spending and to remember categories.
function merchantKey(desc) {
  if (ETRANSFER.test(up(desc))) return ("E-TRANSFER " + payeeOf(desc)).trim();
  let s = up(desc).replace(POS_PREFIX, "");
  if (s.length < up(desc).length) s = s.trim();
  s = s.replace(/\s{2,}.*$/, "");                    // Amex puts the city after a run of spaces
  s = s.replace(PROCESSORS, "");
  if (/^[A-Z0-9 .'&-]+\*/.test(s)) s = s.split("*")[0];  // "AMAZON.CA*510L06ZZ2" → "AMAZON.CA"
  s = s.replace(/#\s*\d.*$/, "").replace(/\b(STORE|STR|NO)\s*\d+.*$/, "");
  let w = s.split(/\s+/).filter(Boolean);
  while (w.length > 1 && (/\d|[()]/.test(w[w.length - 1]) || PLACES.has(w[w.length - 1]))) w.pop();
  w = w.filter((x, i) => i === 0 || !/^\d+$/.test(x));
  s = w.join(" ").replace(/[^A-Z0-9 .'&-]/g, "").trim();
  if (/^TELUS\b/.test(s)) return "TELUS";
  if (/^AMAZON|^AMZN/.test(s)) return "AMAZON";
  if (/^SHELL\b/.test(s)) return "SHELL";
  if (/^OPENAI/.test(s)) return "OPENAI";
  if (/^ANTHROPIC/.test(s)) return "ANTHROPIC";
  if (/^SAFEWAY/.test(s)) return "SAFEWAY";
  if (/^WINNERS/.test(s)) return "WINNERS";
  if (/^CHEXY/.test(s)) return "CHEXY";
  return s || clean(up(desc)).slice(0, 30);
}

// Who an e-Transfer went to (or came from): the name left after the bank's wording is removed.
function payeeOf(desc) {
  const parts = String(desc || "").split(/\s{2,}/);
  const start = Math.max(0, parts.findIndex(p => ETRANSFER.test(up(p))));
  for (const p of parts.slice(start)) {
    const name = up(p).replace(ETRANSFER_G, " ").split(/\s+/)
      .filter(w => w && !/[\d*#]/.test(w))
      .map(w => w.replace(/[^A-Z'-]/g, ""))
      .filter(w => w.length > 1 && !/^(SENT|SEND|RECEIVED|RECEIVE|TO|FROM|FOR|REF|FEE|MONEY|REQUEST|FULFILLED|CANCELLED|DEPOSIT|INTERAC|AUTODEPOSIT|AUTO-DEPOSIT|AUTO|E-TRANSFER|ETRANSFER)$/.test(w));
    if (name.length) return name.slice(0, 2).join(" ");
  }
  return "";
}

function displayName(key) {
  if (!key) return "";
  if (PRETTY[key]) return PRETTY[key];
  if (key.startsWith("E-TRANSFER")) { const p = key.slice(11).trim(); return p ? "e-Transfer · " + titleCase(p) : "e-Transfer"; }
  return titleCase(key);
}
function titleCase(s) { return s.toLowerCase().replace(/(^|[\s.&'-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bAnd\b/g, "and"); }

/* ---------- categorising ---------- */
function builtinCategory(U) { for (const [re, cat] of BUILTIN) if (re.test(U)) return cat; return "Other"; }

// Chexy charges rent to a card plus a 1.75% fee. Only the fee counts as spending; the rent itself is left out.
const CHEXY_FEE = 0.0175;
function splitChexy(r) {
  if (!/CHEXY/.test(up(r.desc)) || !r.amount) return [r];
  const rent = Math.round(r.amount / (1 + CHEXY_FEE) * 100) / 100, fee = Math.round((r.amount - rent) * 100) / 100;
  return [Object.assign({}, r, { amount: rent, chexy: "rent", note: "Rent through Chexy (not counted, only the fee is)" }),
          Object.assign({}, r, { amount: fee, desc: r.desc + " · 1.75% fee", chexy: "fee", note: "Chexy's 1.75% card fee" })];
}

// rules: [{ pattern, category, kind }] saved by the person. Returns { merchant, category, kind }.
function classify(r, rules) {
  if (r.chexy === "rent") return { merchant: "CHEXY", category: "Rent & housing", kind: "ignore" };
  if (r.chexy === "fee") return { merchant: "CHEXY FEE", category: "Fees & interest", kind: "spend" };
  const U = up(r.desc), key = merchantKey(r.desc), moneyIn = r.amount < 0, isBank = r.type === "bank";
  const rule = (rules || []).find(x => x.pattern === key) || (rules || []).find(x => x.pattern.length >= 4 && U.includes(x.pattern));
  if (rule) return { merchant: key, category: rule.category, kind: rule.kind || "spend", rule: true };
  if (ETRANSFER.test(U)) return { merchant: key, category: "Transfers to people", kind: "spend" };
  if (OWN_TRANSFER.test(U)) return { merchant: key, category: "Other", kind: "transfer" };
  if (moneyIn && CARD_PAYMENT.test(U)) return { merchant: key, category: "Other", kind: "payment" };
  if (isBank && !moneyIn && (PAYS_A_CARD.test(U) && /PAYMENT|PMT|BILL|PAY\b|AMEX|AMERICAN EXPRESS/.test(U))) return { merchant: key, category: "Other", kind: "payment" };
  const cat = builtinCategory(U);
  if (cat === "Fees & interest") return { merchant: key, category: cat, kind: "spend" };
  if (PLAN_LINE.test(U)) return { merchant: key, category: "Other", kind: "plan" };
  if (moneyIn && isBank) return { merchant: key, category: "Other", kind: "income" };
  if (moneyIn && PAY_IN.test(U) && !/REFUND|RETURN/.test(U) && cat === "Other") return { merchant: key, category: "Other", kind: "income" };
  return { merchant: key, category: cat, kind: "spend" };   // card refunds stay in their shop's category as money back
}

// Unique, repeatable id for a statement line so importing the same file twice adds nothing.
function importHashes(rows, account) {
  const seen = {};
  return rows.map(r => {
    const base = [up(r.account || account || ""), r.date, r.amount.toFixed(2), up(r.desc).replace(/\s+/g, " ")].join("|");
    seen[base] = (seen[base] || 0) + 1;
    return hashOf(base + "|" + seen[base]);
  });
}

/* ---------- expected pay (same rules as Pay Tracker) ---------- */
const STATS = new Set(["2026-01-01","2026-02-16","2026-04-03","2026-05-18","2026-07-01","2026-09-07","2026-10-12","2026-11-11","2026-12-25",
  "2027-01-01","2027-02-15","2027-03-26","2027-05-24","2027-07-01","2027-09-06","2027-10-11","2027-11-11","2027-12-25"]);
const WIN_ANCHOR = "2026-09-27", MER_ANCHOR = "2026-10-23";
const mKey = d => d.slice(0, 7);
const addMonth = (k, n) => { let [y, m] = k.split("-").map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return y + "-" + pad(m); };
const daysIn = k => { const [y, m] = k.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const dUTC = s => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const sUTC = t => { const d = new Date(t); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); };
const addDays = (s, n) => sUTC(dUTC(s) + n * 864e5);
const toFriday = s => { const w = new Date(dUTC(s)).getUTCDay(); return w === 6 ? addDays(s, -1) : w === 0 ? addDays(s, -2) : s; };
const toMin = t => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
function spanMin(i, o) { let s = toMin(o) - toMin(i); if (s <= 0) s += 1440; return s; }
function autoBreak(job, span) { const h = span / 60; if (job === "University AV/IT") return h >= 8 ? 60 : h > 5 ? 30 : 0; if (h <= 5) return 0; if (job === "Winners") return h <= 6.5 ? 30 : 45; return 30; }
function paidHours(span, brk, stat) { const w = Math.max(0, (span - brk) / 60); if (stat) return w * 1.5; return w > 8 ? 8 + (w - 8) * 1.5 : w; }
function rateFor(rates, job, date) { const h = (rates[job] || []).slice().sort((a, b) => a.from < b.from ? -1 : 1); let r = null; for (const e of h) if (e.from <= date) r = e.rate; return r ?? (h[0] ? h[0].rate : 0); }
function shiftEarn(rates, s) { const sp = spanMin(s.in, s.out); return paidHours(sp, autoBreak(s.job, sp), s.job === "Winners" && STATS.has(s.date)) * rateFor(rates, s.job, s.date); }

// All paydays from from..to with the gross amount for each. pay = { shifts, rates, tasks }
function paydays(pay, from, to, today) {
  const out = [];
  let k = addMonth(mKey(from), -2); const end = addMonth(mKey(to), 1);
  while (k <= end) { out.push({ job: "University AV/IT", start: k + "-01", end: k + "-15", pay: toFriday(k + "-25") }); out.push({ job: "University AV/IT", start: k + "-16", end: k + "-" + pad(daysIn(k)), pay: toFriday(addMonth(k, 1) + "-10") }); k = addMonth(k, 1); }
  for (let i = Math.floor((dUTC(from) - dUTC(WIN_ANCHOR)) / 864e5 / 14) - 2; ; i++) { const st = addDays(WIN_ANCHOR, i * 14), en = addDays(st, 13), p = addDays(en, 6); if (p > to) break; out.push({ job: "Winners", start: st, end: en, pay: p }); }
  for (let i = Math.floor((dUTC(from) - dUTC(MER_ANCHOR)) / 864e5 / 7) - 2; ; i++) { const st = addDays(MER_ANCHOR, i * 7), en = addDays(st, 6), p = addDays(en, 6); if (p > to) break; out.push({ job: "Mercor", start: st, end: en, pay: p }); }
  // Stampede has no pay schedule in Pay Tracker; count its shifts on the day worked.
  return out.filter(p => p.pay >= from && p.pay <= to).map(p => {
    let gross = 0, n = 0;
    if (p.job === "Mercor") (pay.tasks || []).forEach(t => { if (t.date >= p.start && t.date <= p.end) { gross += (t.hours * t.rate + (t.bonus || 0)) * t.fx; n++; } });
    else (pay.shifts || []).forEach(s => { if (s.job === p.job && s.date >= p.start && s.date <= p.end) { gross += shiftEarn(pay.rates || {}, s); n++; } });
    return Object.assign(p, { gross, n, received: p.pay <= today });
  }).concat((pay.shifts || []).filter(s => s.job === "Stampede" && s.date >= from && s.date <= to)
    .map(s => ({ job: "Stampede", start: s.date, end: s.date, pay: s.date, gross: shiftEarn(pay.rates || {}, s), n: 1, received: s.date <= today })))
    .filter(p => p.n > 0).sort((a, b) => a.pay < b.pay ? -1 : 1);
}

// Pay landing in a month, after tax on job pay (Mercor is contract pay, nothing taken off).
function monthIncome(pay, month, today, takeHome) {
  const list = paydays(pay, month + "-01", month + "-" + pad(daysIn(month)), today);
  const net = p => p.job === "Mercor" ? p.gross : p.gross * takeHome;
  return { list, gross: list.reduce((a, p) => a + p.gross, 0), net: list.reduce((a, p) => a + net(p), 0),
    received: list.filter(p => p.received).reduce((a, p) => a + net(p), 0) };
}

/* ---------- monthly numbers ---------- */
const planDue = (p, month) => { const s = p.start_month.slice(0, 7), e = addMonth(s, p.payments - 1); return month >= s && month <= e; };
function planStatus(p, month) {
  const s = p.start_month.slice(0, 7); let made = 0;
  for (let i = 0; i < p.payments; i++) if (addMonth(s, i) <= month) made++;
  return { made, left: p.payments - made, remaining: (p.payments - made) * p.monthly, last: addMonth(s, p.payments - 1) };
}

// spend rows for a month → totals, by category, by shop, and the end-of-month projection
function monthStats(expenses, plans, month, today) {
  const rows = expenses.filter(e => e.kind === "spend" && e.date.slice(0, 7) === month);
  const byCat = {}, byShop = {};
  let total = 0, fixed = 0, refunds = 0;
  rows.forEach(e => {
    const a = Number(e.amount), c = e.category || "Other";
    total += a; if (a < 0) refunds += -a;
    byCat[c] = (byCat[c] || 0) + a;
    if (CAT[c] && CAT[c].fixed) fixed += a;
    const k = e.merchant || merchantKey(e.description);
    if (a > 0) { byShop[k] = byShop[k] || { key: k, total: 0, n: 0, category: c }; byShop[k].total += a; byShop[k].n++; }
  });
  const planned = plans.filter(p => planDue(p, month)).reduce((a, p) => a + Number(p.monthly), 0);
  const days = daysIn(month), cur = mKey(today);
  const elapsed = month < cur ? days : month > cur ? 0 : Number(today.slice(8, 10));
  const variable = total - fixed;
  return { rows, total, fixed, variable, refunds, planned, byCat, byShop, days, elapsed,
    outflow: total + planned, isPast: month < cur, isFuture: month > cur };
}

// Where the month is heading. lastFixed = last month's bills, used until this month's arrive.
function projection(st, lastFixed) {
  if (st.isPast) return { projected: st.outflow, expectedBills: 0 };
  const pace = st.elapsed > 0 ? st.variable / st.elapsed : 0;
  // Early in the month the daily pace is noisy, so lean on it less in the first week.
  const weight = Math.min(1, st.elapsed / 7);
  const varEnd = st.variable + pace * (st.days - st.elapsed) * weight;
  const expectedBills = Math.max(0, (lastFixed || 0) - st.fixed);
  return { projected: varEnd + st.fixed + expectedBills + st.planned, expectedBills, pace };
}

/* ---------- PDF statements ---------- */
// pages: [[{ s, x, y, w }]] — text pieces with y measured from the top of the page.
const MON = "(JAN|FEB|MAR|APR|MAY|JUNE?|JULY?|AUG|SEPT?|OCT|NOV|DEC)[A-Z]*\\.?";
const RE_DMY = new RegExp("^(\\d{1,2})[\\s-]*" + MON + "(?:[\\s,-]*(\\d{4}))?(?![A-Z0-9])");
const RE_MDY = new RegExp("^" + MON + "[\\s-]*(\\d{1,2})(?:,?\\s+(\\d{4}))?(?![0-9])");
const RE_FULL = new RegExp("(?:" + MON + "\\s+(\\d{1,2}),?\\s+(\\d{4}))|(?:(\\d{1,2})\\s+" + MON + "\\s+(\\d{4}))|(?:(\\d{4})-(\\d{2})-(\\d{2}))", "g");
const monNum = s => MONTHS[String(s).toLowerCase().slice(0, 3)];
const AMT = /^[-−(]?\s?\$?\s?\d{1,3}(?:[, ]\d{3})*\.\d{2}\)?(?:\s?(?:CR|DR|-))?$/i;

function leadingDate(t) {
  const T = up(t); let m;
  if ((m = T.match(/^(\d{4})-(\d{2})-(\d{2})(?![\d])/))) return { y: +m[1], m: +m[2], d: +m[3], len: m[0].length };
  if ((m = T.match(RE_DMY))) return { d: +m[1], m: monNum(m[2]), y: m[3] ? +m[3] : null, len: m[0].length };
  if ((m = T.match(RE_MDY))) return { m: monNum(m[1]), d: +m[2], y: m[3] ? +m[3] : null, len: m[0].length };
  if ((m = T.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d.])/))) {
    let a = +m[1], b = +m[2]; if (a > 12) [a, b] = [b, a];
    return { m: a, d: b, y: m[3] ? fixYear(+m[3]) : null, len: m[0].length };
  }
  return null;
}

// Joins text pieces into lines, and close pieces into cells.
function pdfLines(pages) {
  const lines = [];
  pages.forEach((items, pi) => {
    const its = items.filter(i => String(i.s).trim()).sort((a, b) => a.y - b.y || a.x - b.x);
    let cur = null;
    its.forEach(i => { if (!cur || Math.abs(i.y - cur.y) > 2.6) { cur = { page: pi, y: i.y, items: [] }; lines.push(cur); } cur.items.push(i); });
  });
  lines.forEach(l => {
    l.items.sort((a, b) => a.x - b.x);
    const cells = [];
    l.items.forEach(i => {
      const last = cells[cells.length - 1], s = String(i.s);
      if (last && i.x - last.x2 < 4) { last.s += (i.x - last.x2 > 0.8 && !/\s$/.test(last.s) ? " " : "") + s; last.x2 = i.x + (i.w || 0); }
      else cells.push({ s, x: i.x, x2: i.x + (i.w || s.length * 4.5) });
    });
    cells.forEach(c => c.s = c.s.replace(/\s+/g, " ").trim());
    // "45.00" and "CR" printed as separate pieces
    for (let k = cells.length - 2; k >= 0; k--) if (AMT.test(cells[k].s) && /^(CR|DR|-)$/i.test(cells[k + 1].s)) { cells[k].s += " " + cells[k + 1].s; cells[k].x2 = cells[k + 1].x2; cells.splice(k + 1, 1); }
    l.cells = cells.filter(c => c.s);
    l.text = l.cells.map(c => c.s).join("  ");
  });
  return lines.filter(l => l.cells.length);
}

function pdfMeta(lines) {
  const first = lines.filter(l => l.page === 0).map(l => l.text).join("\n"), all = lines.map(l => l.text).join("\n"), U = up(first), A = up(all);
  const BANKS = [["RBC", /ROYAL BANK|\bRBC\b/], ["CIBC", /\bCIBC\b/], ["Amex", /AMERICAN EXPRESS|\bAMEX\b/], ["Tangerine", /TANGERINE/], ["Simplii", /SIMPLII/],
    ["Neo", /NEO FINANCIAL|\bNEO\b/], ["Scotiabank", /SCOTIA/], ["TD", /\bTD CANADA|\bTD BANK|\bTD\b/], ["BMO", /\bBMO\b|BANK OF MONTREAL/], ["EQ Bank", /EQ BANK/], ["Wealthsimple", /WEALTHSIMPLE/], ["KOHO", /\bKOHO\b/]];
  const bank = (BANKS.find(([, re]) => re.test(U)) || BANKS.find(([, re]) => re.test(A)) || [""])[0];
  const isCard = /CREDIT LIMIT|MINIMUM PAYMENT|PAYMENT DUE DATE|AMERICAN EXPRESS|CREDIT CARD|\bVISA\b|MASTERCARD|CARDMEMBER|CARD MEMBER/.test(U);
  // the account kind is named in the heading area, before the list of transactions
  const hi = lines.findIndex(l => /WITHDRAW|DEPOSITS?\b|AMOUNT|DESCRIPTION|DETAILS/.test(up(l.text)) && /DATE|DESCRIPTION|DETAILS/.test(up(l.text)));
  const H = up(lines.slice(0, hi > 0 ? hi : 25).map(l => l.text).join("\n"));
  const sav = (H.match(/SAVINGS/g) || []).length, che = (H.match(/CHEQUING|CHECKING/g) || []).length;
  const kind = isCard ? (/\bVISA\b/.test(U) ? "Visa" : /MASTERCARD/.test(U) ? "Mastercard" : "") : sav > che ? "Savings" : che ? "Chequing" : "";
  let m, last4 = "";
  if ((m = U.match(/(?:ENDING IN|ENDS? WITH|ACCOUNT ENDING|CARD ENDING|X{3,}|\*{2,}|•{2,})[\s:-]*(?:\d+-)?(\d{4,5})\b/))) last4 = m[1].slice(-4);
  else if ((m = U.match(/ACCOUNT\s*(?:NUMBER|NO\.?|#)?\s*:?\s*([\d][\d\s-]{5,22}\d)/))) last4 = m[1].replace(/\D/g, "").slice(-4);
  // latest full date on the first page: the statement date or due date, used to give "Oct 27" its year
  const dates = []; let f; RE_FULL.lastIndex = 0;
  while ((f = RE_FULL.exec(U))) { const d = f[1] ? iso(+f[3], monNum(f[1]), +f[2]) : f[4] ? iso(+f[6], monNum(f[5]), +f[4]) : iso(+f[7], +f[8], +f[9]); if (d) dates.push(d); }
  return { bank, kind, type: isCard ? "card" : "bank", last4, anchor: dates.sort().pop() || null };
}

function withYear(dt, anchor) {
  if (dt.y) return iso(dt.y, dt.m, dt.d);
  const ay = +anchor.slice(0, 4);
  for (const y of [ay, ay - 1, ay + 1]) { const d = iso(y, dt.m, dt.d); if (!d) continue; const diff = (dUTC(d) - dUTC(anchor)) / 864e5; if (diff <= 40 && diff > -330) return d; }
  return iso(ay, dt.m, dt.d);
}

const PDF_SKIP = /^(OPENING|CLOSING|STARTING|ENDING) BALANCE|^BALANCE FORWARD|^(PREVIOUS|NEW|PRIOR) (STATEMENT )?BALANCE|^TOTAL|^SUB-?TOTAL|^MINIMUM|^PAYMENT DUE|^CREDIT LIMIT|^AVAILABLE|^INTEREST RATE|^ANNUAL INTEREST|^STATEMENT|^PAGE \d|^CONTINUED|^DATE\b|^TRANS(ACTION)?\.? DATE|^POST(ING|ED)? DATE|^DESCRIPTION|^ACCOUNT (NUMBER|SUMMARY)|^YOUR |^SUMMARY/;
const OPEN_RE = /(OPENING|STARTING) BALANCE|BALANCE FORWARD|PREVIOUS (STATEMENT )?BALANCE|PRIOR BALANCE/;
const CLOSE_RE = /(CLOSING|ENDING) BALANCE|NEW BALANCE/;

function pdfAmount(s) { const a = parseAmount(String(s).replace(/(\d) (\d{3})/g, "$1,$2").replace(/\bDR\b/i, "")); return a; }

// Reads transactions from a PDF statement. Returns { rows, meta, check }.
function parsePdf(pages, today) {
  const lines = pdfLines(pages), meta = pdfMeta(lines);
  const anchor = meta.anchor || today || new Date().toISOString().slice(0, 10);
  const pageW = Math.max(...pages.flat().map(i => i.x + (i.w || 0)), 400);
  let cols = null, colsPage = -1, lastDate = null, lastTx = null, prevBal = null, opening = null, closing = null;
  const rows = [];
  for (const l of lines) {
    const U = up(l.text);
    // column headings: Withdrawals / Deposits / Balance, or Amount
    const hw = l.cells.find(c => /WITHDRAW|DEBITS?\b|CHEQUES|PAID OUT|MONEY OUT|FUNDS OUT/.test(up(c.s))), hd = l.cells.find(c => /DEPOSITS?\b|CREDITS?\b|PAID IN|MONEY IN|FUNDS IN/.test(up(c.s)));
    const hb = l.cells.find(c => /^BALANCE|BALANCE \(\$\)/.test(up(c.s))), ha = l.cells.find(c => /^AMOUNT/.test(up(c.s)));
    if (((hw && hd) || (ha && /DATE|DESCRIPTION|DETAILS|TRANSACTION/.test(U))) && !leadingDate(l.text)) {
      const mid = c => c ? (c.x + c.x2) / 2 : null;
      cols = { w: mid(hw), d: mid(hd), b: mid(hb), a: mid(ha), left: Math.min(...[hw, hd, hb, ha].filter(Boolean).map(c => c.x)) };
      colsPage = l.page; lastTx = null; continue;
    }
    const amtLeft = cols ? cols.left - 45 : pageW * 0.6;
    const amts = l.cells.filter(c => AMT.test(c.s) && c.x2 >= amtLeft);
    const textCells = l.cells.filter(c => !amts.includes(c));
    let text = textCells.map(c => c.s).join(" ").trim();
    const dt = leadingDate(text);
    let date = null;
    if (dt) {
      date = withYear(dt, anchor); text = text.slice(dt.len).replace(/^[\s,.-]+/, "");
      const dt2 = leadingDate(text); if (dt2) text = text.slice(dt2.len).replace(/^[\s,.-]+/, "");   // posting date
    }
    const T = up(text);
    if (amts.length && OPEN_RE.test(T)) { const v = pdfAmount(amts[amts.length - 1].s); if (opening == null) opening = v; prevBal = v; continue; }
    if (amts.length && CLOSE_RE.test(T)) { if (closing == null) closing = pdfAmount(amts[amts.length - 1].s); continue; }
    if (!amts.length) {
      // a description that wraps onto the next line
      if (!dt && lastTx && lastTx.page === l.page && l.y - lastTx.y < 15 && lastTx.extra < 2 && text && !PDF_SKIP.test(T) && !AMT.test(text)) { lastTx.row.desc += "  " + text; lastTx.extra++; lastTx.y = l.y; }
      else if (dt) lastDate = date;
      continue;
    }
    if (!text || PDF_SKIP.test(T)) { if (amts.length && /BALANCE/.test(T)) prevBal = pdfAmount(amts[amts.length - 1].s); continue; }
    if (!date) {
      // banks often print the date once per day
      const inTable = (cols && colsPage === l.page) || (lastTx && lastTx.page === l.page);
      if (!lastDate || !inTable) continue;
      date = lastDate;
    }
    lastDate = date;
    // which number is the transaction and which is the running balance
    let amt = null, bal = null, side = null;
    const near = c => { if (!cols) return null; const x = (c.x + c.x2) / 2, opts = [["w", cols.w], ["d", cols.d], ["b", cols.b], ["a", cols.a]].filter(o => o[1] != null); opts.sort((p, q) => Math.abs(p[1] - x) - Math.abs(q[1] - x)); return opts[0] ? opts[0][0] : null; };
    amts.forEach(c => { const k = near(c), v = pdfAmount(c.s); if (k === "b") bal = v; else if (amt == null) { amt = v; side = k; } });
    if (amt == null || amt === 0) continue;
    if (!cols && amts.length >= 2) { bal = pdfAmount(amts[amts.length - 1].s); amt = pdfAmount(amts[0].s); }
    let out;   // + = money out
    const neg = amt < 0;
    if (side === "w") out = Math.abs(amt); else if (side === "d") out = -Math.abs(amt);
    else out = meta.type === "card" ? amt : (neg ? -amt : amt);   // cards: purchases positive, credits negative or "CR"
    if (bal != null && prevBal != null) {
      if (Math.abs(prevBal - Math.abs(amt) - bal) < 0.011) out = Math.abs(amt); else if (Math.abs(prevBal + Math.abs(amt) - bal) < 0.011) out = -Math.abs(amt);
    }
    if (bal != null) prevBal = bal;
    const row = { date, desc: text, amount: Math.round(out * 100) / 100, type: meta.type, line: rows.length + 1 };
    rows.push(row); lastTx = { row, page: l.page, y: l.y, extra: 0 };
  }
  // Does it add up to the statement's own totals?
  let check = null;
  if (opening != null && closing != null && rows.length) {
    const net = rows.reduce((a, r) => a + r.amount, 0);
    const expect = meta.type === "card" ? Math.abs(opening) + net : opening - net;
    check = { opening, closing, expect: Math.round(expect * 100) / 100, ok: Math.abs(Math.abs(expect) - Math.abs(closing)) < 0.006 };
  }
  const name = meta.bank === "Amex" ? "Amex" : clean([meta.bank, meta.kind].filter(Boolean).join(" "));
  meta.account = clean([name, meta.bank === "Amex" ? "" : meta.last4].join(" ")) || "";
  meta.signature = "pdf:" + up([meta.bank, meta.kind, meta.last4].join("|"));
  return { rows, meta, check };
}

const api = { CATEGORIES, CAT, KINDS, PRESETS, parseCSV, parseDate, parseAmount, guessOrder, detectLayout, readRows, signatureOf,
  merchantKey, displayName, payeeOf, classify, builtinCategory, importHashes, hashOf,
  parsePdf, leadingDate, splitChexy, CHEXY_FEE, paydays, monthIncome, monthStats, projection, planDue, planStatus, addMonth, daysIn, addDays, mKey, pad };
root.SpendEngine = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
