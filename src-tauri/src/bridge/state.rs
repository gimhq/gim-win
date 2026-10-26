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
    /// One timeline per chat id, created on first use.
    pub timelines: Registry<Timeline>,
    /// Listener tasks under their subscription id.
    pub subscriptions: Registry<TaskHandle>,
}

impl ClientBundle {
    pub fn new(client: Arc<GimClient>) -> Self {
        Self {
            client,
            links: HashMap::new(),
            approvals: HashMap::new(),
            timelines: Registry::default(),
            subscriptions: Registry::default(),
        }
    }
}

/// Shared handles under a key the frontend refers to (a chat id, a
/// subscription id).
pub struct Registry<T>(HashMap<String, Arc<T>>);

impl<T> Default for Registry<T> {
    fn default() -> Self {
        Self(HashMap::new())
    }
}

impl<T> Registry<T> {
    pub fn get(&self, key: &str) -> Option<Arc<T>> {
        self.0.get(key).cloned()
    }

    /// The handle under `key`; an existing one wins over `value` (which is
    /// dropped), so repeated access returns the same `Arc`.
    pub fn get_or_insert(&mut self, key: String, value: Arc<T>) -> Arc<T> {
        self.0.entry(key).or_insert(value).clone()
    }

    pub fn insert(&mut self, key: String, value: Arc<T>) {
        self.0.insert(key, value);
    }

    pub fn remove(&mut self, key: &str) -> Option<Arc<T>> {
        self.0.remove(key)
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
    /// The keep server URL of the last client creation; a stored choice
    /// that differs applies after a restart.
    pub keep_server_in_use: Mutex<Option<String>>,
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
            keep_server_in_use: Mutex::new(None),
            startup: Mutex::new(StartupSnapshot::default()),
            store: Mutex::new(None),
            ready: watch::Sender::new(false),
        }
    }
}

impl BridgeState {
    /// The timeline of `chat_id`, created on first use and kept in the
    /// bundle afterwards. The SDK call runs outside the lock; if two
    /// commands race, the first stored timeline wins.
    pub async fn timeline(&self, chat_id: &str) -> Result<Arc<Timeline>, BridgeError> {
        let client = {
            let guard = self.client.read().await;
            let bundle = guard.as_ref().ok_or_else(|| self.not_created())?;
            if let Some(timeline) = bundle.timelines.get(chat_id) {
                return Ok(timeline);
            }
            bundle.client.clone()
        };
        let timeline = client.timeline(chat_id.to_string()).await?;
        let mut guard = self.client.write().await;
        let bundle = guard.as_mut().ok_or_else(|| self.not_created())?;
        Ok(bundle
            .timelines
            .get_or_insert(chat_id.to_string(), timeline))
    }

    /// Stores a listener task under `id` (issued by `next_handle_id`
    /// before the listener was created, so its events carry it) and
    /// returns the id.
    pub async fn add_subscription(
        &self,
        id: String,
        handle: Arc<TaskHandle>,
    ) -> Result<String, BridgeError> {
        let mut guard = self.client.write().await;
        let bundle = guard.as_mut().ok_or_else(|| self.not_created())?;
        bundle.subscriptions.insert(id.clone(), handle);
        Ok(id)
    }

    /// Ends the subscription; an unknown id (or no client) is not an error.
    pub async fn remove_subscription(&self, id: &str) {
        let mut guard = self.client.write().await;
        if let Some(handle) = guard.as_mut().and_then(|b| b.subscriptions.remove(id)) {
            handle.cancel();
        }
    }

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
        let err = state.client().await.err().unwrap();
        assert_eq!(
            err,
            BridgeError::internal("client not created: no server url configured")
        );
        state.startup.lock().unwrap().error = Some(GimError::Storage {
            reason: "disk".into(),
        });
        let err = state.client().await.err().unwrap();
        assert_eq!(
            err,
            BridgeError::internal("client not created: storage error: disk")
        );
    }

    #[test]
    fn registry_returns_the_same_handle_for_one_key() {
        let mut registry = Registry::<u32>::default();
        let first = registry.get_or_insert("hb/g1".into(), Arc::new(1));
        let again = registry.get_or_insert("hb/g1".into(), Arc::new(2));
        assert!(Arc::ptr_eq(&first, &again));
        assert!(Arc::ptr_eq(&first, &registry.get("hb/g1").unwrap()));
        let other = registry.get_or_insert("hb/g2".into(), Arc::new(3));
        assert!(!Arc::ptr_eq(&first, &other));
    }

    #[test]
    fn registry_remove_is_lenient() {
        let mut registry = Registry::<u32>::default();
        let id = BridgeState::next_handle_id();
        registry.insert(id.clone(), Arc::new(1));
        assert!(registry.remove("unknown").is_none());
        assert!(registry.get(&id).is_some());
        assert!(registry.remove(&id).is_some());
        assert!(registry.get(&id).is_none());
        assert!(registry.remove(&id).is_none());
    }

    #[tokio::test]
    async fn remove_subscription_without_client_is_ok() {
        let state = BridgeState::default();
        state.remove_subscription("unknown").await;
        assert!(state.timeline("hb/g1").await.is_err());
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
