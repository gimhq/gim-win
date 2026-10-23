use std::sync::atomic::Ordering;
use std::sync::Arc;

use tauri::State;

use crate::bridge::error::BridgeError;
use crate::bridge::hooks::SystemTimeZone;
use crate::bridge::state::BridgeState;
use crate::bridge::types::{Session, StartupInfo};
use crate::bridge::{config, recreate_client};

/// Waits for the startup task and reports its outcome.
#[tauri::command]
pub async fn startup(state: State<'_, BridgeState>) -> Result<StartupInfo, BridgeError> {
    state.wait_ready().await;
    startup_info(&state).await
}

async fn startup_info(state: &BridgeState) -> Result<StartupInfo, BridgeError> {
    let server_url = state
        .config
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .server_url()
        .map(str::to_string);
    let snapshot = state
        .startup
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone();
    let client = state.client().await.ok();
    let session = match &client {
        Some(client) => client.session().await?.map(Session::from),
        None => None,
    };
    Ok(StartupInfo {
        server_url,
        client_ready: client.is_some(),
        local_state_reset: snapshot.local_state_reset,
        session,
        error: snapshot.error.map(BridgeError),
    })
}

/// Persists the server URL and recreates the client; `InvalidInput` while
/// a session exists.
#[tauri::command]
pub async fn set_server_url(
    state: State<'_, BridgeState>,
    url: String,
) -> Result<StartupInfo, BridgeError> {
    state.wait_ready().await;
    config::validate_server_url(&url)?;
    if let Ok(client) = state.client().await {
        if client.session().await?.is_some() {
            return Err(BridgeError::invalid_input(
                "sign out before changing the server url",
            ));
        }
    }
    state
        .config
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .set_server_url(&url)?;
    // A failed creation is reported through `error`, not as a rejection.
    let _ = recreate_client(&state).await;
    startup_info(&state).await
}

#[tauri::command]
pub async fn session(state: State<'_, BridgeState>) -> Result<Option<Session>, BridgeError> {
    let client = state.client().await?;
    Ok(client.session().await?.map(Into::into))
}

#[tauri::command]
pub async fn user_id(state: State<'_, BridgeState>) -> Result<Option<String>, BridgeError> {
    Ok(state.client().await?.user_id())
}

#[tauri::command]
pub async fn local_state_reset(state: State<'_, BridgeState>) -> Result<bool, BridgeError> {
    Ok(state.client().await?.local_state_reset())
}

/// Signs out, then drops every handle and creates a fresh client (also
/// when the sign-out failed: the old client is unusable afterwards).
#[tauri::command]
pub async fn sign_out(state: State<'_, BridgeState>) -> Result<(), BridgeError> {
    let client = state.client().await?;
    let result = client.sign_out().await;
    drop(client);
    let recreated = recreate_client(&state).await;
    result?;
    recreated
}

/// Deletes the account for good (API.md "Account deletion") and returns the
/// hubs it could not reach. The SDK wiped this device like `sign_out`, so a
/// fresh client is created afterwards; on an error nothing local was
/// deleted and the client stays usable, so it can be called again.
#[tauri::command]
pub async fn delete_account(state: State<'_, BridgeState>) -> Result<Vec<String>, BridgeError> {
    let client = state.client().await?;
    let unreached = client.delete_account().await?;
    drop(client);
    recreate_client(&state).await?;
    Ok(unreached)
}

#[tauri::command]
pub async fn start_sync(state: State<'_, BridgeState>) -> Result<(), BridgeError> {
    Ok(state.client().await?.start_sync().await?)
}

#[tauri::command]
pub async fn stop_sync(state: State<'_, BridgeState>) -> Result<(), BridgeError> {
    Ok(state.client().await?.stop_sync().await?)
}

/// Stores the reachability for the hooks and forwards it to the client.
#[tauri::command]
pub async fn set_network_reachable(
    state: State<'_, BridgeState>,
    reachable: bool,
) -> Result<(), BridgeError> {
    state.reachable.store(reachable, Ordering::SeqCst);
    if let Ok(client) = state.client().await {
        client.set_network_reachable(reachable);
    }
    Ok(())
}

/// `system`: the OS time zone; otherwise UTC.
#[tauri::command]
pub async fn set_local_time_zone(
    state: State<'_, BridgeState>,
    system: bool,
) -> Result<(), BridgeError> {
    let client = state.client().await?;
    let zone: Option<Arc<dyn gim_ffi::LocalTimeZone>> =
        system.then(|| Arc::new(SystemTimeZone) as Arc<dyn gim_ffi::LocalTimeZone>);
    client.set_local_time_zone(zone);
    Ok(())
}

#[tauri::command]
pub async fn core_version() -> Result<String, BridgeError> {
    Ok(gim_ffi::core_version())
}

#[tauri::command]
pub async fn ciphersuite_name() -> Result<String, BridgeError> {
    Ok(gim_ffi::ciphersuite_name())
}
