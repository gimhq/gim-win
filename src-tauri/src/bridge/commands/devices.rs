use tauri::State;

use crate::bridge::error::BridgeError;
use crate::bridge::state::BridgeState;
use crate::bridge::types::DeviceInfo;

#[tauri::command]
pub async fn devices(state: State<'_, BridgeState>) -> Result<Vec<DeviceInfo>, BridgeError> {
    let devices = state.client().await?.devices().await?;
    Ok(devices.into_iter().map(Into::into).collect())
}

#[tauri::command]
pub async fn user_devices(
    state: State<'_, BridgeState>,
    user_id: String,
) -> Result<Vec<DeviceInfo>, BridgeError> {
    let devices = state.client().await?.user_devices(user_id).await?;
    Ok(devices.into_iter().map(Into::into).collect())
}

#[tauri::command]
pub async fn revoke_device(
    state: State<'_, BridgeState>,
    device_id: String,
) -> Result<(), BridgeError> {
    Ok(state.client().await?.revoke_device(device_id).await?)
}
