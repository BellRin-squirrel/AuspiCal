// アプリケーション全体の状態管理
export const state = {
  currentDate: new Date(),
  currentView: "month", // "year" | "month" | "week" | "day"
  allEvents: [],
  currentUser: null,
  pendingDeleteEvent: null,
  recentColors: JSON.parse(
    localStorage.getItem("auspical_recent_colors") ||
      '["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6"]'
  ),
};

export function setCurrentDate(date) {
  state.currentDate = date;
}

export function setCurrentView(viewName) {
  state.currentView = viewName;
}

export function setAllEvents(events) {
  state.allEvents = Array.isArray(events) ? events : [];
}

export function setCurrentUser(user) {
  state.currentUser = user;
}

export function setPendingDeleteEvent(event) {
  state.pendingDeleteEvent = event;
}

export function addRecentColor(color) {
  state.recentColors = [
    color,
    ...state.recentColors.filter((c) => c.toLowerCase() !== color.toLowerCase()),
  ].slice(0, 5);
  localStorage.setItem(
    "auspical_recent_colors",
    JSON.stringify(state.recentColors)
  );
}