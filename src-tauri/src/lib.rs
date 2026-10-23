//! Tauri application of gim-win. Later tasks add the bridge over
//! gim-client-sdk and register its commands in `run`.

/// Names the SDK crates so they are compiled and linked into the app.
pub fn sdk_crates_linked() -> &'static str {
    let _ = gim_sdk::LINK_TIMEOUT;
    let _ = gim_store_sqlite::SCHEMA_VERSION;
    let _ = gim_ui::DEFAULT_PAGE_SIZE;
    "gim-sdk, gim-store-sqlite, gim-ui"
}

pub fn run() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn sdk_crates_are_linked() {
        assert_eq!(super::sdk_crates_linked(), "gim-sdk, gim-store-sqlite, gim-ui");
    }
}
