//! The app settings file: `<appDataDir>/gim/settings.json`, loaded once at
//! setup into `SystemState` and rewritten atomically by `settings_save`.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use super::tray::{build_tray, remove_tray};
use super::{SystemError, SystemState};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub notifications: NotificationSettings,
    #[serde(default)]
    pub font_size: FontSize,
    #[serde(default = "default_true")]
    pub tray_enabled: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            notifications: NotificationSettings::default(),
            font_size: FontSize::default(),
            tray_enabled: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct NotificationSettings {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_true")]
    pub sound: bool,
    #[serde(default = "default_true")]
    pub show_text: bool,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            sound: true,
            show_text: true,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FontSize {
    Small,
    #[default]
    Normal,
    Large,
    ExtraLarge,
}

fn default_true() -> bool {
    true
}

/// `<appDataDir>/gim/settings.json`.
fn settings_path(app: &AppHandle) -> Result<PathBuf, SystemError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| SystemError::storage(format!("app data dir: {e}")))?;
    Ok(dir.join("gim").join("settings.json"))
}

/// Reads `path`; a missing or unparsable file logs at warn and yields the
/// defaults.
pub fn load_from(path: &Path) -> AppSettings {
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return AppSettings::default(),
        Err(err) => {
            tracing::warn!("settings: read {}: {err}", path.display());
            return AppSettings::default();
        }
    };
    serde_json::from_str(&text).unwrap_or_else(|err| {
        tracing::warn!("settings: parse {}: {err}", path.display());
        AppSettings::default()
    })
}

/// Writes `settings` as pretty JSON to `path` atomically: the parent
/// directory is created, `settings.json.tmp` is written, then renamed.
pub fn save_to(path: &Path, settings: &AppSettings) -> Result<(), SystemError> {
    let storage = |what: &str, err: std::io::Error| {
        SystemError::storage(format!("settings: {what} {}: {err}", path.display()))
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| storage("create dir for", e))?;
    }
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| SystemError::internal(format!("settings: serialise: {e}")))?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| storage("write", e))?;
    fs::rename(&tmp, path).map_err(|e| storage("rename", e))
}

/// Loads the settings of this app (the file may be missing).
pub fn load(app: &AppHandle) -> AppSettings {
    match settings_path(app) {
        Ok(path) => load_from(&path),
        Err(err) => {
            tracing::warn!("{err}");
            AppSettings::default()
        }
    }
}

#[tauri::command]
pub fn settings_load(app: AppHandle) -> Result<AppSettings, SystemError> {
    Ok(load(&app))
}

#[tauri::command]
pub fn settings_save(
    app: AppHandle,
    state: State<'_, SystemState>,
    settings: AppSettings,
) -> Result<(), SystemError> {
    save_to(&settings_path(&app)?, &settings)?;
    let tray_was_enabled = std::mem::replace(&mut *state.settings(), settings.clone()).tray_enabled;
    if tray_was_enabled != settings.tray_enabled {
        if settings.tray_enabled {
            build_tray(&app)?;
        } else {
            remove_tray(&app);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn defaults_when_the_file_is_missing() {
        let dir = tempfile::tempdir().unwrap();
        let settings = load_from(&dir.path().join("settings.json"));
        assert_eq!(settings, AppSettings::default());
        assert!(settings.tray_enabled);
        assert!(settings.notifications.enabled);
        assert!(settings.notifications.sound);
        assert!(settings.notifications.show_text);
        assert_eq!(settings.font_size, FontSize::Normal);
    }

    #[test]
    fn round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("gim").join("settings.json");
        let settings = AppSettings {
            notifications: NotificationSettings {
                enabled: false,
                sound: false,
                show_text: true,
            },
            font_size: FontSize::ExtraLarge,
            tray_enabled: false,
        };
        save_to(&path, &settings).unwrap();
        assert!(!path.with_extension("json.tmp").exists());
        assert_eq!(load_from(&path), settings);
        let value: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(
            value,
            json!({
                "notifications": {"enabled": false, "sound": false, "showText": true},
                "fontSize": "extraLarge",
                "trayEnabled": false
            })
        );
    }

    #[test]
    fn partial_file_keeps_the_other_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        fs::write(&path, r#"{"trayEnabled":false,"unknown":1}"#).unwrap();
        let settings = load_from(&path);
        assert!(!settings.tray_enabled);
        assert_eq!(settings.notifications, NotificationSettings::default());
        assert_eq!(settings.font_size, FontSize::Normal);
    }

    #[test]
    fn partial_nested_object_keeps_the_other_defaults() {
        let settings: AppSettings =
            serde_json::from_str(r#"{"notifications":{"sound":false}}"#).unwrap();
        assert!(settings.notifications.enabled);
        assert!(!settings.notifications.sound);
        assert!(settings.notifications.show_text);
    }

    #[test]
    fn unparsable_file_yields_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        fs::write(&path, "{not json").unwrap();
        assert_eq!(load_from(&path), AppSettings::default());
    }
}
