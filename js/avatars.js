// 手描きSVGアバター（かわいい系＝丸いシルエット+パステル / かっこいい系＝角ばったシルエット+発光）

const HEAD = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img">';

export const AVATARS = {
  /* ===== かわいい系 ===== */

  // ★5 星のつぼみ精霊
  "avatar-starbud": `${HEAD}
  <defs>
    <radialGradient id="sb-bg" cx="50%" cy="38%" r="72%">
      <stop offset="0" stop-color="#fff0f9"/><stop offset="1" stop-color="#f7c1e2"/>
    </radialGradient>
    <linearGradient id="sb-star" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffeab0"/><stop offset="1" stop-color="#f0b44e"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#sb-bg)"/>
  <polygon points="32,6 35.5,13.5 43.5,14.5 37.5,20 39,28 32,24 25,28 26.5,20 20.5,14.5 28.5,13.5"
           fill="url(#sb-star)" stroke="#e29a2e" stroke-width="1"/>
  <ellipse cx="32" cy="41" rx="17" ry="15" fill="#fffaf4"/>
  <ellipse cx="25.5" cy="39" rx="3" ry="4" fill="#4a3a55"/>
  <ellipse cx="38.5" cy="39" rx="3" ry="4" fill="#4a3a55"/>
  <circle cx="26.8" cy="37.5" r="1.3" fill="#fff"/><circle cx="39.8" cy="37.5" r="1.3" fill="#fff"/>
  <ellipse cx="20" cy="44.5" rx="3.4" ry="2.2" fill="#ffb3c9" opacity="0.85"/>
  <ellipse cx="44" cy="44.5" rx="3.4" ry="2.2" fill="#ffb3c9" opacity="0.85"/>
  <path d="M29 46 q3 3 6 0" stroke="#4a3a55" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <circle cx="12" cy="20" r="1.6" fill="#fff" opacity="0.9"/>
  <circle cx="52" cy="16" r="1.2" fill="#fff" opacity="0.8"/>
  </svg>`,

  // ★4 三毛の小妖精
  "avatar-mike": `${HEAD}
  <defs>
    <radialGradient id="mk-bg" cx="50%" cy="40%" r="72%">
      <stop offset="0" stop-color="#eefaf1"/><stop offset="1" stop-color="#c4ecd4"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#mk-bg)"/>
  <ellipse cx="13" cy="34" rx="7" ry="4.5" fill="#ffffff" opacity="0.75" transform="rotate(-20 13 34)"/>
  <ellipse cx="51" cy="34" rx="7" ry="4.5" fill="#ffffff" opacity="0.75" transform="rotate(20 51 34)"/>
  <path d="M17 24 L15 11 L27 19 Z" fill="#ffffff"/>
  <path d="M47 24 L49 11 L37 19 Z" fill="#ffffff"/>
  <path d="M17.5 23 L16.2 13.5 L25 19.5 Z" fill="#f2a65a"/>
  <path d="M46.5 23 L47.8 13.5 L39 19.5 Z" fill="#4a4458"/>
  <circle cx="32" cy="34" r="16" fill="#ffffff"/>
  <path d="M20 26 q5 -6 11 -4 q-3 5 -11 4" fill="#f2a65a"/>
  <path d="M43 41 q4 -3 2 -8 q-5 2 -2 8" fill="#4a4458"/>
  <ellipse cx="26" cy="34" rx="2.8" ry="3.6" fill="#3f9e6e"/>
  <ellipse cx="38" cy="34" rx="2.8" ry="3.6" fill="#3f9e6e"/>
  <circle cx="27" cy="32.6" r="1.2" fill="#fff"/><circle cx="39" cy="32.6" r="1.2" fill="#fff"/>
  <path d="M30 39.5 L34 39.5 L32 42 Z" fill="#f7a8bd"/>
  <path d="M32 42 q-3 3 -6 1 M32 42 q3 3 6 1" stroke="#4a4458" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  <ellipse cx="21" cy="39" rx="2.6" ry="1.8" fill="#ffc7d8" opacity="0.9"/>
  <ellipse cx="43" cy="39" rx="2.6" ry="1.8" fill="#ffc7d8" opacity="0.9"/>
  </svg>`,

  // ★4 雷のちび獣
  "avatar-raichi": `${HEAD}
  <defs>
    <radialGradient id="rc-bg" cx="50%" cy="40%" r="72%">
      <stop offset="0" stop-color="#fff9db"/><stop offset="1" stop-color="#ffe9a0"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#rc-bg)"/>
  <path d="M30 4 L38 4 L33 13 L40 13 L26 27 L30 17 L24 17 Z" fill="#ffb300" stroke="#e08e00" stroke-width="1"/>
  <circle cx="32" cy="38" r="17" fill="#ffd95c"/>
  <path d="M17 33 q4 -8 10 -9" stroke="#f7c531" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="19" cy="41" r="4.6" fill="#ff6b6b"/>
  <circle cx="45" cy="41" r="4.6" fill="#ff6b6b"/>
  <path d="M24 34 q3.5 -4.5 7 0" stroke="#4a4458" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M33 34 q3.5 -4.5 7 0" stroke="#4a4458" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M29 43 q3 3.5 6 0" stroke="#4a4458" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="24" cy="55" rx="5" ry="3" fill="#f7c531"/>
  <ellipse cx="40" cy="55" rx="5" ry="3" fill="#f7c531"/>
  </svg>`,

  // ★3 雛のピクシー
  "avatar-pixie": `${HEAD}
  <defs>
    <radialGradient id="px-bg" cx="50%" cy="40%" r="72%">
      <stop offset="0" stop-color="#fff8e6"/><stop offset="1" stop-color="#ffe8b8"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#px-bg)"/>
  <path d="M30 16 q-1 -7 2 -10 q3 4 2 10" fill="#ffd24d"/>
  <path d="M35 17 q2 -6 6 -8 q-1 5 -4 9" fill="#ffbe2e"/>
  <circle cx="32" cy="37" r="16" fill="#ffe27a"/>
  <path d="M46 40 q7 2 8 8 q-7 0 -8 -8" fill="#ffd24d"/>
  <ellipse cx="26" cy="35" rx="2.6" ry="3.4" fill="#4a4458"/>
  <ellipse cx="38" cy="35" rx="2.6" ry="3.4" fill="#4a4458"/>
  <circle cx="27" cy="33.6" r="1.1" fill="#fff"/><circle cx="39" cy="33.6" r="1.1" fill="#fff"/>
  <polygon points="30,41 34,41 32,45" fill="#f79030"/>
  <ellipse cx="21" cy="41" rx="2.8" ry="1.9" fill="#ffb9a0" opacity="0.9"/>
  <ellipse cx="43" cy="41" rx="2.8" ry="1.9" fill="#ffb9a0" opacity="0.9"/>
  <path d="M26 53 q3 4 6 0 M36 54 q2 3 5 0" stroke="#f79030" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`,

  // ★3 菓子精霊
  "avatar-sweets": `${HEAD}
  <defs>
    <radialGradient id="sw-bg" cx="50%" cy="40%" r="72%">
      <stop offset="0" stop-color="#fff0f5"/><stop offset="1" stop-color="#ffd3e2"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#sw-bg)"/>
  <path d="M14 27 q0 -9 9 -9 h18 q9 0 9 9 v3 h-36 z" fill="#f8a8c9"/>
  <path d="M14 27 h36 v5 q0 4 -5 4 h-26 q-5 0 -5 -4 z" fill="#fff3d6"/>
  <path d="M14 36 h36 v6 q0 8 -9 8 h-18 q-9 0 -9 -8 z" fill="#f8a8c9"/>
  <path d="M14 31 h36 v6 h-36 z" fill="#fff3d6"/>
  <ellipse cx="26" cy="34" rx="2.4" ry="3" fill="#4a4458"/>
  <ellipse cx="38" cy="34" rx="2.4" ry="3" fill="#4a4458"/>
  <circle cx="27" cy="32.8" r="1" fill="#fff"/><circle cx="39" cy="32.8" r="1" fill="#fff"/>
  <path d="M30 38 q2 2.4 4 0" stroke="#4a4458" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <ellipse cx="21" cy="37" rx="2.4" ry="1.6" fill="#ff9fbe" opacity="0.9"/>
  <ellipse cx="43" cy="37" rx="2.4" ry="1.6" fill="#ff9fbe" opacity="0.9"/>
  <path d="M50 16 l1.4 3.2 3.2 1.4 -3.2 1.4 -1.4 3.2 -1.4 -3.2 -3.2 -1.4 3.2 -1.4 z" fill="#fff" opacity="0.9"/>
  <circle cx="13" cy="47" r="1.5" fill="#fff" opacity="0.8"/>
  </svg>`,

  // ★3 花の子
  "avatar-flower": `${HEAD}
  <defs>
    <radialGradient id="fl-bg" cx="50%" cy="40%" r="72%">
      <stop offset="0" stop-color="#f2fbe8"/><stop offset="1" stop-color="#d5f0be"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#fl-bg)"/>
  <g fill="#ffb7d5">
    <circle cx="32" cy="17" r="8"/>
    <circle cx="46" cy="27" r="8"/>
    <circle cx="41" cy="44" r="8"/>
    <circle cx="23" cy="44" r="8"/>
    <circle cx="18" cy="27" r="8"/>
  </g>
  <circle cx="32" cy="31" r="14" fill="#fff7e8"/>
  <ellipse cx="27" cy="30" rx="2.5" ry="3.3" fill="#4a4458"/>
  <ellipse cx="37" cy="30" rx="2.5" ry="3.3" fill="#4a4458"/>
  <circle cx="28" cy="28.7" r="1.1" fill="#fff"/><circle cx="38" cy="28.7" r="1.1" fill="#fff"/>
  <path d="M30 36 q2 2.6 4 0" stroke="#4a4458" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <ellipse cx="23" cy="35" rx="2.5" ry="1.7" fill="#ffc7d8" opacity="0.95"/>
  <ellipse cx="41" cy="35" rx="2.5" ry="1.7" fill="#ffc7d8" opacity="0.95"/>
  <path d="M50 50 q5 -2 6 -8 q-6 1 -6 8" fill="#7fc46a"/>
  </svg>`,

  /* ===== かっこいい系 ===== */

  // ★5 影刃の戦士
  "avatar-shadow": `${HEAD}
  <defs>
    <radialGradient id="sh-bg" cx="50%" cy="36%" r="75%">
      <stop offset="0" stop-color="#3a2d5e"/><stop offset="1" stop-color="#171230"/>
    </radialGradient>
    <linearGradient id="sh-hood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a3b73"/><stop offset="1" stop-color="#271f47"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#sh-bg)"/>
  <path d="M32 8 L48 20 L52 54 L38 47 L26 47 L12 54 L16 20 Z" fill="url(#sh-hood)"/>
  <path d="M20 26 L32 16 L44 26 L42 44 L22 44 Z" fill="#141024"/>
  <polygon points="21,31 30,27 30,35 21,36" fill="#c9a0ff"/>
  <polygon points="43,31 34,27 34,35 43,36" fill="#c9a0ff"/>
  <polygon points="23,32 29,29.5 29,34 23,34.5" fill="#efe4ff"/>
  <polygon points="41,32 35,29.5 35,34 41,34.5" fill="#efe4ff"/>
  <path d="M22 39 h20 l-3 7 h-14 z" fill="#1d1735"/>
  <path d="M25 41 h14" stroke="#6d3fa0" stroke-width="1.6"/>
  <circle cx="13" cy="15" r="1.6" fill="#d9b8ff"/>
  <circle cx="52" cy="22" r="1.2" fill="#d9b8ff"/>
  <path d="M48 10 l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2 -2.6 -2.6 -1.2 2.6 -1.2 z" fill="#b47aff"/>
  </svg>`,

  // ★5 白銀の竜騎士
  "avatar-dragon": `${HEAD}
  <defs>
    <radialGradient id="dk-bg" cx="50%" cy="36%" r="75%">
      <stop offset="0" stop-color="#2b3b55"/><stop offset="1" stop-color="#121a29"/>
    </radialGradient>
    <linearGradient id="dk-helm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eef3fa"/><stop offset="1" stop-color="#93a5c0"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#dk-bg)"/>
  <path d="M18 22 L7 7 L9 20 L14 26 Z" fill="#dfe7f2"/>
  <path d="M46 22 L57 7 L55 20 L50 26 Z" fill="#dfe7f2"/>
  <path d="M32 9 L48 21 L52 50 L39 45 L25 45 L12 50 L16 21 Z" fill="url(#dk-helm)"/>
  <path d="M32 13 L44 22 L46 30 L18 30 L20 22 Z" fill="#c3cfe1"/>
  <polygon points="20,31 44,31 41,39 23,39" fill="#0d1522"/>
  <polygon points="23,33 41,33 39.5,37 24.5,37" fill="#6fd7ff"/>
  <polygon points="25,34 39,34 38,36 26,36" fill="#e8fbff"/>
  <path d="M24 45 h16 l-2 7 h-12 z" fill="#7d8ea8"/>
  <circle cx="13" cy="14" r="1.4" fill="#9fdcff" opacity="0.9"/>
  <circle cx="52" cy="18" r="1.1" fill="#9fdcff" opacity="0.8"/>
  </svg>`,

  // ★4 焔の剣士
  "avatar-flame": `${HEAD}
  <defs>
    <radialGradient id="fm-bg" cx="50%" cy="36%" r="75%">
      <stop offset="0" stop-color="#4a1a20"/><stop offset="1" stop-color="#240d12"/>
    </radialGradient>
    <linearGradient id="fm-hair" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff7a45"/><stop offset="1" stop-color="#d92b1f"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#fm-bg)"/>
  <path d="M14 30 L10 14 L20 20 L19 6 L28 16 L32 4 L36 16 L45 6 L44 20 L54 14 L50 30 Z" fill="url(#fm-hair)"/>
  <path d="M17 28 h30 v10 q0 12 -15 14 q-15 -2 -15 -14 z" fill="#2c2430"/>
  <path d="M20 30 h24 v6 h-24 z" fill="#1a141f"/>
  <polygon points="21,31 31,31 29,37 21,36" fill="#ffb340"/>
  <polygon points="43,31 33,31 35,37 43,36" fill="#ffb340"/>
  <path d="M22 44 q10 5 20 0" stroke="#ff5a3c" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M50 46 l6 6 M52 44 l6 6" stroke="#ffd27a" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="13" cy="44" r="1.6" fill="#ff9a5c"/>
  <circle cx="52" cy="12" r="1.3" fill="#ffce7a"/>
  </svg>`,

  // ★4 深海の騎士
  "avatar-abyss": `${HEAD}
  <defs>
    <radialGradient id="ab-bg" cx="50%" cy="36%" r="75%">
      <stop offset="0" stop-color="#12414d"/><stop offset="1" stop-color="#072430"/>
    </radialGradient>
    <radialGradient id="ab-helm" cx="45%" cy="35%" r="75%">
      <stop offset="0" stop-color="#2a8296"/><stop offset="1" stop-color="#0e3d4a"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#ab-bg)"/>
  <path d="M32 8 L46 16 L50 42 L40 52 L24 52 L14 42 L18 16 Z" fill="url(#ab-helm)"/>
  <path d="M18 16 L12 10 L14 20 Z M46 16 L52 10 L50 20 Z" fill="#1a5b6e"/>
  <circle cx="32" cy="30" r="9" fill="#06222c" stroke="#45e0c8" stroke-width="2.4"/>
  <ellipse cx="32" cy="30" rx="5" ry="5.6" fill="#7fffd4"/>
  <ellipse cx="30" cy="28" rx="2" ry="2.4" fill="#eafffb"/>
  <circle cx="21" cy="20" r="1.6" fill="#45e0c8"/>
  <circle cx="43" cy="20" r="1.6" fill="#45e0c8"/>
  <path d="M26 46 h12" stroke="#0a2f3a" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="51" cy="14" r="2.6" fill="#7fffd4" opacity="0.55"/>
  <circle cx="55" cy="21" r="1.6" fill="#7fffd4" opacity="0.45"/>
  <circle cx="13" cy="48" r="1.8" fill="#7fffd4" opacity="0.4"/>
  </svg>`,

  // ★3 書物のゴーレム
  "avatar-bookgolem": `${HEAD}
  <defs>
    <linearGradient id="bg-head" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#aebfd8"/><stop offset="1" stop-color="#7d90b0"/>
    </linearGradient>
    <radialGradient id="bg-bg" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#26364f"/><stop offset="1" stop-color="#141d2e"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#bg-bg)"/>
  <path d="M12 46 L30 41 L30 58 L12 53 Z" fill="#e8e2d0"/>
  <path d="M52 46 L34 41 L34 58 L52 53 Z" fill="#ded7c2"/>
  <path d="M30 41 L34 41 L34 58 L30 58 Z" fill="#3f5a8a"/>
  <path d="M15 47 L28 43.5 M15 50 L28 46.5 M49 47 L36 43.5 M49 50 L36 46.5" stroke="#b9b19a" stroke-width="1"/>
  <rect x="19" y="12" width="26" height="24" rx="5" fill="url(#bg-head)"/>
  <rect x="23" y="19" width="7" height="6" rx="2" fill="#6ff0ff"/>
  <rect x="34" y="19" width="7" height="6" rx="2" fill="#6ff0ff"/>
  <rect x="25" y="21" width="3" height="3" rx="1" fill="#e8feff"/>
  <rect x="36" y="21" width="3" height="3" rx="1" fill="#e8feff"/>
  <path d="M27 31 h10" stroke="#5b6d8c" stroke-width="2" stroke-linecap="round"/>
  <path d="M22 14 L18 8 M42 14 L46 8" stroke="#93a5c0" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  // ★3 石の小兵
  "avatar-stone": `${HEAD}
  <defs>
    <linearGradient id="st-head" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a6afb9"/><stop offset="1" stop-color="#6f7780"/>
    </linearGradient>
    <radialGradient id="st-bg" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#343a42"/><stop offset="1" stop-color="#1d2127"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#st-bg)"/>
  <path d="M16 18 q0 -5 6 -5 h20 q6 0 6 5 v28 q0 6 -7 6 h-18 q-7 0 -7 -6 z" fill="url(#st-head)"/>
  <path d="M20 14 q4 -6 12 -5 q-3 5 -12 5" fill="#5f9e63"/>
  <path d="M20 24 l7 4 -5 4" stroke="#5b636c" stroke-width="1.6" fill="none"/>
  <rect x="22" y="28" width="8" height="5" rx="1.5" fill="#2f353c"/>
  <rect x="34" y="28" width="8" height="5" rx="1.5" fill="#2f353c"/>
  <circle cx="26" cy="30.5" r="1.6" fill="#8fe3c0"/>
  <circle cx="38" cy="30.5" r="1.6" fill="#8fe3c0"/>
  <path d="M25 41 h14" stroke="#4c535b" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M44 44 l6 6 M46 42 l6 6" stroke="#5b636c" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,
};

export const AVATAR_IDS = Object.keys(AVATARS);
