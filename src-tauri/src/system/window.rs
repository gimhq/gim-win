//! The main window: show-and-focus, close-to-tray and quit.

use tauri::{AppHandle, Manager, State, Window, WindowEvent};

use super::{SystemError, SystemState};

const MAIN: &str = "main";

/// Shows, unminimizes and focuses the main window; failures are logged.
pub fn show_main(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN) else {
        tracing::warn!("show_main_window: no window {MAIN}");
        return;
    };
    for (what, result) in [
        ("show", window.show()),
        ("unminimize", window.unminimize()),
        ("set_focus", window.set_focus()),
    ] {
        if let Err(err) = result {
            tracing::warn!("show_main_window: {what}: {err}");
        }
    }
}

fn hide_main_window(app: &AppHandle) {
    match app.get_webview_window(MAIN) {
        Some(window) => {
            if let Err(err) = window.hide() {
                tracing::warn!("hide_main_window: {err}");
            }
        }
        None => tracing::warn!("hide_main_window: no window {MAIN}"),
    }
}

fn tray_enabled(app: &AppHandle) -> bool {
    app.state::<SystemState>().settings().tray_enabled
}

/// Close-to-tray: with the tray enabled a close request hides the window
/// instead; otherwise the window closes and the app exits with it.
pub fn on_window_event(window: &Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        if window.label() == MAIN && tray_enabled(window.app_handle()) {
            api.prevent_close();
            hide_main_window(window.app_handle());
        }
    }
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), SystemError> {
    show_main(&app);
    Ok(())
}

#[tauri::command]
pub fn hide_to_tray(app: AppHandle, state: State<'_, SystemState>) -> Result<(), SystemError> {
    if state.settings().tray_enabled {
        hide_main_window(&app);
    } else {
        app.exit(0);
    }
    Ok(())
}

#[tauri::command]
pub fn quit_app(app: AppHandle) -> Result<(), SystemError> {
    app.exit(0);
    Ok(())
}
