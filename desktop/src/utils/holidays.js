import { formatDateString } from "./tauri.js";

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

export function getJapaneseHolidays(year) {
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
    vernalDay = Math.floor(
      20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
    );
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
    autumnalDay = Math.floor(
      23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)
    );
  }
  setHoliday(9, autumnalDay, "秋分の日");

  if (year === 2020) setHoliday(7, 24, "スポーツの日");
  else if (year === 2021) setHoliday(7, 23, "スポーツの日");
  else if (year >= 2020)
    setHoliday(10, getNthDayOfWeek(year, 10, 1, 2), "スポーツの日");
  else if (year >= 2000)
    setHoliday(10, getNthDayOfWeek(year, 10, 1, 2), "体育の日");
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
    sorted.forEach((dStr) => {
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