use tauri::State;

use crate::bridge::error::BridgeError;
use crate::bridge::state::BridgeState;
use crate::bridge::types::RecoveryRotation;

/// Returns the recovery code.
#[tauri::command]
pub async fn create_identity(
    state: State<'_, BridgeState>,
    display_name: String,
) -> Result<String, BridgeError> {
    Ok(state.client().await?.create_identity(display_name).await?)
}

#[tauri::command]
pub async fn restore_from_recovery(
    state: State<'_, BridgeState>,
    user_id: String,
    recovery_code: String,
    revoke_others: bool,
) -> Result<(), BridgeError> {
    Ok(state
        .client()
        .await?
        .restore_from_recovery(user_id, recovery_code, revoke_others)
        .await?)
}

#[tauri::command]
pub async fn rotate_recovery_code(
    state: State<'_, BridgeState>,
) -> Result<RecoveryRotation, BridgeError> {
    Ok(state.client().await?.rotate_recovery_code().await?.into())
}

/// The recovery code kept on this device; `None` on a device that does not
/// hold it (linked by QR code, or created before codes were kept). The
/// frontend shows it only after `authenticate_device`.
#[tauri::command]
pub async fn recovery_code(state: State<'_, BridgeState>) -> Result<Option<String>, BridgeError> {
    Ok(state.client().await?.recovery_code()?)
}
