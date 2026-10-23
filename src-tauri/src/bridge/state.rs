//! Tauri managed state of the bridge: the one client of the process and
//! the handles the frontend refers to by id.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use gim_ffi::{GimClient, GimError, LinkSession, PendingApproval, TaskHandle, Timeline};
use tokio::sync::{watch, RwLock};

use crate::bridge::config::Config;
use crate::bridge::error::BridgeError;
use crate::bridge::hooks::SecureStore;

/// The client and the handles that only live between its calls. Dropping
/// the bundle drops every `TaskHandle` (ending the subscriptions) and
/// releases the client.
pub struct ClientBundle {
    pub client: Arc<GimClient>,
    pub links: HashMap<String, Arc<LinkSession>>,
    pub approvals: HashMap<String, Arc<PendingApproval>>,
    // Filled by the chat/timeline commands (W1-3).
    #[allow(dead_code)]
    pub timelines: HashMap<String, Arc<Timeline>>,
    #[allow(dead_code)]
    pub subscriptions: HashMap<String, Arc<TaskHandle>>,
}

impl ClientBundle {
    pub fn new(client: Arc<GimClient>) -> Self {
        Self {
            client,
            links: HashMap::new(),
            approvals: HashMap::new(),
            timelines: HashMap::new(),
            subscriptions: HashMap::new(),
        }
    }
}

/// What the last client creation reported.
#[derive(Debug, Default, Clone)]
pub struct StartupSnapshot {
    pub local_state_reset: bool,
    /// Why there is no client, if there is none.
    pub error: Option<GimError>,
}

pub struct BridgeState {
    pub client: RwLock<Option<ClientBundle>>,
    pub reachable: Arc<AtomicBool>,
    pub config: Mutex<Config>,
    pub startup: Mutex<StartupSnapshot>,
    /// Selected once at startup; shared by every client of the process.
    pub store: Mutex<Option<Arc<dyn SecureStore>>>,
    ready: watch::Sender<bool>,
}

impl Default for BridgeState {
    fn default() -> Self {
        Self {
            client: RwLock::new(None),
            reachable: Arc::new(AtomicBool::new(true)),
            config: Mutex::new(Config::default()),
            startup: Mutex::new(StartupSnapshot::default()),
            store: Mutex::new(None),
            ready: watch::Sender::new(false),
        }
    }
}

impl BridgeState {
    /// The client, cloned out of the lock so callers never await an SDK
    /// call while holding it.
    pub async fn client(&self) -> Result<Arc<GimClient>, BridgeError> {
        let guard = self.client.read().await;
        match guard.as_ref() {
            Some(bundle) => Ok(bundle.client.clone()),
            None => Err(self.not_created()),
        }
    }

    /// The error of a command issued while there is no client.
    pub fn not_created(&self) -> BridgeError {
        let startup = self.startup.lock().unwrap_or_else(|e| e.into_inner());
        let reason = match &startup.error {
            Some(err) => format!("client not created: {err}"),
            None => "client not created: no server url configured".to_string(),
        };
        BridgeError::internal(reason)
    }

    /// Marks the startup task as finished.
    pub fn set_ready(&self) {
        self.ready.send_replace(true);
    }

    /// Waits until the startup task finished.
    pub async fn wait_ready(&self) {
        let mut rx = self.ready.subscribe();
        // Only fails if the sender is gone, which it never is.
        let _ = rx.wait_for(|ready| *ready).await;
    }

    /// A new process-unique handle id.
    pub fn next_handle_id() -> String {
        static NEXT: AtomicU64 = AtomicU64::new(1);
        NEXT.fetch_add(1, Ordering::Relaxed).to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handle_ids_are_unique_strings() {
        let a = BridgeState::next_handle_id();
        let b = BridgeState::next_handle_id();
        assert_ne!(a, b);
        assert!(a.parse::<u64>().unwrap() < b.parse::<u64>().unwrap());
    }

    #[tokio::test]
    async fn no_client_reports_the_startup_error() {
        let state = BridgeState::default();
        let err = state.client().await.unwrap_err();
        assert_eq!(
            err,
            BridgeError::internal("client not created: no server url configured")
        );
        state.startup.lock().unwrap().error = Some(GimError::Storage {
            reason: "disk".into(),
        });
        let err = state.client().await.unwrap_err();
        assert_eq!(
            err,
            BridgeError::internal("client not created: storage error: disk")
        );
    }

    #[tokio::test]
    async fn startup_waits_for_ready() {
        let state = Arc::new(BridgeState::default());
        let waiter = tokio::spawn({
            let state = state.clone();
            async move { state.wait_ready().await }
        });
        tokio::task::yield_now().await;
        assert!(!waiter.is_finished());
        state.set_ready();
        waiter.await.unwrap();
        state.wait_ready().await;
    }
}
