use tauri::State;

use crate::bridge::error::BridgeError;
use crate::bridge::state::BridgeState;

/// Downloads and decrypts the attachment to `dest_path`; returns the path.
#[tauri::command]
pub async fn fetch_media(
    state: State<'_, BridgeState>,
    chat_id: String,
    message_id: String,
    dest_path: String,
) -> Result<String, BridgeError> {
    Ok(state
        .client()
        .await?
        .fetch_media(chat_id, message_id, dest_path)
        .await?)
}

/// `None` if the media has no thumbnail.
#[tauri::command]
pub async fn fetch_thumbnail(
    state: State<'_, BridgeState>,
    chat_id: String,
    message_id: String,
    dest_path: String,
) -> Result<Option<String>, BridgeError> {
    Ok(state
        .client()
        .await?
        .fetch_thumbnail(chat_id, message_id, dest_path)
        .await?)
}
