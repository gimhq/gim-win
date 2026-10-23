use tauri::State;

use crate::bridge::error::BridgeError;
use crate::bridge::state::BridgeState;
use crate::bridge::types::{NotificationContent, PushRegistration};

#[tauri::command]
pub async fn register_push(
    state: State<'_, BridgeState>,
    registration: PushRegistration,
) -> Result<(), BridgeError> {
    Ok(state
        .client()
        .await?
        .register_push(registration.into())
        .await?)
}

#[tauri::command]
pub async fn unregister_push(state: State<'_, BridgeState>) -> Result<(), BridgeError> {
    Ok(state.client().await?.unregister_push().await?)
}

#[tauri::command]
pub async fn process_push(
    state: State<'_, BridgeState>,
    payload: String,
) -> Result<NotificationContent, BridgeError> {
    Ok(state.client().await?.process_push(payload).await?.into())
}
