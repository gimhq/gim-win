use tauri::State;

use crate::bridge::error::BridgeError;
use crate::bridge::state::BridgeState;

#[tauri::command]
pub async fn send_text(
    state: State<'_, BridgeState>,
    chat_id: String,
    body: String,
    reply_to: Option<String>,
) -> Result<String, BridgeError> {
    Ok(state
        .client()
        .await?
        .send_text(chat_id, body, reply_to)
        .await?)
}

#[tauri::command]
pub async fn send_media(
    state: State<'_, BridgeState>,
    chat_id: String,
    file_path: String,
    mime: String,
    caption: Option<String>,
    reply_to: Option<String>,
) -> Result<String, BridgeError> {
    Ok(state
        .client()
        .await?
        .send_media(chat_id, file_path, mime, caption, reply_to)
        .await?)
}

#[tauri::command]
pub async fn edit_message(
    state: State<'_, BridgeState>,
    chat_id: String,
    message_id: String,
    new_body: String,
) -> Result<(), BridgeError> {
    Ok(state
        .client()
        .await?
        .edit_message(chat_id, message_id, new_body)
        .await?)
}

#[tauri::command]
pub async fn delete_message(
    state: State<'_, BridgeState>,
    chat_id: String,
    message_id: String,
) -> Result<(), BridgeError> {
    Ok(state
        .client()
        .await?
        .delete_message(chat_id, message_id)
        .await?)
}

#[tauri::command]
pub async fn react(
    state: State<'_, BridgeState>,
    chat_id: String,
    message_id: String,
    emoji: String,
) -> Result<(), BridgeError> {
    Ok(state
        .client()
        .await?
        .react(chat_id, message_id, emoji)
        .await?)
}

#[tauri::command]
pub async fn unreact(
    state: State<'_, BridgeState>,
    chat_id: String,
    message_id: String,
    emoji: String,
) -> Result<(), BridgeError> {
    Ok(state
        .client()
        .await?
        .unreact(chat_id, message_id, emoji)
        .await?)
}

#[tauri::command]
pub async fn retry_send(
    state: State<'_, BridgeState>,
    chat_id: String,
    message_id: String,
) -> Result<(), BridgeError> {
    Ok(state.client().await?.retry_send(chat_id, message_id).await?)
}

#[tauri::command]
pub async fn cancel_send(
    state: State<'_, BridgeState>,
    chat_id: String,
    message_id: String,
) -> Result<(), BridgeError> {
    Ok(state.client().await?.cancel_send(chat_id, message_id).await?)
}

#[tauri::command]
pub async fn mark_read(
    state: State<'_, BridgeState>,
    chat_id: String,
    up_to_message_id: String,
) -> Result<(), BridgeError> {
    Ok(state
        .client()
        .await?
        .mark_read(chat_id, up_to_message_id)
        .await?)
}
