use tauri::State;

use crate::bridge::error::BridgeError;
use crate::bridge::state::BridgeState;
use crate::bridge::types::HubInfo;

#[tauri::command]
pub async fn hubs(state: State<'_, BridgeState>) -> Result<Vec<HubInfo>, BridgeError> {
    let hubs = state.client().await?.hubs().await?;
    Ok(hubs.into_iter().map(Into::into).collect())
}

#[tauri::command]
pub async fn add_hub(state: State<'_, BridgeState>, url: String) -> Result<HubInfo, BridgeError> {
    Ok(state.client().await?.add_hub(url).await?.into())
}

#[tauri::command]
pub async fn remove_hub(
    state: State<'_, BridgeState>,
    hub_id: String,
    confirm_owned_groups: bool,
) -> Result<(), BridgeError> {
    Ok(state
        .client()
        .await?
        .remove_hub(hub_id, confirm_owned_groups)
        .await?)
}

#[tauri::command]
pub async fn set_primary_hub(
    state: State<'_, BridgeState>,
    hub_id: String,
) -> Result<(), BridgeError> {
    Ok(state.client().await?.set_primary_hub(hub_id).await?)
}
