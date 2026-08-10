const LOG_DELAY_MS = 280;
const LOG_EFFECT_TAIL_HOLD_MS = 280;
const LOG_EFFECT_IMPACT_LEAD_MS = 60;
const DIALOGUE_LOG_DELAY_MS = 1200;
const FINAL_BATTLE_DIALOGUE_HOLD_MS = 3000;
const EFFECT_SETTLE_MS = 620;
const BATTLE_SPRITE_ACTION_HOLD_MS = 1280;
const BATTLE_SPRITE_HIT_HOLD_MS = 560;
// Battle characters currently render a single canonical idle sprite for every action.
const BATTLE_SPRITE_RENDER_STATE = "idle";
const SFX_POOL_SIZE = 3;
const BGM_FADE_MS = 900;
const AUDIO_SETTINGS_KEY = "versus.audio-settings.v1";
const DEFAULT_AUDIO_SETTINGS = Object.freeze({ bgm: 0.35, sfx: 0.5, muted: false });
const AdventureSave = window.VersusAdventureSave;

function localAssetUrl(path) {
  const baseUrl = window.__VERSUS_BASE_URL__ || new URL("./", window.location.href).href;
  return new URL(String(path).replace(/^\/+/, ""), baseUrl).href;
}

const els = {
  homeScreen: document.querySelector("#homeScreen"),
  playScreen: document.querySelector("#playScreen"),
  battleScreen: document.querySelector("#battleScreen"),
  battleScreenTitle: document.querySelector("#battleScreen .header-title strong"),
  rulesScreen: document.querySelector("#rulesScreen"),
  codexScreen: document.querySelector("#codexScreen"),
  settingsScreen: document.querySelector("#settingsScreen"),
  openPlayButton: document.querySelector("#openPlayButton"),
  openAdventureButton: document.querySelector("#openAdventureButton"),
  openBattleButton: document.querySelector("#openBattleButton"),
  openPvpButton: document.querySelector("#openPvpButton"),
  openRulesButton: document.querySelector("#openRulesButton"),
  openCodexButton: document.querySelector("#openCodexButton"),
  openSettingsButton: document.querySelector("#openSettingsButton"),
  exitButton: document.querySelector("#exitButton"),
  battleBackButton: document.querySelector("#battleBackButton"),
  rulesBackButton: document.querySelector("#rulesBackButton"),
  codexBackButton: document.querySelector("#codexBackButton"),
  settingsBackButton: document.querySelector("#settingsBackButton"),
  playBackButton: document.querySelector("#playBackButton"),
  bgmVolumeSlider: document.querySelector("#bgmVolumeSlider"),
  bgmVolumeValue: document.querySelector("#bgmVolumeValue"),
  sfxVolumeSlider: document.querySelector("#sfxVolumeSlider"),
  sfxVolumeValue: document.querySelector("#sfxVolumeValue"),
  audioMuteButton: document.querySelector("#audioMuteButton"),
  audioResetButton: document.querySelector("#audioResetButton"),
  rulesSubtitle: document.querySelector("#rulesSubtitle"),
  rulesContent: document.querySelector("#rulesContent"),
  rulesTabs: [...document.querySelectorAll("[data-rules-tab]")],
  rulesPanels: [...document.querySelectorAll("[data-rules-panel]")],
  inscriptionButton: document.querySelector("#inscriptionButton"),
  inscriptionPopover: document.querySelector("#inscriptionPopover"),
  playerSelect: document.querySelector("#playerSelect"),
  aiSelect: document.querySelector("#aiSelect"),
  personalitySelect: document.querySelector("#personalitySelect"),
  pveSetupFields: [...document.querySelectorAll(".pve-setup-field")],
  pvpSetupFields: [...document.querySelectorAll(".pvp-setup-field")],
  pvpRoomInput: document.querySelector("#pvpRoomInput"),
  startButton: document.querySelector("#startButton"),
  matchLabel: document.querySelector("#matchLabel"),
  turnChip: document.querySelector("#turnChip"),
  actionsGrid: document.querySelector("#actionsGrid"),
  actionHint: document.querySelector("#actionHint"),
  adventureRouteRerollButton: document.querySelector("#adventureRouteRerollButton"),
  passiveChip: document.querySelector("#passiveChip"),
  battleLog: document.querySelector("#battleLog"),
  prevLogButton: document.querySelector("#prevLogButton"),
  nextLogButton: document.querySelector("#nextLogButton"),
  codexList: document.querySelector("#codexList"),
  codexDetail: document.querySelector("#codexDetail"),
  codexSubtitle: document.querySelector("#codexSubtitle"),
  aiModeText: document.querySelector("#aiModeText"),
  enemyInfoButton: document.querySelector("#enemyInfoButton"),
  battleRecordButton: document.querySelector("#battleRecordButton"),
  playerInfoButton: document.querySelector("#playerInfoButton"),
  enemyInfoModal: document.querySelector("#enemyInfoModal"),
  enemyInfoScrim: document.querySelector("#enemyInfoScrim"),
  enemyInfoCloseButton: document.querySelector("#enemyInfoCloseButton"),
  enemyInfoKicker: document.querySelector("#enemyInfoKicker"),
  enemyInfoTitle: document.querySelector("#enemyInfoTitle"),
  enemyInfoBody: document.querySelector("#enemyInfoBody"),
  characterPickerModal: document.querySelector("#characterPickerModal"),
  characterPickerScrim: document.querySelector("#characterPickerScrim"),
  characterPickerCloseButton: document.querySelector("#characterPickerCloseButton"),
  characterPickerTitle: document.querySelector("#characterPickerTitle"),
  characterPickerGrid: document.querySelector("#characterPickerGrid"),
  adventureRestartModal: document.querySelector("#adventureRestartModal"),
  adventureRestartScrim: document.querySelector("#adventureRestartScrim"),
  adventureRestartCancelButton: document.querySelector("#adventureRestartCancelButton"),
  adventureRestartConfirmButton: document.querySelector("#adventureRestartConfirmButton"),
};

const fighterIds = {
  player: {
    sideName: "#playerSideName",
    sideTitle: "#playerSideTitle",
    avatar: "#playerAvatar",
    hpBar: "#playerHpBar",
    mpBar: "#playerMpBar",
    hpText: "#playerHpText",
    mpText: "#playerMpText",
    stats: "#playerStats",
    state: "#playerState",
    record: "#playerRecord",
  },
  ai: {
    sideName: "#aiSideName",
    sideTitle: "#aiSideTitle",
    avatar: "#aiAvatar",
    hpBar: "#aiHpBar",
    mpBar: "#aiMpBar",
    hpText: "#aiHpText",
    mpText: "#aiMpText",
    stats: "#aiStats",
    state: "#aiState",
    record: "#aiRecord",
  },
};

const CHARACTER_COLORS = {
  toxiche: "#aee63d",
  cryne: "#c33a3a",
  plote: "#ff5a2f",
  ashend: "#a4a0b2",
  karossy: "#9bdfff",
  nihfle: "#3974ff",
  serpen: "#e9d16a",
  melague: "#8fb62d",
  balef: "#f29b38",
  revesha: "#7f3bd4",
  gandrick: "#f3e6a3",
  charinel: "#f05fb8",
  dethus: "#c9a05b",
  zeroven: "#20d6c7",
  neroko: "#f4f33a",
  happyrin: "#ff9fba",
  librang: "#7194dc",
  dracle: "#e60012",
  saqua: "#55dce8",
  queenas: "#b1185a",
  jitrom: "#92ff33",
  fimit: "#7894a8",
  emento: "#a686d4",
  necoulomb: "#e0b51b",
  xerox: "#8371e6",
};

const RANDOM_CHARACTER_COLOR = "#ffffff";
const PVP_TOKEN_STORAGE_PREFIX = "versus:pvpToken:";
const PVP_POLL_MS = 1000;
const DEFAULT_INSCRIPTION_OPTIONS = [
  {
    id: "gray",
    color: "#aeb4bd",
    summary: "Gray",
    detail: "효과 없음",
  },
  {
    id: "white",
    color: "#f2f5f7",
    summary: "White",
    detail: "액티브 공격기 위력 2 감소([연격]은 1 감소) / 일반 공격 피해 +1 / 일반 방어 경감 +1 / 명상 MP +1",
  },
  {
    id: "red",
    color: "#e96a61",
    summary: "Red",
    detail: "액티브 공격기 MP 3 증가 / 위력 3 증가([연격]은 1 증가)",
  },
  {
    id: "orange",
    color: "#f28c38",
    summary: "Orange",
    detail: "명중률 10 증가(최대 100) / ATK 0.9배",
  },
  {
    id: "yellow",
    color: "#f2c655",
    summary: "Yellow",
    detail: "체력 30% 이상시 SPD 0.7배 / 30% 미만시 SPD 1.7배 및 회피율 10%",
  },
  {
    id: "green",
    color: "#5bd477",
    summary: "Green",
    detail: "턴 종료시에 HP 2 회복 / 기본 MP 회복량 4 감소",
  },
  {
    id: "blue",
    color: "#62b8ee",
    summary: "Blue",
    detail: "시작 MP 10 증가 / 기본 MP 회복량 1 증가 / DEF 0.9배",
  },
  {
    id: "indigo",
    color: "#5967e8",
    summary: "Indigo",
    detail: "직전 턴과 동일한 행동 선택 시 자신의 소모 MP +2 / 상대의 소모 MP +5(첫 턴 제외)",
  },
  {
    id: "violet",
    color: "#b46cff",
    summary: "Violet",
    detail: "ATK와 DEF 1.1배 / 명중률 5 감소",
  },
  {
    id: "random",
    color: "#ffffff",
    summary: "Random",
    detail: "무작위 각인 선택",
  },
];

const CHARACTER_SKILL_ICON_IDS = new Set(["toxiche", "cryne", "karossy", "gandrick", "melague", "balef", "plote", "charinel", "nihfle", "ashend", "dethus", "zeroven", "revesha", "serpen", "neroko", "happyrin", "librang", "dracle", "saqua", "queenas", "jitrom", "fimit", "emento", "necoulomb", "xerox"]);
const SPRITE_ASSETS = Object.freeze({
  toxiche: "characters",
  cryne: "characters",
  plote: "characters",
  ashend: "characters",
  karossy: "characters",
  nihfle: "characters",
  serpen: "characters",
  melague: "characters",
  balef: "characters",
  revesha: "characters",
  gandrick: "characters",
  charinel: "characters",
  dethus: "characters",
  zeroven: "characters",
  neroko: "characters",
  happyrin: "characters",
  librang: "characters",
  dracle: "characters",
  saqua: "characters",
  queenas: "characters",
  jitrom: "characters",
  fimit: "characters",
  emento: "characters",
  necoulomb: "characters",
  xerox: "characters",
  demon_scout_kain: "monsters",
  demon_warrior_luke: "monsters",
  demon_mage_zero: "monsters",
  demon_archer_robin: "monsters",
  demon_priest_sara: "monsters",
  demon_fighter_gran: "monsters",
  demon_pawn_opawn: "monsters",
  demon_rook_chatrang: "monsters",
  demon_knight_kaighton: "monsters",
  demon_bishop_eveque: "monsters",
  demon_king_monochrem: "monsters",
});
const MONSTER_SKILL_ICON_IDS = new Set(["demon_scout_kain", "demon_warrior_luke", "demon_mage_zero", "demon_archer_robin", "demon_priest_sara", "demon_fighter_gran", "demon_pawn_opawn", "demon_rook_chatrang", "demon_knight_kaighton", "demon_bishop_eveque", "demon_king_monochrem"]);
const ADVENTURE_DESTINATION_ICONS = Object.freeze({
  start_adventure: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="m16 3 4 9 9 4-9 4-4 9-4-9-9-4 9-4 4-9Z" />
      <path d="m20 12-3 7-7 3 3-7 7-3Z" />
    </svg>`,
  final_battle: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="m6 11 5 5 5-10 5 10 5-5-2 14H8L6 11Z" />
      <path d="M9 25h14v3H9z" />
      <path d="M7 8 4 4M25 8l3-4" />
    </svg>`,
  mirror_break: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3C9 5 6 10 7 17c1 6 4 10 9 12 5-2 8-6 9-12 1-7-2-12-9-14Z" />
      <path d="m16 4-3 8 5 3-6 6 4 7M8 19l-5 4 5 2M24 19l5 4-5 2" />
    </svg>`,
  mirror_face: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="16" cy="14" rx="9" ry="11" />
      <path d="M16 25v3M11 29h10M11 14c3-4 7-4 10 0-3 4-7 4-10 0Z" />
      <circle cx="16" cy="14" r="1.5" />
    </svg>`,
  mirror_accept: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="16" cy="13" rx="8" ry="10" />
      <path d="M16 23v5M12 29h8M8 13c-4 1-5 5-3 9l5 5M24 13c4 1 5 5 3 9l-5 5" />
      <path d="m5 19 5 3M27 19l-5 3" />
    </svg>`,
  magic_stone_mine: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 26 21 12" />
      <path d="M13 7c5-3 10-2 14 2l-5 5c-3-3-5-5-9-7Z" />
      <path d="m18 21 4-4 5 4-2 6h-6l-3-3Z" />
    </svg>`,
  spring_of_life: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="m16 27-9-8.5C2 13.5 5 6 11 6c3 0 5 2 5 4 0-2 2-4 5-4 6 0 9 7.5 4 12.5L16 27Z" />
    </svg>`,
  potato_farm: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M12 12c4-3 11-1 13 4 2 6-2 11-8 11-6 0-10-4-9-9 0-3 1-5 4-6Z" />
      <path d="M16 12c-1-4-4-6-7-6 1 4 3 6 7 6Z" />
      <path d="M16 11c2-4 5-5 8-4-2 3-4 5-8 4Z" />
      <circle cx="13" cy="18" r="1" />
      <circle cx="20" cy="21" r="1" />
    </svg>`,
  preemptive_strike: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="15" cy="17" r="9" />
      <circle cx="15" cy="17" r="4" />
      <path d="m18 14 9-9" />
      <path d="m21 5 6 0 0 6" />
    </svg>`,
  blood_altar: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 4c-2 4-5 7-5 11a5 5 0 0 0 10 0c0-4-3-7-5-11Z" />
      <path d="M10 22h12l3 5H7l3-5Z" />
    </svg>`,
  town: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="m4 15 12-9 12 9" />
      <path d="M7 14v13h18V14" />
      <path d="M13 27v-8h6v8M21 8V5h4v7" />
    </svg>`,
  abandoned_forge: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 15h17l5 4-5 4h-6v4h5M8 23h6v4H7" />
      <path d="m9 5 6 6M12 4l5 5M6 8l5-3" />
    </svg>`,
  wandering_witch: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="m7 19 9-15 9 15H7Z" />
      <path d="M4 22c7 2 17 2 24 0M12 14h9" />
      <path d="M13 25c0 3 6 3 6 0" />
    </svg>`,
  mirror_lake: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M22 4a7 7 0 1 0 5 11 8 8 0 0 1-5-11Z" />
      <path d="M4 20c3-2 6-2 9 0s6 2 9 0 5-2 7 0M4 25c3-2 6-2 9 0s6 2 9 0 5-2 7 0" />
      <path d="m8 8 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" />
    </svg>`,
  sealed_library: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 7h9c3 0 4 2 4 4v16c0-2-2-3-4-3H5V7Z" />
      <path d="M27 7h-9v20c0-2 2-3 4-3h5V7Z" />
      <rect x="13" y="13" width="6" height="6" rx="1" />
      <path d="M15 13v-1a1 1 0 0 1 2 0v1" />
    </svg>`,
  demon_beast_nest: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 23c4-3 7-4 11-4s7 1 11 4l-3 4H8l-3-4Z" />
      <path d="M11 18c-2-5 1-10 5-12 4 2 7 7 5 12" />
      <path d="M12 12c1 3 3 5 4 6M20 12c-1 3-3 5-4 6" />
    </svg>`,
  twisted_passage: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 27V6h7M27 27V6h-7" />
      <path d="M9 27c0-6 10-5 10-10 0-4-6-4-6-8" />
      <path d="m10 11 3-3 3 3M16 17h6M19 14l3 3-3 3" />
    </svg>`,
  ghost_merchant: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9 15c0-6 3-10 7-10s7 4 7 10v12l-3-3-4 3-4-3-3 3V15Z" />
      <circle cx="13" cy="15" r="1" />
      <circle cx="19" cy="15" r="1" />
      <circle cx="24" cy="8" r="3" />
    </svg>`,
  cursed_idol: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M10 9 6 5v8l4 3M22 9l4-4v8l-4 3" />
      <path d="M10 9h12v13l-6 5-6-5V9Z" />
      <path d="m12 14 3 2-3 2M20 14l-3 2 3 2M14 22h4" />
    </svg>`,
  abandoned_camp: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="m5 24 9-16 9 16H5Z" />
      <path d="M14 8v16M20 24h7" />
      <path d="m21 16 6 7M27 16l-6 7" />
    </svg>`,
  foggy_crossroads: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 6v22M7 9h16l4 4-4 4H7l-3-4 3-4Z" />
      <path d="M5 22h8M19 22h8M3 26h7M22 26h7" />
    </svg>`,
  moonlit_graveyard: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M22 4a7 7 0 1 0 5 11 8 8 0 0 1-5-11Z" />
      <path d="M7 27V16c0-4 3-7 7-7s7 3 7 7v11H7Z" />
      <path d="M11 17h6M14 14v6" />
    </svg>`,
  fallen_knight: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 17c1-7 5-11 9-11s8 4 9 11H7Z" />
      <path d="M9 17v5c2 4 12 4 14 0v-5M16 6v11" />
      <path d="m5 27 8-8M8 19l6 6" />
    </svg>`,
  mana_storm: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M25 9c-3-5-11-6-16-2s-5 12 0 16 13 3 16-2c3-4 1-9-3-11-3-2-8-1-10 2-2 3 0 7 3 8 3 2 7 0 7-3" />
      <path d="m17 8-3 7h4l-3 8" />
    </svg>`,
  monochrome_garden: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 15v13M8 19v9M24 19v9" />
      <circle cx="16" cy="10" r="4" />
      <circle cx="8" cy="15" r="3" />
      <circle cx="24" cy="15" r="3" />
      <path d="M13 23c-3-2-5-2-7-1M19 23c3-2 5-2 7-1" />
    </svg>`,
  gray_arcane_workbench: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 14h16l6 4-5 4h-6v4h5v2H9v-2h4v-4H8l-4-4Z" />
      <circle cx="22" cy="8" r="3" />
      <path d="M22 3v2M22 11v2M17 8h2M25 8h3" />
    </svg>`,
  nameless_instructor: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9 15c0-7 3-11 7-11s7 4 7 11l-7 6-7-6Z" />
      <path d="M11 12h10M12 16h8" />
      <path d="M5 28c1-6 5-10 11-10s10 4 11 10" />
      <path d="m10 22 6 5 6-5" />
    </svg>`,
  silent_war_drum: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="18" r="9" />
      <path d="m10 12 12 12M22 12 10 24" />
      <path d="M5 4l7 8M27 4l-7 8" />
    </svg>`,
  mercenary_guild_board: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 6h20v18H6Z" />
      <path d="M9 24v4M23 24v4" />
      <path d="M10 10h12v10H10Z" />
      <circle cx="16" cy="10" r="1" />
      <path d="M12 14h8M12 17h6" />
    </svg>`,
  backward_clock: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="17" cy="17" r="10"/><path d="M17 10v7l-5 3M8 7v6h6M8 13c2-6 9-10 15-6"/></svg>`,
  sealed_treasury: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 12h22v15H5ZM7 12l3-6h12l3 6M5 18h22"/><rect x="13" y="15" width="6" height="7" rx="1"/><path d="M16 17v3"/></svg>`,
  attacked_relic_merchant: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="12" cy="9" r="4"/><path d="M5 27c0-8 3-13 7-13s7 5 7 13M20 12h7v12h-9M22 12V9h3v3M23 17l-3 3 3 3"/></svg>`,
  cursed_gaming_table: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M6 8h20v17H6Z"/><circle cx="11" cy="13" r="1"/><circle cx="21" cy="20" r="1"/><circle cx="16" cy="16" r="1"/><path d="m8 5 3 3M24 5l-3 3M10 25l-2 4M22 25l2 4"/></svg>`,
  blood_chalice_altar: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 6h16c0 8-3 12-8 12S8 14 8 6ZM16 18v7M11 27h10"/><path d="M16 8c-2 3-3 4-3 6a3 3 0 0 0 6 0c0-2-1-3-3-6Z"/></svg>`,
  knight_memorial: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 15c1-7 4-11 8-11s7 4 8 11H8ZM10 15v5c2 4 10 4 12 0v-5M16 4v11"/><path d="M6 28 22 12M8 20l4 4"/></svg>`,
  beast_heart_shrine: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 27 6 17C1 10 9 4 16 11c7-7 15-1 10 6L16 27Z"/><path d="m10 5 3 5M22 5l-3 5M12 16l3-3 2 6 3-3"/></svg>`,
  forbidden_archive: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 6h9c3 0 4 2 4 4v17c0-2-2-3-4-3H5ZM27 6h-9v21c0-2 2-3 4-3h5Z"/><path d="m8 10 16 10M24 10 8 20"/></svg>`,
  watching_statue: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M6 14c5-7 15-7 20 0-5 7-15 7-20 0Z"/><circle cx="16" cy="14" r="4"/><path d="M10 22h12l3 6H7l3-6Z"/></svg>`,
  shattered_mirror: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3C9 5 6 10 7 17c1 6 4 10 9 12 5-2 8-6 9-12 1-7-2-12-9-14Z"/><path d="m16 4-3 8 5 3-6 6 4 7M18 15l6 6M8 18l5 1"/></svg>`,
  toll_bridge: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M3 23h26M6 23c2-8 6-12 10-12s8 4 10 12M8 23V12M24 23V12"/><circle cx="16" cy="7" r="4"/><path d="M16 5v4"/></svg>`,
  buried_purse: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M9 15h14l3 5c0 5-4 8-10 8S6 25 6 20l3-5ZM11 15l2-5h6l2 5"/><path d="M5 5l9 9M3 8l5-5"/></svg>`,
  traveling_auction: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="m7 8 7 7M12 3l7 7-5 5-7-7 5-5ZM15 14l11 11M20 25h8v3h-8Z"/></svg>`,
  broken_caravan: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 9h18l5 8v7H8L4 19V9ZM22 10v8h5"/><circle cx="10" cy="25" r="3"/><path d="M20 22l6 6M26 22l-6 6"/></svg>`,
  golden_fountain: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M6 25h20l-2 4H8l-2-4ZM9 21h14v4M16 5v16M10 10c0 4 2 6 6 6M22 10c0 4-2 6-6 6"/><circle cx="16" cy="5" r="2"/></svg>`,
  mercenary_wager: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 6l21 21M27 6 6 27M8 5l-3 3M24 5l3 3"/><circle cx="16" cy="17" r="5"/><path d="M16 14v6"/></svg>`,
  tax_collector_camp: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 5h15v22H7Z"/><path d="M11 10h7M11 14h7M11 18h5"/><circle cx="24" cy="22" r="5"/><path d="M24 19v6"/></svg>`,
  roadside_alchemist: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M12 4h8M14 4v8L7 25c-1 2 1 3 3 3h12c2 0 4-1 3-3l-7-13V4"/><path d="M10 22h12M13 18c2 2 4 2 6 0"/></svg>`,
  roadside_shrine: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 8h22M8 4h16M9 8v20M23 8v20M9 13h14"/><path d="M13 28v-9h6v9M16 15v3"/></svg>`,
  frozen_spring: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4c-4 6-7 9-7 14a7 7 0 0 0 14 0c0-5-3-8-7-14Z"/><path d="M16 10v14M10 14l12 8M22 14l-12 8"/></svg>`,
  warm_bathhouse: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 18h22v5c0 3-3 5-6 5H11c-3 0-6-2-6-5v-5Z"/><path d="M10 15c-3-3 3-4 0-8M16 15c-3-3 3-4 0-8M22 15c-3-3 3-4 0-8"/></svg>`,
  mana_well: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="10" rx="10" ry="5"/><path d="M6 10v14c0 3 20 3 20 0V10M10 27h12"/><path d="m16 10-2 5h4l-3 6"/></svg>`,
  moon_herb_patch: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M22 4a8 8 0 1 0 5 13 9 9 0 0 1-5-13Z"/><path d="M8 28c1-9 4-13 9-15M10 22c-4 0-6-2-6-5 4 0 7 1 8 4M13 18c0-4 2-7 6-8 0 4-2 7-6 8Z"/></svg>`,
  training_effigy: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="7" r="4"/><path d="M16 11v17M7 14h18M10 28h12"/><path d="m8 11-3 3 3 3M24 11l3 3-3 3"/></svg>`,
  howling_wind_tunnel: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 9h15c5 0 5-6 1-6-3 0-4 2-4 4M4 15h22c5 0 5 7 0 7-3 0-4-2-4-4M4 21h11c5 0 5 7 1 7-3 0-4-2-4-4"/></svg>`,
  weight_gate: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 28V5h22v23M9 28V10h14v18"/><path d="M16 9v12M10 14h12M10 14l-3 7h6l-3-7ZM22 14l-3 7h6l-3-7Z"/></svg>`,
  dueling_circle: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13"/><path d="M8 7l17 18M24 7 7 24M10 6 6 10M22 6l4 4"/></svg>`,
  broken_spell_circle: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M12 4A12 12 0 0 0 5 22M20 28a12 12 0 0 0 7-18"/><path d="m16 6 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1 3-7Z"/><path d="M9 5l14 22"/></svg>`,
  lonely_watchtower: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M9 9h14l-2 19H11L9 9ZM7 4h18v5H7Z"/><path d="M12 16c2-3 6-3 8 0-2 3-6 3-8 0Z"/></svg>`,
  smuggler_tunnel: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 28V17C4 9 9 4 16 4s12 5 12 13v11M9 28V18c0-5 3-8 7-8s7 3 7 8v10"/><path d="M12 21h8v7h-8Z"/></svg>`,
  demon_tracks: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="21" rx="7" ry="6"/><circle cx="8" cy="12" r="3"/><circle cx="14" cy="8" r="3"/><circle cx="21" cy="9" r="3"/><circle cx="25" cy="15" r="3"/></svg>`,
  forked_milestone: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 6v22M6 8h16l4 4-4 4H6l-3-4 3-4ZM10 18h16l3 4-3 4H10l-4-4 4-4Z"/></svg>`,
  scout_camp: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="m5 26 10-19 10 19H5ZM15 7v19"/><path d="M18 13c4-3 8-2 10 1-2 4-6 5-10 2M23 13v4"/></svg>`,
  executioners_block: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 22h15l3 7H5l2-7ZM10 14h9v8h-9Z"/><path d="m11 4 16 8-3 6-16-8 3-6ZM18 12l-5 7"/></svg>`,
  black_contract: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 4h18v24H7Z"/><path d="M11 9h10M11 13h10M11 17h6"/><path d="m13 25 3-5 3 5M16 20v8"/></svg>`,
  unstable_portal: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M25 8c-5-6-15-4-18 3-3 8 4 16 12 15 7-1 10-9 6-14-3-4-10-4-12 1-2 4 2 8 6 7 3-1 4-5 1-7"/><path d="m7 5 3 2M25 24l3 3"/></svg>`,
  gray_comet_crater: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 25c5-5 17-5 22 0-5 5-17 5-22 0Z"/><circle cx="18" cy="15" r="5"/><path d="M3 5l11 7M8 3l8 7M3 11l10 3"/></svg>`,
  colorless_scale: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4v23M9 8h14M9 8 4 20h10L9 8ZM23 8l-5 12h10L23 8ZM10 28h12"/><circle cx="16" cy="6" r="2"/></svg>`,
  relic_shop: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 13h18v14H7Z" />
      <path d="M9 13c0-6 3-9 7-9s7 3 7 9" />
      <path d="m16 9-4 7 4 6 4-6-4-7Z" />
      <path d="M11 18h10M16 13v10" />
    </svg>`,
});

const CHARACTER_BATTLE_EFFECTS = window.VersusCharacterBattleEffects;
const EFFECT_CLASSES = [
  "normal-attack",
  "common-defense",
  "meditation",
  "hit",
  "shadow-hit",
  "miss",
  "defense",
  "heal",
  "resource-change",
  "buff",
  "debuff",
  "stack-gain",
  "stack-spend",
  ...(CHARACTER_BATTLE_EFFECTS?.effectTypes?.() || []),
];
const MOTION_ONLY_EFFECT_TYPES = new Set([
  "hit",
  "shadow-hit",
  "miss",
  "defense",
  "heal",
  "resource-change",
  "buff",
  "debuff",
  "stack-gain",
  "stack-spend",
]);
const EFFECT_SFX = {
  "normal-attack": localAssetUrl("/assets/sfx/hit.wav"),
  "common-defense": localAssetUrl("/assets/sfx/defense.wav"),
  meditation: localAssetUrl("/assets/sfx/buff.wav"),
  hit: localAssetUrl("/assets/sfx/hit.wav"),
  "shadow-hit": localAssetUrl("/assets/sfx/hit.wav"),
  miss: localAssetUrl("/assets/sfx/miss.wav"),
  defense: localAssetUrl("/assets/sfx/defense.wav"),
  heal: localAssetUrl("/assets/sfx/heal.wav"),
  buff: localAssetUrl("/assets/sfx/buff.wav"),
  debuff: localAssetUrl("/assets/sfx/debuff.wav"),
  "stack-gain": localAssetUrl("/assets/sfx/stack-gain.wav"),
  "stack-spend": localAssetUrl("/assets/sfx/stack-spend.wav"),
  ...Object.fromEntries(
    Object.entries(CHARACTER_BATTLE_EFFECTS?.sfxEntries?.() || {})
      .map(([type, path]) => [type, localAssetUrl(path)]),
  ),
};
const BGM_TRACKS = {
  fight: { src: localAssetUrl("/assets/bgm/fight.mp3"), loop: true, gain: 1 },
  deep: { src: localAssetUrl("/assets/bgm/deep.mp3"), loop: true, gain: 1 },
  boss: { src: localAssetUrl("/assets/bgm/boss.mp3"), loop: true, gain: 1 },
  village: { src: localAssetUrl("/assets/bgm/village.mp3"), loop: true, gain: 1 },
  event: { src: localAssetUrl("/assets/bgm/event.mp3"), loop: true, gain: 1, preload: false },
  prologue: { src: localAssetUrl("/assets/bgm/prologue.mp3"), loop: true, gain: 1, preload: false },
  clear: { src: localAssetUrl("/assets/bgm/clear.mp3"), loop: false, gain: 1.2 },
  victory: { src: localAssetUrl("/assets/bgm/victory.wav"), loop: false, gain: 1.3 },
  defeat: { src: localAssetUrl("/assets/bgm/defeat.wav"), loop: false, gain: 1.2 },
  draw: { src: localAssetUrl("/assets/bgm/draw.wav"), loop: false, gain: 1.1 },
};
const DEFENSE_ACTION_NAMES = new Set(["일반 방어", "가로막는 불길", "절대영도", "깨져버린 거울", "빠져드는 모래늪"]);

const state = {
  options: null,
  battle: null,
  battleMode: "pve",
  adventure: null,
  pvp: null,
  busy: false,
  selectedCodexIndex: 0,
  turnLogs: [],
  currentLogIndex: -1,
  logToken: 0,
  logAnimating: false,
  adventureRestartRequested: false,
  adventureRestartConfirmResolve: null,
  adventureSave: null,
  customSelects: [],
  characterPickers: [],
  activeCharacterPicker: null,
  selectedInscriptionId: DEFAULT_INSCRIPTION_OPTIONS[0].id,
  effectTimers: [],
  spriteStateTokens: { player: 0, ai: 0 },
  preloadedSpriteUrls: new Set(),
  sfx: new Map(),
  bgm: new Map(),
  audioPrimed: false,
  bgmFadeTimers: [],
  currentBgm: null,
  currentBgmType: null,
  audioSettings: { ...DEFAULT_AUDIO_SETTINGS },
};

init();

async function init() {
  if (window.__VERSUS_MOBILE_RUNTIME__?.platform === "web") {
    els.exitButton.hidden = true;
  }
  state.audioSettings = loadAudioSettings();
  syncAudioSettingsControls();
  bindEvents();
  syncInscriptionPicker();
  setBattleMode("pve");
  renderEmptyBattle();
  renderEmptyActions();
  renderLog();
  await loadOptions();
}

function bindEvents() {
  els.openPlayButton.addEventListener("click", () => showScreen("play"));
  els.openAdventureButton.addEventListener("click", openAdventureMode);
  els.openBattleButton.addEventListener("click", () => openBattleMode("pve"));
  els.openPvpButton.addEventListener("click", () => openBattleMode("pvp"));
  els.openRulesButton.addEventListener("click", () => showScreen("rules"));
  els.openCodexButton.addEventListener("click", () => showScreen("codex"));
  els.openSettingsButton.addEventListener("click", () => showScreen("settings"));
  els.battleBackButton.addEventListener("click", leaveBattleScreen);
  els.rulesBackButton.addEventListener("click", () => showScreen("home"));
  els.codexBackButton.addEventListener("click", () => showScreen("home"));
  els.settingsBackButton.addEventListener("click", () => showScreen("home"));
  els.playBackButton.addEventListener("click", () => showScreen("home"));
  els.bgmVolumeSlider.addEventListener("input", () => setAudioVolume("bgm", els.bgmVolumeSlider.value));
  els.sfxVolumeSlider.addEventListener("input", () => setAudioVolume("sfx", els.sfxVolumeSlider.value));
  els.sfxVolumeSlider.addEventListener("change", () => playEffectSound("buff"));
  els.audioMuteButton.addEventListener("click", toggleAudioMuted);
  els.audioResetButton.addEventListener("click", resetAudioSettings);
  for (const tab of els.rulesTabs) {
    tab.addEventListener("click", () => selectRulesTab(tab.dataset.rulesTab));
    tab.addEventListener("keydown", handleRulesTabKeydown);
  }
  els.exitButton.addEventListener("click", exitApp);
  els.inscriptionButton.addEventListener("click", toggleInscriptionPopover);
  els.startButton.addEventListener("click", startConfiguredBattle);
  els.pvpRoomInput.addEventListener("input", previewSelectedMatch);
  els.prevLogButton.addEventListener("click", () => moveLog(-1));
  els.nextLogButton.addEventListener("click", () => moveLog(1));
  els.adventureRouteRerollButton.addEventListener("click", () => chooseAdventureChoice("route_reroll"));
  els.enemyInfoButton.addEventListener("click", () => openFighterInfo("ai"));
  els.battleRecordButton.addEventListener("click", openBattleRecords);
  els.playerInfoButton.addEventListener("click", () => openFighterInfo("player"));
  els.enemyInfoScrim.addEventListener("click", closeInfoModal);
  els.enemyInfoCloseButton.addEventListener("click", closeInfoModal);
  els.characterPickerScrim.addEventListener("click", closeCharacterPicker);
  els.characterPickerCloseButton.addEventListener("click", closeCharacterPicker);
  els.adventureRestartScrim.addEventListener("click", () => closeAdventureRestartConfirm(false));
  els.adventureRestartCancelButton.addEventListener("click", () => closeAdventureRestartConfirm(false));
  els.adventureRestartConfirmButton.addEventListener("click", () => closeAdventureRestartConfirm(true));
  document.addEventListener("click", closeCustomSelectsOnOutside);
  document.addEventListener("click", closeInscriptionPopoverOnOutside);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCustomSelects();
      closeInscriptionPopover();
      closeCharacterPicker();
      closeInfoModal();
      closeAdventureRestartConfirm(false);
    }
  });
  window.addEventListener("pagehide", notifyPvpLeaveOnPageHide);
}

function openBattleMode(mode) {
  els.pvpRoomInput.value = "";
  setBattleMode(mode);
  resetBattleScreen();
  previewSelectedMatch();
  showScreen("battle");
}

async function openAdventureMode() {
  els.pvpRoomInput.value = "";
  setBattleMode("adventure");
  resetBattleScreen();
  prepareAdventureSetup();
  showScreen("battle");
  state.adventureSave = AdventureSave?.loadAdventureSave(adventureStorage()) || null;
  if (!state.adventureSave) return;

  setBusy(true);
  clearLogs();
  els.turnChip.textContent = "CONTINUE";
  renderEmptyActions("저장된 여정을 불러오는 중");
  try {
    const data = await api("/api/adventure/restore", { save: state.adventureSave });
    if (AdventureSave.isAdventureTerminal(data.adventure)) {
      clearStoredAdventure();
      prepareAdventureSetup();
      return;
    }
    state.adventure = { ...data.adventure };
    state.battle = data;
    syncSetupFromBattle(data);
    renderBattle(data);
    playRestoredAdventureBgm(data);
    await pushTurnLog(restoredAdventureLogTitle(data), data.log?.length ? data.log : ["저장된 여정을 불러왔습니다."], false);
    await continueRestoredAdventureDialogue(data);
  } catch (error) {
    clearStoredAdventure();
    prepareAdventureSetup();
    clearLogs();
    pushTurnLog("오류", ["저장된 여정을 불러오지 못해 새 여정 준비 화면으로 돌아왔습니다.", error.message], false);
  } finally {
    if (state.adventureRestartRequested) {
      state.adventureRestartRequested = false;
      state.busy = false;
      document.body.classList.remove("is-waiting");
      syncSetupLock();
      await startAdventure();
    } else {
      setBusy(false);
    }
  }
}

function prepareAdventureSetup() {
  state.battle = null;
  state.adventure = {
    stage: 1,
    totalStages: 20,
    phase: "setup",
    gold: 20,
  };
  previewSelectedMatch();
  els.turnChip.textContent = "PROLOGUE";
  pushTurnLog("Adventure", ["캐릭터를 고르고 새 여정을 시작하세요."], false);
  renderEmptyActions("새 여정을 시작하세요.");
}

async function continueRestoredAdventureDialogue(data) {
  const phase = data.adventure?.phase;
  const dialogue = data.adventure?.dialogue;
  if (!Array.isArray(dialogue?.lines) || !dialogue.lines.length) return;

  if (phase === "final_battle_dialogue") {
    await pushDialogueLog(dialogue.title || "전투 전 · 모노크렘", dialogue.lines);
    if (state.adventureRestartRequested) return;
    await sleep(FINAL_BATTLE_DIALOGUE_HOLD_MS);
    if (state.adventureRestartRequested) return;
    const battleData = await adventureChoiceRequest({ choiceId: "complete_final_battle_dialogue" });
    if (state.adventureRestartRequested) return;
    state.battle = battleData;
    state.adventure = { ...battleData.adventure };
    renderEmptyActions("최종 결전을 시작하는 중");
    await pushTurnLog(`STAGE ${battleData.adventure.stage}`, battleData.log, true);
    if (state.adventureRestartRequested) return;
    renderBattle(battleData);
    return;
  }

  if (phase === "final_battle_ending") {
    playBgm("clear", 300);
    await pushDialogueLog(dialogue.title || "전투 후 · 모노크렘", dialogue.lines);
    if (state.adventureRestartRequested) return;
    const completeData = await adventureChoiceRequest({ choiceId: "complete_final_battle_ending" });
    if (state.adventureRestartRequested) return;
    state.battle = completeData;
    state.adventure = { ...completeData.adventure };
    syncSetupLock();
    renderBattle(completeData);
  }
}

function playRestoredAdventureBgm(data) {
  const phase = data.adventure?.phase;
  if (phase === "prologue") return playBgm("prologue", 300);
  if (phase === "battle" || phase === "final_battle_dialogue") {
    return playBgm(adventureBattleBgm(data.adventure), 300);
  }
  if (phase === "final_battle_ending" || phase === "complete") return playBgm("clear", 300);
  if (phase === "defeat") return playBgm("defeat", 300);
  if (phase === "event") {
    return playBgm(data.adventure?.currentEvent?.bgm === "village" ? "village" : "event", 300);
  }
  return playBgm("village", 300);
}

function adventureBattleBgm(adventure) {
  if (adventure?.isFinalBattle) return "boss";
  if (adventure?.isMirrorBattle || adventure?.isOfficerBattle || adventure?.monster?.officer) return "deep";
  return "fight";
}

function restoredAdventureLogTitle(data) {
  const phase = data.adventure?.phase;
  if (phase === "prologue") return "PROLOGUE";
  if (phase === "event") return data.adventure?.currentEvent?.name || "이벤트";
  if (phase === "town") return "마을";
  return `STAGE ${data.adventure?.stage || 1} · 이어하기`;
}

function resetBattleScreen() {
  stopPvpPolling();
  state.battle = null;
  state.adventure = null;
  state.pvp = null;
  state.busy = false;
  state.adventureRestartRequested = false;
  document.body.classList.remove("is-waiting");
  closeCustomSelects();
  closeInscriptionPopover();
  closeCharacterPicker();
  closeInfoModal();
  resetCharacterSelections();
  resetInscriptionSelection();
  clearLogs();
  renderEmptyBattle();
  renderEmptyActions();
  syncSetupLock();
}

function resetCharacterSelections() {
  els.playerSelect.value = "random";
  els.aiSelect.value = "random";
  syncAllCustomSelects();
}

function resetInscriptionSelection() {
  state.selectedInscriptionId = inscriptionOptions()[0].id;
  syncInscriptionPicker();
}

function inscriptionOptions() {
  const options = state.options?.inscriptions;
  if (!Array.isArray(options) || !options.length) return DEFAULT_INSCRIPTION_OPTIONS;
  return options.map((option) => ({
    id: option.id,
    color: option.color || "#aeb4bd",
    summary: option.summary || option.name || option.id,
    detail: option.detail || option.description || "효과 없음",
  }));
}

function findInscriptionOption(id = state.selectedInscriptionId) {
  const options = inscriptionOptions();
  return options.find((option) => option.id === id) || options[0];
}

function toggleInscriptionPopover(event) {
  event.stopPropagation();
  if (els.inscriptionButton.disabled) return;
  const shouldOpen = els.inscriptionPopover.hidden;
  closeCustomSelects();
  closeCharacterPicker();
  syncInscriptionPicker();
  els.inscriptionPopover.hidden = !shouldOpen;
  els.inscriptionButton.setAttribute("aria-expanded", String(shouldOpen));
}

function closeInscriptionPopover() {
  els.inscriptionPopover.hidden = true;
  els.inscriptionButton.setAttribute("aria-expanded", "false");
}

function closeInscriptionPopoverOnOutside(event) {
  if (els.inscriptionButton.contains(event.target) || els.inscriptionPopover.contains(event.target)) {
    return;
  }
  closeInscriptionPopover();
}

function syncInscriptionPicker() {
  const selected = findInscriptionOption();
  els.inscriptionButton.style.setProperty("--inscription-color", selected.color);
  els.inscriptionButton.dataset.inscriptionId = selected.id;
  els.inscriptionButton.setAttribute("aria-label", `각인: ${selected.summary}`);
  els.inscriptionButton.removeAttribute("title");

  els.inscriptionPopover.innerHTML = "";
  for (const option of inscriptionOptions()) {
    const item = document.createElement("button");
    const isSelected = option.id === selected.id;
    item.type = "button";
    item.className = `inscription-option${isSelected ? " is-selected" : ""}`;
    item.style.setProperty("--inscription-color", option.color);
    item.dataset.inscriptionId = option.id;
    item.setAttribute("aria-label", `각인: ${option.summary}. ${option.detail}`);
    if (isSelected) {
      item.setAttribute("aria-current", "true");
    }
    item.innerHTML = `
      <span class="inscription-gem" aria-hidden="true"></span>
      <span class="inscription-option-copy">
        <strong>${escapeHtml(option.summary)}</strong>
        <span>${escapeHtml(option.detail)}</span>
      </span>
    `;
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      state.selectedInscriptionId = option.id;
      syncInscriptionPicker();
      closeInscriptionPopover();
      els.inscriptionButton.focus();
    });
    els.inscriptionPopover.append(item);
  }
}

function prepareSfx() {
  if (state.sfx.size) return;
  for (const [type, src] of Object.entries(EFFECT_SFX)) {
    const pool = Array.from({ length: SFX_POOL_SIZE }, () => {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = effectiveSfxVolume();
      return audio;
    });
    state.sfx.set(type, { pool, cursor: 0 });
  }
}

function primeSfx() {
  prepareSfx();
  for (const { pool } of state.sfx.values()) {
    for (const audio of pool) {
      audio.load();
    }
  }
}

function prepareBgm() {
  if (state.bgm.size) return;
  for (const [type, track] of Object.entries(BGM_TRACKS)) {
    const audio = new Audio(track.src);
    audio.preload = track.preload === false ? "none" : "auto";
    audio.loop = Boolean(track.loop);
    audio.volume = effectiveBgmVolume(track);
    state.bgm.set(type, audio);
  }
}

function primeAudio() {
  if (state.audioPrimed) return;
  primeSfx();
  prepareBgm();
  for (const [type, audio] of state.bgm.entries()) {
    if (BGM_TRACKS[type]?.preload !== false) audio.load();
  }
  state.audioPrimed = true;
}

function loadAudioSettings() {
  try {
    const stored = window.localStorage.getItem(AUDIO_SETTINGS_KEY);
    return stored ? normalizeAudioSettings(JSON.parse(stored)) : { ...DEFAULT_AUDIO_SETTINGS };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

function saveAudioSettings() {
  try {
    window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(state.audioSettings));
  } catch {
    // Settings still work for this session when storage is unavailable.
  }
}

function normalizeAudioSettings(settings) {
  return {
    bgm: normalizeAudioVolume(settings?.bgm, DEFAULT_AUDIO_SETTINGS.bgm),
    sfx: normalizeAudioVolume(settings?.sfx, DEFAULT_AUDIO_SETTINGS.sfx),
    muted: settings?.muted === true,
  };
}

function normalizeAudioVolume(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
}

function setAudioVolume(type, percentage) {
  if (!Object.hasOwn(DEFAULT_AUDIO_SETTINGS, type) || type === "muted") return;
  state.audioSettings[type] = normalizeAudioVolume(Number(percentage) / 100, DEFAULT_AUDIO_SETTINGS[type]);
  syncAudioSettingsControls();
  applyAudioSettings();
  saveAudioSettings();
}

function toggleAudioMuted() {
  state.audioSettings.muted = !state.audioSettings.muted;
  syncAudioSettingsControls();
  applyAudioSettings();
  saveAudioSettings();
  if (!state.audioSettings.muted) playEffectSound("buff");
}

function resetAudioSettings() {
  state.audioSettings = { ...DEFAULT_AUDIO_SETTINGS };
  syncAudioSettingsControls();
  applyAudioSettings();
  saveAudioSettings();
  playEffectSound("buff");
}

function syncAudioSettingsControls() {
  const bgmPercent = Math.round(state.audioSettings.bgm * 100);
  const sfxPercent = Math.round(state.audioSettings.sfx * 100);
  els.bgmVolumeSlider.value = String(bgmPercent);
  els.sfxVolumeSlider.value = String(sfxPercent);
  els.bgmVolumeValue.value = `${bgmPercent}%`;
  els.sfxVolumeValue.value = `${sfxPercent}%`;
  els.bgmVolumeSlider.style.setProperty("--range-progress", `${bgmPercent}%`);
  els.sfxVolumeSlider.style.setProperty("--range-progress", `${sfxPercent}%`);
  els.audioMuteButton.setAttribute("aria-pressed", String(state.audioSettings.muted));
  els.audioMuteButton.textContent = state.audioSettings.muted ? "음소거 해제" : "전체 음소거";
  els.audioMuteButton.classList.toggle("is-muted", state.audioSettings.muted);
  els.settingsScreen.classList.toggle("is-audio-muted", state.audioSettings.muted);
}

function applyAudioSettings() {
  for (const { pool } of state.sfx.values()) {
    for (const audio of pool) audio.volume = effectiveSfxVolume();
  }
  clearBgmFades();
  for (const [type, audio] of state.bgm.entries()) {
    audio.volume = effectiveBgmVolume(BGM_TRACKS[type]);
  }
}

function effectiveSfxVolume() {
  return state.audioSettings.muted ? 0 : state.audioSettings.sfx;
}

function effectiveBgmVolume(track) {
  if (state.audioSettings.muted) return 0;
  return Math.min(1, state.audioSettings.bgm * (track?.gain || 1));
}

function showScreen(name) {
  if (name !== "battle") {
    stopPvpPolling();
  }
  for (const screen of [els.homeScreen, els.playScreen, els.battleScreen, els.rulesScreen, els.codexScreen, els.settingsScreen]) {
    screen.classList.remove("is-active");
  }
  if (name === "play") {
    stopBgm();
    els.playScreen.classList.add("is-active");
  } else if (name === "battle") {
    els.battleScreen.classList.add("is-active");
  } else if (name === "codex") {
    primeAudio();
    playBgm("village");
    els.codexScreen.classList.add("is-active");
    renderCodex();
  } else if (name === "rules") {
    primeAudio();
    playBgm("village");
    els.rulesScreen.classList.add("is-active");
  } else if (name === "settings") {
    primeAudio();
    playBgm("village");
    syncAudioSettingsControls();
    els.settingsScreen.classList.add("is-active");
  } else {
    stopBgm();
    els.homeScreen.classList.add("is-active");
  }
}

const RULES_TAB_LABELS = Object.freeze({
  "how-to-play": "How to Play",
  adventure: "Adventure",
  pve: "PvE",
  pvp: "PvP",
});

function selectRulesTab(tabId, { focus = false } = {}) {
  const selectedId = RULES_TAB_LABELS[tabId] ? tabId : "how-to-play";
  for (const tab of els.rulesTabs) {
    const isSelected = tab.dataset.rulesTab === selectedId;
    tab.classList.toggle("is-selected", isSelected);
    tab.setAttribute("aria-selected", String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
    if (isSelected && focus) tab.focus();
  }
  for (const panel of els.rulesPanels) {
    panel.hidden = panel.dataset.rulesPanel !== selectedId;
  }
  els.rulesSubtitle.textContent = RULES_TAB_LABELS[selectedId];
  els.rulesContent.scrollTop = 0;
}

function handleRulesTabKeydown(event) {
  const currentIndex = els.rulesTabs.indexOf(event.currentTarget);
  if (currentIndex < 0) return;
  let nextIndex = currentIndex;
  if (["ArrowRight", "ArrowDown"].includes(event.key)) nextIndex = (currentIndex + 1) % els.rulesTabs.length;
  else if (["ArrowLeft", "ArrowUp"].includes(event.key)) nextIndex = (currentIndex - 1 + els.rulesTabs.length) % els.rulesTabs.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = els.rulesTabs.length - 1;
  else return;
  event.preventDefault();
  selectRulesTab(els.rulesTabs[nextIndex].dataset.rulesTab, { focus: true });
}

function leaveBattleScreen() {
  const request = currentPvpLeaveRequest();
  els.pvpRoomInput.value = "";
  showScreen("play");
  if (request) {
    state.battle = null;
    state.pvp = null;
    state.busy = false;
    document.body.classList.remove("is-waiting");
    syncSetupLock();
  }
  notifyPvpLeave(request);
}

function setBattleMode(mode) {
  state.battleMode = mode === "pvp" ? "pvp" : mode === "adventure" ? "adventure" : "pve";
  const isPvp = state.battleMode === "pvp";
  const isAdventure = state.battleMode === "adventure";
  if (!isPvp) {
    stopPvpPolling();
    state.pvp = null;
  }
  els.battleScreen.classList.toggle("is-pvp", isPvp);
  els.battleScreen.classList.toggle("is-pve", !isPvp && !isAdventure);
  els.battleScreen.classList.toggle("is-adventure", isAdventure);
  els.battleScreenTitle.textContent = isAdventure ? "Adventure" : "전투";
  for (const field of els.pveSetupFields) {
    field.hidden = isPvp || isAdventure;
  }
  for (const field of els.pvpSetupFields) {
    field.hidden = !isPvp;
  }
  els.startButton.hidden = false;
  els.startButton.textContent = isAdventure ? "새 여정" : isPvp ? "PvP 입장" : "전투 시작";
  syncSetupLock();
  previewSelectedMatch();
}

async function loadOptions() {
  try {
    const data = await api("/api/options");
    data.characters = sortCharacters((data.characters || []).map((character, index) => ({
      ...character,
      index: Number.isInteger(character.index) ? character.index : index,
    })));
    data.personalities = data.personalities || data.ai?.personalities || [];
    state.options = data;

    fillSelect(els.playerSelect, data.characters, "index", "name", true, "???");
    fillSelect(els.aiSelect, data.characters, "index", "name", true, "???");
    fillSelect(els.personalitySelect, data.personalities, "id", "name", true);

    for (const select of [els.playerSelect, els.aiSelect, els.personalitySelect]) {
      select.addEventListener("change", previewSelectedMatch);
    }
    enhanceCharacterSelect(els.playerSelect, "player", "내 캐릭터");
    enhanceCharacterSelect(els.aiSelect, "ai", "상대 캐릭터");
    enhanceSelect(els.personalitySelect);
    syncInscriptionPicker();
    previewSelectedMatch();
    renderCodex();
    await applyStartupHash();
  } catch (error) {
    pushTurnLog("오류", [`옵션 로드 실패: ${error.message}`], false);
  }
}

async function applyStartupHash() {
  const hash = window.location.hash.toLowerCase();
  if (hash === "#battle-start") {
    setBattleMode("pve");
    showScreen("battle");
    await startBattle();
  } else if (hash === "#pvp") {
    setBattleMode("pvp");
    showScreen("battle");
  } else if (hash === "#battle") {
    setBattleMode("pve");
    showScreen("battle");
  } else if (hash === "#codex") {
    showScreen("codex");
  } else if (hash === "#rules") {
    showScreen("rules");
  } else if (hash === "#settings") {
    showScreen("settings");
  }
}

function sortCharacters(characters) {
  return [...characters].sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
}

function fillSelect(select, items, valueKey = "index", textKey = "name", includeRandom = false, randomLabel = "RANDOM") {
  select.innerHTML = "";
  if (includeRandom) {
    const option = document.createElement("option");
    option.value = "random";
    option.textContent = randomLabel;
    select.append(option);
  }
  for (const item of items) {
    const option = document.createElement("option");
    option.value = item[valueKey];
    option.textContent = item[textKey];
    select.append(option);
  }
}

function enhanceCharacterSelect(select, side, label) {
  select.classList.add("native-select");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "character-picker-button";
  button.setAttribute("aria-haspopup", "dialog");
  select.insertAdjacentElement("afterend", button);

  const api = {
    select,
    side,
    label,
    button,
    sync: () => syncCharacterPickerButton(api),
  };
  state.characterPickers.push(api);
  api.sync();

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    closeInscriptionPopover();
    openCharacterPicker(api);
  });
  select.addEventListener("change", api.sync);
}

function syncCharacterPickerButton(api) {
  const { select, label, button } = api;
  const character = findCharacterByIndex(select.value);
  const selectedName = selectedText(select);
  button.style.setProperty("--character-color", character ? characterColor(character.id) : RANDOM_CHARACTER_COLOR);
  button.classList.toggle("is-random", !character);
  button.setAttribute("aria-label", `${label}: ${selectedName}`);
  button.disabled = select.disabled;
  button.innerHTML = `
    <span class="character-picker-button-copy">
      <strong>${escapeHtml(selectedName)}</strong>
    </span>
  `;
}

function openCharacterPicker(api) {
  state.activeCharacterPicker = api;
  closeCustomSelects();
  els.characterPickerTitle.textContent = `${api.label} 선택`;
  renderCharacterPickerGrid(api);
  els.characterPickerModal.hidden = false;
  window.requestAnimationFrame(() => {
    const selected = els.characterPickerGrid.querySelector(".character-picker-tile.is-selected");
    (selected || els.characterPickerCloseButton).focus();
  });
}

function closeCharacterPicker() {
  els.characterPickerModal.hidden = true;
  state.activeCharacterPicker = null;
}

function renderCharacterPickerGrid(api) {
  const selectedValue = String(api.select.value);
  const characters = state.options?.characters || [];
  const items = [
    { value: "random", name: "???", title: "무작위", character: null },
    ...characters.map((character) => ({
      value: String(character.index),
      name: character.name,
      title: character.title,
      character,
    })),
  ];

  els.characterPickerGrid.innerHTML = "";
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `character-picker-tile${item.value === selectedValue ? " is-selected" : ""}`;
    button.classList.toggle("is-random", !item.character);
    button.style.setProperty(
      "--character-color",
      item.character ? characterColor(item.character.id) : RANDOM_CHARACTER_COLOR,
    );
    button.setAttribute("aria-label", `${api.label}: ${item.name}`);
    if (item.value === selectedValue) {
      button.setAttribute("aria-current", "true");
    }
    button.innerHTML = `
      <span class="character-picker-tile-visual">
        ${characterPickerThumbHtml(item.character, api.side, item.value === "random")}
      </span>
      <strong>${escapeHtml(item.name)}</strong>
    `;
    button.addEventListener("click", () => {
      api.select.value = item.value;
      api.select.dispatchEvent(new Event("change", { bubbles: true }));
      closeCharacterPicker();
      api.button.focus();
    });
    els.characterPickerGrid.append(button);
  }
}

function enhanceSelect(select) {
  select.classList.add("native-select");
  const shell = document.createElement("div");
  shell.className = "custom-select";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "custom-select-button";
  const list = document.createElement("div");
  list.className = "custom-select-list";
  list.hidden = true;
  shell.append(button, list);
  select.insertAdjacentElement("afterend", shell);

  const api = {
    select,
    shell,
    button,
    list,
    sync: () => syncCustomSelect(select, button, list),
  };
  state.customSelects.push(api);
  api.sync();

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const shouldOpen = list.hidden;
    closeCustomSelects();
    closeInscriptionPopover();
    list.hidden = !shouldOpen;
  });
  select.addEventListener("change", api.sync);
}

function syncCustomSelect(select, button, list) {
  const selected = select.options[select.selectedIndex];
  button.textContent = selected?.textContent || "-";
  button.disabled = select.disabled;
  if (button.disabled) {
    list.hidden = true;
  }
  list.innerHTML = "";
  [...select.options].forEach((option) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `custom-select-option${option.selected ? " is-selected" : ""}`;
    item.textContent = option.textContent;
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      list.hidden = true;
    });
    list.append(item);
  });
}

function closeCustomSelects() {
  for (const item of state.customSelects) {
    item.list.hidden = true;
  }
}

function syncAllCustomSelects() {
  for (const item of state.customSelects) {
    item.sync();
  }
  for (const item of state.characterPickers) {
    item.sync();
  }
}

function closeCustomSelectsOnOutside(event) {
  if (state.customSelects.some((item) => item.shell.contains(event.target))) {
    return;
  }
  closeCustomSelects();
}

function syncSetupFromBattle(data) {
  const player = findCharacterByName(data.player?.name);
  const ai = findCharacterByName(data.ai?.name);
  if (player) {
    els.playerSelect.value = String(player.index);
  }
  if (ai) {
    els.aiSelect.value = String(ai.index);
  }
  if (data.personality?.id) {
    els.personalitySelect.value = data.personality.id;
  }
  if (data.player?.inscriptionId) {
    state.selectedInscriptionId = data.player.inscriptionId;
    syncInscriptionPicker();
  }
  syncAllCustomSelects();
}

function setMatchLabel(player, ai, personality) {
  const personalityLabel = document.createElement("span");
  personalityLabel.className = "match-personality";
  personalityLabel.textContent = ` · ${personality}`;
  els.matchLabel.replaceChildren(`${player} vs ${ai}`, personalityLabel);
}

function previewSelectedMatch() {
  const player = selectedText(els.playerSelect);
  if (state.battleMode === "adventure") {
    const stage = state.adventure?.stage || 1;
    const totalStages = state.adventure?.totalStages || 20;
    els.matchLabel.textContent = `${player} · STAGE ${stage} / ${totalStages}`;
    els.aiModeText.textContent = "ADVENTURE";
    return;
  }
  if (state.battleMode === "pvp") {
    setMatchLabel(player, "???", "PvP");
    els.aiModeText.textContent = "PvP";
    return;
  }
  const ai = selectedText(els.aiSelect);
  const personality = selectedText(els.personalitySelect);
  setMatchLabel(player, ai, personality);
  els.aiModeText.textContent = personality;
}

async function startConfiguredBattle() {
  if (
    state.battleMode === "adventure"
    && state.adventureSave
    && !await openAdventureRestartConfirm()
  ) {
    return;
  }
  if (
    state.battleMode === "adventure"
    && state.busy
    && ["final_battle_dialogue", "final_battle_ending"].includes(state.adventure?.phase)
  ) {
    requestAdventureRestart();
    return;
  }
  if (state.battleMode === "adventure") return startAdventure();
  return state.battleMode === "pvp" ? startPvpEntry() : startBattle();
}

function openAdventureRestartConfirm() {
  if (!els.adventureRestartModal.hidden || state.adventureRestartConfirmResolve) {
    return Promise.resolve(false);
  }
  closeCustomSelects();
  closeInscriptionPopover();
  closeCharacterPicker();
  closeInfoModal();
  els.adventureRestartModal.hidden = false;
  return new Promise((resolve) => {
    state.adventureRestartConfirmResolve = resolve;
    window.requestAnimationFrame(() => els.adventureRestartCancelButton.focus());
  });
}

function closeAdventureRestartConfirm(confirmed = false) {
  if (els.adventureRestartModal.hidden) return;
  els.adventureRestartModal.hidden = true;
  const resolve = state.adventureRestartConfirmResolve;
  state.adventureRestartConfirmResolve = null;
  if (resolve) resolve(Boolean(confirmed));
  if (!confirmed) els.startButton.focus();
}

async function startPvpEntry() {
  if (state.busy) return;
  const server = "";
  const room = normalizeRoomCode(els.pvpRoomInput.value);
  primeAudio();
  stopBgm(300);
  setBusy(true);
  clearLogs();
  try {
    const token = loadStoredPvpToken(server, room);
    state.pvp = {
      server,
      room,
      token,
      playerIndex: els.playerSelect.value,
      playerInscriptionId: state.selectedInscriptionId,
      lastLogSerial: 0,
      pollTimer: null,
      pollErrorShown: false,
    };
    const data = await pvpApi("/api/pvp/join", {
      roomCode: room,
      playerIndex: els.playerSelect.value,
      playerInscriptionId: state.selectedInscriptionId,
      token,
    });
    state.pvp.room = data.roomCode || room;
    state.pvp.token = data.token;
    saveStoredPvpToken(server, state.pvp.room, data.token);
    if (data.noticeLog?.length) {
      pushTurnLog("PvP 준비", data.noticeLog, false);
    }
    await handlePvpState(data, { animateLog: false });
    startPvpPolling();
  } catch (error) {
    stopPvpPolling();
    pushTurnLog("오류", [`PvP 입장 실패: ${error.message}`], false);
  } finally {
    setBusy(false);
  }
}

async function startBattle() {
  if (state.busy) return;
  stopPvpPolling();
  state.pvp = null;
  primeAudio();
  playBgm("fight", 300);
  setBusy(true);
  clearLogs();
  try {
    const payload = {
      playerIndex: els.playerSelect.value,
      aiIndex: els.aiSelect.value,
      personalityId: els.personalitySelect.value,
      playerInscriptionId: state.selectedInscriptionId,
    };
    const data = await api("/api/new", payload);
    state.battle = data;
    syncSetupFromBattle(data);
    renderBattle(data);
    await pushTurnLog("전투 시작", data.log, true);
  } catch (error) {
    stopBgm(300);
    pushTurnLog("오류", [`전투 시작 실패: ${error.message}`], false);
  } finally {
    setBusy(false);
  }
}

async function startAdventure() {
  if (state.busy) return;
  state.adventureRestartRequested = false;
  stopPvpPolling();
  state.pvp = null;
  primeAudio();
  playBgm("prologue", 300);
  setBusy(true);
  clearLogs();
  try {
    const start = {
      playerIndex: els.playerSelect.value,
      playerInscriptionId: state.selectedInscriptionId,
      seed: createAdventureSeed(),
    };
    const data = await newAdventureRequest(start);
    state.adventure = { ...data.adventure };
    state.battle = data;
    syncSetupFromBattle(data);
    renderBattle(data);
    await pushDialogueLog("PROLOGUE", data.log);
  } catch (error) {
    stopBgm(300);
    pushTurnLog("오류", [`새 여정 시작 실패: ${error.message}`], false);
  } finally {
    setBusy(false);
  }
}

async function chooseAction(actionNumber) {
  if (state.battleMode === "pvp") {
    return choosePvpAction(actionNumber);
  }
  if (state.busy || !state.battle || state.battle.is_over) return;
  primeAudio();
  setBusy(true);
  try {
    const previousTurn = state.battle.turn;
    const data = state.battleMode === "adventure"
      ? await adventureActionRequest({ action: actionNumber })
      : await api("/api/action", { action: actionNumber });
    const isGameOver = Boolean(data.is_over || data.gameOver);
    if (data.adventure) {
      state.adventure = { ...data.adventure };
    }
    const hasFinalBattleEnding = data.adventure?.phase === "final_battle_ending"
      && Array.isArray(data.adventure?.dialogue?.lines)
      && data.adventure.dialogue.lines.length > 0;
    if (hasFinalBattleEnding) syncSetupLock();
    await pushTurnLog(`TURN ${previousTurn}`, data.log, true, {
      settleEffects: isGameOver,
      syncState: true,
    });
    if (state.adventureRestartRequested) return;
    state.battle = data;
    renderBattle(data, { animateDefeat: isGameOver });
    if (hasFinalBattleEnding) {
      playBgm("clear", 300);
      await pushDialogueLog(
        data.adventure.dialogue.title || "전투 후 · 모노크렘",
        data.adventure.dialogue.lines,
      );
      if (state.adventureRestartRequested) return;
      const completeData = await adventureChoiceRequest({
        choiceId: "complete_final_battle_ending",
      });
      if (state.adventureRestartRequested) return;
      state.battle = completeData;
      state.adventure = { ...completeData.adventure };
      syncSetupLock();
      renderBattle(completeData);
    } else if (isGameOver) {
      playResultBgm(data, data.adventure?.phase === "reward" ? "village" : null);
    }
  } catch (error) {
    pushTurnLog("오류", [`행동 처리 실패: ${error.message}`], false);
  } finally {
    if (state.adventureRestartRequested) {
      state.adventureRestartRequested = false;
      state.busy = false;
      document.body.classList.remove("is-waiting");
      syncSetupLock();
      await startAdventure();
    } else {
      setBusy(false);
    }
  }
}

function requestAdventureRestart() {
  if (state.adventureRestartRequested) return;
  state.adventureRestartRequested = true;
  state.logToken += 1;
  state.logAnimating = false;
  renderEmptyActions("새 여정을 시작하는 중");
  renderLog();
  syncSetupLock();
}

async function chooseAdventureChoice(choiceId) {
  const previousPhase = state.adventure?.phase;
  if (state.busy || state.battleMode !== "adventure" || !["prologue", "reward", "route", "town", "event"].includes(previousPhase)) return;
  setBusy(true);
  try {
    const data = await adventureChoiceRequest({ choiceId });
    state.battle = data;
    state.adventure = { ...data.adventure };
    const hasFinalBattleDialogue = data.adventure?.phase === "final_battle_dialogue"
      && Array.isArray(data.adventure?.dialogue?.lines)
      && data.adventure.dialogue.lines.length > 0;
    renderEmptyActions(previousPhase === "prologue"
      ? "여정을 시작하는 중"
      : previousPhase === "reward"
        ? "보상을 적용하는 중"
        : "선택을 처리하는 중");
    const logTitle = hasFinalBattleDialogue
      ? "최종 결전"
      : data.adventure?.phase === "battle"
      ? `STAGE ${data.adventure.stage}`
      : data.adventure?.phase === "event" || previousPhase === "event"
      ? data.adventure?.currentEvent?.name || "이벤트"
      : previousPhase === "reward"
        ? "보상"
        : previousPhase === "route"
          ? "마을"
          : "식사";
    if (data.adventure?.phase === "town") playBgm("village", 300);
    if (data.adventure?.phase === "event") {
      playBgm(data.adventure.currentEvent?.bgm === "village" ? "village" : "event", 300);
    }
    if (hasFinalBattleDialogue) {
      playBgm("boss", 300);
      renderBattle(data);
    } else if (data.adventure?.phase === "battle") {
      playBgm(adventureBattleBgm(data.adventure), 300);
    }
    if (data.adventure?.phase === "defeat") playBgm("defeat", 300);
    await pushTurnLog(logTitle, data.log, true);
    if (state.adventureRestartRequested) return;
    renderBattle(data);
    if (hasFinalBattleDialogue) {
      await pushDialogueLog(
        data.adventure.dialogue.title || "전투 전 · 모노크렘",
        data.adventure.dialogue.lines,
      );
      if (state.adventureRestartRequested) return;
      await sleep(FINAL_BATTLE_DIALOGUE_HOLD_MS);
      if (state.adventureRestartRequested) return;
      const battleData = await adventureChoiceRequest({
        choiceId: "complete_final_battle_dialogue",
      });
      if (state.adventureRestartRequested) return;
      state.battle = battleData;
      state.adventure = { ...battleData.adventure };
      renderEmptyActions("최종 결전을 시작하는 중");
      await pushTurnLog(`STAGE ${battleData.adventure.stage}`, battleData.log, true);
      if (state.adventureRestartRequested) return;
      renderBattle(battleData);
    }
  } catch (error) {
    pushTurnLog("오류", [`Adventure 선택 실패: ${error.message}`], false);
  } finally {
    if (state.adventureRestartRequested) {
      state.adventureRestartRequested = false;
      state.busy = false;
      document.body.classList.remove("is-waiting");
      syncSetupLock();
      await startAdventure();
    } else {
      setBusy(false);
    }
  }
}

async function choosePvpAction(actionNumber) {
  if (
    state.busy ||
    !state.pvp ||
    !state.battle ||
    state.battle.is_over ||
    state.battle.selectionLocked ||
    !state.battle.started
  ) {
    return;
  }
  primeAudio();
  setBusy(true);
  try {
    const data = await pvpApi("/api/pvp/action", {
      roomCode: state.pvp.room,
      token: state.pvp.token,
      action: actionNumber,
      sinceLogSerial: state.pvp.lastLogSerial,
    });
    if (data.noticeLog?.length) {
      pushTurnLog("PvP 준비", data.noticeLog, false);
    }
    await handlePvpState(data, { animateLog: true });
  } catch (error) {
    if (isPvpSessionEndedError(error)) {
      forceHomeAfterPvpClose();
      return;
    }
    pushTurnLog("오류", [`PvP 행동 처리 실패: ${error.message}`], false);
  } finally {
    setBusy(false);
  }
}

async function handlePvpState(data, options = {}) {
  if (!state.pvp) return;
  if (data.closed || data.forceHome) {
    forceHomeAfterPvpClose();
    return;
  }
  data.pvp = true;
  syncSetupFromBattle(data);
  const previousTurn = state.battle?.turn || data.logTurn || data.turn || 0;
  const hasNewLog = data.log?.length && Number(data.logSerial || 0) > Number(state.pvp.lastLogSerial || 0);
  if (hasNewLog) {
    state.pvp.lastLogSerial = Number(data.logSerial || 0);
    const title = !data.started
      ? "PvP 준비"
      : Number(data.logTurn || 0) > 0
        ? `TURN ${data.logTurn || previousTurn}`
        : "PvP 전투 시작";
    await pushTurnLog(title, data.log, Boolean(options.animateLog), {
      settleEffects: Boolean(data.is_over || data.gameOver),
      syncState: Boolean(options.animateLog),
    });
  }
  state.battle = data;
  renderBattle(data, { animateDefeat: Boolean(options.animateLog && (data.is_over || data.gameOver)) });
  if (data.is_over || data.gameOver) {
    stopPvpPolling();
    playResultBgm(data);
  } else if (data.started) {
    playBgm("fight", 300);
  }
}

function startPvpPolling() {
  if (!state.pvp) return;
  stopPvpPolling();
  state.pvp.pollTimer = window.setInterval(pollPvpState, PVP_POLL_MS);
}

function stopPvpPolling() {
  if (state.pvp?.pollTimer) {
    window.clearInterval(state.pvp.pollTimer);
    state.pvp.pollTimer = null;
  }
}

function currentPvpLeaveRequest() {
  if (!shouldNotifyPvpLeave()) return null;
  return {
    server: state.pvp.server,
    body: {
      roomCode: state.pvp.room,
      token: state.pvp.token,
    },
  };
}

function shouldNotifyPvpLeave() {
  return state.battleMode === "pvp"
    && Boolean(state.pvp?.room && state.pvp?.token && state.battle)
    && !Boolean(state.battle.is_over || state.battle.gameOver);
}

async function notifyPvpLeave(request = currentPvpLeaveRequest()) {
  if (!request) return;
  try {
    await api("/api/pvp/leave", request.body, request.server);
  } catch {
    // Leaving the screen should not trap the player if the tunnel is already gone.
  }
}

function notifyPvpLeaveOnPageHide() {
  const request = currentPvpLeaveRequest();
  if (!request) return;
  const payload = JSON.stringify(request.body);
  const url = `${request.server}/api/pvp/leave`;
  if (navigator.sendBeacon) {
    try {
      navigator.sendBeacon(url, new Blob([payload], { type: "text/plain;charset=UTF-8" }));
      return;
    } catch {
      // Fall through to keepalive fetch.
    }
  }
  try {
    fetch(url, {
      method: "POST",
      body: payload,
      keepalive: true,
    });
  } catch {
    // Best effort only while the page is unloading.
  }
}

function forceHomeAfterPvpClose() {
  stopPvpPolling();
  state.battle = null;
  state.pvp = null;
  state.busy = false;
  document.body.classList.remove("is-waiting");
  syncSetupLock();
  showScreen("home");
}

function isPvpSessionEndedError(error) {
  const message = String(error?.message || "");
  return message.includes("PvP")
    && (message.includes("\uBC29") || message.includes("\uC778\uC99D") || /room|token/i.test(message));
}

async function pollPvpState() {
  if (state.busy || !state.pvp || state.battleMode !== "pvp") return;
  try {
    const data = await pvpApi("/api/pvp/state", {
      roomCode: state.pvp.room,
      token: state.pvp.token,
      sinceLogSerial: state.pvp.lastLogSerial,
    });
    state.pvp.pollErrorShown = false;
    await handlePvpState(data, { animateLog: true });
  } catch (error) {
    if (isPvpSessionEndedError(error)) {
      forceHomeAfterPvpClose();
      return;
    }
    if (state.pvp && !state.pvp.pollErrorShown) {
      state.pvp.pollErrorShown = true;
      pushTurnLog("오류", [`PvP 상태 확인 실패: ${error.message}`], false);
    }
  }
}

function renderEmptyBattle() {
  els.battleScreen.classList.remove("is-adventure-prologue");
  els.battleScreen.classList.remove("is-adventure-choice-phase");
  els.battleScreen.classList.remove("has-sprite-battle");
  const empty = {
    name: "-",
    title: "대기 중",
    hp: 0,
    max_hp: 0,
    mp: 0,
    max_mp: 0,
    atk: "-",
    defense: "-",
    spd: "-",
    status_text: "없음",
    battleLog: [],
  };
  renderFighter("player", { ...empty, title: "캐릭터 선택" });
  renderFighter("ai", empty);
  renderPassive(null);
  els.turnChip.textContent = "TURN -";
  els.enemyInfoButton.disabled = true;
  els.battleRecordButton.hidden = true;
  els.battleRecordButton.disabled = true;
  els.playerInfoButton.disabled = true;
}

function renderBattle(data, options = {}) {
  const adventure = data.adventure || (state.battleMode === "adventure" ? state.adventure : null);
  const isPrologue = adventure?.phase === "prologue";
  const isFinalBattleDialogue = adventure?.phase === "final_battle_dialogue";
  const isFinalBattleEnding = adventure?.phase === "final_battle_ending";
  els.battleScreen.classList.toggle("is-adventure-prologue", isPrologue);
  els.battleScreen.classList.toggle("has-sprite-battle", Boolean(
    !isPrologue
    && battleSpriteSrcForSubject(data.player, "player")
    && battleSpriteSrcForSubject(data.ai, "ai")
  ));
  renderFighter("player", data.player, adventure);
  if (isPrologue) {
    renderFighter("ai", {
      name: "팔레티아",
      title: "색을 잃어가는 대륙",
      hp: 0,
      max_hp: 0,
      mp: 0,
      max_mp: 0,
      atk: "-",
      defense: "-",
      spd: "-",
      status_text: "PROLOGUE",
    });
    renderAdventureScene(adventure.scene);
  } else {
    renderFighter("ai", data.ai, adventure);
  }
  renderPassive(data.player);
  const adventureChoices = (data.is_over || isPrologue) && Array.isArray(adventure?.choices) ? adventure.choices : [];
  if (adventure?.phase === "complete") {
    renderEmptyActions("여정을 마쳤습니다.");
  } else if (adventureChoices.length) {
    renderAdventureChoices(adventureChoices);
  } else if (["final_battle_dialogue", "final_battle_ending"].includes(adventure?.phase)) {
    renderEmptyActions(state.adventureRestartRequested ? "새 여정을 시작하는 중" : "대화 진행 중...");
  } else if (["town_complete", "event_complete"].includes(adventure?.phase)) {
    renderEmptyActions(adventure.phase === "event_complete"
      ? `${adventure.currentEvent?.name || "이벤트"}에서 떠났습니다.`
      : "마을에서 식사를 마쳤습니다.");
  } else {
    renderActions(data.actions || [], data.is_over);
  }
  renderBattleRecordButton(data);
  const isAdventureIntermission = ["prologue", "route", "town", "town_complete", "event", "event_complete", "complete"].includes(adventure?.phase);
  els.turnChip.textContent = adventure
    ? isPrologue
      ? "PROLOGUE"
      : isFinalBattleDialogue
      ? "FINAL BATTLE"
      : isFinalBattleEnding
      ? "ENDING"
      : adventure.phase === "complete"
      ? "여정 완료"
      : isAdventureIntermission
      ? `STAGE ${adventure.stage}`
      : data.is_over
      ? `STAGE ${adventure.stage} 종료`
      : `STAGE ${adventure.stage} · TURN ${data.turn}`
    : data.is_over
      ? `TURN ${data.turn} 종료`
      : `TURN ${data.turn}`;
  if (adventure) {
    const adventureLocation = isPrologue
      ? "PROLOGUE"
      : adventure.phase === "complete"
      ? "여정 완료"
      : adventure.phase === "route"
      ? "다음 행선지"
      : ["event", "event_complete"].includes(adventure.phase)
        ? adventure.currentEvent?.name || "이벤트"
        : "마을";
    if (isPrologue) {
      els.matchLabel.textContent = `${data.player.name} · PROLOGUE`;
    } else {
      setMatchLabel(
        data.player.name,
        isAdventureIntermission ? adventureLocation : `${data.ai.title} ${data.ai.name}`,
        `STAGE ${adventure.stage}`,
      );
    }
    els.aiModeText.textContent = isPrologue
      ? "PROLOGUE"
      : isFinalBattleDialogue
      ? "FINAL BATTLE"
      : isFinalBattleEnding
      ? "ENDING"
      : adventure.phase === "complete"
      ? "ADVENTURE COMPLETE"
      : `STAGE ${adventure.stage} / ${adventure.totalStages}`;
  } else if (data.pvp) {
    setMatchLabel(data.player.name, data.started ? data.ai.name : "???", "PvP");
    els.aiModeText.textContent = "PvP";
  } else {
    setMatchLabel(data.player.name, data.ai.name, data.personality.name);
    els.aiModeText.textContent = data.personality.name;
  }
  els.enemyInfoButton.disabled = isPrologue;
  els.playerInfoButton.disabled = false;
  renderPvpStatus(data);
  syncSetupLock();
  syncDefeatVisuals(data, options.animateDefeat);
}

function renderPvpStatus(data) {
  if (!data?.pvp) return;
  els.aiModeText.textContent = "PvP";
  setMatchLabel(data.player.name, data.started ? data.ai.name : "???", "PvP");
  if (!data.started) {
    els.turnChip.textContent = "PvP 대기";
    els.actionHint.textContent = "상대 입장 대기";
    renderEmptyActions("상대 입장 대기");
  } else if (data.selectionLocked) {
    els.actionHint.textContent = data.opponentReady ? "턴 처리 중" : "상대 선택 대기";
  } else if (!data.is_over && !data.gameOver) {
    els.actionHint.textContent = "행동 선택";
  }
}

function renderFighter(side, fighter, adventure = null) {
  const ids = fighterIds[side];
  const maxHp = fighter.max_hp ?? fighter.maxHp ?? 0;
  const maxMp = fighter.max_mp ?? fighter.maxMp ?? 0;
  const defense = fighter.defense ?? fighter.stats?.def ?? "-";
  const stateText = fighter.status_text || fighter.stateText || "없음";
  const avatar = document.querySelector(ids.avatar);
  avatar.classList.remove("is-adventure-scene");
  avatar.classList.toggle("is-adventure-monochrome", side === "ai" && Boolean(adventure));
  avatar.classList.toggle("is-adventure-mirror", side === "ai" && Boolean(adventure?.isMirrorBattle));
  document.querySelector(ids.sideName).textContent = fighter.name;
  document.querySelector(ids.sideTitle).textContent = fighter.title || "";
  avatar.style.setProperty("--character-color", characterColor(fighter.id));
  const battleSpriteSrc = battleSpriteSrcForSubject(fighter, side);
  const fighterVisual = battleSpriteSrc
    ? battleSpriteHtml(fighter, side, battleSpriteSrc)
    : avatarSvg(fighter.name || fighter.id || "?", side, {
      monochrome: side === "ai" && Boolean(adventure),
    });
  avatar.classList.toggle("has-battle-sprite", Boolean(battleSpriteSrc));
  avatar.classList.toggle("is-empty", !fighterVisual);
  avatar.innerHTML = fighterVisual;
  preloadBattleSpriteStates(fighter);
  setBar(ids.hpBar, fighter.hp, maxHp);
  setBar(ids.mpBar, fighter.mp, maxMp);
  document.querySelector(ids.hpText).textContent = `${formatStat(fighter.hp)}/${formatStat(maxHp)}`;
  document.querySelector(ids.mpText).textContent = `${formatStat(fighter.mp)}/${formatStat(maxMp)}`;
  const statsElement = document.querySelector(ids.stats);
  statsElement.textContent = `ATK ${formatStat(fighter.atk)} / DEF ${formatStat(defense)} / SPD ${formatStat(fighter.spd)}`;
  if (side === "player" && Number.isFinite(Number(adventure?.gold))) {
    statsElement.append(" / ");
    const gold = document.createElement("span");
    gold.className = "adventure-gold";
    gold.textContent = `G ${formatStat(adventure.gold)}`;
    statsElement.append(gold);
  }
  document.querySelector(ids.state).textContent = stateText;
  hideInlineBattleRecord(ids.record);
}

function renderAdventureScene(scene) {
  const avatar = document.querySelector(fighterIds.ai.avatar);
  const illustration = String(scene?.illustration || "").trim();
  if (!illustration) return;
  avatar.classList.remove("is-empty");
  avatar.classList.add("is-adventure-scene");
  avatar.style.setProperty("--character-color", "#b46cff");
  avatar.innerHTML = `<img class="adventure-scene-illustration" src="${escapeHtml(localAssetUrl(illustration))}" alt="색을 잃어가는 팔레티아 대륙">`;
}

function hideInlineBattleRecord(selector) {
  const box = document.querySelector(selector);
  box.hidden = true;
  box.innerHTML = "";
}

function renderBattleRecordButton(data = state.battle) {
  const hasRecords = Boolean(data?.player?.battleLog?.length || data?.ai?.battleLog?.length);
  const adventure = data?.adventure || state.adventure;
  const isAdventure = state.battleMode === "adventure" && Boolean(adventure);
  const shouldShow = hasRecords || isAdventure;
  els.battleRecordButton.hidden = !shouldShow;
  els.battleRecordButton.disabled = !shouldShow;
}

function renderPassive(fighter) {
  els.passiveChip.hidden = true;
  els.passiveChip.innerHTML = "";
}

function setBar(selector, current, maximum) {
  const value = maximum > 0 ? Math.max(0, Math.min(100, (current / maximum) * 100)) : 0;
  document.querySelector(selector).style.width = `${value}%`;
}

function renderFighterVitals(side) {
  const fighter = state.battle?.[side];
  if (!fighter) return;
  const ids = fighterIds[side];
  const maxHp = fighter.max_hp ?? fighter.maxHp ?? 0;
  const maxMp = fighter.max_mp ?? fighter.maxMp ?? 0;
  setBar(ids.hpBar, fighter.hp, maxHp);
  setBar(ids.mpBar, fighter.mp, maxMp);
  document.querySelector(ids.hpText).textContent = `${formatStat(fighter.hp)}/${formatStat(maxHp)}`;
  document.querySelector(ids.mpText).textContent = `${formatStat(fighter.mp)}/${formatStat(maxMp)}`;
}

function syncDefeatVisuals(data = state.battle, animate = false) {
  for (const side of ["player", "ai"]) {
    const stage = document.querySelector(fighterIds[side].avatar);
    if (!stage) continue;
    stage.classList.remove("is-defeated");
    stage.classList.remove("is-defeat-pending");
  }
  if (!data?.is_over && !data?.gameOver) return;

  const loserSide = data.loser?.side?.toLowerCase?.() || (data.player?.hp <= 0 ? "player" : data.ai?.hp <= 0 ? "ai" : null);
  const stage = loserSide ? document.querySelector(fighterIds[loserSide]?.avatar) : null;
  if (!stage) return;
  if (!animate) {
    stage.classList.add("is-defeated");
    return;
  }

  stage.classList.add("is-defeat-pending");
  window.requestAnimationFrame(() => {
    stage.classList.add("is-defeated");
  });
}

function renderAdventureChoices(choices) {
  const availableChoices = Array.isArray(choices) ? choices : [];
  const visibleChoices = availableChoices.slice(0, 3);
  const isRewardSelection = visibleChoices.length > 0 && visibleChoices.every((choice) => choice.type === "reward");
  const isTownSelection = visibleChoices.length > 0 && visibleChoices.every((choice) => choice.type === "town_meal");
  const isEventSelection = visibleChoices.length > 0 && visibleChoices.every((choice) => choice.type === "event_choice");
  const isMirrorSelection = visibleChoices.length > 0 && visibleChoices.every((choice) => choice.type === "mirror_choice");
  const isPrologueSelection = visibleChoices.length === 1 && visibleChoices[0].id === "start_adventure";
  els.battleScreen.classList.add("is-adventure-choice-phase");
  els.actionsGrid.innerHTML = "";
  els.actionsGrid.classList.add("is-adventure-choices");
  els.actionHint.hidden = false;
  els.actionHint.textContent = isRewardSelection
    ? "전투 보상"
    : isPrologueSelection
      ? "PROLOGUE"
    : isMirrorSelection
      ? `마왕의 마경 · ${state.adventure?.routePrompt || "불온한 기운을 내뿜는 거울이 앞에 서 있다."}`
    : isTownSelection
      ? "마을"
      : isEventSelection
        ? state.adventure?.currentEvent?.name || "이벤트"
      : visibleChoices.length === 1
        ? "행선지"
        : "다음 갈 길";
  renderAdventureRouteControls();
  els.passiveChip.hidden = true;

  for (const choice of visibleChoices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `adventure-choice-button${visibleChoices.length === 1 ? " is-single" : ""}${isEventSelection || isMirrorSelection ? " is-event-choice" : ""}`;
    button.dataset.choiceId = choice.id;
    button.disabled = state.busy || Boolean(choice.disabled);
    if (choice.disabledReason) button.title = choice.disabledReason;
    const choiceDescription = choice.type === "destination"
      ? ""
      : [choice.description, choice.disabledReason].filter(Boolean).join(" · ");
    button.innerHTML = `
      <span class="adventure-choice-symbol${adventureChoiceSymbolSizeClass(choice)}" aria-hidden="true">${adventureChoiceSymbolHtml(choice)}</span>
      <span class="adventure-choice-copy">
        <strong>${escapeHtml(choice.title)}</strong>
        ${choiceDescription ? `<small>${escapeHtml(choiceDescription)}</small>` : ""}
      </span>
    `;
    button.addEventListener("click", () => {
      if (["reward", "destination", "town_meal", "event_choice", "mirror_choice"].includes(choice.type)) {
        chooseAdventureChoice(choice.id);
        return;
      }
      if (typeof choice.onSelect === "function") {
        choice.onSelect(choice);
        return;
      }
      pushTurnLog("선택", [`${choice.title} 선택 흐름은 다음 단계에서 연결된다.`], false);
    });
    els.actionsGrid.append(button);
  }
}

function renderAdventureRouteControls() {
  const rerollCount = Number(state.adventure?.routeRerollCount || 0);
  const canReroll = state.adventure?.phase === "route"
    && Number(state.adventure?.stage || 0) !== 12
    && rerollCount > 0;
  els.adventureRouteRerollButton.hidden = !canReroll;
  els.adventureRouteRerollButton.disabled = state.busy || !canReroll;
  els.adventureRouteRerollButton.textContent = rerollCount > 1
    ? `행선지 다시 뽑기 (${rerollCount})`
    : "행선지 다시 뽑기";
}

function adventureChoiceSymbolHtml(choice) {
  if (["destination", "mirror_choice"].includes(choice?.type) && ADVENTURE_DESTINATION_ICONS[choice.id]) {
    return ADVENTURE_DESTINATION_ICONS[choice.id];
  }
  return escapeHtml(choice?.symbol || "◆");
}

function adventureChoiceSymbolSizeClass(choice) {
  if (["destination", "mirror_choice"].includes(choice?.type) && ADVENTURE_DESTINATION_ICONS[choice.id]) return "";
  const length = [...String(choice?.symbol || "")].length;
  if (length >= 5) return " is-compact";
  if (length >= 4) return " is-wide";
  return "";
}

function renderActions(actions, isOver) {
  els.battleScreen.classList.remove("is-adventure-choice-phase");
  els.actionsGrid.innerHTML = "";
  els.actionsGrid.classList.remove("is-adventure-choices");
  els.adventureRouteRerollButton.hidden = true;
  if (!actions.length || isOver) {
    renderEmptyActions(isOver ? "전투 종료" : "전투 시작 전");
    els.actionHint.textContent = isOver ? "결과 확인" : "대기 중";
    return;
  }

  els.actionHint.textContent = "행동 선택";
  els.actionsGrid.append(createPassiveSlot(currentPlayerPassive()));

  const byNumber = new Map(actions.map((action) => [Number(action.number), action]));
  for (const number of [1, 2, 3, 4, 5, 6, 7]) {
    const action = byNumber.get(number);
    if (action) {
      els.actionsGrid.append(createActionButton(action));
    } else {
      els.actionsGrid.append(createEmptyActionSlot());
    }
  }
}

function createPassiveSlot(passive) {
  const slot = document.createElement("div");
  const disabled = !passive || state.busy || Boolean(state.battle?.selectionLocked);
  slot.className = `action-button passive-action${disabled ? " is-disabled" : ""}`;
  slot.tabIndex = disabled ? -1 : 0;
  slot.setAttribute("role", "button");
  slot.setAttribute("aria-disabled", disabled ? "true" : "false");
  slot.setAttribute("aria-label", passive ? `패시브: ${passive.name}` : "패시브");
  slot.innerHTML = `
    ${skillIconHtml(passive || { number: 0, name: "패시브" })}
    <span class="action-main">
      <span class="action-head">
        <span class="action-name">${escapeHtml(passive?.name || "패시브")}</span>
        <span class="action-cost passive-label">P</span>
      </span>
    </span>
    <p class="action-desc">${escapeHtml(passive?.description || "전투 시작 전")}</p>
  `;
  return slot;
}

function createActionButton(action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "action-button";
  button.disabled = !action.available || state.busy;
  button.addEventListener("click", () => chooseAction(action.number));
  button.innerHTML = `
    ${skillIconHtml(action)}
    <span class="action-main">
      <span class="action-head">
        <span class="action-name">${escapeHtml(action.name)}</span>
        <span class="action-cost">${escapeHtml(action.cost_text)}</span>
      </span>
    </span>
    <p class="action-desc">${escapeHtml(action.description)}</p>
  `;
  return button;
}

function createEmptyActionSlot() {
  const slot = document.createElement("div");
  slot.className = "action-button action-placeholder";
  slot.setAttribute("aria-hidden", "true");
  return slot;
}

function currentPlayerPassive() {
  const fighter = state.battle?.player;
  const character = fighter ? findCharacterForFighter(fighter) : null;
  const passive = fighter?.passive || character?.passive || null;
  if (!passive) return null;
  return {
    ...passive,
    number: 0,
    iconCharacterId: fighter?.passiveIconCharacterId || fighter?.activeCharacterId || fighter?.id || character?.id || null,
    transformed: Boolean(fighter?.passiveTransformed),
  };
}

function skillIconHtml(action) {
  return skillIconHtmlForCharacter(action, action?.iconCharacterId || currentPlayerCharacterId(), {
    transformed: Boolean(action?.transformed),
  });
}

function skillIconHtmlForCharacter(action, characterId, options = {}) {
  const meta = skillIconMeta(action, characterId);
  const glyph = meta.glyph || action.name.trim().slice(0, 1) || "?";
  const transformedClass = options.transformed || action?.transformed ? " skill-icon-transformed" : "";
  return `
    <span class="skill-icon ${meta.className}${transformedClass}" aria-hidden="true">
      ${meta.src
        ? `<img class="skill-icon-image" src="${escapeHtml(meta.src)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false;">`
        : ""}
      <span class="skill-symbol"${meta.src ? " hidden" : ""}>${escapeHtml(glyph)}</span>
    </span>
  `;
}

function skillIconMeta(action, characterId = currentPlayerCharacterId()) {
  const number = Number(action.number);
  const characterIcon = characterSkillIconSrc(characterId, number);
  if (characterIcon) {
    return {
      glyph: skillIconFallbackGlyph(action, number),
      className: skillIconClassForNumber(number),
      src: characterIcon,
    };
  }
  if (number === 0) return { glyph: "패", className: "skill-icon-passive" };
  const common = {
    1: { glyph: "공", className: "skill-icon-attack", src: localAssetUrl("/assets/actions/attack.webp") },
    2: { glyph: "방", className: "skill-icon-defense", src: localAssetUrl("/assets/actions/defense.webp") },
    3: { glyph: "명", className: "skill-icon-focus", src: localAssetUrl("/assets/actions/meditation.webp") },
  };
  if (common[number]) return common[number];
  return {
    glyph: skillIconFallbackGlyph(action, number),
    className: skillIconClassForNumber(number),
  };
}

function characterSkillIconSrc(characterId, number) {
  if (number >= 1 && number <= 3) return null;
  if (characterId === "xerox" && number === 8) return null;
  const assetGroup = CHARACTER_SKILL_ICON_IDS.has(characterId)
    ? "characters"
    : MONSTER_SKILL_ICON_IDS.has(characterId)
      ? "monsters"
      : null;
  if (!characterId || !assetGroup) return null;
  const fileName = number === 0 ? "passive" : `skill${number}`;
  return localAssetUrl(`/assets/${assetGroup}/${encodeURIComponent(characterId)}/skills/${fileName}.webp`);
}

function currentPlayerCharacterId() {
  const fighter = state.battle?.player;
  const character = fighter ? findCharacterForFighter(fighter) : null;
  return fighter?.id || character?.id || null;
}

function skillIconClassForNumber(number) {
  if (number === 0) return "skill-icon-passive";
  return {
    1: "skill-icon-attack",
    2: "skill-icon-defense",
    3: "skill-icon-focus",
    4: "skill-icon-q",
    5: "skill-icon-w",
    6: "skill-icon-e",
    7: "skill-icon-r",
  }[number] || "skill-icon-active";
}

function skillIconFallbackGlyph(action, number) {
  if (number === 0) return "패";
  return action.name.trim().slice(0, 1) || "?";
}

function renderEmptyActions(message = "전투 시작 전") {
  els.battleScreen.classList.remove("is-adventure-choice-phase");
  els.actionsGrid.classList.remove("is-adventure-choices");
  els.adventureRouteRerollButton.hidden = true;
  els.actionHint.hidden = true;
  els.actionsGrid.innerHTML = `<div class="empty-actions">${escapeHtml(message)}</div>`;
}

async function pushTurnLog(title, lines = [], animated, options = {}) {
  const entries = compactLogEntries(lines);
  const packet = {
    title,
    entries: entries.length ? entries : [{ text: "기록할 사건 없음", effect: null }],
    visibleCount: animated ? 0 : entries.length,
  };
  state.turnLogs.push(packet);
  state.currentLogIndex = state.turnLogs.length - 1;
  const token = ++state.logToken;
  state.logAnimating = Boolean(animated);
  renderLog({ follow: true });

  if (!animated) return;
  const delayMs = Number.isFinite(Number(options.delayMs))
    ? Math.max(0, Number(options.delayMs))
    : LOG_DELAY_MS;
  let playedEffect = false;
  let nextEntryDelayMs = delayMs;
  try {
    for (let index = 1; index <= packet.entries.length; index += 1) {
      await sleep(nextEntryDelayMs);
      if (token !== state.logToken) return;
      packet.visibleCount = index;
      renderLog({ follow: true });
      const entry = packet.entries[index - 1];
      playLogEffect(entry.effect);
      if (options.syncState) {
        applyLogStatePatch(entry.patch);
      }
      const effect = entry.effect;
      if (effect && effect.type !== "sprite-state") {
        playedEffect = true;
      }
      const impactDelayMs = Math.max(0, Number(effect?.impactDelayMs) || 0);
      nextEntryDelayMs = Math.max(
        delayMs,
        impactDelayMs > 0 ? impactDelayMs + LOG_EFFECT_IMPACT_LEAD_MS : 0,
      );
    }
    const finalEffect = packet.entries.at(-1)?.effect;
    if (finalEffect && finalEffect.type !== "sprite-state" && token === state.logToken) {
      const impactDelayMs = Math.max(0, Number(finalEffect.impactDelayMs) || 0);
      await sleep(impactDelayMs + LOG_EFFECT_TAIL_HOLD_MS);
    }
    if (options.settleEffects && playedEffect && token === state.logToken) {
      await sleep(EFFECT_SETTLE_MS);
    }
  } finally {
    if (token === state.logToken) {
      state.logAnimating = false;
      renderLog();
    }
  }
}

function pushDialogueLog(title, lines = []) {
  return pushTurnLog(title, lines, true, { delayMs: DIALOGUE_LOG_DELAY_MS });
}

function compactLogEntries(lines) {
  const result = [];
  let skippingInfo = false;
  const context = { actorName: null, actorSide: null, actionName: null, lineSide: null };
  for (const rawLine of lines || []) {
    let line = String(rawLine).trim();
    if (!line) continue;
    const sideTag = line.match(/^\[@(PLAYER|AI)\](.*)$/);
    context.lineSide = sideTag ? uiSideForBattleSide(sideTag[1]) : null;
    if (sideTag) line = sideTag[2].trim();
    if (line.includes("PLAYER 정보") || line.includes("AI 정보")) {
      skippingInfo = true;
      continue;
    }
    if (line.startsWith("━━━━━━━━")) {
      skippingInfo = false;
      continue;
    }
    if (skippingInfo) continue;
    if (line === "고유 상태" || line === "패시브" || line === "액티브") continue;
    if (line === "[행동 공개]" || line.startsWith("PLAYER 선택:") || line.startsWith("AI 선택:")) continue;
    if (line === "[행동 순서]") continue;
    if (line.startsWith("능력치:")) continue;
    if (line.includes("판정값")) continue;
    if (line.includes("선공 확률")) continue;
    if (line.includes("우선도") && line.includes("더 높다")) continue;
    if (line.includes("먼저 행동한다")) continue;
    if (line.includes("회피 확률")) continue;
    if (line.includes("명중률")) {
      if (line.includes("명중 판정 성공")) {
        const text = "→ 명중 판정 성공.";
        result.push({ text, effect: effectFromLogLine(text, context), patch: null });
      }
      continue;
    }
    if (/^\[[^\]]*판정\]$/.test(line)) continue;
    const polished = polishLogLine(line).replaceAll("⇒", "->");
    const effect = effectFromLogLine(polished, context);
    const patch = statePatchFromLogLine(polished, context);
    result.push({ text: polished, effect, patch });
  }
  return result;
}

function statePatchFromLogLine(line, context) {
  let match = line.match(/^(?:\d+타:\s*)?(.+?)에게 \d+의 피해\.(?: .*?HP (\d+)\s*(?:→|->)\s*(\d+))?/);
  if (match?.[2]) {
    return { fighterName: match[1], side: context.lineSide, hp: Number(match[3]) };
  }

  match = line.match(/^(.+?)(?:은|는) .+?로 \d+의 고정 피해를 입었다\. HP (\d+)\s*(?:→|->)\s*(\d+)/);
  if (match) {
    return { fighterName: match[1], side: context.lineSide, hp: Number(match[3]) };
  }

  match = line.match(/^(.+?) HP 회복 \d+\s*(?:→|->)\s*(\d+)/);
  if (match) {
    return { fighterName: match[1], side: context.lineSide, hp: Number(match[2]) };
  }

  match = line.match(/^(?:(.+?) )?MP \d+\s*(?:→|->)\s*(\d+)/);
  if (match) {
    return { fighterName: match[1] || context.actorName, side: context.lineSide || context.actorSide, mp: Number(match[2]) };
  }

  match = line.match(/^(.+?)(?:의)? HP (\d+)\s*(?:→|->)\s*(\d+)/);
  if (match) {
    return { fighterName: match[1], side: context.lineSide, hp: Number(match[3]) };
  }

  return null;
}

function applyLogStatePatch(patch) {
  if (!patch || !state.battle) return;
  const side = patch.side || sideForFighterName(patch.fighterName);
  const fighter = side ? state.battle[side] : null;
  if (!fighter) return;
  if (Number.isFinite(patch.hp)) {
    fighter.hp = Math.max(0, Math.min(fighter.max_hp ?? fighter.maxHp ?? patch.hp, patch.hp));
  }
  if (Number.isFinite(patch.mp)) {
    fighter.mp = Math.max(0, Math.min(fighter.max_mp ?? fighter.maxMp ?? patch.mp, patch.mp));
  }
  renderFighterVitals(side);
}

function resolveCharacterBattleEffect(phase, context, details = {}) {
  const actorId = context.actorSide ? state.battle?.[context.actorSide]?.id : null;
  if (!actorId) return undefined;
  return CHARACTER_BATTLE_EFFECTS?.resolve?.(actorId, phase, {
    ...details,
    actionName: context.actionName,
    actorName: context.actorName,
    actorSide: context.actorSide,
    battle: state.battle,
    logDelayMs: LOG_DELAY_MS,
    makeLogEffect,
    makeMissEffect,
    oppositeSide,
  });
}

function resolveStatusBattleEffect(statusName, phase, context, details = {}) {
  return CHARACTER_BATTLE_EFFECTS?.resolveStatus?.(statusName, phase, {
    ...details,
    actionName: context.actionName,
    actorName: context.actorName,
    actorSide: context.actorSide,
    battle: state.battle,
    makeLogEffect,
    oppositeSide,
  });
}

function effectFromLogLine(line, context) {
  const sectionMatch = line.match(/^\[(.+?)의 행동\]$/);
  if (sectionMatch) {
    context.actorName = sectionMatch[1];
    context.actorSide = context.lineSide || sideForFighterName(sectionMatch[1], context.actorSide);
    context.actionName = null;
    context.actionCostPending = false;
    return null;
  }

  const actionMatch = line.match(/^(.+?)(?:은|는) (.+?)(?:을|를) 사용했다\.$/);
  if (actionMatch) {
    const [, actorName, actionName] = actionMatch;
    context.actorName = actorName;
    context.actorSide = context.lineSide || sideForFighterName(actorName, context.actorSide);
    context.actionName = actionName;
    context.actionCostPending = true;
    if (actionName === "일반 공격") {
      return attachBattleSpriteActionState(null, context);
    }
    if (actionName === "일반 방어") {
      return attachBattleSpriteActionState(null, context);
    }
    if (actionName === "명상") {
      return attachBattleSpriteActionState(null, context);
    }
    const characterEffect = resolveCharacterBattleEffect("action", context);
    if (characterEffect !== undefined) return attachBattleSpriteActionState(characterEffect, context);
    if (DEFENSE_ACTION_NAMES.has(actionName)) {
      return attachBattleSpriteActionState(null, context);
    }
    return attachBattleSpriteActionState(null, context);
  }

  if (line === "빙결로 비공격 행동에 실패하고 빙결이 해제되었다.") {
    const statusEffect = resolveStatusBattleEffect("빙결", "statusFailure", context, {
      targetName: context.actorName,
      targetSide: context.actorSide || context.lineSide,
    });
    return statusEffect === undefined ? null : statusEffect;
  }

  if (line === "마비로 행동에 실패했다.") {
    const statusEffect = resolveStatusBattleEffect("마비", "statusFailure", context, {
      targetName: context.actorName,
      targetSide: context.actorSide || context.lineSide,
    });
    return statusEffect === undefined ? null : statusEffect;
  }

  if (line.includes("공격이 빗나갔다") || line.includes("공격이 회피되었다")) {
    return makeMissEffect(context.actorName, context.actorSide);
  }

  if (line.includes("명중 판정 성공")) {
    const characterEffect = resolveCharacterBattleEffect("accuracy", context, { success: true });
    if (characterEffect !== undefined) return characterEffect;
    return null;
  }

  if (line.startsWith("[방어] 성공.")) {
    const characterEffect = resolveCharacterBattleEffect("success", context);
    if (characterEffect !== undefined) return characterEffect;
    const effectType = context.actionName === "일반 방어" ? "common-defense" : "defense";
    return makeLogEffect(effectType, context.actorName, context.actorName, null, context.actorSide, context.actorSide);
  }

  let match = line.match(/^(.+?)의 ATK가 잔기를 소모할 때까지 x2가 된다\.$/);
  if (match) {
    context.actorName = match[1];
    context.actorSide = context.lineSide || sideForFighterName(match[1], context.actorSide);
    context.actionName = "죽을 힘을 다해";
    const characterEffect = resolveCharacterBattleEffect("success", context, { result: "desperate" });
    return characterEffect === undefined ? null : characterEffect;
  }

  match = line.match(/^현재 잔기 (\d+)\/8을 길동무 기준으로 기록했다\.$/);
  if (match) {
    context.actionName = "길동무";
    const characterEffect = resolveCharacterBattleEffect("success", context, {
      result: "companion",
      recordedLives: Number(match[1]),
    });
    return characterEffect === undefined ? null : characterEffect;
  }

  match = line.match(/^(.+?)의 잔기 (\d+)\/8 -> (\d+)\/8$/);
  if (match) {
    const targetName = match[1];
    const targetSide = context.lineSide || sideForFighterName(targetName, context.actorSide);
    const statusEffect = resolveStatusBattleEffect("잔기", "counterChange", context, {
      targetName,
      targetSide,
      before: Number(match[2]),
      after: Number(match[3]),
    });
    return statusEffect === undefined ? null : statusEffect;
  }

  match = line.match(/^(.+?)의 (ATK|DEF|SPD)(?:(?:이|가) (\d+)턴 동안 x([\d.]+)가 된다| x([\d.]+) 효과가 갱신되었다)\.$/);
  if (match) {
    const targetName = match[1];
    const targetSide = context.lineSide || sideForFighterName(targetName, context.actorSide);
    const characterEffect = resolveCharacterBattleEffect("statEffect", context, {
      targetName,
      targetSide,
      stat: match[2].toLowerCase(),
      turns: match[3] == null ? null : Number(match[3]),
      multiplier: Number(match[4] || match[5]),
    });
    if (characterEffect !== undefined) return characterEffect;
  }

  match = line.match(/^(.+?)의 그림자 병사 \d+이 공격 피해 (\d+)을 대신 받았다\.$/);
  if (match) {
    return Number(match[2]) > 0 ? makeLogEffect("shadow-hit", match[1], match[1], match[2], context.lineSide, context.actorSide) : null;
  }

  match = line.match(/^(?:\d+타:\s*)?(.+?)에게 (\d+)의 피해\./);
  if (match) {
    const damage = Number(match[2]);
    const characterEffect = resolveCharacterBattleEffect("damage", context, {
      targetName: match[1],
      targetSide: context.lineSide,
      damage,
    });
    if (characterEffect !== undefined) return characterEffect;
    const effectType = context.actionName === "일반 공격" ? "normal-attack" : "hit";
    return damage > 0 ? makeLogEffect(effectType, match[1], context.actorName, damage, context.lineSide, context.actorSide) : null;
  }

  match = line.match(/^(.+?)(?:은|는) (.+?)(?:으)?로 (\d+)의 고정 피해를 입었다\./);
  if (match) {
    const damage = Number(match[3]);
    const statusName = match[2].replace(/\s+\d+중첩$/, "");
    const statusEffect = resolveStatusBattleEffect(statusName, "statusDamage", context, {
      targetName: match[1],
      targetSide: context.lineSide,
      damage,
    });
    if (statusEffect !== undefined) return statusEffect;
    return damage > 0 ? makeLogEffect("hit", match[1], context.actorName, damage, context.lineSide, context.actorSide) : null;
  }

  match = line.match(/^(.+?) HP 회복 (\d+)\s*(?:→|->)\s*(\d+)/);
  if (match) {
    const amount = Number(match[3]) - Number(match[2]);
    const targetName = match[1];
    const targetSide = context.lineSide || sideForFighterName(targetName, context.actorSide);
    const characterEffect = resolveCharacterBattleEffect("heal", context, {
      targetName,
      targetSide,
      amount,
    });
    if (characterEffect !== undefined) return characterEffect;
    const effect = amount > 0 ? makeLogEffect("heal", match[1], match[1], amount, context.lineSide, context.lineSide) : null;
    return effect ? { ...effect, valueKind: "hp-gain" } : null;
  }

  match = line.match(/^(?:(.+?) )?MP (\d+)\s*(?:→|->)\s*(\d+)/);
  if (match) {
    const fighterName = match[1] || context.actorName;
    const beforeMp = Number(match[2]);
    const afterMp = Number(match[3]);
    const amount = afterMp - beforeMp;
    const isActionCost = amount < 0
      && context.actionCostPending
      && fighterName === context.actorName
      && !line.includes("(");
    context.actionCostPending = false;
    if (isActionCost) return null;
    if (context.actionName === "명상" && line.endsWith("(명상)")) {
      const effect = makeLogEffect("meditation", fighterName, fighterName, amount > 0 ? amount : null, context.actorSide, context.actorSide);
      return effect && amount > 0 ? { ...effect, valueKind: "mp-gain" } : effect;
    }
    const characterEffect = resolveCharacterBattleEffect("cost", context, {
      fighterName,
      beforeMp,
      afterMp,
      isActionCost: !match[1],
    });
    if (characterEffect !== undefined) return characterEffect;
    if (!fighterName || amount === 0) return null;
    const effect = makeLogEffect(
      amount > 0 ? "heal" : "resource-change",
      fighterName,
      fighterName,
      Math.abs(amount),
      context.lineSide,
      context.lineSide || context.actorSide,
    );
    return effect ? { ...effect, valueKind: amount > 0 ? "mp-gain" : "mp-loss" } : null;
  }

  match = line.match(/^(.+?)(?:의)? HP (\d+)\s*(?:→|->)\s*(\d+)/);
  if (match) {
    const amount = Number(match[3]) - Number(match[2]);
    if (amount === 0) return null;
    const effect = makeLogEffect(
      amount > 0 ? "heal" : "hit",
      match[1],
      match[1],
      Math.abs(amount),
      context.lineSide,
      context.lineSide,
    );
    return effect ? { ...effect, valueKind: amount > 0 ? "hp-gain" : "hp-loss" } : null;
  }

  match = line.match(/^(.+?)에게 (.+?) 상태가/);
  if (match) {
    return makeLogEffect("debuff", match[1], context.actorName, match[2], context.lineSide, context.actorSide);
  }

  match = line.match(/^(.+?)에게 (.+?) (\d+)중첩이/);
  if (match) {
    const [, targetName, stackName, amountText] = match;
    context.lastStackOwner = targetName;
    context.lastStackName = stackName;
    return makeLogEffect("stack-gain", targetName, context.actorName, `${stackName}+${amountText}`, context.lineSide, context.actorSide);
  }

  match = line.match(/^(.+?)의 (ATK|DEF|SPD).*x([0-9.]+)/);
  if (match) {
    const multiplier = Number(match[3]);
    return makeLogEffect(multiplier >= 1 ? "buff" : "debuff", match[1], match[1], match[2], context.lineSide, context.lineSide || context.actorSide);
  }

  match = line.match(/^(.+?)의 (ATK|DEF|SPD) \+([0-9.]+)배 \(현재 ([0-9.]+)배\)/);
  if (match) {
    return makeLogEffect("buff", match[1], match[1], `${match[2]} x${match[4]}`, context.lineSide, context.lineSide || context.actorSide);
  }

  match = line.match(/^(.+?)의 (ATK|DEF|SPD) ([+-][0-9.]+)% \(현재 ([0-9.]+)배\)/);
  if (match) {
    const change = Number(match[3]);
    return makeLogEffect(change >= 0 ? "buff" : "debuff", match[1], match[1], `${match[2]} ${match[3]}%`, context.lineSide, context.lineSide || context.actorSide);
  }

  match = line.match(/^(.+?)의 최대 (HP|MP) ([0-9.]+)\s*(?:→|->)\s*([0-9.]+)/);
  if (match) {
    const before = Number(match[3]);
    const after = Number(match[4]);
    if (before === after) return null;
    return makeLogEffect(after > before ? "buff" : "debuff", match[1], match[1], `최대 ${match[2]} ${before}→${after}`, context.lineSide, context.lineSide || context.actorSide);
  }

  match = line.match(/^(.+?)의 (MP 소모량 배율|위력 배율|명중률 보정|우선도 보정) (-?[0-9.]+)\s*(?:→|->)\s*(-?[0-9.]+)/);
  if (match) {
    const before = Number(match[3]);
    const after = Number(match[4]);
    const lowerIsBetter = match[2] === "MP 소모량 배율";
    const improved = lowerIsBetter ? after < before : after > before;
    const fighterName = state.battle?.[context.lineSide]?.name || context.actorName;
    return fighterName ? makeLogEffect(improved ? "buff" : "debuff", fighterName, fighterName, `${match[1]} ${match[2]}`, context.lineSide, context.lineSide || context.actorSide) : null;
  }

  match = line.match(/^(일반 공격|일반 방어|명상)의 (?:위력|추가 피해 경감률|추가 MP 회복량) /);
  if (match) {
    const fighterName = state.battle?.[context.lineSide]?.name || context.actorName;
    return fighterName ? makeLogEffect("buff", fighterName, fighterName, `${match[1]} 강화`, context.lineSide, context.lineSide || context.actorSide) : null;
  }

  match = line.match(/^(.+?)의 기본 MP 회복량 \+([0-9.]+) \(현재 \+([0-9.]+)\)/);
  if (match) {
    return makeLogEffect("buff", match[1], match[1], `MP 회복 +${match[3]}`, context.lineSide, context.lineSide || context.actorSide);
  }

  match = line.match(/^(.+?)의 매 턴 종료 HP 회복량 \+([0-9.]+) \(현재 \+([0-9.]+)\)/);
  if (match) {
    return makeLogEffect("buff", match[1], match[1], `턴 종료 HP +${match[3]}`, context.lineSide, context.lineSide || context.actorSide);
  }

  match = line.match(/^(.+?)의 최대 HP \+([0-9.]+)%/);
  if (match) {
    return makeLogEffect("buff", match[1], match[1], `최대 HP +${match[2]}%`, context.lineSide, context.lineSide || context.actorSide);
  }

  match = line.match(/^(.+?)의 전투 종료 HP 회복 (?:량|보정) ([+-][0-9.]+)%p \(현재 ([+-]?[0-9.]+)%p?\)/);
  if (match) {
    return makeLogEffect(Number(match[2]) >= 0 ? "buff" : "debuff", match[1], match[1], `전투 종료 HP ${match[3]}%`, context.lineSide, context.lineSide || context.actorSide);
  }

  match = line.match(/^(.+?)의 (.+?) MP 소모량이 ([0-9.]+)% (감소|증가)했다\. \(현재 ([0-9.]+)배\)/);
  if (match) {
    const effectType = match[4] === "감소" ? "buff" : "debuff";
    return makeLogEffect(effectType, match[1], match[1], `${match[2]} MP x${match[5]}`, context.lineSide, context.lineSide || context.actorSide);
  }

  match = line.match(/^(.+?)(?:에게|의|은|이) (?:다음|이후).*(?:적용|회복|소모량|공격 피해|전투 보상)/);
  if (match) {
    return makeLogEffect("buff", match[1], match[1], "여정 효과", context.lineSide, context.lineSide || context.actorSide);
  }

  match = line.match(/^(.+?)에게 (?:빠른|무거운|느린) 박자가 적용된다/);
  if (match) {
    return makeLogEffect("buff", match[1], match[1], "전투 리듬", context.lineSide, context.lineSide || context.actorSide);
  }

  match = line.match(/^(.+?)(?:이|가) (.+?)을 얻었다\./);
  if (match) {
    return makeLogEffect("buff", match[1], match[1], "유물", context.lineSide, context.lineSide || context.actorSide);
  }

  match = line.match(/^(.+?)의 (.+?) (\d+)(?:\/\d+)?\s*(?:→|->)\s*(\d+)(?:\/\d+)?(?:중첩)?/);
  if (match) {
    const [, targetName, stackName, beforeText, afterText] = match;
    const before = Number(beforeText);
    const after = Number(afterText);
    const targetSide = context.lineSide || sideForFighterName(targetName, context.actorSide);
    context.lastStackOwner = targetName;
    context.lastStackName = stackName;
    const statusEffect = resolveStatusBattleEffect(stackName, "counterChange", context, {
      targetName,
      targetSide,
      before,
      after,
    });
    if (statusEffect !== undefined) return statusEffect;
    if (after > before) {
      return makeLogEffect("stack-gain", targetName, targetName, `${stackName}+${after - before}`, targetSide, targetSide || context.actorSide);
    }
    if (after < before) {
      return makeLogEffect("stack-spend", targetName, targetName, `${stackName}-${before - after}`, targetSide, targetSide || context.actorSide);
    }
    return null;
  }

  match = line.match(/^(.+?)(?:이|가) (\d+)중첩 증가했다\./);
  if (match && context.actorName) {
    const [, stackName, amountText] = match;
    context.lastStackOwner = context.actorName;
    context.lastStackName = stackName;
    return makeLogEffect("stack-gain", context.actorName, context.actorName, `${stackName}+${amountText}`, context.actorSide, context.actorSide);
  }

  match = line.match(/^(.+?) (\d+)(?:중첩)? 소모:/);
  if (match && context.actorName) {
    const [, stackName, amountText] = match;
    context.lastStackOwner = context.actorName;
    context.lastStackName = stackName;
    return makeLogEffect("stack-spend", context.actorName, context.actorName, `${stackName}-${amountText}`, context.actorSide, context.actorSide);
  }

  match = line.match(/^(.+?)의 (.+?) (\d+)중첩을 소모했다\./);
  if (match) {
    const [, targetName, stackName, amountText] = match;
    context.lastStackOwner = targetName;
    context.lastStackName = stackName;
    return makeLogEffect("stack-spend", targetName, targetName, `${stackName}-${amountText}`, context.lineSide, context.lineSide || context.actorSide);
  }

  match = line.match(/^(.+?)을 모두 소모했다\./);
  if (match && context.actorName) {
    const stackName = match[1];
    context.lastStackOwner = context.actorName;
    context.lastStackName = stackName;
    return makeLogEffect("stack-spend", context.actorName, context.actorName, `${stackName} 전부`, context.actorSide, context.actorSide);
  }

  match = line.match(/^(.+?) (\d+)(?:중첩)?(?:을|이) 모두 소모/);
  if (match) {
    const [, stackName] = match;
    const targetName = context.lastStackName === stackName ? context.lastStackOwner : context.actorName;
    if (targetName) {
      context.lastStackOwner = targetName;
      context.lastStackName = stackName;
      return makeLogEffect("stack-spend", targetName, targetName, `${stackName} 전부`, context.lineSide, context.lineSide || context.actorSide);
    }
  }

  const characterEffect = resolveCharacterBattleEffect("log", context, { line });
  if (characterEffect !== undefined) return characterEffect;

  return null;
}

function makeLogEffect(type, targetName, sourceName, value, targetSide = null, sourceSide = null) {
  const resolvedSourceSide = sourceSide || sideForFighterName(sourceName);
  const inferredTargetSide = !targetSide && resolvedSourceSide && (type === "hit" || type === "debuff")
    ? oppositeSide(resolvedSourceSide)
    : resolvedSourceSide;
  const side = targetSide || sideForFighterName(targetName, inferredTargetSide);
  if (!side) return null;
  const target = state.battle?.[side];
  const source = resolvedSourceSide ? state.battle?.[resolvedSourceSide] : null;
  const useSourceColor =
    type === "hit" || type === "debuff" || (type === "stack-gain" && resolvedSourceSide && resolvedSourceSide !== side);
  const sourceId = useSourceColor ? source?.id : target?.id;
  return {
    type,
    side,
    sourceSide: resolvedSourceSide,
    value,
    color: characterColor(sourceId || target?.id),
  };
}

function makeMissEffect(actorName, preferredActorSide = null) {
  const actorSide = sideForFighterName(actorName, preferredActorSide);
  const side = oppositeSide(actorSide);
  if (!side) return null;
  const target = state.battle?.[side];
  return {
    type: "miss",
    side,
    value: "MISS",
    color: characterColor(target?.id),
  };
}

function battleSpriteStateForAction(context) {
  const fighter = state.battle?.[context.actorSide];
  const asset = spriteAssetForSubject(fighter);
  if (!fighter || !asset) return null;
  if (context.actionName === "일반 공격") return "attack";
  if (context.actionName === "일반 방어" || context.actionName === "명상" || DEFENSE_ACTION_NAMES.has(context.actionName)) {
    return "utility";
  }
  const character = findCharacterForFighter(fighter);
  const skill = character?.skills?.find((candidate) => candidate.name === context.actionName);
  return skill?.power !== null && skill?.power !== undefined && Number.isFinite(Number(skill.power))
    ? "attack"
    : "utility";
}

function attachBattleSpriteActionState(effect, context) {
  const spriteState = battleSpriteStateForAction(context);
  if (!spriteState || !context.actorSide) return effect;
  const spriteMetadata = {
    spriteState,
    spriteSide: context.actorSide,
    spriteHoldMs: BATTLE_SPRITE_ACTION_HOLD_MS,
  };
  return effect
    ? { ...effect, ...spriteMetadata }
    : { type: "sprite-state", side: context.actorSide, sourceSide: context.actorSide, ...spriteMetadata };
}

function shouldUseHitBattleSprite(effect) {
  const isDamageEffect = ["normal-attack", "hit", "shadow-hit"].includes(effect.type)
    || Number(effect.damageValue) > 0;
  return Boolean(
    isDamageEffect
    && effect.sourceSide
    && effect.side
    && effect.side !== effect.sourceSide
  );
}

function battleEffectValueKind(effect) {
  if (effect.valueKind) return effect.valueKind;
  if (["normal-attack", "hit", "shadow-hit"].includes(effect.type) || Number(effect.damageValue) > 0) {
    return "hp-loss";
  }
  const text = String(effect.value || "");
  if (/^HP\s*\+/.test(text)) return "hp-gain";
  if (/^HP\s*-/.test(text)) return "hp-loss";
  if (/^MP\s*\+/.test(text)) return "mp-gain";
  if (/^MP\s*-/.test(text)) return "mp-loss";
  return "";
}

function battleEffectValueText(effect, valueKind) {
  const value = effect.value;
  if (!valueKind || !Number.isFinite(Number(value))) return String(value);
  const [resource, direction] = valueKind.split("-");
  const sign = direction === "gain" ? "+" : "-";
  return `${resource.toUpperCase()} ${sign}${Math.abs(Number(value))}`;
}

function appendBattleEffectValue(value, stage) {
  const layer = document.querySelector(".battle-fx-value-layer");
  const arena = document.querySelector(".arena-surface");
  if (!layer || !arena) {
    stage.append(value);
    return;
  }

  stage.append(value);
  const stageRect = stage.getBoundingClientRect();
  const arenaRect = arena.getBoundingClientRect();
  const computed = window.getComputedStyle(value);
  const localLeft = Number.parseFloat(computed.left);
  const localTop = Number.parseFloat(computed.top);
  value.style.left = `${stageRect.left - arenaRect.left + (Number.isFinite(localLeft) ? localLeft : stageRect.width / 2)}px`;
  value.style.top = `${stageRect.top - arenaRect.top + (Number.isFinite(localTop) ? localTop : stageRect.height / 2)}px`;
  layer.append(value);
}

function shouldUseMonochromeBattleEffect(effect) {
  return Boolean(
    effect?.sourceSide === "ai"
    && state.battle?.adventure
  );
}

function appendBattleEffectElement(parent, element, effect) {
  if (!parent || !element) return element;
  if (!shouldUseMonochromeBattleEffect(effect)) {
    parent.append(element);
    return element;
  }
  const layer = document.createElement("span");
  layer.className = "battle-fx-monochrome-layer";
  layer.dataset.sourceSide = effect.sourceSide;
  layer.append(element);
  parent.append(layer);
  return layer;
}

function playLogEffect(effect) {
  if (!effect?.side) return;
  if (Number(effect.delayMs) > 0) {
    const delayedEffect = { ...effect, delayMs: 0 };
    registerEffectTimeout(window.setTimeout(() => playLogEffect(delayedEffect), Number(effect.delayMs)));
    return;
  }
  if (effect.spriteState && effect.spriteSide) {
    setBattleSpriteState(effect.spriteSide, effect.spriteState, effect.spriteHoldMs);
  }
  if (shouldUseHitBattleSprite(effect)) {
    setBattleSpriteState(effect.side, "hit", BATTLE_SPRITE_HIT_HOLD_MS);
  }
  if (effect.type === "sprite-state") return;
  if (!EFFECT_CLASSES.includes(effect.type)) return;
  playEffectSound(effect.type);
  const characterEffectPlayed = CHARACTER_BATTLE_EFFECTS?.play?.(effect, {
    arena: document.querySelector(".arena-surface"),
    stageForSide: (side) => side ? document.querySelector(fighterIds[side].avatar) : null,
    appendEffectElement: (parent, element) => appendBattleEffectElement(parent, element, effect),
    registerTimeout: registerEffectTimeout,
    playLogEffect,
  });
  if (characterEffectPlayed) return;
  const stage = document.querySelector(fighterIds[effect.side].avatar);
  if (!stage) return;

  stage.style.setProperty("--effect-color", effect.color || characterColor());
  const hitShakeDirection = effect.sourceSide === "ai" ? -1 : 1;
  stage.style.setProperty("--hit-shake-x-1", `${-8 * hitShakeDirection}px`);
  stage.style.setProperty("--hit-shake-angle-1", `${-0.8 * hitShakeDirection}deg`);
  stage.style.setProperty("--hit-shake-x-2", `${7 * hitShakeDirection}px`);
  stage.style.setProperty("--hit-shake-angle-2", `${0.6 * hitShakeDirection}deg`);
  stage.style.setProperty("--hit-shake-x-3", `${-4 * hitShakeDirection}px`);
  stage.style.setProperty("--hit-shake-angle-3", `${-0.4 * hitShakeDirection}deg`);
  stage.style.setProperty("--hit-shake-x-4", `${3 * hitShakeDirection}px`);
  if (effect.type === "miss") {
    stage.style.setProperty("--miss-shift", effect.side === "player" ? "-18px" : "18px");
  }
  const className = `is-fx-${effect.type}`;
  for (const type of EFFECT_CLASSES) {
    stage.classList.remove(`is-fx-${type}`);
  }
  void stage.offsetWidth;
  stage.classList.add(className);

  const burst = MOTION_ONLY_EFFECT_TYPES.has(effect.type) ? null : document.createElement("span");
  if (burst) {
    burst.className = `battle-fx-effect battle-fx-${effect.type}`;
    appendBattleEffectElement(stage, burst, effect);
  }

  if (effect.value) {
    const value = document.createElement("span");
    const valueKind = battleEffectValueKind(effect);
    value.className = `battle-fx-value battle-fx-value-${effect.type}${valueKind ? ` battle-fx-value-${valueKind}` : ""}`;
    value.textContent = battleEffectValueText(effect, valueKind);
    appendBattleEffectValue(value, stage);
    registerEffectTimeout(window.setTimeout(() => value.remove(), 850));
  }

  if (burst) {
    const mountedBurst = burst.parentElement?.classList.contains("battle-fx-monochrome-layer")
      ? burst.parentElement
      : burst;
    registerEffectTimeout(window.setTimeout(() => mountedBurst.remove(), 760));
  }
  registerEffectTimeout(window.setTimeout(() => stage.classList.remove(className), 520));
}

function playEffectSound(type) {
  prepareSfx();
  const bank = state.sfx.get(type);
  if (!bank) return;
  const available = bank.pool.find((audio) => audio.paused || audio.ended);
  const sound = available || bank.pool[bank.cursor];
  const soundIndex = bank.pool.indexOf(sound);
  bank.cursor = (soundIndex + 1) % bank.pool.length;
  sound.pause();
  sound.currentTime = 0;
  sound.volume = effectiveSfxVolume();
  sound.play().catch(() => {
    // Some browsers suppress audio until after the first user gesture.
  });
}

function playBgm(type, fadeMs = BGM_FADE_MS) {
  prepareBgm();
  const track = BGM_TRACKS[type];
  const next = state.bgm.get(type);
  if (!track || !next) return;
  const targetVolume = effectiveBgmVolume(track);
  if (state.currentBgm === next && !next.paused) {
    next.volume = targetVolume;
    return;
  }

  clearBgmFades();
  const previous = state.currentBgm;
  if (previous && previous !== next) {
    fadeAudio(previous, 0, fadeMs, () => {
      previous.pause();
      previous.currentTime = 0;
    });
  }

  next.loop = Boolean(track.loop);
  next.currentTime = 0;
  next.volume = previous && previous !== next ? 0 : targetVolume;
  state.currentBgm = next;
  state.currentBgmType = type;
  next.play()
    .then(() => {
      if (next.volume !== targetVolume) {
        fadeAudio(next, targetVolume, fadeMs);
      }
    })
    .catch(() => {
      // Audio can be blocked until a user gesture; later button clicks prime it again.
    });
}

function playResultBgm(data, nextType = null) {
  const type = resultBgmType(data);
  if (type) {
    playBgm(type, BGM_FADE_MS);
    if (nextType) queueBgmAfterTrack(type, nextType);
  }
}

function queueBgmAfterTrack(currentType, nextType) {
  prepareBgm();
  const current = state.bgm.get(currentType);
  if (!current || !BGM_TRACKS[nextType]) return;
  current.addEventListener("ended", () => {
    if (state.currentBgm === current && state.battleMode === "adventure") {
      playBgm(nextType, 300);
    }
  }, { once: true });
}

function resultBgmType(data) {
  if (!data?.is_over && !data?.gameOver) return null;
  if (data.adventure?.phase === "complete") return "clear";
  const winnerSide = data.winner?.side?.toLowerCase?.();
  if (winnerSide === "player") return "victory";
  if (winnerSide === "ai") return "defeat";
  if (data.player?.hp > 0 && data.ai?.hp <= 0) return "victory";
  if (data.ai?.hp > 0 && data.player?.hp <= 0) return "defeat";
  return "draw";
}

function stopBgm(fadeMs = BGM_FADE_MS) {
  clearBgmFades();
  const previous = state.currentBgm;
  state.currentBgm = null;
  state.currentBgmType = null;
  if (!previous) return;
  fadeAudio(previous, 0, fadeMs, () => {
    previous.pause();
    previous.currentTime = 0;
  });
}

function clearBgmFades() {
  for (const timer of state.bgmFadeTimers) {
    window.clearInterval(timer);
  }
  state.bgmFadeTimers = [];
}

function fadeAudio(audio, targetVolume, durationMs, onDone) {
  const startVolume = audio.volume;
  if (durationMs <= 0) {
    audio.volume = targetVolume;
    onDone?.();
    return;
  }

  const start = window.performance.now();
  const timer = window.setInterval(() => {
    const progress = Math.min(1, (window.performance.now() - start) / durationMs);
    audio.volume = startVolume + (targetVolume - startVolume) * progress;
    if (progress >= 1) {
      window.clearInterval(timer);
      state.bgmFadeTimers = state.bgmFadeTimers.filter((item) => item !== timer);
      onDone?.();
    }
  }, 40);
  state.bgmFadeTimers.push(timer);
}

function clearBattleEffects() {
  for (const timer of state.effectTimers) {
    window.clearTimeout(timer);
  }
  state.effectTimers = [];
  for (const stage of document.querySelectorAll(".avatar-stage")) {
    for (const type of EFFECT_CLASSES) {
      stage.classList.remove(`is-fx-${type}`);
    }
    stage.querySelectorAll(".battle-fx-monochrome-layer, .battle-fx-effect, .battle-fx-value")
      .forEach((element) => element.remove());
  }
  document.querySelector(".battle-fx-value-layer")?.replaceChildren();
  document.querySelectorAll("[data-character-battle-effect]").forEach((element) => element.remove());
  resetBattleSpriteStates();
}

function registerEffectTimeout(timer) {
  state.effectTimers.push(timer);
}

function sideForFighterName(name, preferredSide = null) {
  if (!name || !state.battle) return null;
  if (preferredSide && state.battle[preferredSide]?.name === name) return preferredSide;
  if (state.battle.player?.name === name) return "player";
  if (state.battle.ai?.name === name) return "ai";
  return null;
}

function uiSideForBattleSide(battleSide) {
  const normalized = String(battleSide || "").toUpperCase();
  if (String(state.battle?.player?.battleSide || "").toUpperCase() === normalized) return "player";
  if (String(state.battle?.ai?.battleSide || "").toUpperCase() === normalized) return "ai";
  return normalized === "PLAYER" ? "player" : normalized === "AI" ? "ai" : null;
}

function oppositeSide(side) {
  return side === "player" ? "ai" : side === "ai" ? "player" : null;
}

function characterColor(id = "") {
  return CHARACTER_COLORS[id] || "#aeb4bd";
}

function polishLogLine(line) {
  line = polishStatJosa(line);

  const actionMatch = line.match(/^(.+)은 (.+)을 사용했다\.$/);
  if (actionMatch) {
    return `${withJosa(actionMatch[1], "은", "는")} ${withJosa(actionMatch[2], "을", "를")} 사용했다.`;
  }
  return line;
}

function polishStatJosa(line) {
  return ["HP", "MP", "ATK", "DEF", "SPD"].reduce(
    (result, stat) => result.replaceAll(`${stat}이`, `${stat}가`),
    line,
  );
}

function renderLog(options = {}) {
  const packet = state.turnLogs[state.currentLogIndex];
  if (!packet) {
    els.battleLog.innerHTML = `<div class="log-empty">전투 시작 전</div>`;
    els.prevLogButton.disabled = true;
    els.nextLogButton.disabled = true;
    return;
  }

  const entries = packet.entries || (packet.lines || []).map((text) => ({ text, effect: null }));
  const visibleCount = packet.visibleCount ?? entries.length;
  const lines = entries.slice(0, visibleCount).map((entry) => entry.text);
  els.battleLog.innerHTML = `
    <div class="turn-log">
      <div class="turn-log-title">${escapeHtml(packet.title)}</div>
      ${lines.map((line) => `<div class="log-line">${escapeHtml(line)}</div>`).join("")}
    </div>
  `;
  els.prevLogButton.disabled = state.logAnimating || state.currentLogIndex <= 0;
  els.nextLogButton.disabled = state.logAnimating || state.currentLogIndex >= state.turnLogs.length - 1;
  if (options.follow) {
    scrollBattleLogToBottom();
  }
}

function scrollBattleLogToBottom() {
  const log = els.battleLog;
  log.scrollTop = log.scrollHeight;
  window.requestAnimationFrame(() => {
    log.scrollTop = log.scrollHeight;
  });
}

function moveLog(delta) {
  if (state.logAnimating) return;
  const nextIndex = state.currentLogIndex + delta;
  if (nextIndex < 0 || nextIndex >= state.turnLogs.length) return;
  state.currentLogIndex = nextIndex;
  const packet = state.turnLogs[state.currentLogIndex];
  packet.visibleCount = (packet.entries || packet.lines || []).length;
  renderLog();
}

function clearLogs() {
  state.logToken += 1;
  state.logAnimating = false;
  clearBattleEffects();
  state.turnLogs = [];
  state.currentLogIndex = -1;
  renderLog();
}

function openFighterInfo(side) {
  const fighter = state.battle?.[side];
  if (!fighter) return;
  const character = findCharacterForFighter(fighter);
  if (!character) return;
  els.enemyInfoKicker.hidden = false;
  els.enemyInfoKicker.textContent = side === "player" ? "내 정보" : "상대 정보";
  els.enemyInfoTitle.textContent = fighter.label || `${fighter.name} — ${fighter.title}`;
  els.enemyInfoBody.style.setProperty("--character-color", characterColor(fighter.id));
  els.enemyInfoBody.innerHTML = fighterInfoHtml(character, fighter);
  els.enemyInfoModal.hidden = false;
}

function closeInfoModal() {
  els.enemyInfoModal.hidden = true;
}

function openBattleRecords() {
  const sections = battleRecordSections();
  const adventure = state.battleMode === "adventure"
    ? state.battle?.adventure || state.adventure
    : null;
  if (!sections.length && !adventure) return;
  els.enemyInfoKicker.hidden = false;
  els.enemyInfoKicker.textContent = "캐릭터 기록";
  els.enemyInfoTitle.textContent = "캐릭터 기록";
  els.enemyInfoBody.innerHTML = `
    <div class="record-modal-list">
      ${sections.map(recordSectionHtml).join("")}
      ${!sections.length ? emptyBattleRecordHtml() : ""}
      ${adventure ? adventureRelicRecordsHtml(adventure) : ""}
    </div>
  `;
  els.enemyInfoModal.hidden = false;
}

function emptyBattleRecordHtml() {
  return `
    <section class="record-modal-card">
      <span>캐릭터 기록</span>
      <strong>현재 기록된 고유 정보가 없습니다.</strong>
    </section>
  `;
}

function adventureRelicRecordsHtml(adventure) {
  const relics = (adventure.playerRelics || []).filter((relic) => !relic?.destroyed);
  return `
    ${relics.length
      ? relics.map((relic) => `
        <section class="record-modal-card">
          <span>${escapeHtml(`유물 정보 · ${relic.pool === "event" ? "이벤트 전용" : "유물 상점"}`)}</span>
          <strong>${escapeHtml(relic.name)}</strong>
          <p>${escapeHtml(relic.description)}</p>
        </section>
      `).join("")
      : `
        <section class="record-modal-card">
          <span>유물 정보</span>
          <strong>보유한 유물이 없습니다.</strong>
        </section>
      `}
    ${adventure.hasRelicLedger ? `
      <section class="record-modal-card">
        <span>유물 정보 · 소지품</span>
        <strong>유물상의 장부</strong>
        <p>다음 유물 상점에서 진열된 상품을 한 번 무료로 다시 뽑을 수 있다.</p>
      </section>
    ` : ""}
  `;
}

function battleRecordSections() {
  const items = [
    ["플레이어", state.battle?.player],
    ["상대", state.battle?.ai],
  ];
  return items
    .filter(([, fighter]) => fighter?.battleLog?.length)
    .map(([sideLabel, fighter]) => ({ sideLabel, fighter, lines: fighter.battleLog }));
}

function recordSectionHtml(section) {
  return `
    <section class="record-modal-card">
      <span>${escapeHtml(section.sideLabel)}</span>
      <strong>${escapeHtml(section.fighter.label || `${section.fighter.name} — ${section.fighter.title}`)}</strong>
      ${section.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    </section>
  `;
}

function fighterInfoHtml(character, fighter) {
  const stats = character.stats || {};
  const statuses = (character.uniqueStatuses || character.unique_statuses || [])
    .map((status) => infoTileHtml("고유 상태", status.name, status.description))
    .join("");
  const passive = character.passive
    ? infoTileHtml("패시브", character.passive.name, character.passive.description)
    : infoTileHtml("패시브", "없음", "");
  const skills = (character.skills || []).map((skill) => skillTileHtml(skill)).join("");
  const previewSprite = characterPreviewSpriteHtml(fighter, "fighter-info-sprite");
  const summary = `
    <div class="modal-summary">
      <div>
        <span>현재 상태</span>
        <strong>${escapeHtml(fighter.status_text || "없음")}</strong>
      </div>
      <div>
        <span>기본 능력치</span>
        <strong>HP ${formatStat(stats.hp)} / ATK ${formatStat(stats.atk)} / DEF ${formatStat(stats.def)} / SPD ${formatStat(stats.spd)}</strong>
      </div>
    </div>
  `;

  return `
    ${previewSprite
      ? `<div class="fighter-info-hero"><div class="fighter-info-sprite-frame">${previewSprite}</div>${summary}</div>`
      : summary}
    <div class="modal-grid">
      ${passive}
      ${statuses || infoTileHtml("고유 상태", "없음", "")}
      ${skills}
    </div>
  `;
}

function renderCodex() {
  if (!state.options?.characters?.length) {
    els.codexList.innerHTML = "";
    els.codexDetail.innerHTML = "";
    delete els.codexList.dataset.listKey;
    return;
  }

  state.selectedCodexIndex = Math.min(
    Math.max(0, state.selectedCodexIndex),
    state.options.characters.length - 1,
  );
  renderCodexList();
  renderCodexDetail();
}

function renderCodexList() {
  const characters = state.options.characters;
  const listKey = characters.map((character) => character.id || character.name).join("|");
  if (els.codexList.dataset.listKey !== listKey) {
    els.codexList.innerHTML = "";
    characters.forEach((character, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "codex-button";
      button.style.setProperty("--character-color", characterColor(character.id));
      button.innerHTML = `
        <strong>${escapeHtml(character.name)}</strong>
        <span>${escapeHtml(character.title)}</span>
      `;
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => selectCodexCharacter(index));
      els.codexList.append(button);
    });
    els.codexList.dataset.listKey = listKey;
  }

  updateCodexListSelection();
}

function selectCodexCharacter(index) {
  if (index === state.selectedCodexIndex) return;
  state.selectedCodexIndex = index;
  updateCodexListSelection();
  renderCodexDetail();
  els.codexDetail.scrollTop = 0;
}

function updateCodexListSelection() {
  [...els.codexList.children].forEach((button, index) => {
    const selected = index === state.selectedCodexIndex;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-current", selected ? "true" : "false");
  });
}

function renderCodexDetail() {
  const character = state.options.characters[state.selectedCodexIndex];
  if (!character) return;
  els.codexSubtitle.textContent = `${character.name} · ${character.title}`;
  els.codexDetail.style.setProperty("--character-color", characterColor(character.id));
  els.codexDetail.innerHTML = codexDetailHtml(character);
}

function codexDetailHtml(character) {
  const stats = character.stats || {};
  const passive = character.passive
    ? infoTileHtml("패시브", character.passive.name, character.passive.description)
    : infoTileHtml("패시브", "없음", "");
  const statuses = (character.uniqueStatuses || character.unique_statuses || [])
    .map((status) => infoTileHtml("고유 상태", status.name, status.description))
    .join("");
  const skills = (character.skills || []).map((skill) => skillTileHtml(skill)).join("");
  const characterVisual = characterPreviewSpriteHtml(character, "codex-character-sprite")
    || avatarSvg(character.name || character.id || "?", "codex");

  return `
    <div class="codex-hero">
      <div class="codex-avatar">${characterVisual}</div>
      <div class="codex-copy">
        <h2>${escapeHtml(character.name)}</h2>
        <p>${escapeHtml(character.title)}</p>
        ${codexSkillIconStripHtml(character)}
        <div class="stat-grid">
          ${statTileHtml("HP", stats.hp)}
          ${statTileHtml("ATK", stats.atk)}
          ${statTileHtml("DEF", stats.def)}
          ${statTileHtml("SPD", stats.spd)}
        </div>
      </div>
    </div>
    <div class="codex-section-grid">
      ${passive}
      ${statuses || infoTileHtml("고유 상태", "없음", "")}
    </div>
    <div class="codex-section-grid">
      ${skills}
    </div>
  `;
}

function codexSkillIconStripHtml(character) {
  const passive = {
    number: 0,
    name: character.passive?.name || "패시브",
  };
  const actives = (character.skills || []).map((skill, index) => ({
    ...skill,
    number: index + 4,
  }));
  const icons = [passive, ...actives].slice(0, 5);

  return `
    <div class="codex-skill-strip" aria-label="스킬 아이콘">
      ${icons
        .map((action) => `
          <span class="codex-skill-slot" tabindex="0" aria-label="${escapeHtml(action.name)}">
            ${skillIconHtmlForCharacter(action, character.id)}
            <span class="codex-skill-tooltip">${escapeHtml(action.name)}</span>
          </span>
        `)
        .join("")}
    </div>
  `;
}

function statTileHtml(label, value) {
  return `
    <div class="stat-tile">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(formatStat(value))}</strong>
    </div>
  `;
}

function infoTileHtml(kicker, title, text) {
  return `
    <section class="info-tile">
      <span>${escapeHtml(kicker)}</span>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(text || "-")}</p>
    </section>
  `;
}

function skillTileHtml(skill) {
  const target = skill.target || "-";
  const power = skill.power == null ? "-" : skill.power;
  const accuracy = skill.accuracy == null ? "-" : skill.accuracy;
  const priority = skill.priority == null ? "-" : skill.priority;
  return `
    <section class="skill-tile">
      <span>${escapeHtml(target)} / MP ${escapeHtml(formatStat(skill.mp ?? "-"))} / 위력 ${escapeHtml(formatStat(power))} / 명중률 ${escapeHtml(formatStat(accuracy))} / 우선도 ${escapeHtml(formatStat(priority))}</span>
      <strong>${escapeHtml(skill.name)}</strong>
      <p>${escapeHtml(skill.description || "-")}</p>
    </section>
  `;
}

function setBusy(isBusy) {
  state.busy = isBusy;
  document.body.classList.toggle("is-waiting", isBusy);
  syncSetupLock();
  if (state.battle) {
    const adventureChoices = state.battleMode === "adventure"
      && (state.battle.is_over || state.adventure?.phase === "prologue")
      && Array.isArray(state.adventure?.choices)
      ? state.adventure.choices
      : [];
    if (adventureChoices.length) {
      renderAdventureChoices(adventureChoices);
    } else if (
      state.battleMode === "adventure"
      && ["final_battle_dialogue", "final_battle_ending"].includes(state.adventure?.phase)
    ) {
      renderEmptyActions(state.adventureRestartRequested ? "새 여정을 시작하는 중" : "대화 진행 중...");
    } else if (state.battleMode === "adventure" && ["town_complete", "event_complete", "complete"].includes(state.adventure?.phase)) {
      renderEmptyActions(state.adventure.phase === "complete"
        ? "여정을 마쳤습니다."
        : state.adventure.phase === "event_complete"
        ? `${state.adventure.currentEvent?.name || "이벤트"}에서 떠났습니다.`
        : "마을에서 식사를 마쳤습니다.");
    } else {
      renderActions(state.battle.actions || [], state.battle.is_over);
    }
  }
}

function syncSetupLock() {
  const pvpLocked = isPvpSetupLocked();
  const playerSetupLocked = pvpLocked || (state.battleMode === "adventure" && state.busy);
  const canRestartDuringDialogue = state.battleMode === "adventure"
    && state.busy
    && ["final_battle_dialogue", "final_battle_ending"].includes(state.adventure?.phase)
    && !state.adventureRestartRequested;
  const startLocked = pvpLocked || (state.busy && !canRestartDuringDialogue);
  els.startButton.disabled = startLocked;
  els.inscriptionButton.removeAttribute("title");
  if (playerSetupLocked && document.activeElement === els.inscriptionButton) {
    els.inscriptionButton.blur();
  }
  els.inscriptionButton.disabled = playerSetupLocked;
  els.playerSelect.disabled = playerSetupLocked;
  els.pvpRoomInput.disabled = pvpLocked;
  for (const picker of state.characterPickers) {
    picker.select.disabled = picker.select === els.playerSelect ? playerSetupLocked : false;
    picker.button.disabled = picker.select.disabled;
  }
  if (playerSetupLocked) {
    closeCustomSelects();
    closeInscriptionPopover();
    closeCharacterPicker();
  }
}

function isPvpSetupLocked() {
  if (state.battleMode !== "pvp" || !state.pvp || !state.battle) {
    return false;
  }
  return !Boolean(state.battle.is_over || state.battle.gameOver);
}

async function exitApp() {
  if (window.AndroidVersus?.exit) {
    window.AndroidVersus.exit();
    return;
  }

  if (window.chrome?.webview) {
    window.chrome.webview.postMessage({ type: "exit" });
    return;
  }

  try {
    await api("/api/exit", {});
  } catch {
    // The server can close before the response reaches the browser.
  }
  window.close();
  document.body.innerHTML = '<main class="exit-screen">VERSUS 종료</main>';
}

async function newAdventureRequest(start) {
  const data = await api("/api/adventure/new", start);
  state.adventureSave = AdventureSave.createAdventureSave(start);
  AdventureSave.storeAdventureSave(adventureStorage(), state.adventureSave);
  return data;
}

async function adventureActionRequest(payload) {
  const data = await api("/api/action", payload);
  recordAdventureCommand("action", payload, data);
  return data;
}

async function adventureChoiceRequest(payload) {
  const data = await api("/api/adventure/choice", payload);
  recordAdventureCommand("choice", payload, data);
  return data;
}

function recordAdventureCommand(type, payload, data) {
  if (!state.adventureSave) return;
  try {
    state.adventureSave = AdventureSave.appendAdventureCommand(state.adventureSave, type, payload);
    AdventureSave.storeAdventureSave(adventureStorage(), state.adventureSave);
  } catch {
    clearStoredAdventure();
    return;
  }
  if (AdventureSave.isAdventureTerminal(data?.adventure)) clearStoredAdventure();
}

function clearStoredAdventure() {
  state.adventureSave = null;
  AdventureSave?.clearAdventureSave(adventureStorage());
}

function adventureStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createAdventureSeed() {
  if (globalThis.crypto?.randomUUID) return `adventure-${globalThis.crypto.randomUUID()}`;
  const values = new Uint32Array(4);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
    return `adventure-${[...values].map((value) => value.toString(16).padStart(8, "0")).join("")}`;
  }
  return `adventure-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function api(path, body, baseUrl = "") {
  const init = body === undefined
    ? undefined
    : {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      };
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, init);
  } catch (error) {
    if (baseUrl) {
      throw new Error("PvP 서버에 연결할 수 없습니다. VERSUS 서버 상태를 확인해 주세요.");
    }
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `${response.status} ${response.statusText}`);
  }
  return data;
}

function pvpApi(path, body) {
  return api(path, body, state.pvp?.server || "");
}

function normalizeRoomCode(value) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function pvpTokenStorageKey(server, room) {
  return `${PVP_TOKEN_STORAGE_PREFIX}${server}|${room}`;
}

function loadStoredPvpToken(server, room) {
  if (!room) return "";
  try {
    return localStorage.getItem(pvpTokenStorageKey(server, room)) || "";
  } catch {
    return "";
  }
}

function saveStoredPvpToken(server, room, token) {
  if (!room || !token) return;
  try {
    localStorage.setItem(pvpTokenStorageKey(server, room), token);
  } catch {
    // Rejoining still works during this tab session through state.pvp.token.
  }
}

function selectedText(select) {
  return select.options[select.selectedIndex]?.textContent || "-";
}

function findCharacterByIndex(index) {
  return state.options?.characters?.find((character) => String(character.index) === String(index)) || null;
}

function findCharacterByName(name) {
  return state.options?.characters?.find((character) => character.name === name) || null;
}

function findCharacterForFighter(fighter) {
  const adventureMonster = state.adventure?.monster;
  const isAi = fighter?.battleSide === "AI" || fighter?.side === "AI" || fighter === state.battle?.ai;
  if (isAi && fighter?.id && adventureMonster?.id === fighter.id) return adventureMonster;
  return state.options?.characters?.find((character) => (
    (fighter.id && character.id === fighter.id) || character.name === fighter.name
  )) || null;
}

function battleSpriteSrcForSubject(subject, side) {
  const asset = spriteAssetForSubject(subject);
  return asset ? battleSpriteStateSrcForSubject(subject, "idle") : "";
}

function battleSpriteHtml(subject, side, src = battleSpriteSrcForSubject(subject, side)) {
  if (!src) return "";
  const name = subject?.name || subject?.id || "character";
  return `<img class="battle-sprite battle-sprite-side battle-sprite-side-${side}" src="${escapeHtml(src)}" alt="${escapeHtml(name)}" data-sprite-state="idle">`;
}

function characterPickerThumbHtml(character, side, isRandom = false) {
  if (isRandom || !character) {
    return `<span class="character-picker-random-mark">?</span>`;
  }
  const previewSprite = characterPreviewSpriteHtml(character, "character-picker-sprite");
  if (previewSprite) return previewSprite;
  return avatarSvg(character.name, side);
}

function spriteAssetForSubject(subject) {
  const id = subject?.id || findCharacterByName(subject?.name)?.id;
  const assetGroup = id ? SPRITE_ASSETS[id] : null;
  return assetGroup ? { id, assetGroup } : null;
}

function battleSpriteStateSrcForSubject(subject, spriteState = "idle") {
  const asset = spriteAssetForSubject(subject);
  if (!asset) return "";
  return localAssetUrl(`/assets/${asset.assetGroup}/${encodeURIComponent(asset.id)}/sprites/${BATTLE_SPRITE_RENDER_STATE}.png`);
}

function preloadBattleSpriteStates(subject) {
  const asset = spriteAssetForSubject(subject);
  if (!asset) return;
  const src = battleSpriteStateSrcForSubject(subject, "idle");
  if (!src || state.preloadedSpriteUrls.has(src)) return;
  state.preloadedSpriteUrls.add(src);
  const image = new Image();
  image.src = src;
}

function setBattleSpriteState(side, spriteState, holdMs = 0) {
  const fighter = state.battle?.[side];
  const src = battleSpriteStateSrcForSubject(fighter, spriteState);
  const image = document.querySelector(fighterIds[side]?.avatar)?.querySelector(".battle-sprite-side");
  if (!src || !image) return false;
  const token = ++state.spriteStateTokens[side];
  image.src = src;
  image.dataset.spriteState = BATTLE_SPRITE_RENDER_STATE;
  if (Number(holdMs) > 0) {
    registerEffectTimeout(window.setTimeout(() => {
      if (state.spriteStateTokens[side] !== token) return;
      setBattleSpriteState(side, "idle");
    }, Number(holdMs)));
  }
  return true;
}

function resetBattleSpriteStates() {
  for (const side of ["player", "ai"]) {
    state.spriteStateTokens[side] += 1;
    const fighter = state.battle?.[side];
    const src = battleSpriteStateSrcForSubject(fighter, "idle");
    const image = document.querySelector(fighterIds[side]?.avatar)?.querySelector(".battle-sprite-side");
    if (!src || !image) continue;
    image.src = src;
    image.dataset.spriteState = "idle";
  }
}

function characterPreviewSpriteHtml(subject, className) {
  const idleSrc = battleSpriteStateSrcForSubject(subject, "idle");
  if (!idleSrc) return "";
  const name = subject?.name || subject?.id || "character";
  return `<img class="${escapeHtml(className)}" src="${escapeHtml(idleSrc)}" alt="${escapeHtml(name)}" data-sprite-state="idle">`;
}

function withJosa(text, consonant, vowel) {
  return `${text}${hasFinalConsonant(text) ? consonant : vowel}`;
}

function hasFinalConsonant(text) {
  const value = String(text).trim();
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xac00 && code <= 0xd7a3) {
      return (code - 0xac00) % 28 !== 0;
    }
    if (/[a-z0-9]/i.test(value[index])) {
      return true;
    }
  }
  return false;
}

function formatStat(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (Number.isInteger(number)) return String(number);
  return String(Math.round(number * 100) / 100);
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function avatarSvg(name, side, options = {}) {
  const safeName = name && name !== "-" ? name : "V";
  const hue = hashName(safeName) % 360;
  const hue2 = (hue + 82) % 360;
  const accent = options.monochrome ? "#c9cdd3" : `hsl(${hue} 74% 58%)`;
  const accent2 = options.monochrome ? "#707782" : `hsl(${hue2} 74% 62%)`;
  const dark = options.monochrome ? "#242930" : `hsl(${hue} 32% 23%)`;
  const initial = escapeHtml(safeName.slice(0, 1));
  const tilt = side === "ai" ? -4 : 4;
  return `
    <svg viewBox="0 0 220 180" role="img" aria-label="${escapeHtml(safeName)}">
      <defs>
        <linearGradient id="g-${hue}-${side}" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${accent}"/>
          <stop offset="1" stop-color="${accent2}"/>
        </linearGradient>
      </defs>
      <ellipse cx="110" cy="154" rx="76" ry="14" fill="rgba(0,0,0,.34)"/>
      <g transform="rotate(${tilt} 110 92)">
        <path d="M110 16 L174 47 L158 124 L110 164 L62 124 L46 47 Z"
          fill="${dark}" stroke="rgba(255,255,255,.34)" stroke-width="4"/>
        <path d="M110 29 L159 53 L147 113 L110 146 L73 113 L61 53 Z"
          fill="url(#g-${hue}-${side})"/>
        <path d="M74 80 C90 54 130 54 146 80 C139 100 128 110 110 116 C92 110 81 100 74 80 Z"
          fill="rgba(255,255,255,.18)"/>
        <circle cx="86" cy="86" r="9" fill="#080a0d"/>
        <circle cx="134" cy="86" r="9" fill="#080a0d"/>
        <path d="M87 121 C100 132 121 132 134 121" fill="none" stroke="#080a0d"
          stroke-width="8" stroke-linecap="round"/>
        <text x="110" y="70" text-anchor="middle" dominant-baseline="central"
          font-size="42" font-weight="900" fill="rgba(255,255,255,.9)">${initial}</text>
      </g>
    </svg>
  `;
}

function hashName(name) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return hash;
}
