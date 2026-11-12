//! The Windows side of `secure_view`: Windows Hello, the credential
//! prompt and capture protection.

use ::windows::core::{factory, HSTRING, PCWSTR, PWSTR};
use ::windows::Security::Credentials::UI::{
    UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
};
use ::windows::Win32::Foundation::{CloseHandle, ERROR_CANCELLED, ERROR_SUCCESS, HANDLE, HWND};
use ::windows::Win32::Security::Credentials::{
    CredUIParseUserNameW, CredUIPromptForWindowsCredentialsW, CredUnPackAuthenticationBufferW,
    CREDUIWIN_ENUMERATE_CURRENT_USER, CREDUI_INFOW, CRED_PACK_FLAGS,
};
use ::windows::Win32::Security::{LogonUserW, LOGON32_LOGON_INTERACTIVE, LOGON32_PROVIDER_DEFAULT};
use ::windows::Win32::System::Com::CoTaskMemFree;
use ::windows::Win32::System::WinRT::IUserConsentVerifierInterop;
use ::windows::Win32::UI::WindowsAndMessaging::{
    SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_NONE,
};
use windows_future::IAsyncOperation;

use super::super::SystemError;
use super::AuthOutcome;

fn internal(err: ::windows::core::Error) -> SystemError {
    SystemError::internal(err.to_string())
}

pub fn set_capture_protection(hwnd: isize, enabled: bool) -> Result<(), SystemError> {
    let affinity = if enabled {
        WDA_EXCLUDEFROMCAPTURE
    } else {
        WDA_NONE
    };
    unsafe { SetWindowDisplayAffinity(HWND(hwnd as *mut _), affinity) }.map_err(internal)
}

pub fn authenticate(hwnd: isize, reason: &str) -> Result<AuthOutcome, SystemError> {
    let hwnd = HWND(hwnd as *mut _);
    if hello_available() {
        hello(hwnd, reason)
    } else {
        credential_prompt(hwnd, reason)
    }
}

/// Windows Hello is set up for the signed-in user (face, fingerprint or PIN).
fn hello_available() -> bool {
    UserConsentVerifier::CheckAvailabilityAsync()
        .and_then(|op| op.join())
        .map(|a| a == UserConsentVerifierAvailability::Available)
        .unwrap_or(false)
}

/// Windows Hello, parented to the app window so the prompt shows on top.
fn hello(hwnd: HWND, reason: &str) -> Result<AuthOutcome, SystemError> {
    let interop =
        factory::<UserConsentVerifier, IUserConsentVerifierInterop>().map_err(internal)?;
    let op: IAsyncOperation<UserConsentVerificationResult> =
        unsafe { interop.RequestVerificationForWindowAsync(hwnd, &HSTRING::from(reason)) }
            .map_err(internal)?;
    Ok(match op.join().map_err(internal)? {
        UserConsentVerificationResult::Verified => AuthOutcome::Verified,
        UserConsentVerificationResult::Canceled
        | UserConsentVerificationResult::RetriesExhausted => AuthOutcome::Canceled,
        _ => AuthOutcome::Unavailable,
    })
}

/// The Windows credential prompt for the signed-in user; the password is
/// checked with a logon that is closed at once.
fn credential_prompt(hwnd: HWND, reason: &str) -> Result<AuthOutcome, SystemError> {
    let message: Vec<u16> = reason.encode_utf16().chain([0]).collect();
    let caption: Vec<u16> = "gim".encode_utf16().chain([0]).collect();
    let info = CREDUI_INFOW {
        cbSize: std::mem::size_of::<CREDUI_INFOW>() as u32,
        hwndParent: hwnd,
        pszMessageText: PCWSTR(message.as_ptr()),
        pszCaptionText: PCWSTR(caption.as_ptr()),
        ..Default::default()
    };
    let mut package = 0u32;
    let mut buffer: *mut core::ffi::c_void = std::ptr::null_mut();
    let mut size = 0u32;
    let status = unsafe {
        CredUIPromptForWindowsCredentialsW(
            Some(&info),
            0,
            &mut package,
            None,
            0,
            &mut buffer,
            &mut size,
            None,
            CREDUIWIN_ENUMERATE_CURRENT_USER,
        )
    };
    if status == ERROR_CANCELLED.0 {
        return Ok(AuthOutcome::Canceled);
    }
    if status != 0 {
        return Ok(AuthOutcome::Unavailable);
    }

    let mut user = [0u16; 514];
    let mut domain = [0u16; 338];
    let mut password = [0u16; 514];
    let mut user_len = user.len() as u32;
    let mut domain_len = domain.len() as u32;
    let mut password_len = password.len() as u32;
    let unpacked = unsafe {
        CredUnPackAuthenticationBufferW(
            CRED_PACK_FLAGS(0),
            buffer,
            size,
            Some(PWSTR(user.as_mut_ptr())),
            &mut user_len,
            Some(PWSTR(domain.as_mut_ptr())),
            Some(&mut domain_len),
            Some(PWSTR(password.as_mut_ptr())),
            &mut password_len,
        )
    };
    unsafe {
        std::ptr::write_bytes(buffer as *mut u8, 0, size as usize);
        CoTaskMemFree(Some(buffer as *const _));
    }
    let outcome = unpacked.map_err(internal).map(|()| {
        // "DOMAIN\user" or a UPN: split it for LogonUserW.
        let mut name = [0u16; 514];
        let mut realm = [0u16; 338];
        let parsed = unsafe { CredUIParseUserNameW(PCWSTR(user.as_ptr()), &mut name, &mut realm) };
        let (name, realm) = if parsed == ERROR_SUCCESS {
            (PCWSTR(name.as_ptr()), PCWSTR(realm.as_ptr()))
        } else {
            (PCWSTR(user.as_ptr()), PCWSTR(domain.as_ptr()))
        };
        let mut token = HANDLE::default();
        let logon = unsafe {
            LogonUserW(
                name,
                realm,
                PCWSTR(password.as_ptr()),
                LOGON32_LOGON_INTERACTIVE,
                LOGON32_PROVIDER_DEFAULT,
                &mut token,
            )
        };
        match logon {
            Ok(()) => {
                let _ = unsafe { CloseHandle(token) };
                AuthOutcome::Verified
            }
            Err(_) => AuthOutcome::Canceled,
        }
    });
    password.fill(0);
    outcome
}

#[cfg(test)]
mod tests {
    use super::*;

    // Headless checks for CI; the prompts and the capture exclusion are
    // checked by hand (README, "Manual checks on Windows").

    #[test]
    fn hello_availability_answers_without_a_prompt() {
        // Hosted runners have no Hello device; the call must still return.
        let _ = hello_available();
    }

    #[test]
    fn capture_protection_rejects_an_invalid_window() {
        assert!(set_capture_protection(0, true).is_err());
        assert!(set_capture_protection(0, false).is_err());
    }
}
