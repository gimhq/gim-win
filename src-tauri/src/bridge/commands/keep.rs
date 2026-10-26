//! The keep server setting (README, "Bridge conventions"): stored in
//! `config.json`, applied when the client is next created, so the UI offers
//! a restart.

use tauri::State;

use crate::bridge::config::{Config, BUILT_IN_KEEP_SERVER_URL};
use crate::bridge::error::BridgeError;
use crate::bridge::state::BridgeState;
use crate::bridge::types::KeepServerInfo;

/// The effective keep server and whether a restart is needed to use it.
#[tauri::command]
pub async fn keep_server(state: State<'_, BridgeState>) -> Result<KeepServerInfo, BridgeError> {
    state.wait_ready().await;
    Ok(keep_server_info(&state))
}

/// Validates and stores a custom keep server.
#[tauri::command]
pub async fn set_keep_server_url(
    state: State<'_, BridgeState>,
    url: String,
) -> Result<KeepServerInfo, BridgeError> {
    update(&state, |config| config.set_keep_server_url(&url)).await
}

/// Removes the stored keep server: the built-in one applies.
#[tauri::command]
pub async fn reset_keep_server(
    state: State<'_, BridgeState>,
) -> Result<KeepServerInfo, BridgeError> {
    update(&state, Config::reset_keep_server).await
}

/// Stores "off": no keep server.
#[tauri::command]
pub async fn disable_keep_server(
    state: State<'_, BridgeState>,
) -> Result<KeepServerInfo, BridgeError> {
    update(&state, Config::disable_keep_server).await
}

/// Restarts the process, so the client is created with the stored settings.
#[tauri::command]
pub fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

async fn update(
    state: &BridgeState,
    edit: impl FnOnce(&mut Config) -> Result<(), gim_ffi::GimError>,
) -> Result<KeepServerInfo, BridgeError> {
    state.wait_ready().await;
    edit(&mut state.config.lock().unwrap_or_else(|e| e.into_inner()))?;
    Ok(keep_server_info(state))
}

fn keep_server_info(state: &BridgeState) -> KeepServerInfo {
    let config = state.config.lock().unwrap_or_else(|e| e.into_inner());
    let (url, source) = config.keep_server();
    let in_use = state
        .keep_server_in_use
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    KeepServerInfo {
        url: url.map(str::to_string),
        source,
        default_url: BUILT_IN_KEEP_SERVER_URL.to_string(),
        restart_required: url != in_use.as_deref(),
    }
}
