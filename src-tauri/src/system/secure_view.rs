//! Showing a secret (the recovery key): device authentication first, then
//! the window is kept out of screenshots and screen capture while it shows.
//!
//! - Windows: Windows Hello (`UserConsentVerifier`, face, fingerprint or
//!   PIN) when it is set up; otherwise the Windows credential prompt for the
//!   signed-in user, whose password is checked with `LogonUserW`. Capture
//!   protection is `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`.
//! - Elsewhere (the Linux gate and dev machines) there is no device
//!   authentication: debug builds pass, release builds report
//!   `Unavailable` so the secret is never shown without a check. Capture
//!   protection is a no-op there.

use serde::Serialize;

use super::SystemError;

/// The result of `authenticate_device`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum AuthOutcome {
    Verified,
    /// Canceled, or the check failed (wrong password, too many tries).
    /// Only the Windows side reports it.
    #[cfg_attr(not(windows), allow(dead_code))]
    Canceled,
    /// The device has no way to authenticate the user.
    Unavailable,
}

/// Asks the user to prove they own this device; `reason` is shown in the
/// system prompt.
#[tauri::command]
pub async fn authenticate_device(
    window: tauri::WebviewWindow,
    reason: String,
) -> Result<AuthOutcome, SystemError> {
    #[cfg(windows)]
    {
        // HWND is not Send; the raw value crosses to the blocking thread.
        let hwnd = window.hwnd()?.0 as isize;
        tauri::async_runtime::spawn_blocking(move || windows::authenticate(hwnd, &reason))
            .await
            .map_err(|e| SystemError::internal(e.to_string()))?
    }
    #[cfg(not(windows))]
    {
        let _ = (window, reason);
        Ok(without_device_auth(cfg!(debug_assertions)))
    }
}

/// Platforms without device authentication: only dev builds pass.
#[cfg_attr(windows, allow(dead_code))]
fn without_device_auth(dev_build: bool) -> AuthOutcome {
    if dev_build {
        tracing::warn!("device authentication skipped: dev build without a platform check");
        AuthOutcome::Verified
    } else {
        AuthOutcome::Unavailable
    }
}

/// Keeps the window out of screenshots and screen capture while `enabled`.
#[tauri::command]
pub fn set_capture_protection(
    window: tauri::WebviewWindow,
    enabled: bool,
) -> Result<(), SystemError> {
    #[cfg(windows)]
    {
        windows::set_capture_protection(window.hwnd()?.0 as isize, enabled)
    }
    #[cfg(not(windows))]
    {
        let _ = (window, enabled);
        Ok(())
    }
}

#[cfg(windows)]
mod windows;

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, to_value};

    #[test]
    fn only_dev_builds_pass_without_device_auth() {
        assert_eq!(without_device_auth(true), AuthOutcome::Verified);
        assert_eq!(without_device_auth(false), AuthOutcome::Unavailable);
    }

    #[test]
    fn outcome_serialises_as_its_name() {
        assert_eq!(to_value(AuthOutcome::Canceled).unwrap(), json!("Canceled"));
    }
}
