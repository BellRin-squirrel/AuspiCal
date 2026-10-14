import { state, setCurrentDate } from "../state.js";
import { isEventOnDate } from "../utils/tauri.js";
import { switchView } from "../main.js";

const yearGrid = document.getElementById("yearGrid");

export function renderYearView() {
  const year = state.currentDate.getFullYear();
  yearGrid.innerHTML = "";

  for (let m = 0; m < 12; m++) {
    const box = document.createElement("div");
    box.className = "mini-month";

    const title = document.createElement("div");
    title.className = "mini-month-title";
    title.textContent = `${m + 1}月`;
    box.appendChild(title);

    const weekdays = document.createElement("div");
    weekdays.className = "mini-weekdays";
    weekdays.innerHTML = `
      <span style="color:#e11d48">日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span style="color:#2563eb">土</span>
    `;
    box.appendChild(weekdays);

    const daysGridMini = document.createElement("div");
    daysGridMini.className = "mini-days";

    const startDay = new Date(year, m, 1).getDay();
    const daysInMonth = new Date(year, m + 1, 0).getDate();

    for (let i = 0; i < startDay; i++) {
      daysGridMini.appendChild(document.createElement("div"));
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayEl = document.createElement("div");
      dayEl.className = "mini-day";
      dayEl.textContent = d;

      if (state.allEvents.some((e) => isEventOnDate(e, dStr))) {
        dayEl.classList.add("has-event");
      }
      daysGridMini.appendChild(dayEl);
    }

    box.appendChild(daysGridMini);
    box.addEventListener("click", () => {
      const newD = new Date(state.currentDate);
      newD.setMonth(m);
      setCurrentDate(newD);
      switchView("month");
    });

    yearGrid.appendChild(box);
  }
}