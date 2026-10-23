//! Native notifications through tauri-plugin-notification, and the
//! `notification-clicked` event that focuses the chat the toast belongs to.

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_notification::NotificationExt;

use super::window::show_main;
use super::{SystemError, SystemState};

/// Emitted when the user clicks a notification; payload `{chatId}`.
pub const NOTIFICATION_CLICKED: &str = "notification-clicked";
/// The notification extra carrying the chat id back to the click handler.
pub const CHAT_ID_EXTRA: &str = "chatId";
const MAX_BODY_CHARS: usize = 200;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationClicked {
    pub chat_id: String,
}

/// A notification with normalised title and body.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NotificationPayload {
    pub title: String,
    pub body: String,
    pub chat_id: String,
}

impl NotificationPayload {
    /// Empty title becomes "gim"; the body is trimmed and cut to 200
    /// characters with an ellipsis.
    pub fn new(title: String, body: String, chat_id: String) -> Self {
        let title = if title.trim().is_empty() {
            "gim".to_string()
        } else {
            title
        };
        let trimmed = body.trim();
        let body = match trimmed.char_indices().nth(MAX_BODY_CHARS) {
            Some((cut, _)) => format!("{}…", &trimmed[..cut]),
            None => trimmed.to_string(),
        };
        Self {
            title,
            body,
            chat_id,
        }
    }
}

/// Focuses the main window and emits `notification-clicked`.
pub fn on_notification_clicked(app: &AppHandle, chat_id: String) {
    show_main(app);
    if let Err(err) = app.emit(NOTIFICATION_CLICKED, NotificationClicked { chat_id }) {
        tracing::warn!("emit {NOTIFICATION_CLICKED}: {err}");
    }
}

/// Shows a native notification. The sound follows `notifications.sound`
/// on Windows (the toast is silent unless a sound is requested); on the
/// other desktops it follows the OS.
#[tauri::command]
pub fn notify(
    app: AppHandle,
    state: State<'_, SystemState>,
    title: String,
    body: String,
    chat_id: String,
) -> Result<(), SystemError> {
    let payload = NotificationPayload::new(title, body, chat_id);
    let sound = state.settings().notifications.sound;
    let mut builder = app
        .notification()
        .builder()
        .title(payload.title)
        .body(payload.body)
        .extra(CHAT_ID_EXTRA, payload.chat_id);
    if cfg!(windows) && sound {
        builder = builder.sound("Default");
    }
    builder
        .show()
        .map_err(|e| SystemError::internal(format!("notification: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, to_value};

    #[test]
    fn empty_title_becomes_gim() {
        let p = NotificationPayload::new("  ".into(), "hi".into(), "hb/c1".into());
        assert_eq!(p.title, "gim");
        assert_eq!(p.body, "hi");
        assert_eq!(p.chat_id, "hb/c1");
    }

    #[test]
    fn body_is_trimmed_and_truncated_on_a_char_boundary() {
        let p = NotificationPayload::new("t".into(), "  short  ".into(), "c".into());
        assert_eq!(p.body, "short");
        let long: String = "é".repeat(250);
        let p = NotificationPayload::new("t".into(), long, "c".into());
        assert_eq!(p.body.chars().count(), MAX_BODY_CHARS + 1);
        assert!(p.body.ends_with('…'));
        assert!(p.body.starts_with(&"é".repeat(MAX_BODY_CHARS)));
        let exact: String = "a".repeat(MAX_BODY_CHARS);
        let p = NotificationPayload::new("t".into(), exact.clone(), "c".into());
        assert_eq!(p.body, exact);
    }

    #[test]
    fn clicked_event_serialises_as_chat_id() {
        assert_eq!(NOTIFICATION_CLICKED, "notification-clicked");
        assert_eq!(
            to_value(NotificationClicked {
                chat_id: "hb/c1".into()
            })
            .unwrap(),
            json!({"chatId": "hb/c1"})
        );
    }
}
