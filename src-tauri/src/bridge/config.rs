//! Directories and the persisted server URLs (README, "Bridge conventions"):
//! hub `GIM_WIN_SERVER_URL` > `config.json` `serverUrl` >
//! [`BUILT_IN_SERVER_URL`]; keep `GIM_WIN_KEEP_SERVER_URL` > `config.json`
//! `keepServerUrl` (`null` or `"off"` = off) > [`BUILT_IN_KEEP_SERVER_URL`].

use std::fs;
use std::net::IpAddr;
use std::path::{Path, PathBuf};

use gim_ffi::GimError;
use serde_json::{Map, Value};

/// The hub used when neither the environment nor `config.json` sets one.
pub const BUILT_IN_SERVER_URL: &str = "https://hub.g.im";
/// The keep server used when neither the environment nor `config.json`
/// sets one.
pub const BUILT_IN_KEEP_SERVER_URL: &str = "https://keep.g.im";
/// Environment variable overriding the persisted server URL.
pub const SERVER_URL_ENV: &str = "GIM_WIN_SERVER_URL";
/// Environment variable overriding the persisted keep server URL.
pub const KEEP_SERVER_URL_ENV: &str = "GIM_WIN_KEEP_SERVER_URL";
const CONFIG_FILE: &str = "config.json";
const SERVER_URL_KEY: &str = "serverUrl";
const KEEP_SERVER_URL_KEY: &str = "keepServerUrl";
/// The `keepServerUrl` string that turns the keep server off (as does `null`).
const KEEP_OFF: &str = "off";

/// The environment's URLs, read by the startup.
#[derive(Debug, Default, Clone)]
pub struct EnvUrls {
    pub server_url: Option<String>,
    pub keep_server_url: Option<String>,
}

impl EnvUrls {
    pub fn from_process_env() -> Self {
        Self {
            server_url: std::env::var(SERVER_URL_ENV).ok(),
            keep_server_url: std::env::var(KEEP_SERVER_URL_ENV).ok(),
        }
    }
}

/// Where the effective keep server URL comes from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum KeepSource {
    Env,
    Config,
    BuiltIn,
    Off,
}

#[derive(Debug, Default, Clone)]
pub struct Config {
    /// `<app data dir>/gim`: config, secure store, SDK data.
    pub app_data_dir: PathBuf,
    /// `<app_data_dir>/data`: `PlatformHooks::data_dir` of the SDK.
    pub data_dir: PathBuf,
    /// The contents of `config.json`; unknown keys are written back as read.
    file: Map<String, Value>,
    /// The URLs of the environment; each wins over the file's.
    env: EnvUrls,
}

impl Config {
    /// Creates the directories under `app_data_dir` and reads
    /// `config.json`.
    pub fn load(app_data_dir: PathBuf, env: EnvUrls) -> Result<Self, GimError> {
        let data_dir = app_data_dir.join("data");
        for dir in [&app_data_dir, &data_dir] {
            fs::create_dir_all(dir).map_err(|e| storage(dir, e))?;
        }
        let path = app_data_dir.join(CONFIG_FILE);
        let file = match fs::read(&path) {
            Ok(bytes) => parse_file(&bytes).map_err(|reason| GimError::Storage {
                reason: format!("{}: {reason}", path.display()),
            })?,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Map::new(),
            Err(e) => return Err(storage(&path, e)),
        };
        let non_empty = |url: Option<String>| url.filter(|url| !url.is_empty());
        Ok(Self {
            app_data_dir,
            data_dir,
            file,
            env: EnvUrls {
                server_url: non_empty(env.server_url),
                keep_server_url: non_empty(env.keep_server_url),
            },
        })
    }

    /// The effective server URL.
    pub fn server_url(&self) -> &str {
        self.env
            .server_url
            .as_deref()
            .or_else(|| self.file_str(SERVER_URL_KEY))
            .unwrap_or(BUILT_IN_SERVER_URL)
    }

    /// The effective keep server URL (`ClientConfig.keep_server_url`);
    /// `None` when it is off.
    pub fn keep_server_url(&self) -> Option<&str> {
        self.keep_server().0
    }

    /// The effective keep server URL and where it comes from.
    pub fn keep_server(&self) -> (Option<&str>, KeepSource) {
        if let Some(url) = &self.env.keep_server_url {
            return (Some(url), KeepSource::Env);
        }
        match self.file.get(KEEP_SERVER_URL_KEY) {
            None => (Some(BUILT_IN_KEEP_SERVER_URL), KeepSource::BuiltIn),
            Some(Value::String(url)) if url != KEEP_OFF => (Some(url), KeepSource::Config),
            // `null` or "off"; `parse_file` rejects other values.
            Some(_) => (None, KeepSource::Off),
        }
    }

    /// Validates `url` and writes it to `config.json`.
    pub fn set_server_url(&mut self, url: &str) -> Result<(), GimError> {
        validate_server_url(url)?;
        self.write(|file| {
            file.insert(SERVER_URL_KEY.into(), url.into());
        })
    }

    /// Validates `url` and writes it to `config.json` as the custom keep
    /// server.
    pub fn set_keep_server_url(&mut self, url: &str) -> Result<(), GimError> {
        validate_keep_server_url(url)?;
        self.write(|file| {
            file.insert(KEEP_SERVER_URL_KEY.into(), url.into());
        })
    }

    /// Removes the keep server from `config.json`: the built-in one applies.
    pub fn reset_keep_server(&mut self) -> Result<(), GimError> {
        self.write(|file| {
            file.remove(KEEP_SERVER_URL_KEY);
        })
    }

    /// Writes "off" to `config.json`: no keep server.
    pub fn disable_keep_server(&mut self) -> Result<(), GimError> {
        self.write(|file| {
            file.insert(KEEP_SERVER_URL_KEY.into(), KEEP_OFF.into());
        })
    }

    fn file_str(&self, key: &str) -> Option<&str> {
        self.file
            .get(key)
            .and_then(Value::as_str)
            .filter(|url| !url.is_empty())
    }

    /// Writes the edited file, then keeps it; on an error nothing changes.
    fn write(&mut self, edit: impl FnOnce(&mut Map<String, Value>)) -> Result<(), GimError> {
        let mut file = self.file.clone();
        edit(&mut file);
        let path = self.app_data_dir.join(CONFIG_FILE);
        let json = serde_json::to_vec_pretty(&file).map_err(|e| GimError::Storage {
            reason: e.to_string(),
        })?;
        fs::write(&path, json).map_err(|e| storage(&path, e))?;
        self.file = file;
        Ok(())
    }
}

/// A JSON object whose `serverUrl` is a string and whose `keepServerUrl` is
/// a string or `null`, if present.
fn parse_file(bytes: &[u8]) -> Result<Map<String, Value>, String> {
    let Value::Object(file) = serde_json::from_slice(bytes).map_err(|e| e.to_string())? else {
        return Err("not a JSON object".to_string());
    };
    if file.get(SERVER_URL_KEY).is_some_and(|v| !v.is_string()) {
        return Err(format!("{SERVER_URL_KEY} must be a string"));
    }
    if file
        .get(KEEP_SERVER_URL_KEY)
        .is_some_and(|v| !v.is_string() && !v.is_null())
    {
        return Err(format!("{KEEP_SERVER_URL_KEY} must be a string or null"));
    }
    Ok(file)
}

/// `InvalidInput` unless `url` passes [`is_allowed_url`].
pub fn validate_server_url(url: &str) -> Result<(), GimError> {
    validate_url("server url", url)
}

/// `InvalidInput` unless `url` passes [`is_allowed_url`].
pub fn validate_keep_server_url(url: &str) -> Result<(), GimError> {
    validate_url("keep server url", url)
}

fn validate_url(what: &str, url: &str) -> Result<(), GimError> {
    if is_allowed_url(url) {
        Ok(())
    } else {
        Err(GimError::InvalidInput {
            reason: format!("{what} must be https, or http to a local host: {url:?}"),
        })
    }
}

/// `https://` with a host, or `http://` to a local host: localhost, a
/// loopback, private or link-local IP, `*.local`, `*.lan` or a single label
/// without a dot (dev containers).
pub fn is_allowed_url(url: &str) -> bool {
    let (https, rest) = match (url.strip_prefix("https://"), url.strip_prefix("http://")) {
        (Some(rest), _) => (true, rest),
        (None, Some(rest)) => (false, rest),
        (None, None) => return false,
    };
    // `Url` would read `https:///x` as the host `x`.
    if rest.starts_with('/') || url.chars().any(char::is_whitespace) {
        return false;
    }
    let Ok(parsed) = url::Url::parse(url) else {
        return false;
    };
    match parsed.host() {
        None => false,
        Some(_) if https => true,
        Some(url::Host::Ipv4(ip)) => is_local_ip(IpAddr::V4(ip)),
        Some(url::Host::Ipv6(ip)) => is_local_ip(IpAddr::V6(ip)),
        Some(url::Host::Domain(host)) => {
            host == "localhost"
                || host.ends_with(".local")
                || host.ends_with(".lan")
                || !host.contains('.')
        }
    }
}

fn is_local_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => ip.is_loopback() || ip.is_private() || ip.is_link_local(),
        IpAddr::V6(ip) => {
            let first = ip.segments()[0];
            ip.is_loopback() || first & 0xfe00 == 0xfc00 || first & 0xffc0 == 0xfe80
        }
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

    fn load_with(file: Option<&str>, env: EnvUrls) -> (tempfile::TempDir, Config) {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("gim");
        fs::create_dir_all(&root).unwrap();
        if let Some(file) = file {
            fs::write(root.join(CONFIG_FILE), file).unwrap();
        }
        let config = Config::load(root, env).unwrap();
        (dir, config)
    }

    fn read_file(config: &Config) -> Value {
        serde_json::from_slice(&fs::read(config.app_data_dir.join(CONFIG_FILE)).unwrap()).unwrap()
    }

    fn keep_env(url: &str) -> EnvUrls {
        EnvUrls {
            server_url: None,
            keep_server_url: Some(url.into()),
        }
    }

    #[test]
    fn defaults_when_env_and_file_are_unset() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("gim");
        let config = Config::load(root.clone(), EnvUrls::default()).unwrap();
        assert!(root.join("data").is_dir());
        assert_eq!(config.server_url(), BUILT_IN_SERVER_URL);
        assert_eq!(BUILT_IN_SERVER_URL, "https://hub.g.im");
        assert_eq!(
            config.keep_server(),
            (Some(BUILT_IN_KEEP_SERVER_URL), KeepSource::BuiltIn)
        );
        assert_eq!(BUILT_IN_KEEP_SERVER_URL, "https://keep.g.im");
        let (_dir, empty) = load_with(Some("{}"), EnvUrls::default());
        assert_eq!(empty.server_url(), BUILT_IN_SERVER_URL);
        assert_eq!(empty.keep_server_url(), Some(BUILT_IN_KEEP_SERVER_URL));
    }

    #[test]
    fn hub_precedence_env_file_built_in() {
        let file = r#"{"serverUrl":"https://file.example.org"}"#;
        let (_dir, from_file) = load_with(Some(file), EnvUrls::default());
        assert_eq!(from_file.server_url(), "https://file.example.org");
        let empty = EnvUrls {
            server_url: Some(String::new()),
            keep_server_url: None,
        };
        let (_dir, empty_env) = load_with(Some(file), empty);
        assert_eq!(empty_env.server_url(), "https://file.example.org");
        let env = EnvUrls {
            server_url: Some("http://localhost:8080".into()),
            keep_server_url: None,
        };
        let (_dir, from_env) = load_with(Some(file), env);
        assert_eq!(from_env.server_url(), "http://localhost:8080");
    }

    #[test]
    fn keep_precedence_env_file_built_in() {
        let file = r#"{"keepServerUrl":"https://keep.example.org"}"#;
        let (_dir, from_file) = load_with(Some(file), EnvUrls::default());
        assert_eq!(
            from_file.keep_server(),
            (Some("https://keep.example.org"), KeepSource::Config)
        );
        let (_dir, empty_env) = load_with(Some(file), keep_env(""));
        assert_eq!(empty_env.keep_server().1, KeepSource::Config);
        let (_dir, from_env) = load_with(Some(file), keep_env("http://keep-dev"));
        assert_eq!(
            from_env.keep_server(),
            (Some("http://keep-dev"), KeepSource::Env)
        );
    }

    #[test]
    fn keep_off_via_null_and_off_and_env_still_wins() {
        for file in [r#"{"keepServerUrl":null}"#, r#"{"keepServerUrl":"off"}"#] {
            let (_dir, off) = load_with(Some(file), EnvUrls::default());
            assert_eq!(off.keep_server(), (None, KeepSource::Off), "{file}");
            assert_eq!(off.keep_server_url(), None);
            let (_dir, env) = load_with(Some(file), keep_env("https://keep.example.org"));
            assert_eq!(
                env.keep_server(),
                (Some("https://keep.example.org"), KeepSource::Env),
                "{file}"
            );
        }
    }

    #[test]
    fn keep_set_reset_disable_round_trip_preserving_server_url() {
        let file = r#"{"serverUrl":"https://hub.example.org","other":1}"#;
        let (_dir, mut config) = load_with(Some(file), EnvUrls::default());
        let reload = |config: &Config| {
            Config::load(config.app_data_dir.clone(), EnvUrls::default()).unwrap()
        };

        config
            .set_keep_server_url("https://keep.example.org")
            .unwrap();
        assert_eq!(
            config.keep_server(),
            (Some("https://keep.example.org"), KeepSource::Config)
        );
        let written = read_file(&config);
        assert_eq!(written["serverUrl"], "https://hub.example.org");
        assert_eq!(written["keepServerUrl"], "https://keep.example.org");
        assert_eq!(written["other"], 1);
        assert_eq!(reload(&config).keep_server().1, KeepSource::Config);

        config.disable_keep_server().unwrap();
        assert_eq!(config.keep_server(), (None, KeepSource::Off));
        assert_eq!(read_file(&config)["keepServerUrl"], "off");
        assert_eq!(reload(&config).keep_server(), (None, KeepSource::Off));

        config.reset_keep_server().unwrap();
        assert_eq!(config.keep_server().1, KeepSource::BuiltIn);
        let written = read_file(&config);
        assert!(written.get("keepServerUrl").is_none());
        assert_eq!(written["serverUrl"], "https://hub.example.org");
        assert_eq!(reload(&config).keep_server().1, KeepSource::BuiltIn);
        assert_eq!(reload(&config).server_url(), "https://hub.example.org");

        let err = config
            .set_keep_server_url("http://keep.example.org")
            .unwrap_err();
        assert!(matches!(err, GimError::InvalidInput { .. }));
        assert_eq!(config.keep_server().1, KeepSource::BuiltIn);
    }

    #[test]
    fn keep_writes_still_store_under_env() {
        let (_dir, mut config) = load_with(None, keep_env("http://localhost:9"));
        config.disable_keep_server().unwrap();
        assert_eq!(read_file(&config)["keepServerUrl"], "off");
        assert_eq!(
            config.keep_server(),
            (Some("http://localhost:9"), KeepSource::Env)
        );
    }

    #[test]
    fn set_server_url_writes_the_file() {
        let file = r#"{"keepServerUrl":null}"#;
        let (_dir, mut config) = load_with(Some(file), EnvUrls::default());
        config.set_server_url("https://hub.example.org/").unwrap();
        assert_eq!(config.server_url(), "https://hub.example.org/");
        let written = read_file(&config);
        assert_eq!(written["serverUrl"], "https://hub.example.org/");
        assert!(written["keepServerUrl"].is_null());
        let reloaded = Config::load(config.app_data_dir.clone(), EnvUrls::default()).unwrap();
        assert_eq!(reloaded.server_url(), "https://hub.example.org/");
        assert_eq!(reloaded.keep_server().1, KeepSource::Off);

        let err = config.set_server_url("ftp://hub.example.org").unwrap_err();
        assert!(matches!(err, GimError::InvalidInput { .. }));
        // The file keeps the last valid URL.
        assert_eq!(config.server_url(), "https://hub.example.org/");
    }

    #[test]
    fn env_wins_over_set_server_url() {
        let env = EnvUrls {
            server_url: Some("http://localhost".into()),
            keep_server_url: None,
        };
        let (_dir, mut config) = load_with(None, env);
        config.set_server_url("https://hub.example.org").unwrap();
        assert_eq!(config.server_url(), "http://localhost");
    }

    #[test]
    fn url_rule() {
        for ok in [
            "https://hub.example.org",
            "https://hub.example.org/base?x#y",
            "https://user:pw@hub.example.org:1/",
            "https://203.0.113.5",
            "http://localhost:3000",
            "http://127.0.0.1:8080",
            "http://10.1.2.3",
            "http://172.16.0.1",
            "http://172.31.255.255",
            "http://192.168.1.20:3000/",
            "http://169.254.1.1",
            "http://[::1]:8080",
            "http://[fd12::1]",
            "http://[fe80::1]",
            "http://hub.local",
            "http://nas.lan:8080",
            "http://ai-agent-gim-hub-win:3000",
        ] {
            assert!(validate_server_url(ok).is_ok(), "{ok}");
            assert!(validate_keep_server_url(ok).is_ok(), "{ok}");
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
            "http://hub.example.org",
            "http://203.0.113.5",
            "http://172.32.0.1",
            "http://[2001:db8::1]",
            "http://local.example.org",
        ] {
            assert!(validate_server_url(bad).is_err(), "{bad}");
            assert!(validate_keep_server_url(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn malformed_config_is_a_storage_error() {
        for file in [
            "nope",
            "[]",
            r#"{"serverUrl":1}"#,
            r#"{"keepServerUrl":false}"#,
        ] {
            let dir = tempfile::tempdir().unwrap();
            fs::write(dir.path().join(CONFIG_FILE), file).unwrap();
            let err = Config::load(dir.path().to_path_buf(), EnvUrls::default()).unwrap_err();
            assert!(matches!(err, GimError::Storage { .. }), "{file}");
        }
    }
}
