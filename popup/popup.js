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
  const toggle = document.getElementById("toggle-enabled");
  const statusText = document.getElementById("status-text");
  const passwordSection = document.getElementById("password-section");

  toggle.checked = currentSettings.enabled;

  if (currentSettings.enabled) {
    statusText.textContent = "Proteção ativa";
    statusText.className = "active";
  } else {
    statusText.textContent = "Proteção desativada";
    statusText.className = "inactive";
  }

  passwordSection.classList.add("hidden");
  renderCustomList();
}

function renderCustomList() {
  const list = document.getElementById("custom-list");
  const domains = currentSettings.customBlocked || [];

  if (domains.length === 0) {
    list.innerHTML = '<li class="empty">Nenhum site personalizado</li>';
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
      const res = await chrome.runtime.sendMessage({
        type: "REMOVE_CUSTOM_DOMAIN",
        payload: { domain }
      });
      if (res.success) {
        currentSettings = res.settings;
        renderCustomList();
      }
    });
  });
}

function bindEvents() {
  const toggle = document.getElementById("toggle-enabled");
  const confirmBtn = document.getElementById("confirm-disable");
  const addBtn = document.getElementById("add-domain");
  const domainInput = document.getElementById("domain-input");
  const optionsLink = document.getElementById("open-options");

  toggle.addEventListener("change", async () => {
    const wantEnable = toggle.checked;

    // Se está tentando desativar e tem senha
    if (!wantEnable && currentSettings.password) {
      toggle.checked = true; // reverte visualmente
      document.getElementById("password-section").classList.remove("hidden");
      document.getElementById("password-input").focus();
      return;
    }

    const res = await chrome.runtime.sendMessage({
      type: "SET_ENABLED",
      payload: { enabled: wantEnable }
    });

    if (res.success) {
      currentSettings = res.settings;
      updateUI();
    }
  });

  confirmBtn.addEventListener("click", async () => {
    const password = document.getElementById("password-input").value;
    const res = await chrome.runtime.sendMessage({
      type: "SET_ENABLED",
      payload: { enabled: false, password }
    });

    if (res.success) {
      currentSettings = res.settings;
      document.getElementById("password-input").value = "";
      updateUI();
    } else {
      alert(res.error || "Senha incorreta");
    }
  });

  addBtn.addEventListener("click", addDomain);
  domainInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addDomain();
  });

  optionsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

async function addDomain() {
  const input = document.getElementById("domain-input");
  const feedback = document.getElementById("domain-feedback");
  const domain = input.value.trim();

  if (!domain) {
    feedback.textContent = "Digite um domínio";
    feedback.className = "feedback error";
    return;
  }

  const res = await chrome.runtime.sendMessage({
    type: "ADD_CUSTOM_DOMAIN",
    payload: { domain }
  });

  if (res.success) {
    currentSettings = res.settings;
    input.value = "";
    feedback.textContent = "Site adicionado à lista de bloqueio";
    feedback.className = "feedback success";
    renderCustomList();
  } else {
    feedback.textContent = res.error || "Erro ao adicionar";
    feedback.className = "feedback error";
  }

  setTimeout(() => {
    feedback.textContent = "";
  }, 2500);
}
