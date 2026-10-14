import { state, setAllEvents, addRecentColor, setPendingDeleteEvent } from "../state.js";
import { invoke, formatDateString, escapeHtml } from "../utils/tauri.js";
import { renderCurrentView } from "../main.js";

const eventModal = document.getElementById("eventModal");
const modalTitle = document.getElementById("modalTitle");
const editingEventId = document.getElementById("editingEventId");
const openAddModalBtn = document.getElementById("openAddModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const submitEventBtn = document.getElementById("submitEventBtn");
const eventForm = document.getElementById("eventForm");
const eventTitle = document.getElementById("eventTitle");
const eventIsAllDay = document.getElementById("eventIsAllDay");
const eventStartDate = document.getElementById("eventStartDate");
const eventEndDate = document.getElementById("eventEndDate");
const eventStartTime = document.getElementById("eventStartTime");
const eventEndTime = document.getElementById("eventEndTime");
const eventDesc = document.getElementById("eventDesc");
const eventColor = document.getElementById("eventColor");
const recentColorsList = document.getElementById("recentColorsList");

const deleteConfirmModal = document.getElementById("deleteConfirmModal");
const deleteConfirmMessage = document.getElementById("deleteConfirmMessage");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const executeDeleteBtn = document.getElementById("executeDeleteBtn");

const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const searchResults = document.getElementById("searchResults");

export function renderRecentColors() {
  recentColorsList.innerHTML = "";
  state.recentColors.slice(0, 5).forEach((color) => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = color;
    swatch.addEventListener("click", () => {
      eventColor.value = color;
    });
    recentColorsList.appendChild(swatch);
  });
}

export async function fetchEvents() {
  try {
    const data = await invoke("get_events");
    setAllEvents(data);
  } catch (err) {
    console.error("fetchEvents error:", err);
    setAllEvents([]);
  }
  renderCurrentView();
}

export function openAddModalForDate(dateStr) {
  const d = dateStr || formatDateString(new Date());
  editingEventId.value = "";
  modalTitle.textContent = "予定を追加";
  submitEventBtn.textContent = "保存する";

  eventTitle.value = "";
  eventStartDate.value = d;
  eventEndDate.value = d;
  eventIsAllDay.checked = false;
  eventStartTime.disabled = false;
  eventEndTime.disabled = false;
  eventStartTime.value = "";
  eventEndTime.value = "";
  eventDesc.value = "";
  eventColor.value = state.recentColors[0] || "#3b82f6";

  eventModal.classList.remove("hidden");
  renderRecentColors();
  eventTitle.focus();
}

export function openEditModal(event) {
  editingEventId.value = event.id;
  modalTitle.textContent = "予定を編集";
  submitEventBtn.textContent = "更新する";

  eventTitle.value = event.title;
  eventStartDate.value = event.start_date;
  eventEndDate.value = event.end_date;
  eventIsAllDay.checked = !!event.is_all_day;

  eventStartTime.disabled = !!event.is_all_day;
  eventEndTime.disabled = !!event.is_all_day;
  eventStartTime.value = event.start_time || "";
  eventEndTime.value = event.end_time || "";

  eventDesc.value = event.description || "";
  eventColor.value = event.color || "#3b82f6";

  eventModal.classList.remove("hidden");
  renderRecentColors();
  eventTitle.focus();
}

export function promptDeleteEvent(event) {
  setPendingDeleteEvent(event);
  deleteConfirmMessage.textContent = `予定「${event.title}」を削除しますか？`;
  deleteConfirmModal.classList.remove("hidden");
}

export function initEvents() {
  eventIsAllDay.addEventListener("change", () => {
    const isAllDay = eventIsAllDay.checked;
    eventStartTime.disabled = isAllDay;
    eventEndTime.disabled = isAllDay;
    if (isAllDay) {
      eventStartTime.value = "";
      eventEndTime.value = "";
    }
  });

  openAddModalBtn.addEventListener("click", () =>
    openAddModalForDate(formatDateString(state.currentDate))
  );
  closeModalBtn.addEventListener("click", () => {
    eventModal.classList.add("hidden");
    eventForm.reset();
  });
  cancelModalBtn.addEventListener("click", () => {
    eventModal.classList.add("hidden");
    eventForm.reset();
  });

  eventForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = eventTitle.value.trim();
    const isAllDay = eventIsAllDay.checked;
    const sDate = eventStartDate.value;
    const eDate = eventEndDate.value;
    const sTime = !isAllDay && eventStartTime.value ? eventStartTime.value : null;
    const eTime = !isAllDay && eventEndTime.value ? eventEndTime.value : null;
    const desc = eventDesc.value.trim() || null;
    const color = eventColor.value;

    if (!title || !sDate || !eDate) return;
    if (sDate > eDate) {
      alert("終了日は開始日以降の日付を指定してください。");
      return;
    }

    const id = editingEventId.value || "evt_" + Date.now();
    const eventPayload = {
      id,
      title,
      start_date: sDate,
      end_date: eDate,
      is_all_day: isAllDay,
      start_time: sTime,
      end_time: eTime,
      description: desc,
      color,
    };

    addRecentColor(color);

    try {
      if (editingEventId.value) {
        await invoke("update_event", { event: eventPayload });
      } else {
        await invoke("add_event", { event: eventPayload });
      }
    } catch (err) {
      alert(`予定の保存失敗: ${err.message || err}`);
      return;
    }

    eventModal.classList.add("hidden");
    eventForm.reset();
    await fetchEvents();
  });

  cancelDeleteBtn.addEventListener("click", () => {
    setPendingDeleteEvent(null);
    deleteConfirmModal.classList.add("hidden");
  });

  executeDeleteBtn.addEventListener("click", async () => {
    if (state.pendingDeleteEvent) {
      await invoke("delete_event", { id: state.pendingDeleteEvent.id });
      setPendingDeleteEvent(null);
      deleteConfirmModal.classList.add("hidden");
      await fetchEvents();
    }
  });

  searchInput.addEventListener("input", async (e) => {
    const query = e.target.value.trim();
    if (!query) {
      searchResults.classList.add("hidden");
      clearSearchBtn.classList.add("hidden");
      return;
    }
    clearSearchBtn.classList.remove("hidden");

    try {
      const results = await invoke("search_events", { query });
      searchResults.innerHTML = "";
      if (!results || results.length === 0) {
        searchResults.innerHTML = `<div style="padding:10px; font-size:12px; color:#64748b;">一致する予定がありません</div>`;
      } else {
        results.forEach((item) => {
          const div = document.createElement("div");
          div.className = "search-item";
          div.innerHTML = `
            <div class="search-item-title">${escapeHtml(item.title)}</div>
            <div class="search-item-date">${item.start_date} 〜 ${item.end_date}</div>
          `;
          div.addEventListener("click", () => {
            openEditModal(item);
            searchResults.classList.add("hidden");
          });
          searchResults.appendChild(div);
        });
      }
      searchResults.classList.remove("hidden");
    } catch (err) {
      console.error("search error:", err);
    }
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchResults.classList.add("hidden");
    clearSearchBtn.classList.add("hidden");
  });
}