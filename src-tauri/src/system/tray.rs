//! The tray icon: built in code with a Show / Hide / Quit menu whose labels
//! follow the UI language through `set_tray_labels`.

use tauri::menu::{Menu, MenuEvent, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State};

use super::window::show_main;
use super::{SystemError, SystemState};

pub const TRAY_ID: &str = "main";
const SHOW: &str = "show";
const HIDE: &str = "hide";
const QUIT: &str = "quit";

/// The menu labels; English until the frontend sets them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrayLabels {
    pub show: String,
    pub hide: String,
    pub quit: String,
}

impl Default for TrayLabels {
    fn default() -> Self {
        Self {
            show: "Show".to_string(),
            hide: "Hide".to_string(),
            quit: "Quit".to_string(),
        }
    }
}

impl TrayLabels {
    pub fn with(show: String, hide: String, quit: String) -> Self {
        Self { show, hide, quit }
    }
}

fn build_menu(app: &AppHandle, labels: &TrayLabels) -> tauri::Result<Menu<tauri::Wry>> {
    let show = MenuItem::with_id(app, SHOW, &labels.show, true, None::<&str>)?;
    let hide = MenuItem::with_id(app, HIDE, &labels.hide, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT, &labels.quit, true, None::<&str>)?;
    Menu::with_items(app, &[&show, &hide, &quit])
}

fn on_menu_event(app: &AppHandle, event: MenuEvent) {
    match event.id().as_ref() {
        SHOW => show_main(app),
        HIDE => {
            if let Some(window) = app.get_webview_window("main") {
                if let Err(err) = window.hide() {
                    tracing::warn!("tray hide: {err}");
                }
            }
        }
        QUIT => app.exit(0),
        other => tracing::debug!("tray: unknown menu id {other}"),
    }
}

/// Creates the tray icon with the current labels; a second call replaces
/// the previous icon.
pub fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    remove_tray(app);
    let labels = app.state::<SystemState>().tray_labels().clone();
    let menu = build_menu(app, &labels)?;
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("gim")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(on_menu_event)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    builder.build(app)?;
    Ok(())
}

/// Removes the tray icon if it exists.
pub fn remove_tray(app: &AppHandle) {
    let _ = app.remove_tray_by_id(TRAY_ID);
}

/// Stores the labels and rebuilds the tray menu when the tray exists;
/// an empty label is rejected.
#[tauri::command]
pub fn set_tray_labels(
    app: AppHandle,
    state: State<'_, SystemState>,
    show: String,
    hide: String,
    quit: String,
) -> Result<(), SystemError> {
    if [&show, &hide, &quit].iter().any(|l| l.trim().is_empty()) {
        return Err(SystemError::invalid_input("tray labels must not be empty"));
    }
    let labels = TrayLabels::with(show, hide, quit);
    *state.tray_labels() = labels.clone();
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let menu = build_menu(&app, &labels)?;
        tray.set_menu(Some(menu))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_labels_are_english() {
        let labels = TrayLabels::default();
        assert_eq!(labels.show, "Show");
        assert_eq!(labels.hide, "Hide");
        assert_eq!(labels.quit, "Quit");
    }

    #[test]
    fn with_replaces_the_labels() {
        let labels = TrayLabels::with("显示".into(), "隐藏".into(), "退出".into());
        assert_eq!(labels.show, "显示");
        assert_eq!(labels.hide, "隐藏");
        assert_eq!(labels.quit, "退出");
        assert_ne!(labels, TrayLabels::default());
    }
}
