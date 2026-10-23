//! The error every command rejects with: a `GimError` serialised as
//! `{kind, message, ...fields}` (see README, "Bridge conventions").

use gim_ffi::GimError;
use serde::ser::{SerializeMap, Serializer};
use serde::Serialize;

/// `GimError` with the frontend's JSON shape.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BridgeError(pub GimError);

impl BridgeError {
    /// A bridge-level failure (no client, a hook failure).
    pub fn internal(reason: impl Into<String>) -> Self {
        Self(GimError::Internal {
            reason: reason.into(),
        })
    }

    /// A rejected command argument (unknown handle id, bad URL).
    pub fn invalid_input(reason: impl Into<String>) -> Self {
        Self(GimError::InvalidInput {
            reason: reason.into(),
        })
    }
}

impl From<GimError> for BridgeError {
    fn from(err: GimError) -> Self {
        Self(err)
    }
}

impl std::fmt::Display for BridgeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

impl Serialize for BridgeError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use GimError as E;
        let mut map = serializer.serialize_map(None)?;
        map.serialize_entry("kind", kind(&self.0))?;
        map.serialize_entry("message", &self.0.to_string())?;
        match &self.0 {
            E::Network { reason }
            | E::InvalidInput { reason }
            | E::NotFound { reason }
            | E::Crypto { reason }
            | E::Storage { reason }
            | E::Internal { reason }
            | E::HubNotVerified { reason } => map.serialize_entry("reason", reason)?,
            E::NotRegistered | E::Cancelled | E::NotImplemented => {}
            E::Server { status, reason } => {
                map.serialize_entry("status", status)?;
                map.serialize_entry("reason", reason)?;
            }
            E::RetryLater {
                status,
                retry_after_secs,
                reason,
            } => {
                map.serialize_entry("status", status)?;
                map.serialize_entry("retryAfterSecs", retry_after_secs)?;
                map.serialize_entry("reason", reason)?;
            }
            E::ChatNotActive { chat_id, state } => {
                map.serialize_entry("chatId", chat_id)?;
                map.serialize_entry("state", &crate::bridge::types::ChatState::from(*state))?;
            }
            E::HubOwnsGroups {
                hub_id,
                group_count,
            } => {
                map.serialize_entry("hubId", hub_id)?;
                map.serialize_entry("groupCount", group_count)?;
            }
            E::LastHub { hub_id }
            | E::HomeHub { hub_id }
            | E::UserSuspended { hub_id }
            | E::UserNotAdmitted { hub_id } => map.serialize_entry("hubId", hub_id)?,
            E::HubNotDrained { hub_id, reason } => {
                map.serialize_entry("hubId", hub_id)?;
                map.serialize_entry("reason", reason)?;
            }
            E::NotAdmittedByPeer { hub_id, chat_id } => {
                map.serialize_entry("hubId", hub_id)?;
                map.serialize_entry("chatId", chat_id)?;
            }
            E::ContactNotAdmitted { user_ids } => map.serialize_entry("userIds", user_ids)?,
        }
        map.end()
    }
}

/// The variant name.
fn kind(err: &GimError) -> &'static str {
    use GimError as E;
    match err {
        E::Network { .. } => "Network",
        E::NotRegistered => "NotRegistered",
        E::InvalidInput { .. } => "InvalidInput",
        E::NotFound { .. } => "NotFound",
        E::Crypto { .. } => "Crypto",
        E::Storage { .. } => "Storage",
        E::Server { .. } => "Server",
        E::RetryLater { .. } => "RetryLater",
        E::Cancelled => "Cancelled",
        E::NotImplemented => "NotImplemented",
        E::Internal { .. } => "Internal",
        E::ChatNotActive { .. } => "ChatNotActive",
        E::HubNotVerified { .. } => "HubNotVerified",
        E::HubOwnsGroups { .. } => "HubOwnsGroups",
        E::LastHub { .. } => "LastHub",
        E::HomeHub { .. } => "HomeHub",
        E::HubNotDrained { .. } => "HubNotDrained",
        E::UserSuspended { .. } => "UserSuspended",
        E::UserNotAdmitted { .. } => "UserNotAdmitted",
        E::NotAdmittedByPeer { .. } => "NotAdmittedByPeer",
        E::ContactNotAdmitted { .. } => "ContactNotAdmitted",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, to_value};

    fn value(err: GimError) -> serde_json::Value {
        to_value(BridgeError(err)).unwrap()
    }

    #[test]
    fn serialises_the_contract_shape() {
        assert_eq!(
            value(GimError::Network {
                reason: "timed out".into()
            }),
            json!({"kind": "Network", "message": "network error: timed out", "reason": "timed out"})
        );
        assert_eq!(
            value(GimError::Server {
                status: 409,
                reason: "conflict".into()
            }),
            json!({"kind": "Server", "message": "server error 409: conflict", "status": 409, "reason": "conflict"})
        );
        assert_eq!(
            value(GimError::RetryLater {
                status: 429,
                retry_after_secs: 7,
                reason: "rate_limited".into()
            }),
            json!({
                "kind": "RetryLater",
                "message": "retry after 7 s (429): rate_limited",
                "status": 429,
                "retryAfterSecs": 7,
                "reason": "rate_limited"
            })
        );
        assert_eq!(
            value(GimError::ChatNotActive {
                chat_id: "hb/g1".into(),
                state: gim_ffi::ChatState::Leaving
            }),
            json!({
                "kind": "ChatNotActive",
                "message": "chat hb/g1 is not active: Leaving",
                "chatId": "hb/g1",
                "state": "Leaving"
            })
        );
        assert_eq!(
            value(GimError::HubOwnsGroups {
                hub_id: "hb".into(),
                group_count: 2
            }),
            json!({"kind": "HubOwnsGroups", "message": "hub hb owns 2 chats", "hubId": "hb", "groupCount": 2})
        );
        assert_eq!(
            value(GimError::ContactNotAdmitted {
                user_ids: vec!["u1".into(), "u2".into()]
            }),
            json!({
                "kind": "ContactNotAdmitted",
                "message": "users [\"u1\", \"u2\"] do not accept contacts from this user",
                "userIds": ["u1", "u2"]
            })
        );
        assert_eq!(
            value(GimError::NotRegistered),
            json!({"kind": "NotRegistered", "message": "not registered"})
        );
        assert_eq!(
            value(GimError::NotAdmittedByPeer {
                hub_id: "hb".into(),
                chat_id: "hb/g1".into()
            }),
            json!({
                "kind": "NotAdmittedByPeer",
                "message": "hub hb owning chat hb/g1 does not admit this user",
                "hubId": "hb",
                "chatId": "hb/g1"
            })
        );
    }

    #[test]
    fn helpers() {
        assert_eq!(
            value(BridgeError::internal("client not created: x").0),
            json!({"kind": "Internal", "message": "internal error: client not created: x", "reason": "client not created: x"})
        );
        assert_eq!(
            value(BridgeError::invalid_input("unknown link id").0),
            json!({"kind": "InvalidInput", "message": "invalid input: unknown link id", "reason": "unknown link id"})
        );
    }
}
