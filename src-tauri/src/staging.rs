//! Staging of attachment bytes that have no file yet (pasted images): they
//! are written under the app cache so `send_media` can take a path.

use std::collections::hash_map::RandomState;
use std::hash::{BuildHasher, Hasher};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

use crate::bridge::error::BridgeError;

/// The largest staged attachment.
pub const MAX_STAGED_BYTES: usize = 100 * 1024 * 1024;

/// `[a-z0-9]{1,8}`.
fn valid_extension(extension: &str) -> bool {
    (1..=8).contains(&extension.len())
        && extension
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
}

/// A file name that does not repeat within the process and is hard to guess.
fn random_name() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let mut hasher = RandomState::new().build_hasher();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or_default();
    hasher.write_u128(nanos);
    let count = COUNTER.fetch_add(1, Ordering::Relaxed);
    hasher.write_u64(count);
    format!("{:016x}{count:x}", hasher.finish())
}

/// Writes `bytes` to `<dir>/<random>.<extension>`, creating `dir`.
pub fn stage_in(dir: &Path, bytes: &[u8], extension: &str) -> Result<PathBuf, BridgeError> {
    if !valid_extension(extension) {
        return Err(BridgeError::invalid_input("invalid attachment extension"));
    }
    if bytes.len() > MAX_STAGED_BYTES {
        return Err(BridgeError::invalid_input(
            "attachment is larger than 100 MiB",
        ));
    }
    std::fs::create_dir_all(dir)
        .map_err(|e| BridgeError::internal(format!("create staging dir: {e}")))?;
    let path = dir.join(format!("{}.{extension}", random_name()));
    std::fs::write(&path, bytes)
        .map_err(|e| BridgeError::internal(format!("write staged attachment: {e}")))?;
    Ok(path)
}

/// Stages pasted bytes under `<app_cache_dir>/staging` and returns the path.
#[tauri::command]
pub async fn stage_attachment(
    app: AppHandle,
    bytes: Vec<u8>,
    extension: String,
) -> Result<String, BridgeError> {
    let cache = app
        .path()
        .app_cache_dir()
        .map_err(|e| BridgeError::internal(format!("app cache dir: {e}")))?;
    let path = stage_in(&cache.join("staging"), &bytes, &extension)?;
    Ok(path.to_string_lossy().into_owned())
}

/// Creates `<cache>/media/<chat_id>` and returns it; `chat_id` must be one
/// non-empty path component.
pub fn media_dir_in(cache: &Path, chat_id: &str) -> Result<PathBuf, BridgeError> {
    if chat_id.is_empty()
        || chat_id == "."
        || chat_id.contains("..")
        || chat_id.contains(['/', '\\'])
    {
        return Err(BridgeError::invalid_input("invalid chat id"));
    }
    let dir = cache.join("media").join(chat_id);
    std::fs::create_dir_all(&dir)
        .map_err(|e| BridgeError::internal(format!("create media dir: {e}")))?;
    Ok(dir)
}

/// Creates `<app_cache_dir>/media/<chat_id>`, where `fetch_media` and
/// `fetch_thumbnail` write cached media, and returns its path.
#[tauri::command]
pub async fn prepare_media_dir(app: AppHandle, chat_id: String) -> Result<String, BridgeError> {
    let cache = app
        .path()
        .app_cache_dir()
        .map_err(|e| BridgeError::internal(format!("app cache dir: {e}")))?;
    let dir = media_dir_in(&cache, &chat_id)?;
    Ok(dir.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_short_lowercase_alphanumeric_extensions() {
        for ext in ["png", "jpg", "webp", "mp4", "a", "12345678"] {
            assert!(valid_extension(ext), "{ext}");
        }
        for ext in ["", "PNG", "tar.gz", "../x", "p g", "123456789", "jpé"] {
            assert!(!valid_extension(ext), "{ext}");
        }
    }

    #[test]
    fn writes_the_bytes_into_the_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("staging");
        let a = stage_in(&dir, b"hello", "png").unwrap();
        let b = stage_in(&dir, b"world", "png").unwrap();
        assert_ne!(a, b);
        assert_eq!(a.parent().unwrap(), dir);
        assert_eq!(a.extension().unwrap(), "png");
        assert_eq!(std::fs::read(&a).unwrap(), b"hello");
        assert_eq!(std::fs::read(&b).unwrap(), b"world");
    }

    #[test]
    fn rejects_a_bad_extension_or_oversized_bytes() {
        let tmp = tempfile::tempdir().unwrap();
        let err = stage_in(tmp.path(), b"x", "../evil").unwrap_err();
        assert!(matches!(err.0, gim_ffi::GimError::InvalidInput { .. }));
        let big = vec![0u8; MAX_STAGED_BYTES + 1];
        let err = stage_in(tmp.path(), &big, "png").unwrap_err();
        assert!(matches!(err.0, gim_ffi::GimError::InvalidInput { .. }));
        assert_eq!(std::fs::read_dir(tmp.path()).unwrap().count(), 0);
    }

    #[test]
    fn creates_the_media_dir_of_a_chat() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = media_dir_in(tmp.path(), "chat-1").unwrap();
        assert_eq!(dir, tmp.path().join("media").join("chat-1"));
        assert!(dir.is_dir());
        // Idempotent.
        assert_eq!(media_dir_in(tmp.path(), "chat-1").unwrap(), dir);
    }

    #[test]
    fn rejects_a_chat_id_that_is_not_one_path_component() {
        let tmp = tempfile::tempdir().unwrap();
        for id in ["", ".", "..", "a/b", "a\\b", "../x", "x/.."] {
            let err = media_dir_in(tmp.path(), id).unwrap_err();
            assert!(
                matches!(err.0, gim_ffi::GimError::InvalidInput { .. }),
                "{id}"
            );
        }
        assert!(!tmp.path().join("media").exists());
    }
}
