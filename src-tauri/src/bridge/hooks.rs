//! `gim_ffi::PlatformHooks` and `gim_ffi::LocalTimeZone` for the desktop.
//!
//! Every method here runs on gim-core's callback thread: it copies data and
//! returns, never calls `GimClient` and never waits on the Tauri runtime
//! (API.md, "Threading of platform callbacks").

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use chrono::{LocalResult, TimeZone};
use gim_ffi::GimError;

/// Keyring service name; the account is the SDK's key.
pub const KEYRING_SERVICE: &str = "im.g.gimwin";

/// Where the SDK's secrets (database key, session, device key) live.
pub trait SecureStore: Send + Sync {
    fn get(&self, key: &str) -> Result<Option<Vec<u8>>, GimError>;
    fn set(&self, key: &str, value: &[u8]) -> Result<(), GimError>;
    fn delete(&self, key: &str) -> Result<(), GimError>;
}

/// The platform credential store through the `keyring` crate: Windows
/// Credential Manager on Windows, the freedesktop secret service on Linux.
pub struct KeyringStore;

impl KeyringStore {
    fn entry(key: &str) -> Result<keyring::Entry, GimError> {
        keyring::Entry::new(KEYRING_SERVICE, key).map_err(storage)
    }
}

impl SecureStore for KeyringStore {
    fn get(&self, key: &str) -> Result<Option<Vec<u8>>, GimError> {
        match Self::entry(key)?.get_secret() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(storage(e)),
        }
    }

    fn set(&self, key: &str, value: &[u8]) -> Result<(), GimError> {
        Self::entry(key)?.set_secret(value).map_err(storage)
    }

    fn delete(&self, key: &str) -> Result<(), GimError> {
        match Self::entry(key)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(storage(e)),
        }
    }
}

fn storage(err: keyring::Error) -> GimError {
    GimError::Storage {
        reason: format!("secure store: {err}"),
    }
}

/// Selects the store for this process: on Windows always the keyring; on
/// Linux `GIM_WIN_SECURE_STORE` (`keyring` / `file`) or, unset, the secret
/// service when it answers and the file store otherwise.
pub fn select_store(app_data_dir: &std::path::Path) -> Result<Arc<dyn SecureStore>, GimError> {
    #[cfg(target_os = "linux")]
    {
        linux::select_store(app_data_dir)
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = app_data_dir;
        tracing::info!("secure store: keyring");
        Ok(Arc::new(KeyringStore))
    }
}

#[cfg(target_os = "linux")]
pub mod linux {
    //! The file store: an SQLCipher database next to a key file with
    //! owner-only permissions. It protects the secrets at rest; it is the
    //! headless/dev fallback, not a credential manager.

    use std::fs;
    use std::io::Read;
    use std::os::unix::fs::OpenOptionsExt;
    use std::path::Path;
    use std::sync::{Arc, Mutex};

    use gim_ffi::GimError;
    use rusqlite::{params, Connection, OptionalExtension};

    use super::{KeyringStore, SecureStore, KEYRING_SERVICE};

    /// Environment variable forcing the store: `file` or `keyring`.
    pub const SECURE_STORE_ENV: &str = "GIM_WIN_SECURE_STORE";
    const DB_FILE: &str = "secure-store.db";
    const KEY_FILE: &str = "secure-store.key";

    pub fn select_store(app_data_dir: &Path) -> Result<Arc<dyn SecureStore>, GimError> {
        let forced = std::env::var(SECURE_STORE_ENV).ok();
        let use_file = match forced.as_deref() {
            Some("file") => true,
            Some("keyring") => false,
            Some(other) => {
                return Err(GimError::InvalidInput {
                    reason: format!("{SECURE_STORE_ENV} must be file or keyring (got {other:?})"),
                })
            }
            None => !secret_service_available(),
        };
        if use_file {
            tracing::info!("secure store: file ({})", app_data_dir.join(DB_FILE).display());
            Ok(Arc::new(FileStore::open(app_data_dir)?))
        } else {
            tracing::info!("secure store: keyring (secret service)");
            Ok(Arc::new(KeyringStore))
        }
    }

    /// Probes the secret service once: a platform or storage-access
    /// failure means it is not available.
    fn secret_service_available() -> bool {
        let probe = keyring::Entry::new(KEYRING_SERVICE, "probe").and_then(|e| e.get_secret());
        !matches!(
            probe,
            Err(keyring::Error::PlatformFailure(_) | keyring::Error::NoStorageAccess(_))
        )
    }

    pub struct FileStore {
        conn: Mutex<Connection>,
    }

    impl FileStore {
        /// Opens (or creates) `<dir>/secure-store.db` keyed by
        /// `<dir>/secure-store.key`.
        pub fn open(dir: &Path) -> Result<Self, GimError> {
            let key = load_or_create_key(&dir.join(KEY_FILE))?;
            let path = dir.join(DB_FILE);
            let conn = Connection::open(&path).map_err(|e| storage(&path, e))?;
            conn.execute_batch(&format!("PRAGMA key = \"x'{key}'\";"))
                .map_err(|e| storage(&path, e))?;
            // Fails with "file is not a database" under a wrong key.
            conn.query_row("SELECT count(*) FROM sqlite_master", [], |row| {
                row.get::<_, i64>(0)
            })
            .map_err(|e| storage(&path, e))?;
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS secrets(key TEXT PRIMARY KEY, value BLOB NOT NULL)",
            )
            .map_err(|e| storage(&path, e))?;
            Ok(Self {
                conn: Mutex::new(conn),
            })
        }

        fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
            self.conn.lock().unwrap_or_else(|e| e.into_inner())
        }
    }

    impl SecureStore for FileStore {
        fn get(&self, key: &str) -> Result<Option<Vec<u8>>, GimError> {
            self.conn()
                .query_row(
                    "SELECT value FROM secrets WHERE key = ?1",
                    params![key],
                    |row| row.get::<_, Vec<u8>>(0),
                )
                .optional()
                .map_err(sql)
        }

        fn set(&self, key: &str, value: &[u8]) -> Result<(), GimError> {
            self.conn()
                .execute(
                    "INSERT INTO secrets(key, value) VALUES (?1, ?2)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    params![key, value],
                )
                .map(|_| ())
                .map_err(sql)
        }

        fn delete(&self, key: &str) -> Result<(), GimError> {
            self.conn()
                .execute("DELETE FROM secrets WHERE key = ?1", params![key])
                .map(|_| ())
                .map_err(sql)
        }
    }

    /// The hex key of the key file; created (32 random bytes, mode 0600)
    /// when missing.
    fn load_or_create_key(path: &Path) -> Result<String, GimError> {
        match fs::read_to_string(path) {
            Ok(hex) => {
                let hex = hex.trim().to_string();
                if hex.len() == 64 && hex.chars().all(|c| c.is_ascii_hexdigit()) {
                    Ok(hex)
                } else {
                    Err(GimError::Storage {
                        reason: format!("{}: not a 32-byte hex key", path.display()),
                    })
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                let mut bytes = [0u8; 32];
                fs::File::open("/dev/urandom")
                    .and_then(|mut f| f.read_exact(&mut bytes))
                    .map_err(|e| storage(Path::new("/dev/urandom"), e))?;
                let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
                let mut file = fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .mode(0o600)
                    .open(path)
                    .map_err(|e| storage(path, e))?;
                std::io::Write::write_all(&mut file, hex.as_bytes())
                    .map_err(|e| storage(path, e))?;
                Ok(hex)
            }
            Err(e) => Err(storage(path, e)),
        }
    }

    fn storage(path: &Path, err: impl std::fmt::Display) -> GimError {
        GimError::Storage {
            reason: format!("{}: {err}", path.display()),
        }
    }

    fn sql(err: rusqlite::Error) -> GimError {
        GimError::Storage {
            reason: format!("secure store: {err}"),
        }
    }
}

/// The hooks of one client.
pub struct Hooks {
    pub data_dir: PathBuf,
    pub reachable: Arc<AtomicBool>,
    pub store: Arc<dyn SecureStore>,
}

impl gim_ffi::PlatformHooks for Hooks {
    fn secure_store_get(&self, key: String) -> Result<Option<Vec<u8>>, GimError> {
        self.store.get(&key)
    }

    fn secure_store_set(&self, key: String, value: Vec<u8>) -> Result<(), GimError> {
        self.store.set(&key, &value)
    }

    fn secure_store_delete(&self, key: String) {
        if let Err(e) = self.store.delete(&key) {
            tracing::warn!("secure store delete {key}: {e}");
        }
    }

    fn data_dir(&self) -> String {
        self.data_dir.to_string_lossy().into_owned()
    }

    fn is_network_reachable(&self) -> bool {
        self.reachable.load(Ordering::SeqCst)
    }
}

/// The OS time zone, DST-aware at each instant.
pub struct SystemTimeZone;

impl SystemTimeZone {
    /// Offset from UTC in seconds in effect at `at_ms`.
    pub fn offset_secs(at_ms: i64) -> i32 {
        let local = chrono::Local.timestamp_millis_opt(at_ms);
        let dt = match local {
            LocalResult::Single(dt) => Some(dt),
            // Ambiguous (DST fold): the earlier offset.
            LocalResult::Ambiguous(earliest, _) => Some(earliest),
            LocalResult::None => None,
        };
        dt.map(|dt| dt.offset().local_minus_utc()).unwrap_or(0)
    }
}

impl gim_ffi::LocalTimeZone for SystemTimeZone {
    fn utc_offset_secs(&self, at_ms: i64) -> i32 {
        Self::offset_secs(at_ms)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gim_ffi::LocalTimeZone as _;

    #[test]
    fn system_time_zone_matches_chrono() {
        let at_ms = 1_700_000_000_000;
        let offset = SystemTimeZone.utc_offset_secs(at_ms);
        assert!((-14 * 3600..=14 * 3600).contains(&offset), "{offset}");
        let expected = chrono::Local
            .timestamp_millis_opt(at_ms)
            .single()
            .unwrap()
            .offset()
            .local_minus_utc();
        assert_eq!(offset, expected);
        assert_eq!(SystemTimeZone::offset_secs(i64::MAX), 0);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn file_store_round_trip() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let store = linux::FileStore::open(dir.path()).unwrap();
        assert_eq!(store.get("missing").unwrap(), None);
        store.set("db-key", b"secret").unwrap();
        assert_eq!(store.get("db-key").unwrap().as_deref(), Some(&b"secret"[..]));
        store.set("db-key", b"replaced").unwrap();
        assert_eq!(
            store.get("db-key").unwrap().as_deref(),
            Some(&b"replaced"[..])
        );
        store.delete("db-key").unwrap();
        store.delete("db-key").unwrap();
        assert_eq!(store.get("db-key").unwrap(), None);
        store.set("session", &[0, 1, 2, 255]).unwrap();
        drop(store);

        let mode = std::fs::metadata(dir.path().join("secure-store.key"))
            .unwrap()
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o600);

        let reopened = linux::FileStore::open(dir.path()).unwrap();
        assert_eq!(
            reopened.get("session").unwrap().as_deref(),
            Some(&[0, 1, 2, 255][..])
        );
        // The database is encrypted: plain SQLite cannot read it.
        let raw = std::fs::read(dir.path().join("secure-store.db")).unwrap();
        assert!(!raw.starts_with(b"SQLite format 3"));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn file_store_rejects_a_wrong_key() {
        let dir = tempfile::tempdir().unwrap();
        let store = linux::FileStore::open(dir.path()).unwrap();
        store.set("k", b"v").unwrap();
        drop(store);
        std::fs::write(dir.path().join("secure-store.key"), "00".repeat(32)).unwrap();
        let err = linux::FileStore::open(dir.path()).unwrap_err();
        assert!(matches!(err, GimError::Storage { .. }));
    }

    #[test]
    fn hooks_do_not_touch_the_client() {
        use gim_ffi::PlatformHooks as _;

        struct Memory(std::sync::Mutex<std::collections::HashMap<String, Vec<u8>>>);
        impl SecureStore for Memory {
            fn get(&self, key: &str) -> Result<Option<Vec<u8>>, GimError> {
                Ok(self.0.lock().unwrap().get(key).cloned())
            }
            fn set(&self, key: &str, value: &[u8]) -> Result<(), GimError> {
                self.0.lock().unwrap().insert(key.into(), value.to_vec());
                Ok(())
            }
            fn delete(&self, key: &str) -> Result<(), GimError> {
                self.0.lock().unwrap().remove(key);
                Ok(())
            }
        }

        let reachable = Arc::new(AtomicBool::new(true));
        let hooks = Hooks {
            data_dir: PathBuf::from("/tmp/gim-data"),
            reachable: reachable.clone(),
            store: Arc::new(Memory(Default::default())),
        };
        assert_eq!(hooks.data_dir(), "/tmp/gim-data");
        assert!(hooks.is_network_reachable());
        reachable.store(false, Ordering::SeqCst);
        assert!(!hooks.is_network_reachable());
        assert_eq!(hooks.secure_store_get("k".into()).unwrap(), None);
        hooks.secure_store_set("k".into(), vec![1]).unwrap();
        assert_eq!(hooks.secure_store_get("k".into()).unwrap(), Some(vec![1]));
        hooks.secure_store_delete("k".into());
        assert_eq!(hooks.secure_store_get("k".into()).unwrap(), None);
    }
}
