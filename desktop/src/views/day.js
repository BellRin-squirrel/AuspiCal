import { state } from "../state.js";
import { formatDateString, escapeHtml, isEventOnDate, isAllDayOrSpanning } from "../utils/tauri.js";
import { getJapaneseHolidays } from "../utils/holidays.js";
import { openEditModal, promptDeleteEvent, openAddModalForDate } from "../services/events.js";
import { createTimeAxis, createHourSlots, createTimelineEventCard } from "./week.js";

const dayTimelineTitle = document.getElementById("dayTimelineTitle");
const dayAllDayRow = document.getElementById("dayAllDayRow");
const dayTimelineContainer = document.getElementById("dayTimelineContainer");
const dayListTitle = document.getElementById("dayListTitle");
const dayListContainer = document.getElementById("dayListContainer");

export function renderDayView() {
  const dateStr = formatDateString(state.currentDate);
  const holidays = getJapaneseHolidays(state.currentDate.getFullYear());
  const holidayName = holidays[dateStr];
  const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][state.currentDate.getDay()];

  dayTimelineTitle.innerHTML = `タイムライン (${state.currentDate.getMonth() + 1}月${state.currentDate.getDate()}日 ${dayOfWeek}曜日 ${holidayName ? "🎌 " + holidayName : ""})`;
  dayListTitle.textContent = `${state.currentDate.getFullYear()}年${state.currentDate.getMonth() + 1}月${state.currentDate.getDate()}日の予定一覧`;

  dayAllDayRow.innerHTML = "";
  const allDayLabel = document.createElement("div");
  allDayLabel.className = "allday-label-col";
  allDayLabel.textContent = "終日";
  dayAllDayRow.appendChild(allDayLabel);

  const adCell = document.createElement("div");
  adCell.className = "allday-cell";
  const dayAllDayEvents = state.allEvents.filter(
    (e) => isEventOnDate(e, dateStr) && isAllDayOrSpanning(e)
  );

  dayAllDayEvents.forEach((e) => {
    const chip = document.createElement("div");
    chip.style.backgroundColor = e.color || "#3b82f6";
    chip.className = "event-chip";
    chip.innerHTML = `
      <span style="font-weight:600;">${escapeHtml(e.title)} ${e.start_date !== e.end_date ? `(${e.start_date}〜${e.end_date})` : ""}</span>
      <span class="del-btn" title="削除">&times;</span>
    `;
    chip.querySelector(".del-btn").addEventListener("click", (ev) => {
      ev.stopPropagation();
      promptDeleteEvent(e);
    });
    chip.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openEditModal(e);
    });
    adCell.appendChild(chip);
  });
  dayAllDayRow.appendChild(adCell);

  dayTimelineContainer.innerHTML = "";
  dayTimelineContainer.appendChild(createTimeAxis());

  const col = document.createElement("div");
  let colClass = "col-weekday";
  if (state.currentDate.getDay() === 0) colClass = "col-sun";
  if (state.currentDate.getDay() === 6) colClass = "col-sat";

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
  dayTimelineContainer.appendChild(col);

  const dayEvents = state.allEvents.filter((e) => isEventOnDate(e, dateStr));
  dayListContainer.innerHTML = "";
  if (dayEvents.length === 0) {
    dayListContainer.innerHTML = `<p style="color:#64748b; font-size:13px;">登録されている予定はありません。</p>`;
  } else {
    dayEvents.forEach((e) => {
      const card = document.createElement("div");
      card.className = "day-event-card";
      card.style.borderLeftColor = e.color || "#3b82f6";

      const timeText = e.is_all_day
        ? "終日"
        : e.start_time
        ? `${e.start_time} 〜 ${e.end_time || ""}`
        : "終日";

      card.innerHTML = `
        <div>
          <h4 style="font-size:14px; font-weight:700;">${escapeHtml(e.title)}</h4>
          <p style="font-size:11px; color:#64748b; margin-top:2px;">
            期間: ${e.start_date} 〜 ${e.end_date} (${timeText})
          </p>
          ${e.description ? `<p style="font-size:12px; color:#334155; margin-top:4px;">${escapeHtml(e.description)}</p>` : ""}
        </div>
        <button class="btn btn-secondary" style="color:#ef4444;" title="削除">&times;</button>
      `;

      card.querySelector("button").addEventListener("click", (ev) => {
        ev.stopPropagation();
        promptDeleteEvent(e);
      });

      card.addEventListener("click", () => {
        openEditModal(e);
      });

      dayListContainer.appendChild(card);
    });
  }
}