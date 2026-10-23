//! The recovery kit commands (API.md "Recovery kit") and the desktop save
//! dialog: thin Tauri commands over `gim_ffi`'s recovery kit helpers and
//! `tauri_plugin_dialog`.

use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::DialogExt;

use crate::bridge::error::BridgeError;

/// The app's localized words of the kit text.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryKitLabels {
    pub title: String,
    pub account_id: String,
    pub recovery_key: String,
    pub note: String,
}

impl From<RecoveryKitLabels> for gim_ffi::RecoveryKitLabels {
    fn from(labels: RecoveryKitLabels) -> Self {
        Self {
            title: labels.title,
            account_id: labels.account_id,
            recovery_key: labels.recovery_key,
            note: labels.note,
        }
    }
}

/// What `parse_recovery_kit` found: the user id and the recovery code
/// (39 symbols, no separators), each if present.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedRecoveryKit {
    pub user_id: Option<String>,
    pub recovery_code: Option<String>,
}

impl From<gim_ffi::ParsedRecoveryKit> for ParsedRecoveryKit {
    fn from(parsed: gim_ffi::ParsedRecoveryKit) -> Self {
        Self {
            user_id: parsed.user_id,
            recovery_code: parsed.recovery_code,
        }
    }
}

/// The kit text: title, `"<accountId>: <user id>"`,
/// `"<recoveryKey>: <code grouped by four>"`, a blank line and the note.
#[tauri::command]
pub fn format_recovery_kit(
    user_id: String,
    recovery_code: String,
    labels: RecoveryKitLabels,
) -> String {
    gim_ffi::format_recovery_kit(user_id, recovery_code, labels.into())
}

/// Finds the user id and the recovery code in pasted text, whatever the
/// labels' language.
#[tauri::command]
pub fn parse_recovery_kit(text: String) -> ParsedRecoveryKit {
    gim_ffi::parse_recovery_kit(text).into()
}

/// The last four symbols of the recovery code.
#[tauri::command]
pub fn recovery_key_ending(recovery_code: String) -> String {
    gim_ffi::recovery_key_ending(recovery_code)
}

/// `typed` is the code's last four symbols (case, `-` and spaces ignored).
#[tauri::command]
pub fn matches_recovery_key_ending(recovery_code: String, typed: String) -> bool {
    gim_ffi::matches_recovery_key_ending(recovery_code, typed)
}

/// Opens the native save dialog and writes `contents` to the chosen file;
/// `None` when the user cancelled.
#[tauri::command]
pub async fn save_text_file(
    app: tauri::AppHandle,
    default_name: String,
    contents: String,
) -> Result<Option<String>, BridgeError> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("Text", &["txt"])
        .save_file(move |path| {
            let _ = tx.send(path);
        });
    let Some(chosen) = rx
        .await
        .map_err(|_| BridgeError::internal("save dialog closed without an answer"))?
    else {
        return Ok(None);
    };
    let path = chosen
        .into_path()
        .map_err(|err| BridgeError::invalid_input(format!("save dialog path: {err}")))?;
    std::fs::write(&path, contents).map_err(|err| {
        BridgeError(gim_ffi::GimError::Storage {
            reason: format!("write {}: {err}", path.display()),
        })
    })?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;

    const CODE: &str = "7BQ2-K9MX-4TVA-0HZR-PC63-W8NE-1SJD-5GFY-QK2M-V7R";

    fn user_id() -> String {
        let alphabet = "abcdefghijklmnopqrstuvwxyz234567".repeat(2);
        format!("u{}q", &alphabet[..54])
    }

    fn symbols() -> String {
        CODE.replace('-', "")
    }

    fn labels(title: &str, account_id: &str, recovery_key: &str, note: &str) -> RecoveryKitLabels {
        RecoveryKitLabels {
            title: title.into(),
            account_id: account_id.into(),
            recovery_key: recovery_key.into(),
            note: note.into(),
        }
    }

    fn en() -> RecoveryKitLabels {
        labels(
            "gim recovery kit",
            "Account ID",
            "Recovery key",
            "Keep this secret. Anyone who has it can get into your account. Lost all your devices? Open gim, choose “Restore with your recovery kit” and paste this text.",
        )
    }

    fn zh_cn() -> RecoveryKitLabels {
        labels(
            "gim 恢复工具包",
            "账号 ID",
            "恢复密钥",
            "请保密。任何拿到它的人都能进入你的账号。所有设备都丢了？打开 gim，选择“用恢复工具包恢复”，然后粘贴这段文字。",
        )
    }

    fn zh_tw() -> RecoveryKitLabels {
        labels(
            "gim 復原工具包",
            "帳號 ID",
            "復原金鑰",
            "請保密。任何拿到它的人都能進入你的帳號。所有裝置都遺失了？打開 gim，選擇「用復原工具包復原」，然後貼上這段文字。",
        )
    }

    fn es() -> RecoveryKitLabels {
        labels(
            "Kit de recuperación de gim",
            "ID de cuenta",
            "Clave de recuperación",
            "Mantenlo en secreto. Cualquiera que lo tenga puede entrar en tu cuenta. ¿Perdiste todos tus dispositivos? Abre gim, elige “Restaurar con tu kit de recuperación” y pega este texto.",
        )
    }

    fn full() -> ParsedRecoveryKit {
        ParsedRecoveryKit {
            user_id: Some(user_id()),
            recovery_code: Some(symbols()),
        }
    }

    fn en_kit() -> String {
        format_recovery_kit(user_id(), CODE.into(), en())
    }

    #[test]
    fn renders_and_parses_every_language() {
        for labels in [en(), zh_cn(), zh_tw(), es()] {
            let expected_text = format!(
                "{}\n{}: {}\n{}: {}\n\n{}\n",
                labels.title,
                labels.account_id,
                user_id(),
                labels.recovery_key,
                CODE,
                labels.note
            );
            let text = format_recovery_kit(user_id(), CODE.into(), labels);
            assert_eq!(text, expected_text);
            assert_eq!(symbols().chars().count(), 39);
            assert_eq!(parse_recovery_kit(text), full());
        }
    }

    #[test]
    fn parses_hand_copied_variants() {
        let kit = en_kit();
        assert_eq!(parse_recovery_kit(kit.to_lowercase()), full());
        assert_eq!(parse_recovery_kit(kit.replace('-', " ")), full());
        assert_eq!(parse_recovery_kit(kit.replace('-', "")), full());
        assert_eq!(
            parse_recovery_kit(format!(
                "Hi Roy,\n\nhere is my kit, keep it safe:\n\n{kit}\nThanks,\nRoy\n"
            )),
            full()
        );
    }

    #[test]
    fn parses_nothing_from_unrelated_text() {
        assert_eq!(
            parse_recovery_kit("just an email".into()),
            ParsedRecoveryKit {
                user_id: None,
                recovery_code: None
            }
        );
    }

    #[test]
    fn ending_checks() {
        assert_eq!(recovery_key_ending(CODE.into()), "MV7R");
        assert_eq!(recovery_key_ending(symbols()), "MV7R");
        for typed in ["mv7r", " MV-7R", "MV7R", "m v 7 r"] {
            assert!(
                matches_recovery_key_ending(CODE.into(), typed.into()),
                "{typed:?}"
            );
        }
        assert!(!matches_recovery_key_ending(CODE.into(), "abcd".into()));
        assert!(!matches_recovery_key_ending(CODE.into(), "v7r".into()));
    }
}
