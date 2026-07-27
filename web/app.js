const LOG_DELAY_MS = 280;
const EFFECT_SETTLE_MS = 620;
const SFX_VOLUME = 0.28;
const BGM_FADE_MS = 900;

const els = {
  homeScreen: document.querySelector("#homeScreen"),
  battleScreen: document.querySelector("#battleScreen"),
  codexScreen: document.querySelector("#codexScreen"),
  openBattleButton: document.querySelector("#openBattleButton"),
  openCodexButton: document.querySelector("#openCodexButton"),
  exitButton: document.querySelector("#exitButton"),
  battleBackButton: document.querySelector("#battleBackButton"),
  codexBackButton: document.querySelector("#codexBackButton"),
  playerSelect: document.querySelector("#playerSelect"),
  aiSelect: document.querySelector("#aiSelect"),
  personalitySelect: document.querySelector("#personalitySelect"),
  seedInput: document.querySelector("#seedInput"),
  startButton: document.querySelector("#startButton"),
  matchLabel: document.querySelector("#matchLabel"),
  turnChip: document.querySelector("#turnChip"),
  actionsGrid: document.querySelector("#actionsGrid"),
  actionHint: document.querySelector("#actionHint"),
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
  toxiche: "#78e052",
  cryne: "#c33a3a",
  plote: "#ff5a2f",
  ashend: "#9aa0aa",
  karossy: "#5eb8ff",
  nihfle: "#6db7ff",
  serpen: "#e9d16a",
  melague: "#63d04f",
  balef: "#f29b38",
  revesha: "#a874ff",
  gandrick: "#eadfbd",
  charinel: "#f05fb8",
  dethus: "#c9a05b",
  zeroven: "#20d6c7",
  neroko: "#f4f33a",
};

const RANDOM_CHARACTER_COLOR = "#ffffff";

const CHARACTER_SKILL_ICON_IDS = new Set(["toxiche", "cryne", "karossy", "gandrick", "melague", "balef", "plote", "charinel", "nihfle", "ashend", "dethus", "zeroven", "revesha", "serpen", "neroko"]);
const CHARACTER_PORTRAIT_IDS = new Set(["toxiche", "cryne", "karossy", "gandrick", "melague", "balef", "plote", "charinel", "nihfle", "ashend", "dethus", "zeroven", "revesha", "serpen", "neroko"]);

const EFFECT_CLASSES = ["hit", "miss", "defense", "heal", "buff", "debuff", "stack-gain", "stack-spend"];
const EFFECT_SFX = {
  hit: "/assets/sfx/hit.wav",
  miss: "/assets/sfx/miss.wav",
  defense: "/assets/sfx/defense.wav",
  heal: "/assets/sfx/heal.wav",
  buff: "/assets/sfx/buff.wav",
  debuff: "/assets/sfx/debuff.wav",
  "stack-gain": "/assets/sfx/stack-gain.wav",
  "stack-spend": "/assets/sfx/stack-spend.wav",
};
const BGM_TRACKS = {
  victory: { src: "/assets/bgm/victory.wav", loop: false, volume: 0.24 },
  defeat: { src: "/assets/bgm/defeat.wav", loop: false, volume: 0.22 },
  draw: { src: "/assets/bgm/draw.wav", loop: false, volume: 0.2 },
};
const DEFENSE_ACTION_NAMES = new Set(["일반 방어", "가로막는 불길", "절대영도", "깨져버린 거울", "빠져드는 모래늪"]);

const state = {
  options: null,
  battle: null,
  busy: false,
  selectedCodexIndex: 0,
  turnLogs: [],
  currentLogIndex: -1,
  logToken: 0,
  customSelects: [],
  characterPickers: [],
  activeCharacterPicker: null,
  effectTimers: [],
  sfx: new Map(),
  bgm: new Map(),
  bgmFadeTimers: [],
  currentBgm: null,
  currentBgmType: null,
};

init();

async function init() {
  bindEvents();
  renderEmptyBattle();
  renderEmptyActions();
  renderLog();
  await loadOptions();
}

function bindEvents() {
  els.openBattleButton.addEventListener("click", () => showScreen("battle"));
  els.openCodexButton.addEventListener("click", () => showScreen("codex"));
  els.battleBackButton.addEventListener("click", () => showScreen("home"));
  els.codexBackButton.addEventListener("click", () => showScreen("home"));
  els.exitButton.addEventListener("click", exitApp);
  els.startButton.addEventListener("click", startBattle);
  els.prevLogButton.addEventListener("click", () => moveLog(-1));
  els.nextLogButton.addEventListener("click", () => moveLog(1));
  els.enemyInfoButton.addEventListener("click", () => openFighterInfo("ai"));
  els.battleRecordButton.addEventListener("click", openBattleRecords);
  els.playerInfoButton.addEventListener("click", () => openFighterInfo("player"));
  els.enemyInfoScrim.addEventListener("click", closeInfoModal);
  els.enemyInfoCloseButton.addEventListener("click", closeInfoModal);
  els.characterPickerScrim.addEventListener("click", closeCharacterPicker);
  els.characterPickerCloseButton.addEventListener("click", closeCharacterPicker);
  document.addEventListener("click", closeCustomSelectsOnOutside);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCustomSelects();
      closeCharacterPicker();
      closeInfoModal();
    }
  });
}

function prepareSfx() {
  if (state.sfx.size) return;
  for (const [type, src] of Object.entries(EFFECT_SFX)) {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = SFX_VOLUME;
    state.sfx.set(type, audio);
  }
}

function primeSfx() {
  prepareSfx();
  for (const audio of state.sfx.values()) {
    audio.load();
  }
}

function prepareBgm() {
  if (state.bgm.size) return;
  for (const [type, track] of Object.entries(BGM_TRACKS)) {
    const audio = new Audio(track.src);
    audio.preload = "auto";
    audio.loop = Boolean(track.loop);
    audio.volume = track.volume;
    state.bgm.set(type, audio);
  }
}

function primeAudio() {
  primeSfx();
  prepareBgm();
  for (const audio of state.bgm.values()) {
    audio.load();
  }
}

function showScreen(name) {
  for (const screen of [els.homeScreen, els.battleScreen, els.codexScreen]) {
    screen.classList.remove("is-active");
  }
  if (name === "battle") {
    els.battleScreen.classList.add("is-active");
  } else if (name === "codex") {
    stopBgm();
    els.codexScreen.classList.add("is-active");
    renderCodex();
  } else {
    stopBgm();
    els.homeScreen.classList.add("is-active");
  }
}

async function loadOptions() {
  try {
    const data = await api("/api/options");
    data.characters = sortCharacters(data.characters);
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
    showScreen("battle");
    await startBattle();
  } else if (hash === "#battle") {
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
    openCharacterPicker(api);
  });
  select.addEventListener("change", api.sync);
}

function syncCharacterPickerButton(api) {
  const { select, label, button } = api;
  const character = findCharacterByIndex(select.value);
  const selectedName = selectedText(select);
  button.style.setProperty("--character-color", character ? characterColor(character.id) : RANDOM_CHARACTER_COLOR);
  button.setAttribute("aria-label", `${label}: ${selectedName}`);
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
    list.hidden = !shouldOpen;
  });
  select.addEventListener("change", api.sync);
}

function syncCustomSelect(select, button, list) {
  const selected = select.options[select.selectedIndex];
  button.textContent = selected?.textContent || "-";
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
  syncAllCustomSelects();
}

function previewSelectedMatch() {
  const player = selectedText(els.playerSelect);
  const ai = selectedText(els.aiSelect);
  const personality = selectedText(els.personalitySelect);
  els.matchLabel.textContent = `${player} vs ${ai} · ${personality}`;
  els.aiModeText.textContent = personality;
}

async function startBattle() {
  if (state.busy) return;
  primeAudio();
  stopBgm(300);
  setBusy(true);
  clearLogs();
  try {
    const payload = {
      playerIndex: els.playerSelect.value,
      aiIndex: els.aiSelect.value,
      personalityId: els.personalitySelect.value,
      seed: parseSeed(els.seedInput.value),
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

async function chooseAction(actionNumber) {
  if (state.busy || !state.battle || state.battle.is_over) return;
  primeAudio();
  setBusy(true);
  try {
    const previousTurn = state.battle.turn;
    const data = await api("/api/action", { action: actionNumber });
    const isGameOver = Boolean(data.is_over || data.gameOver);
    await pushTurnLog(`TURN ${previousTurn}`, data.log, true, {
      settleEffects: isGameOver,
      syncState: true,
    });
    state.battle = data;
    renderBattle(data, { animateDefeat: isGameOver });
    if (isGameOver) {
      playResultBgm(data);
    }
  } catch (error) {
    pushTurnLog("오류", [`행동 처리 실패: ${error.message}`], false);
  } finally {
    setBusy(false);
  }
}

function renderEmptyBattle() {
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
  renderFighter("player", data.player);
  renderFighter("ai", data.ai);
  renderPassive(data.player);
  renderActions(data.actions || [], data.is_over);
  renderBattleRecordButton(data);
  els.turnChip.textContent = data.is_over ? `TURN ${data.turn} 종료` : `TURN ${data.turn}`;
  els.matchLabel.textContent = `${data.player.name} vs ${data.ai.name} · ${data.personality.name}`;
  els.aiModeText.textContent = data.personality.name;
  els.enemyInfoButton.disabled = false;
  els.playerInfoButton.disabled = false;
  syncDefeatPortraits(data, options.animateDefeat);
}

function renderFighter(side, fighter) {
  const ids = fighterIds[side];
  const maxHp = fighter.max_hp ?? fighter.maxHp ?? 0;
  const maxMp = fighter.max_mp ?? fighter.maxMp ?? 0;
  const defense = fighter.defense ?? fighter.stats?.def ?? "-";
  const stateText = fighter.status_text || fighter.stateText || "없음";
  const avatar = document.querySelector(ids.avatar);
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

function renderActions(actions, isOver) {
  els.actionsGrid.innerHTML = "";
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
  const disabled = !passive || state.busy;
  slot.className = `action-button passive-action${disabled ? " is-disabled" : ""}`;
  slot.tabIndex = disabled ? -1 : 0;
  slot.setAttribute("role", "button");
  slot.setAttribute("aria-disabled", disabled ? "true" : "false");
  slot.setAttribute("aria-label", passive ? `패시브: ${passive.name}` : "패시브");
  slot.innerHTML = `
    ${skillIconHtml({ number: 0, name: passive?.name || "패시브" })}
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
  return fighter?.passive || character?.passive || null;
}

function skillIconHtml(action) {
  return skillIconHtmlForCharacter(action, currentPlayerCharacterId());
}

function skillIconHtmlForCharacter(action, characterId) {
  const meta = skillIconMeta(action, characterId);
  const glyph = meta.glyph || action.name.trim().slice(0, 1) || "?";
  return `
    <span class="skill-icon ${meta.className}" aria-hidden="true">
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
  if (!characterId || !CHARACTER_SKILL_ICON_IDS.has(characterId)) return null;
  if (number >= 1 && number <= 3) return null;
  const fileName = number === 0 ? "passive" : `skill${number}`;
  return `/assets/characters/${encodeURIComponent(characterId)}/skills/${fileName}.webp`;
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
  renderLog({ follow: true });

  const token = ++state.logToken;
  if (!animated) return;
  let playedEffect = false;
  for (let index = 1; index <= packet.entries.length; index += 1) {
    await sleep(LOG_DELAY_MS);
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
}

function compactLogEntries(lines) {
  const result = [];
  let skippingInfo = false;
  const context = { actorName: null };
  for (const rawLine of lines || []) {
    const line = String(rawLine).trim();
    if (!line) continue;
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
    return { fighterName: match[1], hp: Number(match[3]) };
  }

  match = line.match(/^(.+?)(?:은|는) .+?로 \d+의 고정 피해를 입었다\. HP (\d+)\s*(?:→|->)\s*(\d+)/);
  if (match) {
    return { fighterName: match[1], hp: Number(match[3]) };
  }

  match = line.match(/^(.+?) HP 회복 \d+\s*(?:→|->)\s*(\d+)/);
  if (match) {
    return { fighterName: match[1], hp: Number(match[2]) };
  }

  match = line.match(/^(?:(.+?) )?MP \d+\s*(?:→|->)\s*(\d+)/);
  if (match) {
    return { fighterName: match[1] || context.actorName, mp: Number(match[2]) };
  }

  return null;
}

function applyLogStatePatch(patch) {
  if (!patch || !state.battle) return;
  const side = sideForFighterName(patch.fighterName);
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
    return null;
  }

  const actionMatch = line.match(/^(.+?)(?:은|는) (.+?)(?:을|를) 사용했다\.$/);
  if (actionMatch) {
    const [, actorName, actionName] = actionMatch;
    context.actorName = actorName;
    if (DEFENSE_ACTION_NAMES.has(actionName)) {
      return makeLogEffect("defense", actorName, actorName, "방어");
    }
    return null;
  }

  if (line.includes("공격이 빗나갔다") || line.includes("공격이 회피되었다")) {
    return makeMissEffect(context.actorName);
  }

  let match = line.match(/^(?:\d+타:\s*)?(.+?)에게 (\d+)의 피해\./);
  if (match) {
    return Number(match[2]) > 0 ? makeLogEffect("hit", match[1], context.actorName, match[2]) : null;
  }

  match = line.match(/^(.+?)(?:은|는) .+?로 (\d+)의 고정 피해를 입었다\./);
  if (match) {
    return Number(match[2]) > 0 ? makeLogEffect("hit", match[1], context.actorName, match[2]) : null;
  }

  match = line.match(/^(.+?) HP 회복 (\d+)\s*(?:→|->)\s*(\d+)/);
  if (match) {
    const amount = Number(match[3]) - Number(match[2]);
    return amount > 0 ? makeLogEffect("heal", match[1], match[1], `HP +${amount}`) : null;
  }

  match = line.match(/^(?:(.+?) )?MP (\d+)\s*(?:→|->)\s*(\d+)/);
  if (match) {
    const fighterName = match[1] || context.actorName;
    const amount = Number(match[3]) - Number(match[2]);
    return fighterName && amount > 0 ? makeLogEffect("heal", fighterName, fighterName, `MP +${amount}`) : null;
  }

  match = line.match(/^(.+?)에게 (.+?) 상태가/);
  if (match) {
    return makeLogEffect("debuff", match[1], context.actorName, match[2]);
  }

  match = line.match(/^(.+?)에게 (.+?) (\d+)중첩이/);
  if (match) {
    const [, targetName, stackName, amountText] = match;
    context.lastStackOwner = targetName;
    context.lastStackName = stackName;
    return makeLogEffect("stack-gain", targetName, context.actorName, `${stackName}+${amountText}`);
  }

  match = line.match(/^(.+?)의 (ATK|DEF|SPD).*x([0-9.]+)/);
  if (match) {
    const multiplier = Number(match[3]);
    return makeLogEffect(multiplier >= 1 ? "buff" : "debuff", match[1], match[1], match[2]);
  }

  match = line.match(/^(.+?)의 (.+?) (\d+)\s*(?:→|->)\s*(\d+)중첩/);
  if (match) {
    const [, targetName, stackName, beforeText, afterText] = match;
    const before = Number(beforeText);
    const after = Number(afterText);
    context.lastStackOwner = targetName;
    context.lastStackName = stackName;
    if (after > before) {
      return makeLogEffect("stack-gain", targetName, targetName, `${stackName}+${after - before}`);
    }
    if (after < before) {
      return makeLogEffect("stack-spend", targetName, targetName, `${stackName}-${before - after}`);
    }
    return null;
  }

  match = line.match(/^(.+?)(?:이|가) (\d+)중첩 증가했다\./);
  if (match && context.actorName) {
    const [, stackName, amountText] = match;
    context.lastStackOwner = context.actorName;
    context.lastStackName = stackName;
    return makeLogEffect("stack-gain", context.actorName, context.actorName, `${stackName}+${amountText}`);
  }

  match = line.match(/^(.+?) (\d+)중첩 소모:/);
  if (match && context.actorName) {
    const [, stackName, amountText] = match;
    context.lastStackOwner = context.actorName;
    context.lastStackName = stackName;
    return makeLogEffect("stack-spend", context.actorName, context.actorName, `${stackName}-${amountText}`);
  }

  match = line.match(/^(.+?)의 (.+?) (\d+)중첩을 소모했다\./);
  if (match) {
    const [, targetName, stackName, amountText] = match;
    context.lastStackOwner = targetName;
    context.lastStackName = stackName;
    return makeLogEffect("stack-spend", targetName, targetName, `${stackName}-${amountText}`);
  }

  match = line.match(/^(.+?)을 모두 소모했다\./);
  if (match && context.actorName) {
    const stackName = match[1];
    context.lastStackOwner = context.actorName;
    context.lastStackName = stackName;
    return makeLogEffect("stack-spend", context.actorName, context.actorName, `${stackName} 전부`);
  }

  match = line.match(/^(.+?) (\d+)중첩(?:을|이) 모두 소모/);
  if (match) {
    const [, stackName] = match;
    const targetName = context.lastStackName === stackName ? context.lastStackOwner : context.actorName;
    if (targetName) {
      context.lastStackOwner = targetName;
      context.lastStackName = stackName;
      return makeLogEffect("stack-spend", targetName, targetName, `${stackName} 전부`);
    }
  }

  return null;
}

function makeLogEffect(type, targetName, sourceName, value) {
  const side = sideForFighterName(targetName);
  if (!side) return null;
  const target = state.battle?.[side];
  const sourceSide = sideForFighterName(sourceName);
  const source = sourceSide ? state.battle?.[sourceSide] : null;
  const useSourceColor =
    type === "hit" || type === "debuff" || (type === "stack-gain" && sourceSide && sourceSide !== side);
  const sourceId = useSourceColor ? source?.id : target?.id;
  return {
    type,
    side,
    value,
    color: characterColor(sourceId || target?.id),
  };
}

function makeMissEffect(actorName) {
  const actorSide = sideForFighterName(actorName);
  const side = actorSide === "player" ? "ai" : actorSide === "ai" ? "player" : null;
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
    value.textContent = effect.type === "hit" ? `-${effect.value}` : String(effect.value);
    stage.append(value);
    registerEffectTimeout(window.setTimeout(() => value.remove(), 850));
  }

  registerEffectTimeout(window.setTimeout(() => burst.remove(), 760));
  registerEffectTimeout(window.setTimeout(() => stage.classList.remove(className), 520));
}

function playEffectSound(type) {
  prepareSfx();
  const source = state.sfx.get(type);
  if (!source) return;
  const sound = source.cloneNode();
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

function playResultBgm(data) {
  const type = resultBgmType(data);
  if (type) {
    playBgm(type, BGM_FADE_MS);
  }
}

function resultBgmType(data) {
  if (!data?.is_over && !data?.gameOver) return null;
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

function sideForFighterName(name) {
  if (!name || !state.battle) return null;
  if (state.battle.player?.name === name) return "player";
  if (state.battle.ai?.name === name) return "ai";
  return null;
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
  els.prevLogButton.disabled = state.currentLogIndex <= 0;
  els.nextLogButton.disabled = state.currentLogIndex >= state.turnLogs.length - 1;
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
  const nextIndex = state.currentLogIndex + delta;
  if (nextIndex < 0 || nextIndex >= state.turnLogs.length) return;
  state.currentLogIndex = nextIndex;
  const packet = state.turnLogs[state.currentLogIndex];
  packet.visibleCount = (packet.entries || packet.lines || []).length;
  renderLog();
}

function clearLogs() {
  state.logToken += 1;
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
  els.startButton.disabled = isBusy;
  if (state.battle) {
    renderActions(state.battle.actions || [], state.battle.is_over);
  }
}

async function exitApp() {
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

async function api(path, body) {
  const init = body === undefined
    ? undefined
    : {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      };
  const response = await fetch(path, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `${response.status} ${response.statusText}`);
  }
  return data;
}

function parseSeed(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const seed = Number(trimmed);
  return Number.isFinite(seed) ? seed : null;
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
  if (!CHARACTER_PORTRAIT_IDS.has(id)) {
    return avatarSvg(name, side);
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
  return `/assets/characters/${encodeURIComponent(id)}/portrait.png`;
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

function avatarSvg(name, side) {
  const safeName = name && name !== "-" ? name : "V";
  const hue = hashName(safeName) % 360;
  const hue2 = (hue + 82) % 360;
  const accent = `hsl(${hue} 74% 58%)`;
  const accent2 = `hsl(${hue2} 74% 62%)`;
  const dark = `hsl(${hue} 32% 23%)`;
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
