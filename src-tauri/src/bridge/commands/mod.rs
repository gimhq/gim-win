//! The Tauri commands, grouped as in API.md. Each is the snake_case
//! `GimClient` method, takes camelCase arguments and returns the serde
//! mirror of the SDK's record (README, "Bridge conventions").

pub mod devices;
pub mod hubs;
pub mod identity;
pub mod lifecycle;
pub mod link;
pub mod profile;
pub mod push;
