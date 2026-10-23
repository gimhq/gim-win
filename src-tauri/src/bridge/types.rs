//! Serde mirrors of gim-ffi's records and enums, one per record of the
//! bridge contract (README, "Bridge conventions"): camelCase fields, unit
//! enums as plain strings, data-carrying enums tagged with `type`.

use serde::{Deserialize, Serialize};

/// Declares a unit enum mirroring `gim_ffi::$name` variant by variant.
macro_rules! unit_enum {
    ($name:ident { $($variant:ident),+ $(,)? }) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
        pub enum $name {
            $($variant),+
        }

        impl From<gim_ffi::$name> for $name {
            fn from(value: gim_ffi::$name) -> Self {
                match value {
                    $(gim_ffi::$name::$variant => Self::$variant),+
                }
            }
        }
    };
}

unit_enum!(ChatKind { Direct, Group });
unit_enum!(ChatState {
    Active,
    Leaving,
    Left
});
unit_enum!(HubState {
    Unverified,
    Verified,
    Removed
});
unit_enum!(ConnectionState {
    Offline,
    Connecting,
    Connected,
    Syncing
});
unit_enum!(SendFailure {
    UserSuspended,
    UserNotAdmitted,
    NotAdmittedByPeer,
    Rejected,
    Other
});
unit_enum!(MembershipChangeKind {
    Added,
    Removed,
    Left
});
unit_enum!(NotificationKind {
    Message,
    Reaction,
    Invite,
    Membership,
    Generic
});

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub user_id: String,
    pub device_id: String,
    pub handle: String,
    pub display_name: String,
}

impl From<gim_ffi::Session> for Session {
    fn from(s: gim_ffi::Session) -> Self {
        Self {
            user_id: s.user_id,
            device_id: s.device_id,
            handle: s.handle,
            display_name: s.display_name,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryRotation {
    pub recovery_code: String,
    pub unsynced_hub_ids: Vec<String>,
}

impl From<gim_ffi::RecoveryRotation> for RecoveryRotation {
    fn from(r: gim_ffi::RecoveryRotation) -> Self {
        Self {
            recovery_code: r.recovery_code,
            unsynced_hub_ids: r.unsynced_hub_ids,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub device_id: String,
    pub created_at_ms: u64,
    pub is_current: bool,
    pub revoked: bool,
}

impl From<gim_ffi::DeviceInfo> for DeviceInfo {
    fn from(d: gim_ffi::DeviceInfo) -> Self {
        Self {
            device_id: d.device_id,
            created_at_ms: d.created_at_ms,
            is_current: d.is_current,
            revoked: d.revoked,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub user_id: String,
    pub handle: String,
    pub display_name: String,
    pub has_avatar: bool,
}

impl From<gim_ffi::UserProfile> for UserProfile {
    fn from(p: gim_ffi::UserProfile) -> Self {
        Self {
            user_id: p.user_id,
            handle: p.handle,
            display_name: p.display_name,
            has_avatar: p.has_avatar,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInfo {
    pub hub_id: String,
    pub url: Option<String>,
    pub state: HubState,
    pub priority: u8,
    pub is_primary: bool,
    pub is_home: bool,
    pub signed_in: bool,
}

impl From<gim_ffi::HubInfo> for HubInfo {
    fn from(h: gim_ffi::HubInfo) -> Self {
        Self {
            hub_id: h.hub_id,
            url: h.url,
            state: h.state.into(),
            priority: h.priority,
            is_primary: h.is_primary,
            is_home: h.is_home,
            signed_in: h.signed_in,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSummary {
    pub chat_id: String,
    pub kind: ChatKind,
    pub name: String,
    pub avatar: Option<MediaRef>,
    pub last_message: Option<MessagePreview>,
    pub unread_count: u32,
    pub updated_at_ms: u64,
    pub member_count: u32,
    pub state: ChatState,
    pub peer: Option<UserProfile>,
    pub muted_until_ms: u64,
    pub pinned: bool,
    pub archived: bool,
    pub blocked: bool,
}

impl From<gim_ffi::ChatSummary> for ChatSummary {
    fn from(c: gim_ffi::ChatSummary) -> Self {
        Self {
            chat_id: c.chat_id,
            kind: c.kind.into(),
            name: c.name,
            avatar: c.avatar.map(Into::into),
            last_message: c.last_message.map(Into::into),
            unread_count: c.unread_count,
            updated_at_ms: c.updated_at_ms,
            member_count: c.member_count,
            state: c.state.into(),
            peer: c.peer.map(Into::into),
            muted_until_ms: c.muted_until_ms,
            pinned: c.pinned,
            archived: c.archived,
            blocked: c.blocked,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessagePreview {
    pub sender_name: String,
    pub text: String,
    pub sent_at_ms: u64,
    pub is_own: bool,
}

impl From<gim_ffi::MessagePreview> for MessagePreview {
    fn from(p: gim_ffi::MessagePreview) -> Self {
        Self {
            sender_name: p.sender_name,
            text: p.text,
            sent_at_ms: p.sent_at_ms,
            is_own: p.is_own,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaRef {
    pub chat_id: String,
    pub message_id: String,
    pub mime: String,
    pub size: u64,
    pub has_thumbnail: bool,
}

impl From<gim_ffi::MediaRef> for MediaRef {
    fn from(m: gim_ffi::MediaRef) -> Self {
        Self {
            chat_id: m.chat_id,
            message_id: m.message_id,
            mime: m.mime,
            size: m.size,
            has_thumbnail: m.has_thumbnail,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageItem {
    pub message_id: String,
    pub chat_id: String,
    pub sender: UserProfile,
    pub is_own: bool,
    pub sent_at_ms: u64,
    pub content: MessageContent,
    pub reply_to: Option<ReplyPreview>,
    pub reactions: Vec<ReactionGroup>,
    pub edited: bool,
    pub send_state: Option<SendState>,
}

impl From<gim_ffi::MessageItem> for MessageItem {
    fn from(m: gim_ffi::MessageItem) -> Self {
        Self {
            message_id: m.message_id,
            chat_id: m.chat_id,
            sender: m.sender.into(),
            is_own: m.is_own,
            sent_at_ms: m.sent_at_ms,
            content: m.content.into(),
            reply_to: m.reply_to.map(Into::into),
            reactions: m.reactions.into_iter().map(Into::into).collect(),
            edited: m.edited,
            send_state: m.send_state.map(Into::into),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "type", rename_all_fields = "camelCase")]
pub enum MessageContent {
    Text {
        body: String,
    },
    Image {
        media: MediaRef,
        width: Option<u32>,
        height: Option<u32>,
        caption: Option<String>,
    },
    File {
        media: MediaRef,
        file_name: Option<String>,
        caption: Option<String>,
    },
    Deleted,
    Unsupported,
}

impl From<gim_ffi::MessageContent> for MessageContent {
    fn from(c: gim_ffi::MessageContent) -> Self {
        use gim_ffi::MessageContent as C;
        match c {
            C::Text { body } => Self::Text { body },
            C::Image {
                media,
                width,
                height,
                caption,
            } => Self::Image {
                media: media.into(),
                width,
                height,
                caption,
            },
            C::File {
                media,
                file_name,
                caption,
            } => Self::File {
                media: media.into(),
                file_name,
                caption,
            },
            C::Deleted => Self::Deleted,
            C::Unsupported => Self::Unsupported,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplyPreview {
    pub message_id: String,
    pub sender_name: String,
    pub text: String,
}

impl From<gim_ffi::ReplyPreview> for ReplyPreview {
    fn from(r: gim_ffi::ReplyPreview) -> Self {
        Self {
            message_id: r.message_id,
            sender_name: r.sender_name,
            text: r.text,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReactionGroup {
    pub emoji: String,
    pub count: u32,
    pub own: bool,
}

impl From<gim_ffi::ReactionGroup> for ReactionGroup {
    fn from(r: gim_ffi::ReactionGroup) -> Self {
        Self {
            emoji: r.emoji,
            count: r.count,
            own: r.own,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "type", rename_all_fields = "camelCase")]
pub enum SendState {
    Pending,
    Sent,
    Delivered,
    Read,
    Failed { reason: String, cause: SendFailure },
}

impl From<gim_ffi::SendState> for SendState {
    fn from(s: gim_ffi::SendState) -> Self {
        use gim_ffi::SendState as S;
        match s {
            S::Pending => Self::Pending,
            S::Sent => Self::Sent,
            S::Delivered => Self::Delivered,
            S::Read => Self::Read,
            S::Failed { reason, cause } => Self::Failed {
                reason,
                cause: cause.into(),
            },
        }
    }
}

// Mirrors gim-ffi, which passes it by value as well.
#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "type", rename_all_fields = "camelCase")]
pub enum TimelineItem {
    Message {
        item: MessageItem,
    },
    DateSeparator {
        day_start_ms: u64,
    },
    MembershipChange {
        user_name: String,
        change: MembershipChangeKind,
        at_ms: u64,
        user_id: String,
        actor_user_id: Option<String>,
    },
}

impl From<gim_ffi::TimelineItem> for TimelineItem {
    fn from(i: gim_ffi::TimelineItem) -> Self {
        use gim_ffi::TimelineItem as I;
        match i {
            I::Message { item } => Self::Message { item: item.into() },
            I::DateSeparator { day_start_ms } => Self::DateSeparator { day_start_ms },
            I::MembershipChange {
                user_name,
                change,
                at_ms,
                user_id,
                actor_user_id,
            } => Self::MembershipChange {
                user_name,
                change: change.into(),
                at_ms,
                user_id,
                actor_user_id,
            },
        }
    }
}

/// Declares a `VectorDiff`-shaped enum over `$value` mirroring
/// `gim_ffi::$name`.
macro_rules! list_diff {
    ($name:ident, $value:ident) => {
        #[allow(clippy::large_enum_variant)]
        #[derive(Debug, Clone, PartialEq, Eq, Serialize)]
        #[serde(tag = "type")]
        pub enum $name {
            Append { values: Vec<$value> },
            Clear,
            PushFront { value: $value },
            PushBack { value: $value },
            PopFront,
            PopBack,
            Insert { index: u32, value: $value },
            Set { index: u32, value: $value },
            Remove { index: u32 },
            Truncate { length: u32 },
            Reset { values: Vec<$value> },
        }

        impl From<gim_ffi::$name> for $name {
            fn from(d: gim_ffi::$name) -> Self {
                use gim_ffi::$name as D;
                match d {
                    D::Append { values } => Self::Append {
                        values: values.into_iter().map(Into::into).collect(),
                    },
                    D::Clear => Self::Clear,
                    D::PushFront { value } => Self::PushFront {
                        value: value.into(),
                    },
                    D::PushBack { value } => Self::PushBack {
                        value: value.into(),
                    },
                    D::PopFront => Self::PopFront,
                    D::PopBack => Self::PopBack,
                    D::Insert { index, value } => Self::Insert {
                        index,
                        value: value.into(),
                    },
                    D::Set { index, value } => Self::Set {
                        index,
                        value: value.into(),
                    },
                    D::Remove { index } => Self::Remove { index },
                    D::Truncate { length } => Self::Truncate { length },
                    D::Reset { values } => Self::Reset {
                        values: values.into_iter().map(Into::into).collect(),
                    },
                }
            }
        }
    };
}

list_diff!(ChatListDiff, ChatSummary);
list_diff!(TimelineDiff, TimelineItem);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushRegistration {
    pub provider: String,
    pub token: String,
    pub app_id: Option<String>,
    pub sandbox: Option<bool>,
    pub p256dh: Option<String>,
    pub auth: Option<String>,
}

impl From<PushRegistration> for gim_ffi::PushRegistration {
    fn from(r: PushRegistration) -> Self {
        Self {
            provider: r.provider,
            token: r.token,
            app_id: r.app_id,
            sandbox: r.sandbox,
            p256dh: r.p256dh,
            auth: r.auth,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationContent {
    pub chat_id: Option<String>,
    pub chat_title: Option<String>,
    pub sender_user_id: Option<String>,
    pub sender_display_name: Option<String>,
    pub body: String,
    pub message_id: Option<String>,
    pub collapse_id: Option<String>,
    pub kind: NotificationKind,
    pub should_display: bool,
    pub timestamp: u64,
}

impl From<gim_ffi::NotificationContent> for NotificationContent {
    fn from(n: gim_ffi::NotificationContent) -> Self {
        Self {
            chat_id: n.chat_id,
            chat_title: n.chat_title,
            sender_user_id: n.sender_user_id,
            sender_display_name: n.sender_display_name,
            body: n.body,
            message_id: n.message_id,
            collapse_id: n.collapse_id,
            kind: n.kind.into(),
            should_display: n.should_display,
            timestamp: n.timestamp,
        }
    }
}

/// Result of the `startup` command.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupInfo {
    pub server_url: Option<String>,
    pub client_ready: bool,
    pub local_state_reset: bool,
    pub session: Option<Session>,
    pub error: Option<crate::bridge::error::BridgeError>,
}

/// Result of `start_link`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkStart {
    pub link_id: String,
    pub qr_string: String,
}

/// Result of `approve_link`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkApproval {
    pub approval_id: String,
    pub sas: String,
    pub device_id: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, to_value};

    fn media() -> MediaRef {
        MediaRef {
            chat_id: "hb/g1".into(),
            message_id: "m1".into(),
            mime: "image/png".into(),
            size: 10,
            has_thumbnail: true,
        }
    }

    fn message() -> MessageItem {
        MessageItem {
            message_id: "m1".into(),
            chat_id: "hb/g1".into(),
            sender: UserProfile {
                user_id: "u1".into(),
                handle: "alice".into(),
                display_name: "Alice".into(),
                has_avatar: false,
            },
            is_own: true,
            sent_at_ms: 1_700_000_000_000,
            content: MessageContent::Text { body: "hi".into() },
            reply_to: None,
            reactions: vec![],
            edited: false,
            send_state: Some(SendState::Pending),
        }
    }

    #[test]
    fn timeline_item_tagging() {
        assert_eq!(
            to_value(TimelineItem::DateSeparator { day_start_ms: 5 }).unwrap(),
            json!({"type": "DateSeparator", "dayStartMs": 5})
        );
        assert_eq!(
            to_value(TimelineItem::MembershipChange {
                user_name: "Bob".into(),
                change: MembershipChangeKind::Added,
                at_ms: 7,
                user_id: "u2".into(),
                actor_user_id: None,
            })
            .unwrap(),
            json!({
                "type": "MembershipChange",
                "userName": "Bob",
                "change": "Added",
                "atMs": 7,
                "userId": "u2",
                "actorUserId": null
            })
        );
        let item = to_value(TimelineItem::Message { item: message() }).unwrap();
        assert_eq!(item["type"], "Message");
        assert_eq!(item["item"]["messageId"], "m1");
        assert_eq!(item["item"]["sendState"], json!({"type": "Pending"}));
        assert_eq!(item["item"]["replyTo"], json!(null));
    }

    #[test]
    fn message_content_tagging() {
        assert_eq!(
            to_value(MessageContent::Text { body: "hi".into() }).unwrap(),
            json!({"type": "Text", "body": "hi"})
        );
        assert_eq!(
            to_value(MessageContent::File {
                media: media(),
                file_name: Some("a.pdf".into()),
                caption: None,
            })
            .unwrap(),
            json!({
                "type": "File",
                "media": {"chatId": "hb/g1", "messageId": "m1", "mime": "image/png", "size": 10, "hasThumbnail": true},
                "fileName": "a.pdf",
                "caption": null
            })
        );
        assert_eq!(
            to_value(MessageContent::Deleted).unwrap(),
            json!({"type": "Deleted"})
        );
    }

    #[test]
    fn send_state_tagging() {
        assert_eq!(
            to_value(SendState::Read).unwrap(),
            json!({"type": "Read"})
        );
        assert_eq!(
            to_value(SendState::Failed {
                reason: "suspended".into(),
                cause: SendFailure::UserSuspended,
            })
            .unwrap(),
            json!({"type": "Failed", "reason": "suspended", "cause": "UserSuspended"})
        );
    }

    #[test]
    fn list_diff_tagging() {
        assert_eq!(
            to_value(ChatListDiff::Clear).unwrap(),
            json!({"type": "Clear"})
        );
        assert_eq!(
            to_value(ChatListDiff::Remove { index: 3 }).unwrap(),
            json!({"type": "Remove", "index": 3})
        );
        assert_eq!(
            to_value(ChatListDiff::Truncate { length: 2 }).unwrap(),
            json!({"type": "Truncate", "length": 2})
        );
        let reset = to_value(TimelineDiff::Reset {
            values: vec![TimelineItem::DateSeparator { day_start_ms: 1 }],
        })
        .unwrap();
        assert_eq!(
            reset,
            json!({"type": "Reset", "values": [{"type": "DateSeparator", "dayStartMs": 1}]})
        );
        let set = to_value(TimelineDiff::Set {
            index: 1,
            value: TimelineItem::Message { item: message() },
        })
        .unwrap();
        assert_eq!(set["type"], "Set");
        assert_eq!(set["index"], 1);
        assert_eq!(set["value"]["type"], "Message");
    }

    #[test]
    fn push_registration_round_trip() {
        let value = json!({"provider": "fcm", "token": "t", "appId": "im.g.gimwin", "sandbox": null, "p256dh": null, "auth": null});
        let registration: PushRegistration = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(to_value(&registration).unwrap(), value);
        let ffi: gim_ffi::PushRegistration = registration.into();
        assert_eq!(ffi.provider, "fcm");
        assert_eq!(ffi.app_id.as_deref(), Some("im.g.gimwin"));
    }

    #[test]
    fn unit_enums_are_names() {
        assert_eq!(to_value(ChatState::Active).unwrap(), json!("Active"));
        assert_eq!(to_value(HubState::Verified).unwrap(), json!("Verified"));
        assert_eq!(
            to_value(ConnectionState::Connected).unwrap(),
            json!("Connected")
        );
        assert_eq!(
            to_value(ChatKind::from(gim_ffi::ChatKind::Direct)).unwrap(),
            json!("Direct")
        );
    }
}
