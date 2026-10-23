//! The event streams: each subscribe command creates an emitter
//! (`bridge::events`), hands it to gim-ffi and keeps the returned
//! `TaskHandle` in the bundle under the returned subscription id.

use std::sync::Arc;

use tauri::{AppHandle, State};

use crate::bridge::error::BridgeError;
use crate::bridge::events::{
    ChatListEmitter, ConnectionStateEmitter, HubListEmitter, TimelineEmitter, TypingEmitter,
};
use crate::bridge::state::BridgeState;

/// Chat list diffs; the first event is a `Reset`.
#[tauri::command]
pub async fn subscribe_chat_list(
    app: AppHandle,
    state: State<'_, BridgeState>,
) -> Result<String, BridgeError> {
    let client = state.client().await?;
    let subscription_id = BridgeState::next_handle_id();
    let handle = client
        .chat_list(Arc::new(ChatListEmitter {
            app,
            subscription_id: subscription_id.clone(),
        }))
        .await?;
    state.add_subscription(subscription_id, handle).await
}

/// Timeline diffs of one chat; the first event is a `Reset`.
#[tauri::command]
pub async fn subscribe_timeline(
    app: AppHandle,
    state: State<'_, BridgeState>,
    chat_id: String,
) -> Result<String, BridgeError> {
    let timeline = state.timeline(&chat_id).await?;
    let subscription_id = BridgeState::next_handle_id();
    let handle = timeline
        .add_listener(Arc::new(TimelineEmitter {
            app,
            subscription_id: subscription_id.clone(),
            chat_id,
        }))
        .await;
    state.add_subscription(subscription_id, handle).await
}

/// Connection state; the first event is the current state.
#[tauri::command]
pub async fn subscribe_connection_state(
    app: AppHandle,
    state: State<'_, BridgeState>,
) -> Result<String, BridgeError> {
    let client = state.client().await?;
    let subscription_id = BridgeState::next_handle_id();
    let handle = client
        .connection_state(Arc::new(ConnectionStateEmitter {
            app,
            subscription_id: subscription_id.clone(),
        }))
        .await?;
    state.add_subscription(subscription_id, handle).await
}

/// Typing user ids of one chat; the first event is the current set.
#[tauri::command]
pub async fn subscribe_typing(
    app: AppHandle,
    state: State<'_, BridgeState>,
    chat_id: String,
) -> Result<String, BridgeError> {
    let client = state.client().await?;
    let subscription_id = BridgeState::next_handle_id();
    let handle = client
        .typing(
            chat_id.clone(),
            Arc::new(TypingEmitter {
                app,
                subscription_id: subscription_id.clone(),
                chat_id,
            }),
        )
        .await?;
    state.add_subscription(subscription_id, handle).await
}

/// The user's hubs; the first event is the current list.
#[tauri::command]
pub async fn subscribe_hub_list(
    app: AppHandle,
    state: State<'_, BridgeState>,
) -> Result<String, BridgeError> {
    let client = state.client().await?;
    let subscription_id = BridgeState::next_handle_id();
    let handle = client
        .hub_list(Arc::new(HubListEmitter {
            app,
            subscription_id: subscription_id.clone(),
        }))
        .await?;
    state.add_subscription(subscription_id, handle).await
}

/// Ends a stream; an unknown id is not an error.
#[tauri::command]
pub async fn unsubscribe(
    state: State<'_, BridgeState>,
    subscription_id: String,
) -> Result<(), BridgeError> {
    state.remove_subscription(&subscription_id).await;
    Ok(())
}
