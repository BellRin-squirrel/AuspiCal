import { state, setCurrentDate } from "../state.js";
import { formatDateString, escapeHtml, isEventOnDate, isAllDayOrSpanning } from "../utils/tauri.js";
import { getJapaneseHolidays } from "../utils/holidays.js";
import { openEditModal, promptDeleteEvent, openAddModalForDate } from "../services/events.js";
import { switchView } from "../main.js";

const weekHeaderRow = document.getElementById("weekHeaderRow");
const weekAllDayRow = document.getElementById("weekAllDayRow");
const weekTimelineContainer = document.getElementById("weekTimelineContainer");

export function createTimeAxis() {
  const axis = document.createElement("div");
  axis.className = "time-axis";
  for (let h = 0; h < 24; h++) {
    const slot = document.createElement("div");
    slot.className = "time-slot-label";
    slot.textContent = `${String(h).padStart(2, "0")}:00`;
    axis.appendChild(slot);
  }
  return axis;
}

export function createHourSlots() {
  const frag = document.createDocumentFragment();
  for (let h = 0; h < 24; h++) {
    const slot = document.createElement("div");
    slot.className = "hour-slot";
    frag.appendChild(slot);
  }
  return frag;
}

export function createTimelineEventCard(event) {
  const card = document.createElement("div");
  card.className = "timeline-event-card";
  card.style.backgroundColor = event.color || "#3b82f6";

  let startHour = 9;
  let startMin = 0;
  let durationMinutes = 60;

  if (event.start_time) {
    const [h, m] = event.start_time.split(":").map(Number);
    startHour = h;
    startMin = m;
  }

  if (event.start_time && event.end_time) {
    const [eh, em] = event.end_time.split(":").map(Number);
    const totalMinutes = eh * 60 + em - (startHour * 60 + startMin);
    if (totalMinutes > 15) durationMinutes = totalMinutes;
  }

  const topPx = (startHour * 60 + startMin) * (50 / 60);
  const heightPx = Math.max(durationMinutes * (50 / 60), 24);

  card.style.top = `${topPx}px`;
  card.style.height = `${heightPx}px`;

  card.innerHTML = `
    <div>
      <span style="font-weight:700;">${escapeHtml(event.title)}</span>
      <span style="opacity:0.85; font-size:10px; margin-left:4px;">${event.start_time || ""}</span>
    </div>
    <span class="del-btn" style="cursor:pointer; font-size:14px;">&times;</span>
  `;

  card.querySelector(".del-btn").addEventListener("click", (ev) => {
    ev.stopPropagation();
    promptDeleteEvent(event);
  });

  card.addEventListener("click", (ev) => {
    ev.stopPropagation();
    openEditModal(event);
  });

  return card;
}

export function renderWeekView() {
  weekHeaderRow.innerHTML = "";
  weekAllDayRow.innerHTML = "";
  weekTimelineContainer.innerHTML = "";

  const year = state.currentDate.getFullYear();
  const holidays = getJapaneseHolidays(year);

  const startOfWeek = new Date(state.currentDate);
  startOfWeek.setDate(state.currentDate.getDate() - state.currentDate.getDay());
  const todayStr = formatDateString(new Date());

  const dummy = document.createElement("div");
  dummy.className = "week-header-time-dummy";
  weekHeaderRow.appendChild(dummy);

  const allDayLabel = document.createElement("div");
  allDayLabel.className = "allday-label-col";
  allDayLabel.textContent = "終日";
  weekAllDayRow.appendChild(allDayLabel);

  weekTimelineContainer.appendChild(createTimeAxis());

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(startOfWeek);
    dayDate.setDate(startOfWeek.getDate() + i);
    const dateStr = formatDateString(dayDate);
    const holidayName = holidays[dateStr];

    let colClass = "col-weekday";
    if (i === 0) colClass = "col-sun";
    if (i === 6) colClass = "col-sat";

    const headerCol = document.createElement("div");
    headerCol.className = `week-header-col ${colClass}`;
    if (holidayName) headerCol.classList.add("is-holiday");
    headerCol.innerHTML = `
      <div>${["日", "月", "火", "水", "木", "金", "土"][i]}</div>
      <div style="font-size:14px; font-weight:700; ${dateStr === todayStr ? "color:#2563eb;" : ""}">${dayDate.getDate()}日</div>
      ${holidayName ? `<div style="font-size:10px; color:#e11d48;">${holidayName}</div>` : ""}
    `;
    headerCol.style.cursor = "pointer";
    headerCol.addEventListener("click", () => {
      setCurrentDate(new Date(dayDate));
      switchView("day");
    });
    weekHeaderRow.appendChild(headerCol);

    const adCell = document.createElement("div");
    adCell.className = `allday-cell ${colClass}`;
    if (holidayName) adCell.classList.add("is-holiday");

    const dayAllDayEvents = state.allEvents.filter(
      (e) => isEventOnDate(e, dateStr) && isAllDayOrSpanning(e)
    );
    dayAllDayEvents.forEach((e) => {
      const chip = document.createElement("div");
      chip.style.backgroundColor = e.color || "#3b82f6";
      chip.className = "event-chip spanning";

      const isStart = dateStr === e.start_date || i === 0;
      const isEnd = dateStr === e.end_date || i === 6;
      if (isStart && isEnd) chip.classList.add("span-start", "span-end");
      else if (isStart) chip.classList.add("span-start");
      else if (isEnd) chip.classList.add("span-end");
      else chip.classList.add("span-middle");

      if (isStart) {
        chip.innerHTML = `
          <span style="font-weight:600;" title="${escapeHtml(e.title)}">${escapeHtml(e.title)}</span>
          <span class="del-btn" title="削除">&times;</span>
        `;
        chip.querySelector(".del-btn").addEventListener("click", (ev) => {
          ev.stopPropagation();
          promptDeleteEvent(e);
        });
      } else {
        chip.innerHTML = `<span></span>`;
      }

      chip.addEventListener("click", (ev) => {
        ev.stopPropagation();
        openEditModal(e);
      });

      adCell.appendChild(chip);
    });
    weekAllDayRow.appendChild(adCell);

    const col = document.createElement("div");
    col.className = `timeline-column ${colClass}`;
    if (holidayName) col.classList.add("is-holiday");
    col.appendChild(createHourSlots());

    const timedEvents = state.allEvents.filter(
      (e) => isEventOnDate(e, dateStr) && !isAllDayOrSpanning(e)
    );
    timedEvents.forEach((e) => {
      const card = createTimelineEventCard(e);
      col.appendChild(card);
    });

    col.addEventListener("click", (ev) => {
      if (ev.target === col || ev.target.classList.contains("hour-slot")) {
        openAddModalForDate(dateStr);
      }
    });

    weekTimelineContainer.appendChild(col);
  }
}