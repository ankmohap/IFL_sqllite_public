import { useState, useEffect, useCallback } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const ADMIN_TOKEN_STORAGE_KEY = "ifl_admin_token";
const USER_TOKEN_STORAGE_KEY = "ifl_user_token";
const LANGUAGE_STORAGE_KEY = "ifl_language";
const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
const APP_BUILD_TIME = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : new Date().toISOString();
const APP_BUILD_TIME_LABEL = new Date(APP_BUILD_TIME).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const SESSION_TTL_MS = 15 * 60 * 1000;
const DEFAULT_GLOBAL_TEAM_CODE = "IFL2026";
const TEAM_ABBR_ALIAS = { KXIP: "PBKS" };
const LEAGUE_TIMEZONE = "Asia/Kolkata";
const LEAGUE_UTC_OFFSET_MINUTES = 330;
const SUPPORTED_LANGUAGES = ["en", "hi"];
const HOME_REACTION_QUEUE_PREFIX = "ifl_home_reaction_queue_";
const HOME_REACTION_SESSION_PREFIX = "ifl_home_reaction_session_";

const TEXT = {
  home: { en: "Home", hi: "होम" },
  predictions: { en: "Predictions", hi: "प्रेडिक्शंस" },
  playoffs_prediction: { en: "Playoffs Prediction", hi: "प्लेऑफ प्रेडिक्शन" },
  todays_edge: { en: "Today's Edge", hi: "आज का एज" },
  my_team: { en: "My Team", hi: "मेरी टीम" },
  super_swapper: { en: "Super Swapper", hi: "सुपर स्वैपर" },
  frozen_squads: { en: "Frozen Squads", hi: "फ्रोजन स्क्वॉड्स" },
  leaderboard: { en: "Leaderboard", hi: "लीडरबोर्ड" },
  rules: { en: "Rules", hi: "नियम" },
  user_manual: { en: "User Manual", hi: "यूज़र मैनुअल" },
  profile: { en: "Profile", hi: "प्रोफाइल" },
  dashboard: { en: "Dashboard", hi: "डैशबोर्ड" },
  players: { en: "Players", hi: "प्लेयर" },
  matches: { en: "Matches", hi: "मैच" },
  scoring: { en: "Scoring", hi: "स्कोरिंग" },
  users: { en: "Users", hi: "यूज़र" },
  user_points: { en: "User Points", hi: "यूज़र पॉइंट्स" },
  playoffs_picks: { en: "Playoffs Picks", hi: "प्लेऑफ पिक्स" },
  swap_validation: { en: "Swap Validation", hi: "स्वैप वैलिडेशन" },
  access: { en: "Access", hi: "एक्सेस" },
  english: { en: "English", hi: "English" },
  hindi: { en: "हिंदी", hi: "हिंदी" },
  back_to_login: { en: "Back to Login", hi: "लॉगिन पर वापस जाएं" },
  logout: { en: "Logout", hi: "लॉगआउट" },
  login_time: { en: "Login Time", hi: "लॉगिन समय" },
  admin_control_panel: { en: "Admin Control Panel", hi: "एडमिन कंट्रोल पैनल" },
  administration_title: { en: "IFL 2026 — Administration", hi: "IFL 2026 — एडमिनिस्ट्रेशन" },
  fantasy_league_edition: { en: "Fantasy League 2026", hi: "फैंटेसी लीग 2026" },
  season_active: { en: "Season Active", hi: "सीज़न चालू" },
  enter_the_game: { en: "Enter the Game", hi: "गेम में प्रवेश करें" },
  create_team: { en: "Create Team", hi: "टीम बनाएं" },
  guest_demo: { en: "Guest Demo", hi: "गेस्ट डेमो" },
  predict_the_winners: { en: "Predict the winners", hi: "विजेता चुनें" },
  follow_the_race: { en: "Follow the race", hi: "रेस को फॉलो करें" },
  own_the_leaderboard: { en: "Own the leaderboard", hi: "लीडरबोर्ड पर छा जाएं" },
  indian_fantasy_league_ipl: { en: "Indian Fantasy League · IPL Edition", hi: "इंडियन फैंटेसी लीग · IPL एडिशन" },
  login: { en: "Login", hi: "लॉगिन" },
  register: { en: "Register", hi: "रजिस्टर" },
  phone_number: { en: "Phone Number", hi: "फोन नंबर" },
  your_phone_number: { en: "Your phone number", hi: "अपना फोन नंबर" },
  password: { en: "Password", hi: "पासवर्ड" },
  team_code: { en: "Team Code", hi: "टीम कोड" },
  enter_team_code: { en: "Enter team code provided by admin", hi: "एडमिन द्वारा दिया गया टीम कोड दर्ज करें" },
  check_team_code: { en: "Please check the team code with admin before registering.", hi: "रजिस्टर करने से पहले एडमिन से टीम कोड जरूर जांच लें।" },
  fantasy_team_name: { en: "Fantasy Team Name", hi: "फैंटेसी टीम नाम" },
  fantasy_team_placeholder: { en: "Add your new team name (e.g. Bengal Bewdas)", hi: "अपनी नई टीम का नाम लिखें" },
  please_wait: { en: "Please wait...", hi: "कृपया प्रतीक्षा करें..." },
  create_account: { en: "Create Account", hi: "अकाउंट बनाएं" },
  go_admin_panel: { en: "Go to Admin Panel →", hi: "एडमिन पैनल पर जाएं →" },
  open_user_manual: { en: "Open User Manual →", hi: "यूज़र मैनुअल खोलें →" },
  administrative_control_panel: { en: "Administrative Control Panel", hi: "एडमिनिस्ट्रेटिव कंट्रोल पैनल" },
  access_admin_panel: { en: "Access Admin Panel", hi: "एडमिन पैनल खोलें" },
  signing_in: { en: "Signing in...", hi: "साइन इन हो रहा है..." },
  go_player_login: { en: "Go to Player Login →", hi: "प्लेयर लॉगिन पर जाएं →" },
  next_match_loading: { en: "Next match loading", hi: "अगला मैच लोड हो रहा है" },
  leaderboard_opening_soon: { en: "Leaderboard opening soon", hi: "लीडरबोर्ड जल्द शुरू होगा" },
  team_name: { en: "Team Name", hi: "टीम नाम" },
  enter_your_team_name: { en: "Enter your team name", hi: "अपनी टीम का नाम दर्ज करें" },
  update_team_name: { en: "Update Team Name", hi: "टीम नाम अपडेट करें" },
  team_logo: { en: "Team Logo", hi: "टीम लोगो" },
  logo_recommended: { en: "Recommended: square image 300x300 px or above. Max upload size: 2MB. Stored as optimized 256x256 for fast leaderboard loading.", hi: "सुझाव: 300x300 px या उससे बड़ी square image. अधिकतम upload size: 2MB. तेज leaderboard loading के लिए 256x256 में optimize होकर store होगी." },
  uploading: { en: "Uploading...", hi: "अपलोड हो रहा है..." },
  change_logo: { en: "Change Logo", hi: "लोगो बदलें" },
  upload_logo: { en: "Upload Logo", hi: "लोगो अपलोड करें" },
  remove_logo: { en: "Remove Logo", hi: "लोगो हटाएं" },
  points: { en: "Points", hi: "पॉइंट्स" },
  squad_size: { en: "Squad Size", hi: "स्क्वॉड साइज" },
  correct_picks: { en: "Correct Picks", hi: "सही पिक्स" },
  accuracy: { en: "Accuracy", hi: "एक्युरेसी" },
  total_points: { en: "Total Points", hi: "कुल पॉइंट्स" },
  current_rank: { en: "Current Rank", hi: "मौजूदा रैंक" },
  matches_scored: { en: "Matches Scored", hi: "स्कोर किए गए मैच" },
  bulletin_board: { en: "Bulletin Board", hi: "बुलेटिन बोर्ड" },
  rankings: { en: "Rankings", hi: "रैंकिंग्स" },
  more_actions: { en: "More Actions", hi: "और विकल्प" },
  make_predictions: { en: "Make Predictions", hi: "प्रेडिक्शन करें" },
  view_profile: { en: "View Profile", hi: "प्रोफाइल देखें" },
  current_leader: { en: "Current Leader", hi: "मौजूदा लीडर" },
  next_up: { en: "Next Up", hi: "अगला मुकाबला" },
  your_rank: { en: "Your Rank", hi: "आपकी रैंक" },
  leader: { en: "Leader", hi: "लीडर" },
  prediction_ratio: { en: "Prediction Ratio", hi: "प्रेडिक्शन रेशियो" },
  view_predictions: { en: "View Predictions", hi: "प्रेडिक्शन देखें" },
  latest_locked_prediction_ratio: { en: "Latest available locked prediction ratio.", hi: "सबसे नया locked prediction ratio." },
  predictions_board: { en: "Predictions", hi: "प्रेडिक्शंस" },
  gap_watch: { en: "Gap Watch", hi: "गैप वॉच" },
  upcoming_event: { en: "Upcoming Event", hi: "आगामी इवेंट" },
  player_pool: { en: "Player Pool", hi: "प्लेयर पूल" },
};

const translateText = (lang, key, fallback = "") => {
  const bucket = TEXT[key];
  if (!bucket) return fallback || key;
  return bucket[lang] || bucket.en || fallback || key;
};

const DEFAULT_PLAYERS = [
  { id: 1, team: "CSK", name: "MS Dhoni", role: "WK", country: "India" },
  { id: 2, team: "CSK", name: "Suresh Raina", role: "BAT", country: "India" },
  { id: 3, team: "CSK", name: "Faf du Plessis", role: "BAT", country: "SA" },
  { id: 4, team: "CSK", name: "Ambati Rayudu", role: "BAT", country: "India" },
  { id: 5, team: "CSK", name: "Shane Watson", role: "ALL", country: "AUS" },
  { id: 6, team: "CSK", name: "Kedar Jadhav", role: "ALL", country: "India" },
  { id: 7, team: "CSK", name: "R Jadeja", role: "ALL", country: "India" },
  { id: 8, team: "CSK", name: "Dwayne Bravo", role: "ALL", country: "WI" },
  { id: 9, team: "CSK", name: "Imran Tahir", role: "BOWL", country: "SA" },
  { id: 10, team: "CSK", name: "Harbhajan Singh", role: "BOWL", country: "India" },
  { id: 11, team: "CSK", name: "Deepak Chahar", role: "BOWL", country: "India" },
  { id: 12, team: "CSK", name: "Sam Billings", role: "WK", country: "ENG" },
  { id: 13, team: "MI", name: "Rohit Sharma", role: "BAT", country: "India" },
  { id: 14, team: "MI", name: "Hardik Pandya", role: "ALL", country: "India" },
  { id: 15, team: "MI", name: "Kieron Pollard", role: "ALL", country: "WI" },
  { id: 16, team: "MI", name: "Quinton de Kock", role: "WK", country: "SA" },
  { id: 17, team: "MI", name: "Jasprit Bumrah", role: "BOWL", country: "India" },
  { id: 18, team: "MI", name: "Lasith Malinga", role: "BOWL", country: "SL" },
  { id: 19, team: "MI", name: "Suryakumar Yadav", role: "BAT", country: "India" },
  { id: 20, team: "MI", name: "Ishan Kishan", role: "WK", country: "India" },
  { id: 21, team: "RCB", name: "Virat Kohli", role: "BAT", country: "India" },
  { id: 22, team: "RCB", name: "AB de Villiers", role: "WK", country: "SA" },
  { id: 23, team: "RCB", name: "Chris Gayle", role: "BAT", country: "WI" },
  { id: 24, team: "RCB", name: "Yuzvendra Chahal", role: "BOWL", country: "India" },
  { id: 25, team: "RCB", name: "Dale Steyn", role: "BOWL", country: "SA" },
  { id: 26, team: "RCB", name: "Marcus Stoinis", role: "ALL", country: "AUS" },
  { id: 27, team: "RCB", name: "Parthiv Patel", role: "WK", country: "India" },
  { id: 28, team: "KKR", name: "Dinesh Karthik", role: "WK", country: "India" },
  { id: 29, team: "KKR", name: "Andre Russell", role: "ALL", country: "WI" },
  { id: 30, team: "KKR", name: "Sunil Narine", role: "ALL", country: "WI" },
  { id: 31, team: "KKR", name: "Shubman Gill", role: "BAT", country: "India" },
  { id: 32, team: "KKR", name: "Kuldeep Yadav", role: "BOWL", country: "India" },
  { id: 33, team: "SRH", name: "David Warner", role: "BAT", country: "AUS" },
  { id: 34, team: "SRH", name: "Jonny Bairstow", role: "WK", country: "ENG" },
  { id: 35, team: "SRH", name: "Kane Williamson", role: "BAT", country: "NZ" },
  { id: 36, team: "SRH", name: "Rashid Khan", role: "BOWL", country: "AFG" },
  { id: 37, team: "SRH", name: "Bhuvneshwar Kumar", role: "BOWL", country: "India" },
  { id: 38, team: "SRH", name: "Vijay Shankar", role: "ALL", country: "India" },
  { id: 39, team: "DC", name: "Rishabh Pant", role: "WK", country: "India" },
  { id: 40, team: "DC", name: "Shikhar Dhawan", role: "BAT", country: "India" },
  { id: 41, team: "DC", name: "Shreyas Iyer", role: "BAT", country: "India" },
  { id: 42, team: "DC", name: "Kagiso Rabada", role: "BOWL", country: "SA" },
  { id: 43, team: "DC", name: "Axar Patel", role: "ALL", country: "India" },
  { id: 44, team: "RR", name: "Sanju Samson", role: "WK", country: "India" },
  { id: 45, team: "RR", name: "Jos Buttler", role: "WK", country: "ENG" },
  { id: 46, team: "RR", name: "Ben Stokes", role: "ALL", country: "ENG" },
  { id: 47, team: "RR", name: "Jofra Archer", role: "BOWL", country: "ENG" },
  { id: 48, team: "RR", name: "Steve Smith", role: "BAT", country: "AUS" },
  { id: 49, team: "KXIP", name: "Lokesh Rahul", role: "WK", country: "India" },
  { id: 50, team: "KXIP", name: "Chris Gayle", role: "BAT", country: "WI" },
  { id: 51, team: "KXIP", name: "David Miller", role: "BAT", country: "SA" },
  { id: 52, team: "KXIP", name: "R Ashwin", role: "ALL", country: "India" },
  { id: 53, team: "KXIP", name: "Mohammed Shami", role: "BOWL", country: "India" },
  { id: 54, team: "KXIP", name: "Mayank Agarwal", role: "BAT", country: "India" },
];

const DEFAULT_MATCHES = [];

const IPL_TEAM_COLORS = {
  CSK: { bg: "#f5a623", text: "#1a1a2e" }, MI: { bg: "#004BA0", text: "#fff" },
  RCB: { bg: "#D41A1A", text: "#fff" }, KKR: { bg: "#3A225D", text: "#B3A123" },
  SRH: { bg: "#FF6B00", text: "#fff" }, DC: { bg: "#17479E", text: "#D71920" },
  RR: { bg: "#EA1A85", text: "#fff" }, KXIP: { bg: "#D71920", text: "#ccc" },
  PBKS: { bg: "#D71920", text: "#fff" }, GT: { bg: "#1C2C5B", text: "#fff" },
  LSG: { bg: "#00AEEF", text: "#1a1a1a" },
};
const ROLE_COLORS = { WK: "#f39c12", BAT: "#27ae60", BOWL: "#2980b9", ALL: "#8e44ad" };
const ROLE_LABELS = { WK: "Wicket Keeper", BAT: "Batsman", BOWL: "Bowler", ALL: "All-rounder" };
const ROLE_FILTER_ANY = "__ANY_ROLE__";
const ALL_IPL_TEAMS = [
  { name: "Chennai Super Kings", abbr: "CSK" }, { name: "Mumbai Indians", abbr: "MI" },
  { name: "Royal Challengers Bangalore", abbr: "RCB" }, { name: "Kolkata Knight Riders", abbr: "KKR" },
  { name: "Sunrisers Hyderabad", abbr: "SRH" }, { name: "Delhi Capitals", abbr: "DC" },
  { name: "Rajasthan Royals", abbr: "RR" }, { name: "Punjab Kings", abbr: "PBKS" },
  { name: "Gujarat Titans", abbr: "GT" },
  { name: "Lucknow Super Giants", abbr: "LSG" },
];

// ─── STORAGE (API-BACKED) ────────────────────────────────────────────────────
const STORE_DEFAULTS = {
  ifl_users: {},
  ifl_master_players: DEFAULT_PLAYERS,
  ifl_master_matches: DEFAULT_MATCHES,
  ifl_match_stats: {},
  ifl_swap_windows: [],
  ifl_playoffs_predictions: {},
  ifl_allowed_phones: [],
  ifl_global_team_code: DEFAULT_GLOBAL_TEAM_CODE,
};

let DB_CACHE = { ...STORE_DEFAULTS };
let VERSION_CACHE = {};
const SAVE_CHAINS = {};
const RESYNC_INTERVAL_MS = 45 * 1000;
const canonicalTeamAbbr = (abbr) => TEAM_ABBR_ALIAS[String(abbr || "").toUpperCase()] || String(abbr || "").toUpperCase();

const normalizeMatchDateTime = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw} 00:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw.slice(0, 16).replace("T", " ");
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)) return raw;
  return raw;
};

const toDateTimeInputValue = (value) => normalizeMatchDateTime(value).replace(" ", "T");
const fromDateTimeInputValue = (value) => normalizeMatchDateTime(String(value || "").replace("T", " "));

const formatLeagueDateTime = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LEAGUE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
};

const parseLocalDateTime = (value) => {
  const raw = normalizeMatchDateTime(value);
  const m = String(raw || "").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m.map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, hh, mm, 0, 0) - LEAGUE_UTC_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMs);
};

const CHECKPOINT_1 = "2026-03-17 00:00";
const SWAP_WINDOW_DAYS = 7;
const CHECKPOINT_1_TS = parseLocalDateTime(CHECKPOINT_1);
const SWAP_WINDOW_START_1_TS = CHECKPOINT_1_TS
  ? new Date(CHECKPOINT_1_TS.getTime() - SWAP_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  : null;

const isInSwapWindow1 = (now = new Date()) => {
  if (!CHECKPOINT_1_TS || !SWAP_WINDOW_START_1_TS) return false;
  return now >= SWAP_WINDOW_START_1_TS && now < CHECKPOINT_1_TS;
};

const isAfterCheckpoint1 = (matchDate) => {
  if (!CHECKPOINT_1_TS) return false;
  const dt = parseLocalDateTime(matchDate);
  if (!dt) return false;
  return dt >= CHECKPOINT_1_TS;
};

const nowLocalMatchTs = () => {
  return formatLeagueDateTime(new Date());
};

const PREDICTION_LOCK_MINUTES = 30;

const getPredictionLockTs = (matchDate) => {
  const dt = parseLocalDateTime(matchDate);
  if (!dt) return "";
  const lockDt = new Date(dt.getTime() - PREDICTION_LOCK_MINUTES * 60 * 1000);
  return formatLeagueDateTime(lockDt);
};

const isPredictionClosed = (matchDate, nowTs = nowLocalMatchTs()) => {
  const lockTs = getPredictionLockTs(matchDate);
  if (!lockTs) return true;
  return lockTs <= nowTs;
};

const normalizeStore = (store = {}) => ({
  ifl_users: store.ifl_users || {},
  ifl_master_players: Array.isArray(store.ifl_master_players) && store.ifl_master_players.length > 0
    ? store.ifl_master_players.map((p) => ({ ...p, team: canonicalTeamAbbr(p.team) }))
    : DEFAULT_PLAYERS.map((p) => ({ ...p, team: canonicalTeamAbbr(p.team) })),
  ifl_master_matches: Array.isArray(store.ifl_master_matches) && store.ifl_master_matches.length > 0
    ? (() => {
      const normalized = store.ifl_master_matches.map((m) => ({
        ...m,
        date: normalizeMatchDateTime(m.date),
        teamAabbr: canonicalTeamAbbr(m.teamAabbr),
        teamBabbr: canonicalTeamAbbr(m.teamBabbr),
        winner: m.winner ? canonicalTeamAbbr(m.winner) : "",
      }));
      const hasLSG = normalized.some((m) => canonicalTeamAbbr(m.teamAabbr) === "LSG" || canonicalTeamAbbr(m.teamBabbr) === "LSG");
      if (hasLSG) return normalized;
      const nextId = normalized.reduce((mx, m) => Math.max(mx, Number(m.id) || 0), 0) + 1;
      return [
        ...normalized,
        { id: nextId, date: "2026-02-18 19:30", teamA: "Lucknow Super Giants", teamAabbr: "LSG", teamB: "Gujarat Titans", teamBabbr: "GT", venue: "Lucknow", winner: "" },
      ];
    })()
    : DEFAULT_MATCHES,
  ifl_match_stats: store.ifl_match_stats && typeof store.ifl_match_stats === "object" ? store.ifl_match_stats : {},
  ifl_swap_windows: Array.isArray(store.ifl_swap_windows) ? store.ifl_swap_windows : [],
  ifl_playoffs_predictions: store.ifl_playoffs_predictions && typeof store.ifl_playoffs_predictions === "object" ? store.ifl_playoffs_predictions : {},
  ifl_allowed_phones: Array.isArray(store.ifl_allowed_phones) ? store.ifl_allowed_phones.map(x => String(x)) : [],
  ifl_global_team_code: normalizeTeamCode(store.ifl_global_team_code || DEFAULT_GLOBAL_TEAM_CODE),
});

async function bootstrapStore(opts = {}) {
  try {
    const headers = {};
    const token = opts.adminToken || opts.userToken || "";
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await fetch("/api/bootstrap", { headers });
    if (!r.ok) throw new Error("bootstrap failed");
    const data = await r.json();
    DB_CACHE = normalizeStore(data.store || {});
    if (data?.versions && typeof data.versions === "object") {
      VERSION_CACHE = { ...VERSION_CACHE, ...data.versions };
    }
  } catch {
    DB_CACHE = { ...STORE_DEFAULTS };
  }
}

const save = (k, v, opts = {}) => {
  DB_CACHE[k] = v;
  const prev = SAVE_CHAINS[k] || Promise.resolve();
  const next = prev.then(async () => {
    // Resolve version at send-time (not queue-time) so chained writes use latest ACKed version.
    const headers = { "Content-Type": "application/json" };
    if (opts.adminToken) headers.Authorization = `Bearer ${opts.adminToken}`;
    const expectedVersion = opts.expectedVersion || VERSION_CACHE[k];
    if (expectedVersion) headers["X-Store-Version"] = expectedVersion;

    const res = await fetch(`/api/store/${k}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ value: v }),
    });
    let body = {};
    try { body = await res.json(); } catch { body = {}; }
    if (res.ok && body?.version) {
      VERSION_CACHE[k] = String(body.version);
    } else if (res.status === 409) {
      if (body?.currentVersion) VERSION_CACHE[k] = String(body.currentVersion);
      if (Object.prototype.hasOwnProperty.call(body || {}, "currentValue")) {
        DB_CACHE[k] = body.currentValue;
      }
    }
    return { ok: res.ok, status: res.status, body };
  }).catch(() => null);
  SAVE_CHAINS[k] = next;
  return next;
};

async function saveStrict(k, v, opts = {}) {
  const res = await save(k, v, opts);
  if (!res) throw new Error(`Failed to persist ${k}`);
  const body = res.body || {};
  if (res.status === 409) {
    if (body?.currentVersion) VERSION_CACHE[k] = String(body.currentVersion);
    if (Object.prototype.hasOwnProperty.call(body || {}, "currentValue")) {
      DB_CACHE[k] = body.currentValue;
    }
    const err = new Error(body?.error || "Stale data. Reload and retry.");
    err.code = "STALE_WRITE";
    throw err;
  }
  if (!res.ok) throw new Error(body?.error || `Failed to persist ${k}`);
}

async function adminLogin(username, password) {
  const r = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  let data = {};
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok || !data?.token) {
    throw new Error(data?.error || "Admin login failed");
  }
  return data;
}

async function userLogin(username, password, teamCode) {
  const r = await fetch("/api/user/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, team_code: teamCode }),
  });
  let data = {};
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data?.error || data?.detail || "User login failed");
  return data;
}

async function userRegister(username, password, teamName, teamCode) {
  const r = await fetch("/api/user/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, team_name: teamName, team_code: teamCode }),
  });
  let data = {};
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data?.error || data?.detail || "User registration failed");
  return data;
}

function userAuthHeaders(userToken, extra = {}) {
  const headers = { ...extra };
  if (userToken) headers.Authorization = `Bearer ${userToken}`;
  return headers;
}

async function verifyAdminSession(token) {
  const r = await fetch("/api/admin/session", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return false;
  return true;
}

async function adminDeleteUser(username, adminToken) {
  const headers = {};
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  const r = await fetch(`/api/admin/users/${encodeURIComponent(String(username || ""))}`, {
    method: "DELETE",
    headers,
  });
  let data = {};
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data?.error || "Failed to delete user");
  return data;
}

async function fetchAdminSwaps(adminToken) {
  const headers = {};
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  const r = await fetch("/api/admin/swaps", { headers });
  let data = {};
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data?.error || data?.detail || "Failed to load swaps");
  return data;
}

async function submitUserPrediction(userToken, matchId, pick) {
  const r = await fetch("/api/user/prediction", {
    method: "POST",
    headers: userAuthHeaders(userToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ match_id: matchId, pick }),
  });
  let data = {};
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data?.error || data?.detail || "Failed to save prediction");
  return data;
}

async function adminValidateSwaps(adminToken, username, windowId) {
  const headers = { "Content-Type": "application/json" };
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  const r = await fetch("/api/admin/swaps/validate", {
    method: "POST",
    headers,
    body: JSON.stringify({ username, window_id: windowId }),
  });
  let data = {};
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data?.error || data?.detail || "Failed to validate swaps");
  return data;
}

async function adminRejectSwaps(adminToken, username, windowId) {
  const headers = { "Content-Type": "application/json" };
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  const r = await fetch("/api/admin/swaps/reject", {
    method: "POST",
    headers,
    body: JSON.stringify({ username, window_id: windowId }),
  });
  let data = {};
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data?.error || data?.detail || "Failed to reject swaps");
  return data;
}

async function adminUpdateUserPoints(adminToken, points) {
  const headers = { "Content-Type": "application/json" };
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  const r = await fetch("/api/admin/users/points", {
    method: "POST",
    headers,
    body: JSON.stringify({ points }),
  });
  let data = {};
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data?.error || data?.detail || "Failed to update user points");
  return data;
}

async function adminRecomputeUserPoints(adminToken) {
  const headers = {};
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  const r = await fetch("/api/admin/recompute-points", {
    method: "POST",
    headers,
  });
  let data = {};
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data?.error || data?.detail || "Failed to recompute user points");
  return data;
}

async function downloadPlayoffsPredictions(adminToken) {
  const r = await fetch("/api/admin/exports/playoffs-predictions", {
    headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
  });
  if (!r.ok) {
    let msg = "Failed to export playoffs predictions";
    try {
      const data = await r.json();
      msg = data?.error || data?.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  const blob = await r.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "playoffs-predictions.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

async function fetchUserSwaps(userToken, windowId) {
  const r = await fetch("/api/user/swaps/list", {
    method: "POST",
    headers: userAuthHeaders(userToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ window_id: windowId }),
  });
  let data = {};
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data?.error || data?.detail || "Failed to load swaps");
  return data;
}

async function freezeUserSwaps(userToken, windowId) {
  const r = await fetch("/api/user/swaps/freeze", {
    method: "POST",
    headers: userAuthHeaders(userToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ window_id: windowId }),
  });
  let data = {};
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data?.error || data?.detail || "Failed to freeze swaps");
  return data;
}

async function updateCurrentUser(userToken, patch) {
  const r = await fetch("/api/user/update", {
    method: "POST",
    headers: userAuthHeaders(userToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ patch }),
  });
  let data = {};
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data?.error || data?.detail || "Failed to update user");
  return data;
}

async function generateAdminScoringDraft(adminToken, matchId) {
  const r = await fetch("/api/admin/scoring/draft-json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ match_id: Number(matchId) }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || data?.error || "Failed to generate AI scoring draft");
  return data;
}

async function askIflGuru(userToken, question) {
  const r = await fetch("/api/user/ifl-guru", {
    method: "POST",
    headers: userAuthHeaders(userToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ question }),
  });
  let data = {};
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data?.error || data?.detail || "IFL GURU is unavailable right now");
  return data;
}

async function fetchPrevRankMap(dateStr = "") {
  const params = new URLSearchParams();
  if (dateStr) params.set("date", dateStr);
  const r = await fetch(`/api/leaderboard/prev-ranks?${params.toString()}`);
  let data = {};
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data?.error || data?.detail || "Failed to load prev ranks");
  return data?.ranks || {};
}

async function downloadAdminLeaderboardExport(adminToken, date = "", fmt = "csv") {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  params.set("fmt", fmt || "csv");
  const r = await fetch(`/api/admin/exports/leaderboard/daily?${params.toString()}`, {
    headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
  });
  if (!r.ok) {
    let msg = "Failed to export leaderboard";
    try {
      const data = await r.json();
      msg = data?.error || data?.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  const blob = await r.blob();
  const cd = r.headers.get("Content-Disposition") || "";
  const match = cd.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || `leaderboard-export.${fmt === "json" ? "json" : "csv"}`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function detectBrowser(ua = "") {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return "Opera";
  return "Other";
}

function detectOS(ua = "", platform = "") {
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua) || /Win/i.test(platform)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(ua) || /Mac/i.test(platform)) return "macOS";
  if (/Linux/i.test(ua) || /Linux/i.test(platform)) return "Linux";
  return "Other";
}

function getLoginDeviceMeta() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const width = window.innerWidth || 0;
  const height = window.innerHeight || 0;
  const isMobile = /Android|iPhone|iPod|Mobile/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua) || (width >= 768 && width <= 1180 && /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  return {
    device_type: isMobile ? "mobile" : isTablet ? "tablet" : "desktop",
    browser: detectBrowser(ua),
    os: detectOS(ua, platform),
    platform,
    language: navigator.language || "",
    screen_width: width || null,
    screen_height: height || null,
    user_agent: ua,
  };
}

async function logUserLoginAudit(userToken) {
  const r = await fetch("/api/user/login-audit", {
    method: "POST",
    headers: userAuthHeaders(userToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ login_meta: getLoginDeviceMeta() }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data?.detail || data?.error || "Failed to log login audit");
  }
  return r.json().catch(() => ({ ok: true }));
}

function getHomeReactionQueueKey(username) {
  return `${HOME_REACTION_QUEUE_PREFIX}${username || "guest"}`;
}

function getHomeReactionSessionKey(username) {
  return `${HOME_REACTION_SESSION_PREFIX}${username || "guest"}`;
}

function getOrCreateHomeReactionSessionId(username) {
  const storageKey = getHomeReactionSessionKey(username);
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const next = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(storageKey, next);
    return next;
  } catch {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function cacheHomeReactionClick(username, event) {
  if (!username || typeof window === "undefined") return;
  const queueKey = getHomeReactionQueueKey(username);
  const sessionId = getOrCreateHomeReactionSessionId(username);
  try {
    const existing = JSON.parse(window.sessionStorage.getItem(queueKey) || "[]");
    const queue = Array.isArray(existing) ? existing : [];
    queue.push({ ...event, session_id: sessionId });
    window.sessionStorage.setItem(queueKey, JSON.stringify(queue.slice(-500)));
  } catch {}
}

async function flushHomeReactionAnalytics(userToken, username) {
  if (!userToken || !username || typeof window === "undefined") return { ok: true, written: 0 };
  const queueKey = getHomeReactionQueueKey(username);
  const sessionKey = getHomeReactionSessionKey(username);
  let events = [];
  try {
    events = JSON.parse(window.sessionStorage.getItem(queueKey) || "[]");
  } catch {
    events = [];
  }
  if (!Array.isArray(events) || events.length === 0) return { ok: true, written: 0 };
  const sessionId = String(window.sessionStorage.getItem(sessionKey) || events[0]?.session_id || "").trim();
  const sanitizedEvents = events
    .filter((e) => e && typeof e === "object")
    .map((e) => ({
      reaction_id: String(e.reaction_id || "").slice(0, 40),
      reaction_text: String(e.reaction_text || "").slice(0, 2000),
      emoji: String(e.emoji || "").slice(0, 16),
      favorite_team: String(e.favorite_team || "").slice(0, 10).toUpperCase(),
      rival_team: String(e.rival_team || "").slice(0, 10).toUpperCase(),
      clicked_at: String(e.clicked_at || ""),
    }))
    .filter((e) => e.reaction_id);
  if (sanitizedEvents.length === 0) {
    window.sessionStorage.removeItem(queueKey);
    window.sessionStorage.removeItem(sessionKey);
    return { ok: true, written: 0 };
  }
  const r = await fetch("/api/user/home-reaction-analytics", {
    method: "POST",
    headers: userAuthHeaders(userToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ session_id: sessionId || null, events: sanitizedEvents }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || data?.error || "Failed to flush home reaction analytics");
  window.sessionStorage.removeItem(queueKey);
  window.sessionStorage.removeItem(sessionKey);
  return data;
}

async function fetchAdminLoginAudit(adminToken, limit = 100) {
  const r = await fetch(`/api/admin/login-audit?limit=${Math.max(1, Math.min(500, Number(limit) || 100))}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || data?.error || "Failed to load login audit");
  return data;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] || ch));
}

function resolveUserSwapRows(u, swapWindows = []) {
  const rows = [];
  if (u?.swapWindows && typeof u.swapWindows === "object") {
    Object.entries(u.swapWindows).forEach(([wid, val]) => {
      const w = swapWindows.find((sw) => String(sw.id) === String(wid));
      const eff = Number(w?.effective_match_id || 0);
      const out = (val?.out || []).map(Number);
      const ins = (val?.in || []).map(Number);
      if (eff > 0 && out.length && ins.length) rows.push({ eff, out, ins });
    });
  } else if ((u?.swap1Out || []).length || (u?.swap1In || []).length) {
    const eff = Number(swapWindows[0]?.effective_match_id || 0);
    rows.push({ eff, out: (u.swap1Out || []).map(Number), ins: (u.swap1In || []).map(Number) });
  }
  return rows.sort((a, b) => a.eff - b.eff);
}

function effectiveSquadIdsForMatch(baseIds = [], swapRows = [], matchId = 0) {
  const set = new Set((baseIds || []).map(Number));
  swapRows.forEach((row) => {
    if (Number(matchId) >= Number(row.eff || 0)) {
      (row.out || []).forEach((pid) => set.delete(Number(pid)));
      (row.ins || []).forEach((pid) => set.add(Number(pid)));
    }
  });
  return set;
}

function buildWhatCanChangeToday(rows = [], users = {}, matches = [], swapWindows = [], players = []) {
  const nowTs = nowLocalMatchTs();
  const targetMatch = matches
    .filter((m) => !m.winner && normalizeMatchDateTime(m.date).slice(0, 10) === nowTs.slice(0, 10))
    .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)))[0]
    || matches
      .filter((m) => !m.winner && normalizeMatchDateTime(m.date) >= nowTs)
      .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)))[0];
  if (!targetMatch || rows.length < 2) return null;

  const playerById = new Map(players.map((p) => [Number(p.id), p]));
  const ranked = [...rows].sort((a, b) => Number(b.points || 0) - Number(a.points || 0));
  const topA = ranked[0];
  const topB = ranked[1];
  const userA = users[topA.un] || {};
  const userB = users[topB.un] || {};
  const squadA = effectiveSquadIdsForMatch((userA.players || []).map(Number), resolveUserSwapRows(userA, swapWindows), Number(targetMatch.id));
  const squadB = effectiveSquadIdsForMatch((userB.players || []).map(Number), resolveUserSwapRows(userB, swapWindows), Number(targetMatch.id));
  const matchTeamIds = new Set(
    players
      .filter((p) => p.team === targetMatch.teamAabbr || p.team === targetMatch.teamBabbr)
      .map((p) => Number(p.id))
  );
  const onlyA = [...squadA].filter((pid) => matchTeamIds.has(pid) && !squadB.has(pid)).map((pid) => playerById.get(pid)).filter(Boolean);
  const onlyB = [...squadB].filter((pid) => matchTeamIds.has(pid) && !squadA.has(pid)).map((pid) => playerById.get(pid)).filter(Boolean);
  const predA = userA.predictions?.[String(targetMatch.id)]?.pick || "";
  const predB = userB.predictions?.[String(targetMatch.id)]?.pick || "";
  const predictionSwingToB = predA && predB && predA !== predB ? 50 : 0;
  const currentGap = Number(topA.points || 0) - Number(topB.points || 0);
  const effectiveGapForB = Math.max(0, currentGap - predictionSwingToB);
  const playerNamesB = onlyB.map((p) => p.name);
  const playerNamesA = onlyA.map((p) => p.name);
  const uniqueBLabel = playerNamesB.length > 0 ? playerNamesB.join(", ") : `their unique ${targetMatch.teamAabbr}/${targetMatch.teamBabbr} picks`;
  const uniqueALabel = playerNamesA.length > 0 ? playerNamesA.join(", ") : `the Rank 1 exclusive picks`;
  let summary = `${topB.teamName} trails ${topA.teamName} by ${currentGap} points.`;
  if (predictionSwingToB > 0) {
    summary += ` If ${predB} wins, the prediction swing cuts the gap to ${effectiveGapForB}.`;
  }
  if (onlyB.length > 0 || onlyA.length > 0) {
    const needed = effectiveGapForB + 1;
    summary += ` From there, ${uniqueBLabel} need to outscore ${uniqueALabel} by ${needed}+ points for the lead to change.`;
  }
  return {
    match: targetMatch,
    leader: topA,
    chaser: topB,
    currentGap,
    predictionSwingToChaser: predictionSwingToB,
    effectiveGapToChaser: effectiveGapForB,
    leaderOnlyPlayers: onlyA,
    chaserOnlyPlayers: onlyB,
    summary,
  };
}

function getInsightTargetMatch(matches = []) {
  const nowTs = nowLocalMatchTs();
  return matches
    .filter((m) => !m.winner && normalizeMatchDateTime(m.date).slice(0, 10) === nowTs.slice(0, 10))
    .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)))[0]
    || matches
      .filter((m) => !m.winner && normalizeMatchDateTime(m.date) >= nowTs)
      .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)))[0]
    || null;
}

function getPlayersAtPlayMatches(matches = []) {
  const nowTs = nowLocalMatchTs();
  const today = nowTs.slice(0, 10);
  const todaysOpenMatches = matches
    .filter((m) => !m.winner && normalizeMatchDateTime(m.date).slice(0, 10) === today)
    .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)));
  if (todaysOpenMatches.length > 0) return todaysOpenMatches;
  const nextOpenMatch = matches
    .filter((m) => !m.winner && normalizeMatchDateTime(m.date) >= nowTs)
    .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)))[0];
  if (!nextOpenMatch) return [];
  const nextDate = normalizeMatchDateTime(nextOpenMatch.date).slice(0, 10);
  return matches
    .filter((m) => !m.winner && normalizeMatchDateTime(m.date).slice(0, 10) === nextDate)
    .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)));
}

function getLockedPredictionRatioMatches(matches = []) {
  const nowTs = nowLocalMatchTs();
  const today = nowTs.slice(0, 10);
  const todaysLocked = matches
    .filter((m) => normalizeMatchDateTime(m.date).slice(0, 10) === today && isPredictionClosed(m.date, nowTs))
    .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)));
  if (todaysLocked.length > 0) return todaysLocked;
  const latestLocked = [...matches]
    .filter((m) => isPredictionClosed(m.date, nowTs))
    .sort((a, b) => normalizeMatchDateTime(b.date).localeCompare(normalizeMatchDateTime(a.date)))[0];
  return latestLocked ? [latestLocked] : [];
}

function getPredictionRatioInsight(users = {}, matches = []) {
  const targetMatch = getInsightTargetMatch(matches);
  if (!targetMatch) {
    return {
      title: "Prediction Ratio",
      summary: "There is no active or upcoming match available right now.",
      bullets: [],
      metrics: [],
      bars: [],
    };
  }
  let a = 0;
  let b = 0;
  let pending = 0;
  Object.values(users).forEach((u) => {
    const pick = u?.predictions?.[String(targetMatch.id)]?.pick || "";
    if (pick === targetMatch.teamAabbr) a += 1;
    else if (pick === targetMatch.teamBabbr) b += 1;
    else pending += 1;
  });
  const total = Math.max(1, a + b + pending);
  const leader = a === b ? "Evenly split so far" : a > b ? `${targetMatch.teamAabbr} is leading the room` : `${targetMatch.teamBabbr} is leading the room`;
  return {
    title: "What is the prediction ratio for today's match?",
    summary: `For Match ${targetMatch.id} (${targetMatch.teamAabbr} vs ${targetMatch.teamBabbr}), ${leader}.`,
    bullets: [
      `${targetMatch.teamAabbr}: ${a} picks (${Math.round((a / total) * 100)}%)`,
      `${targetMatch.teamBabbr}: ${b} picks (${Math.round((b / total) * 100)}%)`,
      `Not predicted yet: ${pending} squads`,
    ],
    metrics: [
      { label: targetMatch.teamAabbr, value: a, tone: "accent" },
      { label: targetMatch.teamBabbr, value: b, tone: "ok" },
      { label: "Pending", value: pending, tone: "muted" },
    ],
    bars: [
      { label: targetMatch.teamAabbr, value: Math.round((a / total) * 100), tone: "accent" },
      { label: targetMatch.teamBabbr, value: Math.round((b / total) * 100), tone: "ok" },
      { label: "Pending", value: Math.round((pending / total) * 100), tone: "muted" },
    ],
  };
}

function getPlayersAtPlayInsight(user, matches = [], swapWindows = [], players = []) {
  const targetMatch = getInsightTargetMatch(matches);
  if (!targetMatch) {
    return {
      title: "How Many Players are playing in Today's match?",
      summary: "There is no active or upcoming match available right now.",
      bullets: [],
      metrics: [],
      bars: [],
    };
  }
  const playerById = new Map(players.map((p) => [Number(p.id), p]));
  const squad = effectiveSquadIdsForMatch((user?.players || []).map(Number), resolveUserSwapRows(user, swapWindows), Number(targetMatch.id));
  const teamAPlayers = [];
  const teamBPlayers = [];
  [...squad].forEach((pid) => {
    const p = playerById.get(Number(pid));
    if (!p) return;
    if (p.team === targetMatch.teamAabbr) teamAPlayers.push(p.name);
    if (p.team === targetMatch.teamBabbr) teamBPlayers.push(p.name);
  });
  const total = teamAPlayers.length + teamBPlayers.length;
  return {
    title: "How Many Players are playing in Today's match?",
    summary: `You have ${total} player${total === 1 ? "" : "s"} in Match ${targetMatch.id}: ${targetMatch.teamAabbr} vs ${targetMatch.teamBabbr}.`,
    bullets: [
      `${targetMatch.teamAabbr}: ${teamAPlayers.length}${teamAPlayers.length ? ` (${teamAPlayers.join(", ")})` : ""}`,
      `${targetMatch.teamBabbr}: ${teamBPlayers.length}${teamBPlayers.length ? ` (${teamBPlayers.join(", ")})` : ""}`,
    ],
    metrics: [
      { label: "Total", value: total, tone: "accent" },
      { label: targetMatch.teamAabbr, value: teamAPlayers.length, tone: "ok" },
      { label: targetMatch.teamBabbr, value: teamBPlayers.length, tone: "warn" },
    ],
    bars: [
      { label: targetMatch.teamAabbr, value: total > 0 ? Math.round((teamAPlayers.length / total) * 100) : 0, tone: "ok" },
      { label: targetMatch.teamBabbr, value: total > 0 ? Math.round((teamBPlayers.length / total) * 100) : 0, tone: "warn" },
    ],
  };
}

function getRankClimbInsight(username, users = {}, matches = [], swapWindows = [], players = []) {
  const rows = Object.entries(users)
    .map(([un, u]) => ({ un, teamName: u.teamName, points: Number(u.points || 0) }))
    .sort((a, b) => Number(b.points || 0) - Number(a.points || 0));
  const myIdx = rows.findIndex((r) => r.un === username);
  if (myIdx < 0) {
    return { title: "How can I move up the ranks today?", summary: "Your team could not be found right now.", bullets: [], metrics: [], bars: [] };
  }
  if (myIdx === 0) {
    return { title: "How can I move up the ranks today?", summary: "You are already Rank 1. Today is about defending the lead.", bullets: [], metrics: [{ label: "Rank", value: 1, tone: "ok" }], bars: [] };
  }
  const targetMatch = getInsightTargetMatch(matches);
  if (!targetMatch) {
    return { title: "How can I move up the ranks today?", summary: "There is no active or upcoming match available right now.", bullets: [], metrics: [], bars: [] };
  }
  const me = rows[myIdx];
  const above = rows[myIdx - 1];
  const meUser = users[me.un] || {};
  const aboveUser = users[above.un] || {};
  const playerById = new Map(players.map((p) => [Number(p.id), p]));
  const meSquad = effectiveSquadIdsForMatch((meUser.players || []).map(Number), resolveUserSwapRows(meUser, swapWindows), Number(targetMatch.id));
  const aboveSquad = effectiveSquadIdsForMatch((aboveUser.players || []).map(Number), resolveUserSwapRows(aboveUser, swapWindows), Number(targetMatch.id));
  const matchPlayerIds = new Set(players.filter((p) => p.team === targetMatch.teamAabbr || p.team === targetMatch.teamBabbr).map((p) => Number(p.id)));
  const meOnly = [...meSquad].filter((pid) => matchPlayerIds.has(pid) && !aboveSquad.has(pid)).map((pid) => playerById.get(pid)).filter(Boolean);
  const aboveOnly = [...aboveSquad].filter((pid) => matchPlayerIds.has(pid) && !meSquad.has(pid)).map((pid) => playerById.get(pid)).filter(Boolean);
  const myPred = meUser?.predictions?.[String(targetMatch.id)]?.pick || "";
  const abovePred = aboveUser?.predictions?.[String(targetMatch.id)]?.pick || "";
  const predictionSwing = myPred && abovePred && myPred !== abovePred ? 50 : 0;
  const gap = Number(above.points || 0) - Number(me.points || 0);
  const effectiveGap = Math.max(0, gap - predictionSwing);
  const myOnlyNames = meOnly.map((p) => p.name);
  const aboveOnlyNames = aboveOnly.map((p) => p.name);
  const summary = predictionSwing > 0
    ? `You trail ${above.teamName} by ${gap} points. If ${myPred} wins, the prediction swing cuts the effective gap to ${effectiveGap}.`
    : `You trail ${above.teamName} by ${gap} points going into Match ${targetMatch.id}.`;
  const bullets = [];
  if (myOnlyNames.length > 0 || aboveOnlyNames.length > 0) {
    bullets.push(`Your swing players: ${myOnlyNames.length ? myOnlyNames.join(", ") : "none"}`);
    bullets.push(`${above.teamName}'s swing players: ${aboveOnlyNames.length ? aboveOnlyNames.join(", ") : "none"}`);
    bullets.push(`You need your unique picks to beat theirs by roughly ${effectiveGap + 1}+ points to move up one rank.`);
  } else {
    bullets.push("Your match exposure is very similar, so prediction and common-player variance will matter more than unique picks.");
  }
  return {
    title: "How can I move up the ranks today?",
    summary,
    bullets,
    metrics: [
      { label: "Your Rank", value: myIdx + 1, tone: "accent" },
      { label: "Target Rank", value: myIdx, tone: "ok" },
      { label: "Gap", value: gap, tone: "warn" },
      { label: "Post-Swing Gap", value: effectiveGap, tone: predictionSwing > 0 ? "ok" : "muted" },
    ],
    bars: [
      { label: "Prediction Swing", value: predictionSwing > 0 ? 100 : 0, tone: predictionSwing > 0 ? "ok" : "muted" },
      { label: "Gap Pressure", value: Math.min(100, Math.round((effectiveGap / Math.max(1, gap || 1)) * 100)), tone: "warn" },
    ],
  };
}

function getRateMyTeamInsight(user, users = {}, matches = [], swapWindows = [], players = [], matchStats = {}) {
  const targetMatch = getInsightTargetMatch(matches);
  const completedMatches = matches
    .filter((m) => normalizeMatchDateTime(m.date) <= nowLocalMatchTs())
    .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)));
  const playerTotals = new Map();
  completedMatches.forEach((m) => {
    const ms = matchStats[String(m.id)] || {};
    Object.entries(ms.players || {}).forEach(([pid, stat]) => {
      const npid = Number(pid);
      const prev = playerTotals.get(npid) || 0;
      playerTotals.set(npid, prev + scorePlayerPerformance(stat) + (Number(ms.motmPlayerId) === npid ? POINT_RULES.MAN_OF_MATCH : 0));
    });
  });
  const squad = effectiveSquadIdsForMatch((user?.players || []).map(Number), resolveUserSwapRows(user, swapWindows), Number(targetMatch?.id || 0));
  const ownership = new Map();
  Object.values(users).forEach((u) => {
    const ids = effectiveSquadIdsForMatch((u?.players || []).map(Number), resolveUserSwapRows(u, swapWindows), Number(targetMatch?.id || 0));
    ids.forEach((pid) => ownership.set(Number(pid), (ownership.get(Number(pid)) || 0) + 1));
  });
  const squadPlayers = [...squad].map((pid) => players.find((p) => Number(p.id) === Number(pid))).filter(Boolean);
  const todayPlayers = targetMatch ? squadPlayers.filter((p) => p.team === targetMatch.teamAabbr || p.team === targetMatch.teamBabbr) : [];
  const coverageScore = Math.min(10, todayPlayers.length * 2.5);
  const avgTodayForm = todayPlayers.length ? todayPlayers.reduce((s, p) => s + Number(playerTotals.get(Number(p.id)) || 0), 0) / todayPlayers.length : 0;
  const formScore = Math.min(10, avgTodayForm / 60);
  const bowlers = squadPlayers.filter((p) => p.role === "BOWL").length;
  const intl = squadPlayers.filter((p) => p.country !== "India").length;
  const balanceScore = bowlers >= 6 && bowlers <= 8 && intl <= 8 ? 10 : bowlers >= 5 && intl <= 8 ? 7 : 5;
  const predictionScore = targetMatch && user?.predictions?.[String(targetMatch.id)]?.pick ? 10 : 4;
  const differentialCount = squadPlayers.filter((p) => (ownership.get(Number(p.id)) || 0) <= 3).length;
  const differentialScore = Math.min(10, differentialCount * 1.2);
  const rating = (coverageScore * 0.3) + (formScore * 0.25) + (balanceScore * 0.2) + (predictionScore * 0.1) + (differentialScore * 0.15);
  const band = rating >= 8.5 ? "Elite" : rating >= 7.5 ? "Strong" : rating >= 6.5 ? "Balanced" : rating >= 5.5 ? "Risky" : "Needs a Lift";
  return {
    title: "Rate my team",
    summary: `Your team rates ${rating.toFixed(1)}/10 today: ${band}.`,
    bullets: [
      `Today's match coverage: ${todayPlayers.length} player${todayPlayers.length === 1 ? "" : "s"}`,
      `Balance check: ${bowlers} bowlers and ${intl} international players`,
      `Differential depth: ${differentialCount} relatively low-owned players in your current squad`,
    ],
    metrics: [
      { label: "Rating", value: rating.toFixed(1), tone: "accent" },
      { label: "Coverage", value: todayPlayers.length, tone: "ok" },
      { label: "Bowlers", value: bowlers, tone: "warn" },
      { label: "Differentials", value: differentialCount, tone: "muted" },
    ],
    bars: [
      { label: "Coverage", value: Math.round(coverageScore * 10), tone: "ok" },
      { label: "Form", value: Math.round(formScore * 10), tone: "accent" },
      { label: "Balance", value: Math.round(balanceScore * 10), tone: "warn" },
      { label: "Prediction Ready", value: Math.round(predictionScore * 10), tone: "muted" },
      { label: "Differential Edge", value: Math.round(differentialScore * 10), tone: "accent" },
    ],
  };
}

function getWhatCanChangeInsight(username, users = {}, matches = [], swapWindows = [], players = []) {
  const rows = Object.entries(users)
    .map(([un, u]) => ({ un, teamName: u.teamName, points: Number(u.points || 0) }))
    .sort((a, b) => Number(b.points || 0) - Number(a.points || 0));
  const scenario = buildWhatCanChangeToday(rows, users, matches, swapWindows, players);
  if (!scenario) {
    return {
      title: "What can change today?",
      summary: "No strong leaderboard swing scenario is available right now.",
      bullets: [],
      metrics: [],
      bars: [],
    };
  }
  return {
    title: "What can change today?",
    summary: scenario.summary,
    bullets: [
      `Leader: ${scenario.leader.teamName}`,
      `Chaser: ${scenario.chaser.teamName}`,
      `Match ${scenario.match.id}: ${scenario.match.teamAabbr} vs ${scenario.match.teamBabbr}`,
    ],
    metrics: [
      { label: "Gap", value: scenario.currentGap, tone: "warn" },
      { label: "Swing", value: scenario.predictionSwingToChaser, tone: "ok" },
      { label: "After Swing", value: scenario.effectiveGapToChaser, tone: "accent" },
    ],
    bars: [
      { label: "Current Gap", value: Math.min(100, scenario.currentGap), tone: "warn" },
      { label: "Prediction Swing", value: Math.min(100, scenario.predictionSwingToChaser * 2), tone: "ok" },
      { label: "Leader Pressure", value: Math.min(100, scenario.effectiveGapToChaser), tone: "accent" },
    ],
  };
}

function getPredictionCrowdInsight(username, users = {}, matches = []) {
  const targetMatch = getInsightTargetMatch(matches);
  const me = users[username] || {};
  if (!targetMatch) {
    return {
      title: "Who is with me on today's prediction?",
      summary: "There is no active or upcoming match available right now.",
      bullets: [],
      metrics: [],
      bars: [],
    };
  }
  const myPick = me?.predictions?.[String(targetMatch.id)]?.pick || "";
  if (!myPick) {
    return {
      title: "Who is with me on today's prediction?",
      summary: `You have not predicted yet for Match ${targetMatch.id}.`,
      bullets: ["Submit your winner pick first to compare yourself against the rest of the league."],
      metrics: [],
      bars: [],
    };
  }
  const same = [];
  const opposite = [];
  const pending = [];
  Object.entries(users).forEach(([un, u]) => {
    if (un === username) return;
    const pick = u?.predictions?.[String(targetMatch.id)]?.pick || "";
    if (!pick) pending.push(u.teamName || un);
    else if (pick === myPick) same.push(u.teamName || un);
    else opposite.push(u.teamName || un);
  });
  const total = Math.max(1, same.length + opposite.length + pending.length);
  return {
    title: "Who is with me on today's prediction?",
    summary: `You picked ${myPick} for Match ${targetMatch.id}. ${same.length} other squad${same.length === 1 ? "" : "s"} are with you, while ${opposite.length} are on the other side.`,
    bullets: [
      `Same pick: ${same.length ? same.slice(0, 6).join(", ") : "none"}`,
      `Opposite pick: ${opposite.length ? opposite.slice(0, 6).join(", ") : "none"}`,
      `Pending picks: ${pending.length}`,
    ],
    metrics: [
      { label: "With You", value: same.length, tone: "ok" },
      { label: "Opposite", value: opposite.length, tone: "warn" },
      { label: "Pending", value: pending.length, tone: "muted" },
    ],
    bars: [
      { label: "With You", value: Math.round((same.length / total) * 100), tone: "ok" },
      { label: "Opposite", value: Math.round((opposite.length / total) * 100), tone: "warn" },
      { label: "Pending", value: Math.round((pending.length / total) * 100), tone: "muted" },
    ],
  };
}

function getUniquePlayerEdgeInsight(user, users = {}, matches = [], swapWindows = [], players = []) {
  const targetMatch = getInsightTargetMatch(matches);
  if (!targetMatch) {
    return {
      title: "Which active players give me a unique edge?",
      summary: "There is no active or upcoming match available right now.",
      bullets: [],
      metrics: [],
      bars: [],
    };
  }
  const ownership = new Map();
  Object.values(users).forEach((u) => {
    const ids = effectiveSquadIdsForMatch((u?.players || []).map(Number), resolveUserSwapRows(u, swapWindows), Number(targetMatch.id));
    ids.forEach((pid) => ownership.set(Number(pid), (ownership.get(Number(pid)) || 0) + 1));
  });
  const playerById = new Map(players.map((p) => [Number(p.id), p]));
  const myIds = effectiveSquadIdsForMatch((user?.players || []).map(Number), resolveUserSwapRows(user, swapWindows), Number(targetMatch.id));
  const active = [...myIds]
    .map((pid) => playerById.get(Number(pid)))
    .filter((p) => p && (p.team === targetMatch.teamAabbr || p.team === targetMatch.teamBabbr))
    .map((p) => ({ ...p, owners: Number(ownership.get(Number(p.id)) || 0) }))
    .sort((a, b) => Number(a.owners || 0) - Number(b.owners || 0));
  const unique = active.filter((p) => Number(p.owners || 0) === 1);
  const differential = active.filter((p) => Number(p.owners || 0) > 1 && Number(p.owners || 0) <= 3);
  return {
    title: "Which active players give me a unique edge?",
    summary: unique.length
      ? `${unique.map((p) => p.name).join(", ")} ${unique.length === 1 ? "is" : "are"} unique to your squad in today's match.`
      : differential.length
        ? `You do not have a fully unique active player, but ${differential.map((p) => p.name).join(", ")} still give you differential upside.`
        : "Your active players are widely held today, so upside will likely come from common-player scoring and prediction swings.",
    bullets: [
      `Unique: ${unique.length ? unique.map((p) => `${p.name} (${p.owners})`).join(", ") : "none"}`,
      `Differential: ${differential.length ? differential.map((p) => `${p.name} (${p.owners})`).join(", ") : "none"}`,
      `Popular: ${active.filter((p) => Number(p.owners || 0) > 3).length}`,
    ],
    metrics: [
      { label: "Unique", value: unique.length, tone: "accent" },
      { label: "Differential", value: differential.length, tone: "warn" },
      { label: "Active", value: active.length, tone: "ok" },
    ],
    bars: [
      { label: "Unique Share", value: active.length ? Math.round((unique.length / active.length) * 100) : 0, tone: "accent" },
      { label: "Differential Share", value: active.length ? Math.round((differential.length / active.length) * 100) : 0, tone: "warn" },
    ],
  };
}

function getPendingPredictionsInsight(users = {}, matches = []) {
  const targetMatch = getInsightTargetMatch(matches);
  if (!targetMatch) {
    return {
      title: "Who has not predicted yet?",
      summary: "There is no active or upcoming match available right now.",
      bullets: [],
      metrics: [],
      bars: [],
    };
  }
  const pendingTeams = Object.entries(users)
    .filter(([, u]) => !(u?.predictions?.[String(targetMatch.id)]?.pick))
    .map(([, u]) => u.teamName)
    .sort((a, b) => String(a).localeCompare(String(b)));
  const totalUsers = Math.max(1, Object.keys(users).length);
  return {
    title: "Who has not predicted yet?",
    summary: `${pendingTeams.length} squad${pendingTeams.length === 1 ? "" : "s"} have not given a prediction yet for Match ${targetMatch.id}.`,
    bullets: pendingTeams.length ? pendingTeams : ["Everyone has predicted for this match."],
    metrics: [
      { label: "Pending", value: pendingTeams.length, tone: "warn" },
      { label: "Predicted", value: totalUsers - pendingTeams.length, tone: "ok" },
      { label: "Total", value: totalUsers, tone: "muted" },
    ],
    bars: [
      { label: "Pending", value: Math.round((pendingTeams.length / totalUsers) * 100), tone: "warn" },
      { label: "Predicted", value: Math.round(((totalUsers - pendingTeams.length) / totalUsers) * 100), tone: "ok" },
    ],
  };
}

function getMaxRankGapInsight(users = {}) {
  const rows = Object.entries(users)
    .map(([un, u]) => ({ un, teamName: u.teamName, points: Number(u.points || 0) }))
    .sort((a, b) => Number(b.points || 0) - Number(a.points || 0));
  let best = null;
  for (let i = 0; i < rows.length - 1; i += 1) {
    const gap = Number(rows[i].points || 0) - Number(rows[i + 1].points || 0);
    if (!best || gap > best.gap) best = { upper: rows[i], lower: rows[i + 1], upperRank: i + 1, lowerRank: i + 2, gap };
  }
  if (!best) {
    return { title: "Where is the biggest leaderboard gap?", summary: "Leaderboard data is not available right now.", bullets: [], metrics: [], bars: [] };
  }
  return {
    title: "Where is the biggest leaderboard gap?",
    summary: `Maximum difference between ranks is Rank ${best.upperRank} & ${best.lowerRank}, with a gap of ${best.gap} points.`,
    bullets: [
      `Rank ${best.upperRank}: ${best.upper.teamName} (${best.upper.points} pts)`,
      `Rank ${best.lowerRank}: ${best.lower.teamName} (${best.lower.points} pts)`,
    ],
    metrics: [
      { label: "Upper Rank", value: best.upperRank, tone: "accent" },
      { label: "Lower Rank", value: best.lowerRank, tone: "muted" },
      { label: "Gap", value: best.gap, tone: "warn" },
    ],
    bars: [
      { label: "Gap Size", value: Math.min(100, best.gap / 5), tone: "warn" },
    ],
  };
}

function IflGuru({ user, username, userToken, lang = "en" }) {
  return null;
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [isMobileChat, setIsMobileChat] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 640 : false));
  const [messages, setMessages] = useState(() => [
    {
      role: "guru",
      text: lang === "hi"
        ? `नमस्ते ${user?.teamName || username}. मैं IFL GURU हूं। मुझसे IPL news, IPL stats, आपकी team, rank, active players, prediction angles, या match insights के बारे में पूछिए।`
        : `Hi ${user?.teamName || username}. I’m IFL GURU. Ask me about IPL news, IPL stats, your team, rank, active players, prediction angles, or match insights.`,
      sources: [],
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [chatTick, setChatTick] = useState(0);
  const [messagesViewport, setMessagesViewport] = useState(null);
  const [messagesEndEl, setMessagesEndEl] = useState(null);
  const quickQuestions = [
    "What IPL news matters most for my team today?",
    "How can I move up one rank today?",
    "Which of my active players are differential picks?",
    "Give me an IPL stat-based read on my current squad.",
  ];

  const submit = async (prefill = "") => {
    const q = String(prefill || question || "").trim();
    if (!q || busy) return;
    setMessages((prev) => [...prev, { role: "user", text: q, sources: [] }]);
    setQuestion("");
    setBusy(true);
    try {
      const data = await askIflGuru(userToken, q);
      setMessages((prev) => [
        ...prev,
        {
          role: "guru",
          text: data?.answer || "No answer returned.",
          sources: Array.isArray(data?.sources) ? data.sources : [],
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "guru",
          text: e?.message || "IFL GURU is unavailable right now.",
          sources: [],
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open || !messagesViewport || !messagesEndEl) return;
    messagesEndEl.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [open, messages.length, busy, chatTick, messagesViewport, messagesEndEl]);

  useEffect(() => {
    const onResize = () => setIsMobileChat(window.innerWidth <= 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <>
      <button
        className="btn btn-primary"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          position: "fixed",
          right: isMobileChat ? 12 : 18,
          bottom: isMobileChat ? 12 : 18,
          zIndex: 130,
          borderRadius: 999,
          width: isMobileChat ? 52 : 60,
          height: isMobileChat ? 52 : 60,
          minWidth: 0,
          padding: 0,
          boxShadow: "0 16px 36px rgba(232,169,46,.28)",
          display: "grid",
          placeItems: "center",
          lineHeight: 1,
          overflow: "hidden",
        }}
        aria-label={open ? "Close IFL GURU" : "Open IFL GURU"}
        title={open ? "Close IFL GURU" : "Open IFL GURU"}
      >
        {open ? (
          "✕"
        ) : (
          <img
            src="/icon.png"
            alt="IFL GURU"
            style={{
              width: isMobileChat ? 42 : 48,
              height: isMobileChat ? 42 : 48,
              objectFit: "contain",
              borderRadius: 999,
            }}
          />
        )}
      </button>
      {open && (
        <div
          className="card"
          style={{
            position: "fixed",
            right: isMobileChat ? 12 : 18,
            left: isMobileChat ? 12 : "auto",
            bottom: isMobileChat ? 68 : 76,
            zIndex: 129,
            width: isMobileChat ? "auto" : "min(420px, calc(100vw - 24px))",
            maxHeight: isMobileChat ? "min(82vh, 920px)" : "min(78vh, 760px)",
            display: "grid",
            gridTemplateRows: "auto auto 1fr auto",
            gap: isMobileChat ? 10 : 12,
            padding: isMobileChat ? 12 : 16,
            overflow: "hidden",
            borderRadius: isMobileChat ? 18 : undefined,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: isMobileChat ? 24 : 28, fontWeight: 800 }}>IFL GURU</div>
              <div style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 800 }}>AI IPL Assistant</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>×</button>
          </div>

          <div style={{ color: "var(--text)", lineHeight: 1.6, fontSize: isMobileChat ? 13 : 14 }}>
            {lang === "hi"
              ? "IPL news, current season stats, fantasy implications, और आपकी IFL स्थिति के आधार पर personalised जवाब।"
              : "Grounded IPL news, current-season stats, fantasy implications, and personalized answers using your IFL context."}
          </div>

          <div ref={setMessagesViewport} style={{ display: "grid", gap: 12, minHeight: 0, overflowY: "auto", paddingRight: isMobileChat ? 0 : 4 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {quickQuestions.map((q) => (
                <button key={q} className="btn btn-secondary btn-sm" onClick={() => void submit(q)} disabled={busy} style={{ flex: isMobileChat ? "1 1 100%" : "0 1 auto", justifyContent: "flex-start", whiteSpace: "normal", textAlign: "left" }}>
                  {q}
                </button>
              ))}
            </div>
            {messages.map((msg, idx) => (
              <div
                key={`${msg.role}-${idx}`}
                style={{
                  borderRadius: 14,
                  padding: "12px 14px",
                  background: msg.role === "user" ? "rgba(249,115,22,.09)" : "rgba(255,255,255,.04)",
                  border: msg.role === "user" ? "1px solid rgba(249,115,22,.24)" : "1px solid rgba(255,255,255,.08)",
                }}
              >
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 800, marginBottom: 6 }}>
                  {msg.role === "user" ? "You" : "IFL GURU"}
                </div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{msg.text}</div>
                {!!msg.sources?.length && (
                  <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    {msg.sources.map((src, sidx) => (
                      <a
                        key={`${src.url}-${sidx}`}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "grid",
                          gap: 4,
                          textDecoration: "none",
                          color: "inherit",
                          borderRadius: 12,
                          padding: "10px 12px",
                          background: "rgba(255,215,96,.08)",
                          border: "1px solid rgba(255,215,96,.18)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 800 }}>
                            #{src.rank || sidx + 1} Trusted Source
                          </div>
                          <div
                            style={{
                              borderRadius: 999,
                              padding: "3px 8px",
                              background: "rgba(255,255,255,.08)",
                              border: "1px solid rgba(255,255,255,.1)",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "var(--text)",
                            }}
                          >
                            {src.source || src.domain || "Cricket Source"}
                          </div>
                        </div>
                        <div style={{ color: "#f8fafc", fontSize: 14, fontWeight: 700, lineHeight: 1.45 }}>
                          {src.title || src.url}
                        </div>
                        {!!src.snippet && (
                          <div style={{ color: "var(--muted)", fontSize: 12.5, lineHeight: 1.55 }}>
                            {src.snippet}
                          </div>
                        )}
                        <div style={{ color: "#93c5fd", fontSize: 12, fontWeight: 700 }}>
                          Open source
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div style={{ borderRadius: 14, padding: "12px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 800, marginBottom: 6 }}>IFL GURU</div>
                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 24, fontWeight: 700 }}>Thinking . . .</div>
              </div>
            )}
            <div ref={setMessagesEndEl} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobileChat ? "1fr" : "1fr auto", gap: 10 }}>
            <textarea
              className="fg"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onFocus={() => setChatTick((prev) => prev + 1)}
              placeholder={lang === "hi" ? "पूछें: आज मेरी टीम पर कौन सी IPL news असर डालती है?" : "Ask: What IPL news affects my team today?"}
              style={{ minHeight: isMobileChat ? 78 : 86, resize: "vertical", width: "100%", borderRadius: 12, padding: 12, background: "rgba(10,16,30,.8)", color: "var(--text)", border: "1px solid var(--border-hi)", fontSize: isMobileChat ? 14 : 15 }}
            />
            <button className="btn btn-primary" onClick={() => void submit()} disabled={busy} style={{ alignSelf: "end", width: isMobileChat ? "100%" : "auto" }}>
              {busy ? "Asking..." : "Ask IFL GURU"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function GuestIflGuru() {
  return null;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");
  const [isMobileChat, setIsMobileChat] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 640 : false));
  const [messagesViewport, setMessagesViewport] = useState(null);
  const [messagesEndEl, setMessagesEndEl] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: "guru",
      text: "Welcome to the guest demo of IFL GURU. Tap any question below to see a sample insight.",
      sources: [],
    },
  ]);

  const demoAnswers = {
    squad_read: "Demo insight: Your sample squad looks balanced for IPL 2026 with strong bowling depth, decent active-player coverage, and a couple of lower-owned upside picks.",
    rank_climb: "Demo insight: To climb one rank, you would usually need your unique active players to outscore the team above you while keeping your swap window and squad balance intact.",
    swap_help: "Demo insight: A smart swap usually removes a low-output player and brings in a higher-form option while still keeping 20 total players, at least 6 bowlers, and at most 8 internationals.",
    injury_watch: "Demo insight: Injury and availability answers use trusted cricket sources. In the real app, IFL GURU checks current IPL 2026 reports before suggesting whether a player might miss upcoming matches.",
    scorecard_read: "Demo insight: Scorecard summaries explain what happened in the latest IPL 2026 match and which of your active players would benefit most from that result.",
  };

  const quickQuestions = [
    ["squad_read", "Give me an IPL stat-based read on my squad"],
    ["rank_climb", "How can I move up one rank today?"],
    ["swap_help", "Suggest a legal player swap"],
    ["injury_watch", "Who might be injured or unavailable?"],
    ["scorecard_read", "Summarize the latest scorecard for me"],
  ];

  useEffect(() => {
    const onResize = () => setIsMobileChat(window.innerWidth <= 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!open || !messagesViewport || !messagesEndEl) return;
    messagesEndEl.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [open, messages.length, busy, messagesViewport, messagesEndEl]);

  const runDemo = (id, label) => {
    if (busy) return;
    setSelected(id);
    setMessages((prev) => [...prev, { role: "user", text: label, sources: [] }]);
    setBusy(true);
    window.setTimeout(() => {
      setMessages((prev) => [...prev, { role: "guru", text: demoAnswers[id] || "Demo insight unavailable.", sources: [] }]);
      setBusy(false);
    }, 1200);
  };

  return (
    <>
      <button
        className="btn btn-primary"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          position: "fixed",
          right: isMobileChat ? 12 : 18,
          bottom: isMobileChat ? 12 : 18,
          zIndex: 130,
          borderRadius: 999,
          width: isMobileChat ? 52 : 60,
          height: isMobileChat ? 52 : 60,
          minWidth: 0,
          padding: 0,
          boxShadow: "0 16px 36px rgba(232,169,46,.28)",
          display: "grid",
          placeItems: "center",
          lineHeight: 1,
          overflow: "hidden",
        }}
        aria-label={open ? "Close demo IFL GURU" : "Open demo IFL GURU"}
        title={open ? "Close demo IFL GURU" : "Open demo IFL GURU"}
      >
        {open ? "✕" : (
          <img
            src="/icon.png"
            alt="IFL GURU Demo"
            style={{ width: isMobileChat ? 42 : 48, height: isMobileChat ? 42 : 48, objectFit: "contain", borderRadius: 999 }}
          />
        )}
      </button>
      {open && (
        <div
          className="card"
          style={{
            position: "fixed",
            right: isMobileChat ? 12 : 18,
            left: isMobileChat ? 12 : "auto",
            bottom: isMobileChat ? 68 : 76,
            zIndex: 129,
            width: isMobileChat ? "auto" : "min(420px, calc(100vw - 24px))",
            maxHeight: isMobileChat ? "min(82vh, 920px)" : "min(78vh, 760px)",
            display: "grid",
            gridTemplateRows: "auto auto 1fr",
            gap: isMobileChat ? 10 : 12,
            padding: isMobileChat ? 12 : 16,
            overflow: "hidden",
            borderRadius: isMobileChat ? 18 : undefined,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: isMobileChat ? 24 : 28, fontWeight: 800 }}>IFL GURU</div>
              <div style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 800 }}>Guest Demo</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>×</button>
          </div>

          <div style={{ color: "var(--text)", lineHeight: 1.6, fontSize: isMobileChat ? 13 : 14 }}>
            Explore sample chatbot answers with demo-only questions. Real personalized insights unlock after login.
          </div>

          <div ref={setMessagesViewport} style={{ display: "grid", gap: 12, minHeight: 0, overflowY: "auto", paddingRight: isMobileChat ? 0 : 4 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {quickQuestions.map(([id, label]) => (
                <button
                  key={id}
                  className={`btn ${selected === id ? "btn-primary" : "btn-secondary"} btn-sm`}
                  onClick={() => runDemo(id, label)}
                  disabled={busy}
                  style={{ flex: isMobileChat ? "1 1 100%" : "0 1 auto", justifyContent: "flex-start", whiteSpace: "normal", textAlign: "left" }}
                >
                  {label}
                </button>
              ))}
            </div>

            {messages.map((msg, idx) => (
              <div
                key={`${msg.role}-${idx}`}
                style={{
                  borderRadius: 14,
                  padding: "12px 14px",
                  background: msg.role === "user" ? "rgba(249,115,22,.09)" : "rgba(255,255,255,.04)",
                  border: msg.role === "user" ? "1px solid rgba(249,115,22,.24)" : "1px solid rgba(255,255,255,.08)",
                }}
              >
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 800, marginBottom: 6 }}>
                  {msg.role === "user" ? "You" : "IFL GURU"}
                </div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{msg.text}</div>
              </div>
            ))}

            {busy && (
              <div style={{ borderRadius: 14, padding: "12px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 800, marginBottom: 6 }}>IFL GURU</div>
                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 24, fontWeight: 700 }}>Thinking . . .</div>
              </div>
            )}
            <div ref={setMessagesEndEl} />
          </div>
        </div>
      )}
    </>
  );
}

async function openLeaderboardPdfExport(rows, prevRanks = {}) {
  const now = new Date();
  const generatedAt = now.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const users = load("ifl_users", {});
  const matches = getMatches();
  const matchStats = getMatchStats();
  const players = getPlayers();
  const swapWindows = getSwapWindows();
  const whatCanChangeToday = buildWhatCanChangeToday(rows, users, matches, swapWindows, players);
  const playerById = new Map(players.map((p) => [Number(p.id), p]));
  const today = nowLocalMatchTs().slice(0, 10);
  const elapsedMatches = matches
    .filter((m) => normalizeMatchDateTime(m.date) <= nowLocalMatchTs())
    .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)));
  const lastScoredMatch = [...elapsedMatches].reverse().find((m) => {
    const ms = matchStats[String(m.id)] || {};
    return Object.keys(ms.players || {}).length > 0 || !!ms.motmPlayerId;
  });
  const nextMatch = matches
    .filter((m) => normalizeMatchDateTime(m.date) > nowLocalMatchTs())
    .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)))[0];

  const calcUserMatchPoints = (u, m) => {
    const mid = String(m.id);
    const baseIds = (u.players || []).map(Number);
    const swapRows = resolveUserSwapRows(u, swapWindows);
    const squad = effectiveSquadIdsForMatch(baseIds, swapRows, Number(m.id));
    const mStat = matchStats[mid] || {};
    const pstats = mStat.players || {};
    let pts = 0;
    Object.entries(pstats).forEach(([pid, stat]) => {
      if (squad.has(Number(pid))) pts += scorePlayerPerformance(stat);
    });
    if (mStat.motmPlayerId && squad.has(Number(mStat.motmPlayerId))) pts += POINT_RULES.MAN_OF_MATCH;
    const pred = u.predictions?.[mid];
    if (pred?.pick && m.winner && pred.pick === m.winner) pts += POINT_RULES.MATCH_WINNER_PICK;
    return pts;
  };

  const calcUserPredictionStats = (u, m) => {
    const matchById = new Map(matches.map((mt) => [String(mt.id), mt]));
    let correct = 0;
    let settled = 0;
    let totalPoints = 0;
    Object.entries(u.predictions || {}).forEach(([mid, p]) => {
      const match = matchById.get(String(mid)) || null;
      if (match?.winner !== "NR") totalPoints += Number(p?.pts || 0);
      if (p?.correct === true || p?.correct === false) {
        if (match?.winner === "NR") return;
        settled += 1;
        if (p.correct === true) correct += 1;
      }
    });
    const accuracy = settled > 0 ? `${Math.round((correct / settled) * 100)}%` : "N/A";
    let lastPredPoints = 0;
    if (m) {
      const pred = u.predictions?.[String(m.id)];
      if (pred?.pts !== undefined) lastPredPoints = Number(pred.pts || 0);
    }
    return { accuracy, totalPoints, lastPredPoints };
  };

  const calcUserPredictionAccuracyRatio = (u) => {
    let correct = 0;
    let settled = 0;
    Object.entries(u?.predictions || {}).forEach(([mid, pred]) => {
      const match = matches.find((mt) => String(mt.id) === String(mid));
      if (!match?.winner || match.winner === "NR") return;
      if (pred?.correct === true || pred?.correct === false) {
        settled += 1;
        if (pred.correct === true) correct += 1;
      }
    });
    return settled > 0 ? correct / settled : 0;
  };

  const leaderboardTagForUser = (u, rank, delta) => {
    const squad = (u?.players || []).map((pid) => playerById.get(Number(pid))).filter(Boolean);
    const bowlers = squad.filter((p) => p.role === "BOWL").length;
    const allRounders = squad.filter((p) => p.role === "ALL").length;
    const intl = squad.filter((p) => p.country !== "India").length;
    const acc = calcUserPredictionAccuracyRatio(u);
    const last = Number(u?.lastEarned || 0);
    if (rank === 1) return "👑 Crown Defender";
    if (Number(delta) >= 2) return "🚀 Rocket Climber";
    if (Number(delta) <= -2) return "🛟 Damage Control";
    if (last >= 250) return "🔥 Hot Hand";
    if (acc >= 0.65) return "🎯 Prediction Sniper";
    if (bowlers >= 7) return "⚡ Wicket Hunter";
    if (allRounders >= 5) return "💥 Chaos Engineer";
    if (intl >= 6) return "🌍 Overseas Armada";
    if (squad.length > 0 && intl <= 2) return "🇮🇳 Swadeshi Scout";
    if (rank <= 4) return "🏁 Title Chaser";
    if (rank >= 15) return "🐎 Dark Horse";
    return "😈 Mid-table Menace";
  };

  const ownership = new Map();
  Object.values(users).forEach((u) => {
    (u.players || []).forEach((pid) => ownership.set(Number(pid), (ownership.get(Number(pid)) || 0) + 1));
  });

  const enrichedRows = rows.map((r) => {
    const u = users[r.un] || {};
    const lastEarned = lastScoredMatch ? calcUserMatchPoints(u, lastScoredMatch) : 0;
    const predStats = calcUserPredictionStats(u, lastScoredMatch);
    return { ...r, lastEarned, lastPredictionPoints: predStats.lastPredPoints, totalPredictionPoints: predStats.totalPoints };
  });

  const withMoves = enrichedRows.map((r, idx) => {
    const prev = Object.prototype.hasOwnProperty.call(prevRanks, r.un) ? Number(prevRanks[r.un]) : null;
    const rank = idx + 1;
    const delta = prev ? prev - rank : 0;
    return { ...r, rank, prevRank: prev, delta, tag: leaderboardTagForUser(users[r.un] || {}, rank, delta) };
  });

  const biggestClimber = [...withMoves]
    .filter((r) => Number(r.delta) > 0)
    .sort((a, b) => Number(b.delta) - Number(a.delta) || Number(b.points || 0) - Number(a.points || 0))[0] || null;
  const biggestDrop = [...withMoves]
    .filter((r) => Number(r.delta) < 0)
    .sort((a, b) => Number(a.delta) - Number(b.delta) || Number(b.points || 0) - Number(a.points || 0))[0] || null;
  let biggestRankGap = null;
  for (let i = 0; i < withMoves.length - 1; i += 1) {
    const cur = withMoves[i];
    const next = withMoves[i + 1];
    const gap = Number(cur.points || 0) - Number(next.points || 0);
    if (!biggestRankGap || gap > biggestRankGap.gap) {
      biggestRankGap = {
        upperRank: i + 1,
        lowerRank: i + 2,
        gap,
        upperTeam: cur.teamName,
        lowerTeam: next.teamName,
      };
    }
  }
  const moversHtml = [biggestClimber, biggestDrop].filter(Boolean).map((row) => {
    const isUp = Number(row.delta) > 0;
    const label = isUp ? "Biggest Climber" : "Sharpest Drop";
    const badge = isUp ? `▲ +${Number(row.delta)}` : `▼ ${Math.abs(Number(row.delta))}`;
    const tone = isUp ? "up" : "down";
    return `
      <div class="mover-card ${tone}">
        <div class="mover-label">${label}</div>
        <div class="mover-team">${escapeHtml(row.teamName)}</div>
        <div class="mover-meta">Rank ${row.rank}${row.prevRank ? ` · was #${row.prevRank}` : ""}</div>
        <div class="mover-badge">${badge}</div>
      </div>
    `;
  }).join("");
  const rankGapHtml = biggestRankGap
    ? `
      <div class="gap-card">
        <div class="gap-label">Maximum Difference Between Ranks</div>
        <div class="gap-main">Rank ${biggestRankGap.upperRank} &amp; ${biggestRankGap.lowerRank}</div>
        <div class="gap-meta">${escapeHtml(biggestRankGap.upperTeam)} vs ${escapeHtml(biggestRankGap.lowerTeam)}</div>
        <div class="gap-badge">Difference ${Number(biggestRankGap.gap || 0)}</div>
      </div>
    `
    : "";
  const gomuzUpper = withMoves[9] || null;
  const gomuzLower = withMoves[10] || null;
  const gomuzGap = gomuzUpper && gomuzLower ? Number(gomuzUpper.points || 0) - Number(gomuzLower.points || 0) : null;
  const straitOfGomuzHtml = gomuzUpper && gomuzLower
    ? `
      <div class="gomuz-card">
        <div class="gomuz-label">Strait of Gomuz</div>
        <div class="gomuz-main">Rank 10 ↔ Rank 11</div>
        <div class="gomuz-meta">${escapeHtml(gomuzUpper.teamName)} is guarding the crossing from ${escapeHtml(gomuzLower.teamName)}</div>
        <div class="gomuz-badge">${Number(gomuzGap || 0)} point gap</div>
      </div>
    `
    : "";

  const totalPoints = enrichedRows.reduce((sum, r) => sum + Number(r.points || 0), 0);

  let correctPreds = 0;
  let settledPreds = 0;
  Object.values(users).forEach((u) => {
    Object.values(u.predictions || {}).forEach((p) => {
      if (p?.correct === true || p?.correct === false) {
        settledPreds += 1;
        if (p.correct === true) correctPreds += 1;
      }
    });
  });
  const predictionAccuracy = settledPreds > 0 ? `${Math.round((correctPreds / settledPreds) * 100)}%` : "N/A";

  let mvpLabel = "N/A";
  if (lastScoredMatch) {
    const ms = matchStats[String(lastScoredMatch.id)] || {};
    const motm = playerById.get(Number(ms.motmPlayerId || 0));
    if (motm) mvpLabel = `${motm.name} · Match ${lastScoredMatch.id}`;
    else {
      const best = Object.entries(ms.players || {})
        .map(([pid, stat]) => ({ pid: Number(pid), pts: scorePlayerPerformance(stat) }))
        .sort((a, b) => b.pts - a.pts)[0];
      if (best && playerById.get(best.pid)) mvpLabel = `${playerById.get(best.pid).name} · ${best.pts} pts`;
    }
  }

  let differencePlayer = "N/A";
  const playerTotals = new Map();
  Object.entries(matchStats).forEach(([, ms]) => {
    Object.entries(ms.players || {}).forEach(([pid, stat]) => {
      const npid = Number(pid);
      playerTotals.set(npid, (playerTotals.get(npid) || 0) + scorePlayerPerformance(stat) + (Number(ms.motmPlayerId) === npid ? POINT_RULES.MAN_OF_MATCH : 0));
    });
  });
  const differential = [...playerTotals.entries()]
    .map(([pid, pts]) => ({ pid, pts, own: ownership.get(pid) || 0, player: playerById.get(pid) }))
    .filter((x) => x.player && x.pts > 0)
    .sort((a, b) => ((b.pts / Math.max(1, b.own)) - (a.pts / Math.max(1, a.own))) || (b.pts - a.pts))[0];
  if (differential) differencePlayer = `${differential.player.name} · ${differential.pts} pts`;

  let nextPopular = "N/A";
  if (nextMatch) {
    const nextPlayers = players
      .filter((p) => p.team === nextMatch.teamAabbr || p.team === nextMatch.teamBabbr)
      .map((p) => ({ p, own: ownership.get(Number(p.id)) || 0 }))
      .sort((a, b) => b.own - a.own);
    if (nextPlayers[0]?.p) nextPopular = `${nextPlayers[0].p.name} · ${nextPlayers[0].own} squads`;
  }

  const exportDay = nowLocalMatchTs().slice(0, 10);

  const htmlRows = withMoves.map((r, idx) => {
    const logoHtml = r.teamLogo
      ? `<img class="logo" src="${escapeHtml(r.teamLogo)}" alt="${escapeHtml(r.teamName)} logo" />`
      : `<div class="logo logo-fallback">${escapeHtml(String(r.teamName || "?").slice(0, 1).toUpperCase())}</div>`;
    const prev = r.prevRank;
    const delta = r.delta;
    const move = prev === null
      ? `<span class="move neutral">–</span>`
      : delta > 0
        ? `<span class="move up">▲ +${delta}</span>`
        : delta < 0
          ? `<span class="move down">▼ ${Math.abs(delta)}</span>`
          : `<span class="move neutral">– 0</span>`;
    return `
      <div class="lb-row">
        <div class="rank">${idx + 1}${move}</div>
        <div class="team-cell">
          ${logoHtml}
          <div class="team-meta">
            <div class="team-name">${escapeHtml(r.teamName)}</div>
            <div class="team-tag">${escapeHtml(r.tag || "IFL Contender")}</div>
          </div>
        </div>
        <div class="points-cell">
          <div class="pts">${Number(r.lastEarned || 0)}</div>
        </div>
        <div class="points-cell">
          <div class="pts total">${Number(r.points || 0)}</div>
        </div>
        <div class="points-cell">
          <div class="pts">${Number(r.lastPredictionPoints || 0)}</div>
        </div>
        <div class="points-cell last-col">
          <div class="pts">${Number(r.totalPredictionPoints || 0)}</div>
        </div>
      </div>
    `;
  }).join("");
  const win = window.open("about:blank", "_blank", "width=1080,height=800");
  if (!win) throw new Error("Popup blocked. Allow popups to export PDF.");
  try { win.opener = null; } catch {}
  win.document.write(`<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>IFL 2026 Leaderboard Report</title>
      <style>
        *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        body{font-family:Arial,sans-serif;margin:0;color:#142033;background:#edf3fb}
        .wrap{padding:28px}
        .hero{padding:28px 32px;border-radius:18px;background:linear-gradient(135deg,#10213d 0%,#17345c 62%,#0f2440 100%);color:#fff;box-shadow:0 14px 28px rgba(16,33,61,.14)}
        .eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;opacity:.78;color:#d8e6fb}
        h1{margin:10px 0 6px;font-size:34px}
        .sub{opacity:.9;font-size:14px;color:#d7e4f8}
        .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:20px 0 24px}
        .stat{background:#fff;border-radius:14px;padding:16px 18px;box-shadow:0 8px 18px rgba(16,33,61,.08);border:1px solid #dfe7f2}
        .stat .v{font-size:24px;font-weight:700;color:#0d1d38}
        .stat .l{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#5f6f86;margin-top:3px}
        .movers{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin:0 0 20px}
        .mover-card{border-radius:16px;padding:16px 18px;box-shadow:0 10px 24px rgba(16,33,61,.08);color:#fff;border:1px solid rgba(255,255,255,.16)}
        .mover-card.up{background:linear-gradient(135deg,#14532d 0%,#15803d 100%)}
        .mover-card.down{background:linear-gradient(135deg,#7f1d1d 0%,#b91c1c 100%)}
        .mover-label{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.86;color:#ecfdf5}
        .mover-card.down .mover-label{color:#fee2e2}
        .mover-team{font-size:24px;font-weight:800;margin-top:8px;line-height:1.1}
        .mover-meta{font-size:13px;opacity:.9;margin-top:6px;color:#e2ecf8}
        .mover-badge{display:inline-flex;margin-top:12px;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.16);font-size:15px;font-weight:800;border:1px solid rgba(255,255,255,.18)}
        .gap-card{margin:0 0 20px;border-radius:16px;padding:16px 18px;background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);border:1px solid #fdba74;box-shadow:0 10px 24px rgba(16,33,61,.08)}
        .gap-label{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#c2410c}
        .gap-main{font-size:28px;font-weight:900;color:#7c2d12;margin-top:8px}
        .gap-meta{font-size:13px;color:#9a3412;margin-top:6px}
        .gap-badge{display:inline-flex;margin-top:12px;padding:8px 12px;border-radius:999px;background:#fff;color:#c2410c;border:1px solid #fdba74;font-size:15px;font-weight:800}
        .gomuz-card{margin:0 0 20px;border-radius:16px;padding:16px 18px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 58%,#334155 100%);border:1px solid #facc15;box-shadow:0 10px 24px rgba(16,33,61,.12);color:#fff;position:relative;overflow:hidden}
        .gomuz-card:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 16% 18%,rgba(250,204,21,.22),transparent 32%),radial-gradient(circle at 86% 76%,rgba(56,189,248,.18),transparent 34%);pointer-events:none}
        .gomuz-label,.gomuz-main,.gomuz-meta,.gomuz-badge{position:relative}
        .gomuz-label{font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#fde68a}
        .gomuz-main{font-size:28px;font-weight:900;color:#fff7ed;margin-top:8px}
        .gomuz-meta{font-size:13px;color:#dbeafe;margin-top:6px}
        .gomuz-badge{display:inline-flex;margin-top:12px;padding:8px 12px;border-radius:999px;background:rgba(250,204,21,.16);color:#fef3c7;border:1px solid rgba(250,204,21,.55);font-size:15px;font-weight:900}
        .scenario{margin:0 0 20px;border-radius:16px;padding:18px 20px;background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);border:1px solid #93c5fd;box-shadow:0 10px 24px rgba(16,33,61,.08)}
        .scenario-label{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#1d4ed8}
        .scenario-title{font-size:24px;font-weight:900;color:#10213d;margin-top:8px}
        .scenario-copy{font-size:14px;line-height:1.5;color:#1e3a5f;margin-top:10px}
        .list{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 24px rgba(16,33,61,.08);padding:10px 14px;border:1px solid #dfe7f2}
        .lb-head{display:grid;grid-template-columns:7% 30% 11% 12% 16% 24%;gap:6px;padding:8px 4px 10px;color:#607189;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid #dfe7f2}
        .lb-row{display:grid;grid-template-columns:7% 30% 11% 12% 16% 24%;align-items:center;gap:6px;padding:8px 4px;border-bottom:1px solid #e5ebf4}
        .lb-row:last-child{border-bottom:none}
        .lb-row:nth-child(odd){background:#f7faff}
        .rank{font-size:22px;font-weight:800;color:#10213d;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px}
        .move{font-size:11px;font-weight:700}
        .move.up{color:#16a34a}
        .move.down{color:#dc2626}
        .move.neutral{color:#6b7280}
        .team-cell{display:flex;align-items:center;gap:10px;min-width:0}
        .logo{width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid #d9e5f4;background:#fff}
        .logo-fallback{display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;background:linear-gradient(135deg,#ff6b35 0%,#0ea5e9 100%);color:#fff}
        .team-meta{min-width:0}
.team-name{font-size:15px;font-weight:800;color:#10213d;line-height:1.2}
.user-name{font-size:11px;color:#607189;margin-top:2px}
        .team-tag{display:inline-flex;margin-top:4px;padding:3px 8px;border-radius:999px;background:#fff7ed;border:1px solid #fed7aa;color:#c2410c;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
        .points-cell{text-align:right}
        .points-cell.last-col{text-align:left;padding-left:6px}
        .pts{font-size:18px;font-weight:800;color:#ff6b35;line-height:1}
        .pts.total{color:#10213d}
        .team-name{font-size:16px;font-weight:800;color:#10213d;line-height:1.2}
        .user-name{font-size:12px;color:#607189;margin-top:2px}
        .foot{margin-top:16px;font-size:12px;color:#6c7b90}
        @media print{
          body{background:#edf3fb}
          .hero,.stat,.mover-card,.list,.lb-row:nth-child(odd),.logo-fallback{box-shadow:none !important}
        }
        @page{size:A4 portrait;margin:14mm}
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="hero">
          <div class="eyebrow">IFL 2026 Daily Export</div>
          <h1>Leaderboard Report</h1>
          <div class="sub">Generated on ${escapeHtml(generatedAt)}</div>
        </div>
        <div class="stats">
          <div class="stat"><div class="v">${predictionAccuracy}</div><div class="l">Prediction Accuracy</div></div>
          <div class="stat"><div class="v">${escapeHtml(mvpLabel)}</div><div class="l">MVP In Last Game</div></div>
          <div class="stat"><div class="v">${escapeHtml(differencePlayer)}</div><div class="l">Difference Maker</div></div>
          <div class="stat"><div class="v">${escapeHtml(nextPopular)}</div><div class="l">Most Popular In Next Game</div></div>
        </div>
        ${moversHtml ? `<div class="movers">${moversHtml}</div>` : ""}
        ${rankGapHtml}
        ${straitOfGomuzHtml}
        ${whatCanChangeToday ? `<div class="scenario"><div class="scenario-label">What Can Change Today</div><div class="scenario-title">Match ${whatCanChangeToday.match.id}: ${escapeHtml(whatCanChangeToday.match.teamAabbr)} vs ${escapeHtml(whatCanChangeToday.match.teamBabbr)}</div><div class="scenario-copy">${escapeHtml(whatCanChangeToday.summary)}</div></div>` : ""}
        <div class="list">
          <div class="lb-head"><div>Rank</div><div>Team</div><div>Last Earned</div><div>Total Points</div><div>Last Prediction</div><div>Prediction Points</div></div>
          ${htmlRows || '<div class="lb-row"><div></div><div class="team-name">No leaderboard data available</div><div></div><div></div><div></div><div></div></div>'}
        </div>
        <div class="foot">Use Print → Save as PDF to keep the daily leaderboard archive.</div>
      </div>
    </body>
  </html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}

async function openSwapValidationPdfExport(rows, users = {}, players = [], matches = []) {
  const generatedAt = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const playerById = new Map(players.map((p) => [Number(p.id), p]));
  const matchById = new Map(matches.map((m) => [Number(m.id), m]));
  const grouped = rows.reduce((acc, row) => {
    const key = `${row.username || "?"}::${row.window?.id || row.window_id || "?"}`;
    if (!acc[key]) acc[key] = { username: row.username || "", window: row.window || {}, swaps: [] };
    acc[key].swaps.push(row);
    return acc;
  }, {});
  const groups = Object.values(grouped);

  const htmlRows = groups.map((group, idx) => {
    const displayName = users[group.username]?.teamName || group.username || "Unknown User";
    const status = group.swaps.every((swap) => Number(swap.is_validated) === 1) ? "Validated" : "Pending";
    const swapsHtml = group.swaps.map((swap) => {
      const outPlayer = playerById.get(Number(swap.out_player_id));
      const inPlayer = playerById.get(Number(swap.in_player_id));
      const match = matchById.get(Number(group.window?.effective_match_id || swap.effective_match_id || 0));
      const matchText = match ? `Match ${match.id} · ${match.teamAabbr} vs ${match.teamBabbr}` : "Match N/A";
      return `
        <tr>
          <td>${escapeHtml(outPlayer ? `${outPlayer.name} (${outPlayer.team}, ${outPlayer.role})` : `#${swap.out_player_id}`)}</td>
          <td>${escapeHtml(inPlayer ? `${inPlayer.name} (${inPlayer.team}, ${inPlayer.role})` : `#${swap.in_player_id}`)}</td>
          <td>${escapeHtml(matchText)}</td>
          <td>${escapeHtml(Number(swap.is_validated) === 1 ? "Validated" : "Pending")}</td>
        </tr>
      `;
    }).join("");
    return `
      <section class="swap-card">
        <div class="swap-head">
          <div>
            <div class="swap-rank">#${idx + 1}</div>
            <div class="swap-name">${escapeHtml(displayName)}</div>
            <div class="swap-window">${escapeHtml(group.window?.name || `Window ${group.window?.id || "-"}`)} · ${escapeHtml(group.window?.start_at || "-")} → ${escapeHtml(group.window?.lock_at || "-")}</div>
          </div>
          <div class="swap-status ${status.toLowerCase()}">${escapeHtml(status)}</div>
        </div>
        <table class="swap-table">
          <thead><tr><th>Out</th><th>In</th><th>Match</th><th>Status</th></tr></thead>
          <tbody>${swapsHtml}</tbody>
        </table>
      </section>
    `;
  }).join("");

  const win = window.open("about:blank", "_blank", "width=1180,height=860");
  if (!win) throw new Error("Popup blocked. Allow popups to export PDF.");
  try { win.opener = null; } catch {}
  win.document.write(`<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>IFL 2026 Swap Validation Report</title>
      <style>
        body{font-family:Arial,sans-serif;margin:0;color:#142033;background:#f4f7fb}
        .wrap{padding:28px}
        .hero{padding:28px 32px;border-radius:18px;background:linear-gradient(135deg,#10213d,#1a3155 58%,#10213d);color:#fff}
        .eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;opacity:.78}
        h1{margin:10px 0 6px;font-size:34px}
        .sub{opacity:.85;font-size:14px}
        .swap-card{background:#fff;border-radius:16px;padding:16px 18px;margin-top:16px;box-shadow:0 10px 24px rgba(16,33,61,.08);break-inside:avoid}
        .swap-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:12px}
        .swap-rank{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#607189;font-weight:700}
        .swap-name{font-size:20px;font-weight:800;color:#10213d;margin-top:2px}
        .swap-window{font-size:12px;color:#607189;margin-top:4px}
        .swap-status{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:8px 12px;border-radius:999px}
        .swap-status.validated{background:#dcfce7;color:#166534}
        .swap-status.pending{background:#ffedd5;color:#c2410c}
        .swap-table{width:100%;border-collapse:collapse}
        .swap-table th{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#607189;padding:10px 12px;text-align:left;border-bottom:1px solid #dfe7f2}
        .swap-table td{font-size:13px;padding:10px 12px;border-bottom:1px solid #edf2f7;vertical-align:top}
        .swap-table tr:last-child td{border-bottom:none}
        .foot{margin-top:16px;font-size:12px;color:#6c7b90}
        @page{size:A4 portrait;margin:12mm}
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="hero">
          <div class="eyebrow">IFL 2026 Admin Export</div>
          <h1>Swap Validation Report</h1>
          <div class="sub">Generated on ${escapeHtml(generatedAt)}</div>
        </div>
        ${htmlRows || '<section class="swap-card"><div class="swap-name">No swaps submitted yet</div></section>'}
        <div class="foot">Use Print → Save as PDF to archive swap validations.</div>
      </div>
    </body>
  </html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}

const load = (k, def) => (DB_CACHE[k] !== undefined ? DB_CACHE[k] : def);
const getPlayers = () => load("ifl_master_players", DEFAULT_PLAYERS);
const getMatches = () => load("ifl_master_matches", DEFAULT_MATCHES);
const getMatchStats = () => load("ifl_match_stats", {});
const getSwapWindows = () => load("ifl_swap_windows", []);
const getPlayoffsPredictions = () => load("ifl_playoffs_predictions", {});
const getAllowedPhones = () => load("ifl_allowed_phones", []);
const getGlobalTeamCode = () => normalizeTeamCode(load("ifl_global_team_code", DEFAULT_GLOBAL_TEAM_CODE));
const normalizePhone = (v) => String(v || "").replace(/\D/g, "");
const isValidPhone = (v) => v.length >= 10 && v.length <= 15;
const normalizeTeamCode = (v) => String(v || "").trim().toUpperCase();
const formatElapsed = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

const formatRelativeTime = (value) => {
  const ts = new Date(value || "").getTime();
  if (!Number.isFinite(ts) || ts <= 0) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
};

const TEAM_LOGO_LIMITS = {
  ACCEPT: "image/png,image/jpeg,image/webp",
  MAX_FILE_BYTES: 2 * 1024 * 1024, // 2MB input cap
  MIN_DIMENSION: 200, // minimum source quality
  OUTPUT_SIZE: 256, // stored square size for fast leaderboard rendering
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Invalid image file"));
    img.src = dataUrl;
  });
}

async function prepareTeamLogo(file) {
  if (!file) throw new Error("Please choose an image");
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Use PNG, JPG, or WEBP image");
  }
  if (file.size > TEAM_LOGO_LIMITS.MAX_FILE_BYTES) {
    throw new Error("Image must be 2MB or smaller");
  }

  const inputUrl = await readFileAsDataUrl(file);
  const img = await loadImage(inputUrl);
  if (img.naturalWidth < TEAM_LOGO_LIMITS.MIN_DIMENSION || img.naturalHeight < TEAM_LOGO_LIMITS.MIN_DIMENSION) {
    throw new Error("Image should be at least 200x200 px");
  }

  const target = TEAM_LOGO_LIMITS.OUTPUT_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to process image");

  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = Math.floor((img.naturalWidth - side) / 2);
  const sy = Math.floor((img.naturalHeight - side) / 2);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target);

  return canvas.toDataURL("image/webp", 0.86);
}

const POINT_RULES = {
  RUN: 1,
  CATCH: 5,
  RUNOUT_STUMPING: 10,
  WICKET: 20,
  BONUS_3_WICKETS: 25,
  BONUS_4_WICKETS: 50,
  BONUS_5_WICKETS: 100,
  BONUS_50_RUNS: 25,
  BONUS_75_RUNS: 50,
  BONUS_100_RUNS: 100,
  MAN_OF_MATCH: 50,
  MATCH_WINNER_PICK: 50,
};

const n = (v) => Math.max(0, Number(v) || 0);

function scorePlayerPerformance(stat = {}) {
  const runs = n(stat.runs);
  const catches = n(stat.catches);
  const runouts = n(stat.runouts);
  const wickets = n(stat.wickets);

  let bonusRuns = 0;
  if (runs >= 100) bonusRuns = POINT_RULES.BONUS_100_RUNS;
  else if (runs >= 75) bonusRuns = POINT_RULES.BONUS_75_RUNS;
  else if (runs >= 50) bonusRuns = POINT_RULES.BONUS_50_RUNS;

  let bonusWickets = 0;
  if (wickets >= 5) bonusWickets = POINT_RULES.BONUS_5_WICKETS;
  else if (wickets >= 4) bonusWickets = POINT_RULES.BONUS_4_WICKETS;
  else if (wickets >= 3) bonusWickets = POINT_RULES.BONUS_3_WICKETS;

  return (
    runs * POINT_RULES.RUN +
    catches * POINT_RULES.CATCH +
    runouts * POINT_RULES.RUNOUT_STUMPING +
    wickets * POINT_RULES.WICKET +
    bonusRuns +
    bonusWickets
  );
}

const normalizePlayerNameKey = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const toImportNum = (v) => Math.max(0, Number(v) || 0);

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\"") {
      if (inQ && line[i + 1] === "\"") {
        cur += "\"";
        i += 1;
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseManualScoreImport(rawText) {
  const raw = String(rawText || "")
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .trim();
  if (!raw) return { rows: [], motm: "", winner: "" };

  const extractFirstJsonObject = (text) => {
    const value = String(text || "").trim();
    const start = value.search(/[\[{]/);
    if (start < 0) return "";
    const open = value[start];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < value.length; i += 1) {
      const ch = value[i];
      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === "\\") {
          escape = true;
        } else if (ch === "\"") {
          inString = false;
        }
        continue;
      }
      if (ch === "\"") {
        inString = true;
        continue;
      }
      if (ch === open) depth += 1;
      if (ch === close) {
        depth -= 1;
        if (depth === 0) return value.slice(start, i + 1);
      }
    }
    return "";
  };

  const mapImportRow = (row, fallbackName = "") => {
    if (!row || typeof row !== "object") return null;
    const rawName = row?.name ?? row?.player ?? fallbackName ?? "";
    const name = typeof rawName === "string" || typeof rawName === "number" ? String(rawName).trim() : "";
    if (!name) return null;
    return {
      name,
      runs: toImportNum(row?.runs),
      catches: toImportNum(row?.catches),
      runouts: toImportNum(row?.runouts ?? row?.runOuts ?? row?.runout ?? row?.run_outs),
      wickets: toImportNum(row?.wickets),
    };
  };

  const parseMaybeJson = (value, depth = 0) => {
    if (depth > 2) return value;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    try {
      return parseMaybeJson(JSON.parse(trimmed), depth + 1);
    } catch {
      const extracted = extractFirstJsonObject(trimmed);
      if (extracted && extracted !== trimmed) {
        try {
          return parseMaybeJson(JSON.parse(extracted), depth + 1);
        } catch {}
      }
      return value;
    }
  };

  const parseRowsFromObject = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    if (Array.isArray(obj)) {
      return obj.map((r) => mapImportRow(r)).filter(Boolean);
    }
    if (Array.isArray(obj.players)) {
      return obj.players.map((r) => mapImportRow(r)).filter(Boolean);
    }
    if (Array.isArray(obj.playerStats)) {
      return obj.playerStats.map((r) => mapImportRow(r)).filter(Boolean);
    }
    if (typeof obj.players === "string") {
      const nestedPlayers = parseMaybeJson(obj.players);
      if (nestedPlayers && nestedPlayers !== obj.players) {
        const nestedRows = parseRowsFromObject({ ...obj, players: nestedPlayers });
        if (nestedRows && nestedRows.length) return nestedRows;
      }
    }
    if (obj.players && typeof obj.players === "object" && !Array.isArray(obj.players)) {
      return Object.entries(obj.players)
        .map(([k, v]) => mapImportRow(v, k))
        .filter(Boolean);
    }
    for (const key of ["data", "result", "payload", "response", "draft", "value"]) {
      const nested = parseMaybeJson(obj[key]);
      if (nested && typeof nested === "object") {
        const nestedRows = Array.isArray(nested) ? nested.map((r) => mapImportRow(r)).filter(Boolean) : parseRowsFromObject(nested);
        if (nestedRows && nestedRows.length) return nestedRows;
      }
    }
    const values = Object.values(obj);
    const hasNestedObject = values.some((v) => v && typeof v === "object" && !Array.isArray(v));
    if (!hasNestedObject) return null;
    return Object.entries(obj)
      .filter(([k]) => !["winner", "winningTeam", "motm", "manOfTheMatch", "motmPlayer", "players", "playerStats"].includes(String(k)))
      .map(([, v]) => mapImportRow(v))
      .filter(Boolean);
  };

  try {
    let parsed;
    try {
      parsed = parseMaybeJson(JSON.parse(raw));
    } catch {
      const extracted = extractFirstJsonObject(raw);
      if (!extracted) throw new Error("No JSON found");
      parsed = parseMaybeJson(JSON.parse(extracted));
    }
    const rows = Array.isArray(parsed)
      ? parsed.map((r) => mapImportRow(r)).filter(Boolean)
      : (parseRowsFromObject(parsed) || []);
    const metaRoot = (parsed && typeof parsed === "object")
      ? (parsed.data && typeof parsed.data === "object" ? parsed.data
        : parsed.result && typeof parsed.result === "object" ? parsed.result
          : parsed.payload && typeof parsed.payload === "object" ? parsed.payload
            : parsed)
      : {};
    const motm = String(metaRoot?.motm || metaRoot?.manOfTheMatch || metaRoot?.motmPlayer || "").trim();
    const winner = String(metaRoot?.winner || metaRoot?.winningTeam || "").trim();
    return { rows, motm, winner };
  } catch {
    const lines = raw.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    if (!lines.length) return { rows: [], motm: "", winner: "" };

    let start = 0;
    const hdr = parseCsvLine(lines[0]).map((x) => x.toLowerCase());
    const hasHeader = hdr.includes("name") || hdr.includes("player");
    if (hasHeader) start = 1;

    const rows = [];
    for (let i = start; i < lines.length; i += 1) {
      const c = parseCsvLine(lines[i]);
      const name = String(c[0] || "").trim();
      if (!name) continue;
      rows.push({
        name,
        runs: toImportNum(c[1]),
        catches: toImportNum(c[2]),
        runouts: toImportNum(c[3]),
        wickets: toImportNum(c[4]),
      });
    }
    return { rows, motm: "", winner: "" };
  }
}

function recomputeAndPersistUsers() {
  const users = JSON.parse(JSON.stringify(load("ifl_users", {})));
  const matches = getMatches();
  const matchStats = getMatchStats();
  const swapWindows = getSwapWindows();

  const resolveSwapRows = (user) => {
    const rows = [];
    if (user?.swapWindows && typeof user.swapWindows === "object") {
      Object.entries(user.swapWindows).forEach(([wid, val]) => {
        const w = swapWindows.find((sw) => String(sw.id) === String(wid));
        const eff = Number(w?.effective_match_id || 0);
        const out = (val?.out || []).map(Number);
        const ins = (val?.in || []).map(Number);
        if (eff > 0 && out.length && ins.length) rows.push({ windowId: Number(wid), eff, out, ins });
      });
    } else if ((user.swap1Out || []).length || (user.swap1In || []).length) {
      const eff = Number(swapWindows[0]?.effective_match_id || 0);
      rows.push({ windowId: Number(swapWindows[0]?.id || 0), eff, out: (user.swap1Out || []).map(Number), ins: (user.swap1In || []).map(Number) });
    }
    return rows.sort((a, b) => a.eff - b.eff);
  };

  const effectiveSquadForMatch = (baseIds, swapRows, matchId) => {
    const set = new Set(baseIds);
    swapRows.forEach((row) => {
      if (matchId >= row.eff) {
        row.out.forEach((pid) => set.delete(pid));
        row.ins.forEach((pid) => set.add(pid));
      }
    });
    return set;
  };

  Object.entries(users).forEach(([, user]) => {
    const hasPrivateSquadData =
      Array.isArray(user.players) ||
      !!(user.playerSubmittedAt && typeof user.playerSubmittedAt === "object") ||
      !!(user.swapWindows && typeof user.swapWindows === "object") ||
      !!(user.predictions && typeof user.predictions === "object");
    if (!hasPrivateSquadData) return;

    const baseIds = (user.players || []).map(Number);
    const swapRows = resolveSwapRows(user);
    const frozenPoints = [];
    const submittedMap = user.playerSubmittedAt || {};
    const predictions = user.predictions || {};
    let totalPoints = 0;

    matches.forEach((match) => {
      const matchId = Number(match.id);
      const effectiveSquad = effectiveSquadForMatch(baseIds, swapRows, matchId);

      const mid = String(match.id);
      const mStat = matchStats[mid] || {};
      const pStats = mStat.players || {};
      const pred = predictions[mid];
      let matchPoints = 0;

      if (match.winner) {
        if (pred?.pick) {
          if (match.winner === "NR") {
            pred.correct = null;
            pred.pts = 0;
          } else {
            const ok = pred.pick === match.winner;
            pred.correct = ok;
            pred.pts = ok ? POINT_RULES.MATCH_WINNER_PICK : 0;
            matchPoints += pred.pts;
          }
        }
      } else if (pred) {
        pred.correct = null;
        pred.pts = 0;
      }

      Object.entries(pStats).forEach(([pid, stat]) => {
        const npid = Number(pid);
        const submittedAt = parseLocalDateTime(submittedMap[npid]);
        const matchTs = parseLocalDateTime(match.date);
        if (submittedAt && matchTs && matchTs < submittedAt) return;
        const pts = scorePlayerPerformance(stat);
        if (effectiveSquad.has(npid)) matchPoints += pts;
      });

      if (mStat.motmPlayerId && effectiveSquad.has(Number(mStat.motmPlayerId))) {
        const mpid = Number(mStat.motmPlayerId);
        const submittedAt = parseLocalDateTime(submittedMap[mpid]);
        const matchTs = parseLocalDateTime(match.date);
        if (!(submittedAt && matchTs && matchTs < submittedAt)) {
          matchPoints += POINT_RULES.MAN_OF_MATCH;
        }
      }
      totalPoints += matchPoints;
    });

    swapRows.forEach((row) => {
      row.out.forEach((pid) => {
        const player = getPlayers().find((p) => Number(p.id) === Number(pid));
        let pts = 0;
        matches.forEach((match) => {
          const matchId = Number(match.id);
          if (matchId >= Number(row.eff)) return;
          const mid = String(match.id);
          const mStat = matchStats[mid] || {};
          const pStats = mStat.players || {};
          const stat = pStats[String(pid)];
          const submittedAt = parseLocalDateTime(submittedMap[pid]);
          const matchTs = parseLocalDateTime(match.date);
          if (submittedAt && matchTs && matchTs < submittedAt) return;
          if (stat) pts += scorePlayerPerformance(stat);
          if (Number(mStat.motmPlayerId || 0) === Number(pid)) {
            if (!(submittedAt && matchTs && matchTs < submittedAt)) pts += POINT_RULES.MAN_OF_MATCH;
          }
        });
        frozenPoints.push({
          playerId: Number(pid),
          playerName: player?.name || `#${pid}`,
          team: player?.team || "",
          role: player?.role || "",
          points: pts,
          effectiveMatchId: Number(row.eff),
          windowId: Number(row.windowId || 0),
        });
      });
    });
    frozenPoints.sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0) || String(a.playerName).localeCompare(String(b.playerName)));

    user.predictions = predictions;
    user.points = totalPoints;
    user.swap1FrozenPoints = frozenPoints;
  });

  DB_CACHE.ifl_users = users;
  return users;
}

async function recomputeAndSaveUsersStrict(adminToken) {
  if (adminToken) {
    await adminRecomputeUserPoints(adminToken);
    await bootstrapStore({ adminToken });
    return load("ifl_users", {});
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await bootstrapStore({ adminToken });
    const currentUsers = load("ifl_users", {});
    Object.values(currentUsers).forEach((u) => {
      const map = u.playerSubmittedAt || {};
      if (!u.players || u.players.length === 0) return;
      if (Object.keys(map).length === 0) {
        const ts = nowLocalMatchTs();
        u.players.forEach((pid) => { map[pid] = map[pid] || ts; });
        u.playerSubmittedAt = map;
      }
    });
    const users = recomputeAndPersistUsers();
    try {
      const points = {};
      Object.entries(users).forEach(([un, u]) => {
        points[un] = Number(u.points || 0);
      });
      await adminUpdateUserPoints(adminToken, points);
      return users;
    } catch (e) {
      if (e?.code === "STALE_WRITE" && attempt === 0) continue;
      throw e;
    }
  }
  return recomputeAndPersistUsers();
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const STYLES = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#050912;--surface:#0d1424;--surface-hi:#172341;--surface-deep:#08111f;--sf2:#101a2f;--border:#22314e;--border-hi:#35527d;--acc:#ff5c39;--acc2:#00b7ff;--gold:#ffb800;--text:#ecf3ff;--muted:#8ca2c0;--ok:#20c997;--err:#ff5470;--adm:#7a6cff;--shadow-soft:0 16px 36px rgba(0,0,0,.28);--shadow-hard:0 30px 70px rgba(0,0,0,.42);--glow-cyan:0 0 0 1px rgba(0,183,255,.18),0 0 28px rgba(0,183,255,.12);--glow-orange:0 0 0 1px rgba(255,92,57,.16),0 0 30px rgba(255,92,57,.12);--ipl-bg:url('https://documents.iplt20.com/bcci/articles/1763186102_trade-thumbnail.png');--login-hero:url('/main_page.jpg')}
body{background:
radial-gradient(1200px 600px at 100% -10%,rgba(0,183,255,.18),transparent 60%),
radial-gradient(900px 500px at -20% 20%,rgba(255,92,57,.16),transparent 55%),
linear-gradient(rgba(5,9,18,.78),rgba(5,9,18,.9)),
var(--ipl-bg) center/cover no-repeat fixed,
linear-gradient(145deg,#050912 0%,#070f1f 45%,#06101f 100%);
color:var(--text);font-family:"Barlow Condensed","Oswald","Segoe UI",sans-serif;min-height:100vh}
h1,h2,h3,h4{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;letter-spacing:.04em}

.btn{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-weight:700;letter-spacing:.12em;text-transform:uppercase;border:none;cursor:pointer;padding:10px 22px;border-radius:999px;font-size:15px;transition:transform .24s ease,box-shadow .24s ease,border-color .24s ease,filter .24s ease;display:inline-flex;align-items:center;gap:6px;position:relative;isolation:isolate}
.btn::before{content:"";position:absolute;inset:1px;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.18),transparent 42%);opacity:.7;pointer-events:none;z-index:-1}
.btn-primary{background:linear-gradient(180deg,#ff8455,#ff5c39 50%,#df4728 100%);color:#fff;box-shadow:0 12px 26px rgba(255,92,57,.28),inset 0 1px 0 rgba(255,255,255,.2)}.btn-primary:hover{transform:translateY(-2px) scale(1.015);box-shadow:0 18px 34px rgba(255,92,57,.36),0 0 26px rgba(255,92,57,.14)}
.btn-secondary{background:linear-gradient(180deg,#1d2c4a,#101b33 70%,#0b1426);color:var(--text);border:1px solid var(--border-hi);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 12px 24px rgba(0,0,0,.18)}.btn-secondary:hover{border-color:var(--acc2);color:#dff6ff;transform:translateY(-2px);box-shadow:var(--glow-cyan),var(--shadow-soft)}
.btn-danger{background:linear-gradient(180deg,#ff6c8b,#ff5470 55%,#dd3553);color:#fff;box-shadow:0 12px 26px rgba(255,84,112,.22),inset 0 1px 0 rgba(255,255,255,.16)}.btn-danger:hover{transform:translateY(-2px)}
.btn-adm{background:linear-gradient(180deg,#8b7cff,#7168ff 55%,#544bdb);color:#fff;box-shadow:0 12px 24px rgba(122,108,255,.3),inset 0 1px 0 rgba(255,255,255,.16)}.btn-adm:hover{transform:translateY(-2px);box-shadow:0 16px 32px rgba(122,108,255,.38)}
.btn-ok{background:var(--ok);color:#fff}
.btn-sm{padding:6px 14px;font-size:12px}.btn-xs{padding:4px 10px;font-size:11px}

.card,.lcard,.tw,.mc,.lbr,.lb-pod,.modal,.confirm-box,.prof-hdr,.logo-panel,.import-box,.astat{position:relative;overflow:hidden}
.card{background:linear-gradient(160deg,rgba(23,35,65,.92),rgba(11,19,35,.97) 58%,rgba(8,17,31,.99));border:1px solid var(--border-hi);border-radius:16px;padding:20px;box-shadow:var(--shadow-soft),inset 0 1px 0 rgba(255,255,255,.08);transform:translateZ(0);transition:transform .28s ease,box-shadow .28s ease,border-color .28s ease}
.card::before,.lcard::before,.tw::before,.mc::before,.lbr::before,.lb-pod::after,.modal::before,.confirm-box::before,.prof-hdr::before,.logo-panel::before,.import-box::before,.astat::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.08),transparent 24%,transparent 76%,rgba(0,0,0,.1));pointer-events:none}
.card::after,.lcard::after,.tw::after,.mc::after,.lbr::after,.modal::after,.confirm-box::after,.prof-hdr::after{content:"";position:absolute;inset:auto 16px 0 16px;height:24px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,.28),transparent 72%);filter:blur(8px);opacity:.6;pointer-events:none}
.card:hover{transform:translateY(-3px);box-shadow:var(--shadow-hard),var(--glow-cyan)}
.tag{font-size:10px;font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:2px 8px;border-radius:999px}
.soft-link{font-family:"Rajdhani","Barlow Condensed","Segoe UI",sans-serif;font-size:12px;color:var(--acc2);text-decoration:none;border-bottom:1px dashed rgba(0,183,255,.4);padding-bottom:1px}
.soft-link:hover{color:#dff6ff;border-bottom-color:rgba(223,246,255,.7)}

input,select,textarea{background:var(--sf2);border:1px solid var(--border);color:var(--text);padding:10px 14px;border-radius:10px;font-family:"Barlow Condensed","Segoe UI",sans-serif;font-size:15px;width:100%;outline:none;transition:border .2s,box-shadow .2s}
input:focus,select:focus,textarea:focus{border-color:var(--acc2);box-shadow:0 0 0 3px rgba(0,183,255,.14)}
input::placeholder,textarea::placeholder{color:var(--muted)}
label{font-size:12px;font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:5px}
.fg{margin-bottom:16px}
.fr{display:grid;gap:14px}.fr2{grid-template-columns:1fr 1fr}.fr3{grid-template-columns:1fr 1fr 1fr}
.fe{color:var(--err);font-size:12px;margin-top:4px}

.nav{background:linear-gradient(180deg,rgba(10,16,30,.94),rgba(6,11,22,.86));border-bottom:1px solid rgba(53,82,125,.55);backdrop-filter:blur(18px);position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:12px 28px;gap:10px;flex-wrap:wrap;box-shadow:0 12px 28px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.06)}
.nav-logo{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:30px;font-weight:700}
.nav-logo span{color:var(--acc)}.nav-logo .abadge{font-size:11px;background:var(--adm);color:#fff;padding:2px 8px;border-radius:999px;margin-left:8px;vertical-align:middle}
.nav-links{display:flex;gap:4px;flex-wrap:wrap;min-width:0}
.nav-link{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-weight:600;font-size:14px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;padding:7px 14px;border-radius:999px;transition:all .2s;color:var(--muted);border:1px solid transparent}
.nav-link:hover{color:var(--text);background:#0f1a30;border-color:var(--border)}
.nav-link.ua{color:#fff;background:linear-gradient(90deg,rgba(255,92,57,.25),rgba(255,92,57,.12));border-color:rgba(255,92,57,.55)}
.nav-link.aa{color:#fff;background:linear-gradient(90deg,rgba(122,108,255,.28),rgba(122,108,255,.12));border-color:rgba(122,108,255,.58)}

.login-bg{min-height:100vh;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;background:
radial-gradient(ellipse at 20% 60%,rgba(255,92,57,.13) 0%,transparent 60%),
radial-gradient(ellipse at 80% 30%,rgba(0,183,255,.12) 0%,transparent 60%),
var(--bg)}
.login-bg.login-home{display:block;align-items:initial;justify-content:initial;overflow-x:hidden;overflow-y:auto}
.login-bg::after{content:"";position:absolute;inset:0;background:var(--login-hero) center center/cover no-repeat;z-index:0}
.login-bg::before{content:"";position:absolute;inset:0;background:
linear-gradient(rgba(5,9,18,.54),rgba(5,9,18,.76)),
radial-gradient(ellipse at 20% 60%,rgba(255,92,57,.16) 0%,transparent 60%),
radial-gradient(ellipse at 80% 30%,rgba(0,183,255,.14) 0%,transparent 60%);pointer-events:none;z-index:2}
.login-bg.video-active::before{background:
linear-gradient(rgba(5,9,18,.22),rgba(5,9,18,.46)),
radial-gradient(ellipse at 20% 60%,rgba(255,92,57,.12) 0%,transparent 60%),
radial-gradient(ellipse at 80% 30%,rgba(0,183,255,.1) 0%,transparent 60%)}
.login-bg > *{position:relative;z-index:3}
.login-hero-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.62;pointer-events:none;filter:saturate(1.08) contrast(1.04) brightness(.92);z-index:1}
.login-bg.login-home::after{opacity:.86;filter:saturate(1.02) contrast(1.04)}
.login-bg.login-home::before{background:
linear-gradient(rgba(5,9,18,.36),rgba(5,9,18,.8)),
radial-gradient(ellipse at 20% 60%,rgba(255,92,57,.16),transparent 60%),
radial-gradient(ellipse at 80% 30%,rgba(0,183,255,.14),transparent 60%)}
.login-bg.login-home.video-active::before{background:
linear-gradient(rgba(5,9,18,.2),rgba(5,9,18,.58)),
radial-gradient(ellipse at 20% 60%,rgba(255,92,57,.12),transparent 60%),
radial-gradient(ellipse at 80% 30%,rgba(0,183,255,.1),transparent 60%)}
.login-site{width:min(100%,760px);min-height:100vh;margin:0 auto;border-left:1px solid rgba(255,255,255,.055);border-right:1px solid rgba(255,255,255,.055);background:linear-gradient(180deg,rgba(13,15,26,.72),rgba(13,15,26,.88));box-shadow:0 0 80px rgba(0,0,0,.3)}
.login-topbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(13,15,26,.92);backdrop-filter:blur(10px)}
.login-brand{line-height:1}.login-brand-main{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:32px;letter-spacing:.14em;color:#e8a92e;line-height:.85}.login-brand-sub{font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:rgba(240,237,230,.42);margin-top:3px}
.login-nav-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.login-nav-btn{font-family:"Barlow Condensed","Segoe UI",sans-serif;font-size:12px;letter-spacing:.06em;padding:6px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.02);color:#f0ede6;cursor:pointer;transition:all .2s}
.login-nav-btn:hover{border-color:rgba(232,169,46,.65);background:rgba(232,169,46,.08)}
.login-nav-btn.active{background:#e8a92e;border-color:#e8a92e;color:#0d0f1a;font-weight:700}
.login-layout{padding:42px 20px 26px;display:grid;grid-template-columns:minmax(0,1.06fr) minmax(320px,.94fr);gap:18px;align-items:center}
.login-layout.login-layout-solo{grid-template-columns:1fr;min-height:calc(100vh - 78px);place-items:center;text-align:center}
.login-layout.login-layout-solo .login-copy{text-align:center;max-width:560px}
.login-layout.login-layout-solo .login-desc{margin-left:auto;margin-right:auto}
.login-layout.login-layout-solo .login-cta-row{justify-content:center}
.login-copy{position:relative;text-align:left;padding:8px 0}
.login-copy::before{content:"";position:absolute;inset:-28px -18px auto -18px;height:260px;background:radial-gradient(ellipse 70% 52% at 44% 0%,rgba(91,140,255,.15),transparent 72%);pointer-events:none}
.login-flash-rotator{position:relative;margin-top:18px;height:22px;font-family:"Barlow Condensed","Segoe UI",sans-serif;font-size:14px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#f0ede6;text-shadow:0 0 18px rgba(232,169,46,.38);overflow:hidden}
.login-flash-rotator span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transform:translateY(10px);animation:landingPhraseCycle 6.6s ease-in-out infinite}
.login-flash-rotator span:nth-child(2){animation-delay:2.2s}
.login-flash-rotator span:nth-child(3){animation-delay:4.4s}
@keyframes landingPhraseCycle{0%{opacity:0;transform:translateY(10px);filter:brightness(.9)}10%,27%{opacity:1;transform:translateY(0);filter:brightness(1.28)}38%,100%{opacity:0;transform:translateY(-10px);filter:brightness(.9)}}
.spartan-hero-logo{width:132px;height:132px;margin:0 auto 16px;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle at 42% 28%,rgba(255,241,180,.2),rgba(232,169,46,.09) 38%,rgba(13,15,26,.38) 72%);border:1px solid rgba(232,169,46,.42);box-shadow:0 0 34px rgba(232,169,46,.18),inset 0 1px 0 rgba(255,255,255,.12);perspective:620px;animation:spartanGlow 3.8s ease-in-out infinite;overflow:visible}
.spartan-hero-logo img{width:172px;height:172px;object-fit:contain;display:block;filter:drop-shadow(0 16px 24px rgba(0,0,0,.62));transform-origin:50% 50%;animation:spartanRotate 5.8s ease-in-out infinite}
@keyframes spartanRotate{0%,100%{transform:translateX(-8px) rotateY(-16deg) rotateX(4deg) rotateZ(-1deg) scale(1)}50%{transform:translateX(-8px) rotateY(16deg) rotateX(-2deg) rotateZ(1deg) scale(1.04)}}
@keyframes spartanGlow{0%,100%{box-shadow:0 0 24px rgba(232,169,46,.14),inset 0 1px 0 rgba(255,255,255,.1)}50%{box-shadow:0 0 48px rgba(232,169,46,.32),inset 0 1px 0 rgba(255,255,255,.16)}}
.season-badge{position:relative;display:inline-flex;align-items:center;gap:7px;font-family:"Barlow Condensed","Segoe UI",sans-serif;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8fb1ff;border:1px solid rgba(91,140,255,.38);padding:5px 14px;border-radius:999px;margin-bottom:20px;background:rgba(91,140,255,.07)}
.season-badge span{width:6px;height:6px;border-radius:50%;background:#5b8cff;box-shadow:0 0 12px rgba(91,140,255,.7);animation:pulse 1.8s ease-in-out infinite}
.login-title{position:relative;font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:clamp(62px,10vw,86px);letter-spacing:.08em;line-height:.8;color:#f0ede6;text-transform:uppercase;margin-bottom:10px;text-shadow:0 18px 44px rgba(0,0,0,.34)}
.login-title em{font-style:normal;color:#e8a92e}
.login-year{font-family:"Rajdhani","Barlow Condensed","Segoe UI",sans-serif;font-size:13px;letter-spacing:.24em;text-transform:uppercase;color:rgba(240,237,230,.42);margin-bottom:18px}
.login-desc{font-size:15px;line-height:1.6;color:rgba(240,237,230,.68);max-width:390px;margin-bottom:22px}
.login-cta-row{display:flex;gap:10px;flex-wrap:wrap}
.login-mini-btn{font-family:"Barlow Condensed","Segoe UI",sans-serif;font-size:13px;letter-spacing:.07em;font-weight:700;text-transform:uppercase;padding:10px 22px;border-radius:5px;cursor:pointer;border:1px solid rgba(240,237,230,.22);background:transparent;color:#f0ede6;transition:all .18s}
.login-mini-btn.primary{background:#e8a92e;border-color:#e8a92e;color:#0d0f1a}.login-mini-btn:hover{transform:translateY(-1px);border-color:#5b8cff}
.login-ticker{border-top:1px solid rgba(91,140,255,.22);border-bottom:1px solid rgba(91,140,255,.22);background:rgba(91,140,255,.065);overflow:hidden;white-space:nowrap}
.login-ticker-inner{display:inline-flex;gap:36px;padding:9px 0;animation:tickerScroll 24s linear infinite}
.login-ticker-item{font-family:"Rajdhani","Barlow Condensed","Segoe UI",sans-serif;font-size:12px;letter-spacing:.07em;color:rgba(240,237,230,.68)}.login-ticker-item strong{color:#e8a92e;font-weight:700}
@keyframes tickerScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.login-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,.08);margin:0 0 26px}
.login-stat{background:rgba(13,15,26,.92);padding:17px 10px;text-align:center}.login-stat-num{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:34px;line-height:1;color:#e8a92e;letter-spacing:.04em}.login-stat-label{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:rgba(240,237,230,.42);margin-top:3px}
.login-feature-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:0 20px 30px}
.login-feature{border:1px solid rgba(255,255,255,.08);border-radius:6px;background:rgba(19,22,42,.76);padding:14px}.login-feature-k{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:22px;letter-spacing:.08em;color:#f0ede6;line-height:1}.login-feature-v{font-size:11px;line-height:1.45;color:rgba(240,237,230,.52);margin-top:5px}
.adm-login-bg{min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 30% 50%,rgba(122,108,255,.16) 0%,transparent 60%),radial-gradient(ellipse at 70% 30%,rgba(0,183,255,.09) 0%,transparent 60%),var(--bg)}
.lcard{width:430px;border-radius:22px;background:linear-gradient(165deg,rgba(22,34,63,.92),rgba(8,15,29,.96));border:1px solid rgba(53,82,125,.65);box-shadow:var(--shadow-hard),0 0 0 1px rgba(255,255,255,.04);animation:floatIn .6s ease both}
.login-card{width:100%;max-width:390px;justify-self:end;border-radius:8px;background:linear-gradient(180deg,rgba(26,30,56,.94),rgba(13,15,26,.97));border:1px solid rgba(255,255,255,.1);box-shadow:0 28px 70px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.07)}
.lhero{text-align:center;margin-bottom:32px}
.lhero h1{font-size:56px;font-weight:700;line-height:.9}.lhero h1 span{color:var(--acc)}.lhero h1 span.p{color:var(--adm)}
.lhero p{color:var(--muted);margin-top:8px;font-size:15px}
.login-card .lhero{margin-bottom:20px}.login-card .lhero h1{font-size:42px;letter-spacing:.12em;color:#f0ede6}.login-card .lhero h1 span{color:#e8a92e}.login-card .lhero p{font-size:13px;color:rgba(240,237,230,.52)}
.ltabs{display:flex;background:var(--sf2);border-radius:999px;padding:3px;margin-bottom:24px;border:1px solid var(--border)}
.ltab{flex:1;text-align:center;padding:8px;font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-weight:700;font-size:14px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;border-radius:999px;transition:all .2s;color:var(--muted)}
.ltab.active{background:linear-gradient(90deg,var(--acc),#ff7b2f);color:#fff}
.login-card .ltabs{background:rgba(255,255,255,.035);border-color:rgba(255,255,255,.09);border-radius:999px;margin-bottom:20px}.login-card .ltab.active{background:#e8a92e;color:#0d0f1a}.login-card .ltab{color:rgba(240,237,230,.56)}
.lswitch{text-align:center;margin-top:14px;font-size:13px;color:var(--muted)}
.lswitch span{color:var(--adm);cursor:pointer;text-decoration:underline}
.login-card .lswitch{color:rgba(240,237,230,.5)}.login-card .lswitch span{color:#8fb1ff;text-decoration:none}.login-card label{color:rgba(240,237,230,.5)}.login-card input{background:rgba(13,15,26,.78);border-color:rgba(255,255,255,.1);border-radius:7px;color:#f0ede6}.login-card input:focus{border-color:#5b8cff;box-shadow:0 0 0 3px rgba(91,140,255,.16)}.login-card .btn-primary{background:#e8a92e;color:#0d0f1a;box-shadow:0 14px 28px rgba(232,169,46,.18)}

.uhome-site{max-width:760px;margin:0 auto;background:linear-gradient(180deg,rgba(13,15,26,.42),rgba(13,15,26,.7));border-left:1px solid rgba(255,255,255,.06);border-right:1px solid rgba(255,255,255,.06);box-shadow:0 0 80px rgba(0,0,0,.32);min-height:calc(100vh - 70px);position:relative;z-index:2;backdrop-filter:blur(1px)}
.uhome-hero{padding:46px 20px 34px;text-align:center;position:relative;overflow:hidden}
.uhome-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 62% 45% at 50% 0%,rgba(91,140,255,.16),transparent 72%);pointer-events:none}
.uhome-badge{position:relative;display:inline-flex;align-items:center;gap:7px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8fb1ff;border:1px solid rgba(91,140,255,.38);padding:5px 14px;border-radius:999px;margin-bottom:20px;background:rgba(91,140,255,.07)}
.uhome-badge span{width:6px;height:6px;border-radius:50%;background:#5b8cff;box-shadow:0 0 12px rgba(91,140,255,.7);animation:pulse 1.8s ease-in-out infinite}
.uhome-title{position:relative;font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:clamp(62px,10vw,88px);letter-spacing:.08em;line-height:.82;color:#f0ede6;text-transform:uppercase;text-shadow:0 18px 44px rgba(0,0,0,.34)}
.uhome-title em{font-style:normal;color:#e8a92e}.uhome-year{font-family:"Rajdhani","Barlow Condensed","Segoe UI",sans-serif;font-size:13px;letter-spacing:.24em;text-transform:uppercase;color:rgba(240,237,230,.42);margin:10px 0 18px}
.uhome-desc{position:relative;font-size:15px;line-height:1.6;color:rgba(240,237,230,.68);max-width:420px;margin:0 auto 24px}
.uhome-actions{position:relative;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.uhome-btn{font-family:"Barlow Condensed","Segoe UI",sans-serif;font-size:13px;letter-spacing:.08em;font-weight:700;text-transform:uppercase;padding:10px 22px;border-radius:5px;cursor:pointer;border:1px solid rgba(240,237,230,.22);background:transparent;color:#f0ede6;transition:all .18s}.uhome-btn.primary{background:#e8a92e;border-color:#e8a92e;color:#0d0f1a}.uhome-btn:hover{transform:translateY(-1px);border-color:#5b8cff}
.uhome-emotion-meter{position:relative;max-width:470px;margin:22px auto 0;padding:16px 16px 14px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:linear-gradient(180deg,rgba(19,22,42,.82),rgba(13,15,26,.88));box-shadow:0 16px 32px rgba(0,0,0,.24)}
.uhome-emotion-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.uhome-emotion-k{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:24px;letter-spacing:.08em;line-height:1;color:#f0ede6;text-transform:uppercase}
.uhome-emotion-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;border:1px solid rgba(232,169,46,.26);background:rgba(232,169,46,.1);color:#f6c75a;font-family:"Rajdhani","Barlow Condensed","Segoe UI",sans-serif;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.uhome-emotion-track{position:relative;height:14px;border-radius:999px;background:linear-gradient(90deg,rgba(120,83,18,.42),rgba(170,123,28,.28) 34%,rgba(232,169,46,.24) 68%,rgba(255,241,180,.22));overflow:hidden;border:1px solid rgba(255,255,255,.08)}
.uhome-emotion-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,rgba(156,101,15,.92),rgba(232,169,46,.98) 52%,rgba(255,241,180,.96));box-shadow:0 0 18px rgba(232,169,46,.22)}
.uhome-emotion-marker{position:absolute;top:50%;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(180deg,#fff6d6,#f6c75a);color:#121724;font-size:16px;box-shadow:0 8px 22px rgba(0,0,0,.34);border:1px solid rgba(255,255,255,.42);transform:translate(-50%,-50%)}
.uhome-emotion-scale{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:10px}
.uhome-emotion-stop{display:flex;flex-direction:column;align-items:center;gap:3px;color:rgba(240,237,230,.46);font-size:10px;letter-spacing:.04em;text-transform:uppercase}
.uhome-emotion-stop strong{font-size:17px;line-height:1}
.uhome-emotion-copy{margin-top:10px;font-size:12px;line-height:1.55;color:rgba(240,237,230,.62)}
.uhome-reactions{margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07)}
.uhome-reactions-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.uhome-reactions-k{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:22px;letter-spacing:.08em;line-height:1;color:#f0ede6;text-transform:uppercase}
.uhome-reactions-sub{font-size:11px;color:rgba(240,237,230,.5);letter-spacing:.05em}
.uhome-team-picks{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.uhome-team-pick{display:flex;flex-direction:column;gap:6px}
.uhome-team-pick label{font-size:10px;letter-spacing:.11em;text-transform:uppercase;color:rgba(240,237,230,.46)}
.uhome-team-select{width:100%;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(255,255,255,.04);color:#f0ede6;padding:10px 12px;font-family:"Rajdhani","Barlow Condensed","Segoe UI",sans-serif;font-weight:700;letter-spacing:.04em}
.uhome-team-select option{color:#0d0f1a}
.uhome-reactions-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.uhome-react-btn{border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(255,255,255,.04);color:#f0ede6;min-height:78px;padding:10px 8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;transition:all .18s;text-align:center}
.uhome-react-btn:hover{transform:translateY(-1px);border-color:rgba(232,169,46,.38);background:rgba(232,169,46,.08)}
.uhome-react-btn.sel{border-color:#e8a92e;background:rgba(232,169,46,.14);box-shadow:0 10px 24px rgba(0,0,0,.24)}
.uhome-react-btn{position:relative;overflow:visible}
.uhome-react-emoji{font-size:24px;line-height:1}
.uhome-react-text{font-size:10px;line-height:1.2;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.uhome-react-status{margin-top:10px;font-size:12px;line-height:1.45;color:rgba(240,237,230,.62)}
.uhome-react-fly{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:4;padding:8px 12px;border-radius:999px;background:linear-gradient(180deg,rgba(255,246,214,.96),rgba(246,199,90,.94));color:#141b2d;border:1px solid rgba(255,255,255,.45);box-shadow:0 12px 28px rgba(0,0,0,.28);font-family:"Rajdhani","Barlow Condensed","Segoe UI",sans-serif;font-size:12px;font-weight:800;letter-spacing:.04em;white-space:nowrap;animation:uhomeReactionFly 1s ease forwards}
.leader-spotlight{position:relative;margin:0 auto 24px;width:min(100%,360px);min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;isolation:isolate;perspective:760px}
.leader-disc{position:absolute;top:112px;width:220px;height:78px;border-radius:50%;background:conic-gradient(from 0deg,rgba(232,169,46,.08),rgba(232,169,46,.72),rgba(255,241,180,.95),rgba(232,169,46,.38),rgba(232,169,46,.08));box-shadow:0 0 38px rgba(232,169,46,.24),0 18px 34px rgba(0,0,0,.34),inset 0 0 24px rgba(5,9,18,.5);animation:leaderDiscSpin 6.5s linear infinite;transform:rotateX(68deg);z-index:-1}.leader-disc::before{content:"";position:absolute;inset:13px 26px;border-radius:50%;background:rgba(7,11,22,.82);border:1px solid rgba(240,237,230,.1)}.leader-disc::after{content:"";position:absolute;inset:-8px -18px;border-radius:50%;border:1px dashed rgba(232,169,46,.42)}
.leader-avatar{width:104px;height:104px;border-radius:50%;display:grid;place-items:center;margin-top:18px;margin-bottom:10px;background:linear-gradient(135deg,#fff1b4,#e8a92e 55%,#9c650f);box-shadow:0 22px 38px rgba(0,0,0,.4),0 0 32px rgba(232,169,46,.3);border:2px solid rgba(255,241,180,.58);animation:leaderFloat 3.4s ease-in-out infinite;overflow:hidden;z-index:2}.leader-avatar .avatar{width:100%!important;height:100%!important;border-radius:50%;border:0;box-shadow:none}
.leader-copy{margin-top:48px;padding:8px 18px;text-align:center}.leader-kicker{font-family:"Barlow Condensed","Segoe UI",sans-serif;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#f6c75a}.leader-name{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:28px;line-height:1;letter-spacing:.08em;text-transform:uppercase;color:#f0ede6;text-align:center;text-shadow:0 14px 30px rgba(0,0,0,.42)}.leader-points{display:none}
.uhome-ticker{border-top:1px solid rgba(91,140,255,.22);border-bottom:1px solid rgba(91,140,255,.22);background:rgba(91,140,255,.065);overflow:hidden;white-space:nowrap}.uhome-ticker-inner{display:inline-flex;gap:36px;padding:9px 0;animation:tickerScroll 24s linear infinite}.uhome-ticker-item{font-family:"Rajdhani","Barlow Condensed","Segoe UI",sans-serif;font-size:12px;letter-spacing:.07em;color:rgba(240,237,230,.68)}.uhome-ticker-item strong{color:#e8a92e;font-weight:700}
.uhome-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,.08);margin-bottom:28px}.uhome-stat{background:rgba(13,15,26,.94);padding:18px 10px;text-align:center}.uhome-stat-num{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:34px;line-height:1;color:#e8a92e;letter-spacing:.04em}.uhome-stat-label{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:rgba(240,237,230,.42);margin-top:3px}
.uhome-section{padding:0 20px 30px}.uhome-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:10px}.uhome-section-title{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:24px;letter-spacing:.1em;text-transform:uppercase;color:#f0ede6}.uhome-section-action{font-family:"Barlow Condensed","Segoe UI",sans-serif;font-size:12px;letter-spacing:.08em;font-weight:800;text-transform:uppercase;padding:8px 16px;border-radius:5px;border:1px solid #e8a92e;background:#e8a92e;color:#0d0f1a;cursor:pointer;transition:all .18s}.uhome-section-action:hover{transform:translateY(-1px);filter:brightness(.96)}
.uhome-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.uhome-panel{border:1px solid rgba(255,255,255,.08);border-radius:6px;background:rgba(19,22,42,.82);padding:16px;min-height:112px}.uhome-panel-k{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:26px;letter-spacing:.08em;color:#f0ede6;line-height:1}.uhome-panel-v{font-size:12px;line-height:1.5;color:rgba(240,237,230,.55);margin-top:6px}.uhome-panel strong{color:#e8a92e}
.uhome-quick-links{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.uhome-quick{border:1px solid rgba(255,255,255,.09);border-radius:6px;background:rgba(19,22,42,.82);padding:14px 12px;text-align:left;cursor:pointer;color:#f0ede6;transition:all .18s}.uhome-quick:hover{border-color:rgba(232,169,46,.4);background:rgba(232,169,46,.08);transform:translateY(-1px)}.uhome-quick-k{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:24px;letter-spacing:.08em;line-height:1;color:#e8a92e}.uhome-quick-v{font-size:11px;color:rgba(240,237,230,.52);line-height:1.4;margin-top:5px}
.uhome-table{border:1px solid rgba(255,255,255,.08);border-radius:6px;overflow:hidden}.uhome-row{display:grid;grid-template-columns:34px 1fr 80px;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(13,15,26,.72)}.uhome-row:last-child{border-bottom:none}.uhome-rank{font-family:"Rajdhani",sans-serif;color:rgba(240,237,230,.42);font-weight:700}.uhome-rank.gold{color:#e8a92e}.uhome-team{font-size:13px;font-weight:700;color:#f0ede6}.uhome-sub{font-size:10px;color:rgba(240,237,230,.38);margin-top:2px}.uhome-points{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:20px;letter-spacing:.06em;text-align:right;color:#f0ede6}
.uhome-table-scroll{max-height:260px;position:relative}.uhome-table-scroll::before,.uhome-table-scroll::after{content:"";position:absolute;left:0;right:0;height:34px;z-index:2;pointer-events:none}.uhome-table-scroll::before{top:0;background:linear-gradient(180deg,rgba(13,15,26,.86),transparent)}.uhome-table-scroll::after{bottom:0;background:linear-gradient(0deg,rgba(13,15,26,.86),transparent)}.uhome-table-track{animation:uhomeLeaderboardScroll 34s linear infinite}.uhome-table-scroll:hover .uhome-table-track,.uhome-table-scroll:focus-within .uhome-table-track{animation-play-state:paused}

.hero-banner{background:
linear-gradient(120deg,rgba(255,92,57,.15),transparent 36%),
linear-gradient(140deg,#0a1326 0%,#0d1d38 60%,#0a1326 100%);
border-bottom:1px solid rgba(53,82,125,.55);padding:36px 28px;position:relative;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 18px 40px rgba(0,0,0,.26);animation:floatIn .65s ease both}
.hero-banner::before{content:'LEAGUE';position:absolute;right:-14px;top:-26px;font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:176px;font-weight:700;color:rgba(255,255,255,.05);line-height:1;pointer-events:none}
.hero-banner::after{content:"";position:absolute;inset:0;background:radial-gradient(420px 180px at 80% 10%,rgba(0,183,255,.14),transparent 60%),radial-gradient(360px 180px at 12% 8%,rgba(255,184,0,.12),transparent 58%);pointer-events:none;animation:glowShift 9s ease-in-out infinite}
.hstats{display:flex;gap:32px;margin-top:20px;flex-wrap:wrap}
.hstat-v{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:42px;font-weight:700;color:var(--gold);line-height:1}
.hstat-l{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-top:2px}

.adm-hdr{background:linear-gradient(135deg,#151030 0%,#0a1124 100%);border-bottom:1px solid rgba(122,108,255,.35);padding:28px}

.page{padding:28px;max-width:1200px;width:min(1200px,100%);margin:0 auto}
.pt{font-size:28px;font-weight:700;margin-bottom:4px}
.ps{color:var(--muted);font-size:14px;margin-bottom:24px}
.sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px}

.tw{background:linear-gradient(180deg,rgba(22,34,61,.96),rgba(10,18,33,.98));border:1px solid rgba(53,82,125,.58);border-radius:16px;overflow:hidden;overflow-x:auto;-webkit-overflow-scrolling:touch;box-shadow:var(--shadow-soft),inset 0 1px 0 rgba(255,255,255,.06);transition:transform .28s ease,box-shadow .28s ease}
.tw:hover{transform:translateY(-2px);box-shadow:var(--shadow-hard)}
table{width:100%;border-collapse:collapse}
th{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a5bbda;padding:11px 14px;text-align:left;border-bottom:2px solid var(--border);white-space:nowrap;background:rgba(9,16,30,.65)}
td{padding:12px 14px;border-bottom:1px solid rgba(34,49,78,.7);font-size:14px;vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(0,183,255,.05)}

.modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);padding:20px}
.modal{background:linear-gradient(160deg,rgba(23,35,65,.97),rgba(8,15,29,.99));border:1px solid rgba(53,82,125,.65);border-radius:18px;width:100%;max-width:520px;max-height:min(90vh,900px);overflow-y:auto;box-shadow:0 32px 80px rgba(0,0,0,.5)}
.modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 0}
.modal-title{font-family:'Rajdhani',sans-serif;font-size:20px;font-weight:700}
.modal-x{cursor:pointer;color:var(--muted);font-size:24px;line-height:1}.modal-x:hover{color:var(--err)}
.modal-body{padding:20px 24px 24px}
.modal-ft{padding:0 24px 24px;display:flex;gap:10px;justify-content:flex-end}

.confirm-box{background:linear-gradient(160deg,rgba(23,35,65,.97),rgba(8,15,29,.99));border:1px solid rgba(53,82,125,.65);border-radius:18px;padding:24px;max-width:380px;width:100%;box-shadow:0 30px 72px rgba(0,0,0,.5)}
.confirm-title{font-family:'Rajdhani',sans-serif;font-size:18px;font-weight:700;margin-bottom:8px}
.confirm-text{color:var(--muted);font-size:14px;margin-bottom:20px}
.confirm-acts{display:flex;gap:10px;justify-content:flex-end}

.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.pc{background:linear-gradient(165deg,rgba(23,35,65,.95),rgba(8,15,29,.98));border:1px solid rgba(53,82,125,.58);border-radius:14px;padding:14px;cursor:pointer;transition:transform .26s ease,box-shadow .26s ease,border-color .26s ease,filter .26s ease;position:relative;overflow:hidden;box-shadow:0 14px 28px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.06)}
.pc::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.08),transparent 28%,transparent 72%,rgba(0,0,0,.12));pointer-events:none}
.pc-flip{perspective:900px}
.pc-inner{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .62s cubic-bezier(.2,.7,.2,1)}
.pc-flip:hover .pc-inner{transform:rotateY(180deg) translateZ(8px)}
.pc-flip.flipped .pc-inner{transform:rotateY(180deg) translateZ(8px)}
.pc-front,.pc-back{backface-visibility:hidden;min-height:170px}
.pc-back{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotateY(180deg);background:linear-gradient(165deg,rgba(24,37,68,.96),rgba(8,15,29,.99));border:1px solid rgba(53,82,125,.58);border-radius:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.pc-back-pts{font-family:'Rajdhani',sans-serif;font-size:24px;font-weight:700;color:var(--acc);margin-top:6px;text-align:center}
.pc-back-sub{font-size:12px;color:var(--muted);margin-top:4px;letter-spacing:.08em;text-transform:uppercase;text-align:center}
.star-row{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;font-size:22px;color:#ffdf6b}
.star{font-weight:800;text-shadow:0 0 10px rgba(255,223,107,.6)}
.star-meta{font-size:11px;color:var(--muted);margin-left:6px}
.pc:hover{border-color:var(--acc2);transform:translateY(-6px) rotateX(3deg) rotateY(-2deg);box-shadow:var(--shadow-hard),var(--glow-cyan);filter:saturate(1.06)}
.pc.sel{border-color:var(--acc);background:rgba(249,115,22,.06)}
.pc.sel::after{content:'✓';position:absolute;top:8px;right:10px;color:var(--acc);font-size:16px;font-weight:700}
.swap-grid{display:grid;grid-template-columns:repeat(3,minmax(160px,1fr));gap:12px}
.swap-card{border:1px dashed rgba(53,82,125,.65);border-radius:14px;padding:12px;min-height:110px;display:flex;flex-direction:column;justify-content:center;align-items:center;background:rgba(8,15,29,.6)}
.swap-card.sel{border-style:solid;border-color:var(--acc);background:rgba(249,115,22,.08)}
.swap-label{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.swap-name{font-family:"Rajdhani","Barlow Condensed","Segoe UI",sans-serif;font-weight:700}
.swap-meta{font-size:12px;color:var(--muted)}
.pname{font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:600;margin:4px 0 8px}
.pteam{font-size:10px;font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
.pmeta{display:flex;gap:6px;flex-wrap:wrap}
.pfilters{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center}
.fbtn{font-family:'Rajdhani',sans-serif;font-weight:600;font-size:12px;letter-spacing:.07em;text-transform:uppercase;padding:6px 14px;border-radius:4px;cursor:pointer;border:1px solid var(--border);background:var(--sf2);color:var(--muted);transition:all .15s}
.fbtn.active{border-color:var(--acc);color:var(--acc);background:rgba(249,115,22,.1)}

.mc{background:linear-gradient(165deg,rgba(23,35,65,.95),rgba(8,15,29,.99));border:1px solid rgba(53,82,125,.58);border-radius:16px;padding:18px 22px;display:flex;flex-direction:column;gap:14px;box-shadow:var(--shadow-soft),inset 0 1px 0 rgba(255,255,255,.06);transition:transform .28s ease,box-shadow .28s ease}
.mc:hover{transform:translateY(-3px);box-shadow:var(--shadow-hard)}
.mc-hdr{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.mc-date{font-size:12px;color:var(--muted);font-family:'Rajdhani',sans-serif;letter-spacing:.07em;text-transform:uppercase}
.mc-teams{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.mc-badge{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 18px;border-radius:12px;cursor:pointer;border:2px solid transparent;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease;min-width:110px;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02))}
.mc-badge:hover{border-color:currentColor;transform:translateY(-2px);box-shadow:0 12px 20px rgba(0,0,0,.22)}
.mc-badge.sel{border-color:var(--gold);box-shadow:0 0 18px rgba(245,166,35,.25)}
.mc-badge.ok{border-color:var(--ok)}.mc-badge.err{border-color:var(--err);opacity:.6}
.mc-vs{font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;color:var(--muted)}
.wbadge{background:rgba(16,185,129,.1);border:1px solid var(--ok);color:var(--ok);padding:4px 12px;border-radius:4px;font-size:12px;font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:.07em;text-transform:uppercase}
.pbadge{background:rgba(100,116,139,.1);border:1px solid var(--muted);color:var(--muted);padding:4px 12px;border-radius:4px;font-size:12px;font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:.07em;text-transform:uppercase}

.lb{display:flex;flex-direction:column;gap:10px}
.lbr{display:flex;align-items:center;gap:16px;background:linear-gradient(150deg,rgba(22,34,61,.96),rgba(9,17,31,.98));border:1px solid rgba(53,82,125,.58);border-radius:16px;padding:14px 18px;transition:transform .24s ease,box-shadow .24s ease,border-color .24s ease;box-shadow:0 16px 28px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.05)}
.lbr:hover{transform:translateX(4px) translateY(-2px);box-shadow:var(--shadow-soft);border-color:rgba(0,183,255,.44)}
.lbrank{font-family:'Rajdhani',sans-serif;font-size:24px;font-weight:700;width:36px;text-align:center}
.lbrank.g{color:var(--gold)}.lbrank.s{color:#94a3b8}.lbrank.b{color:#cd7c3c}
.lbinfo{flex:1}
.lbname{font-family:'Rajdhani',sans-serif;font-size:17px;font-weight:600}
.lbsub{font-size:12px;color:var(--muted)}
.lbpts{font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:var(--acc)}
.lbptsl{font-size:10px;color:var(--muted);text-align:right;letter-spacing:.07em;text-transform:uppercase}

.lb-party{position:relative}
.lb-hero{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;padding:18px 20px;border-radius:20px;background:
radial-gradient(600px 220px at 20% -40%,rgba(255,183,0,.18),transparent 60%),
radial-gradient(500px 220px at 80% -30%,rgba(0,183,255,.16),transparent 60%),
linear-gradient(120deg,#101a2f 0%,#0b1426 60%,#0c1a2b 100%);
border:1px solid rgba(53,82,125,.58);box-shadow:0 20px 44px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.08);animation:floatIn .65s ease both}
.lb-spark{font-family:'Teko','Bebas Neue','Arial Narrow',sans-serif;font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:#ffd166;background:rgba(255,209,102,.12);border:1px solid rgba(255,209,102,.35);padding:6px 12px;border-radius:999px}
.lb-podium{display:grid;grid-template-columns:1fr 1.2fr 1fr;align-items:end;gap:16px;margin-bottom:28px;perspective:1200px}
.lb-pod{padding:0;border-radius:20px 20px 14px 14px;border:1px solid rgba(53,82,125,.58);background:transparent;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,.28);transition:transform .28s ease,box-shadow .28s ease;min-height:272px;display:flex;flex-direction:column;justify-content:flex-start;transform-style:preserve-3d}
.lb-pod-body{position:relative;z-index:2;padding:16px 16px 26px;border-radius:20px 20px 12px 12px;background:linear-gradient(160deg,rgba(34,49,85,.98),rgba(10,18,33,.99));box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.lb-pod-logo{display:flex;justify-content:center;margin-bottom:6px;transform:scale(1.2)}
.lb-pod::before,.lb-pod::after{content:"";position:absolute;inset:-6px;pointer-events:none;border-radius:18px;background:
radial-gradient(circle at 12% 18%,rgba(255,209,102,.35),transparent 35%),
radial-gradient(circle at 88% 22%,rgba(0,183,255,.28),transparent 35%),
radial-gradient(circle at 20% 82%,rgba(255,92,57,.28),transparent 40%),
radial-gradient(circle at 80% 78%,rgba(122,108,255,.22),transparent 40%);
opacity:.8;mix-blend-mode:screen}
.lb-pod{position:relative;overflow:visible}
.lb-pod:hover{transform:translateY(-10px) rotateX(7deg);box-shadow:0 34px 60px rgba(0,0,0,.4)}
.lb-pod::after{content:"";position:absolute;left:12px;right:12px;bottom:-26px;height:34px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,.46),transparent 70%);filter:blur(10px);pointer-events:none}
.lb-pod.g{box-shadow:0 0 0 1px rgba(255,184,0,.35),0 24px 44px rgba(255,184,0,.18);min-height:340px;z-index:2}
.lb-pod.s{box-shadow:0 0 0 1px rgba(180,200,220,.35),0 12px 24px rgba(180,200,220,.12);min-height:288px}
.lb-pod.b{box-shadow:0 0 0 1px rgba(205,127,50,.35),0 12px 24px rgba(205,127,50,.12);min-height:252px}
.lb-pod-center{transform:translateY(-12px)}
.lb-pod-side{margin-bottom:18px}
.lb-pod-step{position:absolute;left:10px;right:10px;bottom:-20px;border-radius:0 0 14px 14px;pointer-events:none;transform-origin:top;transform:rotateX(76deg);filter:brightness(.84)}
.lb-pod.g .lb-pod-step{height:44px;background:linear-gradient(180deg,rgba(255,209,102,.78),rgba(120,76,0,.66))}
.lb-pod.s .lb-pod-step{height:32px;background:linear-gradient(180deg,rgba(226,232,240,.68),rgba(71,85,105,.62))}
.lb-pod.b .lb-pod-step{height:24px;background:linear-gradient(180deg,rgba(242,180,138,.68),rgba(120,65,22,.6))}
.lb-poppers{position:absolute;inset:0;pointer-events:none;z-index:0}
.lb-popper{position:absolute;top:14px;width:74px;height:74px;opacity:.92;filter:drop-shadow(0 8px 12px rgba(0,0,0,.24))}
.lb-popper.left{left:-8px;transform:rotate(-12deg)}
.lb-popper.right{right:-8px;transform:scaleX(-1) rotate(-12deg)}
.lb-popper::before{content:"";position:absolute;left:22px;bottom:8px;width:16px;height:22px;border-radius:4px 4px 7px 7px;background:linear-gradient(180deg,#ffd166,#ff9f1c);box-shadow:0 2px 0 rgba(0,0,0,.18)}
.lb-popper::after{content:"";position:absolute;left:8px;top:12px;width:58px;height:48px;background:
radial-gradient(circle at 12% 46%,#ffd166 0 4px,transparent 4.4px),
radial-gradient(circle at 42% 18%,#ff5c39 0 4px,transparent 4.4px),
radial-gradient(circle at 68% 34%,#00b7ff 0 4px,transparent 4.4px),
radial-gradient(circle at 88% 16%,#7a6cff 0 4px,transparent 4.4px),
linear-gradient(62deg,transparent 0 26%,#ffd166 27% 29%,transparent 30% 100%),
linear-gradient(20deg,transparent 0 30%,#ff5c39 31% 33%,transparent 34% 100%),
linear-gradient(82deg,transparent 0 44%,#00b7ff 45% 47%,transparent 48% 100%),
linear-gradient(38deg,transparent 0 60%,#7a6cff 61% 63%,transparent 64% 100%);
background-repeat:no-repeat;animation:popperBurst 2.8s ease-in-out infinite}
.lb-pod.g .lb-popper::before{background:linear-gradient(180deg,#ffe082,#ffb800)}
.lb-pod.s .lb-popper::before{background:linear-gradient(180deg,#e2e8f0,#94a3b8)}
.lb-pod.b .lb-popper::before{background:linear-gradient(180deg,#f2b48a,#cd7c3c)}
.lb-confetti{position:absolute;inset:-8px -4px auto -4px;height:110px;pointer-events:none;z-index:1;overflow:visible}
.lb-confetti i{position:absolute;display:block;width:10px;height:18px;border-radius:3px;opacity:.96;transform-origin:center;animation:confettiDrift 3.2s ease-in-out infinite}
.lb-confetti i:nth-child(1){left:8%;top:40px;background:#ffd166;animation-delay:.1s}
.lb-confetti i:nth-child(2){left:18%;top:16px;background:#ff5c39;height:12px;animation-delay:.7s}
.lb-confetti i:nth-child(3){left:31%;top:28px;background:#00b7ff;width:8px;height:16px;animation-delay:1.2s}
.lb-confetti i:nth-child(4){left:44%;top:8px;background:#7a6cff;height:14px;animation-delay:.35s}
.lb-confetti i:nth-child(5){left:58%;top:24px;background:#20c997;width:8px;height:15px;animation-delay:1.5s}
.lb-confetti i:nth-child(6){left:70%;top:12px;background:#ffb800;animation-delay:.95s}
.lb-confetti i:nth-child(7){left:82%;top:30px;background:#e879f9;width:8px;height:13px;animation-delay:1.8s}
.lb-confetti i:nth-child(8){left:92%;top:18px;background:#38bdf8;height:11px;animation-delay:.55s}
.lb-medal{font-family:'Teko','Bebas Neue','Arial Narrow',sans-serif;font-size:18px;letter-spacing:.12em;color:var(--gold);margin-bottom:8px}
.lb-pname{font-family:'Rajdhani',sans-serif;font-size:18px;font-weight:700;margin-top:6px}
.lb-ppoints{font-family:'Teko','Bebas Neue','Arial Narrow',sans-serif;font-size:28px;font-weight:700;color:var(--acc);margin-top:4px}
.lb-psub{font-size:12px;color:var(--muted);margin-top:2px}

.pbar{background:#1b2a45;border-radius:999px;height:7px;overflow:hidden}
.pfill{height:100%;background:linear-gradient(90deg,var(--acc),var(--gold));border-radius:999px;transition:width .4s}
.avatar{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Rajdhani',sans-serif;font-size:26px;font-weight:700;flex-shrink:0;background:linear-gradient(135deg,var(--acc),var(--acc2));object-fit:cover;overflow:hidden;border:1px solid rgba(255,255,255,.15)}
.logo-panel{background:rgba(16,25,44,.7);border:1px dashed var(--border);border-radius:10px;padding:14px}
.logo-meta{font-size:12px;color:var(--muted);margin-top:8px}
.logo-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.build-badge{position:fixed;right:12px;bottom:10px;z-index:9998;background:rgba(6,11,22,.92);border:1px solid var(--border);border-radius:8px;padding:6px 9px;color:#a8bbd9;font-size:11px;line-height:1.2;font-family:"Rajdhani",sans-serif;backdrop-filter:blur(5px)}
.prof-hdr{display:flex;align-items:center;gap:20px;background:linear-gradient(160deg,rgba(23,35,65,.95),rgba(8,15,29,.99));border:1px solid rgba(53,82,125,.58);border-radius:18px;padding:22px;margin-bottom:24px;box-shadow:var(--shadow-soft),inset 0 1px 0 rgba(255,255,255,.06)}
.ptsbig{font-family:'Rajdhani',sans-serif;font-size:48px;font-weight:700;color:var(--acc);line-height:1}
.divider{height:1px;background:var(--border);margin:24px 0}
.empty{text-align:center;padding:60px 20px;color:var(--muted)}
.empty .ico{font-size:48px;margin-bottom:12px}
.empty p{font-family:'Rajdhani',sans-serif;font-size:18px;margin-bottom:6px;color:var(--text)}

.toast{position:fixed;bottom:28px;right:28px;z-index:9999;background:linear-gradient(160deg,rgba(23,35,65,.96),rgba(8,15,29,.99));border:1px solid rgba(53,82,125,.58);border-radius:14px;padding:14px 20px;font-size:14px;max-width:340px;box-shadow:0 18px 42px rgba(0,0,0,.5);animation:slideUp .3s ease}
.toast.success{border-left:4px solid var(--ok)}.toast.error{border-left:4px solid var(--err)}.toast.info{border-left:4px solid var(--acc2)}
@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes floatIn{from{transform:translateY(18px) scale(.985);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
@keyframes glowShift{0%,100%{transform:translate3d(0,0,0);opacity:.75}50%{transform:translate3d(-10px,8px,0);opacity:1}}
@keyframes popperBurst{0%,100%{transform:translateY(0) scale(.96);opacity:.82}50%{transform:translateY(-4px) scale(1.05);opacity:1}}
@keyframes confettiDrift{0%{transform:translate3d(0,-4px,0) rotate(0deg);opacity:0}15%{opacity:1}50%{transform:translate3d(8px,16px,0) rotate(110deg);opacity:1}100%{transform:translate3d(-10px,54px,0) rotate(230deg);opacity:0}}
@keyframes uhomeLeaderboardScroll{0%,14%{transform:translateY(0)}86%,100%{transform:translateY(calc(-50% + 130px))}}
@keyframes leaderDiscSpin{to{transform:rotate(360deg)}}
@keyframes leaderFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes uhomeReactionFly{0%{transform:translate(-50%,-50%) scale(.72);opacity:0}18%{opacity:1}100%{transform:translate(-50%,-128%) scale(1.08);opacity:0}}

.page>.card,.page>.tw,.page>.mc,.page>.prof-hdr,.page>.lb-party,.page>.hero-banner{animation:floatIn .45s ease both}
.page>.card:nth-of-type(2),.page>.tw:nth-of-type(2),.page>.mc:nth-of-type(2){animation-delay:.04s}
.page>.card:nth-of-type(3),.page>.tw:nth-of-type(3),.page>.mc:nth-of-type(3){animation-delay:.08s}

.wopt{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:4px;border:1px solid var(--border);cursor:pointer;font-family:'Rajdhani',sans-serif;font-weight:600;font-size:12px;transition:all .15s}
.wopt:hover{border-color:var(--acc)}.wopt.sel{border-color:var(--ok);background:rgba(16,185,129,.1);color:var(--ok)}
.wopt.clr{color:var(--err);border-color:var(--err)}.wopt.cx{color:var(--muted)}

.astat{background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:8px;padding:14px 18px}
.astat-v{font-family:'Rajdhani',sans-serif;font-size:30px;font-weight:700;color:var(--adm)}
.astat-l{font-size:11px;color:var(--muted);letter-spacing:.07em;text-transform:uppercase}
.import-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.import-box{background:var(--sf2);border:1px solid var(--border);border-radius:10px;padding:12px}
.import-stats{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.import-chip{font-size:11px;padding:4px 8px;border-radius:999px;border:1px solid var(--border);color:var(--muted)}
.import-chip.ok{color:var(--ok);border-color:rgba(32,201,151,.45);background:rgba(32,201,151,.08)}
.import-chip.err{color:var(--err);border-color:rgba(255,84,112,.45);background:rgba(255,84,112,.08)}
.import-list{max-height:160px;overflow:auto;margin-top:8px;font-size:13px;color:var(--muted);line-height:1.5}

/* Admin theme: aligned with the user navy/gold glass direction. */
.admin-shell{
  --adm:#e8a92e;
  --acc:#e8a92e;
  --acc2:#f3c455;
  --border:#2a2a24;
  --border-hi:rgba(240,237,230,.16);
  position:relative;
  min-height:100vh;
  overflow:hidden;
  background:
    radial-gradient(ellipse at 20% 58%,rgba(255,92,57,.14),transparent 60%),
    radial-gradient(ellipse at 82% 28%,rgba(0,183,255,.12),transparent 60%),
    #050912;
}
.admin-shell::before{content:"";position:absolute;inset:0;background:var(--login-hero) center center/cover no-repeat;z-index:0;filter:saturate(1.04) contrast(1.04);opacity:.52}
.admin-shell::after{content:"";position:absolute;inset:0;background:
linear-gradient(180deg,rgba(5,9,18,.5),rgba(5,9,18,.88)),
radial-gradient(ellipse at 18% 60%,rgba(255,92,57,.14),transparent 60%),
radial-gradient(ellipse at 84% 26%,rgba(0,183,255,.12),transparent 60%);
pointer-events:none;z-index:1}
.admin-shell>.nav,.admin-shell>.adm-hdr,.admin-shell>.page,.admin-shell>.build-badge{position:relative;z-index:3}
.admin-shell .nav{background:rgba(13,15,26,.78);border-bottom-color:rgba(240,237,230,.12);box-shadow:0 12px 28px rgba(0,0,0,.28);backdrop-filter:blur(10px)}
.admin-shell .nav-logo{color:#e8a92e;letter-spacing:.14em}.admin-shell .nav-logo span{color:#f0ede6}
.admin-shell .nav-logo .abadge{background:linear-gradient(180deg,#f3c455,#e8a92e);color:#0d0f1a}
.admin-shell .nav-link{border-color:rgba(240,237,230,.1);background:rgba(255,255,255,.025);color:rgba(240,237,230,.58)}
.admin-shell .nav-link:hover{background:rgba(255,255,255,.06);border-color:rgba(232,169,46,.45);color:#f0ede6}
.admin-shell .nav-link.aa{background:linear-gradient(180deg,rgba(232,169,46,.2),rgba(232,169,46,.08));border-color:rgba(232,169,46,.58);color:#f6c75a}
.admin-shell .adm-hdr{background:linear-gradient(180deg,rgba(7,11,22,.76),rgba(13,15,26,.82));border-bottom:1px solid rgba(240,237,230,.12);box-shadow:0 18px 44px rgba(0,0,0,.22)}
.admin-shell .adm-hdr h2{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#f0ede6;text-shadow:0 14px 36px rgba(0,0,0,.34)}
.admin-shell .page{background:
radial-gradient(620px 260px at 50% -70px,rgba(232,169,46,.1),transparent 72%),
radial-gradient(480px 240px at 94% 10%,rgba(91,140,255,.08),transparent 68%)}
.admin-shell .btn-adm,.adm-login-bg .btn-adm{
  background:linear-gradient(180deg,#f3c455 0%,#e8a92e 54%,#b97910 100%);
  border:1px solid #e8a92e;
  color:#0d0f1a;
  box-shadow:0 14px 30px rgba(232,169,46,.2),inset 0 1px 0 rgba(255,255,255,.3);
}
.admin-shell .btn-adm:hover,.adm-login-bg .btn-adm:hover{box-shadow:0 16px 32px rgba(232,169,46,.22),inset 0 1px 0 rgba(255,255,255,.34)}
.admin-shell .btn-secondary,.adm-login-bg .btn-secondary{
  background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.025));
  border:1px solid rgba(240,237,230,.2);
  color:#f0ede6;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 12px 26px rgba(0,0,0,.14);
}
.admin-shell .card,.admin-shell .tw,.admin-shell .modal,.admin-shell .confirm-box,.admin-shell .import-box,.admin-shell .astat{
  background:linear-gradient(180deg,rgba(7,11,22,.74),rgba(13,15,26,.78))!important;
  border-color:rgba(240,237,230,.14)!important;
  box-shadow:0 18px 44px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.055)!important;
  backdrop-filter:blur(8px);
}
.admin-shell .astat-v{color:#f3c455;text-shadow:0 0 14px rgba(232,169,46,.18)}
.admin-shell .astat-l{color:rgba(240,237,230,.52)}
.admin-shell input,.admin-shell select,.admin-shell textarea,.adm-login-bg input,.adm-login-bg select,.adm-login-bg textarea{
  background:linear-gradient(180deg,rgba(7,11,22,.88),rgba(13,15,26,.72));
  border:1px solid rgba(240,237,230,.18);
  color:#f0ede6;
  border-radius:6px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 10px 24px rgba(0,0,0,.08);
}
.admin-shell input:focus,.admin-shell select:focus,.admin-shell textarea:focus,.adm-login-bg input:focus,.adm-login-bg select:focus,.adm-login-bg textarea:focus{
  border-color:#e8a92e;
  box-shadow:0 0 0 3px rgba(232,169,46,.15),inset 0 1px 0 rgba(255,255,255,.06);
}
.admin-shell th{background:rgba(7,11,22,.86);color:rgba(240,237,230,.62);border-bottom-color:rgba(240,237,230,.12)}
.admin-shell td{border-bottom-color:rgba(240,237,230,.08)}
.admin-shell .tag,.admin-shell .import-chip,.admin-shell .wbadge,.admin-shell .pbadge{
  background:rgba(232,169,46,.12)!important;
  border:1px solid rgba(232,169,46,.34)!important;
  color:#e8a92e!important;
}
.admin-shell .import-chip.err,.admin-shell .btn-danger{
  background:rgba(232,169,46,.12)!important;
  border-color:rgba(232,169,46,.34)!important;
  color:#f6c75a!important;
}
.adm-login-bg{
  --adm:#e8a92e;
  --acc:#e8a92e;
  background:
    linear-gradient(rgba(5,9,18,.42),rgba(5,9,18,.82)),
    radial-gradient(ellipse at 20% 58%,rgba(255,92,57,.14),transparent 60%),
    radial-gradient(ellipse at 82% 28%,rgba(0,183,255,.12),transparent 60%),
    var(--login-hero) center center/cover no-repeat,
    #050912!important;
}
.adm-login-bg .lcard{background:linear-gradient(180deg,rgba(7,11,22,.78),rgba(13,15,26,.84))!important;border-color:rgba(240,237,230,.14)!important;backdrop-filter:blur(8px)}
.adm-login-bg .lhero h1 span.p,.adm-login-bg .lswitch span{color:#e8a92e}

/* Logged-in user theme: navy/gold, compact, phone-first. Admin screens intentionally remain outside this scope. */
.user-shell{max-width:760px;margin:0 auto;min-height:100vh;background:linear-gradient(180deg,rgba(13,15,26,.9),rgba(13,15,26,.98));border-left:1px solid rgba(255,255,255,.06);border-right:1px solid rgba(255,255,255,.06);box-shadow:0 0 80px rgba(0,0,0,.34)}
.user-shell.home-active{position:relative;overflow:hidden;background:
radial-gradient(ellipse at 20% 60%,rgba(255,92,57,.13),transparent 60%),
radial-gradient(ellipse at 80% 30%,rgba(0,183,255,.12),transparent 60%),
#050912}
.user-shell.home-active::before{content:"";position:absolute;inset:0;background:var(--login-hero) center center/cover no-repeat;z-index:0;filter:saturate(1.02) contrast(1.04);opacity:.82}
.user-shell.home-active::after{content:"";position:absolute;inset:0;background:
linear-gradient(rgba(5,9,18,.38),rgba(5,9,18,.78)),
radial-gradient(ellipse at 20% 60%,rgba(255,92,57,.16),transparent 60%),
radial-gradient(ellipse at 80% 30%,rgba(0,183,255,.14),transparent 60%);pointer-events:none;z-index:1}
.user-shell.home-active>.nav,.user-shell.home-active>.uhome-site,.user-shell.home-active>.build-badge{position:relative;z-index:3}
.user-shell.home-active .nav{background:rgba(13,15,26,.74);border-bottom-color:rgba(255,255,255,.1)}
.user-shell.home-active .uhome-hero{min-height:360px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:58px;padding-bottom:44px}
.user-shell.home-active .uhome-stats,.user-shell.home-active .uhome-panel,.user-shell.home-active .uhome-table,.user-shell.home-active .uhome-quick{background:rgba(13,15,26,.68);backdrop-filter:blur(8px);border-color:rgba(255,255,255,.12)}
.user-shell.page-active{position:relative;overflow:hidden;background:
radial-gradient(ellipse at 20% 26%,rgba(232,169,46,.13),transparent 58%),
radial-gradient(ellipse at 84% 12%,rgba(91,140,255,.12),transparent 58%),
#050912}
.user-shell.page-active::before{content:"";position:absolute;inset:0;background:var(--login-hero) center center/cover no-repeat;z-index:0;filter:saturate(1.02) contrast(1.04);opacity:.28}
.user-shell.page-active::after{content:"";position:absolute;inset:0;background:
linear-gradient(180deg,rgba(5,9,18,.7),rgba(5,9,18,.93)),
radial-gradient(ellipse at 18% 18%,rgba(232,169,46,.14),transparent 58%),
radial-gradient(ellipse at 86% 6%,rgba(91,140,255,.12),transparent 58%);
pointer-events:none;z-index:1}
.user-shell.page-active>.nav,.user-shell.page-active>.page,.user-shell.page-active>.hero-banner{position:relative;z-index:3}
.user-shell.page-active .nav{background:rgba(13,15,26,.78);border-bottom-color:rgba(255,255,255,.1)}
.user-shell.page-active .page{min-height:calc(100vh - 64px);background:
radial-gradient(520px 220px at 50% -80px,rgba(232,169,46,.08),transparent 70%),
radial-gradient(420px 220px at 96% 8%,rgba(91,140,255,.07),transparent 68%)}
.user-shell.page-active .hero-banner{background:
radial-gradient(ellipse 68% 48% at 50% 0%,rgba(232,169,46,.12),transparent 72%),
linear-gradient(180deg,rgba(13,15,26,.72),rgba(13,15,26,.88));backdrop-filter:blur(8px)}
.user-shell.page-active .card,.user-shell.page-active .mc,.user-shell.page-active .tw,.user-shell.page-active .prof-hdr,.user-shell.page-active .logo-panel,.user-shell.page-active .manual-section,.user-shell.page-active .pc,.user-shell.page-active .swap-card,.user-shell.page-active .empty{
  background:linear-gradient(180deg,rgba(7,11,22,.74),rgba(13,15,26,.78))!important;
  border-color:rgba(240,237,230,.14)!important;
  box-shadow:0 18px 44px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.055)!important;
}
.user-shell.page-active .pc-back{
  background:linear-gradient(180deg,rgba(7,11,22,.88),rgba(13,15,26,.92))!important;
  border-color:rgba(240,237,230,.14)!important;
}
.user-shell.page-active .mc-badge,.user-shell.page-active .tag,.user-shell.page-active .pbadge,.user-shell.page-active .wbadge{
  background:rgba(7,11,22,.56)!important;
  border-color:rgba(240,237,230,.16)!important;
}
.user-shell.page-active .swap-card.sel,.user-shell.page-active .pc.sel,.user-shell.page-active .mc-badge.sel{
  background:linear-gradient(180deg,rgba(232,169,46,.16),rgba(7,11,22,.62))!important;
  border-color:rgba(232,169,46,.52)!important;
}
.user-shell.page-active .tag:not(.team-badge),.user-shell.page-active .pbadge,.user-shell.page-active .wbadge,.user-shell.page-active .fbtn.active,.user-shell.page-active .wopt.sel,.user-shell.page-active .star,.user-shell.page-active .pc-back-pts,.user-shell.page-active .ptsbig,.user-shell.page-active .hstat-v,.user-shell.page-active .lbpts,.user-shell.page-active .lb-ppoints,.user-shell.page-active .uhome-quick-k{
  color:#e8a92e!important;
}
.user-shell.page-active .tag:not(.team-badge),.user-shell.page-active .pbadge,.user-shell.page-active .wbadge,.user-shell.page-active .import-chip,.user-shell.page-active .fbtn.active,.user-shell.page-active .wopt.sel{
  background:rgba(232,169,46,.12)!important;
  border-color:rgba(232,169,46,.34)!important;
}
.user-shell.page-active .star{
  text-shadow:0 0 12px rgba(232,169,46,.48)!important;
}
.user-shell.page-active .profile-remove-logo{
  background:linear-gradient(180deg,#f3c455 0%,#e8a92e 54%,#b97910 100%)!important;
  border-color:#e8a92e!important;
  color:#0d0f1a!important;
  box-shadow:0 12px 26px rgba(232,169,46,.18),inset 0 1px 0 rgba(255,255,255,.28)!important;
}
.user-shell.page-active .profile-stat-value{
  color:#f3c455!important;
  text-shadow:0 0 14px rgba(232,169,46,.18);
}
.user-shell.page-active .profile-stat-card .pbar{
  background:rgba(7,11,22,.78);
  border:1px solid rgba(240,237,230,.1);
}
.user-shell.page-active .profile-stat-card .pfill{
  background:linear-gradient(90deg,#fff1b4 0%,#e8a92e 58%,#9c650f 100%)!important;
  box-shadow:0 0 14px rgba(232,169,46,.22);
}
.user-shell.edge-active{position:relative;overflow:hidden;background:
radial-gradient(ellipse at 20% 58%,rgba(255,92,57,.16),transparent 60%),
radial-gradient(ellipse at 82% 28%,rgba(0,183,255,.14),transparent 60%),
#050912}
.user-shell.edge-active::before{content:"";position:absolute;inset:0;background:var(--login-hero) center center/cover no-repeat;z-index:0;filter:saturate(1.08) contrast(1.06);opacity:.68}
.user-shell.edge-active::after{content:"";position:absolute;inset:0;background:
linear-gradient(180deg,rgba(5,9,18,.42),rgba(5,9,18,.8)),
radial-gradient(ellipse at 18% 60%,rgba(255,92,57,.18),transparent 60%),
radial-gradient(ellipse at 84% 26%,rgba(0,183,255,.16),transparent 60%);
pointer-events:none;z-index:1}
.user-shell.edge-active>.nav,.user-shell.edge-active>.page{position:relative;z-index:3}
.user-shell.edge-active .nav{background:rgba(13,15,26,.74);border-bottom-color:rgba(255,255,255,.1)}
.user-shell.edge-active .page{min-height:calc(100vh - 64px);background:
radial-gradient(620px 260px at 50% -70px,rgba(232,169,46,.11),transparent 72%),
radial-gradient(480px 240px at 94% 10%,rgba(91,140,255,.1),transparent 68%)}
.user-shell.edge-active .card,.user-shell.edge-active .edge-top-stats>div,.user-shell.edge-active .edge-player-row{
  background:linear-gradient(180deg,rgba(7,11,22,.72),rgba(13,15,26,.74))!important;
  border-color:rgba(240,237,230,.14)!important;
  backdrop-filter:blur(8px);
}
.user-shell.edge-active .edge-side-stack .card,.user-shell.edge-active .edge-summary-grid .card,.user-shell.edge-active .edge-main-grid .card{
  background:linear-gradient(180deg,rgba(7,11,22,.72),rgba(13,15,26,.74))!important;
  border-color:rgba(240,237,230,.14)!important;
}
.user-shell.edge-active .pt{
  font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;
  font-size:clamp(48px,9vw,78px);
  line-height:.86;
  letter-spacing:.08em;
  color:#f0ede6;
  text-shadow:0 18px 44px rgba(0,0,0,.38);
}
.user-shell.edge-active .pt::after{
  width:86px;
  height:3px;
  margin-top:12px;
  background:linear-gradient(90deg,#e8a92e,rgba(240,237,230,.18),transparent);
  box-shadow:0 0 24px rgba(232,169,46,.28);
}
.user-shell.edge-active .card h3,.user-shell.edge-active .card h4,.user-shell.edge-active .edge-player-main strong,.user-shell.edge-active .edge-side-stack .card>div:first-child,.user-shell.edge-active .edge-summary-grid .card>div:first-child,.user-shell.edge-active .edge-main-grid .card>div:first-child{
  font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif!important;
  letter-spacing:.08em;
  text-transform:uppercase;
  color:#f6c75a!important;
}
.user-shell.edge-active .edge-side-stack .card>div:first-child,.user-shell.edge-active .edge-summary-grid .card>div:first-child,.user-shell.edge-active .edge-main-grid .card>div:first-child{
  font-size:24px!important;
  line-height:1!important;
  text-shadow:0 10px 24px rgba(0,0,0,.28);
}
.user-shell.edge-active .edge-player-main strong{
  font-size:21px;
  line-height:1;
}
.user-shell.edge-active .tag:not(.team-badge),.user-shell.edge-active .pbadge,.user-shell.edge-active .wbadge,.user-shell.edge-active .fbtn.active,.user-shell.edge-active .wopt.sel,.user-shell.edge-active .star,.user-shell.edge-active .pc-back-pts,.user-shell.edge-active .ptsbig,.user-shell.edge-active .hstat-v,.user-shell.edge-active .lbpts,.user-shell.edge-active .lb-ppoints,.user-shell.edge-active .edge-player-tag{
  color:#e8a92e!important;
}
.user-shell.edge-active .tag:not(.team-badge),.user-shell.edge-active .pbadge,.user-shell.edge-active .wbadge,.user-shell.edge-active .import-chip,.user-shell.edge-active .fbtn.active,.user-shell.edge-active .wopt.sel,.user-shell.edge-active .edge-player-tag{
  background:rgba(232,169,46,.12)!important;
  border-color:rgba(232,169,46,.34)!important;
}
.user-shell.edge-active .star{
  text-shadow:0 0 12px rgba(232,169,46,.48)!important;
}
.user-shell .nav{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(13,15,26,.94);backdrop-filter:blur(10px);box-shadow:none}
.user-shell .nav-logo{font-size:30px;letter-spacing:.14em;color:#e8a92e;line-height:.9}.user-shell .nav-logo span{color:#f0ede6}
.user-shell .nav-links{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;max-width:100%;padding-bottom:2px}.user-shell .nav-links::-webkit-scrollbar{display:none}
.user-shell .nav-link{font-family:"Barlow Condensed","Segoe UI",sans-serif;font-size:12px;letter-spacing:.07em;padding:7px 13px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:transparent;color:rgba(240,237,230,.58);white-space:nowrap;text-transform:uppercase}
.user-shell .nav-link:hover{background:rgba(26,30,56,.8);border-color:rgba(232,169,46,.5);color:#f0ede6}
.user-shell .nav-link.ua{background:#e8a92e;border-color:#e8a92e;color:#0d0f1a;font-weight:800}
.user-shell .btn{border-radius:5px;box-shadow:none}.user-shell .btn-primary{background:#e8a92e;color:#0d0f1a;box-shadow:0 14px 28px rgba(232,169,46,.16)}.user-shell .btn-secondary{background:rgba(26,30,56,.82);border-color:rgba(255,255,255,.12);color:#f0ede6}
.user-shell .page{max-width:760px;width:100%;padding:22px 20px 30px;margin:0 auto}
.user-shell .pt{font-size:28px;letter-spacing:.09em;color:#f0ede6;text-transform:uppercase;line-height:1}.user-shell .ps{color:rgba(240,237,230,.58);line-height:1.45}
.user-shell .card,.user-shell .mc,.user-shell .tw,.user-shell .prof-hdr,.user-shell .logo-panel,.user-shell .modal,.user-shell .confirm-box{border-radius:6px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,rgba(26,30,56,.9),rgba(13,15,26,.97));box-shadow:0 18px 44px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.06)}
.user-shell .card:hover,.user-shell .mc:hover,.user-shell .tw:hover{transform:none;box-shadow:0 18px 44px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.06);border-color:rgba(232,169,46,.24)}
.user-shell .hero-banner{border-bottom:1px solid rgba(255,255,255,.08);background:radial-gradient(ellipse 60% 45% at 50% 0%,rgba(91,140,255,.14),transparent 70%),linear-gradient(180deg,rgba(13,15,26,.94),rgba(13,15,26,.98));box-shadow:none;text-align:center}
.user-shell .hero-banner::before{content:"IFL";right:14px;top:-12px;font-size:126px;color:rgba(232,169,46,.05)}.user-shell .hero-banner::after{background:radial-gradient(420px 180px at 50% 0%,rgba(91,140,255,.14),transparent 62%)}
.user-shell .hstats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,.08);margin-top:18px}.user-shell .hstats>div{background:rgba(13,15,26,.92);padding:14px 8px}.user-shell .hstat-v{font-size:34px;color:#e8a92e}.user-shell .hstat-l{font-size:10px;color:rgba(240,237,230,.42)}
.user-shell input,.user-shell select,.user-shell textarea{background:rgba(13,15,26,.78);border-color:rgba(255,255,255,.11);border-radius:6px;color:#f0ede6}.user-shell input:focus,.user-shell select:focus,.user-shell textarea:focus{border-color:#5b8cff;box-shadow:0 0 0 3px rgba(91,140,255,.16)}
.user-shell .tag{border-radius:999px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.05)}
.user-shell .pfilters{gap:8px;align-items:stretch}.user-shell .pfilters input,.user-shell .pfilters select{min-height:39px}.user-shell .fbtn,.user-shell .wopt{border-radius:999px;background:rgba(19,22,42,.86);border-color:rgba(255,255,255,.1);color:rgba(240,237,230,.62)}.user-shell .fbtn.active,.user-shell .wopt.sel{background:rgba(232,169,46,.12);border-color:#e8a92e;color:#e8a92e}
.user-shell .pgrid{grid-template-columns:repeat(auto-fill,minmax(156px,1fr));gap:10px}.user-shell .pc{border-radius:6px;background:linear-gradient(180deg,rgba(26,30,56,.88),rgba(13,15,26,.96));border-color:rgba(255,255,255,.09);box-shadow:none}.user-shell .pc:hover{transform:none;border-color:rgba(232,169,46,.36);box-shadow:none}.user-shell .pc.sel{border-color:#e8a92e;background:rgba(232,169,46,.08)}
.user-shell .mc{gap:12px;padding:16px}.user-shell .mc-badge{border-radius:6px;background:rgba(255,255,255,.04);min-width:92px}.user-shell .mc-badge.sel{border-color:#e8a92e;box-shadow:0 0 0 1px rgba(232,169,46,.22)}.user-shell .mc-date{color:rgba(240,237,230,.46)}
.user-shell .swap-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.user-shell .swap-card{border-radius:6px;background:rgba(19,22,42,.75);border-color:rgba(255,255,255,.12);min-height:100px}.user-shell .swap-card.sel{border-color:#e8a92e;background:rgba(232,169,46,.08)}
.user-shell .tw{overflow-x:auto}.user-shell table{min-width:620px}.user-shell th{background:rgba(13,15,26,.88);border-bottom:1px solid rgba(255,255,255,.1);color:rgba(240,237,230,.58)}.user-shell td{border-bottom:1px solid rgba(255,255,255,.07)}
.user-shell .lb-hero{border-radius:6px;background:radial-gradient(ellipse 62% 45% at 50% 0%,rgba(91,140,255,.14),transparent 72%),linear-gradient(180deg,rgba(26,30,56,.9),rgba(13,15,26,.97));border-color:rgba(255,255,255,.09);box-shadow:none}.user-shell .lb-spark{background:rgba(232,169,46,.12);border-color:rgba(232,169,46,.35);color:#e8a92e}.user-shell .lbr{border-radius:6px;background:linear-gradient(180deg,rgba(26,30,56,.9),rgba(13,15,26,.97));border-color:rgba(255,255,255,.09);box-shadow:none}.user-shell .lbr:hover{transform:none;border-color:rgba(232,169,46,.28)}
.user-shell .lb-podium{gap:10px}.user-shell .lb-pod,.user-shell .lb-pod.g,.user-shell .lb-pod.s,.user-shell .lb-pod.b{border-radius:8px;box-shadow:none}.user-shell .lb-pod-body{border-radius:8px;background:linear-gradient(180deg,rgba(26,30,56,.94),rgba(13,15,26,.98))}
.user-shell .edge-top-stats>div,.user-shell .edge-player-row{border-radius:6px!important;background:rgba(19,22,42,.78)!important;border-color:rgba(255,255,255,.09)!important}
.user-shell .empty{border:1px solid rgba(255,255,255,.08);border-radius:6px;background:rgba(19,22,42,.72);padding:36px 16px}

/* Public and user-facing controls share the logged-in Home gold/glass system. */
.login-bg .btn,.login-bg .login-mini-btn,.user-shell .btn,.user-shell .uhome-btn,.user-shell .uhome-section-action,.user-shell .uhome-quick,.user-shell .fbtn,.user-shell .wopt{
  border-radius:6px;
  font-family:"Barlow Condensed","Rajdhani","Segoe UI",sans-serif;
  letter-spacing:.07em;
  text-transform:uppercase;
  transition:transform .18s ease,border-color .18s ease,background .18s ease,box-shadow .18s ease,color .18s ease;
}
.login-bg .btn-primary,.login-bg .login-mini-btn.primary,.user-shell .btn-primary,.user-shell .uhome-btn.primary,.user-shell .uhome-section-action,.user-shell .nav-link.ua{
  background:linear-gradient(180deg,#f3c455 0%,#e8a92e 54%,#c98513 100%);
  border-color:#e8a92e;
  color:#0d0f1a;
  font-weight:800;
  box-shadow:0 14px 30px rgba(232,169,46,.2),inset 0 1px 0 rgba(255,255,255,.3);
}
.login-bg .btn-secondary,.login-bg .login-mini-btn:not(.primary),.user-shell .btn-secondary,.user-shell .uhome-btn:not(.primary),.user-shell .uhome-quick,.user-shell .fbtn,.user-shell .wopt{
  background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.025));
  border:1px solid rgba(240,237,230,.2);
  color:#f0ede6;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 12px 26px rgba(0,0,0,.14);
}
.login-bg .btn:hover,.login-bg .login-mini-btn:hover,.user-shell .btn:hover,.user-shell .uhome-btn:hover,.user-shell .uhome-section-action:hover,.user-shell .uhome-quick:hover,.user-shell .fbtn:hover,.user-shell .wopt:hover{
  transform:translateY(-1px);
  border-color:rgba(232,169,46,.72);
  box-shadow:0 16px 32px rgba(232,169,46,.14),inset 0 1px 0 rgba(255,255,255,.08);
}
.user-shell .fbtn.active,.user-shell .wopt.sel{
  background:linear-gradient(180deg,rgba(232,169,46,.22),rgba(232,169,46,.08));
  border-color:#e8a92e;
  color:#f6c75a;
  box-shadow:0 0 0 1px rgba(232,169,46,.18),0 12px 26px rgba(232,169,46,.08);
}
.user-shell .wopt.clr{
  color:#ffb4bd;
  border-color:rgba(255,84,112,.55);
  background:rgba(255,84,112,.08);
}
.login-bg input,.login-bg select,.login-bg textarea,.user-shell input,.user-shell select,.user-shell textarea{
  background:linear-gradient(180deg,rgba(7,11,22,.88),rgba(13,15,26,.72));
  border:1px solid rgba(240,237,230,.18);
  color:#f0ede6;
  border-radius:6px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 10px 24px rgba(0,0,0,.08);
}
.login-bg input::placeholder,.login-bg textarea::placeholder,.user-shell input::placeholder,.user-shell textarea::placeholder{color:rgba(240,237,230,.4)}
.login-bg input:focus,.login-bg select:focus,.login-bg textarea:focus,.user-shell input:focus,.user-shell select:focus,.user-shell textarea:focus{
  border-color:#e8a92e;
  box-shadow:0 0 0 3px rgba(232,169,46,.15),inset 0 1px 0 rgba(255,255,255,.06);
  outline:none;
}
.login-card .ltab.active{
  background:linear-gradient(180deg,#f3c455,#e8a92e);
  color:#0d0f1a;
  box-shadow:0 12px 24px rgba(232,169,46,.18);
}
.user-shell .page{
  background:
    radial-gradient(520px 220px at 50% -80px,rgba(232,169,46,.09),transparent 70%),
    radial-gradient(420px 220px at 96% 8%,rgba(91,140,255,.08),transparent 68%);
}
.user-shell .pt::after{
  content:"";
  display:block;
  width:54px;
  height:2px;
  margin-top:8px;
  border-radius:999px;
  background:linear-gradient(90deg,#e8a92e,rgba(240,237,230,.12));
}
.user-shell .card,.user-shell .mc,.user-shell .tw,.user-shell .prof-hdr,.user-shell .logo-panel,.user-shell .modal,.user-shell .confirm-box,.user-shell .manual-section{
  backdrop-filter:blur(8px);
}
.user-shell .tag,.user-shell .wbadge,.user-shell .pbadge,.user-shell .import-chip,.user-shell .lb-spark{
  background:rgba(255,255,255,.055);
  border-color:rgba(240,237,230,.16);
  color:rgba(240,237,230,.78);
}
.user-shell .wbadge,.user-shell .tag.ok{
  background:rgba(232,169,46,.12);
  border-color:rgba(232,169,46,.36);
  color:#f6c75a;
}
.user-shell .pbadge{
  background:rgba(255,255,255,.045);
  color:rgba(240,237,230,.6);
}
.user-shell .pc-back{
  border-radius:6px;
  border-color:rgba(232,169,46,.2);
  background:linear-gradient(180deg,rgba(26,30,56,.94),rgba(13,15,26,.98));
}
.user-shell .pc-back-pts,.user-shell .pc.sel::after,.user-shell .pteam,.user-shell .ptsbig,.user-shell .lbpts,.user-shell .lb-ppoints{
  color:#e8a92e;
}
.user-shell .mc-badge{
  border:1px solid rgba(240,237,230,.14);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
}
.user-shell .mc-badge:hover{
  transform:translateY(-1px);
  border-color:rgba(232,169,46,.55);
  box-shadow:0 14px 28px rgba(232,169,46,.12),inset 0 1px 0 rgba(255,255,255,.06);
}
.user-shell .mc-badge.sel{
  background:linear-gradient(180deg,rgba(232,169,46,.18),rgba(232,169,46,.06));
}
.user-shell .mc-badge.ok{
  border-color:rgba(232,169,46,.55);
  background:rgba(232,169,46,.1);
}
.user-shell .mc-badge.err{
  border-color:rgba(255,255,255,.12);
  background:rgba(255,255,255,.035);
  opacity:.72;
}
.user-shell .swap-label,.user-shell .pc-back-sub,.user-shell .lbptsl,.user-shell .hstat-l,.user-shell .uhome-stat-label{
  color:rgba(240,237,230,.48);
}
.user-shell .swap-name,.user-shell .pname,.user-shell .lbname,.user-shell .manual-section h3{
  color:#f0ede6;
}
.user-shell .swap-meta,.user-shell .lbsub,.user-shell .logo-meta,.user-shell .confirm-text{
  color:rgba(240,237,230,.58);
}
.user-shell .swap-card.sel{
  box-shadow:0 0 0 1px rgba(232,169,46,.16),0 14px 28px rgba(232,169,46,.08);
}
.user-shell .edge-top-stats>div{
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 14px 30px rgba(0,0,0,.16)!important;
}
.user-shell .edge-player-tag{
  background:rgba(232,169,46,.12)!important;
  border:1px solid rgba(232,169,46,.26)!important;
  color:#f6c75a!important;
}
.frozen-squad-card{margin-bottom:12px!important;padding:0!important;border-color:rgba(232,169,46,.18)!important;background:linear-gradient(145deg,rgba(18,22,42,.88),rgba(8,13,25,.96) 70%)!important}
.frozen-squad-card[open]{border-color:rgba(232,169,46,.45)!important;box-shadow:0 20px 50px rgba(0,0,0,.3),0 0 0 1px rgba(232,169,46,.08)!important}
.frozen-squad-summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:38px auto 1fr auto;align-items:center;gap:12px;padding:16px}
.frozen-squad-summary::-webkit-details-marker{display:none}
.frozen-rank{height:32px;width:32px;display:grid;place-items:center;border-radius:999px;background:rgba(232,169,46,.1);border:1px solid rgba(232,169,46,.26);font-family:"Rajdhani",sans-serif;font-weight:800;color:#f6c75a}
.frozen-team-name{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:24px;line-height:1;letter-spacing:.08em;text-transform:uppercase;color:#f0ede6}
.frozen-team-meta{font-size:12px;color:rgba(240,237,230,.52);margin-top:3px}
.frozen-points{text-align:right;padding-left:10px}
.frozen-points-value{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:30px;line-height:1;color:#f6c75a;text-shadow:0 0 18px rgba(232,169,46,.22)}
.frozen-points-label{font-size:10px;color:rgba(240,237,230,.42);letter-spacing:.12em;text-transform:uppercase}
.frozen-player-grid{margin:0 16px 16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08)}
.frozen-player-card{background:linear-gradient(180deg,rgba(20,24,44,.9),rgba(11,16,30,.98))!important;border-color:rgba(255,255,255,.1)!important}
.frozen-player-card:hover{border-color:rgba(232,169,46,.36)!important}
.user-shell .edge-player-points strong,.user-shell .edge-player-main strong{
  color:#f0ede6;
}
.user-shell .edge-side-stack .card,.user-shell .edge-summary-grid .card,.user-shell .edge-main-grid .card{
  border-color:rgba(255,255,255,.09)!important;
  background:linear-gradient(180deg,rgba(26,30,56,.9),rgba(13,15,26,.97))!important;
}
.user-shell .manual-section img{
  border-radius:8px;
  border:1px solid rgba(240,237,230,.14);
  box-shadow:0 18px 36px rgba(0,0,0,.24);
}
.user-shell .manual-section a{
  color:#f6c75a;
}
.user-shell .divider{
  background:linear-gradient(90deg,transparent,rgba(232,169,46,.28),transparent);
}
.user-shell table{
  border-collapse:separate;
  border-spacing:0;
}
.user-shell th{
  color:rgba(240,237,230,.62);
  letter-spacing:.08em;
  text-transform:uppercase;
}
.user-shell td{
  color:rgba(240,237,230,.82);
}
.user-shell .avatar{
  background:linear-gradient(135deg,#e8a92e,#f0ede6);
  color:#0d0f1a;
  border-color:rgba(232,169,46,.38);
}
.guest-pop-avatar{
  width:54px;
  height:54px;
  border-radius:50%;
  display:grid;
  place-items:center;
  font-family:"Rajdhani","Barlow Condensed","Segoe UI",sans-serif;
  font-size:25px;
  font-weight:900;
  letter-spacing:.04em;
  color:#0d0f1a;
  border:1px solid rgba(232,169,46,.44);
  box-shadow:0 14px 26px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.34);
}
.guest-pop-avatar span{position:relative;z-index:2}
.guest-pop-hot{background:radial-gradient(circle at 34% 24%,#fff1b4,#e8a92e 55%,#9c650f)}
.guest-pop-diff{background:radial-gradient(circle at 34% 24%,#f6d77c,#c99222 58%,#5f410f);color:#050912}
.guest-pop-rare{background:radial-gradient(circle at 34% 24%,#f0ede6,#8b7b52 58%,#2c2414);color:#050912}
.guest-archetype-wrap{display:flex;flex-direction:column;align-items:center;gap:6px}
.guest-archetype-label{font-family:"Teko","Bebas Neue","Arial Narrow",sans-serif;font-size:13px;line-height:1;letter-spacing:.1em;text-transform:uppercase;color:#f6c75a;text-align:center;text-shadow:0 8px 18px rgba(0,0,0,.3)}

@media(max-width:1100px){
  .page{padding:24px 20px}
  .hero-banner{padding:30px 22px}
  .hstats{gap:22px}
  .prof-hdr{padding:18px}
  .pgrid{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
}

@media(max-width:900px){
  .login-site{width:100%;border-left:0;border-right:0}
  .login-layout{grid-template-columns:1fr;padding:34px 18px 22px}
  .login-card{justify-self:stretch;max-width:none}
  .login-copy{text-align:center}
  .login-desc{margin-left:auto;margin-right:auto}
  .login-cta-row{justify-content:center}
  .nav{padding:10px 18px;align-items:flex-start}
  .nav-links{width:100%;flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
  .nav-links::-webkit-scrollbar{display:none}
  .hero-banner{padding:24px 18px}
  .hero-banner::before{font-size:120px;right:-8px;top:-10px}
  .pt{font-size:24px}
  .ps{font-size:13px}
  .hstat-v{font-size:34px}
  .prof-hdr{flex-direction:column;align-items:flex-start}
  .modal{max-width:min(680px,100%)}
  .modal-body,.modal-hdr,.modal-ft{padding-left:18px;padding-right:18px}
  .fr3{grid-template-columns:1fr 1fr}
  .import-grid{grid-template-columns:1fr}
  .pgrid{grid-template-columns:repeat(auto-fill,minmax(165px,1fr))}
}

@media(max-width:700px){
  .login-hero-video{opacity:.24}
  .login-topbar{align-items:flex-start;padding:12px 14px}
  .login-nav-actions{gap:5px}
  .login-nav-btn{font-size:11px;padding:6px 10px}
  .login-layout{padding:28px 14px 18px}
  .login-title{font-size:58px}
  .login-stats{grid-template-columns:repeat(2,1fr)}
  .login-feature-row{grid-template-columns:1fr;padding:0 14px 24px}
  .uhome-site{border-left:0;border-right:0}
  .uhome-stats{grid-template-columns:repeat(2,1fr)}
  .uhome-grid{grid-template-columns:1fr}
  .uhome-quick-links{grid-template-columns:1fr 1fr}
  .uhome-section{padding-left:14px;padding-right:14px}
  .user-shell{max-width:none;border-left:0;border-right:0}
  .user-shell .nav{padding:12px 14px;align-items:flex-start;gap:8px}
  .user-shell .nav-logo{font-size:26px;min-width:max-content}
  .user-shell .nav-links{width:100%;order:2}
  .user-shell .nav-link{font-size:11px;padding:7px 10px}
  .user-shell .page{padding:16px 14px 24px}
  .user-shell .pgrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
  .user-shell .swap-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .frozen-squad-summary{grid-template-columns:34px auto 1fr;gap:10px}
  .frozen-points{grid-column:1/-1;text-align:left;padding-left:0;display:flex;align-items:end;gap:8px}
  .user-shell .mc-teams{justify-content:center}
  .user-shell .lb-podium{grid-template-columns:1fr}
  .edge-top-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .edge-summary-grid,.edge-main-grid{grid-template-columns:1fr!important}
  .edge-side-stack{gap:12px!important}
  .edge-player-row{grid-template-columns:1fr!important;align-items:flex-start!important}
  .edge-player-main,.edge-player-tag,.edge-player-points{width:100%}
  .edge-player-tag{justify-self:flex-start}
  .edge-player-points{text-align:left!important}
  .lb-podium{grid-template-columns:1fr;align-items:stretch}
  .lb-pod,.lb-pod.g,.lb-pod.s,.lb-pod.b{min-height:auto}
  .lb-pod-center,.lb-pod-side{transform:none;margin-bottom:0}
  .lb-pod-step{display:none}
  .nav{padding:10px 14px}
  .nav-logo{font-size:24px}
  .nav-link{font-size:13px;padding:8px 12px;white-space:nowrap}
  .page{padding:14px}
  .hero-banner{padding:18px 14px;border-radius:16px}
  .hero-banner::before{font-size:88px;top:-6px;right:-6px}
  .hstats{gap:14px}
  .hstat-v{font-size:28px}
  .card,.mc,.prof-hdr{padding:16px}
  .fr2,.fr3{grid-template-columns:1fr}
  .sh{align-items:flex-start}
  .modal-ov{padding:10px}
  .modal{border-radius:16px;max-height:92vh}
  .modal-body{padding:16px}
  .modal-hdr{padding:16px 16px 0}
  .modal-ft{padding:0 16px 16px;flex-wrap:wrap}
  .confirm-box{padding:18px}
  .pgrid{grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:10px}
  .pc,.pc-back{border-radius:12px}
  .pc-front,.pc-back{min-height:150px}
  .tw{border-radius:14px}
  .swap-grid{grid-template-columns:repeat(2,minmax(140px,1fr))}
  th,td{padding:10px 12px}
  th{font-size:12px}
  td{font-size:13px}
  .mc-badge{min-width:80px;padding:8px 10px}
  .build-badge{right:8px;bottom:8px;font-size:10px}
  .import-grid{grid-template-columns:1fr}
}

@media(max-width:520px){
  .login-title{font-size:50px;letter-spacing:.06em}
  .login-year{font-size:11px;letter-spacing:.18em}
  .login-copy{padding-top:0}
  .season-badge{font-size:10px;margin-bottom:15px}
  .login-card{padding:16px}
  .login-card .lhero h1{font-size:36px}
  .uhome-hero{padding:34px 14px 26px}
  .uhome-title{font-size:52px;letter-spacing:.06em}
  .uhome-year{font-size:11px;letter-spacing:.18em}
  .uhome-emotion-head{align-items:flex-start}
  .uhome-emotion-badge{font-size:11px}
  .uhome-emotion-scale{gap:4px}
  .uhome-emotion-stop{font-size:9px}
  .uhome-team-picks{grid-template-columns:1fr}
  .uhome-reactions-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .uhome-react-btn{min-height:72px}
  .uhome-row{grid-template-columns:28px 1fr 66px;padding:10px}
  .uhome-points{font-size:18px}
  .uhome-quick-links{grid-template-columns:1fr}
  .uhome-section-head{align-items:flex-start;flex-direction:column}
  .user-shell .page{padding:14px 12px 22px}
  .user-shell .pt{font-size:24px}
  .user-shell .card,.user-shell .mc,.user-shell .prof-hdr{padding:14px}
  .user-shell .pgrid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .user-shell .pc{padding:11px}
  .user-shell .pc-front,.user-shell .pc-back{min-height:138px}
  .user-shell .swap-grid{grid-template-columns:1fr}
  .frozen-team-name{font-size:21px}
  .frozen-squad-summary{padding:14px}
  .frozen-player-grid{margin:0 14px 14px}
  .user-shell .mc-badge{min-width:74px;padding:8px}
  .user-shell .hstats{grid-template-columns:repeat(2,1fr)}
  .user-shell .hstat-v{font-size:28px}
  .page{padding:12px}
  .edge-top-stats{grid-template-columns:1fr!important}
  .btn{width:100%;justify-content:center}
  .logo-actions,.modal-ft,.confirm-acts{flex-direction:column}
  .hstats{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .pgrid{grid-template-columns:1fr 1fr}
  .pfilters{gap:8px}
  .swap-grid{grid-template-columns:1fr}
  .fbtn{flex:1;min-width:calc(50% - 8px);text-align:center}
  .mc-teams{gap:10px}
  .mc-badge{min-width:72px;padding:8px}
  .avatar{width:56px;height:56px;font-size:22px}
  .ptsbig{font-size:40px}
}

@media(hover:none){
  .card:hover,.tw:hover,.mc:hover,.lbr:hover,.lb-pod:hover,.pc:hover,.btn-primary:hover,.btn-secondary:hover,.btn-danger:hover,.btn-adm:hover{transform:none;box-shadow:inherit;filter:none}
  .pc-flip:hover .pc-inner{transform:none}
  .pc-flip.flipped .pc-inner{transform:rotateY(180deg)}
  .pc-inner{transition:transform .3s ease}
}

@media print{
  body{background:#fff!important;color:#111!important}
  .nav,.hero-banner,.build-badge,.toast{display:none!important}
  .page{max-width:none!important;padding:0!important}
  .card,.tw{background:#fff!important;color:#111!important;border:1px solid #d5d9e1!important;box-shadow:none!important}
  .manual-section{break-inside:avoid;page-break-inside:avoid}
}
`;

// ─── SHARED ───────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, [onClose]);
  return <div className={`toast ${type}`}>{message}</div>;
}

function TeamBadge({ abbr, sm }) {
  const c = IPL_TEAM_COLORS[abbr] || { bg: "#334155", text: "#fff" };
  const sz = sm ? { fontSize: 11, padding: "2px 7px", borderRadius: 3 } : { fontSize: 13, padding: "5px 12px", borderRadius: 5 };
  return <span style={{ background: c.bg, color: c.text, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, letterSpacing: ".07em", display: "inline-block", ...sz }}>{abbr}</span>;
}

function TeamLogo({ logo, teamName, small }) {
  const fallback = (teamName || "?").trim().charAt(0).toUpperCase() || "?";
  const style = small ? { width: 40, height: 40, fontSize: 15 } : {};
  if (logo) return <img src={logo} alt={`${teamName || "Team"} logo`} className="avatar" style={style} />;
  return <div className="avatar" style={style}>{fallback}</div>;
}

function BuildInfoBadge() {
  return <div className="build-badge">v{APP_VERSION} · {APP_BUILD_TIME_LABEL}</div>;
}

function LanguageToggle({ lang, setLang }) {
  return (
    <div className="login-nav-actions">
      <button className={`login-nav-btn ${lang === "en" ? "active" : ""}`} onClick={() => setLang("en")}>
        {translateText(lang, "english", "English")}
      </button>
      <button className={`login-nav-btn ${lang === "hi" ? "active" : ""}`} onClick={() => setLang("hi")}>
        {translateText(lang, "hindi", "हिंदी")}
      </button>
    </div>
  );
}

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-ov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <div className="modal-title">{title}</div>
          <div className="modal-x" onClick={onClose}>×</div>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-ft">{footer}</div>}
      </div>
    </div>
  );
}

function Confirm({ title, text, onOk, onCancel, danger }) {
  return (
    <div className="modal-ov">
      <div className="confirm-box">
        <div className="confirm-title">{title}</div>
        <div className="confirm-text">{text}</div>
        <div className="confirm-acts">
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
          <button className={`btn btn-sm ${danger ? "btn-danger" : "btn-primary"}`} onClick={onOk}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ─── USER LOGIN ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin, onGoAdmin, onGoManual, onGoGuest, lang, setLang }) {
  const [tab, setTab] = useState("login");
  const [showAuth, setShowAuth] = useState(false);
  const [f, setF] = useState({ phone: "", password: "", teamName: "", teamCode: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showIntroVideo, setShowIntroVideo] = useState(true);
  const upd = p => setF(x => ({ ...x, ...p }));
  const goAuth = (nextTab) => {
    setTab(nextTab);
    setShowAuth(true);
    setErr("");
    window.setTimeout(() => {
      document.getElementById("public-auth-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };
  const users = load("ifl_users", {});
  const matches = getMatches();
  const matchStats = getMatchStats();
  const completedMatches = matches.filter(m => m.winner || matchStats[String(m.id)]).length;
  const nextMatch = [...matches]
    .filter(m => !m.winner)
    .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)))[0]
    || matches[matches.length - 1]
    || {};
  const nextMatchText = nextMatch?.teamAabbr && nextMatch?.teamBabbr
    ? `${nextMatch.teamAabbr} vs ${nextMatch.teamBabbr} · Match ${nextMatch.id || "-"}`
    : nextMatch?.teamA && nextMatch?.teamB
      ? `${nextMatch.teamA} vs ${nextMatch.teamB} · Match ${nextMatch.id || "-"}`
      : translateText(lang, "next_match_loading", "Next match loading");
  const topUser = Object.values(users).sort((a, b) => Number(b.points || 0) - Number(a.points || 0))[0];
  const topUserText = topUser?.teamName ? `${topUser.teamName} · ${Number(topUser.points || 0).toLocaleString()} pts` : translateText(lang, "leaderboard_opening_soon", "Leaderboard opening soon");

  const submit = async () => {
    if (busy) return;
    const phone = normalizePhone(f.phone);
    const teamCode = normalizeTeamCode(f.teamCode);
    if (!phone || !f.password || !teamCode) { setErr(lang === "hi" ? "सभी जरूरी फ़ील्ड भरें" : "Fill all required fields"); return; }
    if (!isValidPhone(phone)) { setErr(lang === "hi" ? "सही फोन नंबर दर्ज करें" : "Enter a valid phone number"); return; }
    if (tab === "login") {
      setBusy(true);
      try {
        const data = await userLogin(phone, f.password, teamCode);
        void logUserLoginAudit(data.token).catch(() => {});
        onLogin(data.username || phone, data.user || {}, data.token || "");
      } catch (e) {
        setErr(e?.message || (lang === "hi" ? "यूज़र लॉगिन असफल रहा" : "User login failed"));
      } finally {
        setBusy(false);
      }
    } else {
      if (!f.teamName.trim()) { setErr(lang === "hi" ? "अपनी फैंटेसी टीम का नाम दर्ज करें" : "Enter your fantasy team name"); return; }
      setBusy(true);
      try {
        const data = await userRegister(phone, f.password, f.teamName.trim(), teamCode);
        void logUserLoginAudit(data.token).catch(() => {});
        onLogin(data.username || phone, data.user || {}, data.token || "");
      } catch (e) {
        setErr(e?.message || (lang === "hi" ? "अकाउंट बनाना असफल रहा। कृपया फिर कोशिश करें।" : "Failed to create account. Please try again."));
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <div className={`login-bg login-home ${showIntroVideo ? "video-active" : ""}`}>
      {showIntroVideo && (
        <video
          className="login-hero-video"
          autoPlay
          muted
          playsInline
          preload="auto"
          poster="/main_page.jpg"
          onEnded={() => setShowIntroVideo(false)}
          onError={() => setShowIntroVideo(false)}
        >
          <source src="/home_hero.mp4" type="video/mp4" />
        </video>
      )}
      <div className="login-site">
        <div className="login-topbar">
          <div className="login-brand">
            <div className="login-brand-main">IFL</div>
            <div className="login-brand-sub">{translateText(lang, "fantasy_league_edition", "Fantasy League 2026")}</div>
          </div>
          <LanguageToggle lang={lang} setLang={setLang} />
        </div>

        <div className={`login-layout ${showAuth ? "" : "login-layout-solo"}`}>
          <section className="login-copy">
            <div className="spartan-hero-logo" aria-label="Spartan helmet logo">
              <img src="/spartan-helmet.png" alt="" />
            </div>
            <div className="season-badge"><span></span>{translateText(lang, "season_active", "Season Active")}</div>
            <h1 className="login-title">IPL <em>Fantasy</em><br />League</h1>
            <div className="login-year">IFL · 2026 · Edition</div>
            <div className="login-cta-row">
              <button className="login-mini-btn primary" onClick={() => goAuth("login")}>{translateText(lang, "enter_the_game", "Enter the Game")}</button>
              <button className="login-mini-btn" onClick={() => goAuth("register")}>{translateText(lang, "create_team", "Create Team")}</button>
              <button className="login-mini-btn" onClick={onGoGuest}>{translateText(lang, "guest_demo", "Guest Demo")}</button>
            </div>
            <div className="login-flash-rotator" aria-label="IFL tagline">
              <span>{translateText(lang, "predict_the_winners", "Predict the winners")}</span>
              <span>{translateText(lang, "follow_the_race", "Follow the race")}</span>
              <span>{translateText(lang, "own_the_leaderboard", "Own the leaderboard")}</span>
            </div>
          </section>

          {showAuth && (
            <div id="public-auth-card" className="lcard card login-card">
              <div className="lhero"><h1>IFL <span>2026</span></h1><p>{translateText(lang, "indian_fantasy_league_ipl", "Indian Fantasy League · IPL Edition")}</p></div>
              <div className="ltabs">
                <div className={`ltab ${tab === "login" ? "active" : ""}`} onClick={() => { setTab("login"); setErr(""); }}>{translateText(lang, "login", "Login")}</div>
                <div className={`ltab ${tab === "register" ? "active" : ""}`} onClick={() => { setTab("register"); setErr(""); }}>{translateText(lang, "register", "Register")}</div>
              </div>
              <div className="fg"><label>{translateText(lang, "phone_number", "Phone Number")}</label><input placeholder={translateText(lang, "your_phone_number", "Your phone number")} value={f.phone} onChange={e => upd({ phone: e.target.value })} onKeyDown={e => e.key === "Enter" && submit()} /></div>
              <div className="fg"><label>{translateText(lang, "password", "Password")}</label><input type="password" placeholder={translateText(lang, "password", "Password")} value={f.password} onChange={e => upd({ password: e.target.value })} onKeyDown={e => e.key === "Enter" && submit()} /></div>
              <div className="fg">
                <label>{translateText(lang, "team_code", "Team Code")}</label>
                <input placeholder={translateText(lang, "enter_team_code", "Enter team code provided by admin")} value={f.teamCode} onChange={e => upd({ teamCode: e.target.value })} onKeyDown={e => e.key === "Enter" && submit()} />
                {tab === "register" && <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>{translateText(lang, "check_team_code", "Please check the team code with admin before registering.")}</div>}
              </div>
              {tab === "register" && (
                <div className="fg">
                  <label>{translateText(lang, "fantasy_team_name", "Fantasy Team Name")}</label>
                  <input placeholder={translateText(lang, "fantasy_team_placeholder", "Add your new team name (e.g. Bengal Bewdas)")} value={f.teamName} onChange={e => upd({ teamName: e.target.value })} onKeyDown={e => e.key === "Enter" && submit()} />
                </div>
              )}
              {err && <div className="fe">⚠ {err}</div>}
              <button className="btn btn-primary" style={{ width: "100%", marginTop: 16, justifyContent: "center" }} onClick={submit} disabled={busy}>
                {busy ? translateText(lang, "please_wait", "Please wait...") : (tab === "login" ? translateText(lang, "enter_the_game", "Enter the Game") : translateText(lang, "create_account", "Create Account"))}
              </button>
              <div className="lswitch">Admin? <span onClick={onGoAdmin}>{translateText(lang, "go_admin_panel", "Go to Admin Panel →")}</span></div>
              <div className="lswitch">Need help? <span onClick={onGoManual}>{translateText(lang, "open_user_manual", "Open User Manual →")}</span></div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── ADMIN LOGIN ──────────────────────────────────────────────────────────────
function AdminLoginPage({ onLogin, onGoUser, lang, setLang }) {
  const [f, setF] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!f.username.trim() || !f.password) { setErr(lang === "hi" ? "यूज़रनेम और पासवर्ड दर्ज करें" : "Enter username and password"); return; }
    setBusy(true);
    setErr("");
    try {
      await onLogin(f.username.trim(), f.password);
    } catch (e) {
      setErr(e?.message || (lang === "hi" ? "गलत एडमिन क्रेडेंशियल्स" : "Invalid admin credentials"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="adm-login-bg">
      <div className="lcard card" style={{ borderColor: "rgba(139,92,246,.3)" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}><LanguageToggle lang={lang} setLang={setLang} /></div>
        <div className="lhero"><h1>IFL <span className="p">Admin</span></h1><p>{translateText(lang, "administrative_control_panel", "Administrative Control Panel")}</p></div>
        <div className="fg"><label>Username</label><input placeholder="admin" value={f.username} onChange={e => setF(x => ({ ...x, username: e.target.value }))} onKeyDown={e => e.key === "Enter" && submit()} /></div>
        <div className="fg"><label>{translateText(lang, "password", "Password")}</label><input type="password" placeholder="••••••••" value={f.password} onChange={e => setF(x => ({ ...x, password: e.target.value }))} onKeyDown={e => e.key === "Enter" && submit()} /></div>
        {err && <div className="fe">⚠ {err}</div>}
        <button className="btn btn-adm" style={{ width: "100%", marginTop: 16, justifyContent: "center" }} onClick={submit} disabled={busy}>{busy ? translateText(lang, "signing_in", "Signing in...") : translateText(lang, "access_admin_panel", "Access Admin Panel")}</button>
        <div className="lswitch">Not admin? <span onClick={onGoUser}>{translateText(lang, "go_player_login", "Go to Player Login →")}</span></div>
      </div>
    </div>
  );
}

// ─── ADMIN: PLAYERS ───────────────────────────────────────────────────────────
function AdminPlayers({ showToast, adminToken }) {
  const [players, setPlayers] = useState(getPlayers);
  const [flt, setFlt] = useState({ search: "", team: "ALL", role: ROLE_FILTER_ANY });
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const blank = { name: "", team: "CSK", role: "BAT", country: "India" };
  const [form, setForm] = useState(blank);
  const [fe, setFe] = useState("");

  const persist = async (u) => {
    setPlayers(u);
    await saveStrict("ifl_master_players", u, { adminToken });
    await bootstrapStore({ adminToken });
    setPlayers(getPlayers());
  };
  const openAdd = () => { setForm(blank); setFe(""); setModal({ mode: "add" }); };
  const openEdit = p => { setForm({ name: p.name, team: p.team, role: p.role, country: p.country }); setFe(""); setModal({ mode: "edit", p }); };

  const saveP = async () => {
    if (!form.name.trim()) { setFe("Name required"); return; }
    let updated;
    if (modal.mode === "add") {
      const id = Math.max(0, ...players.map(x => x.id)) + 1;
      updated = [...players, { id, name: form.name.trim(), team: form.team.toUpperCase(), role: form.role, country: form.country || "India" }];
      showToast("Player added ✓", "success");
    } else {
      updated = players.map(x => x.id === modal.p.id ? { ...x, name: form.name.trim(), team: form.team.toUpperCase(), role: form.role, country: form.country || "India" } : x);
      showToast("Player updated ✓", "success");
    }
    try {
      await persist(updated);
      setModal(null);
    } catch (e) {
      showToast(e?.code === "STALE_WRITE" ? "Data changed on another screen. Please retry." : "Failed to save player.", "error");
    }
  };

  const delP = async (id) => {
    try {
      await persist(players.filter(x => x.id !== id));
      setConfirm(null);
      showToast("Player removed", "info");
    } catch (e) {
      showToast(e?.code === "STALE_WRITE" ? "Data changed on another screen. Please retry." : "Failed to delete player.", "error");
    }
  };

  useEffect(() => {
    const sync = () => setPlayers(getPlayers());
    sync();
    const t = setInterval(sync, 15000);
    return () => clearInterval(t);
  }, []);

  const filtered = players.filter(p =>
    (flt.team === "ALL" || p.team === flt.team) &&
    (flt.role === ROLE_FILTER_ANY || p.role === flt.role) &&
    (!flt.search || p.name.toLowerCase().includes(flt.search.toLowerCase()))
  );
  const teams = [...new Set(players.map(p => p.team))].sort();

  return (
    <div className="page">
      <div className="sh">
        <div><div className="pt">Master Player Sheet</div><div className="ps">{players.length} players · source for user team selection</div></div>
        <button className="btn btn-adm" onClick={openAdd}>+ Add Player</button>
      </div>
      <div className="pfilters">
        <input placeholder="🔍 Search player..." style={{ width: 210 }} value={flt.search} onChange={e => setFlt(f => ({ ...f, search: e.target.value }))} />
        <select style={{ width: 130 }} value={flt.team} onChange={e => setFlt(f => ({ ...f, team: e.target.value }))}>
          <option value="ALL">All Teams</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={{ width: 130 }} value={flt.role} onChange={e => setFlt(f => ({ ...f, role: e.target.value }))}>
          <option value={ROLE_FILTER_ANY}>All Roles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{k} – {v}</option>)}
        </select>
        <span style={{ fontSize: 13, color: "var(--muted)", marginLeft: "auto" }}>{filtered.length} results</span>
      </div>
      <div className="tw">
        <table>
          <thead><tr><th>#</th><th>Player Name</th><th>IPL Team</th><th>Role</th><th>Country</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(p => {
              const tc = IPL_TEAM_COLORS[p.team] || { bg: "#334", text: "#fff" };
              const rc = ROLE_COLORS[p.role];
              return (
                <tr key={p.id}>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>{p.id}</td>
                  <td><strong style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 15 }}>{p.name}</strong></td>
                  <td><span style={{ background: tc.bg, color: tc.text, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 11, padding: "2px 8px", borderRadius: 3 }}>{p.team}</span></td>
                  <td><span className="tag" style={{ background: rc + "22", color: rc }}>{p.role}</span></td>
                  <td style={{ fontSize: 13 }}>{p.country !== "India" ? `🌍 ${p.country}` : p.country}</td>
                  <td><div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-secondary btn-xs" onClick={() => openEdit(p)}>✏ Edit</button>
                    <button className="btn btn-danger btn-xs" onClick={() => setConfirm({ id: p.id, name: p.name })}>🗑 Delete</button>
                  </div></td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No players match filters</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.mode === "add" ? "Add New Player" : "Edit Player"} onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary btn-sm" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-adm btn-sm" onClick={saveP}>{modal.mode === "add" ? "Add Player" : "Save Changes"}</button>
          </>}>
          <div className="fg"><label>Full Name *</label><input placeholder="e.g. MS Dhoni" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="fr fr2">
            <div className="fg"><label>IPL Team *</label>
              <select value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value }))}>
                {ALL_IPL_TEAMS.map(t => <option key={t.abbr} value={t.abbr}>{t.abbr} – {t.name}</option>)}
              </select>
            </div>
            <div className="fg"><label>Role *</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{k} – {v}</option>)}
              </select>
            </div>
          </div>
          <div className="fg"><label>Country</label><input placeholder="India" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
          {fe && <div className="fe">⚠ {fe}</div>}
        </Modal>
      )}
      {confirm && <Confirm danger title="Delete Player" text={`Remove "${confirm.name}" from master sheet?`} onOk={() => delP(confirm.id)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ─── ADMIN: MATCHES ───────────────────────────────────────────────────────────
function AdminMatches({ showToast, onRecalculate, adminToken }) {
  const [matches, setMatches] = useState(getMatches);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [winEdit, setWinEdit] = useState(null);
  const blank = { date: nowLocalMatchTs(), teamA: "Chennai Super Kings", teamAabbr: "CSK", teamB: "Mumbai Indians", teamBabbr: "MI", venue: "", winner: "" };
  const [form, setForm] = useState(blank);
  const [fe, setFe] = useState("");

  const persist = async (u) => {
    setMatches(u);
    await saveStrict("ifl_master_matches", u, { adminToken });
    await bootstrapStore({ adminToken });
    setMatches(getMatches());
  };
  const getAbbr = name => ALL_IPL_TEAMS.find(t => t.name === name)?.abbr || name.slice(0, 4).toUpperCase();
  const setTA = n => setForm(f => ({ ...f, teamA: n, teamAabbr: getAbbr(n) }));
  const setTB = n => setForm(f => ({ ...f, teamB: n, teamBabbr: getAbbr(n) }));

  const openAdd = () => { setForm(blank); setFe(""); setModal({ mode: "add" }); };
  const openEdit = m => { setForm({ date: normalizeMatchDateTime(m.date), teamA: m.teamA, teamAabbr: m.teamAabbr, teamB: m.teamB, teamBabbr: m.teamBabbr, venue: m.venue, winner: m.winner || "" }); setFe(""); setModal({ mode: "edit", m }); };

  const saveM = async () => {
    if (!form.date) { setFe("Date & time required"); return; }
    if (form.teamA === form.teamB) { setFe("Teams must differ"); return; }
    if (!form.venue.trim()) { setFe("Venue required"); return; }
    const dateVal = normalizeMatchDateTime(form.date);
    let updated;
    if (modal.mode === "add") {
      const id = Math.max(0, ...matches.map(x => x.id)) + 1;
      updated = [...matches, { id, date: dateVal, teamA: form.teamA, teamAabbr: form.teamAabbr, teamB: form.teamB, teamBabbr: form.teamBabbr, venue: form.venue.trim(), winner: form.winner || "" }];
      showToast("Match added ✓", "success");
    } else {
      updated = matches.map(x => x.id === modal.m.id ? { ...x, ...form, date: dateVal, venue: form.venue.trim() } : x);
      showToast("Match updated ✓", "success");
    }
    try {
      await persist(updated.sort((a, b) => a.date.localeCompare(b.date)));
      await recomputeAndSaveUsersStrict(adminToken);
      onRecalculate?.();
      setModal(null);
    } catch (e) {
      showToast(e?.code === "STALE_WRITE" ? "Data changed on another screen. Please retry." : "Failed to save match update.", "error");
    }
  };

  const delM = async (id) => {
    const stats = { ...getMatchStats() };
    delete stats[String(id)];
    try {
      await persist(matches.filter(x => x.id !== id));
      await saveStrict("ifl_match_stats", stats, { adminToken });
      await recomputeAndSaveUsersStrict(adminToken);
      onRecalculate?.();
      setConfirm(null);
      showToast("Match deleted", "info");
    } catch (e) {
      showToast(e?.code === "STALE_WRITE" ? "Data changed on another screen. Please retry." : "Failed to delete match.", "error");
    }
  };

  const setWinner = async (matchId, abbr) => {
    try {
      await persist(matches.map(m => m.id === matchId ? { ...m, winner: m.winner === abbr ? "" : abbr } : m));
      await recomputeAndSaveUsersStrict(adminToken);
      onRecalculate?.();
      showToast(abbr ? `Winner set: ${abbr} ✓` : "Winner cleared", "success");
      setWinEdit(null);
    } catch (e) {
      showToast(e?.code === "STALE_WRITE" ? "Data changed on another screen. Please retry." : "Failed to update winner.", "error");
    }
  };

  const grouped = matches.reduce((acc, m) => { const mo = m.date.slice(0, 7); (acc[mo] = acc[mo] || []).push(m); return acc; }, {});

  return (
    <div className="page">
      <div className="sh">
        <div><div className="pt">Match Schedule</div><div className="ps">{matches.length} matches · {matches.filter(m => m.winner).length} results declared · {matches.filter(m => !m.winner).length} pending</div></div>
        <button className="btn btn-adm" onClick={openAdd}>+ Add Match</button>
      </div>

      {Object.entries(grouped).map(([mo, mlist]) => (
        <div key={mo} style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 700, color: "var(--muted)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>
            {new Date(mo + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </div>
          <div className="tw">
            <table>
              <thead><tr><th>ID</th><th>Date</th><th>Team A</th><th>Team B</th><th>Venue</th><th>Winner</th><th>Actions</th></tr></thead>
              <tbody>
                {mlist.map(m => (
                  <tr key={m.id}>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{m.id}</td>
                    <td style={{ fontSize: 13 }}>{m.date}</td>
                    <td><TeamBadge abbr={m.teamAabbr} sm /></td>
                    <td><TeamBadge abbr={m.teamBabbr} sm /></td>
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>📍 {m.venue}</td>
                    <td>
                      {winEdit === m.id ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <div className={`wopt ${m.winner === m.teamAabbr ? "sel" : ""}`} onClick={() => setWinner(m.id, m.teamAabbr)}><TeamBadge abbr={m.teamAabbr} sm /> {m.teamAabbr}</div>
                          <div className={`wopt ${m.winner === m.teamBabbr ? "sel" : ""}`} onClick={() => setWinner(m.id, m.teamBabbr)}><TeamBadge abbr={m.teamBabbr} sm /> {m.teamBabbr}</div>
                          <div className={`wopt ${m.winner === "NR" ? "sel" : ""}`} onClick={() => setWinner(m.id, "NR")}>No Result</div>
                          <div className="wopt clr" onClick={() => setWinner(m.id, "")}>✕ Clear</div>
                          <div className="wopt cx" onClick={() => setWinEdit(null)}>Close</div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {m.winner ? <span className="wbadge">🏆 {m.winner === "NR" ? "No Result" : m.winner}</span> : <span className="pbadge">Pending</span>}
                          <button className="btn btn-secondary btn-xs" onClick={() => setWinEdit(m.id)}>Set Winner</button>
                        </div>
                      )}
                    </td>
                    <td><div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => openEdit(m)}>✏ Edit</button>
                      <button className="btn btn-danger btn-xs" onClick={() => setConfirm({ id: m.id })}>🗑</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {matches.length === 0 && <div className="empty"><div className="ico">📅</div><p>No matches yet</p><small>Add the first match</small></div>}

      {modal && (
        <Modal title={modal.mode === "add" ? "Add New Match" : "Edit Match"} onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary btn-sm" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-adm btn-sm" onClick={saveM}>{modal.mode === "add" ? "Add Match" : "Save Changes"}</button>
          </>}>
          <div className="fr fr2">
            <div className="fg"><label>Schedule *</label><input type="datetime-local" value={toDateTimeInputValue(form.date)} onChange={e => setForm(f => ({ ...f, date: fromDateTimeInputValue(e.target.value) }))} /></div>
            <div className="fg"><label>Venue *</label><input placeholder="e.g. Chennai" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} /></div>
          </div>
          <div className="fr fr2">
            <div className="fg"><label>Team A *</label>
              <select value={form.teamA} onChange={e => setTA(e.target.value)}>
                {ALL_IPL_TEAMS.map(t => <option key={t.abbr} value={t.name}>{t.abbr} – {t.name}</option>)}
              </select>
            </div>
            <div className="fg"><label>Team B *</label>
              <select value={form.teamB} onChange={e => setTB(e.target.value)}>
                {ALL_IPL_TEAMS.map(t => <option key={t.abbr} value={t.name}>{t.abbr} – {t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="fg"><label>Winner (optional)</label>
            <select value={form.winner} onChange={e => setForm(f => ({ ...f, winner: e.target.value }))}>
              <option value="">— Not decided yet —</option>
              <option value={form.teamAabbr}>{form.teamAabbr}</option>
              <option value={form.teamBabbr}>{form.teamBabbr}</option>
              <option value="NR">No Result</option>
            </select>
          </div>
          {fe && <div className="fe">⚠ {fe}</div>}
        </Modal>
      )}
      {confirm && <Confirm danger title="Delete Match" text="Delete this match? User predictions for it may become invalid." onOk={() => delM(confirm.id)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ─── ADMIN: SCORING ───────────────────────────────────────────────────────────
function AdminScoring({ showToast, onRecalculate, adminToken }) {
  const [matches, setMatches] = useState(getMatches);
  const players = getPlayers();
  const [stats, setStats] = useState(() => getMatchStats());
  const [matchId, setMatchId] = useState(() => (matches[0] ? String(matches[0].id) : ""));
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftMeta, setDraftMeta] = useState(null);

  const match = matches.find(m => String(m.id) === String(matchId));
  const stat = (match && stats[String(match.id)]) || { players: {}, motmPlayerId: "" };
  const playerPool = match
    ? players.filter(p => p.team === match.teamAabbr || p.team === match.teamBabbr)
    : [];
  const playerByName = playerPool.reduce((acc, p) => {
    acc[normalizePlayerNameKey(p.name)] = p;
    return acc;
  }, {});
  const findTeamAbbrByAnyName = (value) => {
    const raw = String(value || "").trim();
    if (!raw || !match) return "";
    const upper = raw.toUpperCase();
    if (["NR", "NO RESULT", "NO-RESULT", "ABANDONED", "ABANDON"].includes(upper)) return "NR";
    if (upper === match.teamAabbr || upper === match.teamBabbr) return upper;
    const compact = normalizePlayerNameKey(raw);
    if (compact === normalizePlayerNameKey(match.teamA)) return match.teamAabbr;
    if (compact === normalizePlayerNameKey(match.teamB)) return match.teamBabbr;
    return "";
  };

  useEffect(() => {
    const sync = () => {
      const nextMatches = getMatches();
      const nextStats = getMatchStats();
      setMatches(nextMatches);
      setStats(nextStats);
      if (nextMatches.length > 0) {
        const currentExists = nextMatches.some(m => String(m.id) === String(matchId));
        if (!currentExists) setMatchId(String(nextMatches[0].id));
      }
    };
    sync();
    const t = setInterval(sync, 15000);
    return () => clearInterval(t);
  }, [matchId]);

  const updatePlayerStat = (pid, key, value) => {
    if (!match) return;
    const mid = String(match.id);
    const current = stats[mid] || { players: {}, motmPlayerId: "" };
    const pcur = current.players?.[pid] || { runs: 0, catches: 0, runouts: 0, wickets: 0 };
    const next = {
      ...stats,
      [mid]: {
        ...current,
        players: {
          ...current.players,
          [pid]: { ...pcur, [key]: Math.max(0, Number(value) || 0) },
        },
      },
    };
    setStats(next);
  };

  const setMotm = (pid) => {
    if (!match) return;
    const mid = String(match.id);
    const current = stats[mid] || { players: {}, motmPlayerId: "" };
    setStats({ ...stats, [mid]: { ...current, motmPlayerId: pid ? Number(pid) : "" } });
  };

  const saveScoring = async () => {
    try {
      const currentMatches = getMatches();
      const persistedMatch = currentMatches.find((m) => String(m.id) === String(match?.id));
      if (persistedMatch?.winner) {
        await saveStrict("ifl_master_matches", currentMatches, { adminToken });
      }
      await saveStrict("ifl_match_stats", stats, { adminToken });
      await recomputeAndSaveUsersStrict(adminToken);
      onRecalculate?.();
      showToast("Match scoring saved and leaderboard recalculated ✓", "success");
    } catch (e) {
      showToast(e?.code === "STALE_WRITE" ? "Data changed on another screen. Latest state loaded. Please retry." : "Failed to save scoring.", "error");
    }
  };

  const clearScoring = async () => {
    if (!match) return;
    const mid = String(match.id);
    const next = { ...stats, [mid]: { players: {}, motmPlayerId: "" } };
    setStats(next);
    try {
      await saveStrict("ifl_match_stats", next, { adminToken });
      await recomputeAndSaveUsersStrict(adminToken);
      onRecalculate?.();
      showToast("Scoring cleared for this match", "info");
    } catch (e) {
      showToast(e?.code === "STALE_WRITE" ? "Data changed on another screen. Latest state loaded. Please retry." : "Failed to clear scoring.", "error");
    }
  };

  const buildImportPreview = (rawInput) => {
    if (!match) return null;
    const parsed = parseManualScoreImport(rawInput);
    const matched = [];
    const unmatched = [];
    parsed.rows.forEach((row) => {
      const mapped = playerByName[normalizePlayerNameKey(row.name)];
      if (mapped) {
        matched.push({ playerId: mapped.id, playerName: mapped.name, ...row });
      } else {
        unmatched.push(row.name);
      }
    });
    const motmId = parsed.motm ? (playerByName[normalizePlayerNameKey(parsed.motm)]?.id || "") : "";
    const winnerAbbr = findTeamAbbrByAnyName(parsed.winner);
    return {
      totalRows: parsed.rows.length,
      matched,
      unmatched,
      motmRaw: parsed.motm || "",
      motmId,
      winnerRaw: parsed.winner || "",
      winnerAbbr,
    };
  };

  const onImportPreview = (rawInput = importText) => {
    if (!match) return;
    setImportPreview(buildImportPreview(rawInput));
  };

  const applyManualImport = async () => {
    if (!match || !importPreview) return;
    const mid = String(match.id);
    const current = stats[mid] || { players: {}, motmPlayerId: "" };
    const nextPlayers = { ...(current.players || {}) };
    importPreview.matched.forEach((row) => {
      nextPlayers[row.playerId] = {
        runs: toImportNum(row.runs),
        catches: toImportNum(row.catches),
        runouts: toImportNum(row.runouts),
        wickets: toImportNum(row.wickets),
      };
    });
    const nextStats = {
      ...stats,
      [mid]: {
        ...current,
        players: nextPlayers,
        motmPlayerId: importPreview.motmId || current.motmPlayerId || "",
      },
    };
    setStats(nextStats);
    try {
      if (importPreview.winnerAbbr) {
        const nextMatches = getMatches().map((m) => (String(m.id) === mid ? { ...m, winner: importPreview.winnerAbbr } : m));
        await saveStrict("ifl_master_matches", nextMatches, { adminToken });
      }
      setImportOpen(false);
      setImportText("");
      setImportPreview(null);
      showToast(`Imported ${importPreview.matched.length} player rows`, "success");
    } catch (e) {
      showToast(e?.code === "STALE_WRITE" ? "Data changed on another screen. Latest state loaded. Please retry." : "Failed to import winner/state.", "error");
    }
  };

  const loadImportFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    setImportText(String(text || ""));
    setImportPreview(null);
  };

  return (
    <div className="page">
      <div className="sh">
        <div><div className="pt">Points Scoring</div><div className="ps">Update match-wise player stats and recalculate all points</div></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => { setImportOpen(true); setImportPreview(null); setDraftMeta(null); }} disabled={!match}>Manual Import</button>
          <button className="btn btn-secondary btn-sm" onClick={clearScoring} disabled={!match}>Clear Match</button>
          <button className="btn btn-adm btn-sm" onClick={saveScoring}>Save & Recalculate</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="fg" style={{ marginBottom: 10 }}>
          <label>Select Match</label>
          <select value={matchId} onChange={e => setMatchId(e.target.value)}>
            {matches.map(m => <option key={m.id} value={m.id}>Match {m.id}: {m.teamAabbr} vs {m.teamBabbr} ({m.date})</option>)}
          </select>
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
          Use manual JSON or CSV import, or enter player stats directly in the scoring grid below.
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
          Runs: 1 each · Catch: 5 · Runout/Stumping: 10 · Wicket: 20 · 3W bonus: +25 · 5W bonus: +50 · 50/75/100 run bonus: +25/+50/+100 · MoM: +50 · Winner pick: +50
        </div>
      </div>

      {!match && <div className="empty"><p>No matches available</p></div>}

      {match && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <label>Man of the Match</label>
            <select value={stat.motmPlayerId || ""} onChange={e => setMotm(e.target.value)}>
              <option value="">— None —</option>
              {playerPool.map(p => <option key={p.id} value={p.id}>{p.name} ({p.team})</option>)}
            </select>
          </div>
          <div className="tw">
            <table>
              <thead><tr><th>Player</th><th>Team</th><th>Runs</th><th>Catches</th><th>Runout/Stump</th><th>Wickets</th><th>Points</th></tr></thead>
              <tbody>
                {playerPool.map(p => {
                  const ps = stat.players?.[p.id] || { runs: 0, catches: 0, runouts: 0, wickets: 0 };
                  return (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td><TeamBadge abbr={p.team} sm /></td>
                      {["runs", "catches", "runouts", "wickets"].map(k => (
                        <td key={k}><input type="number" min="0" value={ps[k] ?? 0} onChange={e => updatePlayerStat(p.id, k, e.target.value)} /></td>
                      ))}
                      <td style={{ fontWeight: 700, color: "var(--acc)" }}>{scorePlayerPerformance(ps)}</td>
                    </tr>
                  );
                })}
                {playerPool.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>No players from selected fixture in master sheet</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {importOpen && (
        <Modal
          title={`Manual Import · Match ${match?.id || ""}`}
          onClose={() => { setImportOpen(false); setDraftMeta(null); }}
          footer={
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => { setImportOpen(false); setDraftMeta(null); }}>Cancel</button>
              <button className="btn btn-secondary btn-sm" onClick={() => onImportPreview()}>Preview</button>
              <button className="btn btn-adm btn-sm" onClick={applyManualImport} disabled={!importPreview}>Apply Import</button>
            </>
          }
        >
          <div className="import-grid">
            <div className="import-box">
              <label>Paste JSON or CSV</label>
              <textarea
                rows={14}
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setImportPreview(null); }}
                placeholder={`JSON:\n{"winner":"CSK","motm":"MS Dhoni","players":[{"name":"Virat Kohli","runs":67,"catches":1,"runouts":0,"wickets":0}]}\n\nCSV:\nname,runs,catches,runouts,wickets\nVirat Kohli,67,1,0,0`}
              />
              <div style={{ marginTop: 10 }}>
                <input type="file" accept=".json,.csv,.txt" onChange={e => { void loadImportFile(e.target.files?.[0]); }} />
              </div>
              {draftMeta && (
                <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                  <div>Review or tweak the imported JSON, then click Preview and Apply Import.</div>
                </div>
              )}
            </div>
            <div className="import-box">
              <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 16 }}>Preview</div>
              {!importPreview && <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>Click Preview to validate and map player names.</div>}
              {importPreview && (
                <>
                  <div className="import-stats">
                    <span className="import-chip">Rows: {importPreview.totalRows}</span>
                    <span className="import-chip ok">Matched: {importPreview.matched.length}</span>
                    <span className="import-chip err">Unmatched: {importPreview.unmatched.length}</span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13 }}>
                    <div>Winner: <b>{importPreview.winnerAbbr || "Not mapped"}</b>{importPreview.winnerRaw ? ` (${importPreview.winnerRaw})` : ""}</div>
                    <div>MoM: <b>{importPreview.motmId ? (playerByName[normalizePlayerNameKey(importPreview.motmRaw)]?.name || "Mapped") : "Not mapped"}</b>{importPreview.motmRaw ? ` (${importPreview.motmRaw})` : ""}</div>
                  </div>
                  <div className="import-list">
                    {importPreview.unmatched.length > 0 ? `Unmatched: ${importPreview.unmatched.join(", ")}` : "All names matched to fixture players."}
                  </div>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── ADMIN: DASHBOARD ─────────────────────────────────────────────────────────
function AdminDash({ adminToken, showToast }) {
  const players = getPlayers();
  const matches = getMatches();
  const users = load("ifl_users", {});
  const ul = Object.entries(users);
  const leaderboardRows = ul.map(([un, u]) => ({ un, teamName: u.teamName, teamLogo: u.teamLogo || "", points: u.points || 0, preds: Object.keys(u.predictions || {}).length })).sort((a, b) => b.points - a.points);
  const topUsers = leaderboardRows.slice(0, 5);
  const pending = matches.filter(m => !m.winner);
  const [exporting, setExporting] = useState(false);

  const exportLeaderboardCsv = async () => {
    if (exporting) return;
    try {
      setExporting(true);
      await downloadAdminLeaderboardExport(adminToken, "", "csv");
      showToast("Daily leaderboard CSV downloaded ✓", "success");
    } catch (e) {
      showToast(e?.message || "Failed to export leaderboard", "error");
    } finally {
      setExporting(false);
    }
  };

  const exportLeaderboardPdf = async () => {
    try {
      const ranks = await fetchPrevRankMap(nowLocalMatchTs().slice(0, 10));
      await openLeaderboardPdfExport(leaderboardRows, ranks);
      showToast("Leaderboard PDF view opened ✓", "success");
    } catch (e) {
      showToast(e?.message || "Failed to open PDF export", "error");
    }
  };

  return (
    <div className="page">
      <div className="sh">
        <div>
          <div className="pt">Dashboard</div>
          <div className="ps">IFL 2026 platform overview</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={exportLeaderboardPdf}>
            Export Leaderboard PDF
          </button>
          <button className="btn btn-secondary" onClick={exportLeaderboardCsv} disabled={exporting}>
            {exporting ? "Preparing CSV..." : "Download Daily CSV"}
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 28 }}>
        {[
          { l: "Master Players", v: players.length, ico: "🏏" },
          { l: "Total Matches", v: matches.length, ico: "📅" },
          { l: "Pending Results", v: pending.length, ico: "⏳" },
          { l: "Registered Users", v: ul.length, ico: "👥" },
          { l: "Total Predictions", v: ul.reduce((s, [, u]) => s + Object.keys(u.predictions || {}).length, 0), ico: "🎯" },
          { l: "Overseas Players", v: players.filter(p => p.country !== "India").length, ico: "🌍" },
        ].map(s => (
          <div key={s.l} className="astat">
            <div style={{ fontSize: 24, marginBottom: 6 }}>{s.ico}</div>
            <div className="astat-v">{s.v}</div>
            <div className="astat-l">{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 14 }}>🏆 Top 5 Users</div>
          {topUsers.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13 }}>No users yet</div> :
            topUsers.map((u, i) => (
              <div key={u.un} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < topUsers.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 700, color: i === 0 ? "var(--gold)" : "var(--muted)", width: 24, textAlign: "center" }}>
                  {["🥇", "🥈", "🥉"][i] || `#${i + 1}`}
                </span>
                <div style={{ flex: 1 }}><div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 15, fontWeight: 600 }}>{u.teamName}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>📱 {u.un}</div></div>
                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 20, fontWeight: 700, color: "var(--acc)" }}>{u.points}</div>
              </div>
            ))
          }
        </div>
        <div className="card">
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 14 }}>⏳ Pending Results</div>
          {pending.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13 }}>All results declared ✓</div> :
            pending.slice(0, 6).map((m, i) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < Math.min(pending.length, 6) - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontFamily: "'Rajdhani',sans-serif", fontWeight: 600 }}>
                    <TeamBadge abbr={m.teamAabbr} sm /> <span style={{ color: "var(--muted)" }}>vs</span> <TeamBadge abbr={m.teamBabbr} sm />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{m.date} · {m.venue}</div>
                </div>
                <span className="pbadge" style={{ fontSize: 10 }}>Pending</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN: USERS ─────────────────────────────────────────────────────────────
function AdminUsers({ showToast, onRecalculate, adminToken }) {
  const [users, setUsers] = useState(() => load("ifl_users", {}));
  const [confirm, setConfirm] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const players = getPlayers();
  const playerById = new Map(players.map(p => [p.id, p]));

  const persistUsersWithRetry = async (buildNext, successMsg) => {
    let base = load("ifl_users", {});
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const next = buildNext(base);
      try {
        await saveStrict("ifl_users", next, { adminToken });
        setUsers(next);
        onRecalculate?.();
        if (successMsg) showToast(successMsg, "success");
        return true;
      } catch (e) {
        if (e?.code === "STALE_WRITE" && attempt === 0) {
          await bootstrapStore({ adminToken });
          base = load("ifl_users", {});
          continue;
        }
        throw e;
      }
    }
    return false;
  };

  const del = async (un) => {
    try {
      await adminDeleteUser(un, adminToken);
      await bootstrapStore({ adminToken });
      const nextUsers = load("ifl_users", {});
      setUsers(nextUsers);
      setConfirm(null);
      setViewUser((curr) => (curr === un ? null : curr));
      onRecalculate?.();
      showToast(`User ${un} removed`, "success");
    } catch {
      showToast("Failed to remove user. Please retry.", "error");
    }
  };

  const setStatus = async (un, patch, msg) => {
    try {
      await persistUsersWithRetry(
        (base) => {
          const current = { ...(base[un] || {}) };
          const next = { ...base, [un]: { ...current, ...patch } };
          if (patch?.squadFrozen === true) {
            const ts = nowLocalMatchTs();
            const frozenMap = { ...(current.playerFrozenAt || {}) };
            for (const pid of current.players || []) frozenMap[String(pid)] = frozenMap[String(pid)] || ts;
            next[un].playerFrozenAt = frozenMap;
          }
          if (patch?.squadFrozen === false || patch?.squadSubmitted === false) {
            next[un].playerFrozenAt = {};
          }
          return next;
        },
        msg,
      );
    } catch {
      showToast("Update conflicted with another screen. Please retry.", "error");
    }
  };

  const rows = Object.entries(users).map(([un, u]) => ({
    un, teamName: u.teamName, points: u.points || 0,
    squad: (u.players || []).length,
    players: u.players || [],
    preds: Object.keys(u.predictions || {}).length,
    correct: Object.values(u.predictions || {}).filter(p => p.correct === true).length,
    submitted: !!u.squadSubmitted,
    validated: !!u.squadValidated,
    frozen: !!u.squadFrozen,
  })).sort((a, b) => b.points - a.points);

  return (
    <div className="page">
      <div className="pt">Registered Users</div>
      <div className="ps">{rows.length} users on the platform</div>
      <div className="tw">
        <table>
          <thead><tr><th>Rank</th><th>Phone</th><th>Team Name</th><th>Squad</th><th>Status</th><th>Predictions</th><th>Correct</th><th>Points</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.un}>
                <td style={{ color: i === 0 ? "var(--gold)" : "var(--muted)" }}>{["🥇", "🥈", "🥉"][i] || `#${i + 1}`}</td>
                <td><code style={{ background: "var(--sf2)", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{r.un}</code></td>
                <td style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 15, fontWeight: 600 }}>{r.teamName}</td>
                <td>{r.squad}<span style={{ color: "var(--muted)", fontSize: 12 }}>/20</span></td>
                <td>
                  <span className="tag" style={{ background: r.frozen ? "rgba(239,68,68,.15)" : r.validated ? "rgba(16,185,129,.15)" : r.submitted ? "rgba(59,130,246,.15)" : "rgba(100,116,139,.15)", color: r.frozen ? "var(--err)" : r.validated ? "var(--ok)" : r.submitted ? "var(--acc2)" : "var(--muted)" }}>
                    {r.frozen ? "Frozen" : r.validated ? "Validated" : r.submitted ? "Submitted" : "Draft"}
                  </span>
                </td>
                <td>{r.preds}</td>
                <td style={{ color: "var(--ok)" }}>{r.correct}</td>
                <td style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 700, color: "var(--acc)" }}>{r.points}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button className="btn btn-secondary btn-xs" onClick={() => setViewUser(r.un)}>View Squad</button>
                    {!r.validated && <button className="btn btn-secondary btn-xs" onClick={() => setStatus(r.un, { squadValidated: true }, `${r.un} team validated`)}>Validate</button>}
                    {!r.frozen && <button className="btn btn-adm btn-xs" onClick={() => setStatus(r.un, { squadFrozen: true, squadValidated: true }, `${r.un} team frozen`)}>Freeze</button>}
                    {r.frozen && <button className="btn btn-secondary btn-xs" onClick={() => setStatus(r.un, { squadFrozen: false }, `${r.un} team unfrozen`)}>Unfreeze</button>}
                    <button className="btn btn-secondary btn-xs" onClick={() => setStatus(r.un, { squadSubmitted: false, squadValidated: false, squadFrozen: false }, `${r.un} set to draft`)}>Reset</button>
                    <button className="btn btn-danger btn-xs" onClick={() => setConfirm({ un: r.un })}>Remove</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No users registered yet</td></tr>}
          </tbody>
        </table>
      </div>
      {confirm && <Confirm danger title="Remove User" text={`Remove ${confirm.un} and all their data?`} onOk={() => del(confirm.un)} onCancel={() => setConfirm(null)} />}
      {viewUser && (
        <Modal
          title={`Squad Details · ${viewUser}`}
          onClose={() => setViewUser(null)}
          footer={
            <>
              {!users[viewUser]?.squadValidated && <button className="btn btn-secondary btn-sm" onClick={() => setStatus(viewUser, { squadValidated: true }, `${viewUser} team validated`)}>Validate</button>}
              {!users[viewUser]?.squadFrozen && <button className="btn btn-adm btn-sm" onClick={() => setStatus(viewUser, { squadFrozen: true, squadValidated: true }, `${viewUser} team frozen`)}>Freeze</button>}
              {users[viewUser]?.squadFrozen && <button className="btn btn-secondary btn-sm" onClick={() => setStatus(viewUser, { squadFrozen: false }, `${viewUser} team unfrozen`)}>Unfreeze</button>}
              <button className="btn btn-secondary btn-sm" onClick={() => setViewUser(null)}>Close</button>
            </>
          }
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <span className="tag" style={{ background: users[viewUser]?.squadFrozen ? "rgba(239,68,68,.15)" : users[viewUser]?.squadValidated ? "rgba(16,185,129,.15)" : users[viewUser]?.squadSubmitted ? "rgba(59,130,246,.15)" : "rgba(100,116,139,.15)", color: users[viewUser]?.squadFrozen ? "var(--err)" : users[viewUser]?.squadValidated ? "var(--ok)" : users[viewUser]?.squadSubmitted ? "var(--acc2)" : "var(--muted)" }}>
              {users[viewUser]?.squadFrozen ? "Frozen" : users[viewUser]?.squadValidated ? "Validated" : users[viewUser]?.squadSubmitted ? "Submitted" : "Draft"}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Team: {users[viewUser]?.teamName || "-"}</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Players: {(users[viewUser]?.players || []).length}/20</span>
          </div>
          <div className="tw">
            <table>
              <thead><tr><th>#</th><th>Player</th><th>Role</th><th>IPL Team</th></tr></thead>
              <tbody>
                {(users[viewUser]?.players || []).map((pid, i) => {
                  const p = playerById.get(pid);
                  return (
                    <tr key={`${viewUser}-${pid}-${i}`}>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>{i + 1}</td>
                      <td>{p?.name || `Unknown Player (${pid})`}</td>
                      <td>{p?.role ? <span className="tag" style={{ background: (ROLE_COLORS[p.role] || "#64748b") + "22", color: ROLE_COLORS[p.role] || "#94a3b8" }}>{p.role}</span> : "-"}</td>
                      <td>{p?.team ? <TeamBadge abbr={p.team} sm /> : "-"}</td>
                    </tr>
                  );
                })}
                {(users[viewUser]?.players || []).length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>No players selected</td></tr>}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── ADMIN: USER MATCH POINTS ────────────────────────────────────────────────
function AdminUserPoints({ showToast }) {
  const users = load("ifl_users", {});
  const matches = getMatches();
  const swapWindows = getSwapWindows();
  const players = getPlayers();
  const stats = getMatchStats();
  const usernames = Object.keys(users);
  const [username, setUsername] = useState(() => usernames[0] || "");
  const [matchId, setMatchId] = useState(() => (matches[0] ? String(matches[0].id) : ""));

  useEffect(() => {
    if (!username && usernames.length > 0) setUsername(usernames[0]);
  }, [usernames, username]);

  useEffect(() => {
    if (!matchId && matches.length > 0) setMatchId(String(matches[0].id));
  }, [matches, matchId]);

  const user = users[username];
  const match = matches.find((m) => String(m.id) === String(matchId));
  const matchStat = match ? (stats[String(match.id)] || { players: {}, motmPlayerId: "" }) : { players: {}, motmPlayerId: "" };

  const resolveSwapRows = (u) => {
    const rows = [];
    if (u?.swapWindows && typeof u.swapWindows === "object") {
      Object.entries(u.swapWindows).forEach(([wid, val]) => {
        const w = swapWindows.find((sw) => String(sw.id) === String(wid));
        const eff = Number(w?.effective_match_id || 0);
        const out = (val?.out || []).map(Number);
        const ins = (val?.in || []).map(Number);
        if (eff > 0 && out.length && ins.length) rows.push({ eff, out, ins });
      });
    } else if ((u?.swap1Out || []).length || (u?.swap1In || []).length) {
      const eff = Number(swapWindows[0]?.effective_match_id || 0);
      rows.push({ eff, out: (u.swap1Out || []).map(Number), ins: (u.swap1In || []).map(Number) });
    }
    return rows.sort((a, b) => a.eff - b.eff);
  };
  const effectiveSquadForMatch = (baseIds, swapRows, matchId) => {
    const set = new Set(baseIds);
    swapRows.forEach((row) => {
      if (matchId >= row.eff) {
        row.out.forEach((pid) => set.delete(pid));
        row.ins.forEach((pid) => set.add(pid));
      }
    });
    return set;
  };

  const baseIds = (user?.players || []).map(Number);
  const swapRows = resolveSwapRows(user);
  const effectiveSquad = match ? effectiveSquadForMatch(baseIds, swapRows, Number(match.id)) : new Set(baseIds);

  const submittedMap = user?.playerSubmittedAt || {};
  const matchTs = match ? parseLocalDateTime(match.date) : null;

  const playerPool = match
    ? players.filter((p) => p.team === match.teamAabbr || p.team === match.teamBabbr)
    : [];

  const rows = playerPool
    .filter((p) => effectiveSquad.has(Number(p.id)))
    .map((p) => {
      const stat = matchStat.players?.[p.id] || { runs: 0, catches: 0, runouts: 0, wickets: 0 };
      const submittedAt = parseLocalDateTime(submittedMap[p.id]);
      const eligible = !(submittedAt && matchTs && matchTs < submittedAt);
      const basePts = eligible ? scorePlayerPerformance(stat) : 0;
      const motmBonus = eligible && matchStat.motmPlayerId && Number(matchStat.motmPlayerId) === Number(p.id)
        ? POINT_RULES.MAN_OF_MATCH
        : 0;
      return {
        player: p,
        stat,
        basePts,
        motmBonus,
        totalPts: basePts + motmBonus,
      };
    })
    .sort((a, b) => b.totalPts - a.totalPts || a.player.name.localeCompare(b.player.name));

  const pred = match ? (user?.predictions || {})[String(match.id)] : null;
  const predPick = pred?.pick || "";
  const predOk = pred?.correct === true || pred?.correct === false
    ? pred.correct
    : (match && match.winner && match.winner !== "NR" && predPick ? predPick === match.winner : null);
  const predPts = pred?.pts !== undefined ? Number(pred.pts || 0) : (predOk ? POINT_RULES.MATCH_WINNER_PICK : 0);

  const totalPlayerPts = rows.reduce((s, r) => s + r.totalPts, 0);
  const totalMatchPts = totalPlayerPts + predPts;

  return (
    <div className="page">
      <div className="pt">User Match Points</div>
      <div className="ps">Player-wise and prediction-wise points per match</div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="fr fr2">
          <div className="fg">
            <label>User</label>
            <select value={username} onChange={(e) => setUsername(e.target.value)}>
              {usernames.map((u) => (
                <option key={u} value={u}>
                  {users[u]?.teamName ? `${users[u].teamName} (${u})` : u}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Match</label>
            <select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  Match {m.id}: {m.teamAabbr} vs {m.teamBabbr} ({m.date})
                </option>
              ))}
            </select>
          </div>
        </div>
        {!user && <div style={{ color: "var(--muted)", marginTop: 8 }}>No users available.</div>}
        {user && !match && <div style={{ color: "var(--muted)", marginTop: 8 }}>No matches available.</div>}
      </div>

      {user && match && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span className="tag" style={{ background: "rgba(255,255,255,.08)", color: "var(--muted)" }}>
                Player Points: {totalPlayerPts}
              </span>
              <span className="tag" style={{ background: predOk ? "rgba(16,185,129,.15)" : "rgba(255,184,0,.15)", color: predOk ? "var(--ok)" : "var(--gold)" }}>
                Prediction: {predPick || "—"} {match?.winner === "NR" ? "NR" : predOk === null ? "" : predOk ? "✓" : "✕"} · {predPts} pts
              </span>
              <span className="tag" style={{ background: "rgba(255,92,57,.16)", color: "var(--acc)" }}>
                Total Match Points: {totalMatchPts}
              </span>
            </div>
          </div>

          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Team</th>
                  <th>Runs</th>
                  <th>Catches</th>
                  <th>Runout/Stump</th>
                  <th>Wickets</th>
                  <th>Base</th>
                  <th>MoM</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`upts-${r.player.id}`}>
                    <td>{r.player.name}</td>
                    <td><TeamBadge abbr={r.player.team} sm /></td>
                    <td>{r.stat.runs || 0}</td>
                    <td>{r.stat.catches || 0}</td>
                    <td>{r.stat.runouts || 0}</td>
                    <td>{r.stat.wickets || 0}</td>
                    <td style={{ fontWeight: 700, color: "var(--acc)" }}>{r.basePts}</td>
                    <td style={{ fontWeight: 700, color: r.motmBonus ? "var(--ok)" : "var(--muted)" }}>{r.motmBonus}</td>
                    <td style={{ fontWeight: 700, color: "var(--acc2)" }}>{r.totalPts}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                      No squad players from this fixture.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function AdminAccess({ showToast, adminToken }) {
  const [allowed, setAllowed] = useState(() => getAllowedPhones());
  const [phone, setPhone] = useState("");
  const [teamCode, setTeamCode] = useState(() => getGlobalTeamCode());
  const [auditRows, setAuditRows] = useState([]);
  const [auditSummary, setAuditSummary] = useState({});
  const [auditLoading, setAuditLoading] = useState(true);

  const loadAudit = useCallback(async () => {
    try {
      setAuditLoading(true);
      const data = await fetchAdminLoginAudit(adminToken, 100);
      setAuditRows(Array.isArray(data?.rows) ? data.rows : []);
      setAuditSummary(data?.summary && typeof data.summary === "object" ? data.summary : {});
    } catch (e) {
      showToast(e?.message || "Failed to load login audit", "error");
    } finally {
      setAuditLoading(false);
    }
  }, [adminToken, showToast]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const addPhone = () => {
    const p = normalizePhone(phone);
    if (!isValidPhone(p)) { showToast("Enter valid phone (10-15 digits)", "error"); return; }
    if (allowed.map(normalizePhone).includes(p)) { showToast("Phone already allowed", "info"); return; }
    const next = [...allowed, p].sort();
    setAllowed(next);
    void save("ifl_allowed_phones", next, { adminToken });
    setPhone("");
    showToast("Allowed phone added ✓", "success");
  };

  const removePhone = (p) => {
    const next = allowed.filter(x => normalizePhone(x) !== normalizePhone(p));
    setAllowed(next);
    void save("ifl_allowed_phones", next, { adminToken });
    showToast("Allowed phone removed", "info");
  };

  const saveTeamCode = () => {
    const code = normalizeTeamCode(teamCode);
    if (!code) { showToast("Team code cannot be empty", "error"); return; }
    setTeamCode(code);
    void save("ifl_global_team_code", code, { adminToken });
    showToast("Global team code updated ✓", "success");
  };

  return (
    <div className="page">
      <div className="pt">Access Controls</div>
      <div className="ps">Manage global team code and allowed phone numbers</div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="fr fr2">
          <div className="fg">
            <label>Global Team Code</label>
            <input placeholder="e.g. IFL2026" value={teamCode} onChange={e => setTeamCode(e.target.value)} />
          </div>
          <div className="fg" style={{ display: "flex", alignItems: "end" }}>
            <button className="btn btn-adm" onClick={saveTeamCode}>Update Team Code</button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          This code is shared with all participants and is required for both register and login.
        </div>
      </div>
      <div className="pt" style={{ fontSize: 20 }}>Allowed Phone Numbers</div>
      <div className="ps" style={{ marginBottom: 12 }}>Only these phone numbers can register and login</div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="fr fr2">
          <div className="fg"><label>Phone Number</label><input placeholder="e.g. 9876543210" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div className="fg" style={{ display: "flex", alignItems: "end" }}><button className="btn btn-adm" onClick={addPhone}>Add Allowed Number</button></div>
        </div>
      </div>
      <div className="tw">
        <table>
          <thead><tr><th>#</th><th>Phone</th><th>Actions</th></tr></thead>
          <tbody>
            {allowed.map((p, i) => (
              <tr key={p}>
                <td style={{ color: "var(--muted)", fontSize: 12 }}>{i + 1}</td>
                <td><code style={{ background: "var(--sf2)", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{p}</code></td>
                <td><button className="btn btn-danger btn-xs" onClick={() => removePhone(p)}>Remove</button></td>
              </tr>
            ))}
            {allowed.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No allowed phones configured</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="pt" style={{ fontSize: 20, marginTop: 24 }}>Recent Login Devices</div>
      <div className="ps" style={{ marginBottom: 12 }}>Approximate device usage captured at login time</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 14 }}>
        {[
          { l: "Desktop", v: Number(auditSummary.desktop || 0), ico: "💻" },
          { l: "Mobile", v: Number(auditSummary.mobile || 0), ico: "📱" },
          { l: "Tablet", v: Number(auditSummary.tablet || 0), ico: "🧾" },
          { l: "Unknown", v: Number(auditSummary.unknown || 0), ico: "❔" },
        ].map((s) => (
          <div key={s.l} className="astat">
            <div style={{ fontSize: 24, marginBottom: 6 }}>{s.ico}</div>
            <div className="astat-v">{s.v}</div>
            <div className="astat-l">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="sh" style={{ marginBottom: 10 }}>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>Latest 100 login events</div>
        <button className="btn btn-secondary btn-sm" onClick={() => void loadAudit()}>Refresh</button>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Device</th>
              <th>Browser</th>
              <th>OS</th>
              <th>Screen</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {auditLoading && <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>Loading login audit...</td></tr>}
            {!auditLoading && auditRows.map((r) => (
              <tr key={r.id}>
                <td>{r.created_at || "-"}</td>
                <td>
                  <div style={{ fontWeight: 700 }}>{r.username || "-"}</div>
                </td>
                <td><span className="tag" style={{ background: "rgba(59,130,246,.12)", color: "#93c5fd", border: "1px solid rgba(147,197,253,.25)" }}>{r.device_type || "unknown"}</span></td>
                <td>{r.browser || "-"}</td>
                <td>{r.os || "-"}</td>
                <td>{r.screen_width && r.screen_height ? `${r.screen_width} × ${r.screen_height}` : "-"}</td>
                <td>{r.ip_address || "-"}</td>
              </tr>
            ))}
            {!auditLoading && auditRows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>No login audit data yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ADMIN: PLAYOFFS PREDICTIONS ─────────────────────────────────────────────
function AdminPlayoffsPredictions({ showToast, adminToken }) {
  const preds = getPlayoffsPredictions();
  const users = load("ifl_users", {});
  const rows = Object.keys(users).map((uname) => ({
    username: uname,
    teamName: users[uname]?.teamName || "",
    picks: (preds[uname] || []).map(String),
  })).sort((a, b) => a.teamName.localeCompare(b.teamName) || a.username.localeCompare(b.username));

  const onExport = async () => {
    try {
      await downloadPlayoffsPredictions(adminToken);
      showToast("Playoffs predictions exported ✓", "success");
    } catch (e) {
      showToast(e?.message || "Failed to export playoffs predictions", "error");
    }
  };

  return (
    <div className="page">
      <div className="sh">
        <div>
          <div className="pt">Playoffs Predictions</div>
          <div className="ps">All user playoff picks in one place</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onExport}>Export Predictions</button>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Team Name</th>
              <th>Username</th>
              <th>Picks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`pp-${r.username}`}>
                <td style={{ color: "var(--muted)", fontSize: 12 }}>{i + 1}</td>
                <td style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>{r.teamName || "-"}</td>
                <td>{r.username}</td>
                <td>{r.picks.length ? r.picks.join(", ") : <span style={{ color: "var(--muted)" }}>No picks</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                  No users available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ADMIN: SWAP VALIDATION ───────────────────────────────────────────────────
function AdminSwapValidation({ showToast, adminToken }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [exporting, setExporting] = useState(false);
  const players = getPlayers();
  const matches = getMatches();
  const users = load("ifl_users", {});
  const playerById = new Map(players.map((p) => [Number(p.id), p]));
  const matchById = new Map(matches.map((m) => [Number(m.id), m]));

  const loadSwaps = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await fetchAdminSwaps(adminToken);
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e) {
      setErr(e?.message || "Failed to load swaps");
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    void loadSwaps();
  }, [loadSwaps]);

  const grouped = rows.reduce((acc, r) => {
    const key = `${r.username || "?"}::${r.window?.id || r.window_id || "?"}`;
    if (!acc[key]) acc[key] = { username: r.username || "", window: r.window || {}, swaps: [] };
    acc[key].swaps.push(r);
    return acc;
  }, {});

  const groups = Object.values(grouped);

  const validateGroup = async (g) => {
    try {
      await adminValidateSwaps(adminToken, g.username, g.window?.id);
      showToast(`Validated swaps for ${g.username}`, "success");
      await loadSwaps();
    } catch (e) {
      showToast(e?.message || "Failed to validate swaps", "error");
    }
  };

  const rejectGroup = async (g) => {
    try {
      await adminRejectSwaps(adminToken, g.username, g.window?.id);
      showToast(`Rejected swaps for ${g.username}`, "success");
      await loadSwaps();
    } catch (e) {
      showToast(e?.message || "Failed to reject swaps", "error");
    }
  };

  const exportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await openSwapValidationPdfExport(rows, users, players, matches);
    } catch (e) {
      showToast(e?.message || "Failed to open swap validation PDF", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page">
      <div className="sh">
        <div>
          <div className="pt">Swap Validation</div>
          <div className="ps">Review and validate user swaps per window</div>
        </div>
        <button className="btn btn-secondary" onClick={exportPdf} disabled={exporting}>
          {exporting ? "Preparing PDF..." : "Export PDF"}
        </button>
      </div>
      {loading && <div style={{ color: "var(--muted)" }}>Loading swaps...</div>}
      {err && <div style={{ color: "var(--err)" }}>{err}</div>}
      {!loading && groups.length === 0 && <div style={{ color: "var(--muted)" }}>No swaps submitted yet</div>}
      {!loading && groups.map((g) => {
        const allValidated = g.swaps.every((s) => Number(s.is_validated) === 1);
        const displayName = users[g.username]?.teamName || g.username || "Unknown User";
        return (
          <div key={`${g.username}-${g.window?.id || "x"}`} className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 700 }}>{displayName}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {g.window?.name || `Window ${g.window?.id || "-"}`} · {g.window?.start_at || "-"} → {g.window?.lock_at || "-"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="tag" style={{ background: allValidated ? "rgba(16,185,129,.15)" : "rgba(249,115,22,.12)", color: allValidated ? "var(--ok)" : "var(--acc)" }}>
                  {allValidated ? "Validated" : "Pending"}
                </span>
                {!allValidated && <button className="btn btn-secondary btn-sm" onClick={() => validateGroup(g)}>Approve</button>}
                <button className="btn btn-danger btn-sm" onClick={() => rejectGroup(g)}>Reject</button>
              </div>
            </div>
            <div className="tw" style={{ marginTop: 12 }}>
              <table>
                <thead><tr><th>Out</th><th>In</th><th>Match</th><th>Status</th></tr></thead>
                <tbody>
                  {g.swaps.map((s) => {
                    const outP = playerById.get(Number(s.out_player_id));
                    const inP = playerById.get(Number(s.in_player_id));
                    const m = matchById.get(Number(s.window?.effective_match_id || 0));
                    return (
                      <tr key={`swap-${s.id}`}>
                        <td>{outP ? `${outP.name} (${outP.team}, ${outP.role})` : `#${s.out_player_id}`}</td>
                        <td>{inP ? `${inP.name} (${inP.team}, ${inP.role})` : `#${s.in_player_id}`}</td>
                        <td>{m ? `Match ${m.id} · ${m.teamAabbr} vs ${m.teamBabbr}` : "Match N/A"}</td>
                        <td style={{ color: Number(s.is_validated) === 1 ? "var(--ok)" : "var(--muted)" }}>
                          {Number(s.is_validated) === 1 ? "Validated" : "Pending"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── USER PAGES ───────────────────────────────────────────────────────────────
function BuildTeam({ user, onUpdate, showToast }) {
  const players = getPlayers();
  const [flt, setFlt] = useState({ role: ROLE_FILTER_ANY, team: "ALL", search: "" });
  const sel = user.players || [];
  const MAX = 20, MF = 8;
  const MIN_BOWLERS = 6;
  const isFrozen = !!user.squadFrozen;
  const isSubmitted = !!user.squadSubmitted;
  const isValidated = !!user.squadValidated;
  const fc = sel.filter(id => { const p = players.find(x => x.id === id); return p && p.country !== "India"; }).length;
  const bowlers = sel.filter(id => players.find(x => x.id === id)?.role === "BOWL").length;
  const validCount = sel.length === MAX;
  const validOverseas = fc <= MF;
  const validBowlers = bowlers >= MIN_BOWLERS;
  const allValid = validCount && validOverseas && validBowlers;

  const toggle = id => {
    if (isFrozen) { showToast("Team is frozen by admin. Ask admin to unfreeze.", "error"); return; }
    if (sel.includes(id)) {
      const submittedMap = { ...(user.playerSubmittedAt || {}) };
      delete submittedMap[id];
      onUpdate({ players: sel.filter(x => x !== id), playerSubmittedAt: submittedMap });
      return;
    }
    if (sel.length >= MAX) { showToast(`Max ${MAX} players`, "error"); return; }
    const p = players.find(x => x.id === id);
    if (p?.country !== "India" && fc >= MF) { showToast("Max 8 overseas players", "error"); return; }
    const submittedMap = { ...(user.playerSubmittedAt || {}) };
    submittedMap[id] = submittedMap[id] || nowLocalMatchTs();
    onUpdate({ players: [...sel, id], playerSubmittedAt: submittedMap });
  };

  const submitTeam = () => {
    if (isFrozen) { showToast("Team is frozen by admin.", "error"); return; }
    if (sel.length !== MAX) { showToast(`Select exactly ${MAX} players before submitting`, "error"); return; }
    if (bowlers < MIN_BOWLERS) {
      const need = MIN_BOWLERS - bowlers;
      showToast(`Minimum ${MIN_BOWLERS} bowlers required. You have ${bowlers}. Add ${need} more to submit.`, "error");
      return;
    }
    const ts = nowLocalMatchTs();
    const submittedMap = { ...(user.playerSubmittedAt || {}) };
    sel.forEach((pid) => { submittedMap[pid] = submittedMap[pid] || ts; });
    onUpdate({ squadSubmitted: true, playerSubmittedAt: submittedMap });
    showToast("Team submitted for admin validation", "success");
  };

  const filtered = players.filter(p =>
    (flt.role === ROLE_FILTER_ANY || p.role === flt.role) &&
    (flt.team === "ALL" || p.team === flt.team) &&
    (!flt.search || p.name.toLowerCase().includes(flt.search.toLowerCase()))
  );
  const teams = [...new Set(players.map(p => p.team))].sort();

  return (
    <div className="page">
      <div className="sh">
        <div><div className="pt">Build Your Squad</div><div className="ps">Select up to {MAX} players · Max 8 overseas · Min {MIN_BOWLERS} bowlers to submit</div></div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 28, fontWeight: 700, color: sel.length >= MAX ? "var(--ok)" : "var(--acc)" }}>
            {sel.length}<span style={{ fontSize: 14, color: "var(--muted)" }}>/{MAX}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{fc}/{MF} overseas · {bowlers}/{MIN_BOWLERS} bowlers</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <span className="tag" style={{ background: isFrozen ? "rgba(239,68,68,.15)" : isValidated ? "rgba(16,185,129,.15)" : isSubmitted ? "rgba(59,130,246,.15)" : "rgba(100,116,139,.15)", color: isFrozen ? "var(--err)" : isValidated ? "var(--ok)" : isSubmitted ? "var(--acc2)" : "var(--muted)" }}>
          {isFrozen ? "Frozen by Admin" : isValidated ? "Validated by Admin" : isSubmitted ? "Submitted" : "Draft"}
        </span>
        <button className="btn btn-primary btn-sm" onClick={submitTeam} disabled={isFrozen || sel.length !== MAX || bowlers < MIN_BOWLERS}>
          Submit Team
        </button>
      </div>
      <div className="card" style={{ marginBottom: 16, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 16, fontWeight: 700 }}>Squad Self-Check</div>
          <span className="tag" style={{ background: allValid ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)", color: allValid ? "var(--ok)" : "var(--err)" }}>
            {allValid ? "Ready" : "Fix Issues"}
          </span>
        </div>
        <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
          <div style={{ color: validCount ? "var(--ok)" : "var(--err)" }}>
            {validCount ? "✓" : "✕"} Exactly 20 players selected ({sel.length}/20)
          </div>
          <div style={{ color: validOverseas ? "var(--ok)" : "var(--err)" }}>
            {validOverseas ? "✓" : "✕"} Max 8 overseas players ({fc}/8)
          </div>
          <div style={{ color: validBowlers ? "var(--ok)" : "var(--err)" }}>
            {validBowlers ? "✓" : "✕"} Minimum 6 bowlers ({bowlers}/6)
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}><div className="pbar"><div className="pfill" style={{ width: `${(sel.length / MAX) * 100}%` }} /></div></div>
      <div className="pfilters">
        <input placeholder="Search player..." style={{ width: 200 }} value={flt.search} onChange={e => setFlt(f => ({ ...f, search: e.target.value }))} />
        {[[ROLE_FILTER_ANY, "All"], ["WK", "WK"], ["BAT", "BAT"], ["ALL", "ALL"], ["BOWL", "BOWL"]].map(([rk, l]) => (
          <button key={rk} className={`fbtn ${flt.role === rk ? "active" : ""}`} onClick={() => setFlt(f => ({ ...f, role: rk }))}>{l}</button>
        ))}
        <select style={{ width: 120 }} value={flt.team} onChange={e => setFlt(f => ({ ...f, team: e.target.value }))}>
          <option value="ALL">All Teams</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="pgrid">
        {filtered.map(p => {
          const isSel = sel.includes(p.id);
          const tc = IPL_TEAM_COLORS[p.team] || { bg: "#334", text: "#fff" };
          const rc = ROLE_COLORS[p.role];
          return (
            <div key={p.id} className={`pc ${isSel ? "sel" : ""}`} style={{ cursor: isFrozen ? "not-allowed" : "pointer", opacity: isFrozen ? 0.75 : 1 }} onClick={() => toggle(p.id)}>
              <div className="pteam" style={{ color: tc.bg }}>{p.team}</div>
              <div className="pname">{p.name}</div>
              <div className="pmeta">
                <span className="tag" style={{ background: rc + "22", color: rc }}>{p.role}</span>
                {p.country !== "India" && <span className="tag" style={{ background: "rgba(99,102,241,.15)", color: "#818cf8" }}>🌍 {p.country}</span>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ gridColumn: "1/-1", color: "var(--muted)", textAlign: "center", padding: 40 }}>No players match filters</div>}
      </div>
    </div>
  );
}

function MyTeam({ user, onUpdate, showToast }) {
  const [flippedCards, setFlippedCards] = useState({});
  const players = getPlayers();
  const matches = getMatches();
  const matchStats = getMatchStats();
  const allUsers = load("ifl_users", {});
  const swapWindows = getSwapWindows();
  const resolveSwapRows = (u) => {
    const rows = [];
    if (u?.swapWindows && typeof u.swapWindows === "object") {
      Object.entries(u.swapWindows).forEach(([wid, val]) => {
        const w = swapWindows.find((sw) => String(sw.id) === String(wid));
        const eff = Number(w?.effective_match_id || 0);
        const out = (val?.out || []).map(Number);
        const ins = (val?.in || []).map(Number);
        if (eff > 0 && out.length && ins.length) rows.push({ eff, out, ins });
      });
    } else if ((u?.swap1Out || []).length || (u?.swap1In || []).length) {
      const eff = Number(swapWindows[0]?.effective_match_id || 0);
      rows.push({ eff, out: (u.swap1Out || []).map(Number), ins: (u.swap1In || []).map(Number) });
    }
    return rows.sort((a, b) => a.eff - b.eff);
  };
  const effectiveSquadForMatch = (baseIds, swapRows, matchId) => {
    const set = new Set(baseIds);
    swapRows.forEach((row) => {
      if (matchId >= row.eff) {
        row.out.forEach((pid) => set.delete(pid));
        row.ins.forEach((pid) => set.add(pid));
      }
    });
    return set;
  };
  const nowTs = nowLocalMatchTs();
  const latestMatch = matches
    .filter((m) => normalizeMatchDateTime(m.date) <= nowTs)
    .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)))
    .at(-1);
  const latestMatchId = latestMatch ? Number(latestMatch.id) : 0;
  const baseIds = (user.players || []).map(Number);
  const swapRows = resolveSwapRows(user);
  const currentIds = effectiveSquadForMatch(baseIds, swapRows, latestMatchId);
  const sel = [...currentIds].map(id => players.find(p => p.id === id)).filter(Boolean);
  const isFrozen = !!user.squadFrozen;
  const nextMatch = matches
    .filter(m => normalizeMatchDateTime(m.date) > nowTs)
    .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)))[0];
  const myMatchPlayers = nextMatch
    ? sel.filter(p => p.team === nextMatch.teamAabbr || p.team === nextMatch.teamBabbr)
    : [];
  const rem = id => {
    if (isFrozen) { showToast("Team is frozen by admin", "error"); return; }
    onUpdate({ players: (user.players || []).filter(x => x !== id) });
    showToast("Player removed", "info");
  };

  if (sel.length === 0) return <div className="page"><div className="pt">My Team — {user.teamName}</div><div className="empty"><div className="ico">🏏</div><p>No players selected</p><small>Head to Build Team</small></div></div>;

  const byRole = { WK: [], BAT: [], ALL: [], BOWL: [] };
  sel.forEach(p => { if (byRole[p.role]) byRole[p.role].push(p); });
  const breakdown = matches.map(m => {
    const ms = matchStats[String(m.id)] || {};
    const pstats = ms.players || {};
    const hasScoringData = Object.keys(pstats).length > 0 || !!ms.motmPlayerId;
    const effectiveIds = effectiveSquadForMatch(baseIds, swapRows, Number(m.id));
    const entries = Object.entries(pstats)
      .filter(([pid]) => effectiveIds.has(Number(pid)))
      .map(([pid, stat]) => ({ player: players.find(p => p.id === Number(pid)), pts: scorePlayerPerformance(stat), stat }))
      .filter((row) => row.player)
      .sort((a, b) => b.pts - a.pts);
    const playerPts = entries.reduce((s, x) => s + x.pts, 0);
    const motmPts = ms.motmPlayerId && effectiveIds.has(Number(ms.motmPlayerId)) ? POINT_RULES.MAN_OF_MATCH : 0;
    return { match: m, entries, total: playerPts + motmPts, motmPts, hasScoringData };
  }).filter(x => x.hasScoringData);

  const playerTotals = new Map(sel.map((p) => [String(p.id), 0]));
  const playerAgg = new Map(sel.map((p) => [String(p.id), { runs: 0, wickets: 0, catches: 0, recentPts: 0, matches: 0 }]));
  breakdown.forEach((row) => {
    row.entries.forEach((entry) => {
      const pid = String(entry.player.id);
      const pts = Number(entry.pts || 0);
      playerTotals.set(pid, (playerTotals.get(pid) || 0) + pts);
      const agg = playerAgg.get(pid) || { runs: 0, wickets: 0, catches: 0, recentPts: 0, matches: 0 };
      agg.runs += Number(entry.stat?.runs || 0);
      agg.wickets += Number(entry.stat?.wickets || 0);
      agg.catches += Number(entry.stat?.catches || 0);
      agg.matches += 1;
      playerAgg.set(pid, agg);
    });
    const ms = matchStats[String(row.match.id)] || {};
    const motmPid = String(ms.motmPlayerId || "");
    if (row.motmPts > 0 && motmPid && playerTotals.has(motmPid)) {
      playerTotals.set(motmPid, (playerTotals.get(motmPid) || 0) + POINT_RULES.MAN_OF_MATCH);
    }
  });
  breakdown.slice(-3).forEach((row) => {
    row.entries.forEach((entry) => {
      const pid = String(entry.player.id);
      const agg = playerAgg.get(pid) || { runs: 0, wickets: 0, catches: 0, recentPts: 0, matches: 0 };
      agg.recentPts += Number(entry.pts || 0);
      playerAgg.set(pid, agg);
    });
    const ms = matchStats[String(row.match.id)] || {};
    const motmPid = String(ms.motmPlayerId || "");
    if (row.motmPts > 0 && motmPid && playerAgg.has(motmPid)) {
      const agg = playerAgg.get(motmPid);
      agg.recentPts += POINT_RULES.MAN_OF_MATCH;
      playerAgg.set(motmPid, agg);
    }
  });

  const teamCount = Math.max(1, Object.keys(allUsers || {}).length);
  const frozenSwapPoints = Array.isArray(user.swap1FrozenPoints) ? user.swap1FrozenPoints : [];
  const pickCounts = new Map();
  Object.values(allUsers || {}).forEach((u) => {
    (u.players || []).forEach((pid) => {
      const id = String(pid);
      pickCounts.set(id, (pickCounts.get(id) || 0) + 1);
    });
  });

  const starsForPlayer = (pid) => {
    const picked = pickCounts.get(String(pid)) || 0;
    const denom = Math.max(1, teamCount - picked);
    const raw = teamCount / denom;
    const stars = Math.max(1, Math.min(5, Math.round(raw)));
    return { stars, picked };
  };
  const archetypeForPlayer = (p) => {
    const pid = String(p.id);
    const totalPts = Number(playerTotals.get(pid) || 0);
    const agg = playerAgg.get(pid) || { runs: 0, wickets: 0, catches: 0, recentPts: 0, matches: 0 };
    const picked = Number(pickCounts.get(pid) || 0);
    const ownershipRate = picked / teamCount;
    if (p.role === "BAT" && Number(agg.runs || 0) >= 150) return { label: "Run Machine", avatar: "🏏", tier: "hot" };
    if (p.role === "BOWL" && Number(agg.wickets || 0) >= 6) return { label: "Wicket Hunter", avatar: "🎯", tier: "hot" };
    if (Number(agg.recentPts || 0) >= 90) return { label: "Clutch Finisher", avatar: "⚡", tier: "hot" };
    if (p.role === "ALL" && totalPts >= 150) return { label: "Balance Broker", avatar: "⚖️", tier: "diff" };
    if (p.role === "BOWL" && totalPts >= 100) return { label: "Powerplay Striker", avatar: "🔥", tier: "diff" };
    if (ownershipRate >= 0.55 && totalPts >= 120) return { label: "Safe Pick", avatar: "🛡️", tier: "diff" };
    if (ownershipRate <= 0.12 && totalPts >= 80) return { label: "Dark Horse", avatar: "🐎", tier: "rare" };
    if (ownershipRate <= 0.25 && Number(agg.recentPts || 0) >= 45) return { label: "Impact Spark", avatar: "✨", tier: "rare" };
    if (p.role === "BOWL" && ownershipRate <= 0.35) return { label: "Mystery Maker", avatar: "🎭", tier: "rare" };
    if (p.role === "ALL") return { label: "Chaos Pick", avatar: "💥", tier: "diff" };
    return { label: "Safe Pick", avatar: "🛡️", tier: ownershipRate >= 0.45 ? "diff" : "rare" };
  };
  const toggleFlipCard = (pid) => {
    const nextFlipped = !flippedCards[pid];
    setFlippedCards((prev) => ({ ...prev, [pid]: nextFlipped }));
    if (nextFlipped && typeof window !== "undefined" && window.matchMedia?.("(hover: none)").matches) {
      window.setTimeout(() => {
        setFlippedCards((prev) => ({ ...prev, [pid]: false }));
      }, 3000);
    }
  };

  return (
    <div className="page">
      <div className="sh"><div><div className="pt">{user.teamName}</div><div className="ps">{sel.length} players selected</div></div></div>
      {Object.entries(byRole).map(([role, ps]) => ps.length > 0 && (
        <div key={role} style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span className="tag" style={{ background: ROLE_COLORS[role] + "22", color: ROLE_COLORS[role], fontSize: 12 }}>{ROLE_LABELS[role]}s</span>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>{ps.length}</span>
          </div>
          <div className="pgrid">
            {ps.map(p => {
              const tc = IPL_TEAM_COLORS[p.team] || { bg: "#334", text: "#fff" };
              const star = starsForPlayer(p.id);
              const archetype = archetypeForPlayer(p);
              return (
                <div key={p.id} className={`pc pc-flip ${flippedCards[p.id] ? "flipped" : ""}`} style={{ cursor: "pointer" }} onClick={() => toggleFlipCard(p.id)}>
                  <div className="pc-inner">
                    <div className="pc-front">
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div />
                        <span style={{ cursor: "pointer", color: "var(--muted)", fontSize: 20, lineHeight: 1 }} onClick={(e) => { e.stopPropagation(); rem(p.id); }}>×</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                        <div className="guest-archetype-wrap">
                          <div className={`guest-pop-avatar guest-pop-${archetype.tier}`}>
                            <span>{archetype.avatar}</span>
                          </div>
                          <div className="guest-archetype-label">{archetype.label}</div>
                        </div>
                      </div>
                      <div className="pname" style={{ textAlign: "center" }}>{p.name}</div>
                      <div style={{ textAlign: "center", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, color: tc.bg, margin: "6px 0 2px" }}>
                        {p.team}
                      </div>
                      <div className="pmeta" style={{ justifyContent: "center" }}>
                        <span className="tag" style={{ background: ROLE_COLORS[p.role] + "22", color: ROLE_COLORS[p.role] }}>{p.role}</span>
                        <span className="tag">{archetype.label}</span>
                        {p.country !== "India" && <span className="tag" style={{ background: "rgba(99,102,241,.15)", color: "#818cf8" }}>🌍</span>}
                      </div>
                      <div className="star-row">
                        {Array.from({ length: star.stars }).map((_, i) => (
                          <span key={`s-${p.id}-${i}`} className="star">*</span>
                        ))}
                      </div>
                    </div>
                    <div className="pc-back">
                      <div className="pname">{p.name}</div>
                      <div className="pc-back-pts">{playerTotals.get(String(p.id)) || 0} pts</div>
                      <div className="pc-back-sub">Accumulated points</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="divider" />
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Swapped Player Freezed Points</div>
        {frozenSwapPoints.length === 0 && <div style={{ color: "var(--muted)" }}>No swapped-out players yet.</div>}
        {frozenSwapPoints.length > 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            {frozenSwapPoints.map((row, idx) => {
              const tc = IPL_TEAM_COLORS[row.team] || { bg: "#334", text: "#fff" };
              const rc = ROLE_COLORS[row.role] || "var(--muted)";
              return (
                <div key={`frozen-${row.playerId}-${row.effectiveMatchId}-${idx}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{row.playerName}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                      {row.team && <span className="tag" style={{ background: `${tc.bg}22`, color: tc.bg }}>{row.team}</span>}
                      {row.role && <span className="tag" style={{ background: `${rc}22`, color: rc }}>{row.role}</span>}
                      <span className="tag" style={{ background: "rgba(100,116,139,.16)", color: "var(--muted)" }}>Frozen before match {row.effectiveMatchId}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 24, fontWeight: 700, color: "var(--acc)" }}>{row.points || 0}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>pts freezed</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Next Upcoming Match</div>
        {!nextMatch && <div style={{ color: "var(--muted)" }}>No upcoming matches scheduled.</div>}
        {nextMatch && (
          <>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
              Match {nextMatch.id}: {nextMatch.teamAabbr} vs {nextMatch.teamBabbr} · {nextMatch.date}
            </div>
            <div className="pgrid">
              {myMatchPlayers.map((p) => {
                const tc = IPL_TEAM_COLORS[p.team] || { bg: "#334", text: "#fff" };
                return (
                  <div key={`nm-${p.id}`} className="pc" style={{ cursor: "default" }}>
                    <div className="pteam" style={{ color: tc.bg }}>{p.team}</div>
                    <div className="pname">{p.name}</div>
                    <div className="pmeta">
                      <span className="tag" style={{ background: ROLE_COLORS[p.role] + "22", color: ROLE_COLORS[p.role] }}>{p.role}</span>
                      {p.country !== "India" && <span className="tag" style={{ background: "rgba(99,102,241,.15)", color: "#818cf8" }}>🌍</span>}
                    </div>
                  </div>
                );
              })}
              {myMatchPlayers.length === 0 && (
                <div style={{ gridColumn: "1/-1", color: "var(--muted)", textAlign: "center", padding: 20 }}>
                  None of your players are in the next match.
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="pt" style={{ fontSize: 20, marginBottom: 12 }}>Match-wise Player Points</div>
      {breakdown.length === 0 && <div style={{ color: "var(--muted)" }}>No match scoring recorded yet.</div>}
      {breakdown.map(row => (
        <div key={row.match.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>Match {row.match.id}: {row.match.teamAabbr} vs {row.match.teamBabbr}</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, color: "var(--acc)" }}>{row.total} pts</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {row.entries.map(e => (
              <span key={`${row.match.id}-${e.player.id}`} className="tag" style={{ background: "rgba(59,130,246,.12)", color: "#93c5fd", fontSize: 11 }}>
                {e.player.name}: {e.pts}
              </span>
            ))}
            {row.motmPts > 0 && <span className="tag" style={{ background: "rgba(16,185,129,.14)", color: "var(--ok)", fontSize: 11 }}>MoM Bonus: +{row.motmPts}</span>}
            {row.entries.length === 0 && row.motmPts === 0 && (
              <span className="tag" style={{ background: "rgba(100,116,139,.16)", color: "var(--muted)", fontSize: 11 }}>
                No player points in this match
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function UserHome({ user, username, onNavigate, lang, userToken }) {
  const users = load("ifl_users", {});
  const matches = getMatches();
  const players = getPlayers();
  const matchStats = getMatchStats();
  const swapWindows = getSwapWindows();
  const prevRanks = load("ifl_rank_snapshot", {});
  const reactionStorageKey = `ifl_home_reaction_${username || "guest"}`;
  const favoriteStorageKey = `ifl_home_favorite_${username || "guest"}`;
  const rivalStorageKey = `ifl_home_rival_${username || "guest"}`;
  const [selectedReaction, setSelectedReaction] = useState(() => {
    try {
      return window.localStorage.getItem(reactionStorageKey) || "";
    } catch {
      return "";
    }
  });
  const [favoriteTeam, setFavoriteTeam] = useState(() => {
    try {
      return window.localStorage.getItem(favoriteStorageKey) || "MI";
    } catch {
      return "MI";
    }
  });
  const [rivalTeam, setRivalTeam] = useState(() => {
    try {
      const stored = window.localStorage.getItem(rivalStorageKey) || "GT";
      return stored === (window.localStorage.getItem(favoriteStorageKey) || "MI") ? "GT" : stored;
    } catch {
      return "GT";
    }
  });
  const [reactionBursts, setReactionBursts] = useState([]);
  const reactionOptions = [
    { id: "winning", emoji: "😎", text: lang === "hi" ? "आज तो मैं छा रहा हूँ" : "Today I own the board" },
    { id: "pressure", emoji: "😬", text: lang === "hi" ? "आज नसें टाइट हैं" : "Pressure is real today" },
    { id: "wonderful", emoji: "🤩", text: lang === "hi" ? "आज vibes ही अलग हैं" : "What a glorious matchday" },
    { id: "favorite", emoji: "🫶", text: lang === "hi" ? `${favoriteTeam} आज बाज़ी मारो` : `${favoriteTeam} own the night` },
    { id: "rival", emoji: "⚔️", text: lang === "hi" ? `${rivalTeam} को रोक दो` : `Stop ${rivalTeam} tonight` },
  ];
  const playerById = new Map(players.map((p) => [Number(p.id), p]));
  useEffect(() => {
    try {
      if (selectedReaction) window.localStorage.setItem(reactionStorageKey, selectedReaction);
      else window.localStorage.removeItem(reactionStorageKey);
    } catch {}
  }, [reactionStorageKey, selectedReaction]);
  useEffect(() => {
    try {
      window.localStorage.setItem(favoriteStorageKey, favoriteTeam);
    } catch {}
  }, [favoriteStorageKey, favoriteTeam]);
  useEffect(() => {
    try {
      window.localStorage.setItem(rivalStorageKey, rivalTeam);
    } catch {}
  }, [rivalStorageKey, rivalTeam]);
  useEffect(() => {
    if (!reactionBursts.length) return undefined;
    const timers = reactionBursts.map((burst) => setTimeout(() => {
      setReactionBursts((prev) => prev.filter((x) => x.id !== burst.id));
    }, 1050));
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [reactionBursts]);
  const predictionAccuracyForUser = (u) => {
    let correct = 0;
    let settled = 0;
    Object.entries(u?.predictions || {}).forEach(([mid, pred]) => {
      const match = matches.find((m) => String(m.id) === String(mid));
      if (!match?.winner || match.winner === "NR") return;
      if (pred?.correct === true || pred?.correct === false) {
        settled += 1;
        if (pred.correct === true) correct += 1;
      }
    });
    return settled > 0 ? correct / settled : 0;
  };
  const leaderboardTagForUser = (u, rank, delta) => {
    const squad = (u?.players || []).map((pid) => playerById.get(Number(pid))).filter(Boolean);
    const bowlers = squad.filter((p) => p.role === "BOWL").length;
    const allRounders = squad.filter((p) => p.role === "ALL").length;
    const intl = squad.filter((p) => p.country !== "India").length;
    const acc = predictionAccuracyForUser(u);
    const last = Number(u?.lastEarned || 0);
    if (rank === 1) return "👑 Crown Defender";
    if (Number(delta) >= 2) return "🚀 Rocket Climber";
    if (Number(delta) <= -2) return "🛟 Damage Control";
    if (last >= 250) return "🔥 Hot Hand";
    if (acc >= 0.65) return "🎯 Prediction Sniper";
    if (bowlers >= 7) return "⚡ Wicket Hunter";
    if (allRounders >= 5) return "💥 Chaos Engineer";
    if (intl >= 6) return "🌍 Overseas Armada";
    if (squad.length > 0 && intl <= 2) return "🇮🇳 Swadeshi Scout";
    if (rank <= 4) return "🏁 Title Chaser";
    if (rank >= 15) return "🐎 Dark Horse";
    return "😈 Mid-table Menace";
  };
  const rows = Object.entries(users)
    .map(([un, u]) => ({ un, teamName: u.teamName || un, teamLogo: u.teamLogo || "", points: Number(u.points || 0), lastEarned: Number(u.lastEarned || 0), rawUser: u }))
    .sort((a, b) => b.points - a.points)
    .map((r, idx) => {
      const prev = Object.prototype.hasOwnProperty.call(prevRanks, r.un) ? Number(prevRanks[r.un]) : null;
      const delta = prev ? prev - (idx + 1) : 0;
      return { ...r, tag: leaderboardTagForUser(r.rawUser, idx + 1, delta) };
    });
  const myRank = Math.max(1, rows.findIndex(r => r.un === username) + 1);
  const myRow = rows.find((r) => r.un === username) || null;
  const myDelta = myRow ? (() => {
    const prev = Object.prototype.hasOwnProperty.call(prevRanks, myRow.un) ? Number(prevRanks[myRow.un]) : null;
    return prev ? prev - myRank : 0;
  })() : 0;
  const completedMatches = matches.filter(m => m.winner || matchStats[String(m.id)]).length;
  const nextMatch = [...matches]
    .filter(m => !m.winner)
    .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)))[0]
    || matches[matches.length - 1]
    || {};
  const nextMatchText = nextMatch?.teamAabbr && nextMatch?.teamBabbr
    ? `${nextMatch.teamAabbr} vs ${nextMatch.teamBabbr} · Match ${nextMatch.id || "-"}`
    : nextMatch?.teamA && nextMatch?.teamB
      ? `${nextMatch.teamA} vs ${nextMatch.teamB} · Match ${nextMatch.id || "-"}`
      : translateText(lang, "next_match_loading", "Next match loading");
  const correctPicks = Object.values(user.predictions || {}).filter(p => p?.correct === true).length;
  const predictedCount = Object.keys(user.predictions || {}).length;
  const topUser = rows[0];
  const gapToTop = topUser && topUser.un !== username ? Math.max(0, Number(topUser.points || 0) - Number(user.points || 0)) : 0;
  const homeEmotion = (() => {
    let score = 52;
    if (myRank <= 3) score += 18;
    else if (myRank <= 8) score += 8;
    else if (myRank >= 15) score -= 10;
    if (myDelta >= 3) score += 18;
    else if (myDelta >= 1) score += 10;
    else if (myDelta <= -3) score -= 18;
    else if (myDelta <= -1) score -= 10;
    const recentEarned = Number(user.lastEarned || 0);
    if (recentEarned >= 300) score += 12;
    else if (recentEarned >= 180) score += 6;
    if (gapToTop === 0) score += 6;
    else if (gapToTop >= 350) score -= 8;
    else if (gapToTop <= 120) score += 5;
    score = Math.max(8, Math.min(96, score));
    const stages = [
      { min: 0, emoji: "😬", label: lang === "hi" ? "दबाव" : "Pressure", note: lang === "hi" ? "थोड़ा सा झटका लगा है. आज steady points बहुत काम आएंगे।" : "The pressure is on. A steady matchday haul will help settle things." },
      { min: 25, emoji: "🙂", label: lang === "hi" ? "संभला हुआ" : "Steady", note: lang === "hi" ? "टीम ठीक स्थिति में है, लेकिन momentum बनाने की जगह अभी भी है।" : "Your team is in decent shape, but there is still room to build momentum." },
      { min: 45, emoji: "😄", label: lang === "hi" ? "रफ़्तार में" : "In Rhythm", note: lang === "hi" ? "आपकी टीम का pulse अच्छा है. सही active players आपको ऊपर खींच सकते हैं।" : "Your squad pulse looks healthy. The right active players can pull you upward." },
      { min: 70, emoji: "😎", label: lang === "hi" ? "कंट्रोल में" : "In Control", note: lang === "hi" ? "आप flow में हैं. अब बढ़त को बनाए रखने या gap बंद करने का समय है।" : "You are in a good groove. Now it is about protecting the edge or closing the gap." },
      { min: 88, emoji: "👑", label: lang === "hi" ? "हावी" : "Dominant", note: lang === "hi" ? "यह champion-level pulse है. दबाव दूसरे camp में जा रहा है।" : "This is a champion-level pulse. The pressure is shifting to everyone else." },
    ];
    const current = [...stages].reverse().find((s) => score >= s.min) || stages[0];
    return { score, ...current };
  })();
  const selectedReactionOption = reactionOptions.find((r) => r.id === selectedReaction) || null;
  const lockedRatioMatches = getLockedPredictionRatioMatches(matches);
  const latestRatioText = (() => {
    if (lockedRatioMatches.length === 0) return lang === "hi" ? "मैच लॉक होने के बाद prediction ratio दिखेगा।" : "Prediction ratio appears after match lock.";
    return lockedRatioMatches.map((lockedMatch) => {
      let teamA = 0;
      let teamB = 0;
      Object.values(users).forEach((u) => {
        const pick = u?.predictions?.[String(lockedMatch.id)]?.pick || "";
        if (pick === lockedMatch.teamAabbr) teamA += 1;
        else if (pick === lockedMatch.teamBabbr) teamB += 1;
      });
      return `Match ${lockedMatch.id}: ${lockedMatch.teamAabbr} : ${lockedMatch.teamBabbr} ${teamA} : ${teamB}`;
    }).join(" · ");
  })();
  const nowTs = nowLocalMatchTs();
  const upcomingEventText = "Next Swap Window Opens 26th April 2026";
  const selectedPlayerIds = new Set();
  let totalPlayerSelections = 0;
  Object.values(users).forEach((u) => {
    (u?.players || []).forEach((pid) => {
      selectedPlayerIds.add(Number(pid));
      totalPlayerSelections += 1;
    });
  });
  const selectedPoolText = `${selectedPlayerIds.size} unique players selected across ${totalPlayerSelections} total squad slots.`;
  const homeLeaderboardRows = rows.slice(0, Math.min(rows.length, 20));
  const shouldAutoScrollLeaderboard = homeLeaderboardRows.length > 5;
  const renderedLeaderboardRows = shouldAutoScrollLeaderboard ? [...homeLeaderboardRows, ...homeLeaderboardRows] : homeLeaderboardRows;
  const predictionRatioCards = lockedRatioMatches.map((ratioMatch) => {
    let teamA = 0;
    let teamB = 0;
    let pending = 0;
    Object.values(users).forEach((u) => {
      const pick = u?.predictions?.[String(ratioMatch.id)]?.pick || "";
      if (pick === ratioMatch.teamAabbr) teamA += 1;
      else if (pick === ratioMatch.teamBabbr) teamB += 1;
      else pending += 1;
    });
    const total = Math.max(1, teamA + teamB + pending);
    return {
      match: ratioMatch,
      rows: [
        { label: ratioMatch.teamAabbr, value: teamA, pct: Math.round((teamA / total) * 100) },
        { label: ratioMatch.teamBabbr, value: teamB, pct: Math.round((teamB / total) * 100) },
        { label: "Pending", value: pending, pct: Math.round((pending / total) * 100) },
      ],
    };
  });

  return (
    <div className="uhome-site">
      <section className="uhome-hero">
        <div className="uhome-badge"><span></span>{translateText(lang, "season_active", "Season Active")}</div>
        <h1 className="uhome-title">IPL <em>Fantasy</em><br />League</h1>
        <div className="uhome-year">IFL · 2026 · Edition</div>
        <p className="uhome-desc">{lang === "hi" ? `${user.teamName || "आपकी टीम"}, आपका डैशबोर्ड लाइव है। समझदारी से prediction करें, अपनी squad संभालें, और leaderboard की दौड़ पर नज़र रखें।` : `${user.teamName || "Your team"}, your dashboard is live. Predict smart, manage your squad, and watch the leaderboard pressure build.`}</p>
        <div className="uhome-actions">
          <button className="uhome-btn primary" onClick={() => onNavigate("myteam")}>{translateText(lang, "my_team", "My Team")}</button>
          <button className="uhome-btn" onClick={() => onNavigate("predict")}>{translateText(lang, "make_predictions", "Make Predictions")}</button>
          <button className="uhome-btn" onClick={() => onNavigate("feed")}>{translateText(lang, "todays_edge", "Today's Edge")}</button>
          <button className="uhome-btn" onClick={() => onNavigate("atplay")}>Players At Play</button>
          <button className="uhome-btn" onClick={() => onNavigate("profile")}>{translateText(lang, "view_profile", "View Profile")}</button>
        </div>
        <div className="uhome-emotion-meter">
          <div className="uhome-emotion-head">
            <div className="uhome-emotion-k">{lang === "hi" ? "टीम पल्स" : "Team Pulse"}</div>
            <div className="uhome-emotion-badge">{homeEmotion.emoji} {homeEmotion.label}</div>
          </div>
          <div className="uhome-emotion-track" aria-label={lang === "hi" ? "टीम मूड मीटर" : "Team mood meter"}>
            <div className="uhome-emotion-fill" style={{ width: `${homeEmotion.score}%` }} />
            <div className="uhome-emotion-marker" style={{ left: `${homeEmotion.score}%` }}>{homeEmotion.emoji}</div>
          </div>
          <div className="uhome-emotion-scale">
            {[
              { emoji: "😬", label: lang === "hi" ? "दबाव" : "Pressure" },
              { emoji: "🙂", label: lang === "hi" ? "स्थिर" : "Steady" },
              { emoji: "😄", label: lang === "hi" ? "रिदम" : "Rhythm" },
              { emoji: "😎", label: lang === "hi" ? "कंट्रोल" : "Control" },
              { emoji: "👑", label: lang === "hi" ? "हावी" : "Bossing" },
            ].map((stop) => (
              <div key={stop.label} className="uhome-emotion-stop">
                <strong>{stop.emoji}</strong>
                <span>{stop.label}</span>
              </div>
            ))}
          </div>
          <div className="uhome-emotion-copy">
            {homeEmotion.note}{" "}
            {lang === "hi"
              ? <>अभी आप <strong>#{myRank}</strong> पर हैं{myDelta !== 0 ? <> और पिछली snapshot से <strong>{myDelta > 0 ? `+${myDelta}` : myDelta}</strong> की चाल में हैं</> : null}.</>
              : <>You are currently <strong>#{myRank}</strong>{myDelta !== 0 ? <> with a <strong>{myDelta > 0 ? `+${myDelta}` : myDelta}</strong> place swing versus the last snapshot</> : null}.</>}
          </div>
          <div className="uhome-reactions">
          <div className="uhome-reactions-head">
            <div className="uhome-reactions-k">{lang === "hi" ? "आज का मूड" : "Matchday Mood"}</div>
            <div className="uhome-reactions-sub">{lang === "hi" ? "बस टैप करें और vibe सेट करें" : "Tap once and set the vibe"}</div>
          </div>
          <div className="uhome-team-picks">
            <div className="uhome-team-pick">
              <label>{lang === "hi" ? "पसंदीदा टीम" : "Favorite Team"}</label>
              <select
                className="uhome-team-select"
                value={favoriteTeam}
                onChange={(e) => {
                  const next = e.target.value;
                  setFavoriteTeam(next);
                  if (next === rivalTeam) {
                    const fallback = ALL_IPL_TEAMS.find((t) => t.abbr !== next)?.abbr || "GT";
                    setRivalTeam(fallback);
                  }
                }}
              >
                {ALL_IPL_TEAMS.map((team) => (
                  <option key={`fav-${team.abbr}`} value={team.abbr}>{team.abbr} · {team.name}</option>
                ))}
              </select>
            </div>
            <div className="uhome-team-pick">
              <label>{lang === "hi" ? "राइवल टीम" : "Rival Team"}</label>
              <select
                className="uhome-team-select"
                value={rivalTeam}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === favoriteTeam) {
                    showToast(lang === "hi" ? "राइवल टीम, favorite टीम से अलग होनी चाहिए।" : "Rival team should be different from your favorite team.", "info");
                    return;
                  }
                  setRivalTeam(next);
                }}
              >
                {ALL_IPL_TEAMS.filter((team) => team.abbr !== favoriteTeam).map((team) => (
                  <option key={`rival-${team.abbr}`} value={team.abbr}>{team.abbr} · {team.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="uhome-reactions-grid">
              {reactionOptions.map((reaction) => (
                <button
                  key={reaction.id}
                  type="button"
                  className={`uhome-react-btn ${selectedReaction === reaction.id ? "sel" : ""}`}
                  onClick={() => {
                    setSelectedReaction(reaction.id);
                    const burstId = `${reaction.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                    setReactionBursts((prev) => [...prev, { id: burstId, reactionId: reaction.id, text: reaction.text, emoji: reaction.emoji }]);
                    cacheHomeReactionClick(username, {
                      reaction_id: reaction.id,
                      reaction_text: reaction.text,
                      emoji: reaction.emoji,
                      favorite_team: favoriteTeam,
                      rival_team: rivalTeam,
                      clicked_at: new Date().toISOString(),
                    });
                  }}
                >
                  {reactionBursts.filter((burst) => burst.reactionId === reaction.id).map((burst) => (
                    <span key={burst.id} className="uhome-react-fly">
                      {burst.emoji} {burst.text}
                    </span>
                  ))}
                  <span className="uhome-react-emoji">{reaction.emoji}</span>
                  <span className="uhome-react-text">{reaction.text}</span>
                </button>
              ))}
            </div>
            <div className="uhome-react-status">
              {selectedReactionOption
                ? (lang === "hi"
                    ? <>आज का आपका mood set है: <strong>{selectedReactionOption.emoji} {selectedReactionOption.text}</strong></>
                    : <>Your current vibe is set to <strong>{selectedReactionOption.emoji} {selectedReactionOption.text}</strong></>)
                : (lang === "hi"
                    ? <>अपनी matchday feeling चुनें और home page को थोड़ा और personal बनाएं।</>
                    : <>Pick a feeling for the day and give the home page a little personality.</>)}
            </div>
          </div>
        </div>
      </section>

      {topUser && (
        <section className="uhome-section">
          <div className="leader-spotlight">
            <div className="leader-disc" />
            <div className="leader-avatar">
              <TeamLogo logo={topUser.teamLogo || ""} teamName={topUser.teamName} />
            </div>
            <div className="leader-copy">
              <div className="leader-kicker">{translateText(lang, "current_leader", "Current Leader")}</div>
              <div className="leader-name">{topUser.teamName}</div>
            </div>
          </div>
        </section>
      )}

      <div className="uhome-ticker">
        <div className="uhome-ticker-inner">
          <span className="uhome-ticker-item">{nextMatchText} · <strong>{translateText(lang, "next_up", "Next Up")}</strong></span>
          <span className="uhome-ticker-item">{translateText(lang, "your_rank", "Your Rank")} · <strong>#{myRank}</strong></span>
          <span className="uhome-ticker-item">{translateText(lang, "leader", "Leader")} · <strong>{topUser?.teamName || translateText(lang, "leaderboard_opening_soon", "Opening soon")}</strong></span>
          <span className="uhome-ticker-item">{nextMatchText} · <strong>{translateText(lang, "next_up", "Next Up")}</strong></span>
          <span className="uhome-ticker-item">{translateText(lang, "your_rank", "Your Rank")} · <strong>#{myRank}</strong></span>
          <span className="uhome-ticker-item">{translateText(lang, "leader", "Leader")} · <strong>{topUser?.teamName || translateText(lang, "leaderboard_opening_soon", "Opening soon")}</strong></span>
        </div>
      </div>

      {predictionRatioCards.length > 0 && (
        <section className="uhome-section" style={{ paddingTop: 24 }}>
          <div className="uhome-section-head">
            <div>
              <div className="uhome-section-title">{translateText(lang, "prediction_ratio", "Prediction Ratio")}</div>
              <div className="uhome-panel-v">
                {predictionRatioCards.length === 1
                  ? (lang === "hi"
                      ? `मैच ${predictionRatioCards[0].match.id} के लिए लॉक: ${predictionRatioCards[0].match.teamAabbr} vs ${predictionRatioCards[0].match.teamBabbr}`
                      : `Locked for Match ${predictionRatioCards[0].match.id}: ${predictionRatioCards[0].match.teamAabbr} vs ${predictionRatioCards[0].match.teamBabbr}`)
                  : (lang === "hi" ? "आज के सभी locked मैचों के prediction ratio." : "Prediction ratios for all locked matches today.")}
              </div>
            </div>
            <button className="uhome-section-action" onClick={() => onNavigate("predict")}>{translateText(lang, "view_predictions", "View Predictions")}</button>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {predictionRatioCards.map((card) => (
              <div key={`ratio-card-${card.match.id}`} className="uhome-panel">
                <div style={{ fontWeight: 800, marginBottom: 10 }}>
                  Match {card.match.id}: {card.match.teamAabbr} vs {card.match.teamBabbr}
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  {card.rows.map((row) => (
                    <div key={`${card.match.id}-${row.label}`}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {row.label !== "Pending" ? <TeamBadge abbr={row.label} sm /> : <span className="tag">{lang === "hi" ? "Pending" : "Pending"}</span>}
                          <span style={{ fontWeight: 800 }}>{lang === "hi" ? `${row.value} पिक्स` : `${row.value} pick${row.value === 1 ? "" : "s"}`}</span>
                        </div>
                        <div className="profile-stat-value" style={{ fontSize: 20, fontWeight: 800 }}>{row.pct}%</div>
                      </div>
                      <div className="pbar"><div className="pfill" style={{ width: `${row.pct}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="uhome-stats">
        <div className="uhome-stat"><div className="uhome-stat-num">{Number(user.points || 0).toLocaleString()}</div><div className="uhome-stat-label">{translateText(lang, "total_points", "Total Points")}</div></div>
        <div className="uhome-stat"><div className="uhome-stat-num">#{myRank}</div><div className="uhome-stat-label">{translateText(lang, "current_rank", "Current Rank")}</div></div>
        <div className="uhome-stat"><div className="uhome-stat-num">{completedMatches}</div><div className="uhome-stat-label">{translateText(lang, "matches_scored", "Matches Scored")}</div></div>
        <div className="uhome-stat"><div className="uhome-stat-num">{(user.players || []).length}</div><div className="uhome-stat-label">{translateText(lang, "squad_size", "Squad Size")}</div></div>
      </div>

      <section className="uhome-section">
        <div className="uhome-section-head">
          <div className="uhome-section-title">{translateText(lang, "bulletin_board", "Bulletin Board")}</div>
        </div>
        <div className="uhome-grid">
          <div className="uhome-panel">
            <div className="uhome-panel-k">{translateText(lang, "predictions_board", "Predictions")}</div>
            <div className="uhome-panel-v"><strong>{latestRatioText}</strong><br />{translateText(lang, "latest_locked_prediction_ratio", "Latest available locked prediction ratio.")}</div>
          </div>
          <div className="uhome-panel">
            <div className="uhome-panel-k">{translateText(lang, "gap_watch", "Gap Watch")}</div>
            <div className="uhome-panel-v">{gapToTop > 0 ? (lang === "hi" ? <>आप मौजूदा लीडर से <strong>{gapToTop}</strong> पॉइंट पीछे हैं।</> : <>You are <strong>{gapToTop}</strong> points behind the current leader.</>) : (lang === "hi" ? <>आप फिलहाल टॉप पोज़िशन डिफेंड कर रहे हैं।</> : <>You are currently defending the top position.</>)}</div>
          </div>
          <div className="uhome-panel">
            <div className="uhome-panel-k">{translateText(lang, "upcoming_event", "Upcoming Event")}</div>
            <div className="uhome-panel-v"><strong>{upcomingEventText}</strong></div>
          </div>
          <div className="uhome-panel">
            <div className="uhome-panel-k">{translateText(lang, "player_pool", "Player Pool")}</div>
            <div className="uhome-panel-v"><strong>{selectedPoolText}</strong><br />{lang === "hi" ? `मास्टर पूल साइज़: ${players.length}.` : `Master pool size: ${players.length}.`}</div>
          </div>
        </div>
      </section>

      <section className="uhome-section">
        <div className="uhome-section-head">
          <div className="uhome-section-title">{translateText(lang, "rankings", "Rankings")}</div>
          <button className="uhome-section-action" onClick={() => onNavigate("leaderboard")}>{translateText(lang, "leaderboard", "Leaderboard")}</button>
        </div>
        <div className={`uhome-table ${shouldAutoScrollLeaderboard ? "uhome-table-scroll" : ""}`}>
          <div className={shouldAutoScrollLeaderboard ? "uhome-table-track" : ""}>
          {renderedLeaderboardRows.map((r, i) => {
            const rankIndex = i % homeLeaderboardRows.length;
            return (
            <div className="uhome-row" key={`${r.un}-${i}`}>
              <div className={`uhome-rank ${rankIndex === 0 ? "gold" : ""}`}>{rankIndex + 1}</div>
              <div>
                <div className="uhome-team">{r.teamName}</div>
                <div className="uhome-sub">{r.un === username ? `Your team · ${r.tag}` : r.tag}</div>
              </div>
              <div className="uhome-points">{r.points.toLocaleString()}</div>
            </div>
            );
          })}
          </div>
        </div>
      </section>

      <section className="uhome-section">
        <div className="uhome-section-head">
          <div className="uhome-section-title">{translateText(lang, "more_actions", "More Actions")}</div>
        </div>
        <div className="uhome-quick-links">
          <button className="uhome-quick" onClick={() => onNavigate("swap")}>
            <div className="uhome-quick-k">{translateText(lang, "super_swapper", "Super Swapper")}</div>
            <div className="uhome-quick-v">{lang === "hi" ? "स्वैप विंडो के दौरान 1 से 3 खिलाड़ी बदलें।" : "Change 1 to 3 players during swap windows."}</div>
          </button>
          <button className="uhome-quick" onClick={() => onNavigate("playoffs")}>
            <div className="uhome-quick-k">{translateText(lang, "playoffs_prediction", "Playoff Predictions")}</div>
            <div className="uhome-quick-v">{lang === "hi" ? "अपनी टॉप चार पिक्स देखें या अपडेट करें।" : "Review or update your top four picks."}</div>
          </button>
          <button className="uhome-quick" onClick={() => onNavigate("squads")}>
            <div className="uhome-quick-k">{translateText(lang, "frozen_squads", "Frozen Squads")}</div>
            <div className="uhome-quick-v">{lang === "hi" ? "लीग व्यू के लिए उपलब्ध दूसरी frozen squads देखें।" : "View other frozen squads available for league viewing."}</div>
          </button>
          <button className="uhome-quick" onClick={() => onNavigate("rules")}>
            <div className="uhome-quick-k">{translateText(lang, "rules", "Rules")}</div>
            <div className="uhome-quick-v">Check scoring, squads, prediction and swap rules.</div>
          </button>
          <button className="uhome-quick" onClick={() => onNavigate("manual")}>
            <div className="uhome-quick-k">User Manual</div>
            <div className="uhome-quick-v">Step-by-step guide for using IFL.</div>
          </button>
        </div>
      </section>
    </div>
  );
}

function SuperSwapper({ user, username, userToken, onUpdate, showToast }) {
  const players = getPlayers();
  const windows = getSwapWindows();
  const matches = getMatches();
  const matchStats = getMatchStats();
  const [poolFlt, setPoolFlt] = useState({ search: "", team: "ALL", role: ROLE_FILTER_ANY, intl: "ALL" });
  const [poolSort, setPoolSort] = useState("pts_desc");
  const [outIds, setOutIds] = useState([]);
  const [inIds, setInIds] = useState([]);
  const [windowId, setWindowId] = useState(() => {
    const nowTs = nowLocalMatchTs();
    const active = windows.find((w) => w?.start_at && w?.lock_at && w.start_at <= nowTs && nowTs < w.lock_at);
    return active?.id || windows[0]?.id || "";
  });

  const nowTs = nowLocalMatchTs();
  const currentWindow = windows.find((w) => String(w?.id) === String(windowId));
  const isWindowOneSelected = Number(currentWindow?.id || windowId) === 1 || String(currentWindow?.name || "").toLowerCase().includes("window 1");
  const inWindow = !!(currentWindow && currentWindow.start_at && currentWindow.lock_at && currentWindow.start_at <= nowTs && nowTs < currentWindow.lock_at);
  const effectiveMatchId = (() => {
    const configured = Number(currentWindow?.effective_match_id || 0);
    if (configured > 0) return configured;
    const upcoming = matches
      .filter((m) => normalizeMatchDateTime(m.date) >= nowTs)
      .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)))[0];
    if (upcoming) return upcoming.id;
    return matches.length > 0 ? matches[matches.length - 1].id : 0;
  })();
  const allSwapRows = (() => {
    const rows = [];
    if (user?.swapWindows && typeof user.swapWindows === "object") {
      Object.entries(user.swapWindows).forEach(([wid, val]) => {
        const w = windows.find((sw) => String(sw.id) === String(wid));
        const eff = Number(w?.effective_match_id || 0);
        const out = (val?.out || []).map(Number).filter(Boolean);
        const ins = (val?.in || []).map(Number).filter(Boolean);
        if (eff > 0 && out.length && ins.length) rows.push({ windowId: Number(wid), eff, out, ins });
      });
    } else if ((user?.swap1Out || []).length || (user?.swap1In || []).length) {
      const eff = Number(windows[0]?.effective_match_id || 0);
      rows.push({ windowId: Number(windows[0]?.id || 0), eff, out: (user.swap1Out || []).map(Number).filter(Boolean), ins: (user.swap1In || []).map(Number).filter(Boolean) });
    }
    return rows.sort((a, b) => a.eff - b.eff || a.windowId - b.windowId);
  })();
  const priorSwapRows = allSwapRows.filter((row) => {
    const currentId = Number(currentWindow?.id || windowId || 0);
    if (currentId <= 0) return true;
    return row.eff < effectiveMatchId || (row.eff === effectiveMatchId && row.windowId < currentId);
  });
  const buildSquadState = (rows) => {
    const entryById = new Map();
    ((user.players || []).map(Number).filter(Boolean)).forEach((pid) => entryById.set(Number(pid), 0));
    rows.forEach((row) => {
      (row.out || []).forEach((pid) => entryById.delete(Number(pid)));
      (row.in || []).forEach((pid) => entryById.set(Number(pid), Number(row.eff || 0)));
    });
    return entryById;
  };
  const squadEntryById = buildSquadState(priorSwapRows);
  const baseSquadIds = Array.from(
    effectiveMatchId > 0
      ? effectiveSquadIdsForMatch((user.players || []).map(Number), priorSwapRows, effectiveMatchId)
      : ((user.players || []).map(Number))
  );
  baseSquadIds.forEach((pid) => {
    if (!squadEntryById.has(Number(pid))) squadEntryById.set(Number(pid), 0);
  });
  const squadIds = new Set(baseSquadIds.map(Number));
  const squad = players.filter((p) => squadIds.has(Number(p.id)));
  const pool = players.filter((p) => !squadIds.has(Number(p.id)));
  const poolTeams = Array.from(new Set(pool.map((p) => p.team))).sort();
  const computeSquadAccumulatedPoints = (activeSwapRows) => {
    const totals = new Map();
    const elapsed = matches.filter((m) => normalizeMatchDateTime(m.date) <= nowTs);
    elapsed.forEach((m) => {
      const effectiveIds = effectiveSquadIdsForMatch((user.players || []).map(Number), activeSwapRows, Number(m.id));
      const ms = matchStats[String(m.id)] || {};
      const pstats = ms.players || {};
      Object.entries(pstats).forEach(([pid, stat]) => {
        const npid = Number(pid);
        if (!effectiveIds.has(npid)) return;
        const prev = totals.get(npid) || 0;
        totals.set(npid, prev + scorePlayerPerformance(stat));
      });
      const motmPid = Number(ms.motmPlayerId || 0);
      if (motmPid > 0 && effectiveIds.has(motmPid)) {
        totals.set(motmPid, (totals.get(motmPid) || 0) + POINT_RULES.MAN_OF_MATCH);
      }
    });
    return totals;
  };
  const poolFiltered = pool.filter((p) => {
    if (poolFlt.team !== "ALL" && p.team !== poolFlt.team) return false;
    if (poolFlt.role !== ROLE_FILTER_ANY && p.role !== poolFlt.role) return false;
    if (poolFlt.intl === "INTL" && p.country === "India") return false;
    if (poolFlt.intl === "IND" && p.country !== "India") return false;
    if (poolFlt.search && !p.name.toLowerCase().includes(poolFlt.search.toLowerCase())) return false;
    return true;
  });

  const seasonPlayerPoints = (() => {
    const totals = new Map();
    const elapsed = matches.filter((m) => normalizeMatchDateTime(m.date) <= nowTs);
    elapsed.forEach((m) => {
      const ms = matchStats[String(m.id)] || {};
      const pstats = ms.players || {};
      Object.entries(pstats).forEach(([pid, stat]) => {
        const npid = Number(pid);
        const prev = totals.get(npid) || 0;
        totals.set(npid, prev + scorePlayerPerformance(stat) + (Number(ms.motmPlayerId) === npid ? POINT_RULES.MAN_OF_MATCH : 0));
      });
    });
    return totals;
  })();
  const squadDisplayPoints = computeSquadAccumulatedPoints(priorSwapRows);

  const poolSorted = [...poolFiltered].sort((a, b) => {
    if (poolSort === "name_asc") return a.name.localeCompare(b.name);
    if (poolSort === "name_desc") return b.name.localeCompare(a.name);
    const ap = seasonPlayerPoints.get(a.id) || 0;
    const bp = seasonPlayerPoints.get(b.id) || 0;
    if (poolSort === "pts_asc") return ap - bp || a.name.localeCompare(b.name);
    return bp - ap || a.name.localeCompare(b.name);
  });

  useEffect(() => {
    if (windows.length === 0) return;
    if (windowId && windows.some((w) => String(w.id) === String(windowId))) return;
    const active = windows.find((w) => w?.start_at && w?.lock_at && w.start_at <= nowTs && nowTs < w.lock_at);
    setWindowId(active?.id || windows[0]?.id || "");
  }, [windows, windowId, nowTs]);

  const toggleOut = (id) => {
    if (!inWindow) { showToast("Swap window is locked", "error"); return; }
    setOutIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) { showToast("Select only 3 players to swap out", "error"); return prev; }
      return [...prev, id];
    });
  };

  const toggleIn = (id) => {
    if (!inWindow) { showToast("Swap window is locked", "error"); return; }
    setInIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) { showToast("Select only 3 players to swap in", "error"); return prev; }
      return [...prev, id];
    });
  };

  const reset = () => {
    setOutIds([]);
    setInIds([]);
  };

  const resetSwaps = () => {
    if (!currentWindow?.id) { showToast("Select a swap window first", "error"); return; }
    if (isWindowOneSelected) { showToast("Swap Window 1 is read-only now", "info"); return; }
    fetch("/api/user/swaps/reset", {
      method: "POST",
      headers: userAuthHeaders(userToken, { "Content-Type": "application/json" }),
      body: JSON.stringify({ window_id: currentWindow.id }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const msg = await r.text();
          throw new Error(msg || "Failed to reset swaps");
        }
        return r.json();
      })
      .then(() => {
        reset();
        showToast("Swap reset saved", "success");
      })
      .catch((e) => {
        showToast(e?.message || "Failed to reset swaps", "error");
      });
  };

  const applySwap = () => {
    if (isWindowOneSelected) { showToast("Swap Window 1 is read-only now", "info"); return; }
    if (!inWindow) { showToast("Swap window is locked", "error"); return; }
    if (outIds.length < 1 || inIds.length < 1 || outIds.length !== inIds.length) {
      showToast("Select 1 to 3 swap-out and the same number of swap-in players", "error");
      return;
    }
    const pairs = [
      { out_player_id: outIds[0], in_player_id: inIds[0] },
      { out_player_id: outIds[1], in_player_id: inIds[1] },
      { out_player_id: outIds[2], in_player_id: inIds[2] },
    ].filter((p) => p.out_player_id && p.in_player_id);
    fetch("/api/user/swaps", {
      method: "POST",
      headers: userAuthHeaders(userToken, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        window_id: currentWindow?.id || windowId,
        pairs,
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const msg = await r.text();
          throw new Error(msg || "Failed to record swap");
        }
        return r.json();
      })
      .then(() => {
        reset();
        void refreshSwaps();
        showToast("Swap recorded", "success");
      })
      .catch((e) => {
        showToast(e?.message || "Failed to record swap", "error");
      });
  };

  const freezeSwaps = () => {
    if (!currentWindow?.id) { showToast("Select a swap window first", "error"); return; }
    if (isWindowOneSelected) { showToast("Swap Window 1 is read-only now", "info"); return; }
    if (isLocked) { showToast("Swaps are already frozen", "info"); return; }
    if (lockedSwaps.length === 0) {
      if (outIds.length < 1 || inIds.length < 1 || outIds.length !== inIds.length) {
        showToast("Select 1 to 3 swap-out and the same number of swap-in players", "error");
        return;
      }
      applySwap();
    }
    freezeUserSwaps(userToken, currentWindow.id)
      .then(() => refreshSwaps())
      .then(() => showToast("Swaps frozen", "success"))
      .catch((e) => showToast(e?.message || "Failed to freeze swaps", "error"));
  };

  const outSlots = [outIds[0], outIds[1], outIds[2]];
  const inSlots = [inIds[0], inIds[1], inIds[2]];
  const byId = new Map(players.map((p) => [Number(p.id), p]));
  const [lockedSwaps, setLockedSwaps] = useState([]);
  const isLocked = lockedSwaps.some((r) => Number(r.is_frozen) === 1);
  const isSwapReadOnly = isLocked || isWindowOneSelected;
  const displaySwapRows = (() => {
    const currentId = Number(currentWindow?.id || windowId || 0);
    if (currentId <= 0) return priorSwapRows;
    if (!isSwapReadOnly) return priorSwapRows;
    return allSwapRows.filter((row) => row.eff < effectiveMatchId || (row.eff === effectiveMatchId && row.windowId <= currentId));
  })();
  const displaySquadEntryById = buildSquadState(displaySwapRows);
  const displayBaseSquadIds = Array.from(
    effectiveMatchId > 0
      ? effectiveSquadIdsForMatch((user.players || []).map(Number), displaySwapRows, effectiveMatchId)
      : ((user.players || []).map(Number))
  );
  displayBaseSquadIds.forEach((pid) => {
    if (!displaySquadEntryById.has(Number(pid))) displaySquadEntryById.set(Number(pid), 0);
  });
  const displaySquadIds = new Set(displayBaseSquadIds.map(Number));
  const displaySquadPoints = computeSquadAccumulatedPoints(displaySwapRows);
  const effectiveOutIds = outIds.filter(Boolean);
  const effectiveInIds = inIds.filter(Boolean);
  const validationSummary = (() => {
    if (effectiveOutIds.length < 1 || effectiveInIds.length < 1 || effectiveOutIds.length !== effectiveInIds.length) return null;
    const nextIds = new Set([...squadIds]);
    effectiveOutIds.forEach((id) => nextIds.delete(Number(id)));
    effectiveInIds.forEach((id) => nextIds.add(Number(id)));
    const nextPlayers = [...nextIds].map((id) => byId.get(Number(id))).filter(Boolean);
    const bowlers = nextPlayers.filter((p) => String(p.role).toUpperCase() === "BOWL").length;
    const intl = nextPlayers.filter((p) => String(p.country || "").trim().toLowerCase() !== "india").length;
    return { total: nextPlayers.length, bowlers, intl };
  })();

  const refreshSwaps = useCallback(() => {
    if (!currentWindow?.id || !username) { setLockedSwaps([]); return Promise.resolve(); }
    return fetchUserSwaps(userToken, currentWindow.id)
      .then((data) => {
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        setLockedSwaps(rows);
        if (rows.length > 0) {
          setOutIds(rows.map((r) => r.out_player_id).slice(0, 3));
          setInIds(rows.map((r) => r.in_player_id).slice(0, 3));
        } else {
          setOutIds([]);
          setInIds([]);
        }
      })
      .catch(() => {
        setLockedSwaps([]);
      });
  }, [currentWindow?.id, userToken]);

  useEffect(() => {
    void refreshSwaps();
  }, [refreshSwaps]);

  const renderSwapCard = (pid, label) => {
    if (!pid) {
      return (
        <div className="swap-card">
          <div className="swap-label">{label}</div>
          <div className="swap-meta">Select a player</div>
        </div>
      );
    }
    const p = byId.get(Number(pid));
    if (!p) return (
      <div className="swap-card">
        <div className="swap-label">{label}</div>
        <div className="swap-meta">Unknown player</div>
      </div>
    );
    return (
      <div className="swap-card sel">
        <div className="swap-label">{label}</div>
        <div className="swap-name">{p.name}</div>
        <div className="swap-meta">{p.team} · {p.role} · {(displaySquadIds.has(Number(p.id)) ? displaySquadPoints.get(p.id) : seasonPlayerPoints.get(p.id)) || 0} pts</div>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="pt">Super Swapper</div>
      <div className="ps">Swap 1 to 3 players out and the same number in. Swaps are recorded for admin validation.</div>
      {isLocked && (
        <div className="card" style={{ marginBottom: 18, borderColor: "rgba(249,115,22,.45)" }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Swap Locked</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>You have an active swap submitted for this window. Reset it to make changes.</div>
        </div>
      )}
      {isWindowOneSelected && (
        <div className="card" style={{ marginBottom: 18, borderColor: "rgba(246,199,90,.45)" }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Swap Window 1 Read Only</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Window 1 is closed for changes. Select another window to make new swaps.</div>
        </div>
      )}
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 700 }}>Swap Windows</div>
          {currentWindow && (
            <span className="tag" style={{ background: inWindow ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)", color: inWindow ? "var(--ok)" : "var(--err)" }}>
              {inWindow ? "Open" : "Locked"}
            </span>
          )}
        </div>
        {windows.length === 0 && (
          <div style={{ color: "var(--muted)", marginTop: 8 }}>No swap windows configured yet.</div>
        )}
        {windows.length > 0 && (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <select value={windowId} onChange={(e) => setWindowId(e.target.value)} style={{ maxWidth: 320 }}>
              {windows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name || `Window ${w.id}`} · {w.start_at} → {w.lock_at}{w.effective_match_id ? ` · Match ${w.effective_match_id}` : ""}
                </option>
              ))}
            </select>
            {currentWindow && (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Lock at: {currentWindow.lock_at} · Ends: {currentWindow.end_at || "N/A"} · Effective Match: {currentWindow.effective_match_id || "Auto"}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 700 }}>1) Swap Out (Your Squad)</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{outIds.length}/3 selected</div>
        </div>
        <div className="pgrid">
          {squad.map((p) => {
            const isSel = outIds.includes(p.id);
            const tc = IPL_TEAM_COLORS[p.team] || { bg: "#334", text: "#fff" };
            return (
              <div key={`out-${p.id}`} className={`pc ${isSel ? "sel" : ""}`} style={{ cursor: isSwapReadOnly ? "not-allowed" : "pointer", opacity: isSwapReadOnly ? 0.7 : 1 }} onClick={() => !isSwapReadOnly && toggleOut(p.id)}>
                <div className="pteam" style={{ color: tc.bg }}>{p.team}</div>
                <div className="pname">{p.name}</div>
                <div className="pmeta">
                  <span className="tag" style={{ background: ROLE_COLORS[p.role] + "22", color: ROLE_COLORS[p.role] }}>{p.role}</span>
                  {p.country !== "India" && <span className="tag" style={{ background: "rgba(99,102,241,.15)", color: "#818cf8" }}>🌍</span>}
                  <span className="tag" style={{ background: "rgba(255,184,0,.15)", color: "var(--gold)" }}>{(displaySquadIds.has(Number(p.id)) ? displaySquadPoints.get(p.id) : squadDisplayPoints.get(p.id)) || 0} pts</span>
                </div>
              </div>
            );
          })}
          {squad.length === 0 && <div style={{ gridColumn: "1/-1", color: "var(--muted)", textAlign: "center", padding: 20 }}>No players in your squad</div>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 700 }}>2) Swap Pad</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={reset} disabled={isSwapReadOnly}>Clear Selection</button>
            <button className="btn btn-secondary btn-sm" onClick={resetSwaps} disabled={!currentWindow?.id || isWindowOneSelected}>Reset Saved Swaps</button>
            <button className="btn btn-secondary btn-sm" onClick={applySwap} disabled={!inWindow || isSwapReadOnly}>Submit Swaps</button>
            <button className="btn btn-primary btn-sm" onClick={freezeSwaps} disabled={!inWindow || isSwapReadOnly}>Freeze Swaps</button>
          </div>
        </div>
        <div className="swap-grid">
          {renderSwapCard(outSlots[0], "Swap Out 1")}
          {renderSwapCard(outSlots[1], "Swap Out 2")}
          {renderSwapCard(outSlots[2], "Swap Out 3")}
          {renderSwapCard(inSlots[0], "Swap In 1")}
          {renderSwapCard(inSlots[1], "Swap In 2")}
          {renderSwapCard(inSlots[2], "Swap In 3")}
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Validation Summary</div>
          {!validationSummary && (
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Select 1 to 3 swap-out and the same number of swap-in players to see the post-swap counts.</div>
          )}
          {validationSummary && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="tag" style={{ background: "rgba(255,255,255,.08)", color: "var(--muted)" }}>
                Total Players: {validationSummary.total}
              </span>
              <span className="tag" style={{ background: "rgba(59,130,246,.12)", color: "#93c5fd" }}>
                Bowlers: {validationSummary.bowlers}
              </span>
              <span className="tag" style={{ background: "rgba(99,102,241,.15)", color: "#818cf8" }}>
                International: {validationSummary.intl}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 700 }}>3) Player Pool (Swap In)</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{inIds.length}/3 selected</div>
        </div>
        <div className="pfilters" style={{ marginBottom: 10 }}>
          <input
            placeholder="Search player..."
            style={{ width: 200 }}
            value={poolFlt.search}
            onChange={(e) => setPoolFlt((f) => ({ ...f, search: e.target.value }))}
          />
          {[[ROLE_FILTER_ANY, "All"], ["WK", "WK"], ["BAT", "BAT"], ["ALL", "ALL"], ["BOWL", "BOWL"]].map(([rk, l]) => (
            <button key={`pool-role-${rk}`} className={`fbtn ${poolFlt.role === rk ? "active" : ""}`} onClick={() => setPoolFlt((f) => ({ ...f, role: rk }))} disabled={isWindowOneSelected}>{l}</button>
          ))}
          <select style={{ width: 120 }} value={poolFlt.team} onChange={(e) => setPoolFlt((f) => ({ ...f, team: e.target.value }))}>
            <option value="ALL">All Teams</option>
            {poolTeams.map((t) => <option key={`pool-team-${t}`} value={t}>{t}</option>)}
          </select>
          <select style={{ width: 130 }} value={poolFlt.intl} onChange={(e) => setPoolFlt((f) => ({ ...f, intl: e.target.value }))}>
            <option value="ALL">All Players</option>
            <option value="IND">Indian</option>
            <option value="INTL">International</option>
          </select>
          <select style={{ width: 150 }} value={poolSort} onChange={(e) => setPoolSort(e.target.value)}>
            <option value="pts_desc">Points (High to Low)</option>
            <option value="pts_asc">Points (Low to High)</option>
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
          </select>
        </div>
        <div className="pgrid">
          {poolSorted.map((p) => {
            const isSel = inIds.includes(p.id);
            const tc = IPL_TEAM_COLORS[p.team] || { bg: "#334", text: "#fff" };
            return (
              <div key={`in-${p.id}`} className={`pc ${isSel ? "sel" : ""}`} style={{ cursor: isSwapReadOnly ? "not-allowed" : "pointer", opacity: isSwapReadOnly ? 0.7 : 1 }} onClick={() => !isSwapReadOnly && toggleIn(p.id)}>
                <div className="pteam" style={{ color: tc.bg }}>{p.team}</div>
                <div className="pname">{p.name}</div>
                <div className="pmeta">
                  <span className="tag" style={{ background: ROLE_COLORS[p.role] + "22", color: ROLE_COLORS[p.role] }}>{p.role}</span>
                  {p.country !== "India" && <span className="tag" style={{ background: "rgba(99,102,241,.15)", color: "#818cf8" }}>🌍</span>}
                  <span className="tag" style={{ background: "rgba(255,184,0,.15)", color: "var(--gold)" }}>{seasonPlayerPoints.get(p.id) || 0} pts</span>
                </div>
              </div>
            );
          })}
          {poolFiltered.length === 0 && <div style={{ gridColumn: "1/-1", color: "var(--muted)", textAlign: "center", padding: 20 }}>No players match filters</div>}
        </div>
      </div>
    </div>
  );
}

function PlayoffsPrediction({ user, username, onUpdate, showToast }) {
  const matches = getMatches();
  const nowTs = nowLocalMatchTs();
  const windowStart = "2026-04-02 00:00";
  const windowEnd = "2026-04-10 23:59";
  const inWindow = nowTs >= windowStart && nowTs <= windowEnd;
  const [picks, setPicks] = useState(() => {
    const map = getPlayoffsPredictions();
    return (map[username] || []).map(String);
  });

  useEffect(() => {
    const map = getPlayoffsPredictions();
    setPicks((map[username] || []).map(String));
  }, [username]);

  const teamMap = new Map();
  matches.forEach((m) => {
    if (m.teamAabbr && m.teamA) teamMap.set(m.teamAabbr, m.teamA);
    if (m.teamBabbr && m.teamB) teamMap.set(m.teamBabbr, m.teamB);
  });
  const teams = [...teamMap.entries()].map(([abbr, name]) => ({ abbr, name })).sort((a, b) => a.name.localeCompare(b.name));

  const toggle = (abbr) => {
    if (!inWindow) { showToast("Playoffs prediction window is closed", "error"); return; }
    setPicks((prev) => {
      if (prev.includes(abbr)) return prev.filter((x) => x !== abbr);
      if (prev.length >= 4) { showToast("Select only 4 teams", "error"); return prev; }
      return [...prev, abbr];
    });
  };

  const save = () => {
    if (!inWindow) { showToast("Playoffs prediction window is closed", "error"); return; }
    if (picks.length !== 4) { showToast("Please select exactly 4 teams", "error"); return; }
    const current = getPlayoffsPredictions();
    const next = { ...current, [username]: picks };
    saveStrict("ifl_playoffs_predictions", next)
      .then(() => {
        showToast("Playoffs picks saved", "success");
      })
      .catch(() => {
        showToast("Failed to save playoffs picks", "error");
      });
  };

  return (
    <div className="page">
      <div className="pt">Playoffs Prediction</div>
      <div className="ps">Pick 4 teams you believe will qualify for playoffs</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 16, fontWeight: 700 }}>
            Prediction Window: 2 Apr 2026 → 10 Apr 2026
          </div>
          <span className="tag" style={{ background: inWindow ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)", color: inWindow ? "var(--ok)" : "var(--err)" }}>
            {inWindow ? "Open" : "Closed"}
          </span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>Current time: {nowTs}</div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 700 }}>Selected Teams</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{picks.length}/4 selected</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {picks.length === 0 && <div style={{ color: "var(--muted)" }}>No teams selected</div>}
          {picks.map((abbr) => (
            <span key={`pick-${abbr}`} className="tag" style={{ background: "rgba(0,183,255,.15)", color: "var(--acc2)" }}>
              {abbr}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setPicks([])} disabled={!inWindow || picks.length === 0}>Reset Picks</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={!inWindow || picks.length !== 4}>Save Picks</button>
        </div>
      </div>
      <div className="pgrid">
        {teams.map((t) => {
          const isSel = picks.includes(t.abbr);
          return (
            <div key={t.abbr} className={`pc ${isSel ? "sel" : ""}`} style={{ cursor: inWindow ? "pointer" : "not-allowed", opacity: inWindow ? 1 : 0.7 }} onClick={() => inWindow && toggle(t.abbr)}>
              <TeamBadge abbr={t.abbr} />
              <div className="pname" style={{ marginTop: 8 }}>{t.name}</div>
              <div className="pmeta" style={{ justifyContent: "center" }}>
                <span className="tag" style={{ background: "rgba(255,255,255,.08)", color: "var(--muted)" }}>{t.abbr}</span>
              </div>
            </div>
          );
        })}
        {teams.length === 0 && <div style={{ gridColumn: "1/-1", color: "var(--muted)", textAlign: "center", padding: 20 }}>No teams available</div>}
      </div>
    </div>
  );
}

function Predict({ user, username, userToken, onPredictionSaved, showToast }) {
  const matches = getMatches();
  const liveUser = load("ifl_users", {})[username] || user || {};
  const preds = liveUser.predictions || {};
  const nowTs = nowLocalMatchTs();
  const resolvePredictionDisplay = (match, rawPred) => {
    if (!rawPred) return null;
    if (rawPred?.pts !== undefined || rawPred?.correct === true || rawPred?.correct === false) return rawPred;
    if (match?.winner === "NR") return { ...rawPred, correct: null, pts: 0 };
    if (match?.winner && rawPred?.pick) {
      const ok = rawPred.pick === match.winner;
      return { ...rawPred, correct: ok, pts: ok ? POINT_RULES.MATCH_WINNER_PICK : 0 };
    }
    return rawPred;
  };
  const firstOpenIdx = matches.findIndex((m) => !isPredictionClosed(m.date, nowTs));
  const currentMatches = (() => {
    if (matches.length === 0) return matches;
    if (firstOpenIdx >= 0) return matches.slice(firstOpenIdx);
    return matches.length > 0 ? [matches[matches.length - 1]] : matches;
  })();
  const olderMatches = (() => {
    if (matches.length === 0) return [];
    if (firstOpenIdx > 0) return matches.slice(0, firstOpenIdx);
    if (firstOpenIdx < 0 && matches.length > 1) return matches.slice(0, matches.length - 1);
    return [];
  })();

  const predict = (matchId, abbr) => {
    const m = matches.find(x => x.id === matchId);
    if (!m) return;
    if (isPredictionClosed(m.date, nowTs)) { showToast(`Prediction window closes 30 mins before match start`, "error"); return; }
    const current = preds[matchId];
    submitUserPrediction(userToken, matchId, abbr)
      .then(() => {
        onPredictionSaved?.(matchId, abbr);
        if (current?.pick && current.pick !== abbr) showToast(`Prediction updated to ${abbr}`, "success");
        else if (!current?.pick) showToast(`Predicted ${abbr} — awaiting result`, "info");
        else showToast(`Prediction remains ${abbr}`, "info");
      })
      .catch((e) => {
        showToast(e?.message || "Failed to save prediction", "error");
      });
  };

  return (
    <div className="page">
      <div className="pt">Match Predictions</div>
      <div className="ps">Predict the winner for future matches only · 50 points for each correct pick</div>
      <div className="card" style={{ marginBottom: 14, fontSize: 13, color: "var(--muted)" }}>
        Runs 1 · Catch 5 · Runout/Stumping 10 · Wicket 20 · 3W +25 · 5W +50 · 50/75/100 runs +25/+50/+100 · MoM +50 · Match winner pick +50
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }} id="current-preds">
        {matches.length === 0 && <div className="empty"><div className="ico">📅</div><p>No matches scheduled yet</p><small>Admin will add matches soon</small></div>}
        {olderMatches.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <a className="btn btn-secondary btn-sm" href="#older-preds">Older Predictions</a>
          </div>
        )}
        {currentMatches.map(m => {
          const pred = resolvePredictionDisplay(m, preds[m.id]);
          const cA = IPL_TEAM_COLORS[m.teamAabbr] || { bg: "#334", text: "#fff" };
          const cB = IPL_TEAM_COLORS[m.teamBabbr] || { bg: "#334", text: "#fff" };
          const closed = isPredictionClosed(m.date, nowTs);
          const lockTs = getPredictionLockTs(m.date);
          return (
            <div key={m.id} className="mc">
              <div className="mc-hdr">
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div className="mc-date">Match {m.id} · {normalizeMatchDateTime(m.date)}</div>
                  {!!pred && <span style={{ fontSize: 11, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, color: m.winner === "NR" ? "var(--muted)" : pred.correct === true ? "var(--ok)" : pred.correct === false ? "var(--err)" : "var(--muted)" }}>
                    {m.winner === "NR" ? "NR · 0 pts" : pred.correct === true ? "✓ +50 pts" : pred.correct === false ? "✗ 0 pts" : "⏳ Result pending"}
                  </span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>📍 {m.venue}</div>
              </div>
              <div className="mc-teams">
                {[{ abbr: m.teamAabbr, name: m.teamA, c: cA }, { abbr: m.teamBabbr, name: m.teamB, c: cB }].map((t, i) => {
                  const isPick = pred?.pick === t.abbr;
                  const cls = isPick ? (pred.correct === true ? "ok" : pred.correct === false ? "err" : "sel") : "";
                  return (
                    <div key={i}>
                      {i === 1 && <div className="mc-vs">VS</div>}
                      <div className={`mc-badge ${cls}`} style={{ background: t.c.bg + "22", opacity: closed ? 0.65 : 1, cursor: closed ? "not-allowed" : "pointer" }} onClick={() => !closed && predict(m.id, t.abbr)}>
                        <TeamBadge abbr={t.abbr} />
                        <span style={{ fontSize: 12, color: "var(--text)", marginTop: 4 }}>{t.name.split(" ").slice(-1)[0]}</span>
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginLeft: "auto" }}>
                  {closed ? <span className="pbadge">Closed</span> : <span className="pbadge">{pred ? "Editable" : "Upcoming"}</span>}
                </div>
              </div>
              {!closed && <div style={{ fontSize: 12, color: "var(--muted)" }}>{pred ? `You can change prediction until match toss time (${lockTs})` : `Click a team to set your prediction before match toss time (${lockTs})`}</div>}
              {closed && <div style={{ fontSize: 12, color: "var(--muted)" }}>Prediction window closed 30 mins before match start</div>}
            </div>
          );
        })}
        {olderMatches.length > 0 && (
          <div id="older-preds" style={{ marginTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="pt" style={{ fontSize: 18 }}>Older Predictions</div>
              <a className="btn btn-secondary btn-sm" href="#current-preds">Back to Current</a>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {olderMatches.map(m => {
                const pred = resolvePredictionDisplay(m, preds[m.id]);
                const cA = IPL_TEAM_COLORS[m.teamAabbr] || { bg: "#334", text: "#fff" };
                const cB = IPL_TEAM_COLORS[m.teamBabbr] || { bg: "#334", text: "#fff" };
                const closed = isPredictionClosed(m.date, nowTs);
                const lockTs = getPredictionLockTs(m.date);
                return (
                  <div key={`old-${m.id}`} className="mc">
                    <div className="mc-hdr">
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div className="mc-date">Match {m.id} · {normalizeMatchDateTime(m.date)}</div>
                  {!!pred && <span style={{ fontSize: 11, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, color: m.winner === "NR" ? "var(--muted)" : pred.correct === true ? "var(--ok)" : pred.correct === false ? "var(--err)" : "var(--muted)" }}>
                    {m.winner === "NR" ? "NR · 0 pts" : pred.correct === true ? "✓ +50 pts" : pred.correct === false ? "✗ 0 pts" : "⏳ Result pending"}
                  </span>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>📍 {m.venue}</div>
                    </div>
                    <div className="mc-teams">
                      {[{ abbr: m.teamAabbr, name: m.teamA, c: cA }, { abbr: m.teamBabbr, name: m.teamB, c: cB }].map((t, i) => {
                        const isPick = pred?.pick === t.abbr;
                        const cls = isPick ? (pred.correct === true ? "ok" : pred.correct === false ? "err" : "sel") : "";
                        return (
                          <div key={i}>
                            {i === 1 && <div className="mc-vs">VS</div>}
                            <div className={`mc-badge ${cls}`} style={{ background: t.c.bg + "22", opacity: closed ? 0.65 : 1, cursor: closed ? "not-allowed" : "pointer" }} onClick={() => !closed && predict(m.id, t.abbr)}>
                              <TeamBadge abbr={t.abbr} />
                              <span style={{ fontSize: 12, color: "var(--text)", marginTop: 4 }}>{t.name.split(" ").slice(-1)[0]}</span>
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ marginLeft: "auto" }}>
                        {closed ? <span className="pbadge">Closed</span> : <span className="pbadge">{pred ? "Editable" : "Upcoming"}</span>}
                      </div>
                    </div>
                    {!closed && <div style={{ fontSize: 12, color: "var(--muted)" }}>{pred ? `You can change prediction until match toss time (${lockTs})` : `Click a team to set your prediction before match toss time (${lockTs})`}</div>}
                    {closed && <div style={{ fontSize: 12, color: "var(--muted)" }}>Prediction window closed 30 mins before match start</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Leaderboard({ me }) {
  const users = load("ifl_users", {});
  const matches = getMatches();
  const players = getPlayers();
  const swapWindows = getSwapWindows();
  const [prevRanks, setPrevRanks] = useState({});
  const playerById = new Map(players.map((p) => [Number(p.id), p]));
  const predictionAccuracyForUser = (u) => {
    let correct = 0;
    let settled = 0;
    Object.entries(u?.predictions || {}).forEach(([mid, pred]) => {
      const match = matches.find((m) => String(m.id) === String(mid));
      if (!match?.winner || match.winner === "NR") return;
      if (pred?.correct === true || pred?.correct === false) {
        settled += 1;
        if (pred.correct === true) correct += 1;
      }
    });
    return settled > 0 ? correct / settled : 0;
  };
  const leaderboardTagForUser = (u, rank, delta) => {
    const squad = (u?.players || []).map((pid) => playerById.get(Number(pid))).filter(Boolean);
    const bowlers = squad.filter((p) => p.role === "BOWL").length;
    const allRounders = squad.filter((p) => p.role === "ALL").length;
    const intl = squad.filter((p) => p.country !== "India").length;
    const acc = predictionAccuracyForUser(u);
    const last = Number(u?.lastEarned || 0);
    if (rank === 1) return "👑 Crown Defender";
    if (Number(delta) >= 2) return "🚀 Rocket Climber";
    if (Number(delta) <= -2) return "🛟 Damage Control";
    if (last >= 250) return "🔥 Hot Hand";
    if (acc >= 0.65) return "🎯 Prediction Sniper";
    if (bowlers >= 7) return "⚡ Wicket Hunter";
    if (allRounders >= 5) return "💥 Chaos Engineer";
    if (intl >= 6) return "🌍 Overseas Armada";
    if (squad.length > 0 && intl <= 2) return "🇮🇳 Swadeshi Scout";
    if (rank <= 4) return "🏁 Title Chaser";
    if (rank >= 15) return "🐎 Dark Horse";
    return "😈 Mid-table Menace";
  };
  const rows = Object.entries(users)
    .map(([un, u]) => ({ un, teamName: u.teamName, teamLogo: u.teamLogo || "", points: u.points || 0, preds: Object.keys(u.predictions || {}).length, rawUser: u }))
    .sort((a, b) => b.points - a.points)
    .map((r, idx) => {
      const prev = Object.prototype.hasOwnProperty.call(prevRanks, r.un) ? Number(prevRanks[r.un]) : null;
      const delta = prev ? prev - (idx + 1) : 0;
      return { ...r, tag: leaderboardTagForUser(r.rawUser, idx + 1, delta) };
    });
  const top3 = rows.slice(0, 3);
  const podiumOrder = [1, 0, 2].map((idx) => ({ row: top3[idx], idx })).filter((x) => x.row);
  const today = nowLocalMatchTs().slice(0, 10);
  const whatCanChangeToday = buildWhatCanChangeToday(rows, users, matches, swapWindows, players);

  useEffect(() => {
    let active = true;
    fetchPrevRankMap(today)
      .then((ranks) => { if (active) setPrevRanks(ranks || {}); })
      .catch(() => { if (active) setPrevRanks({}); });
    return () => { active = false; };
  }, [rows, today]);
  return (
    <div className="page lb-party">
      <div className="lb-hero">
        <div>
          <div className="pt" style={{ marginBottom: 4 }}>Leaderboard</div>
          <div className="ps">Celebrating the leaders and biggest point hauls</div>
        </div>
        <div className="lb-spark">Season Leaders</div>
      </div>
      {whatCanChangeToday && (
        <div className="card" style={{ marginBottom: 18, border: "1px solid rgba(59,130,246,.25)", background: "linear-gradient(135deg, rgba(59,130,246,.10), rgba(191,219,254,.12))" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "#93c5fd" }}>What Can Change Today</div>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 24, fontWeight: 800, marginTop: 8 }}>
            Match {whatCanChangeToday.match.id}: {whatCanChangeToday.match.teamAabbr} vs {whatCanChangeToday.match.teamBabbr}
          </div>
          <div style={{ marginTop: 10, color: "var(--muted)", lineHeight: 1.55, fontSize: 14 }}>{whatCanChangeToday.summary}</div>
        </div>
      )}
      {top3.length > 0 && (
        <div className="lb-podium">
          {podiumOrder.map(({ row: r, idx }) => (
            <div key={r.un} className={`lb-pod ${["g", "s", "b"][idx] || ""} ${idx === 0 ? "lb-pod-center" : "lb-pod-side"}`}>
              <div className="lb-poppers">
                <div className="lb-popper left" />
                <div className="lb-popper right" />
              </div>
              <div className="lb-confetti">
                <i /><i /><i /><i /><i /><i /><i /><i />
              </div>
              <div className="lb-pod-body">
                <div className="lb-medal">{["#1", "#2", "#3"][idx]}</div>
                <div className="lb-pod-logo">
                  <TeamLogo logo={r.teamLogo} teamName={r.teamName} />
                </div>
                <div className="lb-pname">{r.teamName}</div>
                <div className="lb-ppoints">{r.points} pts</div>
                <div className="lb-psub">{r.tag}</div>
              </div>
              <div className="lb-pod-step" />
            </div>
          ))}
        </div>
      )}
      <div className="lb">
        {rows.length === 0 && <div className="empty"><div className="ico">🏆</div><p>No players yet</p></div>}
        {rows.map((r, i) => (
          <div key={r.un} className="lbr" style={r.un === me ? { borderColor: "var(--acc)", background: "rgba(249,115,22,.04)" } : {}}>
            <div className={`lbrank ${["g", "s", "b"][i] || ""}`}>{["🥇", "🥈", "🥉"][i] || `#${i + 1}`}</div>
            <TeamLogo logo={r.teamLogo} teamName={r.teamName} small />
            <div className="lbinfo">
              <div className="lbname">{r.teamName} {r.un === me && <span style={{ fontSize: 11, color: "var(--acc)", marginLeft: 6 }}>YOU</span>}</div>
              <div className="lbsub">
                {r.tag} · {r.preds} predictions
                {Object.prototype.hasOwnProperty.call(prevRanks, r.un) ? (() => {
                  const delta = Number(prevRanks[r.un]) - (i + 1);
                  if (delta > 0) return <span style={{ marginLeft: 8, color: "var(--ok)", fontWeight: 700 }}>▲ +{delta}</span>;
                  if (delta < 0) return <span style={{ marginLeft: 8, color: "var(--err)", fontWeight: 700 }}>▼ {Math.abs(delta)}</span>;
                  return <span style={{ marginLeft: 8, color: "var(--muted)", fontWeight: 700 }}>– 0</span>;
                })() : null}
              </div>
            </div>
            <div><div className="lbpts">{r.points}</div><div className="lbptsl">Points</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TodaysEdge({ user, username }) {
  const users = load("ifl_users", {});
  const matches = getMatches();
  const players = getPlayers();
  const swapWindows = getSwapWindows();
  const matchStats = getMatchStats();
  const targetMatch = getInsightTargetMatch(matches);
  const rows = Object.entries(users)
    .map(([un, u]) => ({ un, teamName: u.teamName, points: Number(u.points || 0) }))
    .sort((a, b) => Number(b.points || 0) - Number(a.points || 0));
  const myIdx = rows.findIndex((r) => r.un === username);
  const meRow = myIdx >= 0 ? rows[myIdx] : null;
  const aboveRow = myIdx > 0 ? rows[myIdx - 1] : null;
  const belowRow = myIdx >= 0 && myIdx < rows.length - 1 ? rows[myIdx + 1] : null;
  const rateInsight = getRateMyTeamInsight(user, users, matches, swapWindows, players, matchStats);
  const climbInsight = getRankClimbInsight(username, users, matches, swapWindows, players);
  const changeInsight = getWhatCanChangeInsight(username, users, matches, swapWindows, players);

  const playerById = new Map(players.map((p) => [Number(p.id), p]));
  const completedMatches = matches
    .filter((m) => normalizeMatchDateTime(m.date) <= nowLocalMatchTs())
    .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)));
  const playerTotals = new Map();
  completedMatches.forEach((m) => {
    const ms = matchStats[String(m.id)] || {};
    Object.entries(ms.players || {}).forEach(([pid, stat]) => {
      const npid = Number(pid);
      const current = Number(playerTotals.get(npid) || 0);
      const bonus = Number(ms.motmPlayerId) === npid ? POINT_RULES.MAN_OF_MATCH : 0;
      playerTotals.set(npid, current + scorePlayerPerformance(stat) + bonus);
    });
  });

  const ownership = new Map();
  Object.values(users).forEach((u) => {
    const effectiveIds = effectiveSquadIdsForMatch(
      (u?.players || []).map(Number),
      resolveUserSwapRows(u, swapWindows),
      Number(targetMatch?.id || 0)
    );
    effectiveIds.forEach((pid) => ownership.set(Number(pid), (ownership.get(Number(pid)) || 0) + 1));
  });

  const mySquad = effectiveSquadIdsForMatch(
    (user?.players || []).map(Number),
    resolveUserSwapRows(user, swapWindows),
    Number(targetMatch?.id || 0)
  );
  const matchPlayerIds = new Set(
    players
      .filter((p) => targetMatch && (p.team === targetMatch.teamAabbr || p.team === targetMatch.teamBabbr))
      .map((p) => Number(p.id))
  );
  const todayPlayers = [...mySquad]
    .filter((pid) => matchPlayerIds.has(Number(pid)))
    .map((pid) => playerById.get(Number(pid)))
    .filter(Boolean)
    .map((p) => ({
      ...p,
      totalPts: Number(playerTotals.get(Number(p.id)) || 0),
      owners: Number(ownership.get(Number(p.id)) || 0),
    }))
    .sort((a, b) => Number(b.totalPts || 0) - Number(a.totalPts || 0));

  const gapAbove = aboveRow && meRow ? Number(aboveRow.points || 0) - Number(meRow.points || 0) : 0;
  const gapBelow = belowRow && meRow ? Number(meRow.points || 0) - Number(belowRow.points || 0) : 0;
  const uniqueToday = todayPlayers.filter((p) => Number(p.owners || 0) === 1);
  const diffToday = todayPlayers.filter((p) => Number(p.owners || 0) <= 3);

  return (
    <div className="page">
      <div className="card" style={{ marginBottom: 18, background: "linear-gradient(135deg, rgba(23,37,84,.96), rgba(30,58,138,.92) 58%, rgba(15,23,42,.96))", border: "1px solid rgba(147,197,253,.18)", overflow: "hidden" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#bfdbfe" }}>Daily Engagement Hub</div>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 32, fontWeight: 800, marginTop: 8 }}>Today's Edge</div>
        <div style={{ marginTop: 10, color: "#dbeafe", fontSize: 14, lineHeight: 1.65 }}>
          {targetMatch
            ? `Everything here is focused on Match ${targetMatch.id}: ${targetMatch.teamAabbr} vs ${targetMatch.teamBabbr}. Use this page to see your pressure points, leverage players, and the paths that can move the leaderboard today.`
            : "There is no active or upcoming match right now, so this page will refresh when the next match becomes available."}
        </div>
        <div className="edge-top-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginTop: 16 }}>
          <div style={{ borderRadius: 14, padding: "12px 14px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.08)" }}>
            <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "#bfdbfe" }}>Your Rank</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 30, fontWeight: 800, marginTop: 6 }}>{myIdx >= 0 ? `#${myIdx + 1}` : "-"}</div>
          </div>
          <div style={{ borderRadius: 14, padding: "12px 14px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.08)" }}>
            <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "#bfdbfe" }}>Gap Above</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 30, fontWeight: 800, marginTop: 6 }}>{aboveRow ? gapAbove : 0}</div>
          </div>
          <div style={{ borderRadius: 14, padding: "12px 14px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.08)" }}>
            <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "#bfdbfe" }}>Gap Below</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 30, fontWeight: 800, marginTop: 6 }}>{belowRow ? gapBelow : 0}</div>
          </div>
          <div style={{ borderRadius: 14, padding: "12px 14px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.08)" }}>
            <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "#bfdbfe" }}>Players Today</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 30, fontWeight: 800, marginTop: 6 }}>{todayPlayers.length}</div>
          </div>
        </div>
      </div>

      <div className="edge-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, marginBottom: 18 }}>
        <div className="card">
          <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 800 }}>Your Climb Path</div>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 24, fontWeight: 800, marginTop: 8 }}>
            {aboveRow ? `Chasing ${aboveRow.teamName}` : "Defending Rank 1"}
          </div>
          <div style={{ marginTop: 10, color: "var(--text)", lineHeight: 1.65 }}>{climbInsight.summary}</div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {(climbInsight.bullets || []).slice(0, 3).map((line, idx) => (
              <div key={`climb-b-${idx}`} style={{ borderRadius: 12, padding: "10px 12px", background: "rgba(249,115,22,.06)", border: "1px solid rgba(249,115,22,.14)", color: "var(--text)" }}>{line}</div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 800 }}>Team Health</div>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 24, fontWeight: 800, marginTop: 8 }}>{rateInsight.metrics?.[0]?.value || "-"}/10</div>
          <div style={{ marginTop: 10, color: "var(--text)", lineHeight: 1.65 }}>{rateInsight.summary}</div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {(rateInsight.bullets || []).slice(0, 3).map((line, idx) => (
              <div key={`rate-b-${idx}`} style={{ borderRadius: 12, padding: "10px 12px", background: "rgba(34,197,94,.05)", border: "1px solid rgba(34,197,94,.14)", color: "var(--text)" }}>{line}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="edge-main-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(0,.95fr)", gap: 16, marginBottom: 18 }}>
        <div className="card">
          <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 800 }}>Your Matchday Exposure</div>
          <div style={{ marginTop: 8, color: "var(--text)", lineHeight: 1.65 }}>
            {todayPlayers.length
              ? "These are your active players for the current match, sorted by accumulated points so the biggest impact names stay on top."
              : "You do not have any active player in the current match."}
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {todayPlayers.length === 0 && <div style={{ color: "var(--muted)" }}>No active player exposure for this match.</div>}
            {todayPlayers.map((p) => (
              <div key={`edge-player-${p.id}`} className="edge-player-row" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 12, alignItems: "center", borderRadius: 14, padding: "12px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)" }}>
                <div className="edge-player-main" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>{p.name}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{p.team} · {p.role} · Held by {p.owners} user{p.owners === 1 ? "" : "s"}</div>
                </div>
                <div className="edge-player-tag" style={{ borderRadius: 999, padding: "6px 10px", background: Number(p.owners || 0) <= 3 ? "rgba(249,115,22,.12)" : "rgba(148,163,184,.12)", color: Number(p.owners || 0) <= 3 ? "var(--acc)" : "var(--muted)", fontSize: 12, fontWeight: 800 }}>
                  {Number(p.owners || 0) === 1 ? "Unique" : Number(p.owners || 0) <= 3 ? "Differential" : "Popular"}
                </div>
                <div className="edge-player-points" style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 28, fontWeight: 800, color: "#93c5fd" }}>{p.totalPts}</div>
                  <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em" }}>Pts</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="edge-side-stack" style={{ display: "grid", gap: 16 }}>
          <div className="card">
            <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 800 }}>Leverage Snapshot</div>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <div style={{ borderRadius: 12, padding: "12px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>Unique active players</div>
                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 28, fontWeight: 800, color: "#f8fafc", marginTop: 6 }}>{uniqueToday.length}</div>
              </div>
              <div style={{ borderRadius: 12, padding: "12px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>Differential active players</div>
                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 28, fontWeight: 800, color: "var(--acc)", marginTop: 6 }}>{diffToday.length}</div>
              </div>
              <div style={{ borderRadius: 12, padding: "12px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>Total active accumulated points</div>
                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 28, fontWeight: 800, color: "var(--ok)", marginTop: 6 }}>{todayPlayers.reduce((sum, p) => sum + Number(p.totalPts || 0), 0)}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 800 }}>What Can Change Today</div>
            <div style={{ marginTop: 10, color: "var(--text)", lineHeight: 1.65 }}>{changeInsight.summary}</div>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {(changeInsight.bullets || []).slice(0, 3).map((line, idx) => (
                <div key={`change-b-${idx}`} style={{ borderRadius: 12, padding: "10px 12px", background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.14)", color: "var(--text)" }}>{line}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 6 }}>
      </div>
    </div>
  );
}

function PlayersAtPlay({ user, username }) {
  const users = load("ifl_users", {});
  const matches = getMatches();
  const players = getPlayers();
  const swapWindows = getSwapWindows();
  const targetMatches = getPlayersAtPlayMatches(matches);
  const teamNameByAbbr = new Map(ALL_IPL_TEAMS.map((t) => [t.abbr, t.name]));
  const panelAccentByTeam = {
    DC: "rgba(37,99,235,.18)",
    PBKS: "rgba(215,38,61,.18)",
    RR: "rgba(236,72,153,.18)",
    SRH: "rgba(249,115,22,.18)",
    MI: "rgba(37,99,235,.18)",
    GT: "rgba(28,44,91,.28)",
    RCB: "rgba(215,38,61,.18)",
    CSK: "rgba(245,158,11,.18)",
    KKR: "rgba(91,44,131,.18)",
    LSG: "rgba(6,182,212,.18)",
  };

  const matchCards = targetMatches.map((match) => {
    const teamPanels = [match.teamAabbr, match.teamBabbr].map((teamAbbr, idx) => {
      const teamPlayers = players.filter((p) => p.team === teamAbbr);
      const playerUsage = new Map();
      const playerOwners = new Map();
      const noTeamPlayerInSquad = [];

      Object.entries(users).forEach(([un, u]) => {
        const effectiveIds = effectiveSquadIdsForMatch(
          (u?.players || []).map(Number),
          resolveUserSwapRows(u, swapWindows),
          Number(match.id)
        );
        const ownedTeamPlayers = teamPlayers.filter((p) => effectiveIds.has(Number(p.id)));
        if (ownedTeamPlayers.length === 0) {
          noTeamPlayerInSquad.push({
            username: un,
            teamName: u?.teamName || un,
          });
          return;
        }
        ownedTeamPlayers.forEach((p) => {
          const pid = Number(p.id);
          playerUsage.set(pid, (playerUsage.get(pid) || 0) + 1);
          const owners = playerOwners.get(pid) || [];
          owners.push(u?.teamName || un);
          playerOwners.set(pid, owners);
        });
      });

      const activeRows = teamPlayers
        .filter((p) => Number(playerUsage.get(Number(p.id)) || 0) > 0)
        .map((p) => {
          const owners = Number(playerUsage.get(Number(p.id)) || 0);
          const ownerNames = (playerOwners.get(Number(p.id)) || []).sort((a, b) => String(a).localeCompare(String(b)));
          return {
            ...p,
            owners,
            ownerNames,
            displayUsage: owners === 1 ? `Only: ${ownerNames[0] || "-"}` : `${owners} squads`,
          };
        })
        .sort((a, b) => Number(b.owners || 0) - Number(a.owners || 0) || String(a.name).localeCompare(String(b.name)));

      return {
        teamAbbr,
        teamName: teamNameByAbbr.get(teamAbbr) || teamAbbr,
        accentBg: panelAccentByTeam[teamAbbr] || (idx === 0 ? "rgba(37,99,235,.18)" : "rgba(215,38,61,.18)"),
        activeRows,
        noTeamPlayerInSquad: noTeamPlayerInSquad.sort((a, b) => String(a.teamName).localeCompare(String(b.teamName))),
      };
    });

    return {
      match,
      teamPanels,
    };
  });

  return (
    <div className="page">
      {matchCards.length === 0 && (
        <div className="card" style={{ color: "var(--muted)" }}>
          No open matches available right now.
        </div>
      )}

      <div style={{ display: "grid", gap: 24 }}>
        {matchCards.map(({ match, teamPanels }) => (
          <div
            key={`players-at-play-${match.id}`}
            style={{
              maxWidth: 1080,
              margin: "0 auto",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 28,
              padding: 28,
              background: "rgba(10,18,32,.96)",
              boxShadow: "0 28px 60px rgba(0,0,0,.35)",
              width: "100%",
            }}
          >
            <div style={{ color: "#ffbe0b", fontSize: 12, letterSpacing: ".22em", textTransform: "uppercase", fontWeight: 700 }}>My Team Insight</div>
            <h1 style={{ margin: "8px 0 10px", fontSize: 40, fontFamily: "'Rajdhani',sans-serif", lineHeight: 1.05 }}>Players At Play Today</h1>
            <div style={{ color: "#c3d0e6", marginBottom: 28, fontSize: 14 }}>
              {normalizeMatchDateTime(match.date)} · {match.teamA} vs {match.teamB} · {match.venue}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 24 }}>
              {teamPanels.map((panel) => (
                <div key={`panel-${match.id}-${panel.teamAbbr}`} style={{ borderRadius: 24, padding: 20, border: "1px solid rgba(255,255,255,.1)", background: panel.accentBg }}>
                  <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{panel.teamAbbr} · {panel.teamName}</div>
                  <div style={{ color: "#c3d0e6", fontSize: 12, marginBottom: 16 }}>{panel.activeRows.length} active fantasy picks from all squads</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {panel.activeRows.map((p) => (
                      <div key={`row-${match.id}-${panel.teamAbbr}-${p.id}`} style={{ display: "grid", gridTemplateColumns: "1fr 56px 90px", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 14, background: "rgba(255,255,255,.05)" }}>
                        <div style={{ fontWeight: 700 }}>{p.name}</div>
                        <div style={{ color: "#c3d0e6", fontSize: 12 }}>{p.role}</div>
                        <div style={{ color: "#ffbe0b", fontWeight: 700, fontSize: 12, textAlign: "right" }}>{p.displayUsage}</div>
                      </div>
                    ))}
                    {panel.activeRows.length === 0 && <div style={{ color: "#c3d0e6", fontSize: 13 }}>No fantasy-owned {panel.teamAbbr} players in this slate.</div>}
                  </div>
                  <div style={{ marginTop: 16, borderRadius: 16, padding: "12px 14px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "#ffd166" }}>No {panel.teamAbbr} Player In Squad</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {panel.noTeamPlayerInSquad.length > 0 ? panel.noTeamPlayerInSquad.map((row) => (
                        <span key={`np-${match.id}-${panel.teamAbbr}-${row.username}`} style={{ display: "inline-flex", padding: "7px 10px", borderRadius: 999, background: "rgba(255,190,11,.12)", border: "1px solid rgba(255,190,11,.2)", color: "#ffd166", fontSize: 12, fontWeight: 700 }}>
                          {row.teamName}
                        </span>
                      )) : <span style={{ color: "#c3d0e6", fontSize: 13 }}>Every squad has at least one {panel.teamAbbr} player.</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FrozenSquads({ me }) {
  const users = load("ifl_users", {});
  const players = getPlayers();
  const matches = getMatches();
  const swapWindows = getSwapWindows();
  const playerById = new Map(players.map(p => [Number(p.id), p]));
  const resolveSwapRows = (u) => {
    const rows = [];
    if (u?.swapWindows && typeof u.swapWindows === "object") {
      Object.entries(u.swapWindows).forEach(([wid, val]) => {
        const w = swapWindows.find((sw) => String(sw.id) === String(wid));
        const eff = Number(w?.effective_match_id || 0);
        const out = (val?.out || []).map(Number);
        const ins = (val?.in || []).map(Number);
        if (eff > 0 && out.length && ins.length) rows.push({ eff, out, ins });
      });
    } else if ((u?.swap1Out || []).length || (u?.swap1In || []).length) {
      const eff = Number(swapWindows[0]?.effective_match_id || 0);
      rows.push({ eff, out: (u.swap1Out || []).map(Number), ins: (u.swap1In || []).map(Number) });
    }
    return rows.sort((a, b) => a.eff - b.eff);
  };
  const effectiveSquadForMatch = (baseIds, swapRows, matchId) => {
    const set = new Set(baseIds);
    swapRows.forEach((row) => {
      if (matchId >= row.eff) {
        row.out.forEach((pid) => set.delete(pid));
        row.ins.forEach((pid) => set.add(pid));
      }
    });
    return set;
  };
  const nowTs = nowLocalMatchTs();
  const latestMatch = matches
    .filter((m) => normalizeMatchDateTime(m.date) <= nowTs)
    .sort((a, b) => normalizeMatchDateTime(a.date).localeCompare(normalizeMatchDateTime(b.date)))
    .at(-1);
  const latestMatchId = latestMatch ? Number(latestMatch.id) : 0;
  const rows = Object.entries(users)
    .filter(([un, u]) => un !== me && !!u.squadFrozen)
    .map(([un, u]) => {
      const baseIds = (u.players || []).map(Number);
      const swapRows = resolveSwapRows(u);
      const currentIds = effectiveSquadForMatch(baseIds, swapRows, latestMatchId);
      return {
        un,
        teamName: u.teamName,
        teamLogo: u.teamLogo || "",
        points: Number(u.points || 0),
        players: [...currentIds].map(pid => playerById.get(Number(pid))).filter(Boolean),
      };
    })
    .sort((a, b) => b.points - a.points);

  return (
    <div className="page">
      <div className="pt">Frozen Squads</div>
      <div className="ps">You can view other users' squads only after admin freezes them.</div>
      {rows.length === 0 && <div className="empty"><div className="ico">🔒</div><p>No frozen squads available yet</p><small>Admin needs to freeze squads first</small></div>}
      {rows.map((r, i) => (
        <details key={r.un} className="card frozen-squad-card">
          <summary className="frozen-squad-summary">
            <div className="frozen-rank">#{i + 1}</div>
            <TeamLogo logo={r.teamLogo} teamName={r.teamName} small />
            <div>
              <div className="frozen-team-name">{r.teamName}</div>
              <div className="frozen-team-meta">{r.players.length} players in latest frozen squad</div>
            </div>
            <div className="frozen-points">
              <div className="frozen-points-value">{r.points}</div>
              <div className="frozen-points-label">Points</div>
            </div>
          </summary>
          <div className="pgrid frozen-player-grid">
            {r.players.map(p => {
              const tc = IPL_TEAM_COLORS[p.team] || { bg: "#334", text: "#fff" };
              const rc = ROLE_COLORS[p.role] || "#64748b";
              return (
                <div key={`${r.un}-${p.id}`} className="pc frozen-player-card" style={{ cursor: "default" }}>
                  <div className="pteam" style={{ color: tc.bg }}>{p.team}</div>
                  <div className="pname">{p.name}</div>
                  <div className="pmeta">
                    <span className="tag" style={{ background: rc + "22", color: rc }}>{p.role}</span>
                    {p.country !== "India" && <span className="tag" style={{ background: "rgba(99,102,241,.15)", color: "#818cf8" }}>🌍 {p.country}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}

function UserRules() {
  return (
    <div className="page">
      <div className="pt">Rules</div>
      <div className="ps">League rules and points system</div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Team Submission Rules</div>
        <div style={{ display: "grid", gap: 8, color: "var(--text)", fontSize: 14 }}>
          <div>1. Select exactly 20 players to submit your squad.</div>
          <div>2. Maximum 8 overseas players are allowed in a squad.</div>
          <div>3. Minimum 6 bowlers are mandatory to submit.</div>
          <div>4. Once submitted, admin can validate and freeze your squad.</div>
          <div>5. Frozen squads cannot be edited until admin unfreezes.</div>
          <div>6. Users can view other squads only when those squads are frozen by admin.</div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Prediction Rules</div>
        <div style={{ display: "grid", gap: 8, color: "var(--text)", fontSize: 14 }}>
          <div>1. Predictions are allowed only for future matches.</div>
          <div>2. Prediction closes exactly 30 minutes before the scheduled match start time.</div>
          <div>3. Correct winner prediction gives +50 points, wrong prediction gives 0.</div>
        </div>
      </div>
      <div className="tw">
        <table>
          <thead><tr><th>Component</th><th>Points</th><th>Note</th></tr></thead>
          <tbody>
            <tr><td>1 Run</td><td>1</td><td>Base batting points</td></tr>
            <tr><td>1 Catch</td><td>5</td><td>Fielding points</td></tr>
            <tr><td>1 Runout / Stumping</td><td>10</td><td>Fielding points</td></tr>
            <tr><td>1 Wicket</td><td>20</td><td>Base bowling points</td></tr>
            <tr><td>3 Wickets</td><td>+25</td><td>Additional bonus</td></tr>
            <tr><td>4 Wickets</td><td>+50</td><td>Additional bonus</td></tr>
            <tr><td>5 Wickets</td><td>+100</td><td>Additional bonus</td></tr>
            <tr><td>50 Runs</td><td>+25</td><td>Additional bonus</td></tr>
            <tr><td>75 Runs</td><td>+50</td><td>Additional bonus</td></tr>
            <tr><td>100 Runs</td><td>+100</td><td>Additional bonus</td></tr>
            <tr><td>Man of the Match</td><td>+50</td><td>If player is in your squad</td></tr>
            <tr><td>Correct Winner Pick</td><td>+50</td><td>Per match prediction</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserManual() {
  const sections = [
    {
      id: "login",
      title: "1. Login / Register",
      points: [
        "Open the app URL.",
        "Login with your phone number and password.",
        "If new user, go to Register and create your team profile.",
      ],
      img: "/user-manual/01-login-register.png",
      imgAlt: "Login and register screen",
    },
    {
      id: "build",
      title: "2. Build Team",
      points: [
        "Select exactly 20 players.",
        "Maximum 8 overseas players.",
        "Minimum 6 bowlers before submission.",
        "Click Submit Team.",
      ],
      img: "/user-manual/02-build-team.png",
      imgAlt: "Build team screen",
    },
    {
      id: "myteam",
      title: "3. My Team",
      points: [
        "View selected squad by role.",
        "See match-wise player points.",
        "When scoring is available, matches appear even at 0 points.",
      ],
      img: "/user-manual/03-my-team-points.png",
      imgAlt: "My team points screen",
    },
    {
      id: "predict",
      title: "4. Predictions",
      points: [
        "Predict winners for future matches only.",
        "Prediction is editable until scheduled match time.",
        "Correct prediction awards +50 points.",
      ],
      img: "/user-manual/04-predictions.png",
      imgAlt: "Predictions screen",
    },
    {
      id: "squads",
      title: "5. Frozen Squads",
      points: [
        "View other squads that are available for user viewing.",
      ],
      img: "/user-manual/05-frozen-squads.png",
      imgAlt: "Frozen squads screen",
    },
    {
      id: "leaderboard",
      title: "6. Leaderboard",
      points: [
        "Total points include prediction points, player match points, and MoM bonus.",
        "Leaderboard updates after scoring recalculation.",
      ],
      img: "/user-manual/06-leaderboard.png",
      imgAlt: "Leaderboard screen",
    },
    {
      id: "rules",
      title: "7. Rules",
      points: [
        "Open Rules tab to review full gameplay and points policy.",
      ],
      img: "/user-manual/07-rules.png",
      imgAlt: "Rules screen",
    },
    {
      id: "profile",
      title: "8. Profile",
      points: [
        "View your team and prediction summary.",
        "Upload team logo in PNG/JPG/WEBP.",
        "Recommended logo: 512x512, max size 2MB.",
      ],
      img: "/user-manual/08-profile.png",
      imgAlt: "Profile screen",
    },
    {
      id: "playoffs",
      title: "9. Playoffs Prediction",
      points: [
        "Open Playoffs Prediction tab.",
        "Pick exactly 4 teams before the window closes.",
        "Use Reset Picks to clear, then Save Picks to lock choices.",
        "Predictions are editable only within the window.",
      ],
      img: "/user-manual/09-playoffs-prediction.png",
      imgAlt: "Playoffs prediction screen",
    },
    {
      id: "swap",
      title: "10. Super Swapper",
      points: [
        "Open Super Swapper during an active swap window.",
        "Select 2 players to swap out and 2 players to swap in.",
        "Review the validation summary for bowlers and overseas count.",
        "Submit Swaps to save and Freeze Swaps to lock the window.",
      ],
      img: "/user-manual/10-super-swapper.png",
      imgAlt: "Super Swapper screen",
    },
  ];

  return (
    <div className="page">
      <div className="sh">
        <div>
          <div className="pt">User Manual</div>
          <div className="ps">Step-by-step guide to use the app</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>Download PDF</button>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#manual-${s.id}`}
              className="tag"
              style={{ textDecoration: "none", background: "rgba(59,130,246,.12)", color: "#93c5fd", border: "1px solid rgba(147,197,253,.28)" }}
            >
              {s.title}
            </a>
          ))}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          This tab is the in-app user guide with screen captures.
        </div>
      </div>

      {sections.map((s) => (
        <div key={s.id} id={`manual-${s.id}`} className="card manual-section" style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{s.title}</div>
          <ul style={{ marginLeft: 18, marginBottom: 10 }}>
            {s.points.map((p) => (
              <li key={p} style={{ marginBottom: 4 }}>{p}</li>
            ))}
          </ul>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "#020611" }}>
            <img src={s.img} alt={s.imgAlt} style={{ width: "100%", display: "block", maxHeight: 580, objectFit: "contain" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Profile({ user, username, onUpdate, showToast, lang }) {
  const matches = getMatches();
  const preds = user.predictions || {};
  const total = Object.keys(preds).length;
  const correct = Object.values(preds).filter(p => p.correct === true).length;
  const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
  const [busy, setBusy] = useState(false);
  const [teamName, setTeamName] = useState(user.teamName || "");

  const onFile = async (file) => {
    try {
      setBusy(true);
      const logo = await prepareTeamLogo(file);
      onUpdate({ teamLogo: logo });
      showToast(lang === "hi" ? "टीम लोगो अपडेट हो गया ✓" : "Team logo updated ✓", "success");
    } catch (e) {
      showToast(e?.message || (lang === "hi" ? "इमेज अपलोड असफल रहा" : "Failed to upload image"), "error");
    } finally {
      setBusy(false);
    }
  };

  const clearLogo = () => {
    onUpdate({ teamLogo: "" });
    showToast(lang === "hi" ? "टीम लोगो हटा दिया गया" : "Team logo removed", "info");
  };

  const saveTeamName = () => {
    const name = String(teamName || "").trim();
    if (!name) { showToast(lang === "hi" ? "टीम नाम खाली नहीं हो सकता" : "Team name cannot be empty", "error"); return; }
    if (name === user.teamName) { showToast(lang === "hi" ? "टीम नाम में कोई बदलाव नहीं है" : "Team name is unchanged", "info"); return; }
    onUpdate({ teamName: name });
    showToast(lang === "hi" ? "टीम नाम अपडेट हो गया ✓" : "Team name updated ✓", "success");
  };

  return (
    <div className="page">
      <div className="prof-hdr">
        <TeamLogo logo={user.teamLogo} teamName={user.teamName} />
        <div style={{ flex: 1 }}><div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 22, fontWeight: 700 }}>{user.teamName}</div><div style={{ color: "var(--muted)", fontSize: 14 }}>📱 {username}</div></div>
        <div style={{ textAlign: "right" }}><div className="ptsbig">{user.points || 0}</div><div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".07em", textTransform: "uppercase" }}>{translateText(lang, "points", "Points")}</div></div>
      </div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{translateText(lang, "team_name", "Team Name")}</div>
        <div className="fg" style={{ marginBottom: 10 }}>
          <input
            placeholder={translateText(lang, "enter_your_team_name", "Enter your team name")}
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary btn-sm" onClick={saveTeamName}>{translateText(lang, "update_team_name", "Update Team Name")}</button>
      </div>
      <div className="logo-panel" style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 17, fontWeight: 700 }}>{translateText(lang, "team_logo", "Team Logo")}</div>
        <div className="logo-meta">{translateText(lang, "logo_recommended", "Recommended: square image 300x300 px or above. Max upload size: 2MB. Stored as optimized 256x256 for fast leaderboard loading.")}</div>
        <div className="logo-actions">
          <label className="btn btn-secondary btn-sm" style={{ cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}>
            {busy ? translateText(lang, "uploading", "Uploading...") : (user.teamLogo ? translateText(lang, "change_logo", "Change Logo") : translateText(lang, "upload_logo", "Upload Logo"))}
            <input
              type="file"
              accept={TEAM_LOGO_LIMITS.ACCEPT}
              disabled={busy}
              style={{ display: "none" }}
              onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void onFile(file);
              }}
            />
          </label>
          {user.teamLogo && <button className="btn btn-secondary btn-sm profile-remove-logo" onClick={clearLogo} disabled={busy}>{translateText(lang, "remove_logo", "Remove Logo")}</button>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 28 }}>
        {[
          { l: translateText(lang, "squad_size", "Squad Size"), v: (user.players || []).length, max: 20, u: "/20" },
          { l: translateText(lang, "predictions", "Predictions"), v: total, max: matches.length || 1, u: `/${matches.length}` },
          { l: translateText(lang, "correct_picks", "Correct Picks"), v: correct, max: total || 1, u: "" },
          { l: translateText(lang, "accuracy", "Accuracy"), v: acc, max: 100, u: "%" },
        ].map(s => (
          <div key={s.l} className="card profile-stat-card">
            <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "'Rajdhani',sans-serif", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 6 }}>{s.l}</div>
            <div className="profile-stat-value" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 32, fontWeight: 700 }}>{s.v}<span style={{ fontSize: 14, color: "var(--muted)" }}>{s.u}</span></div>
            <div className="pbar" style={{ marginTop: 8 }}><div className="pfill" style={{ width: `${(s.v / s.max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="pt" style={{ fontSize: 20, marginBottom: 14 }}>Recent Predictions</div>
      {Object.keys(preds).length === 0 ? <div style={{ color: "var(--muted)" }}>No predictions yet</div> :
        Object.entries(preds).slice(-8).reverse().map(([mid, pred]) => {
          const m = matches.find(x => x.id === parseInt(mid));
          if (!m) return null;
          return (
            <div key={mid} style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px", marginBottom: 8 }}>
              <TeamBadge abbr={pred.pick} sm />
              <div style={{ flex: 1, fontSize: 13 }}><span style={{ color: "var(--muted)" }}>Match {mid}: </span>{m.teamA} vs {m.teamB}</div>
              <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, color: pred.correct === true ? "var(--ok)" : pred.correct === false ? "var(--err)" : "var(--muted)", fontSize: 14 }}>
                {pred.correct === true ? "+50" : pred.correct === false ? "0" : "⏳"} pts
              </span>
            </div>
          );
        })
      }
    </div>
  );
}

function GuestExperience({ onExit }) {
  const [pg, setPg] = useState("home");
  const [guestFavoriteTeam, setGuestFavoriteTeam] = useState("MI");
  const [guestRivalTeam, setGuestRivalTeam] = useState("GT");
  const [guestSelectedReaction, setGuestSelectedReaction] = useState("");
  const [guestReactionBursts, setGuestReactionBursts] = useState([]);
  const guestUser = {
    teamName: "Guest Gladiators",
    points: 2865,
    rank: 6,
    predictions: 18,
    correct: 11,
    players: [
      { name: "Virat Kohli", team: "RCB", role: "BAT", pts: 312, popularity: "Mega Pick", stars: 5, archetype: "Run Machine", avatar: "🏏" },
      { name: "Hardik Pandya", team: "MI", role: "AR", pts: 268, popularity: "Popular", stars: 5, archetype: "Chaos Pick", avatar: "💥" },
      { name: "Rashid Khan", team: "GT", role: "BOWL", pts: 244, popularity: "Popular", stars: 4, archetype: "Wicket Hunter", avatar: "🎯" },
      { name: "Suryakumar Yadav", team: "MI", role: "BAT", pts: 238, popularity: "Popular", stars: 4, archetype: "Clutch Finisher", avatar: "⚡" },
      { name: "Ruturaj Gaikwad", team: "CSK", role: "BAT", pts: 226, popularity: "Differential", stars: 3, archetype: "Safe Pick", avatar: "🛡️" },
      { name: "Trent Boult", team: "MI", role: "BOWL", pts: 204, popularity: "Differential", stars: 3, archetype: "Powerplay Striker", avatar: "🔥" },
      { name: "Nicholas Pooran", team: "LSG", role: "WK", pts: 196, popularity: "Popular", stars: 4, archetype: "Clutch Finisher", avatar: "⚡" },
      { name: "Axar Patel", team: "DC", role: "AR", pts: 188, popularity: "Differential", stars: 3, archetype: "Balance Broker", avatar: "⚖️" },
      { name: "Mukesh Kumar", team: "DC", role: "BOWL", pts: 144, popularity: "Rare Edge", stars: 2, archetype: "Dark Horse", avatar: "🐎" },
      { name: "Shashank Singh", team: "PBKS", role: "BAT", pts: 132, popularity: "Rare Edge", stars: 2, archetype: "Impact Spark", avatar: "✨" },
      { name: "Varun Chakravarthy", team: "KKR", role: "BOWL", pts: 128, popularity: "Sleeper", stars: 1, archetype: "Mystery Maker", avatar: "🎭" },
    ],
  };
  const guestReactionOptions = [
    { id: "winning", emoji: "😎", text: "Today I own the board" },
    { id: "pressure", emoji: "😬", text: "Pressure is real today" },
    { id: "wonderful", emoji: "🤩", text: "What a glorious matchday" },
    { id: "favorite", emoji: "🫶", text: `${guestFavoriteTeam} own the night` },
    { id: "rival", emoji: "⚔️", text: `Stop ${guestRivalTeam} tonight` },
  ];
  const guestSelectedReactionOption = guestReactionOptions.find((r) => r.id === guestSelectedReaction) || null;
  const guestHomeEmotion = {
    score: 72,
    emoji: "😎",
    label: "In Control",
    note: "This demo team is sitting in a strong zone. A couple of hot players today could push it into title-hunt territory."
  };
  useEffect(() => {
    if (!guestReactionBursts.length) return undefined;
    const timers = guestReactionBursts.map((burst) => setTimeout(() => {
      setGuestReactionBursts((prev) => prev.filter((x) => x.id !== burst.id));
    }, 1050));
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [guestReactionBursts]);
  const tabs = [
    ["home", "Home"],
    ["predict", "Predictions"],
    ["edge", "Today's Edge"],
    ["team", "My Team"],
    ["swap", "Super Swapper"],
    ["playoffs", "Playoffs"],
    ["rules", "Rules"],
    ["profile", "Profile"],
  ];
  const demoMatches = [
    { id: 24, a: "MI", b: "DC", pick: "MI", ratio: "64% MI · 36% DC" },
    { id: 25, a: "RCB", b: "LSG", pick: "RCB", ratio: "52% RCB · 48% LSG" },
    { id: 26, a: "CSK", b: "KKR", pick: "", ratio: "Prediction opens soon" },
  ];

  const DemoShell = ({ title, subtitle, children }) => (
    <div className="page">
      <div className="sh">
        <div>
          <div className="pt">{title}</div>
          <div className="ps">{subtitle}</div>
        </div>
        <span className="tag">Demo Only</span>
      </div>
      {children}
    </div>
  );

  return (
    <>
      <style>{STYLES}</style>
      <div className={`user-shell guest-shell ${pg === "home" ? "home-active" : pg === "edge" ? "edge-active" : "page-active"}`}>
        <nav className="nav">
          <div className="nav-logo">IFL <span>2026</span></div>
          <div className="nav-links">
            <div className={`nav-link ${pg === "home" ? "ua" : ""}`} onClick={() => setPg("home")}>Home</div>
            <button className="btn btn-secondary btn-sm" onClick={onExit} style={{ marginLeft: 8 }}>Exit Demo</button>
          </div>
        </nav>

        {pg === "home" && (
          <div className="uhome-site">
            <section className="uhome-hero">
              <div className="uhome-badge"><span></span>Guest Experience</div>
              <h1 className="uhome-title">Experience <em>IFL</em><br />as guest</h1>
              <div className="uhome-year">Simulated . User View . Dummy League Mode</div>
              <p className="uhome-desc">Explore predictions, squads, swaps, rankings, and insight widgets with demo data. Nothing is saved to the real league.</p>
              <div className="uhome-actions">
                <button className="uhome-btn primary" onClick={() => setPg("predict")}>Try Predictions</button>
                <button className="uhome-btn" onClick={() => setPg("edge")}>Open Today's Edge</button>
                <button className="uhome-btn" onClick={() => setPg("team")}>My Team</button>
              </div>
              <div className="uhome-emotion-meter">
                <div className="uhome-emotion-head">
                  <div className="uhome-emotion-k">Team Pulse</div>
                  <div className="uhome-emotion-badge">{guestHomeEmotion.emoji} {guestHomeEmotion.label}</div>
                </div>
                <div className="uhome-emotion-track" aria-label="Guest team mood meter">
                  <div className="uhome-emotion-fill" style={{ width: `${guestHomeEmotion.score}%` }} />
                  <div className="uhome-emotion-marker" style={{ left: `${guestHomeEmotion.score}%` }}>{guestHomeEmotion.emoji}</div>
                </div>
                <div className="uhome-emotion-scale">
                  {[
                    { emoji: "😬", label: "Pressure" },
                    { emoji: "🙂", label: "Steady" },
                    { emoji: "😄", label: "Rhythm" },
                    { emoji: "😎", label: "Control" },
                    { emoji: "👑", label: "Bossing" },
                  ].map((stop) => (
                    <div key={stop.label} className="uhome-emotion-stop">
                      <strong>{stop.emoji}</strong>
                      <span>{stop.label}</span>
                    </div>
                  ))}
                </div>
                <div className="uhome-emotion-copy">
                  {guestHomeEmotion.note} You are currently <strong>#{guestUser.rank}</strong> in this simulated league.
                </div>
                <div className="uhome-reactions">
                  <div className="uhome-reactions-head">
                    <div className="uhome-reactions-k">Matchday Mood</div>
                    <div className="uhome-reactions-sub">Tap once and set the vibe</div>
                  </div>
                  <div className="uhome-team-picks">
                    <div className="uhome-team-pick">
                      <label>Favorite Team</label>
                      <select
                        className="uhome-team-select"
                        value={guestFavoriteTeam}
                        onChange={(e) => {
                          const next = e.target.value;
                          setGuestFavoriteTeam(next);
                          if (next === guestRivalTeam) {
                            const fallback = ALL_IPL_TEAMS.find((t) => t.abbr !== next)?.abbr || "GT";
                            setGuestRivalTeam(fallback);
                          }
                        }}
                      >
                        {ALL_IPL_TEAMS.map((team) => (
                          <option key={`guest-fav-${team.abbr}`} value={team.abbr}>{team.abbr} · {team.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="uhome-team-pick">
                      <label>Rival Team</label>
                      <select
                        className="uhome-team-select"
                        value={guestRivalTeam}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next === guestFavoriteTeam) return;
                          setGuestRivalTeam(next);
                        }}
                      >
                        {ALL_IPL_TEAMS.filter((team) => team.abbr !== guestFavoriteTeam).map((team) => (
                          <option key={`guest-rival-${team.abbr}`} value={team.abbr}>{team.abbr} · {team.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="uhome-reactions-grid">
                    {guestReactionOptions.map((reaction) => (
                      <button
                        key={reaction.id}
                        type="button"
                        className={`uhome-react-btn ${guestSelectedReaction === reaction.id ? "sel" : ""}`}
                        onClick={() => {
                          setGuestSelectedReaction(reaction.id);
                          const burstId = `${reaction.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                          setGuestReactionBursts((prev) => [...prev, { id: burstId, reactionId: reaction.id, text: reaction.text, emoji: reaction.emoji }]);
                        }}
                      >
                        {guestReactionBursts.filter((burst) => burst.reactionId === reaction.id).map((burst) => (
                          <span key={burst.id} className="uhome-react-fly">
                            {burst.emoji} {burst.text}
                          </span>
                        ))}
                        <span className="uhome-react-emoji">{reaction.emoji}</span>
                        <span className="uhome-react-text">{reaction.text}</span>
                      </button>
                    ))}
                  </div>
                  <div className="uhome-react-status">
                    {guestSelectedReactionOption
                      ? <>Demo vibe set to <strong>{guestSelectedReactionOption.emoji} {guestSelectedReactionOption.text}</strong></>
                      : <>Try the buttons to preview how matchday emotion controls feel before joining the real league.</>}
                  </div>
                </div>
              </div>
            </section>
            <section className="uhome-section">
              <div className="leader-spotlight">
                <div className="leader-disc" />
                <div className="leader-avatar">
                  <TeamLogo teamName="Demo Titans" />
                </div>
                <div className="leader-copy">
                  <div className="leader-kicker">Demo Leader</div>
                  <div className="leader-name">Demo Titans</div>
                </div>
              </div>
            </section>
            <div className="uhome-stats">
              <div className="uhome-stat"><div className="uhome-stat-num">{guestUser.points}</div><div className="uhome-stat-label">Demo Points</div></div>
              <div className="uhome-stat"><div className="uhome-stat-num">#{guestUser.rank}</div><div className="uhome-stat-label">Demo Rank</div></div>
              <div className="uhome-stat"><div className="uhome-stat-num">{guestUser.predictions}</div><div className="uhome-stat-label">Predictions</div></div>
              <div className="uhome-stat"><div className="uhome-stat-num">20</div><div className="uhome-stat-label">Squad Size</div></div>
            </div>
            <section className="uhome-section">
              <div className="uhome-section-title">What Guests Can Try</div>
              <div className="uhome-quick-links" style={{ marginTop: 14 }}>
                <button className="uhome-quick" onClick={() => setPg("predict")}><div className="uhome-quick-k">Predictions</div><div className="uhome-quick-v">Pick a winner in demo mode and see how ratios feel.</div></button>
                <button className="uhome-quick" onClick={() => setPg("swap")}><div className="uhome-quick-k">Swapper</div><div className="uhome-quick-v">See how swap-out and swap-in cards work.</div></button>
                <button className="uhome-quick" onClick={() => setPg("edge")}><div className="uhome-quick-k">Insights</div><div className="uhome-quick-v">Explore rank climb and player edge widgets.</div></button>
                <button className="uhome-quick" onClick={() => setPg("rules")}><div className="uhome-quick-k">Rules</div><div className="uhome-quick-v">Understand scoring before creating a real team.</div></button>
              </div>
            </section>
            <section className="uhome-section">
              <div className="uhome-section-head">
                <div className="uhome-section-title">Demo Leaderboard</div>
                <button className="uhome-section-action" onClick={() => setPg("edge")}>What Can Change</button>
              </div>
              <div className="uhome-table">
                {[
                  [1, "Demo Titans", 3220, "up", 1],
                  [2, "Sample Strikers", 3185, "down", 1],
                  [3, "Guest Gladiators", 3044, "up", 2],
                  [4, "Mock Mavericks", 2865, "up", 1],
                  [5, "Preview Panthers", 2777, "down", 3],
                ].map(([rank, team, pts, dir, delta]) => (
                  <div className="uhome-row" key={team} style={{ gridTemplateColumns: "34px 1fr 96px" }}>
                    <div className={`uhome-rank ${rank === 1 ? "gold" : ""}`}>{rank}</div>
                    <div>
                      <div className="uhome-team">{team}</div>
                      <div className="uhome-sub">
                        <span style={{ color: dir === "up" ? "#f3c455" : "rgba(240,237,230,.58)", fontWeight: 800 }}>{dir === "up" ? "▲" : "▼"} {delta}</span>
                        {" "}rank{delta === 1 ? "" : "s"} {dir === "up" ? "climbed" : "dropped"}
                      </div>
                    </div>
                    <div className="uhome-points">{Number(pts).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {pg === "predict" && (
          <DemoShell title="Predictions" subtitle="Demo picks only · real predictions require login">
            {demoMatches.map((m) => (
              <div className="mc" key={m.id} style={{ marginBottom: 12 }}>
                <div className="mc-hdr"><div className="mc-date">Match {m.id}</div><span className="tag">{m.ratio}</span></div>
                <div className="mc-teams">
                  {[m.a, m.b].map((abbr) => <div key={abbr} className={`mc-badge ${m.pick === abbr ? "sel" : ""}`}><TeamBadge abbr={abbr} /><span>{m.pick === abbr ? "Demo Pick" : "Tap Preview"}</span></div>)}
                </div>
              </div>
            ))}
          </DemoShell>
        )}

        {pg === "edge" && (
          <DemoShell title="Today's Edge" subtitle="Simulated insight cards to show how matchday decisions feel">
            <div className="card" style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#f6c75a" }}>Daily Engagement Hub</div>
              <div style={{ fontFamily: "'Teko',sans-serif", fontSize: 34, letterSpacing: ".08em", textTransform: "uppercase", marginTop: 6 }}>Match 24 · MI vs DC</div>
              <p style={{ color: "var(--muted)", lineHeight: 1.65, marginTop: 8 }}>
                This dummy view shows how the actual Today's Edge page helps users read rank pressure, active players, unique picks, and matchday upside before a game starts.
              </p>
              <div className="edge-top-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginTop: 16 }}>
                {[["Your Rank", "#6"], ["Gap Above", 145], ["Gap Below", 88], ["Players Today", 7]].map(([l, v]) => (
                  <div key={l} className="card" style={{ padding: "12px 14px" }}>
                    <div className="profile-stat-value" style={{ fontSize: 30, fontWeight: 800 }}>{v}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="edge-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, marginBottom: 18 }}>
              <div className="card">
                <div style={{ fontFamily: "'Teko',sans-serif", fontSize: 26, color: "#f6c75a", letterSpacing: ".08em", textTransform: "uppercase" }}>Your Climb Path</div>
                <p style={{ color: "var(--muted)", lineHeight: 1.65, marginTop: 8 }}>You are chasing Rank 5 by 145 points. If MI wins, your prediction swing can cut the effective gap by 50 points.</p>
                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                  {["Hardik Pandya and Suryakumar Yadav are your biggest upside route.", "Trent Boult is a differential because only 3 demo squads own him.", "A DC win protects the team above you, so prediction pressure is high."].map((x) => <div key={x} style={{ borderRadius: 12, padding: "10px 12px", background: "rgba(232,169,46,.08)", border: "1px solid rgba(232,169,46,.2)" }}>{x}</div>)}
                </div>
              </div>
              <div className="card">
                <div style={{ fontFamily: "'Teko',sans-serif", fontSize: 26, color: "#f6c75a", letterSpacing: ".08em", textTransform: "uppercase" }}>Team Health</div>
                <div className="profile-stat-value" style={{ fontSize: 34, fontWeight: 800, marginTop: 6 }}>8.1/10</div>
                <p style={{ color: "var(--muted)", lineHeight: 1.65, marginTop: 8 }}>Strong match coverage, good role balance, and two lower-owned active players make this a high-leverage demo team today.</p>
              </div>
            </div>

            <div className="edge-main-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(0,.95fr)", gap: 16, marginBottom: 18 }}>
              <div className="card">
                <div style={{ fontFamily: "'Teko',sans-serif", fontSize: 26, color: "#f6c75a", letterSpacing: ".08em", textTransform: "uppercase" }}>Your Matchday Exposure</div>
                <p style={{ color: "var(--muted)", lineHeight: 1.6, marginTop: 8 }}>Active demo players sorted by accumulated points.</p>
                <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                  {[
                    ["Hardik Pandya", "MI", "AR", "Held by 8 users", "Popular", 268],
                    ["Suryakumar Yadav", "MI", "BAT", "Held by 5 users", "Popular", 252],
                    ["Trent Boult", "MI", "BOWL", "Held by 3 users", "Differential", 204],
                    ["Axar Patel", "DC", "AR", "Held by 2 users", "Differential", 188],
                    ["Mukesh Kumar", "DC", "BOWL", "Held by 1 user", "Unique", 144],
                  ].map(([name, team, role, held, tag, pts]) => (
                    <div key={name} className="edge-player-row" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 12, alignItems: "center", borderRadius: 14, padding: "12px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)" }}>
                      <div className="edge-player-main" style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800 }}>{name}</div>
                        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{team} · {role} · {held}</div>
                      </div>
                      <div className="edge-player-tag" style={{ borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 800 }}>{tag}</div>
                      <div className="edge-player-points" style={{ textAlign: "right" }}>
                        <div className="profile-stat-value" style={{ fontSize: 28, fontWeight: 800 }}>{pts}</div>
                        <div style={{ color: "var(--muted)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>Pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="edge-side-stack" style={{ display: "grid", gap: 16 }}>
                <div className="card">
                  <div style={{ fontFamily: "'Teko',sans-serif", fontSize: 26, color: "#f6c75a", letterSpacing: ".08em", textTransform: "uppercase" }}>Leverage Snapshot</div>
                  <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                    {[["Unique active players", 1], ["Differential active players", 3], ["Total active points", 1056]].map(([l, v]) => <div key={l} style={{ borderRadius: 12, padding: "12px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)" }}><div style={{ color: "var(--muted)", fontSize: 12 }}>{l}</div><div className="profile-stat-value" style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{v}</div></div>)}
                  </div>
                </div>
                <div className="card">
                  <div style={{ fontFamily: "'Teko',sans-serif", fontSize: 26, color: "#f6c75a", letterSpacing: ".08em", textTransform: "uppercase" }}>What Can Change Today</div>
                  <p style={{ color: "var(--muted)", lineHeight: 1.65, marginTop: 8 }}>If MI wins and your MI core scores 220+ combined points, Guest Gladiators can jump from Rank 6 to Rank 4 in this demo table.</p>
                </div>
              </div>
            </div>

          </DemoShell>
        )}

        {pg === "team" && (
          <DemoShell title="My Team" subtitle="Demo squad with accumulated player points">
            <div className="card" style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'Teko',sans-serif", fontSize: 26, color: "#f6c75a", letterSpacing: ".08em", textTransform: "uppercase" }}>Current Demo Squad</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>Flip cards to preview accumulated player points and popularity rating.</div>
            </div>
            <div className="pgrid" style={{ marginBottom: 18 }}>
              {guestUser.players.map((p, idx) => (
                <div key={p.name} className="pc pc-flip">
                  <div className="pc-inner">
                    <div className="pc-front">
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                        <div className="guest-archetype-wrap">
                          <div className={`guest-pop-avatar guest-pop-${p.stars >= 4 ? "hot" : p.stars >= 3 ? "diff" : "rare"}`}>
                            <span>{p.avatar}</span>
                          </div>
                          <div className="guest-archetype-label">{p.archetype}</div>
                        </div>
                      </div>
                      <div className="pteam">{p.team}</div>
                      <div className="pname">{p.name}</div>
                      <div className="pmeta"><span className="tag">{p.role}</span><span className="tag">{p.archetype}</span></div>
                      <div className="star-row">
                        {Array.from({ length: p.stars }).map((_, i) => <span key={`${p.name}-star-${i}`} className="star">*</span>)}
                        <span className="star-meta">demo popularity</span>
                      </div>
                    </div>
                    <div className="pc-back">
                      <div className="pname">{p.name}</div>
                      <div className="pc-back-pts">{p.pts} pts</div>
                      <div className="pc-back-sub">Accumulated points</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'Teko',sans-serif", fontSize: 26, color: "#f6c75a", letterSpacing: ".08em", textTransform: "uppercase" }}>Swapped Player Freezed Points</div>
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {[
                  ["Ruturaj Gaikwad", "CSK", "BAT", "Frozen before match 23", 186],
                  ["Trent Boult", "MI", "BOWL", "Frozen before match 23", 204],
                ].map(([name, team, role, note, pts]) => (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{name}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}><span className="tag">{team}</span><span className="tag">{role}</span><span className="tag">{note}</span></div>
                    </div>
                    <div style={{ textAlign: "right" }}><div className="profile-stat-value" style={{ fontSize: 26, fontWeight: 800 }}>{pts}</div><div style={{ color: "var(--muted)", fontSize: 12 }}>pts freezed</div></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div style={{ fontFamily: "'Teko',sans-serif", fontSize: 26, color: "#f6c75a", letterSpacing: ".08em", textTransform: "uppercase" }}>Previous Match Points</div>
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {[
                  ["Match 22: RCB vs DC", 284, ["Virat Kohli: 74", "Axar Patel: 46", "Nicholas Pooran: 38", "Prediction: +50"]],
                  ["Match 21: GT vs KKR", 196, ["Rashid Khan: 82", "Hardik Pandya: 42", "Trent Boult: 22", "Prediction: 0"]],
                  ["Match 20: MI vs PBKS", 238, ["Hardik Pandya: 88", "Trent Boult: 60", "Suryakumar Yadav: 40", "Prediction: +50"]],
                ].map(([match, total, parts]) => (
                  <div key={match} style={{ borderRadius: 14, padding: "12px 14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800 }}>{match}</div>
                      <div className="profile-stat-value" style={{ fontWeight: 800 }}>{total} pts</div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                      {parts.map((x) => <span key={x} className="tag">{x}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DemoShell>
        )}

        {pg === "swap" && (
          <DemoShell title="Super Swapper" subtitle="Preview swap flow · actual swaps require league login">
            <div className="swap-grid" style={{ marginBottom: 16 }}>
              {["Out: Ruturaj Gaikwad", "Out: Trent Boult", "In: Suryakumar Yadav", "In: Jasprit Bumrah"].map((label) => <div key={label} className="swap-card sel"><div className="swap-label">{label.startsWith("Out") ? "Swap Out" : "Swap In"}</div><div className="swap-name">{label.split(": ")[1]}</div><div className="swap-meta">Demo validation passed</div></div>)}
            </div>
            <div className="card"><b>Validation Summary:</b> 20 players · 7 bowlers · 8 international players · balanced in demo mode.</div>
          </DemoShell>
        )}

        {pg === "playoffs" && (
          <DemoShell title="Playoff Predictions" subtitle="Demo top-four selection">
            <div className="pgrid">{["MI", "RCB", "GT", "DC"].map((t) => <div key={t} className="pc sel"><div className="pname">{t}</div><div className="swap-meta">Demo playoff pick</div></div>)}</div>
          </DemoShell>
        )}

        {pg === "rules" && (
          <DemoShell title="Rules" subtitle="A quick gameplay preview">
            <div className="tw"><table><thead><tr><th>Action</th><th>Points</th></tr></thead><tbody><tr><td>Run</td><td>+1</td></tr><tr><td>Wicket</td><td>+20</td></tr><tr><td>Catch</td><td>+5</td></tr><tr><td>Correct prediction</td><td>+50</td></tr><tr><td>Man of the Match</td><td>+50</td></tr></tbody></table></div>
          </DemoShell>
        )}

        {pg === "profile" && (
          <DemoShell title="Profile" subtitle="Guest profile is simulated and cannot be saved">
            <div className="prof-hdr"><TeamLogo teamName={guestUser.teamName} /><div style={{ flex: 1 }}><div style={{ fontSize: 22, fontWeight: 800 }}>{guestUser.teamName}</div><div style={{ color: "var(--muted)" }}>guest-demo</div></div><div className="ptsbig">{guestUser.points}</div></div>
            <div className="card">Create a real team to upload a logo, save predictions, submit swaps, and appear on the live leaderboard.</div>
          </DemoShell>
        )}
      </div>
      <GuestIflGuru />
      <BuildInfoBadge />
    </>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState("user"); // user | guest | manual-public | admin-login | admin
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "");
  const [userToken, setUserToken] = useState(() => sessionStorage.getItem(USER_TOKEN_STORAGE_KEY) || "");
  const [lang, setLang] = useState(() => {
    const stored = sessionStorage.getItem(LANGUAGE_STORAGE_KEY) || localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en";
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : "en";
  });
  const [username, setUsername] = useState(null);
  const [user, setUser] = useState(null);
  const [userSessionExpiresAt, setUserSessionExpiresAt] = useState(0);
  const [adminSessionExpiresAt, setAdminSessionExpiresAt] = useState(0);
  const [userLoginAt, setUserLoginAt] = useState(0);
  const [adminLoginAt, setAdminLoginAt] = useState(0);
  const [tickNow, setTickNow] = useState(Date.now());
  const [upg, setUpg] = useState("predict");
  const [apg, setApg] = useState("dashboard");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    sessionStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    if (typeof document !== "undefined") document.documentElement.lang = lang === "hi" ? "hi" : "en";
  }, [lang]);

  useEffect(() => {
    let active = true;
    void bootstrapStore({ adminToken, userToken }).finally(() => {
      if (active) setHydrated(true);
    });
    return () => { active = false; };
  }, [adminToken, userToken]);

  useEffect(() => {
    if (!hydrated) return undefined;
    if (!username && mode !== "admin") return undefined;
    let active = true;
    const sync = async () => {
      try {
        await bootstrapStore({ adminToken, userToken });
        if (!active) return;
        if (username) {
          const users = recomputeAndPersistUsers();
          if (users[username]) setUser(users[username]);
        }
      } catch {
        // Ignore periodic sync errors; normal UI/API retries continue to work.
      }
    };
    void sync();
    const t = setInterval(() => { void sync(); }, RESYNC_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [adminToken, hydrated, mode, upg, userToken, username]);

  useEffect(() => {
    let active = true;
    if (!adminToken) return () => { active = false; };
    void verifyAdminSession(adminToken).then((ok) => {
      if (!active) return;
      if (ok) {
        setMode("admin");
        setAdminLoginAt(Date.now());
        setAdminSessionExpiresAt(Date.now() + SESSION_TTL_MS);
      }
      else {
        sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
        setAdminToken("");
      }
    });
    return () => { active = false; };
  }, [adminToken]);

  const showToast = useCallback((msg, type = "info") => setToast({ msg, type, k: Date.now() }), []);

  const onUserLogin = (un, ud, token = "") => {
    const now = Date.now();
    if (token) {
      sessionStorage.setItem(USER_TOKEN_STORAGE_KEY, token);
      setUserToken(token);
      void bootstrapStore({ userToken: token }).then(() => {
        const latestUsers = load("ifl_users", {});
        if (latestUsers[un]) setUser(latestUsers[un]);
      }).catch(() => {});
    }
    setUsername(un);
    setUser(ud);
    setUpg("home");
    setUserLoginAt(now);
    setUserSessionExpiresAt(now + SESSION_TTL_MS);
  };
  const onUserLogout = useCallback(async () => {
    const logoutUser = username;
    const logoutToken = userToken;
    try {
      await flushHomeReactionAnalytics(logoutToken, logoutUser);
    } catch {}
    sessionStorage.removeItem(USER_TOKEN_STORAGE_KEY);
    setUserToken("");
    setUsername(null);
    setUser(null);
    setUserSessionExpiresAt(0);
    setUserLoginAt(0);
  }, [username, userToken]);
  const onAdminLogin = async (admUser, admPass) => {
    const data = await adminLogin(admUser, admPass);
    const now = Date.now();
    sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, data.token);
    setAdminToken(data.token);
    setAdminLoginAt(now);
    setAdminSessionExpiresAt(now + SESSION_TTL_MS);
    setMode("admin");
  };
  const onAdminLogout = () => {
    sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setAdminToken("");
    setAdminSessionExpiresAt(0);
    setAdminLoginAt(0);
    setMode("user");
    setApg("dashboard");
  };

  useEffect(() => {
    if (!username || !userSessionExpiresAt) return undefined;
    const waitMs = Math.max(0, userSessionExpiresAt - Date.now());
    const t = setTimeout(() => {
      void onUserLogout();
      showToast("Session expired after 15 minutes. Please login again.", "info");
    }, waitMs);
    return () => clearTimeout(t);
  }, [username, userSessionExpiresAt, showToast, onUserLogout]);

  useEffect(() => {
    if (mode !== "admin" || !adminToken || !adminSessionExpiresAt) return undefined;
    const waitMs = Math.max(0, adminSessionExpiresAt - Date.now());
    const t = setTimeout(() => {
      sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      setAdminToken("");
      setAdminSessionExpiresAt(0);
      setAdminLoginAt(0);
      setMode("user");
      setApg("dashboard");
      showToast("Admin session expired after 15 minutes. Please login again.", "info");
    }, waitMs);
    return () => clearTimeout(t);
  }, [mode, adminToken, adminSessionExpiresAt, showToast]);

  useEffect(() => {
    if ((!username || !userLoginAt) && (mode !== "admin" || !adminLoginAt)) return undefined;
    const t = setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [username, userLoginAt, mode, adminLoginAt]);

  const recomputeAllUsers = useCallback(() => {
    const users = recomputeAndPersistUsers();
    if (username && users[username]) setUser(users[username]);
  }, [username]);

  useEffect(() => {
    if (!hydrated) return;
    const users = recomputeAndPersistUsers();
    if (username && users[username]) setUser(users[username]);
  }, [hydrated, userToken, username]);

  const onUpdate = useCallback(async (patch) => {
    const users = load("ifl_users", {});
    const updated = { ...(users[username] || {}), ...patch };
    try {
      await updateCurrentUser(userToken, patch);
      await bootstrapStore({ userToken, adminToken });
      const latestUsers = load("ifl_users", {});
      setUser(latestUsers[username] || updated);
    } catch (e) {
      if (/401|token|required|expired|unauthorized/i.test(String(e?.message || ""))) {
        onUserLogout();
        showToast("Session expired. Please login again.", "error");
        return;
      }
      showToast("Failed to persist update. Please retry.", "error");
      return;
    }
  }, [showToast, username, userToken, onUserLogout]);

  const onPredictionSaved = useCallback((matchId, pick) => {
    if (!username) return;
    const users = load("ifl_users", {});
    const updated = { ...(users[username] || {}) };
    const preds = { ...(updated.predictions || {}) };
    preds[String(matchId)] = { pick, correct: null, pts: 0 };
    updated.predictions = preds;
    users[username] = updated;
    DB_CACHE.ifl_users = users;
    const recalculated = recomputeAndPersistUsers();
    setUser(recalculated[username] || updated);
  }, [username]);

  const USER_PAGES = ["home", "predict", "playoffs", "feed", "atplay", "myteam", "swap", "squads", "leaderboard", "rules", "manual", "profile"];
  const USER_LABELS = {
    home: translateText(lang, "home", "Home"),
    predict: translateText(lang, "predictions", "Predictions"),
    playoffs: translateText(lang, "playoffs_prediction", "Playoffs Prediction"),
    feed: translateText(lang, "todays_edge", "Today's Edge"),
    atplay: "Players At Play",
    myteam: translateText(lang, "my_team", "My Team"),
    swap: translateText(lang, "super_swapper", "Super Swapper"),
    squads: translateText(lang, "frozen_squads", "Frozen Squads"),
    leaderboard: translateText(lang, "leaderboard", "Leaderboard"),
    rules: translateText(lang, "rules", "Rules"),
    manual: translateText(lang, "user_manual", "User Manual"),
    profile: translateText(lang, "profile", "Profile"),
  };
  const ADM_PAGES = ["dashboard", "players", "matches", "scoring", "users", "user_points", "playoffs_preds", "swap_validation", "access"];
  const ADM_LABELS = {
    dashboard: translateText(lang, "dashboard", "Dashboard"),
    players: translateText(lang, "players", "Players"),
    matches: translateText(lang, "matches", "Matches"),
    scoring: translateText(lang, "scoring", "Scoring"),
    users: translateText(lang, "users", "Users"),
    user_points: translateText(lang, "user_points", "User Points"),
    playoffs_preds: translateText(lang, "playoffs_picks", "Playoffs Picks"),
    swap_validation: translateText(lang, "swap_validation", "Swap Validation"),
    access: translateText(lang, "access", "Access"),
  };

  const T = toast && <Toast key={toast.k} message={toast.msg} type={toast.type} onClose={() => setToast(null)} />;

  // Public manual (no login required)
  if (mode === "manual-public") return (
    <>
      <style>{STYLES}</style>
      <nav className="nav">
        <div className="nav-logo">IFL <span>2026</span></div>
        <div className="nav-links">
          <LanguageToggle lang={lang} setLang={setLang} />
          <button className="btn btn-secondary btn-sm" onClick={() => setMode("user")}>{translateText(lang, "back_to_login", "Back to Login")}</button>
        </div>
      </nav>
      <UserManual />
      <BuildInfoBadge />
      {T}
    </>
  );

  // Admin login
  if (mode === "admin-login") return (<><style>{STYLES}</style><AdminLoginPage onLogin={onAdminLogin} onGoUser={() => setMode("user")} lang={lang} setLang={setLang} /><BuildInfoBadge />{T}</>);

  // Guest demo
  if (mode === "guest") return <GuestExperience onExit={() => setMode("user")} />;

  // Admin panel
  if (mode === "admin") return (
    <>
      <style>{STYLES}</style>
      <div className="admin-shell">
        <nav className="nav">
          <div className="nav-logo">IFL <span>2026</span> <span className="abadge">ADMIN</span></div>
          <div className="nav-links">
            <LanguageToggle lang={lang} setLang={setLang} />
            {adminLoginAt > 0 && <div className="nav-link" style={{ cursor: "default" }}>{translateText(lang, "login_time", "Login Time")} {formatElapsed(tickNow - adminLoginAt)}</div>}
            {ADM_PAGES.map(p => <div key={p} className={`nav-link ${apg === p ? "aa" : ""}`} onClick={() => setApg(p)}>{ADM_LABELS[p]}</div>)}
            <button className="btn btn-secondary btn-sm" onClick={onAdminLogout} style={{ marginLeft: 8 }}>{translateText(lang, "logout", "Logout")}</button>
          </div>
        </nav>
        <div className="adm-hdr">
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, color: "var(--adm)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>⚙ {translateText(lang, "admin_control_panel", "Admin Control Panel")}</div>
          <h2 style={{ fontSize: 26 }}>{translateText(lang, "administration_title", "IFL 2026 — Administration")}</h2>
        </div>
        {apg === "dashboard" && <AdminDash adminToken={adminToken} showToast={showToast} />}
        {apg === "players" && <AdminPlayers showToast={showToast} adminToken={adminToken} />}
        {apg === "matches" && <AdminMatches showToast={showToast} onRecalculate={recomputeAllUsers} adminToken={adminToken} />}
        {apg === "scoring" && <AdminScoring showToast={showToast} onRecalculate={recomputeAllUsers} adminToken={adminToken} />}
        {apg === "users" && <AdminUsers showToast={showToast} onRecalculate={recomputeAllUsers} adminToken={adminToken} />}
        {apg === "user_points" && <AdminUserPoints showToast={showToast} />}
        {apg === "playoffs_preds" && <AdminPlayoffsPredictions showToast={showToast} adminToken={adminToken} />}
        {apg === "swap_validation" && <AdminSwapValidation showToast={showToast} adminToken={adminToken} />}
        {apg === "access" && <AdminAccess showToast={showToast} adminToken={adminToken} />}
        <BuildInfoBadge />
      </div>
      {T}
    </>
  );

  // User not logged in
  if (!username) return (<><style>{STYLES}</style><LoginPage onLogin={onUserLogin} onGoAdmin={() => setMode("admin-login")} onGoManual={() => setMode("manual-public")} onGoGuest={() => setMode("guest")} lang={lang} setLang={setLang} /><BuildInfoBadge />{T}</>);

  // User app
  const totalPts = user.points || 0;
  const correct = Object.values(user.predictions || {}).filter(p => p.correct === true).length;
  const syncedBgPages = new Set(["predict", "feed", "atplay", "myteam", "profile", "manual", "swap", "playoffs", "rules"]);
  const userShellTheme = upg === "home" ? "home-active" : (upg === "feed" || upg === "atplay") ? "edge-active" : syncedBgPages.has(upg) ? "page-active" : "";

  return (
    <>
      <style>{STYLES}</style>
      <div className={`user-shell ${userShellTheme}`}>
        <nav className="nav">
          <div className="nav-logo">IFL <span>2026</span></div>
          <div className="nav-links">
            <div className={`nav-link ${upg === "home" ? "ua" : ""}`} onClick={() => setUpg("home")}>{translateText(lang, "home", "Home")}</div>
            {userLoginAt > 0 && <div className="nav-link" style={{ cursor: "default" }}>{translateText(lang, "login_time", "Login Time")} {formatElapsed(tickNow - userLoginAt)}</div>}
            <LanguageToggle lang={lang} setLang={setLang} />
            <button className="btn btn-secondary btn-sm" onClick={onUserLogout} style={{ marginLeft: 8 }}>{translateText(lang, "logout", "Logout")}</button>
          </div>
        </nav>

        {upg === "predict" && (
          <div className="hero-banner">
            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <TeamLogo logo={user.teamLogo} teamName={user.teamName} small />
              <div><h2 style={{ fontSize: 22 }}>{user.teamName}</h2><div style={{ color: "var(--muted)", fontSize: 13 }}>📱 {username}</div></div>
            </div>
            <div className="hstats">
              <div><div className="hstat-v">{totalPts}</div><div className="hstat-l">{translateText(lang, "points", "Points")}</div></div>
              <div><div className="hstat-v">{correct}</div><div className="hstat-l">{translateText(lang, "correct_picks", "Correct Picks")}</div></div>
              <div><div className="hstat-v">{(user.players || []).length}</div><div className="hstat-l">{translateText(lang, "squad_size", "Squad Size")}</div></div>
              <div><div className="hstat-v">{Object.keys(user.predictions || {}).length}/{getMatches().length}</div><div className="hstat-l">{lang === "hi" ? "प्रेडिक्टेड" : "Predicted"}</div></div>
            </div>
          </div>
        )}

        {upg === "home" && <UserHome user={user} username={username} onNavigate={setUpg} lang={lang} userToken={userToken} />}
        {upg === "predict" && <Predict user={user} username={username} userToken={userToken} onPredictionSaved={onPredictionSaved} showToast={showToast} />}
        {upg === "playoffs" && <PlayoffsPrediction user={user} username={username} onUpdate={onUpdate} showToast={showToast} />}
        {upg === "feed" && <TodaysEdge user={user} username={username} />}
        {upg === "atplay" && <PlayersAtPlay user={user} username={username} />}
        {upg === "myteam" && <MyTeam user={user} onUpdate={onUpdate} showToast={showToast} />}
        {upg === "swap" && <SuperSwapper user={user} username={username} userToken={userToken} onUpdate={onUpdate} showToast={showToast} />}
        {upg === "squads" && <FrozenSquads me={username} />}
        {upg === "leaderboard" && <Leaderboard me={username} />}
        {upg === "rules" && <UserRules />}
        {upg === "manual" && <UserManual />}
        {upg === "profile" && <Profile user={user} username={username} onUpdate={onUpdate} showToast={showToast} lang={lang} />}
        <IflGuru user={user} username={username} userToken={userToken} lang={lang} />
      </div>
      <BuildInfoBadge />
      {T}
    </>
  );
}
