//! Names of the Tauri events the subscription commands emit (W1-3 emits
//! them; see README, "Bridge conventions").

#![allow(dead_code)]

pub const CHAT_LIST_DIFF: &str = "chat-list-diff";
pub const TIMELINE_DIFF: &str = "timeline-diff";
pub const CONNECTION_STATE: &str = "connection-state";
pub const TYPING: &str = "typing";
pub const HUB_LIST: &str = "hub-list";
