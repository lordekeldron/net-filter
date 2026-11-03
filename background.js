// Net Filter - Background Service Worker

const RULE_ID_START = 10000; // IDs dinâmicos começam aqui
const SAFESEARCH_RULE_ID_START = 20000;

// Domínios de busca que forçamos SafeSearch
const SEARCH_ENGINES = [
  { host: "www.google.com", param: "safe=active" },
  { host: "www.google.com.br", param: "safe=active" },
  { host: "google.com", param: "safe=active" },
  { host: "www.bing.com", param: "adlt=strict" },
  { host: "bing.com", param: "adlt=strict" },
  { host: "duckduckgo.com", param: "kp=1" },
  { host: "www.duckduckgo.com", param: "kp=1" },
  { host: "search.yahoo.com", param: "vm=r" },
  { host: "yahoo.com", param: "vm=r" }
];

// Estado padrão
const DEFAULT_SETTINGS = {
  enabled: true,
  password: null,
  customBlocked: [],
  customAllowed: [],
  forceSafeSearch: true
};

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get("settings");
  if (!data.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  await applyDynamicRules();
  await applySafeSearchRules();
  console.log("[Net Filter] Instalado e regras aplicadas.");
});

chrome.runtime.onStartup.addListener(async () => {
  await applyDynamicRules();
  await applySafeSearchRules();
});

// Mensagens do popup / options
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // resposta assíncrona
});

async function handleMessage(message) {
  const { type, payload } = message;

  switch (type) {
    case "GET_SETTINGS": {
      const { settings } = await chrome.storage.local.get("settings");
      return { settings: settings || DEFAULT_SETTINGS };
    }

    case "SET_ENABLED": {
      const { settings } = await chrome.storage.local.get("settings");
      const current = settings || DEFAULT_SETTINGS;

      // Se tem senha e está tentando desativar, exige senha
      if (!payload.enabled && current.password) {
        if (payload.password !== current.password) {
          return { success: false, error: "Senha incorreta" };
        }
      }

      current.enabled = payload.enabled;
      await chrome.storage.local.set({ settings: current });
      await applyDynamicRules();
      await applySafeSearchRules();
      return { success: true, settings: current };
    }

    case "ADD_CUSTOM_DOMAIN": {
      const domain = normalizeDomain(payload.domain);
      if (!domain) return { success: false, error: "Domínio inválido" };

      const { settings } = await chrome.storage.local.get("settings");
      const current = settings || DEFAULT_SETTINGS;

      if (!current.customBlocked.includes(domain)) {
        current.customBlocked.push(domain);
        // Remove da lista de permitidos se existir
        current.customAllowed = current.customAllowed.filter(d => d !== domain);
        await chrome.storage.local.set({ settings: current });
        await applyDynamicRules();
      }
      return { success: true, settings: current };
    }

    case "REMOVE_CUSTOM_DOMAIN": {
      const domain = normalizeDomain(payload.domain);
      const { settings } = await chrome.storage.local.get("settings");
      const current = settings || DEFAULT_SETTINGS;

      current.customBlocked = current.customBlocked.filter(d => d !== domain);
      await chrome.storage.local.set({ settings: current });
      await applyDynamicRules();
      return { success: true, settings: current };
    }

    case "ALLOW_DOMAIN": {
      const domain = normalizeDomain(payload.domain);
      if (!domain) return { success: false, error: "Domínio inválido" };

      const { settings } = await chrome.storage.local.get("settings");
      const current = settings || DEFAULT_SETTINGS;

      if (!current.customAllowed.includes(domain)) {
        current.customAllowed.push(domain);
        current.customBlocked = current.customBlocked.filter(d => d !== domain);
        await chrome.storage.local.set({ settings: current });
        await applyDynamicRules();
      }
      return { success: true, settings: current };
    }

    case "REMOVE_ALLOWED_DOMAIN": {
      const domain = normalizeDomain(payload.domain);
      const { settings } = await chrome.storage.local.get("settings");
      const current = settings || DEFAULT_SETTINGS;

      current.customAllowed = current.customAllowed.filter(d => d !== domain);
      await chrome.storage.local.set({ settings: current });
      await applyDynamicRules();
      return { success: true, settings: current };
    }

    case "SET_PASSWORD": {
      const { settings } = await chrome.storage.local.get("settings");
      const current = settings || DEFAULT_SETTINGS;

      // Se já existe senha, exige a antiga
      if (current.password && payload.oldPassword !== current.password) {
        return { success: false, error: "Senha atual incorreta" };
      }

      current.password = payload.password || null;
      await chrome.storage.local.set({ settings: current });
      return { success: true };
    }

    case "SET_SAFESEARCH": {
      const { settings } = await chrome.storage.local.get("settings");
      const current = settings || DEFAULT_SETTINGS;
      current.forceSafeSearch = !!payload.enabled;
      await chrome.storage.local.set({ settings: current });
      await applySafeSearchRules();
      return { success: true, settings: current };
    }

    default:
      return { success: false, error: "Comando desconhecido" };
  }
}

function normalizeDomain(input) {
  if (!input) return null;
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "");
  domain = domain.replace(/^www\./, "");
  domain = domain.split("/")[0];
  domain = domain.split("?")[0];
  // Validação básica
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    return null;
  }
  return domain;
}

async function applyDynamicRules() {
  const { settings } = await chrome.storage.local.get("settings");
  const current = settings || DEFAULT_SETTINGS;

  // Remove todas as regras dinâmicas antigas
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing
    .filter(r => r.id >= RULE_ID_START && r.id < SAFESEARCH_RULE_ID_START)
    .map(r => r.id);

  if (removeIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds });
  }

  if (!current.enabled) {
    // Desativa também a lista estática
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: ["adult_blocklist"]
    });
    return;
  }

  // Ativa lista estática
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: ["adult_blocklist"]
  });

  const rules = [];
  let id = RULE_ID_START;

  // Regras de bloqueio personalizadas
  for (const domain of current.customBlocked) {
    rules.push({
      id: id++,
      priority: 10,
      action: {
        type: "redirect",
        redirect: { extensionPath: "/blocked/blocked.html" }
      },
      condition: {
        urlFilter: `||${domain}^`,
        resourceTypes: ["main_frame", "sub_frame"]
      }
    });
  }

  // Regras de permissão (allow) — prioridade maior
  for (const domain of current.customAllowed) {
    rules.push({
      id: id++,
      priority: 100,
      action: { type: "allow" },
      condition: {
        urlFilter: `||${domain}^`,
        resourceTypes: ["main_frame", "sub_frame"]
      }
    });
  }

  if (rules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
  }
}

async function applySafeSearchRules() {
  const { settings } = await chrome.storage.local.get("settings");
  const current = settings || DEFAULT_SETTINGS;

  // Remove regras antigas de SafeSearch
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing
    .filter(r => r.id >= SAFESEARCH_RULE_ID_START)
    .map(r => r.id);

  if (removeIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds });
  }

  if (!current.enabled || !current.forceSafeSearch) return;

  const rules = [];
  let id = SAFESEARCH_RULE_ID_START;

  for (const engine of SEARCH_ENGINES) {
    // Redireciona buscas sem o parâmetro de SafeSearch
    rules.push({
      id: id++,
      priority: 5,
      action: {
        type: "redirect",
        redirect: {
          transform: {
            queryTransform: {
              addOrReplaceParams: [{ key: engine.param.split("=")[0], value: engine.param.split("=")[1] }]
            }
          }
        }
      },
      condition: {
        urlFilter: `||${engine.host}/search`,
        resourceTypes: ["main_frame"]
      }
    });
  }

  if (rules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
  }
}
