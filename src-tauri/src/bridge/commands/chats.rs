use tauri::State;

use crate::bridge::error::BridgeError;
use crate::bridge::state::BridgeState;
use crate::bridge::types::{ChatState, UserProfile};

#[tauri::command]
pub async fn create_direct_chat(
    state: State<'_, BridgeState>,
    user_id: String,
) -> Result<String, BridgeError> {
    Ok(state.client().await?.create_direct_chat(user_id).await?)
}

#[tauri::command]
pub async fn create_group_chat(
    state: State<'_, BridgeState>,
    name: String,
    member_user_ids: Vec<String>,
) -> Result<String, BridgeError> {
    Ok(state
        .client()
        .await?
        .create_group_chat(name, member_user_ids)
        .await?)
}

#[tauri::command]
pub async fn chat_members(
    state: State<'_, BridgeState>,
    chat_id: String,
) -> Result<Vec<UserProfile>, BridgeError> {
    let members = state.client().await?.chat_members(chat_id).await?;
    Ok(members.into_iter().map(Into::into).collect())
}

#[tauri::command]
pub async fn add_members(
    state: State<'_, BridgeState>,
    chat_id: String,
    user_ids: Vec<String>,
) -> Result<(), BridgeError> {
    Ok(state.client().await?.add_members(chat_id, user_ids).await?)
}

#[tauri::command]
pub async fn remove_member(
    state: State<'_, BridgeState>,
    chat_id: String,
    user_id: String,
) -> Result<(), BridgeError> {
    Ok(state.client().await?.remove_member(chat_id, user_id).await?)
}

#[tauri::command]
pub async fn leave_chat(
    state: State<'_, BridgeState>,
    chat_id: String,
) -> Result<(), BridgeError> {
    Ok(state.client().await?.leave_chat(chat_id).await?)
}

#[tauri::command]
pub async fn chat_state(
    state: State<'_, BridgeState>,
    chat_id: String,
) -> Result<ChatState, BridgeError> {
    Ok(state.client().await?.chat_state(chat_id).await?.into())
}

#[tauri::command]
pub async fn set_group_info(
    state: State<'_, BridgeState>,
    chat_id: String,
    name: Option<String>,
    avatar_file_path: Option<String>,
) -> Result<(), BridgeError> {
    Ok(state
        .client()
        .await?
        .set_group_info(chat_id, name, avatar_file_path)
        .await?)
}
