# REST API reference

RESTful API for ACTA credential management on Stellar. Both networks are
supported by the host you call. Interactive spec (testnet only):
https://api.testnet.acta.build/docs

## Base URLs

- Testnet: `https://api.testnet.acta.build`
- Mainnet: `https://api.mainnet.acta.build`

Never use the legacy `acta.build/api/{network}` shape.

## Authentication

`/contracts/*` routes require an API key on every request:

```
X-ACTA-Key: <64-char-hex>
```

`X-ACTA-Key` is canonical; `x-api-key` and `Authorization: Bearer <key>` are also
accepted. Keys have no prefix.

Public routes (no key): `GET /health`, `GET /config`, `POST /public/api-keys`
(rate-limited per IP, origin-restricted), `GET /share/:id` (signature-gated).

Admin routes (`/admin/*`, `/contracts/admin/*`, `POST /contracts/sponsored-vault/create`)
require an admin-role key.

### Ownership enforcement

`issue`, `batch-issue`, `list-vc-ids`, `get-vc`, and `push` require the request
`owner` (or `fromOwner`) to equal the wallet bound to your API key. Admin keys are
exempt. `verify-vc` is intentionally open to any valid key so third parties can
verify credentials they do not own.

## Vault addressing

Vaults are single-tenant and deterministic. The API derives an owner's vault
address from `(factory, owner, userSalt)`; you pass `owner`, not a vault address.

- `userSalt` (optional): 32-byte hex salt. Default is 32 zero bytes -> one
  canonical vault per owner. Only send a custom salt to run more than one vault.
- `vaultContract` (optional, reads only): a resolved `C...` id to skip factory
  resolution when you already know it.

## Prepare / submit flow

Writes have two modes on the same endpoint:

1. Prepare: send operation fields (no `signedXdr`) -> `{ "xdr": "...", "network": "..." }`
2. Sign: sign `xdr` with the returned `network` passphrase using the user's wallet.
3. Submit: send `{ "signedXdr": "..." }` -> `{ "tx_id": "..." }`

### Idempotency

Write routes accept an `Idempotency-Key` header (up to 200 chars). The first
response for a key is cached 24h and replayed on retries with
`Idempotency-Replayed: true`. Use it to retry submits safely after a timeout or
`tx_submit_error`.

## Endpoint map

### Credentials

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/contracts/vc/issue` | Issue one credential (owner-bound) |
| POST | `/contracts/vc/batch-issue` | Issue 1 to 5 into one vault in one tx (owner-bound) |
| POST | `/contracts/vc/revoke` | Revoke a credential (owner signs) |

### Vault write

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/contracts/vault/create` | Deploy the owner's vault |
| POST | `/contracts/vault/deny-issuer` | Block an issuer |
| POST | `/contracts/vault/allow-issuer` | Unblock an issuer |
| POST | `/contracts/vault/revoke-vault` | Revoke the vault |
| POST | `/contracts/vault/set-new-owner` | Transfer vault ownership |
| POST | `/contracts/vault/set-vault-did` | Change the vault DID URI |
| POST | `/contracts/vault/push` | Move a credential to another same-owner vault |
| POST | `/contracts/sponsored-vault/create` | Sponsor-paid vault deploy (admin key) |

### Vault read

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/contracts/vault/verify-vc` | Status only; open to any valid key |
| POST | `/contracts/vault/list-vc-ids` | List credential ids (owner-bound) |
| POST | `/contracts/vault/get-vc` | Get decrypted credential (owner-bound) |
| GET | `/contracts/version` | Contract version |

### Public

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/config` | Public network config (bootstrap; no key) |
| POST | `/public/api-keys` | Create a standard key (origin-restricted, 5/min/IP) |
| GET | `/share/:id` | Signature-gated share payload |

## Issue credential

`POST /contracts/vc/issue`

Prepare body:

```json
{
  "owner": "G...",
  "vcId": "credential-123",
  "vcData": "{\"@context\":[\"https://www.w3.org/ns/credentials/v2\"],\"type\":[\"VerifiableCredential\"],\"credentialSubject\":{\"id\":\"did:stellar:testnet:...\",\"name\":\"John Doe\"}}",
  "issuer": "G...",
  "issuerDid": "did:stellar:testnet:...",
  "sourcePublicKey": "G...",
  "userSalt": "0000000000000000000000000000000000000000000000000000000000000000"
}
```

Constraints: `vcId` max 64 chars; `vcData` max 10,000 chars, must include
`@context` with at least `https://www.w3.org/ns/credentials/v2` and
`credentialSubject.id` (the holder DID). The API encrypts `vcData` server-side
(AES-256-GCM) before anchoring. `sourcePublicKey` must be the issuer.

The holder is `credentialSubject.id`. There is no separate `holder` field.

## Batch issue

`POST /contracts/vc/batch-issue` - 1 to 5 credentials into one owner's vault.

```json
{
  "owner": "G...",
  "issuer": "G...",
  "issuerDid": "did:stellar:testnet:...",
  "sourcePublicKey": "G...",
  "vcs": [
    { "vcId": "credential-1", "vcData": "{...credentialSubject.id...}" },
    { "vcId": "credential-2", "vcData": "{...credentialSubject.id...}" }
  ]
}
```

## Revoke

`POST /contracts/vc/revoke` - signed by the vault owner (`owner.require_auth()`).

```json
{ "owner": "G...", "vcId": "credential-123", "date": "2026-01-15T00:00:00.000Z", "sourcePublicKey": "G..." }
```

`date` is optional (ISO-8601; defaults to now).

## Verify

`POST /contracts/vault/verify-vc` - read, no signing, open to any valid key.

```json
{ "owner": "G...", "vcId": "credential-123" }
```

Response: `{ "status": "valid" | "revoked" | "invalid", "since": "..." }`.
`verify-vc` returns status only, never contents.

## Issuer DID requirement

The `issuerDid` must be a registered, resolvable `did:stellar` whose on-chain
controller equals the signing `issuer`. Bare wallet addresses and `did:pkh` are
rejected. A mismatch returns `issuerDid_controller_mismatch`. See `did.md`.

## Fees

Issuance charges an on-chain fee via the factory `quote_fee`, paid by the issuer:
testnet 5 XLM per credential, mainnet 1 USDC per credential (mainnet needs a USDC
trustline + balance). No fee override is accepted in any request body.

## Creating an API key

`POST /public/api-keys` (standard role, 6-month expiry). Origin-restricted to
`https://dapp.acta.build` plus localhost; other origins get `403 forbidden_origin`.
Easiest path is the dApp UI.

```bash
curl -X POST https://api.testnet.acta.build/public/api-keys \
  -H "Content-Type: application/json" \
  -d '{ "name": "My Testnet Key", "wallet_address": "G...", "metadata": { "network": "testnet" } }'
```

Response includes `api_key` (shown once). One key per wallet per network:
re-creating rotates and revokes the old one. `metadata.network` must match the
host, or you get `400 network_mismatch`.

## `GET /config`

Public bootstrap, no key, no rate limit:

```json
{
  "rpcUrl": "https://soroban-testnet.stellar.org:443",
  "networkPassphrase": "Test SDF Network ; September 2015",
  "networkType": "testnet",
  "factoryContractId": "C...",
  "vaultWasmHash": "2bd0323a...",
  "didStellarRegistryId": "C...",
  "actaContractId": "C..."
}
```

## Rate limits

Per API key, sliding 60s window, separate read/write buckets by role:

| Role | Reads/min | Writes/min |
|------|-----------|------------|
| standard | 60 | 20 |
| early | 300 | 100 |
| admin | 200 | 50 |

Public key creation: 5/min/IP. Watch `X-RateLimit-*` (reads),
`X-WriteRateLimit-*` (writes), and `Retry-After` on 429.

## Errors

JSON envelope `{ error, message, details?, request_id, retry_after? }`. Branch on
`error`, never on `message`. Full list: `errors.md`.
