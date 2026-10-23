//! Client-side link previews: the app fetches the page itself (the hub is
//! never contacted) and reads its Open Graph / Twitter / HTML metadata.

use std::collections::{HashMap, VecDeque};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use reqwest::dns::{Addrs, Name, Resolve, Resolving};
use reqwest::header::{ACCEPT, CONTENT_TYPE, USER_AGENT};
use reqwest::redirect;
use scraper::{Html, Selector};
use serde::Serialize;
use url::{Host, Url};

use crate::bridge::error::BridgeError;

const TIMEOUT: Duration = Duration::from_secs(5);
const MAX_REDIRECTS: usize = 5;
const MAX_BODY: usize = 1024 * 1024;
const MAX_TITLE: usize = 200;
const MAX_DESCRIPTION: usize = 500;
const CACHE_CAPACITY: usize = 256;
const BROWSER_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) \
    AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/// The preview of a link, as shown under a message.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkPreview {
    pub url: String,
    pub final_url: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub site_name: Option<String>,
}

/// The metadata read from one HTML document.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ParsedPreview {
    pub title: Option<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub site_name: Option<String>,
}

/// Reads the preview metadata of `html`; relative image URLs are resolved
/// against `base`.
pub fn parse_html(base: &Url, html: &str) -> ParsedPreview {
    let doc = Html::parse_document(html);
    let meta_selector = Selector::parse("meta").expect("valid selector");
    let title_selector = Selector::parse("title").expect("valid selector");

    // First non-empty content per `property` / `name` key.
    let mut meta: HashMap<String, String> = HashMap::new();
    for el in doc.select(&meta_selector) {
        let Some(content) = el.value().attr("content").and_then(clean) else {
            continue;
        };
        for attr in ["property", "name"] {
            if let Some(key) = el.value().attr(attr) {
                meta.entry(key.trim().to_ascii_lowercase())
                    .or_insert_with(|| content.clone());
            }
        }
    }
    let get = |keys: &[&str]| keys.iter().find_map(|k| meta.get(*k).cloned());

    let html_title = doc
        .select(&title_selector)
        .next()
        .and_then(|el| clean(&el.text().collect::<String>()));
    let title = get(&["og:title"])
        .or_else(|| get(&["twitter:title"]))
        .or(html_title)
        .map(|t| truncate(&t, MAX_TITLE));
    let description = get(&["og:description"])
        .or_else(|| get(&["description"]))
        .or_else(|| get(&["twitter:description"]))
        .map(|d| truncate(&d, MAX_DESCRIPTION));
    let image_url = get(&["og:image", "og:image:url", "og:image:secure_url"])
        .and_then(|i| resolve_image(base, &i))
        .or_else(|| {
            get(&["twitter:image", "twitter:image:src"]).and_then(|i| resolve_image(base, &i))
        });
    let site_name = get(&["og:site_name"]).or_else(|| base.host_str().map(str::to_string));

    ParsedPreview {
        title,
        description,
        image_url,
        site_name,
    }
}

/// Collapses whitespace; `None` if nothing is left.
fn clean(s: &str) -> Option<String> {
    let s = s.split_whitespace().collect::<Vec<_>>().join(" ");
    (!s.is_empty()).then_some(s)
}

fn truncate(s: &str, max_chars: usize) -> String {
    s.chars().take(max_chars).collect()
}

fn resolve_image(base: &Url, raw: &str) -> Option<String> {
    let url = base.join(raw).ok()?;
    matches!(url.scheme(), "http" | "https").then(|| url.to_string())
}

/// The checks that need no DNS: http(s), not `localhost`, and no literal
/// address that `ip_allowed` rejects. Resolved names are checked by
/// `GuardedResolver`, on the addresses the client actually connects to.
fn literal_allowed(url: &Url) -> bool {
    if !matches!(url.scheme(), "http" | "https") {
        return false;
    }
    match url.host() {
        Some(Host::Domain(domain)) => {
            let domain = domain.trim_end_matches('.').to_ascii_lowercase();
            domain != "localhost" && !domain.ends_with(".localhost")
        }
        Some(Host::Ipv4(ip)) => ip_allowed(IpAddr::V4(ip)),
        Some(Host::Ipv6(ip)) => ip_allowed(IpAddr::V6(ip)),
        None => false,
    }
}

/// The one address rule, for literal and resolved addresses alike.
fn ip_allowed(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => ipv4_allowed(ip),
        IpAddr::V6(ip) => ipv6_allowed(ip),
    }
}

fn ipv4_allowed(ip: Ipv4Addr) -> bool {
    let [a, b, ..] = ip.octets();
    let this_network = a == 0; // 0.0.0.0/8
    let shared = a == 100 && (64..128).contains(&b); // 100.64.0.0/10
    !(ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_multicast()
        || ip.is_broadcast()
        || this_network
        || shared)
}

fn ipv6_allowed(ip: Ipv6Addr) -> bool {
    if ip.is_loopback() || ip.is_unspecified() {
        return false;
    }
    // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d).
    if let Some(v4) = ip.to_ipv4() {
        return ipv4_allowed(v4);
    }
    let first = ip.segments()[0];
    let unique_local = first & 0xfe00 == 0xfc00; // fc00::/7
    let link_local = first & 0xffc0 == 0xfe80; // fe80::/10
    !(ip.is_multicast() || unique_local || link_local)
}

/// The addresses that pass `ip_allowed`; `Err` if none do.
fn filter_addrs(
    addrs: impl Iterator<Item = SocketAddr>,
) -> Result<Vec<SocketAddr>, Box<dyn std::error::Error + Send + Sync>> {
    let allowed: Vec<_> = addrs.filter(|a| ip_allowed(a.ip())).collect();
    if allowed.is_empty() {
        return Err("no public address".into());
    }
    Ok(allowed)
}

/// Resolves names for the preview client and drops every address that
/// `ip_allowed` rejects, so the checked address is the one connected to
/// (no DNS rebinding between a check and the connect).
struct GuardedResolver;

impl Resolve for GuardedResolver {
    fn resolve(&self, name: Name) -> Resolving {
        let host = name.as_str().to_string();
        Box::pin(async move {
            let addrs =
                tokio::task::spawn_blocking(move || (host.as_str(), 0).to_socket_addrs()).await??;
            let addrs: Addrs = Box::new(filter_addrs(addrs)?.into_iter());
            Ok(addrs)
        })
    }
}

/// The previews fetched so far, bounded to `capacity` entries (oldest
/// insertion dropped first); `None` caches a failed or empty preview.
struct PreviewCache {
    capacity: usize,
    entries: HashMap<String, Option<LinkPreview>>,
    order: VecDeque<String>,
}

impl PreviewCache {
    fn new(capacity: usize) -> Self {
        Self {
            capacity,
            entries: HashMap::new(),
            order: VecDeque::new(),
        }
    }

    fn get(&self, key: &str) -> Option<Option<LinkPreview>> {
        self.entries.get(key).cloned()
    }

    fn insert(&mut self, key: String, value: Option<LinkPreview>) {
        if self.entries.insert(key.clone(), value).is_some() {
            return;
        }
        self.order.push_back(key);
        while self.order.len() > self.capacity {
            if let Some(oldest) = self.order.pop_front() {
                self.entries.remove(&oldest);
            }
        }
    }
}

fn cache() -> &'static Mutex<PreviewCache> {
    static CACHE: OnceLock<Mutex<PreviewCache>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(PreviewCache::new(CACHE_CAPACITY)))
}

fn client() -> Result<&'static reqwest::Client, BridgeError> {
    static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .timeout(TIMEOUT)
                .dns_resolver(Arc::new(GuardedResolver))
                .redirect(redirect::Policy::custom(|attempt| {
                    if attempt.previous().len() > MAX_REDIRECTS {
                        attempt.error("too many redirects")
                    } else if !literal_allowed(attempt.url()) {
                        attempt.error("redirect to a disallowed address")
                    } else {
                        attempt.follow()
                    }
                }))
                .build()
                .map_err(|e| e.to_string())
        })
        .as_ref()
        .map_err(|e| BridgeError::internal(format!("link preview client: {e}")))
}

/// Fetches the page and parses it; `Ok(None)` if it is not HTML or has no
/// usable metadata; `Err` on a network failure.
async fn fetch(client: &reqwest::Client, url: &Url) -> Result<Option<LinkPreview>, reqwest::Error> {
    let mut response = client
        .get(url.clone())
        .header(USER_AGENT, BROWSER_USER_AGENT)
        .header(ACCEPT, "text/html,application/xhtml+xml")
        .send()
        .await?
        .error_for_status()?;
    let is_html = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.trim().to_ascii_lowercase())
        .is_some_and(|v| v.starts_with("text/html") || v.starts_with("application/xhtml+xml"));
    if !is_html {
        return Ok(None);
    }
    let final_url = response.url().clone();
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        body.extend_from_slice(&chunk);
        if body.len() >= MAX_BODY {
            body.truncate(MAX_BODY);
            break;
        }
    }
    let parsed = parse_html(&final_url, &String::from_utf8_lossy(&body));
    if parsed.title.is_none() && parsed.description.is_none() && parsed.image_url.is_none() {
        return Ok(None);
    }
    Ok(Some(LinkPreview {
        url: url.to_string(),
        final_url: final_url.to_string(),
        title: parsed.title,
        description: parsed.description,
        image_url: parsed.image_url,
        site_name: parsed.site_name,
    }))
}

/// The preview of `url`, or `None` if the URL is invalid or disallowed, the
/// fetch failed or the page has nothing to show.
#[tauri::command]
pub async fn fetch_link_preview(url: String) -> Result<Option<LinkPreview>, BridgeError> {
    if let Some(cached) = cache().lock().unwrap_or_else(|e| e.into_inner()).get(&url) {
        return Ok(cached);
    }
    let preview = match Url::parse(&url) {
        Ok(parsed) if literal_allowed(&parsed) => {
            fetch(client()?, &parsed).await.unwrap_or_else(|e| {
                tracing::debug!("link preview {url}: {e}");
                None
            })
        }
        _ => None,
    };
    cache()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .insert(url, preview.clone());
    Ok(preview)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base() -> Url {
        Url::parse("https://example.com/articles/one").unwrap()
    }

    #[test]
    fn parses_og_tags() {
        let html = r#"<html><head>
            <title>Fallback</title>
            <meta property="og:title" content="  The   title ">
            <meta property="og:description" content="The description">
            <meta property="og:image" content="https://cdn.example.com/a.png">
            <meta property="og:site_name" content="Example">
        </head></html>"#;
        assert_eq!(
            parse_html(&base(), html),
            ParsedPreview {
                title: Some("The title".into()),
                description: Some("The description".into()),
                image_url: Some("https://cdn.example.com/a.png".into()),
                site_name: Some("Example".into()),
            }
        );
    }

    #[test]
    fn falls_back_to_title_and_meta_description() {
        let html = "<html><head><title>\n Plain\n page </title>\
            <meta name=\"description\" content=\"About it\"></head></html>";
        assert_eq!(
            parse_html(&base(), html),
            ParsedPreview {
                title: Some("Plain page".into()),
                description: Some("About it".into()),
                image_url: None,
                site_name: Some("example.com".into()),
            }
        );
    }

    #[test]
    fn falls_back_to_twitter_tags() {
        let html = r#"<meta name="twitter:title" content="T">
            <meta name="twitter:description" content="D">
            <meta name="twitter:image" content="/t.png">"#;
        let parsed = parse_html(&base(), html);
        assert_eq!(parsed.title.as_deref(), Some("T"));
        assert_eq!(parsed.description.as_deref(), Some("D"));
        assert_eq!(
            parsed.image_url.as_deref(),
            Some("https://example.com/t.png")
        );
    }

    #[test]
    fn resolves_relative_og_image() {
        let html = r#"<meta property="og:image" content="../img/cover.jpg">"#;
        assert_eq!(
            parse_html(&base(), html).image_url.as_deref(),
            Some("https://example.com/img/cover.jpg")
        );
        let html = r#"<meta property="og:image" content="data:image/png;base64,AAAA">"#;
        assert_eq!(parse_html(&base(), html).image_url, None);
    }

    #[test]
    fn no_usable_data() {
        let base = Url::parse("http://127.0.0.1/").unwrap();
        let parsed = parse_html(&base, "<html><body><p>Hi</p></body></html>");
        assert_eq!(parsed.title, None);
        assert_eq!(parsed.description, None);
        assert_eq!(parsed.image_url, None);
        // The host is the site name fallback.
        assert_eq!(parsed.site_name.as_deref(), Some("127.0.0.1"));
        let base = Url::parse("data:text/html,x").unwrap();
        assert_eq!(parse_html(&base, ""), ParsedPreview::default());
    }

    #[test]
    fn truncates_on_char_boundaries() {
        let title = "é".repeat(300);
        let description = "字".repeat(600);
        let html = format!(
            r#"<meta property="og:title" content="{title}"><meta property="og:description" content="{description}">"#
        );
        let parsed = parse_html(&base(), &html);
        assert_eq!(parsed.title.unwrap().chars().count(), MAX_TITLE);
        assert_eq!(parsed.description.unwrap().chars().count(), MAX_DESCRIPTION);
    }

    #[test]
    fn literal_guard() {
        for url in [
            "http://127.0.0.1/",
            "http://10.1.2.3/",
            "http://[::1]/",
            "http://169.254.1.1/",
            "http://localhost:8080/",
            "http://app.localhost/",
            "http://192.168.0.1/",
            "http://0.0.0.0/",
            "http://224.0.0.1/",
            "http://[fe80::1]/",
            "http://[fd00::1]/",
            "http://[::ffff:127.0.0.1]/",
            "ftp://example.com/",
        ] {
            assert!(!literal_allowed(&Url::parse(url).unwrap()), "{url}");
        }
        assert!(literal_allowed(
            &Url::parse("http://93.184.216.34/").unwrap()
        ));
        assert!(literal_allowed(
            &Url::parse("https://example.com/").unwrap()
        ));
    }

    #[test]
    fn ip_rule() {
        for ip in [
            "127.0.0.1",
            "10.0.0.1",
            "172.16.5.4",
            "192.168.1.1",
            "100.64.0.1",
            "169.254.1.1",
            "224.0.0.1",
            "0.0.0.0",
            "255.255.255.255",
            "::1",
            "::",
            "fe80::1",
            "fc00::1",
            "::ffff:127.0.0.1",
            "::ffff:10.0.0.1",
            "::10.0.0.1",
        ] {
            assert!(!ip_allowed(ip.parse().unwrap()), "{ip}");
        }
        for ip in [
            "93.184.216.34",
            "1.1.1.1",
            "2606:4700:4700::1111",
            "::ffff:93.184.216.34",
        ] {
            assert!(ip_allowed(ip.parse().unwrap()), "{ip}");
        }
    }

    #[test]
    fn resolver_keeps_only_public_addresses() {
        let addr = |s: &str| s.parse::<SocketAddr>().unwrap();
        let kept = filter_addrs(
            [
                addr("127.0.0.1:0"),
                addr("93.184.216.34:0"),
                addr("[fd00::1]:0"),
                addr("[2606:4700:4700::1111]:0"),
            ]
            .into_iter(),
        )
        .unwrap();
        assert_eq!(
            kept,
            vec![addr("93.184.216.34:0"), addr("[2606:4700:4700::1111]:0")]
        );
        assert!(filter_addrs([addr("10.0.0.1:0"), addr("[::1]:0")].into_iter()).is_err());
        assert!(filter_addrs(std::iter::empty()).is_err());
    }

    #[test]
    fn cache_is_bounded() {
        let mut cache = PreviewCache::new(CACHE_CAPACITY);
        for i in 0..=CACHE_CAPACITY {
            cache.insert(format!("https://e.com/{i}"), None);
        }
        assert_eq!(cache.entries.len(), CACHE_CAPACITY);
        assert_eq!(cache.order.len(), CACHE_CAPACITY);
        assert_eq!(cache.get("https://e.com/0"), None);
        assert_eq!(cache.get("https://e.com/1"), Some(None));
        assert_eq!(
            cache.get(&format!("https://e.com/{CACHE_CAPACITY}")),
            Some(None)
        );
    }
}
