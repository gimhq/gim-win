//! The desktop integration of gim-win: the app settings file, the taskbar
//! badge, native notifications, the tray icon with close-to-tray, autostart,
//! window state and the single-instance guard. Everything here is native
//! Tauri; nothing touches gim-core or the bridge state.
//!
//! # Design notes
//!
//! - Settings live at `<appDataDir>/gim/settings.json`, next to the bridge's
//!   files, and are held in [`SystemState`] once loaded by [`setup`]. The
//!   file is written atomically (`settings.json.tmp` then rename); a missing
//!   or unparsable file yields the defaults, and unknown or missing fields
//!   are tolerated so the shape can grow without migrations.
//! - The tray is built in code ([`tray::build_tray`]) when `trayEnabled` is
//!   set, and rebuilt or removed when `settings_save` flips it. Its menu
//!   labels come from [`tray::TrayLabels`], which the frontend updates
//!   through `set_tray_labels` after i18n init and on every language change.
//! - Close-to-tray: with `trayEnabled`, [`window::on_window_event`] turns a
//!   close request into a hide; the tray's left click, its "Show" item, a
//!   second app instance and a notification click bring the window back
//!   through [`window::show_main`]. With the tray disabled, closing
//!   the window exits the app.
//! - Notifications go through tauri-plugin-notification. A click on the
//!   toast is reported to the `on_action` handler registered in [`setup`]
//!   as the `tap` action carrying the `chatId` extra; it focuses the window
//!   and emits `notification-clicked` with `{chatId}`.
//! - The badge is a 16x16 RGBA overlay drawn in pure Rust
//!   ([`badge::render_badge`]) and set on Windows only; elsewhere
//!   `set_badge_count` is a no-op.
//! - Errors cross to the frontend as [`SystemError`], the same
//!   `{kind, message}` shape as the bridge's errors so `isGimError` applies.

pub mod autostart;
pub mod badge;
pub mod notify;
pub mod secure_view;
pub mod settings;
pub mod tray;
pub mod window;

use std::sync::{Mutex, MutexGuard};

use serde::Serialize;
use tauri::Manager;
use tauri_plugin_notification::NotificationExt;

use self::settings::AppSettings;
use self::tray::TrayLabels;

/// The error every system command rejects with.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SystemError {
    pub kind: SystemErrorKind,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum SystemErrorKind {
    Internal,
    Storage,
    InvalidInput,
}

impl SystemError {
    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            kind: SystemErrorKind::Internal,
            message: message.into(),
        }
    }

    pub fn storage(message: impl Into<String>) -> Self {
        Self {
            kind: SystemErrorKind::Storage,
            message: message.into(),
        }
    }

    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self {
            kind: SystemErrorKind::InvalidInput,
            message: message.into(),
        }
    }
}

impl std::fmt::Display for SystemError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.kind, self.message)
    }
}

impl From<tauri::Error> for SystemError {
    fn from(err: tauri::Error) -> Self {
        Self::internal(err.to_string())
    }
}

/// The in-memory settings and tray labels, in Tauri managed state.
#[derive(Debug, Default)]
pub struct SystemState {
    settings: Mutex<AppSettings>,
    tray_labels: Mutex<TrayLabels>,
}

impl SystemState {
    pub fn settings(&self) -> MutexGuard<'_, AppSettings> {
        self.settings.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn tray_labels(&self) -> MutexGuard<'_, TrayLabels> {
        self.tray_labels.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// Loads the settings into [`SystemState`], builds the tray when enabled
/// and wires notification clicks. Called from the Tauri `setup` hook.
pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    let handle = app.handle().clone();
    let loaded = settings::load(&handle);
    let tray_enabled = loaded.tray_enabled;
    *handle.state::<SystemState>().settings() = loaded;
    if tray_enabled {
        tray::build_tray(&handle)?;
    }
    let click_handle = handle.clone();
    if let Err(err) = handle.notification().on_action(move |action| {
        if action.action_id() != "tap" {
            return;
        }
        let chat_id = action
            .notification()
            .and_then(|n| n.extra().get(notify::CHAT_ID_EXTRA))
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        notify::on_notification_clicked(&click_handle, chat_id);
    }) {
        tracing::warn!("notification on_action: {err}");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, to_value};

    #[test]
    fn error_serialises_as_kind_and_message() {
        assert_eq!(
            to_value(SystemError::storage("write failed")).unwrap(),
            json!({"kind": "Storage", "message": "write failed"})
        );
        assert_eq!(
            to_value(SystemError::invalid_input("bad")).unwrap(),
            json!({"kind": "InvalidInput", "message": "bad"})
        );
        assert_eq!(
            to_value(SystemError::internal("x")).unwrap(),
            json!({"kind": "Internal", "message": "x"})
        );
    }
}
