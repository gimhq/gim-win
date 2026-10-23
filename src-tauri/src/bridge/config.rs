//! Directories and the persisted server URL (README, "Bridge conventions":
//! env `GIM_WIN_SERVER_URL` > `<appDataDir>/config.json` > unset).

use std::fs;
use std::path::{Path, PathBuf};

use gim_ffi::GimError;
use serde::{Deserialize, Serialize};

/// Environment variable overriding the persisted server URL.
pub const SERVER_URL_ENV: &str = "GIM_WIN_SERVER_URL";
const CONFIG_FILE: &str = "config.json";

/// Contents of `config.json`.
#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfigFile {
    server_url: Option<String>,
}

#[derive(Debug, Default, Clone)]
pub struct Config {
    /// `<app data dir>/gim`: config, secure store, SDK data.
    pub app_data_dir: PathBuf,
    /// `<app_data_dir>/data`: `PlatformHooks::data_dir` of the SDK.
    pub data_dir: PathBuf,
    /// The URL of `config.json`, if any.
    file_server_url: Option<String>,
    /// The URL of the environment, if set; wins over the file.
    env_server_url: Option<String>,
}

impl Config {
    /// Creates the directories under `app_data_dir` and reads
    /// `config.json`. `env_server_url` is the value of [`SERVER_URL_ENV`].
    pub fn load(app_data_dir: PathBuf, env_server_url: Option<String>) -> Result<Self, GimError> {
        let data_dir = app_data_dir.join("data");
        for dir in [&app_data_dir, &data_dir] {
            fs::create_dir_all(dir).map_err(|e| storage(dir, e))?;
        }
        let path = app_data_dir.join(CONFIG_FILE);
        let file_server_url = match fs::read(&path) {
            Ok(bytes) => {
                let file: ConfigFile =
                    serde_json::from_slice(&bytes).map_err(|e| GimError::Storage {
                        reason: format!("{}: {e}", path.display()),
                    })?;
                file.server_url
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
            Err(e) => return Err(storage(&path, e)),
        };
        Ok(Self {
            app_data_dir,
            data_dir,
            file_server_url,
            env_server_url: env_server_url.filter(|url| !url.is_empty()),
        })
    }

    /// The effective server URL.
    pub fn server_url(&self) -> Option<&str> {
        self.env_server_url
            .as_deref()
            .or(self.file_server_url.as_deref())
    }

    /// Validates `url` and writes it to `config.json`.
    pub fn set_server_url(&mut self, url: &str) -> Result<(), GimError> {
        validate_server_url(url)?;
        let path = self.app_data_dir.join(CONFIG_FILE);
        let file = ConfigFile {
            server_url: Some(url.to_string()),
        };
        let json = serde_json::to_vec_pretty(&file).map_err(|e| GimError::Storage {
            reason: e.to_string(),
        })?;
        fs::write(&path, json).map_err(|e| storage(&path, e))?;
        self.file_server_url = Some(url.to_string());
        Ok(())
    }
}

/// `InvalidInput` unless `url` is `http://` or `https://` with a host.
pub fn validate_server_url(url: &str) -> Result<(), GimError> {
    let rest = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"));
    let host = rest
        .map(|rest| rest.split(['/', '?', '#']).next().unwrap_or(""))
        .map(|authority| authority.rsplit('@').next().unwrap_or(""))
        .map(|host_port| host_port.rsplit_once(':').map_or(host_port, |(h, _)| h));
    match host {
        Some(host) if !host.is_empty() && !host.chars().any(char::is_whitespace) => Ok(()),
        _ => Err(GimError::InvalidInput {
            reason: format!("server url must be http(s) with a host: {url:?}"),
        }),
    }
}

fn storage(path: &Path, err: std::io::Error) -> GimError {
    GimError::Storage {
        reason: format!("{}: {err}", path.display()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn precedence_env_file_unset() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("gim");
        let unset = Config::load(root.clone(), None).unwrap();
        assert_eq!(unset.server_url(), None);
        assert!(root.join("data").is_dir());

        fs::write(
            root.join(CONFIG_FILE),
            r#"{"serverUrl":"https://file.example.org"}"#,
        )
        .unwrap();
        let from_file = Config::load(root.clone(), None).unwrap();
        assert_eq!(from_file.server_url(), Some("https://file.example.org"));
        let empty_env = Config::load(root.clone(), Some(String::new())).unwrap();
        assert_eq!(empty_env.server_url(), Some("https://file.example.org"));

        let from_env = Config::load(root, Some("http://env.example.org:8080".into())).unwrap();
        assert_eq!(from_env.server_url(), Some("http://env.example.org:8080"));
    }

    #[test]
    fn set_server_url_writes_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("gim");
        let mut config = Config::load(root.clone(), None).unwrap();
        config.set_server_url("https://hub.example.org/").unwrap();
        assert_eq!(config.server_url(), Some("https://hub.example.org/"));
        let written: serde_json::Value =
            serde_json::from_slice(&fs::read(root.join(CONFIG_FILE)).unwrap()).unwrap();
        assert_eq!(written["serverUrl"], "https://hub.example.org/");
        let reloaded = Config::load(root, None).unwrap();
        assert_eq!(reloaded.server_url(), Some("https://hub.example.org/"));

        let err = config.set_server_url("ftp://hub.example.org").unwrap_err();
        assert!(matches!(err, GimError::InvalidInput { .. }));
        // The file keeps the last valid URL.
        assert_eq!(config.server_url(), Some("https://hub.example.org/"));
    }

    #[test]
    fn env_wins_over_set_server_url() {
        let dir = tempfile::tempdir().unwrap();
        let mut config = Config::load(
            dir.path().to_path_buf(),
            Some("http://env.example.org".into()),
        )
        .unwrap();
        config.set_server_url("https://hub.example.org").unwrap();
        assert_eq!(config.server_url(), Some("http://env.example.org"));
    }

    #[test]
    fn url_validation() {
        for ok in [
            "http://localhost:3000",
            "https://hub.example.org",
            "https://hub.example.org/base?x#y",
            "http://user:pw@hub.example.org:1/",
        ] {
            assert!(validate_server_url(ok).is_ok(), "{ok}");
        }
        for bad in [
            "",
            "hub.example.org",
            "ftp://hub.example.org",
            "http://",
            "https:///path",
            "http://:8080",
            "http://a b",
            "file:///tmp/x",
        ] {
            assert!(validate_server_url(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn malformed_config_is_a_storage_error() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(CONFIG_FILE), "nope").unwrap();
        let err = Config::load(dir.path().to_path_buf(), None).unwrap_err();
        assert!(matches!(err, GimError::Storage { .. }));
    }
}
