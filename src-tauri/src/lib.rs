//! Tauri application of gim-win: the bridge over gim-client-sdk
//! (`bridge`) registered as Tauri commands.

// gim-ffi's library is named gim_core; the bridge uses the crate name.
extern crate gim_core as gim_ffi;

mod bridge;
mod preview;
mod search;

use bridge::state::BridgeState;

pub fn run() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(BridgeState::default())
        .manage(search::SearchState::default())
        .setup(|app| {
            bridge::start(app);
            Ok(())
        })
        .invoke_handler(bridge::invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
