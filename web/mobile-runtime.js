(function installClientRuntime(global) {
  "use strict";

  const runtimeScript = document.currentScript;
  const baseUrl = new URL("./", runtimeScript?.src || global.location.href).href;
  global.__VERSUS_BASE_URL__ = baseUrl;

  const testMode = new URLSearchParams(global.location.search).has("mobile-runtime-test");
  const hostname = global.location.hostname.toLowerCase();
  const localServer = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
  const hostedWeb = !localServer && ["http:", "https:"].includes(global.location.protocol);
  if (!global.AndroidVersus && !testMode && !hostedWeb) return;
  const androidBridge = global.AndroidVersus || { exit() {} };
  const runtimeStatus = {
    active: true,
    ready: false,
    error: null,
    platform: global.AndroidVersus ? "android" : "web",
    baseUrl,
  };
  global.__VERSUS_MOBILE_RUNTIME__ = runtimeStatus;

  const nativeFetch = global.fetch.bind(global);
  const moduleCache = new Map();
  let storePromise = null;

  function resourceUrl(value) {
    return new URL(String(value).replace(/^\/+/, ""), baseUrl).href;
  }

  function normalizeModuleId(value) {
    const parts = [];
    for (const part of String(value).replaceAll("\\", "/").split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") parts.pop();
      else parts.push(part);
    }
    let id = `/${parts.join("/")}`;
    if (!id.endsWith(".js")) id += ".js";
    return id;
  }

  function resolveModuleId(parentId, request) {
    if (!request.startsWith(".")) throw new Error(`Unsupported browser module: ${request}`);
    const parentDirectory = parentId.slice(0, parentId.lastIndexOf("/"));
    return normalizeModuleId(`${parentDirectory}/${request}`);
  }

  function loadModule(moduleId) {
    let id = normalizeModuleId(moduleId);
    if (moduleCache.has(id)) return moduleCache.get(id).exports;

    let request = new XMLHttpRequest();
    request.open("GET", resourceUrl(id), false);
    request.send(null);
    if (request.status === 404 && id.endsWith(".js")) {
      id = `${id.slice(0, -3)}/index.js`;
      if (moduleCache.has(id)) return moduleCache.get(id).exports;
      request = new XMLHttpRequest();
      request.open("GET", resourceUrl(id), false);
      request.send(null);
    }
    if (request.status < 200 || request.status >= 300) {
      throw new Error(`Could not load JavaScript module ${id}: ${request.status}`);
    }

    const module = { exports: {} };
    moduleCache.set(id, module);
    const localRequire = (value) => loadModule(resolveModuleId(id, value));
    const directory = id.slice(0, id.lastIndexOf("/"));
    const factory = new Function("require", "module", "exports", "__filename", "__dirname", `${request.responseText}\n//# sourceURL=${id}`);
    factory(localRequire, module, module.exports, id, directory);
    return module.exports;
  }

  async function loadJson(path, optional = false) {
    const response = await nativeFetch(resourceUrl(path), { cache: "no-store" });
    if (!response.ok) {
      if (optional) return null;
      throw new Error(`${path} 로드 실패: ${response.status}`);
    }
    return response.json();
  }

  async function gameStore() {
    if (!storePromise) {
      storePromise = Promise.all([
        loadJson("/dataset/characters.json"),
        loadJson("/dataset/adventure-monsters.json"),
        loadJson("/dataset/adventure-events.json"),
        loadJson("/dataset/adventure-relics.json"),
        loadJson("/dataset/adventure-dialogue.json"),
        loadJson("/dataset/inscriptions.json"),
        loadJson("/dataset/firebase.json", true),
      ]).then(([characters, adventureMonsters, adventureEvents, adventureRelics, adventureDialogue, inscriptions, firebaseConfig]) => {
        const { MobileGameStore } = loadModule("/battle-engine/mobile-game-store.js");
        const store = new MobileGameStore({
          characters,
          adventureMonsters,
          adventureEvents,
          adventureRelics,
          adventureDialogue,
          inscriptions,
          firebaseConfig,
        });
        runtimeStatus.ready = true;
        return store;
      }).catch((error) => {
        runtimeStatus.error = error?.stack || error?.message || String(error);
        console.error("VERSUS client runtime failed", error);
        throw error;
      });
    }
    return storePromise;
  }

  function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  async function mobileApi(path, init) {
    try {
      const store = await gameStore();
      const method = String(init?.method || "GET").toUpperCase();
      const payload = init?.body ? JSON.parse(init.body) : {};
      if (method === "GET" && path === "/api/health") return jsonResponse({ ok: true, app: "VERSUS", root: runtimeStatus.platform });
      if (method === "GET" && path === "/api/options") return jsonResponse(store.options());
      if (method === "GET" && path === "/api/state") return jsonResponse(store.state());
      if (method === "POST" && path === "/api/new") return jsonResponse(store.newBattle(payload));
      if (method === "POST" && path === "/api/adventure/new") return jsonResponse(store.newAdventure(payload));
      if (method === "POST" && path === "/api/adventure/restore") return jsonResponse(store.restoreAdventure(payload));
      if (method === "POST" && path === "/api/adventure/choice") return jsonResponse(store.adventureChoice(payload));
      if (method === "POST" && path === "/api/action") return jsonResponse(store.chooseAction(payload));
      if (method === "POST" && path === "/api/pvp/join") return jsonResponse(await store.pvpJoin(payload));
      if (method === "POST" && path === "/api/pvp/state") return jsonResponse(await store.pvpState(payload));
      if (method === "POST" && path === "/api/pvp/action") return jsonResponse(await store.pvpChooseAction(payload));
      if (method === "POST" && path === "/api/pvp/leave") return jsonResponse(await store.pvpLeave(payload));
      if (method === "POST" && path === "/api/exit") {
        androidBridge.exit();
        return jsonResponse({ ok: true });
      }
      return jsonResponse({ ok: false, error: "Unknown client API." }, 404);
    } catch (error) {
      return jsonResponse({ ok: false, error: error?.message || String(error) }, 500);
    }
  }

  global.fetch = function mobileFetch(input, init) {
    const rawUrl = typeof input === "string" ? input : input.url;
    const url = new URL(rawUrl, global.location.href);
    if (url.origin === global.location.origin && url.pathname.startsWith("/api/")) {
      return mobileApi(url.pathname, init);
    }
    return nativeFetch(input, init);
  };
})(window);
