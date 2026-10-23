//! The local full-text search index (client-side only; the SDK has no
//! search API): a plain, unencrypted SQLite file `<app_data_dir>/search.db`
//! with FTS5 tables over chat names and message bodies / sender names, fed
//! by the frontend through `index_chats` / `index_messages`.
//!
//! Owner rule: the file records the user id that produced it. Every
//! command first compares it with the bridge's current user; a different
//! user drops the file and starts empty, and no session drops it and keeps
//! it closed, so an index never outlives its account.
//!
//! Limits: only messages this device has received and decrypted (and the
//! frontend has indexed) are searchable. The `unicode61` tokenizer keeps a
//! run of CJK characters as one token, so CJK text is stored and queried
//! with U+200B (a separator to the tokenizer, invisible in text) between
//! adjacent CJK characters: every CJK character is a token and a CJK query
//! is a phrase of characters. There is no word segmentation beyond that.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use gim_ffi::GimError;
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::bridge::error::BridgeError;
use crate::bridge::state::BridgeState;

const DB_FILE: &str = "search.db";
const MAX_LIMIT: u32 = 100;
const CJK_SEPARATOR: char = '\u{200B}';

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS chats(chat_id TEXT PRIMARY KEY, name TEXT);
CREATE TABLE IF NOT EXISTS messages(
    chat_id TEXT, message_id TEXT, sender_name TEXT, body TEXT, sent_at_ms INTEGER,
    PRIMARY KEY(chat_id, message_id)
);
CREATE VIRTUAL TABLE IF NOT EXISTS chats_fts USING fts5(
    name, content='chats', content_rowid='rowid',
    tokenize='unicode61 remove_diacritics 2'
);
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    body, sender_name, content='messages', content_rowid='rowid',
    tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER IF NOT EXISTS chats_ai AFTER INSERT ON chats BEGIN
    INSERT INTO chats_fts(rowid, name) VALUES (new.rowid, new.name);
END;
CREATE TRIGGER IF NOT EXISTS chats_ad AFTER DELETE ON chats BEGIN
    INSERT INTO chats_fts(chats_fts, rowid, name) VALUES ('delete', old.rowid, old.name);
END;
CREATE TRIGGER IF NOT EXISTS chats_au AFTER UPDATE ON chats BEGIN
    INSERT INTO chats_fts(chats_fts, rowid, name) VALUES ('delete', old.rowid, old.name);
    INSERT INTO chats_fts(rowid, name) VALUES (new.rowid, new.name);
END;
CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, body, sender_name)
        VALUES (new.rowid, new.body, new.sender_name);
END;
CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, body, sender_name)
        VALUES ('delete', old.rowid, old.body, old.sender_name);
END;
CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, body, sender_name)
        VALUES ('delete', old.rowid, old.body, old.sender_name);
    INSERT INTO messages_fts(rowid, body, sender_name)
        VALUES (new.rowid, new.body, new.sender_name);
END;
";

/// A message to (re-)index; an empty `body` removes it.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexMessage {
    pub chat_id: String,
    pub message_id: String,
    pub sender_name: String,
    pub body: String,
    pub sent_at_ms: i64,
}

/// A chat name to (re-)index.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexChat {
    pub chat_id: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatHit {
    pub chat_id: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageHit {
    pub chat_id: String,
    pub message_id: String,
    pub sender_name: String,
    pub snippet: String,
    pub sent_at_ms: i64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResults {
    pub chats: Vec<ChatHit>,
    pub messages: Vec<MessageHit>,
}

/// The open index of one owner.
pub struct SearchIndex {
    conn: Connection,
    path: PathBuf,
    owner: String,
}

impl SearchIndex {
    /// Opens (or creates) the index at `path` for `owner`; a file of
    /// another owner (or an unreadable one) is deleted first.
    pub fn open(path: &Path, owner: &str) -> Result<Self, GimError> {
        if stored_owner(path).as_deref() != Some(owner) {
            delete_files(path)?;
        }
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir).map_err(storage)?;
        }
        let conn = Connection::open(path).map_err(storage)?;
        conn.query_row("PRAGMA journal_mode = WAL", [], |row| {
            row.get::<_, String>(0)
        })
        .map_err(storage)?;
        conn.execute_batch(SCHEMA).map_err(storage)?;
        conn.execute(
            "INSERT INTO meta(key, value) VALUES ('owner', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![owner],
        )
        .map_err(storage)?;
        Ok(Self {
            conn,
            path: path.to_path_buf(),
            owner: owner.to_string(),
        })
    }

    /// Upserts the messages in one transaction; an empty body deletes.
    pub fn index_messages(&mut self, items: &[IndexMessage]) -> Result<(), GimError> {
        let tx = self.conn.transaction().map_err(storage)?;
        for item in items {
            if item.body.is_empty() {
                tx.execute(
                    "DELETE FROM messages WHERE chat_id = ?1 AND message_id = ?2",
                    params![item.chat_id, item.message_id],
                )
                .map_err(storage)?;
            } else {
                // An upsert, not INSERT OR REPLACE: the rowid (and with it the
                // FTS row) stays and the update trigger fires.
                tx.execute(
                    "INSERT INTO messages(chat_id, message_id, sender_name, body, sent_at_ms)
                     VALUES (?1, ?2, ?3, ?4, ?5)
                     ON CONFLICT(chat_id, message_id) DO UPDATE SET
                         sender_name = excluded.sender_name,
                         body = excluded.body,
                         sent_at_ms = excluded.sent_at_ms",
                    params![
                        item.chat_id,
                        item.message_id,
                        segment(&item.sender_name),
                        segment(&item.body),
                        item.sent_at_ms
                    ],
                )
                .map_err(storage)?;
            }
        }
        tx.commit().map_err(storage)
    }

    /// Upserts the chat names in one transaction.
    pub fn index_chats(&mut self, chats: &[IndexChat]) -> Result<(), GimError> {
        let tx = self.conn.transaction().map_err(storage)?;
        for chat in chats {
            tx.execute(
                "INSERT INTO chats(chat_id, name) VALUES (?1, ?2)
                 ON CONFLICT(chat_id) DO UPDATE SET name = excluded.name",
                params![chat.chat_id, segment(&chat.name)],
            )
            .map_err(storage)?;
        }
        tx.commit().map_err(storage)
    }

    /// Deletes the chat and its messages.
    pub fn remove_chat(&mut self, chat_id: &str) -> Result<(), GimError> {
        let tx = self.conn.transaction().map_err(storage)?;
        tx.execute("DELETE FROM messages WHERE chat_id = ?1", params![chat_id])
            .map_err(storage)?;
        tx.execute("DELETE FROM chats WHERE chat_id = ?1", params![chat_id])
            .map_err(storage)?;
        tx.commit().map_err(storage)
    }

    /// Chats and messages matching every word of `query` as a prefix, best
    /// match first; at most `limit` (capped at 100) of each.
    pub fn search(&self, query: &str, limit: u32) -> Result<SearchResults, GimError> {
        let Some(fts_query) = fts_query(query) else {
            return Ok(SearchResults::default());
        };
        let limit = limit.min(MAX_LIMIT);
        let mut chats = self
            .conn
            .prepare(
                "SELECT c.chat_id, c.name FROM chats_fts
                 JOIN chats c ON c.rowid = chats_fts.rowid
                 WHERE chats_fts MATCH ?1 ORDER BY rank LIMIT ?2",
            )
            .map_err(storage)?;
        let chats = chats
            .query_map(params![fts_query, limit], |row| {
                Ok(ChatHit {
                    chat_id: row.get(0)?,
                    name: unsegment(&row.get::<_, String>(1)?),
                })
            })
            .and_then(|rows| rows.collect::<Result<Vec<_>, _>>())
            .map_err(storage)?;
        let mut messages = self
            .conn
            .prepare(
                "SELECT m.chat_id, m.message_id, m.sender_name,
                        snippet(messages_fts, 0, '', '', '…', 12), m.sent_at_ms
                 FROM messages_fts
                 JOIN messages m ON m.rowid = messages_fts.rowid
                 WHERE messages_fts MATCH ?1
                 ORDER BY rank, m.sent_at_ms DESC LIMIT ?2",
            )
            .map_err(storage)?;
        let messages = messages
            .query_map(params![fts_query, limit], |row| {
                Ok(MessageHit {
                    chat_id: row.get(0)?,
                    message_id: row.get(1)?,
                    sender_name: unsegment(&row.get::<_, String>(2)?),
                    snippet: unsegment(&row.get::<_, String>(3)?),
                    sent_at_ms: row.get(4)?,
                })
            })
            .and_then(|rows| rows.collect::<Result<Vec<_>, _>>())
            .map_err(storage)?;
        Ok(SearchResults { chats, messages })
    }
}

/// The owner recorded in the file at `path`, if it is a readable index.
fn stored_owner(path: &Path) -> Option<String> {
    if !path.exists() {
        return None;
    }
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_WRITE).ok()?;
    conn.query_row("SELECT value FROM meta WHERE key = 'owner'", [], |row| {
        row.get(0)
    })
    .optional()
    .ok()
    .flatten()
}

/// Deletes the index file and its WAL / shared-memory files.
fn delete_files(path: &Path) -> Result<(), GimError> {
    for suffix in ["", "-wal", "-shm"] {
        let mut file = path.as_os_str().to_owned();
        file.push(suffix);
        match fs::remove_file(&file) {
            Ok(()) => {}
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(storage(e)),
        }
    }
    Ok(())
}

/// The index of `owner` in `slot`, (re)opened when the owner or the path
/// changed; `None` (and the files deleted) when there is no owner.
fn ensure<'a>(
    slot: &'a mut Option<SearchIndex>,
    path: &Path,
    owner: Option<&str>,
) -> Result<Option<&'a mut SearchIndex>, GimError> {
    let Some(owner) = owner else {
        *slot = None;
        delete_files(path)?;
        return Ok(None);
    };
    if !slot
        .as_ref()
        .is_some_and(|index| index.owner == owner && index.path == path)
    {
        // Close the old connection before its file may be deleted.
        *slot = None;
        *slot = Some(SearchIndex::open(path, owner)?);
    }
    Ok(slot.as_mut())
}

fn is_cjk(c: char) -> bool {
    matches!(c,
        '\u{3040}'..='\u{30FF}'     // Hiragana, Katakana
        | '\u{3400}'..='\u{4DBF}'   // CJK Extension A
        | '\u{4E00}'..='\u{9FFF}'   // CJK Unified Ideographs
        | '\u{F900}'..='\u{FAFF}'   // CJK Compatibility Ideographs
        | '\u{20000}'..='\u{3134F}' // CJK Extensions B-G
    )
}

/// `text` with U+200B between adjacent CJK characters.
fn segment(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut prev_cjk = false;
    for c in text.chars() {
        let cjk = is_cjk(c);
        if cjk && prev_cjk {
            out.push(CJK_SEPARATOR);
        }
        out.push(c);
        prev_cjk = cjk;
    }
    out
}

/// Removes the separators `segment` inserted.
fn unsegment(text: &str) -> String {
    text.replace(CJK_SEPARATOR, "")
}

/// The FTS5 query of `query`: every whitespace-separated word quoted (FTS
/// operators and quotes dropped) as a prefix phrase; `None` if no word is
/// left.
fn fts_query(query: &str) -> Option<String> {
    let words: Vec<String> = query
        .split_whitespace()
        .map(|word| word.replace(['"', '*'], ""))
        .filter(|word| word.chars().any(char::is_alphanumeric))
        .map(|word| format!("\"{}\"*", segment(&word)))
        .collect();
    (!words.is_empty()).then(|| words.join(" "))
}

fn storage(err: impl std::fmt::Display) -> GimError {
    GimError::Storage {
        reason: format!("search index: {err}"),
    }
}

/// Tauri managed state: the index, opened on first use.
#[derive(Default)]
pub struct SearchState {
    index: Arc<Mutex<Option<SearchIndex>>>,
}

/// `<app_data_dir>/search.db`, once the startup has computed the directory.
async fn index_path(bridge: &BridgeState) -> Result<PathBuf, BridgeError> {
    bridge.wait_ready().await;
    let config = bridge.config.lock().unwrap_or_else(|e| e.into_inner());
    if config.app_data_dir.as_os_str().is_empty() {
        return Err(BridgeError::internal("search index: no app data dir"));
    }
    Ok(config.app_data_dir.join(DB_FILE))
}

/// Runs `f` on the index of the current user off the async runtime;
/// `None` when there is no session.
async fn with_index<T: Send + 'static>(
    bridge: &BridgeState,
    search: &SearchState,
    f: impl FnOnce(&mut SearchIndex) -> Result<T, GimError> + Send + 'static,
) -> Result<Option<T>, BridgeError> {
    let path = index_path(bridge).await?;
    let owner = match bridge.client().await {
        Ok(client) => client.user_id(),
        Err(_) => None,
    };
    let slot = search.index.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut slot = slot.lock().unwrap_or_else(|e| e.into_inner());
        ensure(&mut slot, &path, owner.as_deref())?
            .map(f)
            .transpose()
    })
    .await
    .map_err(|e| BridgeError::internal(format!("search index: {e}")))?
    .map_err(BridgeError::from)
}

#[tauri::command]
pub async fn index_messages(
    bridge: State<'_, BridgeState>,
    search: State<'_, SearchState>,
    items: Vec<IndexMessage>,
) -> Result<(), BridgeError> {
    with_index(&bridge, &search, move |index| index.index_messages(&items)).await?;
    Ok(())
}

#[tauri::command]
pub async fn index_chats(
    bridge: State<'_, BridgeState>,
    search: State<'_, SearchState>,
    chats: Vec<IndexChat>,
) -> Result<(), BridgeError> {
    with_index(&bridge, &search, move |index| index.index_chats(&chats)).await?;
    Ok(())
}

#[tauri::command]
pub async fn remove_chat(
    bridge: State<'_, BridgeState>,
    search: State<'_, SearchState>,
    chat_id: String,
) -> Result<(), BridgeError> {
    with_index(&bridge, &search, move |index| index.remove_chat(&chat_id)).await?;
    Ok(())
}

#[tauri::command]
pub async fn search(
    bridge: State<'_, BridgeState>,
    search: State<'_, SearchState>,
    query: String,
    limit: u32,
) -> Result<SearchResults, BridgeError> {
    let results = with_index(&bridge, &search, move |index| index.search(&query, limit)).await?;
    Ok(results.unwrap_or_default())
}

/// Closes and deletes the index (sign-out).
#[tauri::command]
pub async fn search_reset(
    bridge: State<'_, BridgeState>,
    search: State<'_, SearchState>,
) -> Result<(), BridgeError> {
    let path = index_path(&bridge).await?;
    let slot = search.index.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut slot = slot.lock().unwrap_or_else(|e| e.into_inner());
        ensure(&mut slot, &path, None).map(|_| ())
    })
    .await
    .map_err(|e| BridgeError::internal(format!("search index: {e}")))?
    .map_err(BridgeError::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(chat_id: &str, message_id: &str, body: &str, sent_at_ms: i64) -> IndexMessage {
        IndexMessage {
            chat_id: chat_id.into(),
            message_id: message_id.into(),
            sender_name: "Ann".into(),
            body: body.into(),
            sent_at_ms,
        }
    }

    fn chat(chat_id: &str, name: &str) -> IndexChat {
        IndexChat {
            chat_id: chat_id.into(),
            name: name.into(),
        }
    }

    fn open(dir: &tempfile::TempDir, owner: &str) -> SearchIndex {
        SearchIndex::open(&dir.path().join(DB_FILE), owner).unwrap()
    }

    fn message_ids(results: &SearchResults) -> Vec<&str> {
        results
            .messages
            .iter()
            .map(|m| m.message_id.as_str())
            .collect()
    }

    #[test]
    fn word_prefix_finds_the_message_with_a_snippet() {
        let dir = tempfile::tempdir().unwrap();
        let mut index = open(&dir, "u1");
        index
            .index_messages(&[
                message("hb/g1", "m1", "See you at the café tomorrow", 10),
                message("hb/g1", "m2", "Unrelated", 20),
            ])
            .unwrap();
        let results = index.search("caf tomo", 10).unwrap();
        assert_eq!(
            results.messages,
            vec![MessageHit {
                chat_id: "hb/g1".into(),
                message_id: "m1".into(),
                sender_name: "Ann".into(),
                snippet: "See you at the café tomorrow".into(),
                sent_at_ms: 10,
            }]
        );
        // Diacritics are folded; the sender name is searchable too.
        assert_eq!(message_ids(&index.search("cafe", 10).unwrap()), ["m1"]);
        assert_eq!(index.search("an", 10).unwrap().messages.len(), 2);
        // An edit re-indexes the message.
        index
            .index_messages(&[message("hb/g1", "m1", "Changed plans", 10)])
            .unwrap();
        assert!(index.search("tomorrow", 10).unwrap().messages.is_empty());
        assert_eq!(message_ids(&index.search("plan", 10).unwrap()), ["m1"]);
    }

    #[test]
    fn long_bodies_get_an_ellipsis_snippet() {
        let dir = tempfile::tempdir().unwrap();
        let mut index = open(&dir, "u1");
        let body = format!("{} needle {}", "word ".repeat(30), "tail ".repeat(30));
        index
            .index_messages(&[message("hb/g1", "m1", &body, 1)])
            .unwrap();
        let snippet = &index.search("needle", 10).unwrap().messages[0].snippet;
        assert!(snippet.contains("needle"), "{snippet}");
        assert!(
            snippet.starts_with('…') && snippet.ends_with('…'),
            "{snippet}"
        );
    }

    #[test]
    fn chat_name_search() {
        let dir = tempfile::tempdir().unwrap();
        let mut index = open(&dir, "u1");
        index
            .index_chats(&[chat("hb/g1", "Design team"), chat("hb/g2", "Family")])
            .unwrap();
        let results = index.search("des", 10).unwrap();
        assert_eq!(
            results.chats,
            vec![ChatHit {
                chat_id: "hb/g1".into(),
                name: "Design team".into(),
            }]
        );
        assert!(results.messages.is_empty());
        index.index_chats(&[chat("hb/g1", "Ops")]).unwrap();
        assert!(index.search("design", 10).unwrap().chats.is_empty());
        assert_eq!(index.search("ops", 10).unwrap().chats.len(), 1);
    }

    #[test]
    fn empty_body_removes_the_message() {
        let dir = tempfile::tempdir().unwrap();
        let mut index = open(&dir, "u1");
        index
            .index_messages(&[message("hb/g1", "m1", "hello world", 1)])
            .unwrap();
        index
            .index_messages(&[message("hb/g1", "m1", "", 1)])
            .unwrap();
        assert!(index.search("hello", 10).unwrap().messages.is_empty());
        let rows: i64 = index
            .conn
            .query_row("SELECT count(*) FROM messages", [], |r| r.get(0))
            .unwrap();
        assert_eq!(rows, 0);
    }

    #[test]
    fn owner_mismatch_drops_the_data() {
        let dir = tempfile::tempdir().unwrap();
        let mut index = open(&dir, "u1");
        index
            .index_messages(&[message("hb/g1", "m1", "secret plans", 1)])
            .unwrap();
        index.index_chats(&[chat("hb/g1", "Secret")]).unwrap();
        drop(index);
        // The same owner keeps the data.
        let index = open(&dir, "u1");
        assert_eq!(index.search("secret", 10).unwrap().messages.len(), 1);
        drop(index);
        let index = open(&dir, "u2");
        assert_eq!(
            index.search("secret", 10).unwrap(),
            SearchResults::default()
        );
        assert_eq!(
            stored_owner(&dir.path().join(DB_FILE)).as_deref(),
            Some("u2")
        );
    }

    #[test]
    fn ensure_follows_the_owner() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(DB_FILE);
        let mut slot = None;
        ensure(&mut slot, &path, Some("u1"))
            .unwrap()
            .unwrap()
            .index_messages(&[message("hb/g1", "m1", "hello", 1)])
            .unwrap();
        let index = ensure(&mut slot, &path, Some("u1")).unwrap().unwrap();
        assert_eq!(index.search("hello", 10).unwrap().messages.len(), 1);
        let index = ensure(&mut slot, &path, Some("u2")).unwrap().unwrap();
        assert!(index.search("hello", 10).unwrap().messages.is_empty());
        // No session: closed and deleted.
        assert!(ensure(&mut slot, &path, None).unwrap().is_none());
        assert!(slot.is_none());
        assert!(!path.exists());
    }

    #[test]
    fn remove_chat_cascades() {
        let dir = tempfile::tempdir().unwrap();
        let mut index = open(&dir, "u1");
        index
            .index_chats(&[chat("hb/g1", "Alpha"), chat("hb/g2", "Alpine")])
            .unwrap();
        index
            .index_messages(&[
                message("hb/g1", "m1", "alpha one", 1),
                message("hb/g2", "m2", "alpha two", 2),
            ])
            .unwrap();
        index.remove_chat("hb/g1").unwrap();
        let results = index.search("alp", 10).unwrap();
        assert_eq!(
            results.chats,
            vec![ChatHit {
                chat_id: "hb/g2".into(),
                name: "Alpine".into(),
            }]
        );
        assert_eq!(message_ids(&results), ["m2"]);
    }

    #[test]
    fn limit_is_respected_and_capped() {
        let dir = tempfile::tempdir().unwrap();
        let mut index = open(&dir, "u1");
        let items: Vec<_> = (0..150)
            .map(|i| message("hb/g1", &format!("m{i}"), "same words", i))
            .collect();
        index.index_messages(&items).unwrap();
        let results = index.search("same", 5).unwrap();
        // Equal rank: newest first.
        assert_eq!(
            message_ids(&results),
            ["m149", "m148", "m147", "m146", "m145"]
        );
        assert_eq!(index.search("same", 1000).unwrap().messages.len(), 100);
    }

    #[test]
    fn cjk_query_matches_a_cjk_body() {
        let dir = tempfile::tempdir().unwrap();
        let mut index = open(&dir, "u1");
        index
            .index_messages(&[
                message("hb/g1", "m1", "我们明天去公园散步", 1),
                message("hb/g1", "m2", "公司明年计划", 2),
            ])
            .unwrap();
        index.index_chats(&[chat("hb/g1", "家庭群聊")]).unwrap();
        let results = index.search("公园", 10).unwrap();
        assert_eq!(message_ids(&results), ["m1"]);
        assert_eq!(results.messages[0].snippet, "我们明天去公园散步");
        // A phrase of adjacent characters: m2 has 明 but not 明天.
        assert_eq!(message_ids(&index.search("明天", 10).unwrap()), ["m1"]);
        assert_eq!(index.search("群聊", 10).unwrap().chats[0].name, "家庭群聊");
    }

    #[test]
    fn query_building() {
        assert_eq!(fts_query(""), None);
        assert_eq!(fts_query("  \"* - ()"), None);
        assert_eq!(fts_query("foo"), Some("\"foo\"*".into()));
        assert_eq!(
            fts_query("a\"b OR c* NEAR(d)"),
            Some("\"ab\"* \"OR\"* \"c\"* \"NEAR(d)\"*".into())
        );
        assert_eq!(fts_query("公园"), Some("\"公\u{200B}园\"*".into()));
        let dir = tempfile::tempdir().unwrap();
        let index = open(&dir, "u1");
        // Operators in the input never reach FTS5 as syntax.
        for query in ["AND", "a OR", "NEAR(x y)", "col:x", "^x", "-x", "\"", "x)"] {
            index.search(query, 10).unwrap();
        }
        assert_eq!(index.search("", 10).unwrap(), SearchResults::default());
    }

    #[test]
    fn reset_deletes_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(DB_FILE);
        let mut slot = Some(open(&dir, "u1"));
        slot.as_mut()
            .unwrap()
            .index_messages(&[message("hb/g1", "m1", "hello", 1)])
            .unwrap();
        assert!(path.exists());
        ensure(&mut slot, &path, None).unwrap();
        for suffix in ["", "-wal", "-shm"] {
            assert!(!dir.path().join(format!("{DB_FILE}{suffix}")).exists());
        }
        // Deleting again is not an error.
        delete_files(&path).unwrap();
    }
}
