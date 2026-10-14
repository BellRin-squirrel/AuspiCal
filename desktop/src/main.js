import { state, setCurrentDate, setCurrentView } from "./state.js";
import { initAuth, loadAuthUser, closeAuthModal } from "./services/auth.js";
import { initEvents, fetchEvents, renderRecentColors } from "./services/events.js";
import { renderMonthView } from "./views/month.js";
import { renderYearView } from "./views/year.js";
import { renderWeekView } from "./views/week.js";
import { renderDayView } from "./views/day.js";

const yearSelect = document.getElementById("yearSelect");
const monthSelect = document.getElementById("monthSelect");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const todayBtn = document.getElementById("todayBtn");
const currentRangeLabel = document.getElementById("currentRangeLabel");

const yearView = document.getElementById("yearView");
const monthView = document.getElementById("monthView");
const weekView = document.getElementById("weekView");
const dayView = document.getElementById("dayView");

export function renderCurrentView() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();

  yearSelect.value = year;
  monthSelect.value = month;

  if (state.currentView === "year") {
    monthSelect.style.display = "none";
    currentRangeLabel.textContent = `${year}年`;
  } else {
    monthSelect.style.display = "inline-block";
    currentRangeLabel.textContent = "";
  }

  if (state.currentView === "year") renderYearView();
  else if (state.currentView === "month") renderMonthView();
  else if (state.currentView === "week") renderWeekView();
  else if (state.currentView === "day") renderDayView();
}

export function switchView(viewName) {
  setCurrentView(viewName);
  document.querySelectorAll(".btn-view").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
  yearView.classList.toggle("active", viewName === "year");
  monthView.classList.toggle("active", viewName === "month");
  weekView.classList.toggle("active", viewName === "week");
  dayView.classList.toggle("active", viewName === "day");
  renderCurrentView();
}

function initYearOptions() {
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear + 100;

  yearSelect.innerHTML = "";
  for (let y = 1970; y <= maxYear; y++) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = `${y}年`;
    yearSelect.appendChild(opt);
  }

  monthSelect.innerHTML = "";
  for (let m = 0; m < 12; m++) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = `${m + 1}月`;
    monthSelect.appendChild(opt);
  }
}

function initNavigation() {
  prevBtn.addEventListener("click", () => {
    const d = new Date(state.currentDate);
    if (state.currentView === "year") d.setFullYear(d.getFullYear() - 1);
    else if (state.currentView === "month") d.setMonth(d.getMonth() - 1);
    else if (state.currentView === "week") d.setDate(d.getDate() - 7);
    else if (state.currentView === "day") d.setDate(d.getDate() - 1);

    if (d.getFullYear() < 1970) d.setFullYear(1970, 0, 1);
    setCurrentDate(d);
    renderCurrentView();
  });

  nextBtn.addEventListener("click", () => {
    const d = new Date(state.currentDate);
    if (state.currentView === "year") d.setFullYear(d.getFullYear() + 1);
    else if (state.currentView === "month") d.setMonth(d.getMonth() + 1);
    else if (state.currentView === "week") d.setDate(d.getDate() + 7);
    else if (state.currentView === "day") d.setDate(d.getDate() + 1);

    setCurrentDate(d);
    renderCurrentView();
  });

  todayBtn.addEventListener("click", () => {
    setCurrentDate(new Date());
    renderCurrentView();
  });

  yearSelect.addEventListener("change", (e) => {
    const d = new Date(state.currentDate);
    d.setFullYear(parseInt(e.target.value));
    setCurrentDate(d);
    renderCurrentView();
  });

  monthSelect.addEventListener("change", (e) => {
    const d = new Date(state.currentDate);
    d.setMonth(parseInt(e.target.value));
    setCurrentDate(d);
    renderCurrentView();
  });

  document.querySelectorAll(".btn-view").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key === "Esc") {
      closeAuthModal();
      document.getElementById("eventModal").classList.add("hidden");
      document.getElementById("deleteConfirmModal").classList.add("hidden");
      document.getElementById("searchResults").classList.add("hidden");
      document.getElementById("accountDropdown").classList.add("hidden");
      return;
    }

    const activeTag = document.activeElement ? document.activeElement.tagName.toUpperCase() : "";
    if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") return;
    if (
      !document.getElementById("eventModal").classList.contains("hidden") ||
      !document.getElementById("deleteConfirmModal").classList.contains("hidden") ||
      !document.getElementById("authModal").classList.contains("hidden")
    )
      return;

    const key = e.key.toLowerCase();
    if (key === "y") switchView("year");
    else if (key === "m") switchView("month");
    else if (key === "w") switchView("week");
    else if (key === "d") switchView("day");
  });
}

// 起動
initYearOptions();
renderRecentColors();
renderCurrentView();
initNavigation();
initAuth();
initEvents();
loadAuthUser();
fetchEvents();