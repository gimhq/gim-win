//! Profile photo, privacy and per-chat settings (API.md, "Privacy and chat
//! settings"); thin wrappers, no UI.

use tauri::State;

use crate::bridge::error::BridgeError;
use crate::bridge::state::BridgeState;
use crate::bridge::types::{PrivacySettings, ReportReason, UserProfile};

#[tauri::command]
pub async fn own_profile(
    state: State<'_, BridgeState>,
) -> Result<Option<UserProfile>, BridgeError> {
    Ok(state.client().await?.own_profile().await?.map(Into::into))
}

#[tauri::command]
pub async fn set_avatar(
    state: State<'_, BridgeState>,
    file_path: String,
    mime: String,
) -> Result<(), BridgeError> {
    Ok(state.client().await?.set_avatar(file_path, mime).await?)
}

#[tauri::command]
pub async fn remove_avatar(state: State<'_, BridgeState>) -> Result<(), BridgeError> {
    Ok(state.client().await?.remove_avatar().await?)
}

#[tauri::command]
pub async fn fetch_user_avatar(
    state: State<'_, BridgeState>,
    user_id: String,
    dest_path: String,
) -> Result<String, BridgeError> {
    Ok(state
        .client()
        .await?
        .fetch_user_avatar(user_id, dest_path)
        .await?)
}

#[tauri::command]
pub async fn fetch_chat_avatar(
    state: State<'_, BridgeState>,
    chat_id: String,
    dest_path: String,
) -> Result<String, BridgeError> {
    Ok(state
        .client()
        .await?
        .fetch_chat_avatar(chat_id, dest_path)
        .await?)
}

#[tauri::command]
pub async fn privacy(state: State<'_, BridgeState>) -> Result<PrivacySettings, BridgeError> {
    Ok(state.client().await?.privacy().await?.into())
}

#[tauri::command]
pub async fn set_read_receipts(
    state: State<'_, BridgeState>,
    enabled: bool,
) -> Result<(), BridgeError> {
    Ok(state.client().await?.set_read_receipts(enabled).await?)
}

#[tauri::command]
pub async fn set_typing_indicators(
    state: State<'_, BridgeState>,
    enabled: bool,
) -> Result<(), BridgeError> {
    Ok(state.client().await?.set_typing_indicators(enabled).await?)
}

#[tauri::command]
pub async fn block_user(state: State<'_, BridgeState>, user_id: String) -> Result<(), BridgeError> {
    Ok(state.client().await?.block_user(user_id).await?)
}

#[tauri::command]
pub async fn unblock_user(
    state: State<'_, BridgeState>,
    user_id: String,
) -> Result<(), BridgeError> {
    Ok(state.client().await?.unblock_user(user_id).await?)
}

/// Reports a user to the keep server's moderators; returns the report id.
#[tauri::command]
pub async fn report_user(
    state: State<'_, BridgeState>,
    user_id: String,
    reason: ReportReason,
    note: Option<String>,
    message_ids: Vec<String>,
) -> Result<String, BridgeError> {
    Ok(state
        .client()
        .await?
        .report_user(user_id, reason.into(), note, message_ids)
        .await?)
}

/// `muted_until_ms` in Unix milliseconds; `muted_forever()` for good, 0 to
/// unmute.
#[tauri::command]
pub async fn set_chat_muted(
    state: State<'_, BridgeState>,
    chat_id: String,
    muted_until_ms: u64,
) -> Result<(), BridgeError> {
    Ok(state
        .client()
        .await?
        .set_chat_muted(chat_id, muted_until_ms)
        .await?)
}

#[tauri::command]
pub async fn set_chat_pinned(
    state: State<'_, BridgeState>,
    chat_id: String,
    pinned: bool,
) -> Result<(), BridgeError> {
    Ok(state
        .client()
        .await?
        .set_chat_pinned(chat_id, pinned)
        .await?)
}

#[tauri::command]
pub async fn set_chat_archived(
    state: State<'_, BridgeState>,
    chat_id: String,
    archived: bool,
) -> Result<(), BridgeError> {
    Ok(state
        .client()
        .await?
        .set_chat_archived(chat_id, archived)
        .await?)
}

/// The `mutedUntilMs` of a chat muted until it is unmuted. It is `u64::MAX`,
/// above JavaScript's safe integer range; the payload keeps the u64 as-is.
#[tauri::command]
pub fn muted_forever() -> u64 {
    gim_ffi::muted_forever()
}
