use tauri::State;

use crate::bridge::error::BridgeError;
use crate::bridge::state::BridgeState;
use crate::bridge::types::UserProfile;

#[tauri::command]
pub async fn set_display_name(
    state: State<'_, BridgeState>,
    name: String,
) -> Result<(), BridgeError> {
    Ok(state.client().await?.set_display_name(name).await?)
}

#[tauri::command]
pub async fn claim_handle(
    state: State<'_, BridgeState>,
    handle: String,
) -> Result<(), BridgeError> {
    Ok(state.client().await?.claim_handle(handle).await?)
}

#[tauri::command]
pub async fn release_handle(state: State<'_, BridgeState>) -> Result<(), BridgeError> {
    Ok(state.client().await?.release_handle().await?)
}

#[tauri::command]
pub async fn find_user(
    state: State<'_, BridgeState>,
    handle: String,
) -> Result<Option<UserProfile>, BridgeError> {
    Ok(state
        .client()
        .await?
        .find_user(handle)
        .await?
        .map(Into::into))
}
