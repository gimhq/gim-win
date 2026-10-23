//! Device linking. `LinkSession` and `PendingApproval` stay in the bundle
//! under bridge-issued ids; the frontend passes the ids back.

use std::sync::Arc;

use gim_ffi::{LinkSession, PendingApproval};
use tauri::State;

use crate::bridge::error::BridgeError;
use crate::bridge::recreate_client;
use crate::bridge::state::BridgeState;
use crate::bridge::types::{LinkApproval, LinkStart};

/// New device: starts a link and returns the QR string to show.
#[tauri::command]
pub async fn start_link(
    state: State<'_, BridgeState>,
    hubs: Vec<String>,
) -> Result<LinkStart, BridgeError> {
    let mut guard = state.client.write().await;
    let bundle = guard.as_mut().ok_or_else(|| state.not_created())?;
    // Synchronous: no SDK await under the lock.
    let link = bundle.client.start_link(hubs)?;
    let link_id = BridgeState::next_handle_id();
    let qr_string = link.qr_string();
    bundle.links.insert(link_id.clone(), link);
    Ok(LinkStart { link_id, qr_string })
}

async fn link(state: &BridgeState, link_id: &str) -> Result<Arc<LinkSession>, BridgeError> {
    let guard = state.client.read().await;
    let bundle = guard.as_ref().ok_or_else(|| state.not_created())?;
    bundle
        .links
        .get(link_id)
        .cloned()
        .ok_or_else(|| BridgeError::invalid_input("unknown link id"))
}

/// New device: waits for the approval and returns the SAS.
#[tauri::command]
pub async fn wait_link(
    state: State<'_, BridgeState>,
    link_id: String,
) -> Result<String, BridgeError> {
    let link = link(&state, &link_id).await?;
    let client = state.client().await?;
    Ok(client.wait_link(link).await?)
}

/// New device: the user compared the SAS. `false` wipes the device; the
/// bridge then recreates the client like after `sign_out`.
#[tauri::command]
pub async fn confirm_link(
    state: State<'_, BridgeState>,
    accepted: bool,
) -> Result<(), BridgeError> {
    let client = state.client().await?;
    let result = client.confirm_link(accepted).await;
    drop(client);
    if !accepted {
        let recreated = recreate_client(&state).await;
        result?;
        return recreated;
    }
    Ok(result?)
}

/// Old device: approves a scanned link offer.
#[tauri::command]
pub async fn approve_link(
    state: State<'_, BridgeState>,
    qr_string: String,
) -> Result<LinkApproval, BridgeError> {
    let client = state.client().await?;
    let approval: Arc<PendingApproval> = client.approve_link(qr_string).await?;
    let (sas, device_id) = (approval.sas(), approval.device_id());
    let approval_id = BridgeState::next_handle_id();
    let mut guard = state.client.write().await;
    let bundle = guard.as_mut().ok_or_else(|| state.not_created())?;
    bundle.approvals.insert(approval_id.clone(), approval);
    Ok(LinkApproval {
        approval_id,
        sas,
        device_id,
    })
}

/// Old device: the user compared the SAS. The approval is used up either way.
#[tauri::command]
pub async fn confirm_approval(
    state: State<'_, BridgeState>,
    approval_id: String,
    accepted: bool,
) -> Result<(), BridgeError> {
    let approval = {
        let mut guard = state.client.write().await;
        let bundle = guard.as_mut().ok_or_else(|| state.not_created())?;
        bundle
            .approvals
            .remove(&approval_id)
            .ok_or_else(|| BridgeError::invalid_input("unknown approval id"))?
    };
    let client = state.client().await?;
    Ok(client.confirm_approval(approval, accepted).await?)
}
