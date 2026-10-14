function getTauriInvoke() {
  if (
    window.__TAURI__ &&
    window.__TAURI__.core &&
    typeof window.__TAURI__.core.invoke === "function"
  ) {
    return window.__TAURI__.core.invoke;
  }
  if (window.__TAURI__ && typeof window.__TAURI__.invoke === "function") {
    return window.__TAURI__.invoke;
  }
  return null;
}

export const invoke = async (cmd, args = {}) => {
  const tauriInvoke = getTauriInvoke();
  if (tauriInvoke) {
    return await tauriInvoke(cmd, args);
  }
  console.error("Tauri context not detected. Cannot execute:", cmd);
  throw new Error("デスクトップ環境（Tauri）が認識できませんでした。");
};

export function formatDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function escapeHtml(str) {
  return str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      }[tag] || tag)
  );
}

export function isEventOnDate(event, dateStr) {
  return dateStr >= event.start_date && dateStr <= event.end_date;
}

export function isAllDayOrSpanning(event) {
  return (
    event.is_all_day ||
    event.start_date !== event.end_date ||
    !event.start_time
  );
}