import { state, setCurrentDate } from "../state.js";
import { formatDateString, escapeHtml, isEventOnDate } from "../utils/tauri.js";
import { getJapaneseHolidays } from "../utils/holidays.js";
import { openEditModal, promptDeleteEvent } from "../services/events.js";
import { switchView } from "../main.js";

const monthDaysGrid = document.getElementById("monthDaysGrid");

export function renderMonthView() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const holidays = getJapaneseHolidays(year);

  monthDaysGrid.innerHTML = "";

  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = firstDay.getDay();
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const todayStr = formatDateString(new Date());

  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const cellDate = new Date(year, month - 1, d);
    monthDaysGrid.appendChild(createMonthCell(cellDate, true, todayStr, holidays));
  }

  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const cellDate = new Date(year, month, d);
    monthDaysGrid.appendChild(createMonthCell(cellDate, false, todayStr, holidays));
  }

  const remaining = 42 - (startDayOfWeek + daysInCurrentMonth);
  for (let d = 1; d <= remaining; d++) {
    const cellDate = new Date(year, month + 1, d);
    monthDaysGrid.appendChild(createMonthCell(cellDate, true, todayStr, holidays));
  }
}

function createMonthCell(date, isOtherMonth, todayStr, holidays) {
  const dateStr = formatDateString(date);
  const dayOfWeek = date.getDay();
  const holidayName = holidays[dateStr];

  const cell = document.createElement("div");
  let colClass = "col-weekday";
  if (dayOfWeek === 0) colClass = "col-sun";
  if (dayOfWeek === 6) colClass = "col-sat";

  cell.className = `day-cell ${colClass} ${isOtherMonth ? "other-month" : ""} ${dateStr === todayStr ? "today" : ""}`;
  if (holidayName) cell.classList.add("is-holiday");

  const header = document.createElement("div");
  header.className = "day-header";

  const num = document.createElement("span");
  num.className = "day-num";
  num.textContent = date.getDate();
  header.appendChild(num);

  if (holidayName) {
    const hLabel = document.createElement("span");
    hLabel.className = "holiday-label";
    hLabel.title = holidayName;
    hLabel.textContent = holidayName;
    header.appendChild(hLabel);
  }

  cell.appendChild(header);

  const evBox = document.createElement("div");
  evBox.className = "events-container";

  const dayEvents = state.allEvents.filter((e) => isEventOnDate(e, dateStr));

  dayEvents.forEach((e) => {
    const isMultiDay = e.start_date !== e.end_date;
    const chip = document.createElement("div");
    chip.style.backgroundColor = e.color || "#3b82f6";

    if (isMultiDay) {
      chip.className = "event-chip spanning";
      const isStart = dateStr === e.start_date || dayOfWeek === 0;
      const isEnd = dateStr === e.end_date || dayOfWeek === 6;

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
    } else {
      chip.className = "event-chip";
      const timeDisplay = !e.is_all_day && e.start_time ? e.start_time + " " : "";
      chip.innerHTML = `
        <span title="${escapeHtml(e.title)}">${timeDisplay}${escapeHtml(e.title)}</span>
        <span class="del-btn" title="削除">&times;</span>
      `;
      chip.querySelector(".del-btn").addEventListener("click", (ev) => {
        ev.stopPropagation();
        promptDeleteEvent(e);
      });
    }

    chip.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openEditModal(e);
    });

    evBox.appendChild(chip);
  });

  cell.appendChild(evBox);

  cell.addEventListener("click", () => {
    const [y, m, d] = dateStr.split("-").map(Number);
    setCurrentDate(new Date(y, m - 1, d));
    switchView("day");
  });

  return cell;
}