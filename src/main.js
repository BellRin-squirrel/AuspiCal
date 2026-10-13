// Tauri Invoke
const invoke = window.__TAURI__ ? window.__TAURI__.core.invoke : async (cmd, args) => {
  if (cmd === "get_events") return JSON.parse(localStorage.getItem("mock_events") || "[]");
  if (cmd === "add_event") {
    const events = JSON.parse(localStorage.getItem("mock_events") || "[]");
    events.push(args.event);
    localStorage.setItem("mock_events", JSON.stringify(events));
    return args.event;
  }
  if (cmd === "delete_event") {
    let events = JSON.parse(localStorage.getItem("mock_events") || "[]");
    events = events.filter(e => e.id !== args.id);
    localStorage.setItem("mock_events", JSON.stringify(events));
    return true;
  }
  if (cmd === "search_events") {
    const events = JSON.parse(localStorage.getItem("mock_events") || "[]");
    return events.filter(e => e.title.includes(args.query));
  }
  return [];
};

// ==========================================
// 祝日判定ロジック (1970年〜)
// ==========================================
function getJapaneseHolidays(year) {
  if (year < 1970) return {};
  const holidays = {};

  const setHoliday = (m, d, name) => {
    const key = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    holidays[key] = name;
  };

  setHoliday(1, 1, "元日");
  if (year >= 2000) setHoliday(1, getNthDayOfWeek(year, 1, 1, 2), "成人の日");
  else setHoliday(1, 15, "成人の日");

  setHoliday(2, 11, "建国記念の日");

  if (year >= 2020) setHoliday(2, 23, "天皇誕生日");
  else if (year >= 1989 && year <= 2018) setHoliday(12, 23, "天皇誕生日");
  else if (year <= 1988) setHoliday(4, 29, "天皇誕生日");

  let vernalDay = 21;
  if (year >= 1980 && year <= 2099) {
    vernalDay = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }
  setHoliday(3, vernalDay, "春分の日");

  if (year >= 2007) {
    setHoliday(4, 29, "昭和の日");
    setHoliday(5, 4, "みどりの日");
  } else if (year >= 1989) {
    setHoliday(4, 29, "みどりの日");
  }

  setHoliday(5, 3, "憲法記念日");
  setHoliday(5, 5, "こどもの日");

  if (year === 2020) setHoliday(7, 23, "海の日");
  else if (year === 2021) setHoliday(7, 22, "海の日");
  else if (year >= 2003) setHoliday(7, getNthDayOfWeek(year, 7, 1, 3), "海の日");
  else if (year >= 1996) setHoliday(7, 20, "海の日");

  if (year === 2020) setHoliday(8, 10, "山の日");
  else if (year === 2021) setHoliday(8, 8, "山の日");
  else if (year >= 2016) setHoliday(8, 11, "山の日");

  let respectDay = 15;
  if (year >= 2003) {
    respectDay = getNthDayOfWeek(year, 9, 1, 3);
    setHoliday(9, respectDay, "敬老の日");
  } else {
    setHoliday(9, 15, "敬老の日");
  }

  let autumnalDay = 23;
  if (year >= 1980 && year <= 2099) {
    autumnalDay = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }
  setHoliday(9, autumnalDay, "秋分の日");

  if (year === 2020) setHoliday(7, 24, "スポーツの日");
  else if (year === 2021) setHoliday(7, 23, "スポーツの日");
  else if (year >= 2020) setHoliday(10, getNthDayOfWeek(year, 10, 1, 2), "スポーツの日");
  else if (year >= 2000) setHoliday(10, getNthDayOfWeek(year, 10, 1, 2), "体育の日");
  else setHoliday(10, 10, "体育の日");

  setHoliday(11, 3, "文化の日");
  setHoliday(11, 23, "勤労感謝の日");

  if (year >= 2003 && autumnalDay - respectDay === 2) {
    setHoliday(9, respectDay + 1, "国民の休日");
  }
  if (year >= 1986 && year <= 2006) {
    if (new Date(year, 4, 4).getDay() !== 0) setHoliday(5, 4, "国民の休日");
  }

  if (year >= 1973) {
    const sorted = Object.keys(holidays).sort();
    sorted.forEach(dStr => {
      const [y, m, d] = dStr.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      if (dt.getDay() === 0) {
        let sub = new Date(y, m - 1, d + 1);
        if (year >= 2007) {
          while (holidays[formatDateString(sub)]) {
            sub.setDate(sub.getDate() + 1);
          }
        }
        holidays[formatDateString(sub)] = "振替休日";
      }
    });
  }

  return holidays;
}

function getNthDayOfWeek(year, month, targetDayOfWeek, nth) {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const d = new Date(year, month - 1, day);
    if (d.getMonth() !== month - 1) break;
    if (d.getDay() === targetDayOfWeek) {
      count++;
      if (count === nth) return day;
    }
  }
  return 1;
}

// ==========================================
// State
// ==========================================
let currentDate = new Date();
let currentView = "month";
let allEvents = [];
let pendingDeleteEvent = null;
let recentColors = JSON.parse(localStorage.getItem("auspical_recent_colors") || '["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6"]');

// DOM Elements
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
const monthDaysGrid = document.getElementById("monthDaysGrid");
const yearGrid = document.getElementById("yearGrid");

const weekHeaderRow = document.getElementById("weekHeaderRow");
const weekAllDayRow = document.getElementById("weekAllDayRow");
const weekTimelineContainer = document.getElementById("weekTimelineContainer");

const dayTimelineTitle = document.getElementById("dayTimelineTitle");
const dayAllDayRow = document.getElementById("dayAllDayRow");
const dayTimelineContainer = document.getElementById("dayTimelineContainer");
const dayListTitle = document.getElementById("dayListTitle");
const dayListContainer = document.getElementById("dayListContainer");

// Modal
const eventModal = document.getElementById("eventModal");
const openAddModalBtn = document.getElementById("openAddModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const eventForm = document.getElementById("eventForm");
const eventTitle = document.getElementById("eventTitle");
const eventIsAllDay = document.getElementById("eventIsAllDay");
const eventStartDate = document.getElementById("eventStartDate");
const eventEndDate = document.getElementById("eventEndDate");
const eventStartTime = document.getElementById("eventStartTime");
const eventEndTime = document.getElementById("eventEndTime");
const eventColor = document.getElementById("eventColor");
const recentColorsList = document.getElementById("recentColorsList");

// Delete Modal
const deleteConfirmModal = document.getElementById("deleteConfirmModal");
const deleteConfirmMessage = document.getElementById("deleteConfirmMessage");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const executeDeleteBtn = document.getElementById("executeDeleteBtn");

// Search
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const searchResults = document.getElementById("searchResults");

// ==========================================
// 初期化 & 年セレクト (1970年〜今年+100年)
// ==========================================
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

function renderRecentColors() {
  recentColorsList.innerHTML = "";
  recentColors.slice(0, 5).forEach(color => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = color;
    swatch.addEventListener("click", () => {
      eventColor.value = color;
    });
    recentColorsList.appendChild(swatch);
  });
}

function addRecentColor(color) {
  recentColors = [color, ...recentColors.filter(c => c.toLowerCase() !== color.toLowerCase())].slice(0, 5);
  localStorage.setItem("auspical_recent_colors", JSON.stringify(recentColors));
  renderRecentColors();
}

async function fetchEvents() {
  allEvents = await invoke("get_events");
  render();
}

// 削除確認
function promptDeleteEvent(event) {
  pendingDeleteEvent = event;
  deleteConfirmMessage.textContent = `予定「${event.title}」を削除しますか？`;
  deleteConfirmModal.classList.remove("hidden");
}

cancelDeleteBtn.addEventListener("click", () => {
  pendingDeleteEvent = null;
  deleteConfirmModal.classList.add("hidden");
});

executeDeleteBtn.addEventListener("click", async () => {
  if (pendingDeleteEvent) {
    await invoke("delete_event", { id: pendingDeleteEvent.id });
    pendingDeleteEvent = null;
    deleteConfirmModal.classList.add("hidden");
    await fetchEvents();
  }
});

// 終日チェックボックスの連動（時刻入力の有効/無効）
eventIsAllDay.addEventListener("change", () => {
  const isAllDay = eventIsAllDay.checked;
  eventStartTime.disabled = isAllDay;
  eventEndTime.disabled = isAllDay;
  if (isAllDay) {
    eventStartTime.value = "";
    eventEndTime.value = "";
  }
});

// ==========================================
// レンダリング管理
// ==========================================
function render() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  yearSelect.value = year;
  monthSelect.value = month;

  if (currentView === "year") {
    monthSelect.style.display = "none";
    currentRangeLabel.textContent = `${year}年`;
  } else {
    monthSelect.style.display = "inline-block";
    currentRangeLabel.textContent = "";
  }

  if (currentView === "year") renderYearView();
  else if (currentView === "month") renderMonthView();
  else if (currentView === "week") renderWeekView();
  else if (currentView === "day") renderDayView();
}

function isEventOnDate(event, dateStr) {
  return dateStr >= event.start_date && dateStr <= event.end_date;
}

// イベントが終日扱い（または複数日）かどうか
function isAllDayOrSpanning(event) {
  return event.is_all_day || (event.start_date !== event.end_date) || (!event.start_time);
}

// タイムラインの24時間軸
function createTimeAxis() {
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

// 1時間ごとの点線スロット
function createHourSlots() {
  const frag = document.createDocumentFragment();
  for (let h = 0; h < 24; h++) {
    const slot = document.createElement("div");
    slot.className = "hour-slot";
    frag.appendChild(slot);
  }
  return frag;
}

// ==========================================
// 1. 月ビュー (複数日リボンバー対応)
// ==========================================
function renderMonthView() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
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

  // 日付に重なる予定を抽出
  const dayEvents = allEvents.filter(e => isEventOnDate(e, dateStr));

  dayEvents.forEach(e => {
    const isMultiDay = e.start_date !== e.end_date;
    const chip = document.createElement("div");
    chip.style.backgroundColor = e.color || "#3b82f6";

    if (isMultiDay) {
      // 複数日イベント: 連続した帯（リボンバー）として描画
      chip.className = "event-chip spanning";

      const isStart = (dateStr === e.start_date) || (dayOfWeek === 0); // 開始日、または週の頭
      const isEnd = (dateStr === e.end_date) || (dayOfWeek === 6);     // 終了日、または週の末尾

      if (isStart && isEnd) {
        chip.classList.add("span-start", "span-end");
      } else if (isStart) {
        chip.classList.add("span-start");
      } else if (isEnd) {
        chip.classList.add("span-end");
      } else {
        chip.classList.add("span-middle");
      }

      // 開始日または週頭の日だけタイトルと削除ボタンを表示して見やすくする
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
      // 単日イベント
      chip.className = "event-chip";
      const timeDisplay = (!e.is_all_day && e.start_time) ? e.start_time + " " : "";
      chip.innerHTML = `
        <span title="${escapeHtml(e.title)}">${timeDisplay}${escapeHtml(e.title)}</span>
        <span class="del-btn" title="削除">&times;</span>
      `;
      chip.querySelector(".del-btn").addEventListener("click", (ev) => {
        ev.stopPropagation();
        promptDeleteEvent(e);
      });
    }

    evBox.appendChild(chip);
  });

  cell.appendChild(evBox);
  cell.addEventListener("click", () => openModalForDate(dateStr));
  return cell;
}

// ==========================================
// 2. 年ビュー
// ==========================================
function renderYearView() {
  const year = currentDate.getFullYear();
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

      if (allEvents.some(e => isEventOnDate(e, dStr))) {
        dayEl.classList.add("has-event");
      }
      daysGridMini.appendChild(dayEl);
    }

    box.appendChild(daysGridMini);
    box.addEventListener("click", () => {
      currentDate.setMonth(m);
      switchView("month");
    });

    yearGrid.appendChild(box);
  }
}

// ==========================================
// 3. 週ビュー (終日エリア + 24時間タイムライン)
// ==========================================
function renderWeekView() {
  weekHeaderRow.innerHTML = "";
  weekAllDayRow.innerHTML = "";
  weekTimelineContainer.innerHTML = "";

  const year = currentDate.getFullYear();
  const holidays = getJapaneseHolidays(year);

  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
  const todayStr = formatDateString(new Date());

  // ダミーの時刻ヘッダー
  const dummy = document.createElement("div");
  dummy.className = "week-header-time-dummy";
  weekHeaderRow.appendChild(dummy);

  // 終日ラベル
  const allDayLabel = document.createElement("div");
  allDayLabel.className = "allday-label-col";
  allDayLabel.textContent = "終日";
  weekAllDayRow.appendChild(allDayLabel);

  // タイムライン用時刻軸
  weekTimelineContainer.appendChild(createTimeAxis());

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(startOfWeek);
    dayDate.setDate(startOfWeek.getDate() + i);
    const dateStr = formatDateString(dayDate);
    const holidayName = holidays[dateStr];

    let colClass = "col-weekday";
    if (i === 0) colClass = "col-sun";
    if (i === 6) colClass = "col-sat";

    // 1. ヘッダーセル
    const headerCol = document.createElement("div");
    headerCol.className = `week-header-col ${colClass}`;
    if (holidayName) headerCol.classList.add("is-holiday");
    headerCol.innerHTML = `
      <div>${["日", "月", "火", "水", "木", "金", "土"][i]}</div>
      <div style="font-size:14px; font-weight:700; ${dateStr === todayStr ? "color:#2563eb;" : ""}">${dayDate.getDate()}日</div>
      ${holidayName ? `<div style="font-size:10px; color:#e11d48;">${holidayName}</div>` : ""}
    `;
    weekHeaderRow.appendChild(headerCol);

    // 2. 終日セル (複数日・終日予定を配置)
    const adCell = document.createElement("div");
    adCell.className = `allday-cell ${colClass}`;
    if (holidayName) adCell.classList.add("is-holiday");

    const dayAllDayEvents = allEvents.filter(e => isEventOnDate(e, dateStr) && isAllDayOrSpanning(e));
    dayAllDayEvents.forEach(e => {
      const chip = document.createElement("div");
      chip.style.backgroundColor = e.color || "#3b82f6";
      chip.className = "event-chip spanning";

      const isStart = (dateStr === e.start_date) || (i === 0);
      const isEnd = (dateStr === e.end_date) || (i === 6);
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
      adCell.appendChild(chip);
    });
    weekAllDayRow.appendChild(adCell);

    // 3. タイムラインセル (時間指定があるイベントのみ配置)
    const col = document.createElement("div");
    col.className = `timeline-column ${colClass}`;
    if (holidayName) col.classList.add("is-holiday");
    col.appendChild(createHourSlots());

    const timedEvents = allEvents.filter(e => isEventOnDate(e, dateStr) && !isAllDayOrSpanning(e));
    timedEvents.forEach(e => {
      const card = createTimelineEventCard(e);
      col.appendChild(card);
    });

    col.addEventListener("click", (ev) => {
      if (ev.target === col || ev.target.classList.contains("hour-slot")) {
        openModalForDate(dateStr);
      }
    });

    weekTimelineContainer.appendChild(col);
  }
}

// タイムライン上のイベントカード（時間指定がある場合のみ）
function createTimelineEventCard(event) {
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
    const totalMinutes = (eh * 60 + em) - (startHour * 60 + startMin);
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

  return card;
}

// ==========================================
// 4. 日ビュー (左: 終日枠+タイムライン / 右: 一覧)
// ==========================================
function renderDayView() {
  const dateStr = formatDateString(currentDate);
  const holidays = getJapaneseHolidays(currentDate.getFullYear());
  const holidayName = holidays[dateStr];
  const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][currentDate.getDay()];

  dayTimelineTitle.innerHTML = `タイムライン (${currentDate.getMonth() + 1}月${currentDate.getDate()}日 ${dayOfWeek}曜日 ${holidayName ? "🎌 " + holidayName : ""})`;
  dayListTitle.textContent = `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月${currentDate.getDate()}日の予定一覧`;

  // 1. 終日エリア
  dayAllDayRow.innerHTML = "";
  const allDayLabel = document.createElement("div");
  allDayLabel.className = "allday-label-col";
  allDayLabel.textContent = "終日";
  dayAllDayRow.appendChild(allDayLabel);

  const adCell = document.createElement("div");
  adCell.className = "allday-cell";
  const dayAllDayEvents = allEvents.filter(e => isEventOnDate(e, dateStr) && isAllDayOrSpanning(e));

  dayAllDayEvents.forEach(e => {
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
    adCell.appendChild(chip);
  });
  dayAllDayRow.appendChild(adCell);

  // 2. タイムラインエリア
  dayTimelineContainer.innerHTML = "";
  dayTimelineContainer.appendChild(createTimeAxis());

  const col = document.createElement("div");
  let colClass = "col-weekday";
  if (currentDate.getDay() === 0) colClass = "col-sun";
  if (currentDate.getDay() === 6) colClass = "col-sat";

  col.className = `timeline-column ${colClass}`;
  if (holidayName) col.classList.add("is-holiday");
  col.appendChild(createHourSlots());

  const timedEvents = allEvents.filter(e => isEventOnDate(e, dateStr) && !isAllDayOrSpanning(e));
  timedEvents.forEach(e => {
    const card = createTimelineEventCard(e);
    col.appendChild(card);
  });

  col.addEventListener("click", (ev) => {
    if (ev.target === col || ev.target.classList.contains("hour-slot")) {
      openModalForDate(dateStr);
    }
  });
  dayTimelineContainer.appendChild(col);

  // 3. 右ペイン: 予定一覧
  const dayEvents = allEvents.filter(e => isEventOnDate(e, dateStr));
  dayListContainer.innerHTML = "";
  if (dayEvents.length === 0) {
    dayListContainer.innerHTML = `<p style="color:#64748b; font-size:13px;">登録されている予定はありません。</p>`;
  } else {
    dayEvents.forEach(e => {
      const card = document.createElement("div");
      card.className = "day-event-card";
      card.style.borderLeftColor = e.color || "#3b82f6";

      const timeText = e.is_all_day ? "終日" : (e.start_time ? `${e.start_time} 〜 ${e.end_time || ""}` : "終日");

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

      card.querySelector("button").addEventListener("click", () => {
        promptDeleteEvent(e);
      });

      dayListContainer.appendChild(card);
    });
  }
}

// ==========================================
// ビュー切り替え & ショートカット
// ==========================================
function switchView(viewName) {
  currentView = viewName;
  document.querySelectorAll(".btn-view").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
  yearView.classList.toggle("active", viewName === "year");
  monthView.classList.toggle("active", viewName === "month");
  weekView.classList.toggle("active", viewName === "week");
  dayView.classList.toggle("active", viewName === "day");
  render();
}

document.querySelectorAll(".btn-view").forEach(btn => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

window.addEventListener("keydown", (e) => {
  const activeTag = document.activeElement ? document.activeElement.tagName.toUpperCase() : "";
  if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") return;
  if (!eventModal.classList.contains("hidden") || !deleteConfirmModal.classList.contains("hidden")) return;

  const key = e.key.toLowerCase();
  if (key === "y") switchView("year");
  else if (key === "m") switchView("month");
  else if (key === "w") switchView("week");
  else if (key === "d") switchView("day");
});

// ==========================================
// ナビゲーション
// ==========================================
prevBtn.addEventListener("click", () => {
  if (currentView === "year") currentDate.setFullYear(currentDate.getFullYear() - 1);
  else if (currentView === "month") currentDate.setMonth(currentDate.getMonth() - 1);
  else if (currentView === "week") currentDate.setDate(currentDate.getDate() - 7);
  else if (currentView === "day") currentDate.setDate(currentDate.getDate() - 1);

  if (currentDate.getFullYear() < 1970) currentDate = new Date(1970, 0, 1);
  render();
});

nextBtn.addEventListener("click", () => {
  if (currentView === "year") currentDate.setFullYear(currentDate.getFullYear() + 1);
  else if (currentView === "month") currentDate.setMonth(currentDate.getMonth() + 1);
  else if (currentView === "week") currentDate.setDate(currentDate.getDate() + 7);
  else if (currentView === "day") currentDate.setDate(currentDate.getDate() + 1);
  render();
});

todayBtn.addEventListener("click", () => {
  currentDate = new Date();
  render();
});

yearSelect.addEventListener("change", (e) => {
  currentDate.setFullYear(parseInt(e.target.value));
  render();
});
monthSelect.addEventListener("change", (e) => {
  currentDate.setMonth(parseInt(e.target.value));
  render();
});

// ==========================================
// モーダルと予定登録
// ==========================================
function openModalForDate(dateStr) {
  const d = dateStr || formatDateString(new Date());
  eventStartDate.value = d;
  eventEndDate.value = d;
  eventIsAllDay.checked = false;
  eventStartTime.disabled = false;
  eventEndTime.disabled = false;
  eventModal.classList.remove("hidden");
  renderRecentColors();
}

openAddModalBtn.addEventListener("click", () => openModalForDate(formatDateString(currentDate)));
closeModalBtn.addEventListener("click", () => eventModal.classList.add("hidden"));
cancelModalBtn.addEventListener("click", () => eventModal.classList.add("hidden"));

eventForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = eventTitle.value.trim();
  const isAllDay = eventIsAllDay.checked;
  const sDate = eventStartDate.value;
  const eDate = eventEndDate.value;
  const sTime = (!isAllDay && eventStartTime.value) ? eventStartTime.value : null;
  const eTime = (!isAllDay && eventEndTime.value) ? eventEndTime.value : null;
  const desc = document.getElementById("eventDesc").value.trim() || null;
  const color = eventColor.value;

  if (!title || !sDate || !eDate) return;
  if (sDate > eDate) {
    alert("終了日は開始日以降の日付を指定してください。");
    return;
  }

  const newEvent = {
    id: "evt_" + Date.now(),
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
  await invoke("add_event", { event: newEvent });
  eventModal.classList.add("hidden");
  eventForm.reset();
  await fetchEvents();
});

// ==========================================
// 検索
// ==========================================
searchInput.addEventListener("input", async (e) => {
  const query = e.target.value.trim();
  if (!query) {
    searchResults.classList.add("hidden");
    clearSearchBtn.classList.add("hidden");
    return;
  }
  clearSearchBtn.classList.remove("hidden");

  const results = await invoke("search_events", { query });
  searchResults.innerHTML = "";

  if (results.length === 0) {
    searchResults.innerHTML = `<div style="padding:10px; font-size:12px; color:#64748b;">一致する予定がありません</div>`;
  } else {
    results.forEach(item => {
      const div = document.createElement("div");
      div.className = "search-item";
      div.innerHTML = `
        <div class="search-item-title">${escapeHtml(item.title)}</div>
        <div class="search-item-date">${item.start_date} 〜 ${item.end_date}</div>
      `;
      div.addEventListener("click", () => {
        const [y, m, d] = item.start_date.split("-").map(Number);
        currentDate = new Date(y, m - 1, d);
        switchView("day");
        searchResults.classList.add("hidden");
      });
      searchResults.appendChild(div);
    });
  }
  searchResults.classList.remove("hidden");
});

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  searchResults.classList.add("hidden");
  clearSearchBtn.classList.add("hidden");
});

// ==========================================
// ユーティリティ
// ==========================================
function formatDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;"
  }[tag] || tag));
}

// 起動
initYearOptions();
renderRecentColors();
fetchEvents();