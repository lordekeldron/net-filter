document.addEventListener("DOMContentLoaded", init);

let currentSettings = null;

async function init() {
  await loadSettings();
  bindEvents();
}

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  currentSettings = response.settings;
  updateUI();
}

function updateUI() {
  document.getElementById("toggle-safesearch").checked = currentSettings.forceSafeSearch;
  renderList("custom-domains-list", currentSettings.customBlocked || [], "REMOVE_CUSTOM_DOMAIN");
  renderList("allowed-domains-list", currentSettings.customAllowed || [], "ALLOW_DOMAIN_REMOVE");
}

function renderList(elementId, domains, removeType) {
  const list = document.getElementById(elementId);

  if (!domains.length) {
    list.innerHTML = '<li class="empty">Nenhum item</li>';
    return;
  }

  list.innerHTML = domains
    .map(
      (d) => `
      <li>
        <span>${d}</span>
        <button class="btn btn-small" data-domain="${d}">Remover</button>
      </li>
    `
    )
    .join("");

  list.querySelectorAll(".btn-small").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const domain = btn.dataset.domain;

      if (removeType === "REMOVE_CUSTOM_DOMAIN") {
        const res = await chrome.runtime.sendMessage({
          type: "REMOVE_CUSTOM_DOMAIN",
          payload: { domain }
        });
        if (res.success) {
          currentSettings = res.settings;
          updateUI();
        }
      } else {
        // Remover da lista de permitidos
        const { settings } = await chrome.storage.local.get("settings");
        settings.customAllowed = settings.customAllowed.filter((d) => d !== domain);
        await chrome.storage.local.set({ settings });
        currentSettings = settings;
        // Reaplica regras
        await chrome.runtime.sendMessage({ type: "GET_SETTINGS" }); // força refresh
        // Chama apply via SET_ENABLED trick ou mensagem específica
        await chrome.runtime.sendMessage({
          type: "SET_ENABLED",
          payload: { enabled: currentSettings.enabled }
        });
        await loadSettings();
      }
    });
  });
}

function bindEvents() {
  document.getElementById("save-password").addEventListener("click", savePassword);
  document.getElementById("remove-password").addEventListener("click", removePassword);
  document.getElementById("toggle-safesearch").addEventListener("change", toggleSafeSearch);
  document.getElementById("add-domain-btn").addEventListener("click", () => addDomain("block"));
  document.getElementById("allow-domain-btn").addEventListener("click", () => addDomain("allow"));

  document.getElementById("add-domain-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addDomain("block");
  });
  document.getElementById("allow-domain-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addDomain("allow");
  });
}

async function savePassword() {
  const current = document.getElementById("current-password").value;
  const neu = document.getElementById("new-password").value;
  const confirm = document.getElementById("confirm-password").value;
  const feedback = document.getElementById("password-feedback");

  if (neu.length < 4) {
    feedback.textContent = "A senha deve ter pelo menos 4 caracteres";
    feedback.className = "feedback error";
    return;
  }

  if (neu !== confirm) {
    feedback.textContent = "As senhas não coincidem";
    feedback.className = "feedback error";
    return;
  }

  const res = await chrome.runtime.sendMessage({
    type: "SET_PASSWORD",
    payload: { password: neu, oldPassword: current }
  });

  if (res.success) {
    feedback.textContent = "Senha salva com sucesso";
    feedback.className = "feedback success";
    document.getElementById("current-password").value = "";
    document.getElementById("new-password").value = "";
    document.getElementById("confirm-password").value = "";
    await loadSettings();
  } else {
    feedback.textContent = res.error || "Erro ao salvar senha";
    feedback.className = "feedback error";
  }
}

async function removePassword() {
  const current = document.getElementById("current-password").value;
  const feedback = document.getElementById("password-feedback");

  const res = await chrome.runtime.sendMessage({
    type: "SET_PASSWORD",
    payload: { password: null, oldPassword: current }
  });

  if (res.success) {
    feedback.textContent = "Senha removida";
    feedback.className = "feedback success";
    document.getElementById("current-password").value = "";
    await loadSettings();
  } else {
    feedback.textContent = res.error || "Senha atual incorreta";
    feedback.className = "feedback error";
  }
}

async function toggleSafeSearch(e) {
  const res = await chrome.runtime.sendMessage({
    type: "SET_SAFESEARCH",
    payload: { enabled: e.target.checked }
  });
  if (res.success) {
    currentSettings = res.settings;
  }
}

async function addDomain(type) {
  const inputId = type === "block" ? "add-domain-input" : "allow-domain-input";
  const input = document.getElementById(inputId);
  const domain = input.value.trim();

  if (!domain) return;

  const messageType = type === "block" ? "ADD_CUSTOM_DOMAIN" : "ALLOW_DOMAIN";
  const res = await chrome.runtime.sendMessage({
    type: messageType,
    payload: { domain }
  });

  if (res.success) {
    currentSettings = res.settings;
    input.value = "";
    updateUI();
  } else {
    alert(res.error || "Erro ao processar domínio");
  }
}
