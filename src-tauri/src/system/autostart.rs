//! Autostart: the plugin only. The frontend drives it through
//! `@tauri-apps/plugin-autostart` (`autostart:default` in the capability).

use tauri::plugin::TauriPlugin;
use tauri::Runtime;
use tauri_plugin_autostart::MacosLauncher;

/// The autostart plugin for the builder chain in lib.rs.
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None)
}
