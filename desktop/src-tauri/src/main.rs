// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth_config;

use auth_config::{API_BASE_URL, HTTP_X_ACCESS_KEY, WEB_AUTH_PAGE_URL};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub start_date: String,
    pub end_date: String,
    #[serde(default)]
    pub is_all_day: bool,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub description: Option<String>,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthUser {
    pub username: String,
    pub device: String,
    pub sid: String,
}

pub struct AppState {
    pub events: Mutex<Vec<CalendarEvent>>,
    pub auth_user: Mutex<Option<AuthUser>>,
}

fn get_storage_path() -> PathBuf {
    let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push(".auspical_events.json");
    path
}

fn get_auth_storage_path() -> PathBuf {
    let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push(".auspical_auth.json");
    path
}

fn load_events_from_disk() -> Vec<CalendarEvent> {
    let path = get_storage_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(events) = serde_json::from_str::<Vec<CalendarEvent>>(&content) {
                return events;
            }
        }
    }
    Vec::new()
}

fn save_events_to_disk(events: &[CalendarEvent]) {
    let path = get_storage_path();
    if let Ok(content) = serde_json::to_string_pretty(events) {
        let _ = fs::write(path, content);
    }
}

fn load_auth_from_disk() -> Option<AuthUser> {
    let path = get_auth_storage_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(user) = serde_json::from_str::<AuthUser>(&content) {
                return Some(user);
            }
        }
    }
    None
}

fn save_auth_to_disk(user: &Option<AuthUser>) {
    let path = get_auth_storage_path();
    if let Some(u) = user {
        if let Ok(content) = serde_json::to_string_pretty(u) {
            let _ = fs::write(path, content);
        }
    } else if path.exists() {
        let _ = fs::remove_file(path);
    }
}

fn url_encode(input: &str) -> String {
    let mut encoded = String::new();
    for byte in input.bytes() {
        match byte {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            _ => {
                encoded.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    encoded
}

// ==========================================
// カレンダーコマンド
// ==========================================
#[tauri::command]
fn get_events(state: State<AppState>) -> Vec<CalendarEvent> {
    state.events.lock().unwrap().clone()
}

#[tauri::command]
fn add_event(event: CalendarEvent, state: State<AppState>) -> Result<CalendarEvent, String> {
    let mut lock = state.events.lock().unwrap();
    lock.push(event.clone());
    save_events_to_disk(&lock);
    Ok(event)
}

#[tauri::command]
fn update_event(event: CalendarEvent, state: State<AppState>) -> Result<CalendarEvent, String> {
    let mut lock = state.events.lock().unwrap();
    if let Some(existing) = lock.iter_mut().find(|e| e.id == event.id) {
        *existing = event.clone();
        save_events_to_disk(&lock);
        Ok(event)
    } else {
        Err("Event not found".into())
    }
}

#[tauri::command]
fn delete_event(id: String, state: State<AppState>) -> Result<bool, String> {
    let mut lock = state.events.lock().unwrap();
    let initial_len = lock.len();
    lock.retain(|e| e.id != id);
    let deleted = lock.len() < initial_len;
    if deleted {
        save_events_to_disk(&lock);
    }
    Ok(deleted)
}

#[tauri::command]
fn search_events(query: String, state: State<AppState>) -> Vec<CalendarEvent> {
    let q = query.to_lowercase();
    let lock = state.events.lock().unwrap();
    lock.iter()
        .filter(|e| {
            e.title.to_lowercase().contains(&q)
                || e.description
                    .as_deref()
                    .unwrap_or("")
                    .to_lowercase()
                    .contains(&q)
        })
        .cloned()
        .collect()
}

// ==========================================
// 認証コマンド
// ==========================================
fn generate_secure_auth_code() -> String {
    const CHARS: &[u8] = b"2345678ABCDEFGHJKLMNPRSTUVWXYZ"; // 30文字
    let mut rng = rand::rngs::OsRng;
    (0..8)
        .map(|_| {
            let idx = rng.gen_range(0..CHARS.len());
            CHARS[idx] as char
        })
        .collect()
}

fn get_device_info() -> (String, String) {
    let os = match std::env::consts::OS {
        "macos" => "macOS",
        "windows" => "Windows",
        "linux" => "Linux",
        other => other,
    };
    let model = match std::env::consts::ARCH {
        "aarch64" => format!("{} (Apple Silicon/ARM)", os),
        "x86_64" => format!("{} (x86_64 PC)", os),
        _ => os.to_string(),
    };
    (model, os.to_string())
}

#[derive(Serialize)]
pub struct RegisterAuthResponse {
    pub code: String,
    pub sid: String,
    pub web_url: String,
}

#[tauri::command]
async fn register_auth_code(
    username: String,
    device: String,
) -> Result<RegisterAuthResponse, String> {
    let code = generate_secure_auth_code();
    let (model, os) = get_device_info();

    let web_url = format!(
        "{}?code={}&username={}",
        WEB_AUTH_PAGE_URL,
        url_encode(&code),
        url_encode(&username)
    );

    // サーバーURLが初期値のままの場合は開発モックとして即座にコードを発行
    if API_BASE_URL.contains("your-server-domain.com") || API_BASE_URL.contains("example.com") {
        return Ok(RegisterAuthResponse {
            code: code.clone(),
            sid: format!("local_sid_{}", code),
            web_url,
        });
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let payload = serde_json::json!({
        "operation": "registerAuthenticationCode",
        "code": code,
        "username": username,
        "device": device,
        "model": model,
        "OS": os
    });

    let res = client
        .post(API_BASE_URL)
        .header("Content-Type", "application/json")
        .header("X-Access-Key", HTTP_X_ACCESS_KEY)
        .header("HTTP_X_ACCESS_KEY", HTTP_X_ACCESS_KEY)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("サーバー接続失敗: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("サーバーエラー: HTTPステータス {}", res.status()));
    }

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("レスポンスJSON解析失敗: {}", e))?;

    let sid = json
        .get("sid")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "サーバー応答に 'sid' キーが見つかりません".to_string())?
        .to_string();

    Ok(RegisterAuthResponse {
        code,
        sid,
        web_url,
    })
}

#[tauri::command]
async fn check_auth_status(
    sid: String,
    username: String,
    device: String,
) -> Result<String, String> {
    if API_BASE_URL.contains("your-server-domain.com") || API_BASE_URL.contains("example.com") {
        return Ok("unauthenticated".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let payload = serde_json::json!({
        "operation": "checkAlreadyLogin",
        "SID": sid,
        "name": username,
        "device": device
    });

    let res = client
        .post(API_BASE_URL)
        .header("Content-Type", "application/json")
        .header("X-Access-Key", HTTP_X_ACCESS_KEY)
        .header("HTTP_X_ACCESS_KEY", HTTP_X_ACCESS_KEY)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("ポーリング接続失敗: {}", e))?;

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("ポーリング解析失敗: {}", e))?;

    let status = json
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("unauthenticated")
        .to_string();

    Ok(status)
}

#[tauri::command]
fn open_in_browser(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("ブラウザ起動失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
fn get_current_user(state: State<AppState>) -> Option<AuthUser> {
    state.auth_user.lock().unwrap().clone()
}

#[tauri::command]
fn save_login_user(user: AuthUser, state: State<AppState>) -> Result<(), String> {
    let mut lock = state.auth_user.lock().unwrap();
    *lock = Some(user);
    save_auth_to_disk(&lock);
    Ok(())
}

#[tauri::command]
fn logout(state: State<AppState>) -> Result<(), String> {
    let mut lock = state.auth_user.lock().unwrap();
    *lock = None;
    save_auth_to_disk(&lock);
    Ok(())
}

fn create_japanese_menu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> tauri::Result<tauri::menu::Menu<R>> {
    let app_menu = SubmenuBuilder::new(app, "AuspiCal")
        .item(&PredefinedMenuItem::about(
            app,
            Some("AuspiCalについて"),
            None,
        )?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some("AuspiCalを隠す"))?)
        .item(&PredefinedMenuItem::hide_others(app, Some("ほかを隠す"))?)
        .item(&PredefinedMenuItem::show_all(app, Some("すべてを表示"))?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("AuspiCalを終了"))?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "編集")
        .item(&PredefinedMenuItem::undo(app, Some("取り消す"))?)
        .item(&PredefinedMenuItem::redo(app, Some("やり直す"))?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some("カット"))?)
        .item(&PredefinedMenuItem::copy(app, Some("コピー"))?)
        .item(&PredefinedMenuItem::paste(app, Some("ペースト"))?)
        .item(&PredefinedMenuItem::select_all(app, Some("すべてを選択"))?)
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "ウィンドウ")
        .item(&PredefinedMenuItem::minimize(app, Some("最小化"))?)
        .separator()
        .item(&PredefinedMenuItem::close_window(
            app,
            Some("ウィンドウを閉じる"),
        )?)
        .build()?;

    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&edit_menu)
        .item(&window_menu)
        .build()
}

fn main() {
    let initial_events = load_events_from_disk();
    let initial_auth = load_auth_from_disk();

    tauri::Builder::default()
        .setup(|app| {
            let menu = create_japanese_menu(app.handle())?;
            app.set_menu(menu)?;
            Ok(())
        })
        .manage(AppState {
            events: Mutex::new(initial_events),
            auth_user: Mutex::new(initial_auth),
        })
        .invoke_handler(tauri::generate_handler![
            get_events,
            add_event,
            update_event,
            delete_event,
            search_events,
            register_auth_code,
            check_auth_status,
            open_in_browser,
            get_current_user,
            save_login_user,
            logout
        ])
        .run(tauri::generate_context!())
        .expect("error while running AuspiCal");
}