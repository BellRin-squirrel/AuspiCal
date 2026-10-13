// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub start_date: String, // "YYYY-MM-DD"
    pub end_date: String,   // "YYYY-MM-DD"
    #[serde(default)]
    pub is_all_day: bool,   // 終日フラグ
    pub start_time: Option<String>, // "HH:MM"
    pub end_time: Option<String>,   // "HH:MM"
    pub description: Option<String>,
    pub color: String,
}

pub struct AppState {
    pub events: Mutex<Vec<CalendarEvent>>,
}

fn get_storage_path() -> PathBuf {
    let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push(".auspical_events.json");
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

#[tauri::command]
fn get_events(state: State<AppState>) -> Vec<CalendarEvent> {
    let lock = state.events.lock().unwrap();
    lock.clone()
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

fn main() {
    let initial_events = load_events_from_disk();

    tauri::Builder::default()
        .manage(AppState {
            events: Mutex::new(initial_events),
        })
        .invoke_handler(tauri::generate_handler![
            get_events,
            add_event,
            update_event,
            delete_event,
            search_events
        ])
        .run(tauri::generate_context!())
        .expect("error while running AuspiCal");
}