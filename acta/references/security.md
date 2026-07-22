# Security & data model

Where data lives, who can read it, and who signs what. Read before going to
production.

## Principles

- Non-custodial: ACTA never holds private keys. Every state change is a Stellar
  transaction signed by the user's wallet.
- Prepare/submit everywhere: the API builds an unsigned XDR, the wallet signs it
  locally, the API submits it. The signing key never leaves the device.
- No plaintext PII on-chain: credential payloads are encrypted before anchoring.
- Trust-minimized verification: credential status and DID resolution are on-chain
  reads anyone can perform.

## Who signs what

| Action | Signer |
|--------|--------|
| Create vault | Vault owner |
| Issue / batch issue | Issuer (also pays the on-chain fee) |
| Revoke credential | Vault owner |
| Block / unblock issuer | Vault admin (owner by default) |
| Register / update / deactivate a DID | DID controller wallet |
| Sponsored vault deploy | Sponsor |

## What lives where

| Data | Where | Form |
|------|-------|------|
| Credential payload (`vcData`) | On-chain, in the owner's vault | AES-256-GCM ciphertext |
| Credential status (valid/revoked + date) | On-chain | Public |
| Vault metadata (owner, DID URI, counters) | On-chain | Public |
| Issuer DID record (keys, controller, services) | On-chain (did:stellar registry) | Public by design |
| API keys | ACTA database | Hashed (SHA-256 lookup + Argon2id verify); plaintext shown once |
| Share-link payloads | ACTA database, time-limited | AES-256-GCM sealed, HMAC-signed, 7-day default expiry |
| Private keys (wallet or DID) | User wallet / browser | Never sent to ACTA |

## Credential encryption

On issue, `vcData` travels over TLS and is encrypted server-side with AES-256-GCM
under a server-held master key, with the owner address bound as authenticated data
(AAD). The ciphertext is anchored on-chain.

Consequences:

- Anyone can see that a credential exists and its status; nobody can read its
  contents from the chain.
- `GET /contracts/vault/get-vc` decrypts server-side, which is why only the
  owner's API key (or an admin) may call it.
- `verify-vc` exposes status only and is open to any valid key.

If your threat model requires that ACTA never sees the payload, encrypt `vcData`
client-side before issuing; the platform treats it as opaque.

## What ACTA can and cannot do

Can: process the plaintext payload at issue time and when the owner reads it back
(inherent to server-side encryption); see issuance metadata (who issued to whom,
when).

Cannot: read credentials from the chain without the master-key context, move
funds, issue in your name, rotate your DID, or revoke your credentials. All of
those require your wallet's signature.

## Identity security

- Every DID mutation requires the controller wallet's on-chain signature
  (`require_auth`); the resolver has no privileged role.
- Key rotation without identity loss: `transfer_controller` moves control to a new
  wallet; the DID string stays the same.
- Deactivation is one-way: a deactivated DID resolves as a tombstone (HTTP 410).
- Issuance enforces controller binding: the DID's on-chain controller must equal
  the signing issuer, so a stolen DID string alone is useless.

## API access control

- Keys are 64-char random hex, stored hashed, 6-month expiry, per-role rate limits.
- Ownership binding: `issue`, `batch-issue`, `list-vc-ids`, `get-vc`, `push`
  require the request `owner` to match the key's wallet. Admin surfaces need the
  admin role.
- Writes support `Idempotency-Key` for safe retries; every error carries a
  `request_id`.

## Contract immutability

- Vaults are deployed from a fixed template WASM with no upgrade entrypoint: the
  code holding your credentials cannot be swapped underneath you.
- The factory cannot change the template; new vault code means a new factory, never
  a mutation of existing vaults.
- Admin handovers (factory, registry) are two-step (nominate, then accept).

## Share links

Sharing creates a server-side sealed copy of only the selected fields. Links are
HMAC-signed, expire (7 days default), and the public verification page always
re-checks status on-chain, so a revoked credential shows as revoked even through an
old link.

## Reporting issues

Open an issue at https://github.com/ACTA-Team/ACTA-docs/issues or reach the team on
Discord (https://discord.gg/DsUSE3aMDZ). Do not publish exploit details before the
team can respond.
