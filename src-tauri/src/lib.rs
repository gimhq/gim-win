//! Tauri application of gim-win: the bridge over gim-client-sdk
//! (`bridge`) registered as Tauri commands, and the desktop integration
//! (`system`: settings, tray, notifications, badge, window behaviour).

// gim-ffi's library is named gim_core; the bridge uses the crate name.
extern crate gim_core as gim_ffi;

mod bridge;
mod system;

use bridge::state::BridgeState;

pub fn run() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        // Must be the first plugin (tauri-plugin-single-instance docs).
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            system::window::show_main(app)
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(system::autostart::plugin())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(BridgeState::default())
        .manage(system::SystemState::default())
        .setup(|app| {
            bridge::start(app);
            system::setup(app)?;
            Ok(())
        })
        .on_window_event(system::window::on_window_event)
        .invoke_handler(bridge::invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
