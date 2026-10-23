//! The bridge between the frontend and gim-client-sdk: one
//! `gim_ffi::GimClient` per process in Tauri managed state, exposed through
//! Tauri commands (README, "Bridge conventions").

pub mod commands;
pub mod config;
pub mod error;
pub mod events;
pub mod hooks;
pub mod state;
pub mod types;

use std::sync::Arc;

use gim_ffi::{ClientConfig, GimError};
use tauri::Manager;

use self::config::{Config, EnvUrls};
use self::error::BridgeError;
use self::hooks::{Hooks, SystemTimeZone};
use self::state::{BridgeState, ClientBundle, StartupSnapshot};

/// The command handler of every bridge command.
pub fn invoke_handler() -> impl Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
        commands::lifecycle::startup,
        commands::lifecycle::set_server_url,
        commands::lifecycle::session,
        commands::lifecycle::user_id,
        commands::lifecycle::local_state_reset,
        commands::lifecycle::sign_out,
        commands::lifecycle::delete_account,
        commands::lifecycle::start_sync,
        commands::lifecycle::stop_sync,
        commands::lifecycle::set_network_reachable,
        commands::lifecycle::set_local_time_zone,
        commands::lifecycle::core_version,
        commands::lifecycle::ciphersuite_name,
        commands::identity::create_identity,
        commands::identity::restore_from_recovery,
        commands::identity::rotate_recovery_code,
        commands::devices::devices,
        commands::devices::user_devices,
        commands::devices::revoke_device,
        commands::link::start_link,
        commands::link::wait_link,
        commands::link::confirm_link,
        commands::link::approve_link,
        commands::link::confirm_approval,
        commands::profile::set_display_name,
        commands::profile::claim_handle,
        commands::profile::release_handle,
        commands::profile::find_user,
        commands::hubs::hubs,
        commands::hubs::add_hub,
        commands::hubs::remove_hub,
        commands::hubs::set_primary_hub,
        commands::push::register_push,
        commands::push::unregister_push,
        commands::push::process_push,
        commands::chats::create_direct_chat,
        commands::chats::create_group_chat,
        commands::chats::chat_members,
        commands::chats::add_members,
        commands::chats::remove_member,
        commands::chats::leave_chat,
        commands::chats::chat_state,
        commands::chats::set_group_info,
        commands::send::send_text,
        commands::send::send_media,
        commands::send::edit_message,
        commands::send::delete_message,
        commands::send::react,
        commands::send::unreact,
        commands::send::retry_send,
        commands::send::cancel_send,
        commands::send::mark_read,
        commands::typing::set_typing,
        commands::typing::stop_typing,
        commands::media::fetch_media,
        commands::media::fetch_thumbnail,
        commands::timeline::paginate_backwards,
        commands::timeline::timeline_chat_state,
        commands::subscriptions::subscribe_chat_list,
        commands::subscriptions::subscribe_timeline,
        commands::subscriptions::subscribe_connection_state,
        commands::subscriptions::subscribe_typing,
        commands::subscriptions::subscribe_hub_list,
        commands::subscriptions::unsubscribe,
        commands::settings::own_profile,
        commands::settings::set_avatar,
        commands::settings::remove_avatar,
        commands::settings::fetch_user_avatar,
        commands::settings::fetch_chat_avatar,
        commands::settings::privacy,
        commands::settings::set_read_receipts,
        commands::settings::set_typing_indicators,
        commands::settings::block_user,
        commands::settings::unblock_user,
        commands::settings::report_user,
        commands::settings::set_chat_muted,
        commands::settings::set_chat_pinned,
        commands::settings::set_chat_archived,
        commands::settings::muted_forever,
        crate::preview::fetch_link_preview,
    ]
}

/// Runs the startup on the Tauri async runtime; the window opens meanwhile
/// and the `startup` command waits for it.
pub fn start(app: &tauri::App) {
    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        let state = handle.state::<BridgeState>();
        if let Err(err) = startup(&handle, &state).await {
            tracing::warn!("startup: {err}");
            let mut startup = state.startup.lock().unwrap_or_else(|e| e.into_inner());
            *startup = StartupSnapshot {
                local_state_reset: false,
                error: Some(err),
            };
        }
        state.set_ready();
    });
}

/// Computes the directories, reads the configuration, selects the secure
/// store and creates the client if a server URL is configured.
async fn startup(app: &tauri::AppHandle, state: &BridgeState) -> Result<(), GimError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| GimError::Storage {
            reason: format!("app data dir: {e}"),
        })?
        .join("gim");
    let config = Config::load(app_data_dir, EnvUrls::from_process_env())?;
    let store = hooks::select_store(&config.app_data_dir)?;
    *state.store.lock().unwrap_or_else(|e| e.into_inner()) = Some(store);
    let configured = config.server_url().is_some();
    *state.config.lock().unwrap_or_else(|e| e.into_inner()) = config;
    if configured {
        // The error is recorded in `startup`; the window still opens.
        let _ = recreate_client(state).await;
    }
    Ok(())
}

/// Creates a client from the current configuration and sets its time zone.
pub async fn create_client_bundle(state: &BridgeState) -> Result<ClientBundle, GimError> {
    let (server_url, app_server_url, data_dir) = {
        let config = state.config.lock().unwrap_or_else(|e| e.into_inner());
        let url = config.server_url().ok_or_else(|| GimError::InvalidInput {
            reason: "no server url configured".to_string(),
        })?;
        let app_server_url = config.app_server_url().map(str::to_string);
        (url.to_string(), app_server_url, config.data_dir.clone())
    };
    if let Some(url) = &app_server_url {
        config::validate_app_server_url(url)?;
    }
    let store = state
        .store
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
        .ok_or_else(|| GimError::Internal {
            reason: "secure store not selected".to_string(),
        })?;
    let hooks = Arc::new(Hooks {
        data_dir,
        reachable: state.reachable.clone(),
        store,
    });
    let client = gim_ffi::create_client(
        ClientConfig {
            server_url,
            mode: None,
            app_server_url,
        },
        hooks,
    )
    .await?;
    client.set_local_time_zone(Some(Arc::new(SystemTimeZone)));
    Ok(ClientBundle::new(client))
}

/// Drops the current bundle (ending every subscription) and creates a new
/// client; `startup` records the outcome. Commands wait on the lock
/// meanwhile. Called from commands, never from an SDK callback.
pub async fn recreate_client(state: &BridgeState) -> Result<(), BridgeError> {
    let mut guard = state.client.write().await;
    drop(guard.take());
    let (bundle, snapshot) = match create_client_bundle(state).await {
        Ok(bundle) => {
            let snapshot = StartupSnapshot {
                local_state_reset: bundle.client.local_state_reset(),
                error: None,
            };
            (Some(bundle), snapshot)
        }
        Err(err) => (
            None,
            StartupSnapshot {
                local_state_reset: false,
                error: Some(err),
            },
        ),
    };
    *state.startup.lock().unwrap_or_else(|e| e.into_inner()) = snapshot;
    *guard = bundle;
    if guard.is_some() {
        Ok(())
    } else {
        Err(state.not_created())
    }
}
