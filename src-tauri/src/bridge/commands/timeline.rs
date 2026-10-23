//! Operations on the per-chat `gim_ffi::Timeline` kept in the bundle
//! (`BridgeState::timeline`): created on first use, reused afterwards,
//! dropped with the bundle.

use tauri::State;

use crate::bridge::error::BridgeError;
use crate::bridge::state::BridgeState;
use crate::bridge::types::ChatState;

/// Loads up to `count` older items (delivered as timeline diffs); returns
/// whether more history exists.
#[tauri::command]
pub async fn paginate_backwards(
    state: State<'_, BridgeState>,
    chat_id: String,
    count: u16,
) -> Result<bool, BridgeError> {
    let timeline = state.timeline(&chat_id).await?;
    Ok(timeline.paginate_backwards(count).await?)
}

/// The timeline's chat state; `None` while the chat is not known locally.
#[tauri::command]
pub async fn timeline_chat_state(
    state: State<'_, BridgeState>,
    chat_id: String,
) -> Result<Option<ChatState>, BridgeError> {
    let timeline = state.timeline(&chat_id).await?;
    Ok(timeline.chat_state().map(Into::into))
}
