use tauri::State;

use crate::bridge::error::BridgeError;
use crate::bridge::state::BridgeState;

#[tauri::command]
pub async fn set_display_name(
    state: State<'_, BridgeState>,
    name: String,
) -> Result<(), BridgeError> {
    Ok(state.client().await?.set_display_name(name).await?)
}
