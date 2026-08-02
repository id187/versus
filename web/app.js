const LOG_DELAY_MS = 280;
const DIALOGUE_LOG_DELAY_MS = 1200;
const EFFECT_SETTLE_MS = 620;
const SFX_VOLUME = 0.28;
const SFX_POOL_SIZE = 3;
const BGM_FADE_MS = 900;

const els = {
  homeScreen: document.querySelector("#homeScreen"),
  battleScreen: document.querySelector("#battleScreen"),
  battleScreenTitle: document.querySelector("#battleScreen .header-title strong"),
  codexScreen: document.querySelector("#codexScreen"),
  openAdventureButton: document.querySelector("#openAdventureButton"),
  openBattleButton: document.querySelector("#openBattleButton"),
  openPvpButton: document.querySelector("#openPvpButton"),
  openCodexButton: document.querySelector("#openCodexButton"),
  exitButton: document.querySelector("#exitButton"),
  battleBackButton: document.querySelector("#battleBackButton"),
  codexBackButton: document.querySelector("#codexBackButton"),
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
  jitrom: "#66ff33",
  fimit: "#7894a8",
  emento: "#a686d4",
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

const CHARACTER_SKILL_ICON_IDS = new Set(["toxiche", "cryne", "karossy", "gandrick", "melague", "balef", "plote", "charinel", "nihfle", "ashend", "dethus", "zeroven", "revesha", "serpen", "neroko", "happyrin", "librang", "dracle", "saqua", "queenas", "jitrom", "fimit", "emento"]);
const CHARACTER_PORTRAIT_IDS = new Set(["toxiche", "cryne", "karossy", "gandrick", "melague", "balef", "plote", "charinel", "nihfle", "ashend", "dethus", "zeroven", "revesha", "serpen", "neroko", "happyrin", "librang", "dracle", "saqua", "queenas", "jitrom", "fimit", "emento"]);
const MONSTER_SKILL_ICON_IDS = new Set(["demon_scout_kain", "demon_warrior_luke", "demon_mage_zero", "demon_archer_robin", "demon_priest_sara", "demon_fighter_gran", "demon_king_monochrem"]);
const MONSTER_PORTRAIT_IDS = new Set(["demon_scout_kain", "demon_warrior_luke", "demon_mage_zero", "demon_archer_robin", "demon_priest_sara", "demon_fighter_gran", "demon_king_monochrem"]);
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
      <ellipse cx="16" cy="13" rx="8" ry="9" />
      <path d="M16 22v4M11 27h10M5 25c3-2 6-2 9 0s6 2 9 0 4-2 6-1" />
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
  cracked_reliquary: `
    <svg class="adventure-destination-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 13h18v14H7Z" />
      <path d="M9 13c0-6 3-9 7-9s7 3 7 9" />
      <path d="m16 9-4 7 4 6 4-6-4-7Z" />
      <path d="m16 9-1 5 2 2-2 3 1 3" />
    </svg>`,
});

const EFFECT_CLASSES = ["hit", "shadow-hit", "miss", "defense", "heal", "buff", "debuff", "stack-gain", "stack-spend"];
const EFFECT_SFX = {
  hit: "/assets/sfx/hit.wav",
  "shadow-hit": "/assets/sfx/hit.wav",
  miss: "/assets/sfx/miss.wav",
  defense: "/assets/sfx/defense.wav",
  heal: "/assets/sfx/heal.wav",
  buff: "/assets/sfx/buff.wav",
  debuff: "/assets/sfx/debuff.wav",
  "stack-gain": "/assets/sfx/stack-gain.wav",
  "stack-spend": "/assets/sfx/stack-spend.wav",
};
const BGM_TRACKS = {
  fight: { src: "/assets/bgm/fight.mp3", loop: true, volume: 0.18 },
  boss: { src: "/assets/bgm/boss.mp3", loop: true, volume: 0.18 },
  village: { src: "/assets/bgm/village.mp3", loop: true, volume: 0.18 },
  event: { src: "/assets/bgm/event.mp3", loop: true, volume: 0.18, preload: false },
  prologue: { src: "/assets/bgm/prologue.mp3", loop: true, volume: 0.18, preload: false },
  clear: { src: "/assets/bgm/clear.mp3", loop: false, volume: 0.22 },
  victory: { src: "/assets/bgm/victory.wav", loop: false, volume: 0.24 },
  defeat: { src: "/assets/bgm/defeat.wav", loop: false, volume: 0.22 },
  draw: { src: "/assets/bgm/draw.wav", loop: false, volume: 0.2 },
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
  customSelects: [],
  characterPickers: [],
  activeCharacterPicker: null,
  selectedInscriptionId: DEFAULT_INSCRIPTION_OPTIONS[0].id,
  effectTimers: [],
  sfx: new Map(),
  bgm: new Map(),
  audioPrimed: false,
  bgmFadeTimers: [],
  currentBgm: null,
  currentBgmType: null,
};

init();

async function init() {
  bindEvents();
  syncInscriptionPicker();
  setBattleMode("pve");
  renderEmptyBattle();
  renderEmptyActions();
  renderLog();
  await loadOptions();
}

function bindEvents() {
  els.openAdventureButton.addEventListener("click", openAdventureMode);
  els.openBattleButton.addEventListener("click", () => openBattleMode("pve"));
  els.openPvpButton.addEventListener("click", () => openBattleMode("pvp"));
  els.openCodexButton.addEventListener("click", () => showScreen("codex"));
  els.battleBackButton.addEventListener("click", leaveBattleScreen);
  els.codexBackButton.addEventListener("click", () => showScreen("home"));
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
  document.addEventListener("click", closeCustomSelectsOnOutside);
  document.addEventListener("click", closeInscriptionPopoverOnOutside);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCustomSelects();
      closeInscriptionPopover();
      closeCharacterPicker();
      closeInfoModal();
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

function openAdventureMode() {
  els.pvpRoomInput.value = "";
  setBattleMode("adventure");
  resetBattleScreen();
  state.adventure = {
    stage: 1,
    totalStages: 10,
    phase: "setup",
  };
  previewSelectedMatch();
  showScreen("battle");
  els.turnChip.textContent = "PROLOGUE";
  pushTurnLog("Adventure", ["캐릭터를 고르고 새 여정을 시작하세요."], false);
  renderEmptyActions("새 여정을 시작하세요.");
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
      audio.volume = SFX_VOLUME;
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
    audio.volume = track.volume;
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

function showScreen(name) {
  if (name !== "battle") {
    stopPvpPolling();
  }
  for (const screen of [els.homeScreen, els.battleScreen, els.codexScreen]) {
    screen.classList.remove("is-active");
  }
  if (name === "battle") {
    els.battleScreen.classList.add("is-active");
  } else if (name === "codex") {
    primeAudio();
    playBgm("village");
    els.codexScreen.classList.add("is-active");
    renderCodex();
  } else {
    stopBgm();
    els.homeScreen.classList.add("is-active");
  }
}

function leaveBattleScreen() {
  const request = currentPvpLeaveRequest();
  els.pvpRoomInput.value = "";
  showScreen("home");
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
      <span class="character-picker-tile-portrait">
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
    const totalStages = state.adventure?.totalStages || 10;
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

function startConfiguredBattle() {
  if (
    state.battleMode === "adventure"
    && state.busy
    && ["post_battle_dialogue", "final_battle_dialogue", "final_battle_ending"].includes(state.adventure?.phase)
  ) {
    requestAdventureRestart();
    return;
  }
  if (state.battleMode === "adventure") return startAdventure();
  return state.battleMode === "pvp" ? startPvpEntry() : startBattle();
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
    const data = await api("/api/adventure/new", {
      playerIndex: els.playerSelect.value,
      playerInscriptionId: state.selectedInscriptionId,
    });
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
    const data = await api("/api/action", { action: actionNumber });
    const isGameOver = Boolean(data.is_over || data.gameOver);
    if (data.adventure) {
      state.adventure = { ...data.adventure };
    }
    const hasPostBattleDialogue = data.adventure?.phase === "post_battle_dialogue"
      && Array.isArray(data.adventure?.dialogue?.lines)
      && data.adventure.dialogue.lines.length > 0;
    const hasFinalBattleEnding = data.adventure?.phase === "final_battle_ending"
      && Array.isArray(data.adventure?.dialogue?.lines)
      && data.adventure.dialogue.lines.length > 0;
    if (hasPostBattleDialogue || hasFinalBattleEnding) syncSetupLock();
    if (isGameOver) {
      renderEmptyActions(hasPostBattleDialogue || hasFinalBattleEnding ? "전투 종료 처리 중" : "전투 결과 처리 중");
    }
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
      const completeData = await api("/api/adventure/choice", {
        choiceId: "complete_final_battle_ending",
      });
      if (state.adventureRestartRequested) return;
      state.battle = completeData;
      state.adventure = { ...completeData.adventure };
      syncSetupLock();
      renderBattle(completeData);
    } else if (hasPostBattleDialogue) {
      playBgm("victory", 300);
      await pushDialogueLog(
        data.adventure.dialogue.title || "전투 후",
        data.adventure.dialogue.lines,
      );
      if (state.adventureRestartRequested) return;
      const rewardData = await api("/api/adventure/choice", {
        choiceId: "complete_post_battle_dialogue",
      });
      if (state.adventureRestartRequested) return;
      state.battle = rewardData;
      state.adventure = { ...rewardData.adventure };
      syncSetupLock();
      renderBattle(rewardData);
      playBgm("village", 300);
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
    const data = await api("/api/adventure/choice", { choiceId });
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
      playBgm(data.adventure.isFinalBattle ? "boss" : "fight", 300);
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
      const battleData = await api("/api/adventure/choice", {
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
  renderFighter("player", data.player);
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
    renderFighter("ai", data.ai);
  }
  renderPassive(data.player);
  const adventureChoices = (data.is_over || isPrologue) && Array.isArray(adventure?.choices) ? adventure.choices : [];
  if (adventure?.phase === "complete") {
    renderEmptyActions("여정을 마쳤습니다.");
  } else if (adventureChoices.length) {
    renderAdventureChoices(adventureChoices);
  } else if (["post_battle_dialogue", "final_battle_dialogue", "final_battle_ending"].includes(adventure?.phase)) {
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
  syncDefeatPortraits(data, options.animateDefeat);
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

function renderFighter(side, fighter) {
  const ids = fighterIds[side];
  const maxHp = fighter.max_hp ?? fighter.maxHp ?? 0;
  const maxMp = fighter.max_mp ?? fighter.maxMp ?? 0;
  const defense = fighter.defense ?? fighter.stats?.def ?? "-";
  const stateText = fighter.status_text || fighter.stateText || "없음";
  const avatar = document.querySelector(ids.avatar);
  avatar.classList.remove("is-adventure-scene");
  document.querySelector(ids.sideName).textContent = fighter.name;
  document.querySelector(ids.sideTitle).textContent = fighter.title || "";
  avatar.style.setProperty("--character-color", characterColor(fighter.id));
  const portrait = portraitHtml(fighter, side);
  avatar.classList.toggle("is-empty", !portrait);
  avatar.innerHTML = portrait;
  setBar(ids.hpBar, fighter.hp, maxHp);
  setBar(ids.mpBar, fighter.mp, maxMp);
  document.querySelector(ids.hpText).textContent = `${formatStat(fighter.hp)}/${formatStat(maxHp)}`;
  document.querySelector(ids.mpText).textContent = `${formatStat(fighter.mp)}/${formatStat(maxMp)}`;
  document.querySelector(ids.stats).textContent =
    `ATK ${formatStat(fighter.atk)} / DEF ${formatStat(defense)} / SPD ${formatStat(fighter.spd)}`;
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
  avatar.innerHTML = `<img class="adventure-scene-illustration" src="${escapeHtml(illustration)}" alt="색을 잃어가는 팔레티아 대륙">`;
}

function hideInlineBattleRecord(selector) {
  const box = document.querySelector(selector);
  box.hidden = true;
  box.innerHTML = "";
}

function renderBattleRecordButton(data = state.battle) {
  const hasRecords = Boolean(data?.player?.battleLog?.length || data?.ai?.battleLog?.length);
  els.battleRecordButton.hidden = !hasRecords;
  els.battleRecordButton.disabled = !hasRecords;
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

function syncDefeatPortraits(data = state.battle, animate = false) {
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
  const isPrologueSelection = visibleChoices.length === 1 && visibleChoices[0].id === "start_adventure";
  els.battleScreen.classList.add("is-adventure-choice-phase");
  els.actionsGrid.innerHTML = "";
  els.actionsGrid.classList.add("is-adventure-choices");
  els.actionHint.hidden = false;
  els.actionHint.textContent = isRewardSelection
    ? "전투 보상"
    : isPrologueSelection
      ? "PROLOGUE"
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
    button.className = `adventure-choice-button${visibleChoices.length === 1 ? " is-single" : ""}${isEventSelection ? " is-event-choice" : ""}`;
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
      if (["reward", "destination", "town_meal", "event_choice"].includes(choice.type)) {
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
  const canReroll = state.adventure?.phase === "route" && rerollCount > 0;
  els.adventureRouteRerollButton.hidden = !canReroll;
  els.adventureRouteRerollButton.disabled = state.busy || !canReroll;
  els.adventureRouteRerollButton.textContent = rerollCount > 1
    ? `행선지 다시 뽑기 (${rerollCount})`
    : "행선지 다시 뽑기";
}

function adventureChoiceSymbolHtml(choice) {
  if (choice?.type === "destination" && ADVENTURE_DESTINATION_ICONS[choice.id]) {
    return ADVENTURE_DESTINATION_ICONS[choice.id];
  }
  return escapeHtml(choice?.symbol || "◆");
}

function adventureChoiceSymbolSizeClass(choice) {
  if (choice?.type === "destination" && ADVENTURE_DESTINATION_ICONS[choice.id]) return "";
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
    1: { glyph: "공", className: "skill-icon-attack", src: "/assets/actions/attack.webp" },
    2: { glyph: "방", className: "skill-icon-defense", src: "/assets/actions/defense.webp" },
    3: { glyph: "명", className: "skill-icon-focus", src: "/assets/actions/meditation.webp" },
  };
  if (common[number]) return common[number];
  return {
    glyph: skillIconFallbackGlyph(action, number),
    className: skillIconClassForNumber(number),
  };
}

function characterSkillIconSrc(characterId, number) {
  if (number >= 1 && number <= 3) return null;
  const assetGroup = CHARACTER_SKILL_ICON_IDS.has(characterId)
    ? "characters"
    : MONSTER_SKILL_ICON_IDS.has(characterId)
      ? "monsters"
      : null;
  if (!characterId || !assetGroup) return null;
  const fileName = number === 0 ? "passive" : `skill${number}`;
  return `/assets/${assetGroup}/${encodeURIComponent(characterId)}/skills/${fileName}.webp`;
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
  try {
    for (let index = 1; index <= packet.entries.length; index += 1) {
      await sleep(delayMs);
      if (token !== state.logToken) return;
      packet.visibleCount = index;
      renderLog({ follow: true });
      const entry = packet.entries[index - 1];
      playLogEffect(entry.effect);
      if (options.syncState) {
        applyLogStatePatch(entry.patch);
      }
      const effect = entry.effect;
      if (effect) {
        playedEffect = true;
      }
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
  const context = { actorName: null, actorSide: null, lineSide: null };
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
        result.push({ text: "→ 명중 판정 성공.", effect: null });
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

function effectFromLogLine(line, context) {
  const sectionMatch = line.match(/^\[(.+?)의 행동\]$/);
  if (sectionMatch) {
    context.actorName = sectionMatch[1];
    context.actorSide = context.lineSide || sideForFighterName(sectionMatch[1], context.actorSide);
    return null;
  }

  const actionMatch = line.match(/^(.+?)(?:은|는) (.+?)(?:을|를) 사용했다\.$/);
  if (actionMatch) {
    const [, actorName, actionName] = actionMatch;
    context.actorName = actorName;
    context.actorSide = context.lineSide || sideForFighterName(actorName, context.actorSide);
    if (DEFENSE_ACTION_NAMES.has(actionName)) {
      return makeLogEffect("defense", actorName, actorName, "방어", context.lineSide, context.actorSide);
    }
    return null;
  }

  if (line.includes("공격이 빗나갔다") || line.includes("공격이 회피되었다")) {
    return makeMissEffect(context.actorName, context.actorSide);
  }

  let match = line.match(/^(.+?)의 그림자 병사 \d+이 공격 피해 (\d+)을 대신 받았다\.$/);
  if (match) {
    return Number(match[2]) > 0 ? makeLogEffect("shadow-hit", match[1], match[1], match[2], context.lineSide, context.actorSide) : null;
  }

  match = line.match(/^(?:\d+타:\s*)?(.+?)에게 (\d+)의 피해\./);
  if (match) {
    return Number(match[2]) > 0 ? makeLogEffect("hit", match[1], context.actorName, match[2], context.lineSide, context.actorSide) : null;
  }

  match = line.match(/^(.+?)(?:은|는) .+?로 (\d+)의 고정 피해를 입었다\./);
  if (match) {
    return Number(match[2]) > 0 ? makeLogEffect("hit", match[1], context.actorName, match[2], context.lineSide, context.actorSide) : null;
  }

  match = line.match(/^(.+?) HP 회복 (\d+)\s*(?:→|->)\s*(\d+)/);
  if (match) {
    const amount = Number(match[3]) - Number(match[2]);
    return amount > 0 ? makeLogEffect("heal", match[1], match[1], `HP +${amount}`, context.lineSide, context.lineSide) : null;
  }

  match = line.match(/^(?:(.+?) )?MP (\d+)\s*(?:→|->)\s*(\d+)/);
  if (match) {
    const fighterName = match[1] || context.actorName;
    const amount = Number(match[3]) - Number(match[2]);
    return fighterName && amount > 0 ? makeLogEffect("heal", fighterName, fighterName, `MP +${amount}`, context.lineSide, context.lineSide || context.actorSide) : null;
  }

  match = line.match(/^(.+?)(?:의)? HP (\d+)\s*(?:→|->)\s*(\d+)/);
  if (match) {
    const amount = Number(match[3]) - Number(match[2]);
    if (amount === 0) return null;
    return makeLogEffect(amount > 0 ? "heal" : "hit", match[1], match[1], `HP ${amount > 0 ? "+" : ""}${amount}`, context.lineSide, context.lineSide);
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

  match = line.match(/^(.+?)(?:이|가) (?:붉은 호박|푸른 호박|유리 눈)을 얻었다/);
  if (match) {
    return makeLogEffect("buff", match[1], match[1], "유물", context.lineSide, context.lineSide || context.actorSide);
  }

  match = line.match(/^(.+?)의 (.+?) (\d+)(?:\/\d+)?\s*(?:→|->)\s*(\d+)(?:\/\d+)?(?:중첩)?/);
  if (match) {
    const [, targetName, stackName, beforeText, afterText] = match;
    const before = Number(beforeText);
    const after = Number(afterText);
    context.lastStackOwner = targetName;
    context.lastStackName = stackName;
    if (after > before) {
      return makeLogEffect("stack-gain", targetName, targetName, `${stackName}+${after - before}`, context.lineSide, context.lineSide || context.actorSide);
    }
    if (after < before) {
      return makeLogEffect("stack-spend", targetName, targetName, `${stackName}-${before - after}`, context.lineSide, context.lineSide || context.actorSide);
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

function playLogEffect(effect) {
  if (!effect?.side || !EFFECT_CLASSES.includes(effect.type)) return;
  playEffectSound(effect.type);
  const stage = document.querySelector(fighterIds[effect.side].avatar);
  if (!stage) return;

  stage.style.setProperty("--effect-color", effect.color || characterColor());
  if (effect.type === "miss") {
    stage.style.setProperty("--miss-shift", effect.side === "player" ? "-18px" : "18px");
  }
  const className = `is-fx-${effect.type}`;
  for (const type of EFFECT_CLASSES) {
    stage.classList.remove(`is-fx-${type}`);
  }
  void stage.offsetWidth;
  stage.classList.add(className);

  const burst = document.createElement("span");
  burst.className = `battle-fx-effect battle-fx-${effect.type}`;
  stage.append(burst);

  if (effect.value) {
    const value = document.createElement("span");
    value.className = `battle-fx-value battle-fx-value-${effect.type}`;
    value.textContent = effect.type === "hit" || effect.type === "shadow-hit" ? `-${effect.value}` : String(effect.value);
    stage.append(value);
    registerEffectTimeout(window.setTimeout(() => value.remove(), 850));
  }

  registerEffectTimeout(window.setTimeout(() => burst.remove(), 760));
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
  sound.volume = SFX_VOLUME;
  sound.play().catch(() => {
    // Some browsers suppress audio until after the first user gesture.
  });
}

function playBgm(type, fadeMs = BGM_FADE_MS) {
  prepareBgm();
  const track = BGM_TRACKS[type];
  const next = state.bgm.get(type);
  if (!track || !next) return;
  if (state.currentBgm === next && !next.paused) {
    next.volume = track.volume;
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
  next.volume = previous && previous !== next ? 0 : track.volume;
  state.currentBgm = next;
  state.currentBgmType = type;
  next.play()
    .then(() => {
      if (next.volume !== track.volume) {
        fadeAudio(next, track.volume, fadeMs);
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
    stage.querySelectorAll(".battle-fx-effect, .battle-fx-value").forEach((element) => element.remove());
  }
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
  els.enemyInfoBody.innerHTML = fighterInfoHtml(character, fighter);
  els.enemyInfoModal.hidden = false;
}

function closeInfoModal() {
  els.enemyInfoModal.hidden = true;
}

function openBattleRecords() {
  const sections = battleRecordSections();
  if (!sections.length) return;
  els.enemyInfoKicker.hidden = false;
  els.enemyInfoKicker.textContent = "캐릭터 기록";
  els.enemyInfoTitle.textContent = "캐릭터 기록";
  els.enemyInfoBody.innerHTML = `
    <div class="record-modal-list">
      ${sections.map(recordSectionHtml).join("")}
    </div>
  `;
  els.enemyInfoModal.hidden = false;
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

  return `
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

  return `
    <div class="codex-hero">
      <div class="codex-avatar">${portraitHtml(character, "codex")}</div>
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
      && ["post_battle_dialogue", "final_battle_dialogue", "final_battle_ending"].includes(state.adventure?.phase)
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
    && ["post_battle_dialogue", "final_battle_dialogue", "final_battle_ending"].includes(state.adventure?.phase)
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
  if (fighter?.id && adventureMonster?.id === fighter.id) return adventureMonster;
  return state.options?.characters?.find((character) => (
    (fighter.id && character.id === fighter.id) || character.name === fighter.name
  )) || null;
}

function portraitHtml(subject, side) {
  const id = subject?.id || findCharacterByName(subject?.name)?.id;
  if (!id) {
    return "";
  }
  const name = subject?.name || id;
  if (!CHARACTER_PORTRAIT_IDS.has(id) && !MONSTER_PORTRAIT_IDS.has(id)) {
    return avatarSvg(name, side, {
      monochrome: state.adventure?.monster?.id === id,
    });
  }
  const src = portraitSrcForId(id);
  return `<img class="character-portrait" src="${escapeHtml(src)}" alt="${escapeHtml(name)}">`;
}

function characterPickerThumbHtml(character, side, isRandom = false) {
  if (isRandom || !character) {
    return `<span class="character-picker-random-mark">?</span>`;
  }
  if (!CHARACTER_PORTRAIT_IDS.has(character.id)) {
    return avatarSvg(character.name, side);
  }
  const src = portraitSrcForId(character.id);
  return `<img class="character-picker-portrait" src="${escapeHtml(src)}" alt="${escapeHtml(character.name)}">`;
}

function portraitSrcForId(id) {
  const assetGroup = MONSTER_PORTRAIT_IDS.has(id) ? "monsters" : "characters";
  return `/assets/${assetGroup}/${encodeURIComponent(id)}/portrait.png`;
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
