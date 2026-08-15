const LOG_DELAY_MS = 780;
const LOG_IMPORTANT_DELAY_MS = 1300;
const LOG_DECISION_DELAY_MS = 1050;
const LOG_FIRST_ENTRY_DELAY_MS = 600;
const LOG_FAST_DELAY_MS = 240;
const LOG_ACTION_ANNOUNCEMENT_DELAY_MS = 700;
const TUTORIAL_INSTRUCTION_DELAY_MS = 2200;
const LOG_EFFECT_TAIL_HOLD_MS = 360;
const LOG_EFFECT_IMPACT_LEAD_MS = 60;
const DIALOGUE_LOG_DELAY_MS = 1500;
const FINAL_BATTLE_DIALOGUE_HOLD_MS = 3000;
const EFFECT_SETTLE_MS = 700;
const BATTLE_SPRITE_ACTION_HOLD_MS = 1280;
const BATTLE_SPRITE_HIT_HOLD_MS = 560;
const SFX_POOL_SIZE = 3;
const BGM_FADE_MS = 900;
const AUDIO_FULLY_READY_STATE = 4;
const AUDIO_SETTINGS_KEY = "versus.audio-settings.v1";
const TUTORIAL_ENABLED_KEY = "versus.tutorial-enabled.v1";
const ADVENTURE_STARTED_KEY = "versus.adventure-started.v1";
const DEFAULT_AUDIO_SETTINGS = Object.freeze({ bgm: 0.35, sfx: 0.5, muted: false });
const AdventureSave = window.VersusAdventureSave;
const AdventureAchievements = window.VersusAdventureAchievements;
const TUTORIAL_CHARACTER_ID = "plote";
const TUTORIAL_INSCRIPTION_ID = "gray";
const TUTORIAL_TOTAL_STEPS = 10;
const PREBATTLE_GUIDE_BY_MODE = Object.freeze({
  pve: {
    summary: "상단 설정은 왼쪽에서 오른쪽 순서입니다. ???를 유지하면 무작위로 선택합니다.",
    steps: [
      ["캐릭터 선택", "내 캐릭터를 고릅니다. ???도 바로 시작할 수 있습니다."],
      ["각인·상대·AI 설정", "보석 각인과 상대 캐릭터, AI 성향을 정합니다."],
      ["전투 시작", "노란 전투 시작 버튼을 누릅니다."],
    ],
  },
  adventure: {
    summary: "내 캐릭터와 각인을 정하면 바로 여정을 시작할 수 있습니다.",
    steps: [
      ["캐릭터 선택", "20개 스테이지를 함께할 캐릭터를 고릅니다."],
      ["각인 선택", "캐릭터 왼쪽 보석에서 공통 보정을 고릅니다."],
      ["새 모험 시작", "노란 새 모험 버튼을 누릅니다."],
    ],
  },
  pvp: {
    summary: "캐릭터를 정하고 방 코드를 입력하거나 무작위 매칭으로 입장하세요.",
    steps: [
      ["캐릭터 선택", "다른 플레이어와 겨룰 캐릭터를 고릅니다."],
      ["각인·방 코드 설정", "친구와 할 때만 방 코드를 맞추고, 비우면 무작위 매칭됩니다."],
      ["PvP 입장", "노란 PvP 입장 버튼을 누릅니다."],
    ],
  },
  "skill-debug": {
    summary: "테스트할 전투원을 고르면 나머지 조건은 자동으로 고정됩니다.",
    steps: [
      ["테스트 대상 선택", "스킬 동작을 확인할 전투원을 고릅니다."],
      ["고정 조건 확인", "상대 플로테와 행동 순서는 자동으로 고정됩니다."],
      ["디버그 시작", "노란 디버그 시작 버튼을 누릅니다."],
    ],
  },
});

function localAssetUrl(path) {
  const baseUrl = window.__VERSUS_BASE_URL__ || new URL("./", window.location.href).href;
  return new URL(String(path).replace(/^\/+/, ""), baseUrl).href;
}

const els = {
  homeScreen: document.querySelector("#homeScreen"),
  homeLoading: document.querySelector("#homeLoading"),
  homeLoadingError: document.querySelector("#homeLoadingError"),
  homeMenu: document.querySelector("#homeMenu"),
  playScreen: document.querySelector("#playScreen"),
  battleScreen: document.querySelector("#battleScreen"),
  battleHeader: document.querySelector("#battleHeader"),
  battleSetup: document.querySelector("#battleSetup"),
  battleScreenTitle: document.querySelector("#battleScreen .header-title strong"),
  rulesScreen: document.querySelector("#rulesScreen"),
  codexScreen: document.querySelector("#codexScreen"),
  achievementsScreen: document.querySelector("#achievementsScreen"),
  settingsScreen: document.querySelector("#settingsScreen"),
  openPlayButton: document.querySelector("#openPlayButton"),
  openAdventureButton: document.querySelector("#openAdventureButton"),
  adventureModeBadge: document.querySelector("#adventureModeBadge"),
  openBattleButton: document.querySelector("#openBattleButton"),
  openPvpButton: document.querySelector("#openPvpButton"),
  openSkillDebugButton: document.querySelector("#openSkillDebugButton"),
  openRulesButton: document.querySelector("#openRulesButton"),
  openCodexButton: document.querySelector("#openCodexButton"),
  openAchievementsButton: document.querySelector("#openAchievementsButton"),
  openSettingsButton: document.querySelector("#openSettingsButton"),
  exitButton: document.querySelector("#exitButton"),
  battleBackButton: document.querySelector("#battleBackButton"),
  rulesBackButton: document.querySelector("#rulesBackButton"),
  codexBackButton: document.querySelector("#codexBackButton"),
  achievementsBackButton: document.querySelector("#achievementsBackButton"),
  settingsBackButton: document.querySelector("#settingsBackButton"),
  playBackButton: document.querySelector("#playBackButton"),
  bgmVolumeSlider: document.querySelector("#bgmVolumeSlider"),
  bgmVolumeValue: document.querySelector("#bgmVolumeValue"),
  sfxVolumeSlider: document.querySelector("#sfxVolumeSlider"),
  sfxVolumeValue: document.querySelector("#sfxVolumeValue"),
  audioMuteButton: document.querySelector("#audioMuteButton"),
  audioResetButton: document.querySelector("#audioResetButton"),
  tutorialEnabledToggle: document.querySelector("#tutorialEnabledToggle"),
  rulesSubtitle: document.querySelector("#rulesSubtitle"),
  rulesContent: document.querySelector("#rulesContent"),
  rulesTabs: [...document.querySelectorAll("[data-rules-tab]")],
  rulesPanels: [...document.querySelectorAll("[data-rules-panel]")],
  inscriptionButton: document.querySelector("#inscriptionButton"),
  inscriptionPopover: document.querySelector("#inscriptionPopover"),
  playerSetupLabel: document.querySelector("#playerSetupLabel"),
  playerSelect: document.querySelector("#playerSelect"),
  aiSelect: document.querySelector("#aiSelect"),
  personalitySelect: document.querySelector("#personalitySelect"),
  pveSetupFields: [...document.querySelectorAll(".pve-setup-field")],
  pvpSetupFields: [...document.querySelectorAll(".pvp-setup-field")],
  pvpRoomInput: document.querySelector("#pvpRoomInput"),
  continueAdventureButton: document.querySelector("#continueAdventureButton"),
  startButton: document.querySelector("#startButton"),
  prebattleGuide: document.querySelector("#prebattleGuide"),
  prebattleSetupSlot: document.querySelector("#prebattleSetupSlot"),
  prebattleGuideSummary: document.querySelector("#prebattleGuideSummary"),
  prebattleStepTitles: [1, 2, 3].map((step) => document.querySelector(`#prebattleStep${step}Title`)),
  prebattleStepDetails: [1, 2, 3].map((step) => document.querySelector(`#prebattleStep${step}Detail`)),
  matchLabel: document.querySelector("#matchLabel"),
  turnChip: document.querySelector("#turnChip"),
  currentLogBox: document.querySelector("#currentLogBox"),
  currentLogText: document.querySelector("#currentLogText"),
  currentLogSkipHint: document.querySelector("#currentLogSkipHint"),
  battleLogToggleButton: document.querySelector("#battleLogToggleButton"),
  battleLogPanel: document.querySelector("#battleLogPanel"),
  battleLogCloseButton: document.querySelector("#battleLogCloseButton"),
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
  achievementsCount: document.querySelector("#achievementsCount"),
  achievementsTotalFill: document.querySelector("#achievementsTotalFill"),
  achievementsPercent: document.querySelector("#achievementsPercent"),
  achievementsList: document.querySelector("#achievementsList"),
  aiModeText: document.querySelector("#aiModeText"),
  enemyInfoButton: document.querySelector("#enemyInfoButton"),
  battleRecordButton: document.querySelector("#battleRecordButton"),
  playerInfoButton: document.querySelector("#playerInfoButton"),
  playerGold: document.querySelector("#playerGold"),
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
  characterPickerPreview: document.querySelector("#characterPickerPreview"),
  characterPickerPreviewContent: document.querySelector("#characterPickerPreviewContent"),
  characterPickerConfirmButton: document.querySelector("#characterPickerConfirmButton"),
  adventureRestartModal: document.querySelector("#adventureRestartModal"),
  adventureRestartScrim: document.querySelector("#adventureRestartScrim"),
  adventureRestartCancelButton: document.querySelector("#adventureRestartCancelButton"),
  adventureRestartConfirmButton: document.querySelector("#adventureRestartConfirmButton"),
};

const tutorialPointer = document.createElement("div");
tutorialPointer.className = "tutorial-pointer";
tutorialPointer.setAttribute("aria-hidden", "true");
tutorialPointer.hidden = true;
tutorialPointer.innerHTML = '<span aria-hidden="true">▼</span>';
els.battleScreen.append(tutorialPointer);
els.tutorialPointer = tutorialPointer;

let tutorialPointerFrame = 0;

const fighterIds = {
  player: {
    avatar: "#playerAvatar",
    hpBar: "#playerHpBar",
    mpBar: "#playerMpBar",
    hpText: "#playerHpText",
    mpText: "#playerMpText",
    state: "#playerState",
    statEffects: "#playerStatEffects",
  },
  ai: {
    avatar: "#aiAvatar",
    hpBar: "#aiHpBar",
    mpBar: "#aiMpBar",
    hpText: "#aiHpText",
    mpText: "#aiMpText",
    state: "#aiState",
    statEffects: "#aiStatEffects",
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
  zetoven: "#20d6c7",
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
  xenox: "#8371e6",
  winday: "#bcdca4",
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

const CHARACTER_SKILL_ICON_IDS = new Set(["toxiche", "cryne", "karossy", "gandrick", "melague", "balef", "plote", "charinel", "nihfle", "ashend", "dethus", "zetoven", "revesha", "serpen", "neroko", "happyrin", "librang", "dracle", "saqua", "queenas", "jitrom", "fimit", "emento", "necoulomb", "xenox", "winday"]);
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
  zetoven: "characters",
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
  xenox: "characters",
  winday: "characters",
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
const BATTLE_SPRITE_VARIANTS = Object.freeze({
  gandrick: Object.freeze(["iron-bullet", "demonic-bullet"]),
  dracle: Object.freeze(["dragon-stage-4", "dragon-stage-7", "dragon-stage-10"]),
});
const BATTLE_SPRITE_STATES = Object.freeze(["idle", "attack", "utility", "hit"]);
const BATTLE_SPRITE_STATE_ASSET_IDS = new Set(["toxiche", "karossy", "plote", "ashend", "cryne", "balef", "nihfle", "serpen", "melague", "revesha", "gandrick", "zetoven", "neroko", "happyrin", "dethus", "librang", "charinel", "queenas", "saqua", "jitrom", "necoulomb", "emento", "xenox", "fimit", "winday", "dracle", "demon_scout_kain", "demon_warrior_luke", "demon_mage_zero", "demon_archer_robin", "demon_priest_sara", "demon_fighter_gran", "demon_pawn_opawn", "demon_rook_chatrang", "demon_knight_kaighton", "demon_bishop_eveque", "demon_king_monochrem"]);
const BATTLE_SPRITE_STATE_VARIANT_KEYS = new Set(["gandrick:iron-bullet", "gandrick:demonic-bullet", "dracle:dragon-stage-4", "dracle:dragon-stage-7", "dracle:dragon-stage-10"]);
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
const BATTLE_BACKGROUNDS = Object.freeze({
  neutral: "/assets/backgrounds/battle/neutral-arena.webp",
  forest: "/assets/backgrounds/battle/adventure-forest.webp",
  village: "/assets/backgrounds/battle/adventure-village.webp",
  event: "/assets/backgrounds/battle/adventure-event-gravel.webp",
  relicShop: "/assets/backgrounds/battle/adventure-relic-shop.webp",
  monochromeForest: "/assets/backgrounds/battle/adventure-monochrome-forest.webp",
  demonCastle: "/assets/backgrounds/battle/adventure-demon-castle.webp",
});
const ADVENTURE_OPPONENT_SPRITE_PHASES = new Set([
  "battle",
  "defeat",
  "final_battle_dialogue",
  "final_battle_ending",
]);
const ADVENTURE_BACKGROUND_HOLD_PHASES = new Set(["reward", "route"]);
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
  logExpanded: false,
  logSkipRequested: false,
  logSkipResolve: null,
  adventureRestartRequested: false,
  adventureRestartConfirmResolve: null,
  adventureSave: null,
  adventureStarted: false,
  adventureBackgroundKey: null,
  customSelects: [],
  characterPickers: [],
  activeCharacterPicker: null,
  characterPickerItems: [],
  characterPickerPreviewItem: null,
  selectedInscriptionId: DEFAULT_INSCRIPTION_OPTIONS[0].id,
  normalPlayerSelection: "random",
  skillDebugCombatantId: "",
  tutorial: null,
  effectTimers: [],
  spriteStateTokens: { player: 0, ai: 0 },
  preloadedSpriteUrls: new Set(),
  sfx: new Map(),
  bgm: new Map(),
  audioPrimed: false,
  bgmFadeTimers: [],
  bgmRequestToken: 0,
  currentBgm: null,
  currentBgmType: null,
  audioSettings: { ...DEFAULT_AUDIO_SETTINGS },
  tutorialEnabled: true,
  achievements: AdventureAchievements.emptyState(),
};

init();

async function init() {
  if (window.__VERSUS_MOBILE_RUNTIME__?.platform === "web") {
    els.exitButton.hidden = true;
  }
  state.audioSettings = loadAudioSettings();
  state.tutorialEnabled = loadTutorialEnabled();
  state.adventureStarted = loadAdventureStarted();
  state.achievements = AdventureAchievements.load(window.localStorage);
  syncAudioSettingsControls();
  syncTutorialSettingControl();
  organizeRulesPanels();
  bindEvents();
  syncInscriptionPicker();
  setBattleMode("pve");
  renderEmptyBattle();
  renderEmptyActions();
  renderLog();
  const optionsReady = await loadOptions();
  finishInitialLoading(optionsReady);
  if (!optionsReady) return;
  preloadStartupBgm();
  await applyStartupHash();
}

function finishInitialLoading(ready) {
  if (ready) {
    els.homeLoading.hidden = true;
    els.homeMenu.hidden = false;
    return;
  }
  els.homeLoading.classList.add("is-error");
  els.homeLoading.setAttribute("aria-label", "게임을 불러오지 못했습니다");
  els.homeLoadingError.hidden = false;
}

function bindEvents() {
  els.openPlayButton.addEventListener("click", openPlayEntry);
  els.openAdventureButton.addEventListener("click", openAdventureMode);
  els.openBattleButton.addEventListener("click", () => openBattleMode("pve"));
  els.openPvpButton.addEventListener("click", () => openBattleMode("pvp"));
  els.openSkillDebugButton.addEventListener("click", () => openBattleMode("skill-debug"));
  els.openRulesButton.addEventListener("click", () => showScreen("rules"));
  els.openCodexButton.addEventListener("click", () => showScreen("codex"));
  els.openAchievementsButton.addEventListener("click", () => showScreen("achievements"));
  els.openSettingsButton.addEventListener("click", () => showScreen("settings"));
  els.battleBackButton.addEventListener("click", leaveBattleScreen);
  els.rulesBackButton.addEventListener("click", () => showScreen("home"));
  els.codexBackButton.addEventListener("click", () => showScreen("home"));
  els.achievementsBackButton.addEventListener("click", () => showScreen("home"));
  els.settingsBackButton.addEventListener("click", () => showScreen("home"));
  els.playBackButton.addEventListener("click", () => showScreen("home"));
  els.bgmVolumeSlider.addEventListener("input", () => setAudioVolume("bgm", els.bgmVolumeSlider.value));
  els.sfxVolumeSlider.addEventListener("input", () => setAudioVolume("sfx", els.sfxVolumeSlider.value));
  els.sfxVolumeSlider.addEventListener("change", () => playEffectSound("buff"));
  els.audioMuteButton.addEventListener("click", toggleAudioMuted);
  els.audioResetButton.addEventListener("click", resetAudioSettings);
  els.tutorialEnabledToggle.addEventListener("change", () => setTutorialEnabled(els.tutorialEnabledToggle.checked));
  for (const tab of els.rulesTabs) {
    tab.addEventListener("click", () => selectRulesTab(tab.dataset.rulesTab));
    tab.addEventListener("keydown", handleRulesTabKeydown);
  }
  els.exitButton.addEventListener("click", exitApp);
  els.inscriptionButton.addEventListener("click", toggleInscriptionPopover);
  els.continueAdventureButton.addEventListener("click", continueAdventure);
  els.startButton.addEventListener("click", startConfiguredBattle);
  els.pvpRoomInput.addEventListener("input", previewSelectedMatch);
  els.prevLogButton.addEventListener("click", () => moveLog(-1));
  els.nextLogButton.addEventListener("click", () => moveLog(1));
  els.currentLogBox.addEventListener("click", skipLogAnimation);
  els.battleLogToggleButton.addEventListener("click", () => setBattleLogExpanded(true, { focusPanel: true }));
  els.battleLogCloseButton.addEventListener("click", () => setBattleLogExpanded(false, { restoreFocus: true }));
  els.adventureRouteRerollButton.addEventListener("click", () => chooseAdventureChoice("route_reroll"));
  els.enemyInfoButton.addEventListener("click", () => openFighterInfo("ai"));
  els.battleRecordButton.addEventListener("click", openBattleRecords);
  els.playerInfoButton.addEventListener("click", () => openFighterInfo("player"));
  els.enemyInfoScrim.addEventListener("click", closeInfoModal);
  els.enemyInfoCloseButton.addEventListener("click", closeInfoModal);
  els.characterPickerScrim.addEventListener("click", closeCharacterPicker);
  els.characterPickerCloseButton.addEventListener("click", closeCharacterPicker);
  els.characterPickerConfirmButton.addEventListener("click", confirmCharacterPickerSelection);
  els.characterPickerModal.addEventListener("keydown", trapCharacterPickerFocus);
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
      if (state.logExpanded) setBattleLogExpanded(false, { restoreFocus: true });
    }
  });
  window.addEventListener("resize", scheduleTutorialPointerSync);
  els.characterPickerGrid.addEventListener("scroll", scheduleTutorialPointerSync, { passive: true });
  els.inscriptionPopover.addEventListener("scroll", scheduleTutorialPointerSync, { passive: true });
  window.addEventListener("pagehide", notifyPvpLeaveOnPageHide);
}

function openBattleMode(mode) {
  els.pvpRoomInput.value = "";
  setBattleMode(mode);
  resetBattleScreen();
  previewSelectedMatch();
  showScreen("battle");
}

function openPlayEntry() {
  if (state.tutorialEnabled && state.options) {
    openTutorialMode();
    return;
  }
  showScreen("play");
}

function openTutorialMode() {
  if (!state.options) return;
  els.pvpRoomInput.value = "";
  setBattleMode("tutorial");
  resetBattleScreen();
  state.tutorial = {
    setupStep: 1,
    inscriptionChosen: false,
    started: false,
  };
  state.selectedInscriptionId = TUTORIAL_INSCRIPTION_ID;
  syncInscriptionPicker();
  renderTutorialSetupLog();
  previewSelectedMatch();
  syncSetupLock();
  showScreen("battle");
}

function scheduleTutorialPointerSync() {
  if (tutorialPointerFrame) return;
  tutorialPointerFrame = window.requestAnimationFrame(() => {
    tutorialPointerFrame = 0;
    syncTutorialPointer();
  });
}

function syncTutorialPointer() {
  const pointer = els.tutorialPointer;
  const isTutorialVisible = state.battleMode === "tutorial"
    && els.battleScreen.classList.contains("is-active");
  if (!isTutorialVisible) {
    pointer.hidden = true;
    return;
  }

  const candidates = [
    els.characterPickerModal.hidden
      ? null
      : els.characterPickerConfirmButton.classList.contains("is-tutorial-target")
        ? els.characterPickerConfirmButton
        : els.characterPickerGrid.querySelector(".character-picker-tile.is-tutorial-target"),
    els.inscriptionPopover.hidden
      ? null
      : els.inscriptionPopover.querySelector(".inscription-option.is-tutorial-target"),
    els.actionsGrid.querySelector(".action-button.is-tutorial-target"),
    els.battleScreen.classList.contains("tutorial-focus-character")
      ? els.battleScreen.querySelector(".player-setup-field .character-picker-button")
      : null,
    els.battleScreen.classList.contains("tutorial-focus-inscription") ? els.inscriptionButton : null,
    els.battleScreen.classList.contains("tutorial-focus-start") ? els.startButton : null,
  ];
  const target = candidates.find((candidate) => candidate && candidate.getClientRects().length);
  if (!target) {
    pointer.hidden = true;
    return;
  }

  const rect = target.getBoundingClientRect();
  const placeBelow = rect.top < 48;
  const centerX = Math.max(22, Math.min(window.innerWidth - 22, rect.left + rect.width / 2));
  pointer.dataset.placement = placeBelow ? "below" : "above";
  pointer.querySelector("span").textContent = placeBelow ? "▲" : "▼";
  pointer.style.left = `${centerX}px`;
  pointer.style.top = `${placeBelow ? rect.bottom + 5 : rect.top - 5}px`;
  pointer.hidden = false;
}

function selectedTutorialCharacter() {
  return state.options?.characters?.find((character) => String(character.index) === String(els.playerSelect.value)) || null;
}

function advanceTutorialCharacterStep() {
  if (state.battleMode !== "tutorial" || !state.tutorial || state.tutorial.started) return;
  const selected = selectedTutorialCharacter();
  if (selected?.id === TUTORIAL_CHARACTER_ID) {
    state.tutorial.setupStep = 2;
  } else {
    state.tutorial.setupStep = 1;
    state.tutorial.inscriptionChosen = false;
  }
  renderTutorialSetupLog();
  syncSetupLock();
}

function renderTutorialSetupLog() {
  els.battleScreen.classList.remove("tutorial-focus-character", "tutorial-focus-inscription", "tutorial-focus-start");
  const isSetup = state.battleMode === "tutorial" && state.tutorial && !state.tutorial.started && !state.battle;
  if (!isSetup) {
    scheduleTutorialPointerSync();
    return;
  }

  const step = Number(state.tutorial.setupStep || 1);
  const instructions = {
    1: {
      title: "캐릭터 선택",
      lines: [
        "먼저 플로테를 선택해 봅시다.",
        "이번 훈련에서는 플로테만 선택할 수 있지만, 실제 전투에서는 캐릭터마다 서로 다른 스킬과 고유 상태로 심리전을 펼칩니다.",
        "튜토리얼을 건너뛰려면 왼쪽 위의 ‘뒤로’를 누르세요.",
      ],
      focusClass: "tutorial-focus-character",
    },
    2: {
      title: "각인 선택",
      lines: [
        "이번에는 아무 보정이 없는 Gray 각인을 골라봅시다.",
        "다른 각인은 지금 선택할 수 없지만, 각 항목의 설명에서 공격·방어·속도·MP 운용 등이 어떻게 달라지는지 살펴볼 수 있습니다.",
      ],
      focusClass: "tutorial-focus-inscription",
    },
    3: {
      title: "전투 준비 완료",
      lines: [
        "플로테와 Gray 각인이 준비되었습니다. 상대는 루크로 고정됩니다.",
        "오른쪽 위의 ‘전투 시작’을 눌러봅시다.",
      ],
      focusClass: "tutorial-focus-start",
    },
  };
  const instruction = instructions[step] || instructions[1];
  els.battleScreen.classList.add(instruction.focusClass);
  scheduleTutorialPointerSync();
  clearLogs();
  void pushTurnLog(
    `튜토리얼 · STEP ${Math.min(3, step)} / ${TUTORIAL_TOTAL_STEPS} · ${instruction.title}`,
    instruction.lines.map((line) => `[튜토리얼] ${line}`),
    true,
  );
}

async function openAdventureMode() {
  els.pvpRoomInput.value = "";
  setBattleMode("adventure");
  resetBattleScreen();
  state.adventureSave = AdventureSave?.loadAdventureSave(adventureStorage()) || null;
  if (state.adventureSave) markAdventureStarted();
  prepareAdventureSetup();
  showScreen("battle");
  if (!state.adventureSave) {
    window.requestAnimationFrame(() => {
      if (
        state.battleMode !== "adventure"
        || state.battle
        || state.adventureSave
        || state.busy
        || !els.battleScreen.classList.contains("is-active")
      ) return;
      const playerPicker = state.characterPickers.find((picker) => picker.select === els.playerSelect);
      if (playerPicker && !playerPicker.button.disabled) openCharacterPicker(playerPicker);
    });
  }
}

async function continueAdventure() {
  if (state.battleMode !== "adventure" || !state.adventureSave || state.battle || state.busy) return;

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
    syncAdventureEntryActions();
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
  syncPrebattleGuide(false);
  syncAdventureEntryActions();
  previewSelectedMatch();
  els.turnChip.textContent = "PROLOGUE";
  pushTurnLog("Adventure", ["캐릭터를 고르고 새 여정을 시작하세요."], false);
  renderEmptyActions("새 여정을 시작하세요.");
}

function syncAdventureEntryActions() {
  const hasContinuableSave = state.battleMode === "adventure"
    && !state.battle
    && Boolean(state.adventureSave);
  els.continueAdventureButton.hidden = !hasContinuableSave;
  els.continueAdventureButton.disabled = state.busy;
  els.battleScreen.classList.toggle("has-adventure-save", hasContinuableSave);
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
  state.adventureBackgroundKey = null;
  state.pvp = null;
  state.busy = false;
  state.adventureRestartRequested = false;
  state.tutorial = null;
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
  if (state.battleMode === "skill-debug") {
    const combatants = sortCharacters(skillDebugConfig()?.combatants || []);
    const requested = state.skillDebugCombatantId;
    els.playerSelect.value = combatants.some((combatant) => combatant.id === requested)
      ? requested
      : String(combatants[0]?.id || "");
    state.skillDebugCombatantId = els.playerSelect.value;
  } else {
    els.playerSelect.value = "random";
  }
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
  scheduleTutorialPointerSync();
}

function closeInscriptionPopover() {
  els.inscriptionPopover.hidden = true;
  els.inscriptionButton.setAttribute("aria-expanded", "false");
  scheduleTutorialPointerSync();
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
    const tutorialRestricted = state.battleMode === "tutorial" && state.tutorial && !state.tutorial.started;
    const isTutorialTarget = tutorialRestricted && option.id === TUTORIAL_INSCRIPTION_ID;
    item.type = "button";
    item.className = `inscription-option${isSelected ? " is-selected" : ""}`;
    item.classList.toggle("is-tutorial-target", isTutorialTarget);
    item.disabled = tutorialRestricted && !isTutorialTarget;
    item.style.setProperty("--inscription-color", option.color);
    item.dataset.inscriptionId = option.id;
    item.setAttribute("aria-label", `각인: ${option.summary}. ${option.detail}`);
    item.setAttribute("aria-disabled", String(item.disabled));
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
      if (state.battleMode === "tutorial" && state.tutorial && !state.tutorial.started) {
        if (option.id !== TUTORIAL_INSCRIPTION_ID) return;
        state.selectedInscriptionId = TUTORIAL_INSCRIPTION_ID;
        state.tutorial.inscriptionChosen = true;
        state.tutorial.setupStep = 3;
      } else {
        state.selectedInscriptionId = option.id;
      }
      syncInscriptionPicker();
      closeInscriptionPopover();
      renderTutorialSetupLog();
      syncSetupLock();
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

function prepareBgm(types = Object.keys(BGM_TRACKS)) {
  for (const type of types) {
    if (state.bgm.has(type)) continue;
    const track = BGM_TRACKS[type];
    if (!track) continue;
    const audio = new Audio();
    audio.preload = track.preload === false ? "none" : "auto";
    audio.loop = Boolean(track.loop);
    audio.volume = effectiveBgmVolume(track);
    audio.src = track.src;
    state.bgm.set(type, audio);
  }
}

function preloadStartupBgm() {
  const types = Object.entries(BGM_TRACKS)
    .filter(([, track]) => track.preload !== false)
    .map(([type]) => type);
  prepareBgm(types);
  for (const type of types) {
    const audio = state.bgm.get(type);
    if (!audio || audio.readyState >= AUDIO_FULLY_READY_STATE) continue;
    const discardFailedPreload = () => {
      if (state.bgm.get(type) === audio && state.currentBgm !== audio) {
        state.bgm.delete(type);
      }
    };
    audio.addEventListener("error", discardFailedPreload, { once: true });
    try {
      audio.load();
    } catch {
      discardFailedPreload();
    }
  }
}

function primeAudio() {
  if (state.audioPrimed) return;
  primeSfx();
  prepareBgm();
  for (const [type, audio] of state.bgm.entries()) {
    if (BGM_TRACKS[type]?.preload !== false && audio.readyState < AUDIO_FULLY_READY_STATE) audio.load();
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

function loadTutorialEnabled() {
  try {
    const stored = window.localStorage.getItem(TUTORIAL_ENABLED_KEY);
    return stored == null ? true : stored === "true";
  } catch {
    return true;
  }
}

function setTutorialEnabled(enabled) {
  state.tutorialEnabled = Boolean(enabled);
  try {
    window.localStorage.setItem(TUTORIAL_ENABLED_KEY, String(state.tutorialEnabled));
  } catch {
    // The setting still works for this session when storage is unavailable.
  }
  syncTutorialSettingControl();
}

function syncTutorialSettingControl() {
  els.tutorialEnabledToggle.checked = state.tutorialEnabled;
  els.tutorialEnabledToggle.setAttribute("aria-checked", String(state.tutorialEnabled));
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
  for (const screen of [els.homeScreen, els.playScreen, els.battleScreen, els.rulesScreen, els.codexScreen, els.achievementsScreen, els.settingsScreen]) {
    screen.classList.remove("is-active");
  }
  if (name === "play") {
    stopBgm();
    syncAdventureRecommendation();
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
  } else if (name === "achievements") {
    primeAudio();
    playBgm("village");
    renderAchievements();
    els.achievementsScreen.classList.add("is-active");
  } else if (name === "settings") {
    primeAudio();
    playBgm("village");
    syncAudioSettingsControls();
    els.settingsScreen.classList.add("is-active");
  } else {
    stopBgm();
    els.homeScreen.classList.add("is-active");
  }
  scheduleTutorialPointerSync();
}

const RULES_TAB_LABELS = Object.freeze({
  "how-to-play": "How to Play",
  rulings: "Rulings",
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

function organizeRulesPanels() {
  const howToPanel = document.querySelector("#rulesPanelHowTo");
  const rulingsPanel = document.querySelector("#rulesPanelRulings");
  if (!howToPanel || !rulingsPanel) return;
  for (const section of howToPanel.querySelectorAll('[data-rules-category="rulings"]')) {
    rulingsPanel.append(section);
  }
  renumberRulesSections(howToPanel);
  renumberRulesSections(rulingsPanel);
}

function renumberRulesSections(panel) {
  const sections = [...panel.querySelectorAll(":scope > .rules-section")];
  sections.forEach((section, index) => {
    const number = section.querySelector(":scope > .rules-section-heading > span");
    if (number) number.textContent = String(index + 1).padStart(2, "0");
  });
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
  const leavesTutorial = state.battleMode === "tutorial";
  els.pvpRoomInput.value = "";
  if (leavesTutorial) {
    setTutorialEnabled(false);
    resetBattleScreen();
    setBattleMode("pve");
  }
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

function syncPrebattleGuide(hasBattle = Boolean(state.battle)) {
  const isPrebattle = !hasBattle && state.battleMode !== "tutorial";
  const setupHost = isPrebattle ? els.prebattleSetupSlot : els.battleHeader;
  if (els.battleSetup.parentElement !== setupHost) setupHost.append(els.battleSetup);
  els.battleScreen.classList.toggle("is-prebattle", isPrebattle);
  els.prebattleGuide.hidden = !isPrebattle;
  syncAdventureEntryActions();
  if (!isPrebattle) return;

  const guide = PREBATTLE_GUIDE_BY_MODE[state.battleMode] || PREBATTLE_GUIDE_BY_MODE.pve;
  els.prebattleGuideSummary.textContent = guide.summary;
  guide.steps.forEach(([title, detail], index) => {
    els.prebattleStepTitles[index].textContent = title;
    els.prebattleStepDetails[index].textContent = detail;
  });
}

function setBattleMode(mode) {
  const previousMode = state.battleMode;
  const nextMode = mode === "pvp"
    ? "pvp"
    : mode === "adventure"
      ? "adventure"
      : mode === "skill-debug"
        ? "skill-debug"
        : mode === "tutorial"
          ? "tutorial"
        : "pve";
  if (state.options && previousMode !== nextMode) {
    if (previousMode === "skill-debug") state.skillDebugCombatantId = els.playerSelect.value;
    else state.normalPlayerSelection = els.playerSelect.value;
  }
  state.battleMode = nextMode;
  const isPvp = state.battleMode === "pvp";
  const isAdventure = state.battleMode === "adventure";
  const isSkillDebug = state.battleMode === "skill-debug";
  const isTutorial = state.battleMode === "tutorial";
  if (!isPvp) {
    stopPvpPolling();
    state.pvp = null;
  }
  els.battleScreen.classList.toggle("is-pvp", isPvp);
  els.battleScreen.classList.toggle("is-pve", state.battleMode === "pve" || isTutorial);
  els.battleScreen.classList.toggle("is-adventure", isAdventure);
  els.battleScreen.classList.toggle("is-skill-debug", isSkillDebug);
  els.battleScreen.classList.toggle("is-tutorial", isTutorial);
  els.battleScreenTitle.textContent = isAdventure ? "Adventure" : isSkillDebug ? "Skill Debug" : isTutorial ? "Tutorial" : "전투";
  syncBattleBackground();
  els.playerSetupLabel.textContent = isSkillDebug ? "테스트 대상" : "내 캐릭터";
  els.inscriptionButton.hidden = isSkillDebug;
  for (const field of els.pveSetupFields) {
    field.hidden = isPvp || isAdventure || isSkillDebug || isTutorial;
  }
  for (const field of els.pvpSetupFields) {
    field.hidden = !isPvp;
  }
  els.startButton.hidden = false;
  els.startButton.textContent = isAdventure ? "새 모험" : isPvp ? "PvP 입장" : isSkillDebug ? "디버그 시작" : "전투 시작";
  syncPlayerCombatantOptions(previousMode === "skill-debug", isSkillDebug);
  syncSetupLock();
  previewSelectedMatch();
  syncPrebattleGuide();
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
    state.achievements = AdventureAchievements.syncUnlocks(data.adventureAchievements || [], state.achievements);
    AdventureAchievements.save(window.localStorage, state.achievements);

    els.openSkillDebugButton.hidden = !data.devTools?.skillDebug;

    syncPlayerCombatantOptions(false, state.battleMode === "skill-debug");
    fillSelect(els.aiSelect, data.characters, "index", "name", true, "???");
    fillSelect(els.personalitySelect, data.personalities, "id", "name", true);

    for (const select of [els.playerSelect, els.aiSelect, els.personalitySelect]) {
      select.addEventListener("change", () => {
        previewSelectedMatch();
        if (select === els.playerSelect) advanceTutorialCharacterStep();
      });
    }
    enhanceCharacterSelect(els.playerSelect, "player", "내 캐릭터");
    enhanceCharacterSelect(els.aiSelect, "ai", "상대 캐릭터");
    enhanceSelect(els.personalitySelect);
    syncInscriptionPicker();
    previewSelectedMatch();
    renderCodex();
    renderAchievements();
    return true;
  } catch (error) {
    pushTurnLog("오류", [`옵션 로드 실패: ${error.message}`], false);
    return false;
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
  } else if (hash === "#achievements") {
    showScreen("achievements");
  }
}

function syncAchievements(battleState) {
  if (!battleState?.adventure || !state.options?.adventureAchievements) return;
  state.achievements = AdventureAchievements.recordBattleState(
    window.localStorage,
    state.options.adventureAchievements,
    battleState,
  );
}

function achievementProgressText(item) {
  if (item.unlocked) return "달성";
  if (item.metric === "best_single_attack_damage" || item.metric === "best_single_fixed_damage") {
    return `최고 ${item.current} / ${item.target}`;
  }
  if (item.metric === "best_final_hp_percent") {
    return `최고 ${item.current}% / ${item.target}%`;
  }
  if (item.metric === "most_relics_at_clear") {
    return `최고 ${item.current} / ${item.target}`;
  }
  return "미달성";
}

function renderAchievements() {
  const items = AdventureAchievements.view(state.options?.adventureAchievements || [], state.achievements);
  const unlockedCount = items.filter((item) => item.unlocked).length;
  const percent = items.length ? Math.round((unlockedCount / items.length) * 100) : 0;
  els.achievementsCount.textContent = `${unlockedCount} / ${items.length}`;
  els.achievementsPercent.textContent = `${percent}% COMPLETE`;
  els.achievementsTotalFill.style.width = `${percent}%`;
  els.achievementsList.innerHTML = items.map((item, index) => `
    <article class="achievement-row${item.unlocked ? " is-unlocked" : ""}">
      <span class="achievement-index">${String(index + 1).padStart(2, "0")}</span>
      <div class="achievement-copy">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
      </div>
      <strong class="achievement-state">${escapeHtml(achievementProgressText(item))}</strong>
    </article>
  `).join("");
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
  select.tabIndex = -1;
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
  const character = selectableCombatantsForPicker(api)
    .find((item) => String(combatantPickerValue(item, api)) === String(select.value)) || null;
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
  const label = state.battleMode === "skill-debug" && api.select === els.playerSelect
    ? "테스트 대상"
    : api.label;
  const tutorialPlayerPicker = state.battleMode === "tutorial" && api.select === els.playerSelect;
  els.characterPickerTitle.textContent = tutorialPlayerPicker ? "플로테를 선택해 봅시다" : `${label} 선택`;
  const items = renderCharacterPickerGrid(api);
  const selectedValue = String(api.select.value);
  const initialItem = items.find((item) => item.value === selectedValue && !item.disabled)
    || items.find((item) => !item.disabled)
    || null;
  setCharacterPickerPreview(initialItem);
  els.characterPickerModal.hidden = false;
  window.requestAnimationFrame(() => {
    const previewed = els.characterPickerGrid.querySelector(".character-picker-tile.is-previewed:not(:disabled)");
    const firstAvailable = els.characterPickerGrid.querySelector(".character-picker-tile:not(:disabled)");
    (previewed || firstAvailable || els.characterPickerCloseButton).focus();
    syncTutorialPointer();
  });
}

function closeCharacterPicker() {
  const trigger = state.activeCharacterPicker?.button;
  const shouldRestoreFocus = !els.characterPickerModal.hidden
    && trigger?.isConnected
    && !trigger.disabled
    && els.characterPickerModal.contains(document.activeElement);
  els.characterPickerModal.hidden = true;
  state.activeCharacterPicker = null;
  state.characterPickerItems = [];
  state.characterPickerPreviewItem = null;
  els.characterPickerConfirmButton.classList.remove("is-tutorial-target");
  if (shouldRestoreFocus) trigger.focus();
  scheduleTutorialPointerSync();
}

function trapCharacterPickerFocus(event) {
  if (event.key !== "Tab" || els.characterPickerModal.hidden) return;
  const panel = els.characterPickerModal.querySelector(".character-picker-panel");
  const focusable = [...panel.querySelectorAll("button:not(:disabled)")]
    .filter((button) => button.getClientRects().length);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function characterPickerPlaystyleText(character) {
  for (const key of ["playstyle_summary", "playstyle"]) {
    const value = character?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function characterPickerStats(character) {
  const stats = character?.stats || {};
  return [
    ["HP", stats.hp ?? character?.hp ?? "-"],
    ["ATK", stats.atk ?? character?.atk ?? "-"],
    ["DEF", stats.def ?? character?.def ?? "-"],
    ["SPD", stats.spd ?? character?.spd ?? "-"],
  ];
}

function characterPickerUniqueStatuses(character) {
  const statuses = character?.unique_statuses ?? character?.uniqueStatuses;
  return Array.isArray(statuses) ? statuses.filter((status) => status?.name || status?.description) : [];
}

function characterPickerPreviewHtml(item, api) {
  if (!item?.character) {
    return `
      <div class="character-picker-preview-hero is-random">
        <div class="character-picker-preview-visual">
          ${characterPickerThumbHtml(null, api?.side || "player", true)}
        </div>
        <div class="character-picker-preview-identity">
          <span>HOW TO PLAY</span>
          <h3>???</h3>
          <p class="character-picker-preview-title">무작위 선택</p>
        </div>
      </div>
      <p class="character-picker-preview-random-copy">전투 시작 시 사용할 캐릭터가 무작위로 결정됩니다.</p>
    `;
  }

  const character = item.character;
  const playstyle = characterPickerPlaystyleText(character);
  const passive = character.passive || {};
  const statuses = characterPickerUniqueStatuses(character);
  const status = statuses[0] || null;
  const remainingStatusCount = Math.max(0, statuses.length - 1);
  const statsHtml = characterPickerStats(character).map(([label, value]) => `
    <span><small>${label}</small><strong>${escapeHtml(String(value))}</strong></span>
  `).join("");
  const passiveHtml = passive.name || passive.description ? `
    <section class="character-picker-preview-rule">
      <span>PASSIVE</span>
      <strong>${escapeHtml(passive.name || "패시브")}</strong>
      ${passive.description ? `<p>${escapeHtml(passive.description)}</p>` : ""}
    </section>
  ` : "";
  const statusHtml = status ? `
    <section class="character-picker-preview-rule">
      <span>UNIQUE STATUS</span>
      <strong>${escapeHtml(status.name || "고유 상태")}${remainingStatusCount ? ` 외 ${remainingStatusCount}개` : ""}</strong>
      ${status.description ? `<p>${escapeHtml(status.description)}</p>` : ""}
    </section>
  ` : "";

  return `
    <div class="character-picker-preview-hero">
      <div class="character-picker-preview-visual">
        ${characterPickerThumbHtml(character, api?.side || "player")}
      </div>
      <div class="character-picker-preview-identity">
        <span>HOW TO PLAY</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p class="character-picker-preview-title">${escapeHtml(item.title || character.title || "")}</p>
      </div>
    </div>
    ${playstyle ? `<p class="character-picker-preview-playstyle">${escapeHtml(playstyle)}</p>` : ""}
    <div class="character-picker-preview-stats" aria-label="기본 능력치">${statsHtml}</div>
    <div class="character-picker-preview-rules">${passiveHtml}${statusHtml}</div>
  `;
}

function setCharacterPickerPreview(item, { activated = false } = {}) {
  const api = state.activeCharacterPicker;
  if (!api || !item || item.disabled) return;
  state.characterPickerPreviewItem = item;
  const color = item.character ? characterColor(item.character.id) : RANDOM_CHARACTER_COLOR;
  els.characterPickerPreview.style.setProperty("--character-color", color);
  els.characterPickerPreview.classList.toggle("is-random", !item.character);
  els.characterPickerPreviewContent.innerHTML = characterPickerPreviewHtml(item, api);

  for (const tile of els.characterPickerGrid.querySelectorAll(".character-picker-tile")) {
    const isPreviewed = tile.dataset.characterValue === String(item.value);
    tile.classList.toggle("is-previewed", isPreviewed);
    tile.setAttribute("aria-pressed", String(isPreviewed));
  }

  const tutorialConfirmTarget = state.battleMode === "tutorial"
    && state.tutorial
    && !state.tutorial.started
    && api.select === els.playerSelect
    && activated
    && item.character?.id === TUTORIAL_CHARACTER_ID;
  els.characterPickerConfirmButton.disabled = false;
  els.characterPickerConfirmButton.classList.toggle("is-tutorial-target", Boolean(tutorialConfirmTarget));
  els.characterPickerConfirmButton.setAttribute("aria-label", `${api.label}: ${item.name} 선택 확정`);
  scheduleTutorialPointerSync();
}

function usesDirectCharacterPickerSelection() {
  return Boolean(window.matchMedia?.("(hover: hover) and (pointer: fine)").matches);
}

function applyCharacterPickerSelection(api, item) {
  if (!api || !item || item.disabled) return;
  const advancesTutorial = state.battleMode === "tutorial"
    && state.tutorial
    && !state.tutorial.started
    && api.select === els.playerSelect
    && item.character?.id === TUTORIAL_CHARACTER_ID;
  api.select.value = item.value;
  api.select.dispatchEvent(new Event("change", { bubbles: true }));
  if (!els.characterPickerModal.hidden) closeCharacterPicker();
  if (advancesTutorial && !els.inscriptionButton.disabled) els.inscriptionButton.focus();
}

function confirmCharacterPickerSelection() {
  applyCharacterPickerSelection(state.activeCharacterPicker, state.characterPickerPreviewItem);
}

function renderCharacterPickerGrid(api) {
  const selectedValue = String(api.select.value);
  const characters = selectableCombatantsForPicker(api);
  const includeRandom = !(state.battleMode === "skill-debug" && api.select === els.playerSelect);
  const items = [
    ...(includeRandom ? [{ value: "random", name: "???", title: "무작위", character: null }] : []),
    ...characters.map((character) => ({
      value: String(combatantPickerValue(character, api)),
      name: skillDebugCombatantDisplayName(character, api),
      title: character.title,
      character,
    })),
  ];

  els.characterPickerGrid.innerHTML = "";
  for (const item of items) {
    const button = document.createElement("button");
    const tutorialRestricted = state.battleMode === "tutorial"
      && state.tutorial
      && !state.tutorial.started
      && api.select === els.playerSelect;
    const isTutorialTarget = tutorialRestricted && item.character?.id === TUTORIAL_CHARACTER_ID;
    button.type = "button";
    button.className = `character-picker-tile${item.value === selectedValue ? " is-selected" : ""}`;
    button.classList.toggle("is-random", !item.character);
    button.classList.toggle("is-tutorial-target", isTutorialTarget);
    button.disabled = tutorialRestricted && !isTutorialTarget;
    item.disabled = button.disabled;
    button.dataset.characterValue = item.value;
    button.style.setProperty(
      "--character-color",
      item.character ? characterColor(item.character.id) : RANDOM_CHARACTER_COLOR,
    );
    button.setAttribute("aria-label", `${api.label}: ${item.name}`);
    button.setAttribute("aria-disabled", String(button.disabled));
    if (item.value === selectedValue) {
      button.setAttribute("aria-current", "true");
    }
    button.innerHTML = `
      <span class="character-picker-tile-visual">
        ${characterPickerThumbHtml(item.character, api.side, item.value === "random")}
      </span>
      <strong>${escapeHtml(item.name)}</strong>
    `;
    button.addEventListener("pointerenter", () => {
      if (!button.disabled) setCharacterPickerPreview(item);
    });
    button.addEventListener("focus", () => {
      if (!button.disabled) setCharacterPickerPreview(item);
    });
    button.addEventListener("click", (event) => {
      if (button.disabled) return;
      setCharacterPickerPreview(item, { activated: true });
      if (usesDirectCharacterPickerSelection()) {
        applyCharacterPickerSelection(api, item);
      } else if (event.detail === 0) {
        els.characterPickerConfirmButton.focus();
      }
    });
    els.characterPickerGrid.append(button);
  }
  state.characterPickerItems = items;
  return items;
}

function enhanceSelect(select) {
  select.classList.add("native-select");
  select.tabIndex = -1;
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
  if (state.battleMode === "skill-debug") {
    els.playerSelect.value = String(data.player?.id || els.playerSelect.value);
    state.skillDebugCombatantId = els.playerSelect.value;
  } else {
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
  if (state.battleMode === "tutorial") {
    setMatchLabel(player, "루크", "Tutorial");
    els.aiModeText.textContent = "GUIDED";
    return;
  }
  if (state.battleMode === "skill-debug") {
    setMatchLabel(player, "플로테", "공격 → 방어 → 명상 → 화염탄");
    els.aiModeText.textContent = "SCRIPTED 1 → 2 → 3 → 4";
    return;
  }
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
  if (state.battleMode === "skill-debug") return startSkillDebugBattle();
  if (state.battleMode === "tutorial") return startTutorialBattle();
  return state.battleMode === "pvp" ? startPvpEntry() : startBattle();
}

async function startTutorialBattle() {
  if (
    state.busy
    || state.tutorial?.setupStep !== 3
    || selectedTutorialCharacter()?.id !== TUTORIAL_CHARACTER_ID
    || state.selectedInscriptionId !== TUTORIAL_INSCRIPTION_ID
  ) return;
  const tutorialSession = state.tutorial;
  stopPvpPolling();
  state.pvp = null;
  state.tutorial.started = true;
  primeAudio();
  playBgm("fight", 300);
  setBusy(true);
  clearLogs();
  try {
    const data = await api("/api/tutorial/new", {
      playerInscriptionId: TUTORIAL_INSCRIPTION_ID,
      seed: "versus-guided-tutorial",
    });
    if (!isCurrentTutorialSession(tutorialSession)) return;
    state.battle = data;
    syncSetupFromBattle(data);
    renderBattle(data);
    await pushTurnLog("튜토리얼 시작", data.log, true);
  } catch (error) {
    if (!isCurrentTutorialSession(tutorialSession)) return;
    state.tutorial.started = false;
    stopBgm(300);
    pushTurnLog("오류", [`튜토리얼 시작 실패: ${error.message}`], false);
  } finally {
    if (isCurrentTutorialSession(tutorialSession)) setBusy(false);
  }
}

function isCurrentTutorialSession(session) {
  return Boolean(session && state.battleMode === "tutorial" && state.tutorial === session);
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

async function startSkillDebugBattle() {
  if (state.busy) return;
  stopPvpPolling();
  state.pvp = null;
  primeAudio();
  playBgm("fight", 300);
  setBusy(true);
  clearLogs();
  try {
    const data = await api("/api/dev/skill-debug/new", {
      combatantId: els.playerSelect.value,
    });
    state.battle = data;
    syncSetupFromBattle(data);
    renderBattle(data);
    await pushTurnLog("스킬 디버그 시작", data.log, true);
  } catch (error) {
    stopBgm(300);
    pushTurnLog("오류", [`스킬 디버그 시작 실패: ${error.message}`], false);
  } finally {
    setBusy(false);
  }
}

async function startAdventure() {
  if (state.busy) return;
  state.adventureRestartRequested = false;
  state.adventureBackgroundKey = null;
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
  const tutorialSession = state.battleMode === "tutorial" ? state.tutorial : null;
  primeAudio();
  setBusy(true);
  try {
    const previousTurn = state.battle.turn;
    const data = state.battleMode === "adventure"
      ? await adventureActionRequest({ action: actionNumber })
      : await api("/api/action", { action: actionNumber });
    if (tutorialSession && !isCurrentTutorialSession(tutorialSession)) return;
    const isGameOver = Boolean(data.is_over || data.gameOver);
    if (state.battleMode === "tutorial" && data.tutorial?.completed) {
      setTutorialEnabled(false);
    }
    if (data.adventure) {
      state.adventure = { ...data.adventure };
    }
    const hasFinalBattleEnding = data.adventure?.phase === "final_battle_ending"
      && Array.isArray(data.adventure?.dialogue?.lines)
      && data.adventure.dialogue.lines.length > 0;
    if (hasFinalBattleEnding) syncSetupLock();
    await pushTurnLog(`TURN ${previousTurn}`, data.log, true, {
      fastInfo: true,
      settleEffects: isGameOver,
      syncState: true,
    });
    if (tutorialSession && !isCurrentTutorialSession(tutorialSession)) return;
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
    if (tutorialSession && !isCurrentTutorialSession(tutorialSession)) return;
    pushTurnLog("오류", [`행동 처리 실패: ${error.message}`], false);
  } finally {
    if (tutorialSession && !isCurrentTutorialSession(tutorialSession)) {
      // The tutorial back button already reset the screen and unlocked the next mode.
    } else if (state.adventureRestartRequested) {
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
      fastInfo: Boolean(options.animateLog),
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
  syncPrebattleGuide(false);
  setBattleLogExpanded(false, { available: false });
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
  els.playerGold.hidden = true;
  els.enemyInfoButton.disabled = true;
  els.battleRecordButton.hidden = true;
  els.battleRecordButton.disabled = true;
  els.playerInfoButton.disabled = true;
  syncBattleBackground();
}

function battleBackgroundKey(data = state.battle) {
  if (state.battleMode !== "adventure") return "neutral";
  const adventure = data?.adventure || state.adventure;
  if (!adventure) return "forest";

  const phase = String(adventure.phase || "");
  const stage = Number(adventure.stage || 1);
  const totalStages = Number(adventure.totalStages || 20);
  const currentEvent = adventure.currentEvent || {};

  if (phase === "route" && adventure.justCompletedBattle === false) {
    if (Number(adventure.completedStage || 0) === 2 && adventure.selectedTownMeal) return "village";
    const currentEventId = String(currentEvent.id || "");
    if (currentEventId && currentEventId === String(adventure.lastCompletedEventId || "")) {
      if (currentEvent.relicShop || currentEvent.id === "relic_shop") return "relicShop";
      return currentEvent.bgm === "village" ? "village" : "event";
    }
  }

  if (phase === "route" && adventure.justCompletedBattle === true) {
    const completedStage = Number(adventure.completedStage || Math.max(1, stage - 1));
    if (completedStage >= 12 || adventure.isMirrorBattle || adventure.isOfficerBattle) return "monochromeForest";
    return "forest";
  }

  if (
    adventure.isFinalBattle
    || ["final_battle_dialogue", "final_battle_ending", "complete"].includes(phase)
    || (phase === "route" && stage >= totalStages)
  ) return "demonCastle";

  if (["event", "event_complete"].includes(phase)) {
    if (currentEvent.relicShop || currentEvent.id === "relic_shop") return "relicShop";
    return currentEvent.bgm === "village" ? "village" : "event";
  }

  if (["town", "town_complete"].includes(phase)) return "village";
  if (stage >= 12 || adventure.isMirrorBattle || adventure.isOfficerBattle) return "monochromeForest";
  return "forest";
}

function syncBattleBackground(data = state.battle) {
  const adventure = data?.adventure || state.adventure;
  const holdsPreviousBackground = state.battleMode === "adventure"
    && adventure
    && ADVENTURE_BACKGROUND_HOLD_PHASES.has(String(adventure.phase || ""));
  const key = holdsPreviousBackground && state.adventureBackgroundKey
    ? state.adventureBackgroundKey
    : battleBackgroundKey(data);
  state.adventureBackgroundKey = state.battleMode === "adventure" && adventure ? key : null;
  const path = BATTLE_BACKGROUNDS[key] || BATTLE_BACKGROUNDS.neutral;
  els.battleScreen.dataset.battleBackground = key;
  els.battleScreen.style.setProperty("--battle-background-image", `url("${localAssetUrl(path)}")`);
}

function adventureShowsOpponentSprite(adventure) {
  return !adventure || ADVENTURE_OPPONENT_SPRITE_PHASES.has(String(adventure.phase || ""));
}

function clearFighterSprite(side) {
  const avatar = document.querySelector(fighterIds[side]?.avatar);
  if (!avatar) return;
  avatar.classList.remove("has-battle-sprite", "is-defeated", "is-defeat-pending");
  avatar.classList.add("is-empty");
  avatar.replaceChildren();
}

function renderBattle(data, options = {}) {
  syncAchievements(data);
  syncPrebattleGuide(true);
  setBattleLogExpanded(state.logExpanded, { available: true });
  const adventure = data.adventure || (state.battleMode === "adventure" ? state.adventure : null);
  const isPrologue = adventure?.phase === "prologue";
  const isFinalBattleDialogue = adventure?.phase === "final_battle_dialogue";
  const isFinalBattleEnding = adventure?.phase === "final_battle_ending";
  const showsOpponentSprite = adventureShowsOpponentSprite(adventure);
  syncBattleBackground(data);
  els.battleScreen.classList.toggle("is-adventure-prologue", isPrologue);
  els.battleScreen.classList.toggle("has-sprite-battle", Boolean(
    !isPrologue
    && showsOpponentSprite
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
    if (!showsOpponentSprite) clearFighterSprite("ai");
  }
  renderPersistentCharacterEffects(data);
  renderPassive(data.player);
  const adventureChoices = (data.is_over || isPrologue) && Array.isArray(adventure?.choices) ? adventure.choices : [];
  if (data.tutorial?.completed) {
    renderEmptyActions("튜토리얼 완료");
  } else if (adventure?.phase === "complete") {
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
  } else if (data.skillDebug || state.battleMode === "skill-debug") {
    setMatchLabel(data.player.name, data.ai.name, "공격 → 방어 → 명상 → 화염탄");
    els.aiModeText.textContent = "SCRIPTED 1 → 2 → 3 → 4";
  } else if (data.tutorial || state.battleMode === "tutorial") {
    setMatchLabel(data.player.name, data.ai.name, "Tutorial");
    els.aiModeText.textContent = data.tutorial?.completed ? "FREE BATTLE" : "GUIDED";
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
  const hudNonStatStateText = fighter.hud_non_stat_state_text ?? fighter.hudNonStatStateText;
  const stateText = hudNonStatStateText == null
    ? fighter.hud_state_text || fighter.hudStateText || compactHudStateText(fighter.status_text || fighter.stateText)
    : String(hudNonStatStateText);
  const avatar = document.querySelector(ids.avatar);
  avatar.classList.remove("is-adventure-scene");
  avatar.classList.toggle("is-adventure-monochrome", side === "ai" && Boolean(adventure));
  avatar.classList.toggle("is-adventure-mirror", side === "ai" && Boolean(adventure?.isMirrorBattle));
  avatar.dataset.fighterId = fighter?.id || "";
  avatar.style.setProperty("--character-color", characterColor(fighter.id));
  const battleSpriteSrc = battleSpriteSrcForSubject(fighter, side);
  const fighterVisual = battleSpriteSrc
    ? battleSpriteHtml(fighter, side, battleSpriteSrc)
    : isSkillDebugDevCandidate(fighter)
      ? avatarSvg(fighter.name || fighter.id || "?", side)
      : "";
  avatar.classList.toggle("has-battle-sprite", Boolean(battleSpriteSrc));
  avatar.classList.toggle("is-empty", !fighterVisual);
  avatar.innerHTML = fighterVisual;
  preloadBattleSpriteStates(fighter);
  setBar(ids.hpBar, fighter.hp, maxHp);
  setBar(ids.mpBar, fighter.mp, maxMp);
  document.querySelector(ids.hpText).textContent = `${formatStat(fighter.hp)}/${formatStat(maxHp)}`;
  document.querySelector(ids.mpText).textContent = `${formatStat(fighter.mp)}/${formatStat(maxMp)}`;
  document.querySelector(ids.state).textContent = stateText;
  renderFighterStatEffects(ids.statEffects, fighter);
  if (side === "player") {
    const hasAdventureGold = Number.isFinite(Number(adventure?.gold));
    els.playerGold.hidden = !hasAdventureGold;
    els.playerGold.textContent = hasAdventureGold ? `G ${formatStat(adventure.gold)}` : "";
  }
}

function renderFighterStatEffects(selector, fighter) {
  const root = document.querySelector(selector);
  if (!root) return;
  const rawGroups = fighter.hud_stat_effect_groups ?? fighter.hudStatEffectGroups ?? [];
  const effects = [];
  for (const group of Array.isArray(rawGroups) ? rawGroups : []) {
    const multiplier = Number(group?.multiplier);
    const remaining = Math.trunc(Number(group?.remaining));
    if (!Number.isFinite(multiplier) || remaining <= 0) continue;
    for (const rawStat of Array.isArray(group?.stats) ? group.stats : []) {
      const stat = String(rawStat || "").toLowerCase();
      if (!["atk", "def", "spd"].includes(stat)) continue;
      effects.push({ stat, multiplier, remaining, source: String(group?.source || "") });
    }
  }
  root.hidden = effects.length === 0;
  root.innerHTML = effects.map(statEffectBadgeHtml).join("");
}

function statEffectBadgeHtml(effect) {
  const statLabel = effect.stat.toUpperCase();
  const multiplier = formatStat(effect.multiplier);
  const sourcePrefix = effect.source ? `${effect.source}, ` : "";
  const accessibleLabel = `${sourcePrefix}${statLabel} ${multiplier}배, ${effect.remaining}턴 남음`;
  const directionClass = effect.multiplier >= 1 ? "is-buff" : "is-debuff";
  return `
    <span
      class="fighter-stat-effect fighter-stat-effect-${effect.stat} ${directionClass}"
      role="listitem"
      aria-label="${escapeHtml(accessibleLabel)}"
      title="${escapeHtml(accessibleLabel)}"
    >
      <span class="fighter-stat-effect-icon" aria-hidden="true">${statEffectIconHtml(effect.stat)}</span>
      <span class="fighter-stat-effect-value">×${escapeHtml(multiplier)}</span>
      <span class="fighter-stat-effect-turns">${effect.remaining}T</span>
    </span>
  `;
}

function statEffectIconHtml(stat) {
  if (stat === "atk") {
    return `<svg viewBox="0 0 24 24" focusable="false"><path d="M14.8 3.5 20.5 3l-.5 5.7-9.1 9.1-4.7-4.7 8.6-9.6Z"/><path d="m5.1 14.3 4.6 4.6M3.5 20.5l4.1-4.1"/></svg>`;
  }
  if (stat === "def") {
    return `<svg viewBox="0 0 24 24" focusable="false"><path d="M12 2.8 19 5.6v5.8c0 4.5-2.8 7.8-7 9.8-4.2-2-7-5.3-7-9.8V5.6L12 2.8Z"/><path d="M12 6.2v10.9"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" focusable="false"><path d="m13.8 2.8-8.3 10h5.1l-1 8.4 8.9-12h-5.2l.5-6.4Z"/></svg>`;
}

function renderPersistentCharacterEffects(data = state.battle) {
  CHARACTER_BATTLE_EFFECTS?.renderPersistent?.(data, {
    arena: document.querySelector(".arena-surface"),
    stageForSide: (side) => side ? document.querySelector(fighterIds[side].avatar) : null,
  });
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

function compactHudStateText(value) {
  const text = String(value || "").trim();
  if (!text || text === "없음") return "";
  const hiddenPrefixes = [
    "기본 MP 회복",
    "턴 종료 HP 회복",
    "유물:",
    "여정 능력치",
    "전투 종료 HP 회복 보정",
    "전투 시작 MP 회복",
    "마왕군 최대 HP",
    "전투 보상",
    "행선지 재추첨",
    "유물상의 장부",
    "다음 기습 확률",
    "다음 전투",
  ];
  const parts = text
    .split(" / ")
    .map((part) => part.trim())
    .filter((part) => part && !hiddenPrefixes.some((prefix) => part.startsWith(prefix)))
    .map((part) => part
      .replace(/\((\d+)턴\)/g, " $1T")
      .replace(/\b(ATK(?:·DEF|·SPD)?|DEF(?:·SPD)?|SPD) ×(\d+(?:\.\d+)?)/g, (_match, label, multiplier) => `${label}${Number(multiplier) >= 1 ? "↑" : "↓"}`));
  return parts.length ? parts.join(" · ") : "";
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
    scheduleTutorialPointerSync();
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
  scheduleTutorialPointerSync();
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

function actionCardMeta(action = {}) {
  const valueText = (value) => value == null || value === "" ? "-" : String(value);
  const items = [{ key: "mp", label: "MP", value: valueText(action.cost_text ?? action.cost) }];
  if (action.isAttack === true) {
    const accuracy = valueText(action.accuracy);
    items.push(
      { key: "accuracy", label: "명중", value: accuracy === "-" ? accuracy : `${accuracy}%` },
      { key: "power", label: "위력", value: valueText(action.power) },
    );
  }
  return items;
}

function actionCardMetaHtml(action) {
  const items = actionCardMeta(action);
  const label = items.map((item) => `${item.label} ${item.value}`).join(" · ");
  return `
    <span class="action-meta" aria-label="${escapeHtml(label)}">
      ${items.map((item) => `
        <span class="action-meta-item action-meta-${item.key}">
          <span class="action-meta-label">${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </span>
      `).join("")}
    </span>
  `;
}

function createActionButton(action) {
  const button = document.createElement("button");
  const unavailable = !action.available;
  const expectedActionNumber = Number(state.battle?.tutorial?.expectedActionNumber || 0);
  const tutorialLocked = state.battleMode === "tutorial"
    && !state.battle?.tutorial?.completed
    && expectedActionNumber > 0
    && Number(action.number) !== expectedActionNumber;
  button.type = "button";
  button.className = "action-button";
  button.classList.toggle("is-unavailable", unavailable);
  button.classList.toggle("is-tutorial-target", expectedActionNumber > 0 && Number(action.number) === expectedActionNumber);
  button.disabled = unavailable || state.busy || tutorialLocked;
  button.addEventListener("click", () => chooseAction(action.number));
  button.innerHTML = `
    ${skillIconHtml(action)}
    <span class="action-main">
      <span class="action-head">
        <span class="action-name">${escapeHtml(action.name)}</span>
      </span>
      ${actionCardMetaHtml(action)}
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
  if (characterId === "xenox" && number === 8) return null;
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
  state.logSkipRequested = false;
  renderLog({ follow: true });

  if (!animated) return;
  const delayMs = Number.isFinite(Number(options.delayMs))
    ? Math.max(0, Number(options.delayMs))
    : LOG_DELAY_MS;
  let playedEffect = false;
  let nextEntryDelayMs = initialLogEntryDelayMs(packet.entries[0], delayMs, options);
  try {
    for (let index = 1; index <= packet.entries.length; index += 1) {
      const skipped = await waitForLogPlayback(nextEntryDelayMs, token);
      if (token !== state.logToken) return;
      if (skipped || state.logSkipRequested) return;
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
        logEntryHoldMs(entry, delayMs, options),
        impactDelayMs > 0 ? impactDelayMs + LOG_EFFECT_IMPACT_LEAD_MS : 0,
      );
    }
    const finalEffect = packet.entries.at(-1)?.effect;
    if (finalEffect && finalEffect.type !== "sprite-state" && token === state.logToken) {
      const impactDelayMs = Math.max(0, Number(finalEffect.impactDelayMs) || 0);
      const tailHoldMs = options.fastInfo && finalEffect.logPacing === "fast"
        ? LOG_FAST_DELAY_MS
        : LOG_EFFECT_TAIL_HOLD_MS;
      const skipped = await waitForLogPlayback(impactDelayMs + tailHoldMs, token);
      if (skipped || state.logSkipRequested) return;
    }
    if (options.settleEffects && playedEffect && token === state.logToken) {
      const skipped = await waitForLogPlayback(EFFECT_SETTLE_MS, token);
      if (skipped || state.logSkipRequested) return;
    }
  } finally {
    if (token === state.logToken) {
      state.logAnimating = false;
      state.logSkipRequested = false;
      state.logSkipResolve = null;
      renderLog();
    }
  }
}

function initialLogEntryDelayMs(entry, baseDelayMs, options = {}) {
  if (entry?.tutorialInstruction) return TUTORIAL_INSTRUCTION_DELAY_MS;
  if (options.fastInfo && isFastBattleInfoEntry(entry)) return LOG_FAST_DELAY_MS;
  return Math.min(baseDelayMs, LOG_FIRST_ENTRY_DELAY_MS);
}

function isFastBattleInfoEntry(entry) {
  const effect = entry?.effect;
  if (effect?.logPacing === "fast") return true;
  if (effect && effect.type !== "sprite-state") return false;
  const text = String(entry?.text || "");
  if (text.includes("GAME OVER")) return false;
  if (text.includes("“") && text.includes("”")) return false;
  return true;
}

function isReadableActionAnnouncementEntry(entry) {
  const effect = entry?.effect;
  if (effect && effect.type !== "sprite-state") return false;
  return /^.+?(?:은|는) .+?(?:을|를) 사용했다\.$/.test(String(entry?.text || ""));
}

function isDecisionSummaryEntry(entry) {
  const text = String(entry?.text || "");
  return text.startsWith("우선도 판정:")
    || text.includes(" 선택: ")
    || text.includes("GAME OVER")
    || /^\[(?:턴 종료|전투 종료)\]$/.test(text)
    || /^(?:전투|턴) (?:시작|종료)/.test(text);
}

function consumePendingActionMpCost(line, context, fighterName, amount) {
  const isActionCostLine = context.actionCostPending
    && fighterName === context.actorName
    && !line.includes("(");
  if (isActionCostLine) context.actionCostPending = false;
  return isActionCostLine && amount < 0;
}

function logEntryHoldMs(entry, baseDelayMs, options = {}) {
  const explicitHoldMs = entry?.effect?.logHoldMs;
  if (explicitHoldMs != null && Number.isFinite(Number(explicitHoldMs))) {
    return Math.max(0, Number(explicitHoldMs));
  }
  if (entry?.tutorialInstruction) return TUTORIAL_INSTRUCTION_DELAY_MS;
  if (isDecisionSummaryEntry(entry)) return Math.max(baseDelayMs, LOG_DECISION_DELAY_MS);
  if (options.fastInfo && isReadableActionAnnouncementEntry(entry)) {
    return Math.min(baseDelayMs, LOG_ACTION_ANNOUNCEMENT_DELAY_MS);
  }
  if (options.fastInfo && isFastBattleInfoEntry(entry)) return LOG_FAST_DELAY_MS;
  const importantEffectTypes = new Set(["hit", "shadow-hit", "miss", "defense", "heal", "buff", "debuff"]);
  const effectType = entry?.effect?.type;
  const textLength = String(entry?.text || "").length;
  if (importantEffectTypes.has(effectType)) return Math.max(baseDelayMs, LOG_IMPORTANT_DELAY_MS);
  if (textLength >= 44) return Math.max(baseDelayMs, 900);
  return baseDelayMs;
}

function waitForLogPlayback(delayMs, token) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (skipped = false) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (state.logSkipResolve === skip) state.logSkipResolve = null;
      resolve(Boolean(skipped && token === state.logToken));
    };
    const skip = () => finish(true);
    const timer = window.setTimeout(() => finish(false), Math.max(0, delayMs));
    state.logSkipResolve = skip;
  });
}

function skipLogAnimation() {
  if (!state.logAnimating) return;
  const packet = state.turnLogs.at(-1);
  if (!packet) return;
  const entries = packet.entries || [];
  const visibleCount = packet.visibleCount ?? 0;
  for (const entry of entries.slice(visibleCount)) {
    applyLogStatePatch(entry.patch);
  }
  packet.visibleCount = entries.length;
  state.logSkipRequested = true;
  state.logAnimating = false;
  clearBattleEffects();
  state.logSkipResolve?.();
  renderLog({ follow: true });
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
    const tutorialInstruction = line.startsWith("[튜토리얼]");
    if (tutorialInstruction) line = line.slice("[튜토리얼]".length).trim();
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
        result.push({ text, effect: effectFromLogLine(text, context), patch: null, tutorialInstruction });
      }
      continue;
    }
    if (/^\[[^\]]*판정\]$/.test(line)) continue;
    const polished = polishLogLine(line).replaceAll("⇒", "->");
    const effect = effectFromLogLine(polished, context);
    const patch = statePatchFromLogLine(polished, context);
    result.push({ text: polished, effect, patch, tutorialInstruction });
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
  const actor = context.actorSide ? state.battle?.[context.actorSide] : null;
  const actorId = actor?.id;
  if (!actorId) return undefined;
  const payload = {
    ...details,
    actionName: context.actionName,
    actorName: context.actorName,
    actorSide: context.actorSide,
    battle: state.battle,
    logDelayMs: LOG_DELAY_MS,
    makeLogEffect,
    makeMissEffect,
    oppositeSide,
  };
  const baseEffect = CHARACTER_BATTLE_EFFECTS?.resolve?.(actorId, phase, payload);
  if (baseEffect !== undefined) return baseEffect;

  const copiedCharacterId = fimitCopiedEffectCharacterId(actor, context.actionName);
  if (!copiedCharacterId) return undefined;
  const copiedEffect = CHARACTER_BATTLE_EFFECTS?.resolve?.(copiedCharacterId, phase, payload);
  return markFimitCopiedBattleEffect(copiedEffect);
}

const FIMIT_ACTION_NAMES = new Set(["운명 투척", "위작 보호", "간단한 속임수", "진짜보다 진짜같이"]);

function fimitCopiedEffectCharacterId(actor, actionName) {
  if (actor?.id !== "fimit" || !actionName || FIMIT_ACTION_NAMES.has(actionName)) return null;
  if (actor.activeCharacterId && actor.activeCharacterId !== "fimit") return actor.activeCharacterId;
  return state.options?.characters?.find((character) => (
    character.id !== "fimit" && character.skills?.some((skill) => skill.name === actionName)
  ))?.id || null;
}

function markFimitCopiedBattleEffect(effect) {
  if (!effect || typeof effect !== "object") return effect;
  return {
    ...effect,
    copiedByFimit: true,
    fimitCopyColor: CHARACTER_COLORS.fimit,
  };
}

function resolveTargetCharacterBattleEffect(phase, context, details = {}) {
  const targetSide = details.targetSide || context.lineSide;
  const targetId = targetSide ? state.battle?.[targetSide]?.id : null;
  if (!targetId) return undefined;
  return CHARACTER_BATTLE_EFFECTS?.resolve?.(targetId, phase, {
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

function withConcurrentBattleEffects(effect, ...extras) {
  const concurrentEffects = extras.filter((item) => item && typeof item === "object");
  if (!concurrentEffects.length) return effect;
  if (!effect || typeof effect !== "object") return concurrentEffects[0];
  return {
    ...effect,
    concurrentEffects: [
      ...(Array.isArray(effect.concurrentEffects) ? effect.concurrentEffects : []),
      ...concurrentEffects,
    ],
  };
}

function resolveStatusBattleEffect(statusName, phase, context, details = {}) {
  const effect = CHARACTER_BATTLE_EFFECTS?.resolveStatus?.(statusName, phase, {
    ...details,
    actionName: context.actionName,
    actorName: context.actorName,
    actorSide: context.actorSide,
    battle: state.battle,
    makeLogEffect,
    oppositeSide,
  });
  const actor = context.actorSide ? state.battle?.[context.actorSide] : null;
  return fimitCopiedEffectCharacterId(actor, context.actionName)
    ? markFimitCopiedBattleEffect(effect)
    : effect;
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

  let match = line.match(/^그림자 병사 (\d+)(?:은|는) (그림자 찌르기|자신 찌르기)(?:을|를) 사용했다\.$/);
  if (match) {
    context.actionName = match[2];
    context.shadowSoldierNumber = Number(match[1]);
    const owner = context.lineSide ? state.battle?.[context.lineSide] : null;
    context.actorName = owner?.name || context.actorName;
    context.actorSide = context.lineSide || context.actorSide;
    const characterEffect = resolveCharacterBattleEffect("shadowSoldierAction", context, {
      soldierNumber: context.shadowSoldierNumber,
    });
    return characterEffect === undefined ? null : characterEffect;
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

  match = line.match(/^광증으로 (.+?) 대신 (.+?)이 결정되었다\.$/);
  if (match) {
    context.actionName = match[2];
    const statusEffect = resolveStatusBattleEffect("광증", "actionReplacement", context, {
      targetName: context.actorName,
      targetSide: context.actorSide || context.lineSide,
      originalActionName: match[1],
      replacementActionName: match[2],
    });
    return statusEffect === undefined ? null : statusEffect;
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

  match = line.match(/^(.+?)의 ATK가 잔기를 소모할 때까지 x2가 된다\.$/);
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

  match = line.match(/^(.+?)의 그림자 병사 (\d+)이 공격 피해 (\d+)을 대신 받았다\.$/);
  if (match) {
    const targetSide = context.lineSide || sideForFighterName(match[1], context.actorSide);
    const characterEffect = resolveTargetCharacterBattleEffect("soldierDamaged", context, {
      targetName: match[1],
      targetSide,
      soldierNumber: Number(match[2]),
      damage: Number(match[3]),
    });
    if (characterEffect !== undefined) return characterEffect;
    return Number(match[3]) > 0 ? makeLogEffect("shadow-hit", match[1], match[1], match[3], targetSide, context.actorSide) : null;
  }

  match = line.match(/^(?:\d+타:\s*)?(.+?)에게 (\d+)의 피해\./);
  if (match) {
    const damage = Number(match[2]);
    const characterEffect = resolveCharacterBattleEffect("damage", context, {
      targetName: match[1],
      targetSide: context.lineSide,
      damage,
    });
    const targetCharacterEffect = damage > 0
      ? resolveTargetCharacterBattleEffect("damageTaken", context, {
        targetName: match[1],
        targetSide: context.lineSide,
        damage,
      })
      : undefined;
    const effectType = context.actionName === "일반 공격" ? "normal-attack" : "hit";
    const primaryEffect = characterEffect !== undefined
      ? characterEffect
      : damage > 0
        ? makeLogEffect(effectType, match[1], context.actorName, damage, context.lineSide, context.actorSide)
        : null;
    return withConcurrentBattleEffects(primaryEffect, targetCharacterEffect);
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

  match = line.match(/^(.+?) HP 회복 (\d+)\s*(?:→|->)\s*(\d+)(?: \((.+?)\))?$/);
  if (match) {
    const amount = Number(match[3]) - Number(match[2]);
    const targetName = match[1];
    const targetSide = context.lineSide || sideForFighterName(targetName, context.actorSide);
    const characterEffect = resolveCharacterBattleEffect("heal", context, {
      targetName,
      targetSide,
      amount,
      reason: match[4] || "",
    });
    if (characterEffect !== undefined) return characterEffect;
    const targetCharacterEffect = resolveTargetCharacterBattleEffect("heal", context, {
      targetName,
      targetSide,
      amount,
      reason: match[4] || "",
    });
    if (targetCharacterEffect !== undefined) return targetCharacterEffect;
    const effect = amount > 0 ? makeLogEffect("heal", match[1], match[1], amount, context.lineSide, context.lineSide) : null;
    return effect ? { ...effect, valueKind: "hp-gain" } : null;
  }

  match = line.match(/^(?:(.+?) )?MP (\d+)\s*(?:→|->)\s*(\d+)/);
  if (match) {
    const fighterName = match[1] || context.actorName;
    const beforeMp = Number(match[2]);
    const afterMp = Number(match[3]);
    const amount = afterMp - beforeMp;
    const isActionCost = consumePendingActionMpCost(line, context, fighterName, amount);
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
    return effect ? {
      ...effect,
      valueKind: amount > 0 ? "mp-gain" : "mp-loss",
      logPacing: "fast",
    } : null;
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
    const targetName = match[1];
    const statusName = match[2];
    const targetSide = context.lineSide || sideForFighterName(targetName, oppositeSide(context.actorSide));
    const statusEffect = resolveStatusBattleEffect(statusName, "statusApplied", context, {
      targetName,
      targetSide,
    });
    if (statusEffect !== undefined) return statusEffect;
    return makeLogEffect("debuff", targetName, context.actorName, statusName, targetSide, context.actorSide);
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
      line,
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

  match = line.match(/^(.+?) (\d+)(?:중첩)? 소모:\s*(\d+)(?:\/\d+)?\s*(?:→|->)\s*(\d+)(?:\/\d+)?/);
  if (match && context.actorName) {
    const [, stackName, amountText, beforeText, afterText] = match;
    context.lastStackOwner = context.actorName;
    context.lastStackName = stackName;
    const statusEffect = resolveStatusBattleEffect(stackName, "counterChange", context, {
      targetName: context.actorName,
      targetSide: context.actorSide,
      before: Number(beforeText),
      after: Number(afterText),
    });
    if (statusEffect !== undefined) return statusEffect;
    return makeLogEffect("stack-spend", context.actorName, context.actorName, `${stackName}-${amountText}`, context.actorSide, context.actorSide);
  }

  match = line.match(/^(.+?) (\d+)(?:중첩)? 소모:/);
  if (match && context.actorName) {
    const [, stackName, amountText] = match;
    context.lastStackOwner = context.actorName;
    context.lastStackName = stackName;
    return makeLogEffect("stack-spend", context.actorName, context.actorName, `${stackName}-${amountText}`, context.actorSide, context.actorSide);
  }

  match = line.match(/^(.+?)의 예보가 (천둥|흐림|맑음)으로 변경되었다\.$/);
  if (match) {
    const targetName = match[1];
    const targetSide = context.lineSide || sideForFighterName(targetName, context.actorSide);
    const weatherEffect = resolveTargetCharacterBattleEffect("forecastChange", context, {
      targetName,
      targetSide,
      weather: match[2],
    });
    return weatherEffect === undefined ? null : weatherEffect;
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

  match = line.match(/^(?:(.+?)의 )?위상이 (삭월|초승|상현|만월|하현|그믐)으로 변경되었다\.$/);
  if (match) {
    const targetName = match[1] || context.actorName;
    const targetSide = context.lineSide || sideForFighterName(targetName, context.actorSide);
    const phaseEffect = resolveTargetCharacterBattleEffect("phaseChange", context, {
      targetName,
      targetSide,
      phase: match[2],
    });
    return phaseEffect === undefined ? null : phaseEffect;
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

function battleSpriteActionCharacterForFighter(fighter, actionName) {
  const baseCharacter = findCharacterForFighter(fighter);
  if (fighter?.id !== "fimit" || FIMIT_ACTION_NAMES.has(actionName)) return baseCharacter;

  const candidates = [
    ...(state.options?.characters || []),
    state.adventure?.monster,
    state.options?.tutorial?.opponent,
    ...(skillDebugConfig()?.combatants || []),
  ].filter(Boolean);
  return candidates.find((candidate) => candidate.id === fighter.activeCharacterId)
    || candidates.find((candidate) => (
      candidate.id !== "fimit" && candidate.skills?.some((skill) => skill.name === actionName)
    ))
    || baseCharacter;
}

function battleSpriteStateForAction(context) {
  const fighter = state.battle?.[context.actorSide];
  const asset = spriteAssetForSubject(fighter);
  if (!fighter || !asset) return null;
  if (context.actionName === "일반 공격") return "attack";
  if (context.actionName === "일반 방어" || context.actionName === "명상" || DEFENSE_ACTION_NAMES.has(context.actionName)) {
    return "utility";
  }
  const listedAction = context.actorSide === "player"
    ? state.battle?.actions?.find((action) => action.name === context.actionName)
    : null;
  if (typeof listedAction?.isAttack === "boolean") return listedAction.isAttack ? "attack" : "utility";

  const character = battleSpriteActionCharacterForFighter(fighter, context.actionName);
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
  let mountedElement = element;
  if (effect?.copiedByFimit) {
    const copyLayer = document.createElement("span");
    copyLayer.className = "battle-fx-fimit-copy-layer";
    copyLayer.dataset.sourceSide = effect.sourceSide || "";
    copyLayer.style.setProperty("--fimit-copy-color", effect.fimitCopyColor || CHARACTER_COLORS.fimit);
    copyLayer.append(mountedElement);
    mountedElement = copyLayer;
  }
  if (shouldUseMonochromeBattleEffect(effect)) {
    const monochromeLayer = document.createElement("span");
    monochromeLayer.className = "battle-fx-monochrome-layer";
    monochromeLayer.dataset.sourceSide = effect.sourceSide;
    monochromeLayer.append(mountedElement);
    mountedElement = monochromeLayer;
  }
  parent.append(mountedElement);
  return mountedElement;
}

function playLogEffect(effect) {
  if (!effect?.side) return;
  if (Number(effect.delayMs) > 0) {
    const delayedEffect = { ...effect, delayMs: 0 };
    registerEffectTimeout(window.setTimeout(() => playLogEffect(delayedEffect), Number(effect.delayMs)));
    return;
  }
  if (Array.isArray(effect.concurrentEffects) && effect.concurrentEffects.length) {
    const concurrentEffects = effect.concurrentEffects;
    effect = { ...effect };
    delete effect.concurrentEffects;
    for (const concurrentEffect of concurrentEffects) playLogEffect(concurrentEffect);
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
  let mountedBurst = null;
  if (burst) {
    burst.className = `battle-fx-effect battle-fx-${effect.type}`;
    mountedBurst = appendBattleEffectElement(stage, burst, effect);
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
  prepareBgm([type]);
  const track = BGM_TRACKS[type];
  const next = state.bgm.get(type);
  if (!track || !next) return;
  const requestToken = ++state.bgmRequestToken;
  const targetVolume = effectiveBgmVolume(track);
  if (state.currentBgm === next && !next.paused) {
    next.volume = targetVolume;
    return;
  }

  clearBgmFades();
  const previous = state.currentBgm;
  for (const audio of state.bgm.values()) {
    if (audio !== next && audio !== previous && !audio.paused) resetBgmTrack(audio);
  }
  if (previous && previous !== next) {
    fadeAudio(previous, 0, fadeMs, () => {
      resetBgmTrack(previous);
    });
  }

  next.loop = Boolean(track.loop);
  next.currentTime = 0;
  next.volume = previous && previous !== next ? 0 : targetVolume;
  state.currentBgm = next;
  state.currentBgmType = type;
  next.play()
    .then(() => {
      if (requestToken !== state.bgmRequestToken) {
        if (state.currentBgm !== next) resetBgmTrack(next);
        return;
      }
      if (next.volume !== targetVolume) {
        fadeAudio(next, targetVolume, fadeMs);
      }
    })
    .catch(() => {
      // A later playback request recreates a track that failed to load or decode.
      if (requestToken !== state.bgmRequestToken || state.currentBgm !== next) return;
      state.currentBgm = null;
      state.currentBgmType = null;
      if (state.bgm.get(type) === next) state.bgm.delete(type);
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
  prepareBgm([currentType, nextType]);
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
  state.bgmRequestToken += 1;
  clearBgmFades();
  const previous = state.currentBgm;
  state.currentBgm = null;
  state.currentBgmType = null;
  for (const audio of state.bgm.values()) {
    if (audio !== previous || fadeMs <= 0 || audio.paused) resetBgmTrack(audio);
  }
  if (!previous || previous.paused || fadeMs <= 0) {
    if (previous) resetBgmTrack(previous);
    return;
  }
  fadeAudio(previous, 0, fadeMs, () => {
    resetBgmTrack(previous);
  });
}

function resetBgmTrack(audio) {
  audio.pause();
  audio.currentTime = 0;
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
    stage.querySelectorAll(".battle-fx-monochrome-layer, .battle-fx-fimit-copy-layer, .battle-fx-effect, .battle-fx-value")
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
    renderCurrentLog();
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
  renderCurrentLog();
  if (options.follow) {
    scrollBattleLogToBottom();
  }
}

function renderCurrentLog() {
  const packet = state.turnLogs.at(-1);
  const tutorialSetup = state.battleMode === "tutorial"
    && state.tutorial
    && !state.tutorial.started
    && !state.battle;
  if (!packet || (!state.battle && !tutorialSetup)) {
    els.currentLogBox.hidden = true;
    return;
  }
  const entries = packet.entries || [];
  const visibleCount = packet.visibleCount ?? entries.length;
  const entry = visibleCount > 0 ? entries[Math.min(visibleCount, entries.length) - 1] : null;
  const effect = entry?.effect;
  const sourceSide = effect?.sourceSide || effect?.side;
  const sourceId = sourceSide ? state.battle?.[sourceSide]?.id : null;
  const accentColor = effect?.color || (sourceId ? characterColor(sourceId) : "#d9bd68");
  els.currentLogBox.hidden = false;
  els.currentLogBox.disabled = !state.logAnimating;
  els.currentLogBox.classList.toggle("is-animating", state.logAnimating);
  els.currentLogBox.style.setProperty("--current-log-color", accentColor);
  els.currentLogText.textContent = entry?.text || (tutorialSetup ? "안내 중..." : "판정 중...");
  els.currentLogSkipHint.hidden = !state.logAnimating;
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

function setBattleLogExpanded(expanded, options = {}) {
  const available = options.available ?? Boolean(state.battle);
  const nextExpanded = Boolean(available && expanded);
  state.logExpanded = nextExpanded;
  els.battleScreen.classList.toggle("is-log-expanded", nextExpanded);
  els.battleLogToggleButton.hidden = !available || nextExpanded;
  els.battleLogToggleButton.setAttribute("aria-expanded", String(nextExpanded));
  els.battleLogPanel.hidden = !nextExpanded;
  els.battleLogPanel.setAttribute("aria-hidden", String(!nextExpanded));
  if (nextExpanded && options.focusPanel) {
    window.requestAnimationFrame(() => els.battleLogPanel.focus());
  } else if (!nextExpanded && options.restoreFocus && available) {
    window.requestAnimationFrame(() => els.battleLogToggleButton.focus());
  }
}

function clearLogs() {
  state.logSkipResolve?.();
  state.logToken += 1;
  state.logAnimating = false;
  state.logSkipRequested = false;
  state.logSkipResolve = null;
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
  const adventure = state.battleMode === "adventure"
    ? state.battle?.adventure || state.adventure
    : null;
  els.enemyInfoKicker.hidden = false;
  els.enemyInfoKicker.textContent = side === "player" ? "내 정보" : "상대 정보";
  els.enemyInfoTitle.textContent = fighter.label || `${fighter.name} — ${fighter.title}`;
  els.enemyInfoBody.style.setProperty("--character-color", characterColor(fighter.id));
  els.enemyInfoBody.innerHTML = fighterInfoHtml(character, fighter, { side, adventure });
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

function fighterInfoHtml(character, fighter, { side = "player", adventure = null } = {}) {
  const initialStats = character.stats || {};
  const persistentStats = fighter.baseStats || initialStats;
  const currentStats = fighter.stats || {
    atk: fighter.atk,
    def: fighter.defense,
    spd: fighter.spd,
  };
  const maxHp = fighter.max_hp ?? fighter.maxHp ?? persistentStats.hp ?? initialStats.hp;
  const maxMp = fighter.max_mp ?? fighter.maxMp ?? 0;
  const statuses = (character.uniqueStatuses || character.unique_statuses || [])
    .map((status) => infoTileHtml("고유 상태", status.name, status.description))
    .join("");
  const passive = character.passive
    ? infoTileHtml("패시브", character.passive.name, character.passive.description)
    : infoTileHtml("패시브", "없음", "");
  const skills = (character.skills || []).map((skill) => skillTileHtml(skill)).join("");
  const previewSprite = characterPreviewSpriteHtml(fighter, "fighter-info-sprite");
  const isAdventurePlayer = side === "player" && Boolean(adventure);
  const combatStateText = isAdventurePlayer
    ? fighter.hud_state_text || fighter.hudStateText || "없음"
    : fighter.status_text || fighter.stateText || "없음";
  const summary = `
    <div class="fighter-battle-summary">
      <div class="fighter-current-stats" aria-label="현재 능력치">
        ${currentVitalHtml("HP", fighter.hp, maxHp)}
        ${currentVitalHtml("MP", fighter.mp, maxMp)}
        ${currentStatHtml("ATK", currentStats.atk ?? fighter.atk, initialStats.atk)}
        ${currentStatHtml("DEF", currentStats.def ?? fighter.defense, initialStats.def)}
        ${currentStatHtml("SPD", currentStats.spd ?? fighter.spd, initialStats.spd)}
      </div>
      <div class="fighter-effect-summary">
        <span>${isAdventurePlayer ? "현재 전투 상태" : "적용 중인 효과"}</span>
        <strong>${escapeHtml(combatStateText)}</strong>
      </div>
      ${side === "player" && adventure ? adventureFighterInfoHtml(adventure, fighter) : ""}
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

function currentVitalHtml(label, current, maximum) {
  return `
    <div class="fighter-current-stat">
      <span>${label}</span>
      <strong>${formatStat(current)}<small> / ${formatStat(maximum)}</small></strong>
    </div>
  `;
}

function currentStatHtml(label, current, initial) {
  const initialValue = Number(initial);
  return `
    <div class="fighter-current-stat">
      <span>${label}</span>
      <strong>${formatStat(current)}</strong>
      ${Number.isFinite(initialValue) ? `<small>초기 ${formatStat(initialValue)}</small>` : ""}
    </div>
  `;
}

function adventureFighterInfoHtml(adventure, fighter) {
  const relics = (fighter.adventureRelics || adventure.playerRelics || []).filter((relic) => !relic?.destroyed);
  const adventureEffects = String(fighter.adventure_state_text || fighter.adventureStateText || "")
    .split(" / ")
    .map((effect) => effect.trim())
    .filter((effect) => effect && effect !== "없음" && !effect.startsWith("유물:"));
  return `
    <section class="fighter-adventure-summary">
      <div class="fighter-adventure-heading">
        <span>ADVENTURE</span>
        <strong>G ${formatStat(adventure.gold || 0)}</strong>
      </div>
      <div class="fighter-adventure-group">
        <span class="fighter-adventure-label">여정 강화·효과</span>
        ${adventureEffects.length
          ? `<ul class="fighter-adventure-effect-list">${adventureEffects
            .map((effect) => `<li>${escapeHtml(effect)}</li>`)
            .join("")}</ul>`
          : `<p class="fighter-adventure-empty">적용된 여정 강화가 없습니다.</p>`}
      </div>
      <div class="fighter-adventure-group">
        <span class="fighter-adventure-label">보유 유물</span>
      <div class="fighter-relic-list">
        ${relics.length
          ? relics.map((relic) => `
            <article>
              <span>${escapeHtml(relic.name)}</span>
              <p>${escapeHtml(relic.description || "-")}</p>
            </article>
          `).join("")
          : `<p class="fighter-relic-empty">보유한 유물이 없습니다.</p>`}
      </div>
      </div>
    </section>
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
    if (state.battleMode === "tutorial" && state.battle.tutorial?.completed) {
      renderEmptyActions("튜토리얼 완료");
    } else if (adventureChoices.length) {
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
  const tutorialSetup = state.battleMode === "tutorial" && state.tutorial && !state.tutorial.started;
  const tutorialBattleLocked = state.battleMode === "tutorial" && Boolean(state.battle || state.tutorial?.started);
  const basePlayerSetupLocked = pvpLocked || (state.battleMode === "adventure" && state.busy);
  const playerSelectLocked = basePlayerSetupLocked || tutorialBattleLocked || (tutorialSetup && state.tutorial.setupStep > 1);
  const inscriptionLocked = basePlayerSetupLocked || tutorialBattleLocked || (tutorialSetup && state.tutorial.setupStep !== 2);
  const canRestartDuringDialogue = state.battleMode === "adventure"
    && state.busy
    && ["final_battle_dialogue", "final_battle_ending"].includes(state.adventure?.phase)
    && !state.adventureRestartRequested;
  const tutorialStartLocked = state.battleMode === "tutorial"
    && (
      !tutorialSetup
      || state.tutorial.setupStep !== 3
      || selectedTutorialCharacter()?.id !== TUTORIAL_CHARACTER_ID
      || state.selectedInscriptionId !== TUTORIAL_INSCRIPTION_ID
    );
  const startLocked = pvpLocked || tutorialStartLocked || (state.busy && !canRestartDuringDialogue);
  els.startButton.disabled = startLocked;
  els.continueAdventureButton.disabled = state.busy;
  els.inscriptionButton.removeAttribute("title");
  if (inscriptionLocked && document.activeElement === els.inscriptionButton) {
    els.inscriptionButton.blur();
  }
  els.inscriptionButton.disabled = inscriptionLocked;
  for (const option of els.playerSelect.options) {
    const character = state.options?.characters?.find((item) => String(item.index) === String(option.value));
    option.disabled = Boolean(tutorialSetup && character?.id !== TUTORIAL_CHARACTER_ID);
  }
  els.playerSelect.disabled = playerSelectLocked;
  els.pvpRoomInput.disabled = pvpLocked;
  for (const picker of state.characterPickers) {
    picker.select.disabled = picker.select === els.playerSelect ? playerSelectLocked : false;
    picker.button.disabled = picker.select.disabled;
  }
  if (playerSelectLocked || inscriptionLocked) {
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
  markAdventureStarted();
  state.adventureSave = AdventureSave.createAdventureSave(start);
  AdventureSave.storeAdventureSave(adventureStorage(), state.adventureSave);
  syncAdventureRecommendation();
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
  syncAdventureEntryActions();
}

function adventureStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadAdventureStarted() {
  try {
    return adventureStorage()?.getItem(ADVENTURE_STARTED_KEY) === "1";
  } catch {
    return false;
  }
}

function markAdventureStarted() {
  state.adventureStarted = true;
  try {
    adventureStorage()?.setItem(ADVENTURE_STARTED_KEY, "1");
  } catch {
    // The current session still remembers the completed first start.
  }
}

function syncAdventureRecommendation() {
  const hasAdventureSave = Boolean(
    state.adventureSave || AdventureSave?.loadAdventureSave(adventureStorage()),
  );
  if (hasAdventureSave && !state.adventureStarted) markAdventureStarted();
  const shouldRecommend = !state.adventureStarted && !hasAdventureSave;
  els.adventureModeBadge.hidden = !shouldRecommend;
  els.openAdventureButton.classList.toggle("is-recommended", shouldRecommend);
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

function findCharacterByName(name) {
  return state.options?.characters?.find((character) => character.name === name) || null;
}

function findCharacterForFighter(fighter) {
  const adventureMonster = state.adventure?.monster;
  const isAi = fighter?.battleSide === "AI" || fighter?.side === "AI" || fighter === state.battle?.ai;
  if (isAi && fighter?.id && adventureMonster?.id === fighter.id) return adventureMonster;
  const tutorialOpponent = state.options?.tutorial?.opponent;
  if (isAi && fighter?.id && tutorialOpponent?.id === fighter.id) return tutorialOpponent;
  const debugCombatant = skillDebugConfig()?.combatants?.find((combatant) => combatant.id === fighter?.id);
  if (debugCombatant) return debugCombatant;
  return state.options?.characters?.find((character) => (
    (fighter.id && character.id === fighter.id) || character.name === fighter.name
  )) || null;
}

function skillDebugConfig() {
  return state.options?.devTools?.skillDebug || null;
}

function syncPlayerCombatantOptions(wasSkillDebug = false, isSkillDebug = state.battleMode === "skill-debug") {
  if (!state.options) return;
  if (wasSkillDebug === isSkillDebug && els.playerSelect.options.length) return;
  if (isSkillDebug) {
    const combatants = sortCharacters(skillDebugConfig()?.combatants || []);
    fillSelect(
      els.playerSelect,
      combatants.map((combatant) => ({
        ...combatant,
        skillDebugDisplayName: combatant.debugLabel || combatant.name,
      })),
      "id",
      "skillDebugDisplayName",
      false,
    );
    const requested = state.skillDebugCombatantId;
    els.playerSelect.value = combatants.some((combatant) => combatant.id === requested)
      ? requested
      : String(combatants[0]?.id || "");
  } else {
    fillSelect(els.playerSelect, state.options.characters || [], "index", "name", true, "???");
    const requested = state.normalPlayerSelection;
    els.playerSelect.value = [...els.playerSelect.options].some((option) => option.value === requested)
      ? requested
      : "random";
  }
  syncAllCustomSelects();
}

function selectableCombatantsForPicker(api) {
  if (state.battleMode === "skill-debug" && api.select === els.playerSelect) {
    return sortCharacters(skillDebugConfig()?.combatants || []);
  }
  return state.options?.characters || [];
}

function combatantPickerValue(combatant, api) {
  return state.battleMode === "skill-debug" && api.select === els.playerSelect
    ? combatant.id
    : combatant.index;
}

function skillDebugCombatantDisplayName(combatant, api) {
  const isSkillDebugPlayer = state.battleMode === "skill-debug" && api.select === els.playerSelect;
  return isSkillDebugPlayer ? combatant.debugLabel || combatant.name : combatant.name;
}

function isSkillDebugDevCandidate(fighter) {
  if (!(state.battle?.skillDebug || state.battleMode === "skill-debug")) return false;
  return Boolean(skillDebugConfig()?.combatants?.some((combatant) => (
    combatant.devCandidate === true && combatant.id === fighter?.id
  )));
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
  const id = subject?.id === "fimit"
    ? subject.id
    : subject?.activeCharacterId || subject?.id || findCharacterByName(subject?.name)?.id;
  const assetGroup = id ? SPRITE_ASSETS[id] : null;
  if (!assetGroup) return null;
  const requestedVariant = String(subject?.battleSpriteVariant || "");
  const variant = BATTLE_SPRITE_VARIANTS[id]?.includes(requestedVariant) ? requestedVariant : null;
  return { id, assetGroup, variant };
}

function battleSpriteStateSrcForSubject(subject, spriteState = "idle") {
  const asset = spriteAssetForSubject(subject);
  if (!asset) return "";
  const renderState = resolvedBattleSpriteState(subject, spriteState);
  if (asset.variant) {
    const fileName = renderState === "idle" ? asset.variant : `${asset.variant}-${renderState}`;
    return localAssetUrl(`/assets/${asset.assetGroup}/${encodeURIComponent(asset.id)}/forms/${encodeURIComponent(fileName)}.webp`);
  }
  return localAssetUrl(`/assets/${asset.assetGroup}/${encodeURIComponent(asset.id)}/sprites/${renderState}.webp`);
}

function hasBattleSpriteStateAssets(asset) {
  if (!asset) return false;
  return asset.variant
    ? BATTLE_SPRITE_STATE_VARIANT_KEYS.has(`${asset.id}:${asset.variant}`)
    : BATTLE_SPRITE_STATE_ASSET_IDS.has(asset.id);
}

function resolvedBattleSpriteState(subject, spriteState = "idle") {
  const asset = spriteAssetForSubject(subject);
  if (!asset) return "idle";
  const requestedState = BATTLE_SPRITE_STATES.includes(spriteState) ? spriteState : "idle";
  return requestedState === "idle" || hasBattleSpriteStateAssets(asset)
    ? requestedState
    : "idle";
}

function preloadBattleSpriteStates(subject) {
  const asset = spriteAssetForSubject(subject);
  const spriteStates = hasBattleSpriteStateAssets(asset)
    ? BATTLE_SPRITE_STATES
    : ["idle"];
  for (const spriteState of spriteStates) {
    const src = battleSpriteStateSrcForSubject(subject, spriteState);
    if (!src || state.preloadedSpriteUrls.has(src)) continue;
    state.preloadedSpriteUrls.add(src);
    const image = new Image();
    image.src = src;
  }
}

function setBattleSpriteState(side, spriteState, holdMs = 0) {
  const fighter = state.battle?.[side];
  const renderState = resolvedBattleSpriteState(fighter, spriteState);
  const src = battleSpriteStateSrcForSubject(fighter, spriteState);
  const idleSrc = battleSpriteStateSrcForSubject(fighter, "idle");
  const image = document.querySelector(fighterIds[side]?.avatar)?.querySelector(".battle-sprite-side");
  if (!src || !image) return false;
  const token = ++state.spriteStateTokens[side];
  image.onerror = renderState === "idle" ? null : () => {
    image.onerror = null;
    image.src = idleSrc;
    image.dataset.spriteState = "idle";
  };
  image.src = src;
  image.dataset.spriteState = renderState;
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
    image.onerror = null;
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
