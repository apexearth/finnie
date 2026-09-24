// Finnie's native window. The page is bundled in; what it needs from Rust is `http_get`, because
// the market APIs refuse a webview's cross-origin requests (only the hosts below, only GET), and
// the settings file, so every build and window of Finnie on this machine shares one.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use tauri::Manager;

// Same list as src/data/hosts.ts.
const ALLOWED_HOSTS: &[&str] = &["query1.finance.yahoo.com", "query2.finance.yahoo.com", "api.exchange.coinbase.com"];
// Yahoo answers a bare client with 429s; a browser's agent string gets the normal service.
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .timeout(std::time::Duration::from_secs(20))
            .build()
            .expect("http client")
    })
}

/// GET a market URL; the status comes back with the body so the page decides what an error is.
#[tauri::command]
async fn http_get(url: String) -> Result<(u16, String), String> {
    let parsed = reqwest::Url::parse(&url).map_err(|e| e.to_string())?;
    if parsed.scheme() != "https" || !parsed.host_str().is_some_and(|h| ALLOWED_HOSTS.contains(&h)) {
        return Err(format!("host not allowed: {url}"));
    }
    let res = client()
        .get(parsed)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let body = res.text().await.map_err(|e| e.to_string())?;
    Ok((status, body))
}

// ---- settings file ------------------------------------------------------------------------
// ~/.finnie/settings.json, or $FINNIE_HOME/settings.json. The page owns the format; this only
// reads and writes it, atomically, keeping the file as it was at startup as settings.json.bak.

fn finnie_home(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Some(dir) = std::env::var_os("FINNIE_HOME") {
        return Ok(PathBuf::from(dir));
    }
    Ok(app.path().home_dir().map_err(|e| e.to_string())?.join(".finnie"))
}

#[tauri::command]
fn settings_read(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = finnie_home(&app)?.join("settings.json");
    match fs::read_to_string(&path) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("{}: {e}", path.display())),
    }
}

#[tauri::command]
fn settings_write(app: tauri::AppHandle, text: String) -> Result<(), String> {
    static BACKED_UP: AtomicBool = AtomicBool::new(false);
    let dir = finnie_home(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("settings.json");
    // Once a run, before the first write: a way back if this run's writes turn out wrong.
    if !BACKED_UP.swap(true, Ordering::SeqCst) && path.exists() {
        let _ = fs::copy(&path, dir.join("settings.json.bak"));
    }
    let tmp = dir.join("settings.json.tmp");
    fs::write(&tmp, text).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![http_get, settings_read, settings_write])
        .run(tauri::generate_context!())
        .expect("finnie failed to start");
}
