//! The Tauri commands, grouped as in API.md. Each is the snake_case
//! `GimClient` method, takes camelCase arguments and returns the serde
//! mirror of the SDK's record (README, "Bridge conventions").

pub mod chats;
pub mod devices;
pub mod hubs;
pub mod identity;
pub mod keep;
pub mod lifecycle;
pub mod link;
pub mod media;
pub mod profile;
pub mod push;
pub mod send;
pub mod settings;
pub mod subscriptions;
pub mod timeline;
pub mod typing;
