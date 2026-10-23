use tauri::State;

use crate::bridge::error::BridgeError;
use crate::bridge::state::BridgeState;

#[tauri::command]
pub async fn set_typing(
    state: State<'_, BridgeState>,
    chat_id: String,
    active: bool,
) -> Result<(), BridgeError> {
    Ok(state.client().await?.set_typing(chat_id, active).await?)
}

#[tauri::command]
pub async fn stop_typing(
    state: State<'_, BridgeState>,
    chat_id: String,
) -> Result<(), BridgeError> {
    Ok(state.client().await?.stop_typing(chat_id).await?)
}
