import { state, setCurrentUser } from "../state.js";
import { invoke } from "../utils/tauri.js";

const accountBtn = document.getElementById("accountBtn");
const accountAvatarIcon = document.getElementById("accountAvatarIcon");
const accountDropdown = document.getElementById("accountDropdown");
const accountDropdownName = document.getElementById("accountDropdownName");
const accountDropdownDevice = document.getElementById("accountDropdownDevice");
const logoutBtn = document.getElementById("logoutBtn");

const authModal = document.getElementById("authModal");
const closeAuthModalBtn = document.getElementById("closeAuthModalBtn");
const cancelAuthBtn = document.getElementById("cancelAuthBtn");
const abortAuthBtn = document.getElementById("abortAuthBtn");
const authInitForm = document.getElementById("authInitForm");
const authUsername = document.getElementById("authUsername");
const authDevice = document.getElementById("authDevice");
const startAuthBtn = document.getElementById("startAuthBtn");

const authStepInput = document.getElementById("authStepInput");
const authStepWaiting = document.getElementById("authStepWaiting");
const authDisplayCode = document.getElementById("authDisplayCode");
const copyAuthCodeBtn = document.getElementById("copyAuthCodeBtn");
const openBrowserBtn = document.getElementById("openBrowserBtn");
const pollingStatusText = document.getElementById("pollingStatusText");
const pollingTimerText = document.getElementById("pollingTimerText");
const authErrorMsg = document.getElementById("authErrorMsg");

let pollingIntervalId = null;
let countdownTimerId = null;
let remainingSeconds = 300;
let currentWebAuthUrl = "";

export function updateAccountUI() {
  accountDropdown.classList.add("hidden");
  if (state.currentUser && state.currentUser.username) {
    accountBtn.classList.add("logged-in");
    accountAvatarIcon.textContent = state.currentUser.username.slice(0, 1).toUpperCase();
    accountDropdownName.textContent = state.currentUser.username;
    accountDropdownDevice.textContent = `デバイス: ${state.currentUser.device || "不明"}`;
  } else {
    accountBtn.classList.remove("logged-in");
    accountAvatarIcon.textContent = "👤";
  }
}

export async function loadAuthUser() {
  try {
    const user = await invoke("get_current_user");
    setCurrentUser(user);
  } catch (err) {
    setCurrentUser(null);
  }
  updateAccountUI();
}

export function openAuthModal() {
  stopAuthPolling();
  authStepInput.classList.remove("hidden");
  authStepWaiting.classList.add("hidden");
  authErrorMsg.classList.add("hidden");
  authErrorMsg.textContent = "";

  authUsername.value = "";
  authDevice.value = "";
  startAuthBtn.disabled = false;
  startAuthBtn.textContent = "ウェブで認証";

  authModal.classList.remove("hidden");
  authUsername.focus();
}

export function closeAuthModal() {
  stopAuthPolling();
  authModal.classList.add("hidden");
}

function stopAuthPolling() {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
  }
  if (countdownTimerId) {
    clearInterval(countdownTimerId);
    countdownTimerId = null;
  }
}

function startAuthWaiting({ sid, code, webUrl, username, device }) {
  currentWebAuthUrl = webUrl;

  // 入力画面を隠し、待機画面（認証コード表示）に確実に切り替える
  authStepInput.classList.add("hidden");
  authStepWaiting.classList.remove("hidden");
  authErrorMsg.classList.add("hidden");
  authErrorMsg.textContent = "";

  authDisplayCode.textContent = code;

  copyAuthCodeBtn.onclick = () => {
    navigator.clipboard.writeText(code).then(() => {
      copyAuthCodeBtn.textContent = "コピーしました！";
      setTimeout(() => (copyAuthCodeBtn.textContent = "コードをコピー"), 2000);
    });
  };

  openBrowserBtn.onclick = async () => {
    try {
      await invoke("open_in_browser", { url: currentWebAuthUrl });
    } catch (err) {
      showAuthError(`ブラウザ起動失敗: ${err.message || err}`);
    }
  };

  remainingSeconds = 300;
  updateTimerDisplay();

  countdownTimerId = setInterval(() => {
    remainingSeconds--;
    updateTimerDisplay();
    if (remainingSeconds <= 0) {
      stopAuthPolling();
      showAuthError("認証コードの有効期限（5分）が切れました。再度お試しください。");
    }
  }, 1000);

  pollingIntervalId = setInterval(async () => {
    try {
      const status = await invoke("check_auth_status", { sid, username, device });
      if (status === "authenticated") {
        stopAuthPolling();
        const userObj = { username, device, sid };
        await invoke("save_login_user", { user: userObj });
        setCurrentUser(userObj);
        updateAccountUI();
        closeAuthModal();
      } else if (status === "expired") {
        stopAuthPolling();
        showAuthError("認証コードの有効期限が切れました。再度お試しください。");
      }
    } catch (err) {
      console.warn("Polling warning:", err);
    }
  }, 3000);
}

function updateTimerDisplay() {
  const m = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
  const s = String(remainingSeconds % 60).padStart(2, "0");
  pollingTimerText.textContent = `残り ${m}:${s}`;
}

function showAuthError(msg) {
  authErrorMsg.textContent = msg;
  authErrorMsg.classList.remove("hidden");
  pollingStatusText.textContent = "待機を停止しました";
}

export function initAuth() {
  accountBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.currentUser && state.currentUser.username) {
      accountDropdown.classList.toggle("hidden");
    } else {
      accountDropdown.classList.add("hidden");
      openAuthModal();
    }
  });

  document.addEventListener("click", (e) => {
    if (!accountDropdown.contains(e.target) && e.target !== accountBtn) {
      accountDropdown.classList.add("hidden");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    if (confirm("ログアウトしますか？")) {
      await invoke("logout");
      setCurrentUser(null);
      accountDropdown.classList.add("hidden");
      updateAccountUI();
    }
  });

  closeAuthModalBtn.addEventListener("click", closeAuthModal);
  cancelAuthBtn.addEventListener("click", closeAuthModal);
  abortAuthBtn.addEventListener("click", closeAuthModal);

  authInitForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = authUsername.value.trim();
    const device = authDevice.value.trim();
    if (!username || !device) return;

    startAuthBtn.disabled = true;
    startAuthBtn.textContent = "認証コードを発行中...";
    authErrorMsg.classList.add("hidden");
    authErrorMsg.textContent = "";

    try {
      const res = await invoke("register_auth_code", { username, device });
      if (!res || !res.code) {
        throw new Error("認証コードの取得に失敗しました。");
      }

      // Step 2（待機・コード表示）へ切り替え
      startAuthWaiting({
        sid: res.sid,
        code: res.code,
        webUrl: res.web_url,
        username,
        device,
      });
    } catch (err) {
      console.error("register_auth_code エラー:", err);
      showAuthError(`エラー: ${err.message || err}`);
      startAuthBtn.disabled = false;
      startAuthBtn.textContent = "ウェブで認証";
    }
  });
}