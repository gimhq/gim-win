//! The Tauri events behind the subscription commands: one listener struct
//! per gim-ffi listener trait, emitting one event per callback so batches
//! arrive in callback order (README, "Bridge conventions"). Callbacks run
//! on gim-core's callback thread: they copy the batch, emit and return,
//! never calling the client or touching the bundle.

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::bridge::types::{ChatListDiff, ConnectionState, HubInfo, TimelineDiff};

pub const CHAT_LIST_DIFF: &str = "chat-list-diff";
pub const TIMELINE_DIFF: &str = "timeline-diff";
pub const CONNECTION_STATE: &str = "connection-state";
pub const TYPING: &str = "typing";
pub const HUB_LIST: &str = "hub-list";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatListDiffEvent {
    pub subscription_id: String,
    pub diffs: Vec<ChatListDiff>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineDiffEvent {
    pub subscription_id: String,
    pub chat_id: String,
    pub diffs: Vec<TimelineDiff>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionStateEvent {
    pub subscription_id: String,
    pub state: ConnectionState,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TypingEvent {
    pub subscription_id: String,
    pub chat_id: String,
    pub user_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubListEvent {
    pub subscription_id: String,
    pub hubs: Vec<HubInfo>,
}

/// Emits `payload` as `event` to every window; a failure is logged, never
/// propagated into gim-core.
fn emit<P: Serialize + Clone>(app: &AppHandle, event: &str, payload: P) {
    if let Err(err) = app.emit(event, payload) {
        tracing::warn!("emit {event}: {err}");
    }
}

pub struct ChatListEmitter {
    pub app: AppHandle,
    pub subscription_id: String,
}

impl gim_ffi::ChatListListener for ChatListEmitter {
    fn on_update(&self, diffs: Vec<gim_ffi::ChatListDiff>) {
        emit(
            &self.app,
            CHAT_LIST_DIFF,
            ChatListDiffEvent {
                subscription_id: self.subscription_id.clone(),
                diffs: diffs.into_iter().map(Into::into).collect(),
            },
        );
    }
}

pub struct TimelineEmitter {
    pub app: AppHandle,
    pub subscription_id: String,
    pub chat_id: String,
}

impl gim_ffi::TimelineListener for TimelineEmitter {
    fn on_update(&self, diffs: Vec<gim_ffi::TimelineDiff>) {
        emit(
            &self.app,
            TIMELINE_DIFF,
            TimelineDiffEvent {
                subscription_id: self.subscription_id.clone(),
                chat_id: self.chat_id.clone(),
                diffs: diffs.into_iter().map(Into::into).collect(),
            },
        );
    }
}

pub struct ConnectionStateEmitter {
    pub app: AppHandle,
    pub subscription_id: String,
}

impl gim_ffi::ConnectionStateListener for ConnectionStateEmitter {
    fn on_change(&self, state: gim_ffi::ConnectionState) {
        emit(
            &self.app,
            CONNECTION_STATE,
            ConnectionStateEvent {
                subscription_id: self.subscription_id.clone(),
                state: state.into(),
            },
        );
    }
}

pub struct TypingEmitter {
    pub app: AppHandle,
    pub subscription_id: String,
    pub chat_id: String,
}

impl gim_ffi::TypingListener for TypingEmitter {
    fn on_update(&self, user_ids: Vec<String>) {
        emit(
            &self.app,
            TYPING,
            TypingEvent {
                subscription_id: self.subscription_id.clone(),
                chat_id: self.chat_id.clone(),
                user_ids,
            },
        );
    }
}

pub struct HubListEmitter {
    pub app: AppHandle,
    pub subscription_id: String,
}

impl gim_ffi::HubListListener for HubListEmitter {
    fn on_update(&self, hubs: Vec<gim_ffi::HubInfo>) {
        emit(
            &self.app,
            HUB_LIST,
            HubListEvent {
                subscription_id: self.subscription_id.clone(),
                hubs: hubs.into_iter().map(Into::into).collect(),
            },
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bridge::types::{HubState, TimelineItem};
    use serde_json::{json, to_value};

    #[test]
    fn event_names_match_the_contract() {
        assert_eq!(CHAT_LIST_DIFF, "chat-list-diff");
        assert_eq!(TIMELINE_DIFF, "timeline-diff");
        assert_eq!(CONNECTION_STATE, "connection-state");
        assert_eq!(TYPING, "typing");
        assert_eq!(HUB_LIST, "hub-list");
    }

    #[test]
    fn payloads_use_camel_case_keys() {
        assert_eq!(
            to_value(ChatListDiffEvent {
                subscription_id: "1".into(),
                diffs: vec![ChatListDiff::Clear, ChatListDiff::PopFront],
            })
            .unwrap(),
            json!({"subscriptionId": "1", "diffs": [{"type": "Clear"}, {"type": "PopFront"}]})
        );
        assert_eq!(
            to_value(TimelineDiffEvent {
                subscription_id: "2".into(),
                chat_id: "hb/g1".into(),
                diffs: vec![TimelineDiff::PushBack {
                    value: TimelineItem::DateSeparator { day_start_ms: 9 },
                }],
            })
            .unwrap(),
            json!({
                "subscriptionId": "2",
                "chatId": "hb/g1",
                "diffs": [{"type": "PushBack", "value": {"type": "DateSeparator", "dayStartMs": 9}}]
            })
        );
        assert_eq!(
            to_value(ConnectionStateEvent {
                subscription_id: "3".into(),
                state: ConnectionState::Syncing,
            })
            .unwrap(),
            json!({"subscriptionId": "3", "state": "Syncing"})
        );
        assert_eq!(
            to_value(TypingEvent {
                subscription_id: "4".into(),
                chat_id: "hb/g1".into(),
                user_ids: vec!["u2".into(), "u3".into()],
            })
            .unwrap(),
            json!({"subscriptionId": "4", "chatId": "hb/g1", "userIds": ["u2", "u3"]})
        );
        assert_eq!(
            to_value(HubListEvent {
                subscription_id: "5".into(),
                hubs: vec![HubInfo {
                    hub_id: "hb".into(),
                    url: Some("https://hb.example".into()),
                    state: HubState::Verified,
                    priority: 0,
                    is_primary: true,
                    is_home: true,
                    signed_in: true,
                }],
            })
            .unwrap(),
            json!({
                "subscriptionId": "5",
                "hubs": [{
                    "hubId": "hb",
                    "url": "https://hb.example",
                    "state": "Verified",
                    "priority": 0,
                    "isPrimary": true,
                    "isHome": true,
                    "signedIn": true
                }]
            })
        );
    }
}
