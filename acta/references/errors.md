# Error reference

Every ACTA API error uses one JSON envelope with a stable, machine-readable code.
Branch on `error`, never on `message`.

```json
{
  "error": "machine_readable_code",
  "message": "Human readable description",
  "details": { "optional": "context" },
  "request_id": "...",
  "retry_after": 30
}
```

- `error` (always): stable code to branch on.
- `message` (usually): human-readable; wording may change.
- `details` (sometimes): structured context.
- `request_id` (always): include it in support requests; `5xx` also carries `trace_id`.
- `retry_after` (on `429`): seconds to wait, mirrored in the `Retry-After` header.

The SDK surfaces these as `ActaApiError` (`status`, `code`, `requestId?`,
`isTimeout`, `isNetworkError`, `details?`); use `normalizeError(err)` on unknown
errors.

## HTTP status codes

| Status | Meaning |
|--------|---------|
| 200 / 201 | Success (201 for submits and key creation) |
| 400 | Invalid parameters or malformed request |
| 401 | Missing, invalid, or expired API key |
| 403 | Role or ownership not allowed, or forbidden origin |
| 404 | Resource or route not found |
| 409 | Conflict (already exists / already revoked / stale state) |
| 410 | Gone (revoked vault) |
| 413 | Payload or field too large |
| 429 | Rate limit exceeded |
| 500 | Internal error (carries `trace_id`) |
| 503 | Dependency unavailable |

## Auth & authorization

| Code | Status | Fix |
|------|--------|-----|
| missing/invalid key | 401 | No / unknown / expired `X-ACTA-Key`. Create a key and send it on every `/contracts/*` request. |
| `forbidden_origin` | 403 | `POST /public/api-keys` from a non-allowlisted Origin. Create keys from the dApp. |
| `network_mismatch` | 400 | `metadata.network` does not match the base URL. Align body and host. |
| ownership violation | 403 | On issue / batch-issue / list-vc-ids / get-vc / push, `owner`/`fromOwner` must equal the key's wallet (admin exempt). Use the right key. |

## Validation (400)

| Code | Meaning |
|------|---------|
| `owner_required` / `owner_invalid` | Missing or malformed vault owner (`G...`) |
| `issuer_required` / `issuer_invalid` | Missing or malformed issuer address |
| `vcId_required` | Missing credential id (max 64 chars) |
| `vcData_required` | Missing payload (max 10,000 chars) |
| `userSalt_invalid` | Salt must be 32 bytes hex (64 hex chars) |
| `vaultContract_invalid` | Must be a valid `C...` id |
| `limit_too_large` | Pagination `limit` above 200 |
| `batch_empty` / `batch_too_large` | Batch must contain 1 to 5 credentials |
| `vcs[i].vcId_too_long` / `vcs[i].vcData_too_long` | A batch entry exceeds the caps |
| `payload_too_large` | Body over the limit (413) |

## Issuer DID (API-level, before any contract)

| Code | Fix |
|------|-----|
| `issuerDid_required` | Register a `did:stellar` (dApp guides it; SDK auto-onboards) and pass it. |
| `issuerDid_invalid` | Use `did:stellar:{network}:{id}`. |
| `issuerDid_unresolvable` | Register the DID on this network before issuing. |
| `issuerDid_controller_mismatch` | Sign with the wallet that controls the DID. |
| `issuerDid_network_mismatch` | Switch network, or use a DID registered on this one. |
| `issuerDid_deactivated` | Register a new DID. |
| `issuerDid_registry_unavailable` | No registry configured for this network; retry later or contact the operator. |

## Rate limiting

| Code | Status | Notes |
|------|--------|-------|
| `rate_limit_exceeded` | 429 | Read bucket exhausted; wait `Retry-After`. |
| `write_rate_limit_exceeded` | 429 | Write bucket exhausted. |
| `rate_limit_unavailable` | 503 | Limiter backend down; retry later. |

## Prepare / submit

| Code | Status | Fix |
|------|--------|-----|
| `signed_xdr_invalid` | 400 | Sign the exact `xdr` from prepare, with the returned network passphrase. |
| `simulation_error` | 400 | Soroban simulation failed; the message carries the on-chain reason (often a contract error below). |
| `tx_submit_error` | 500 | Retry with the same `Idempotency-Key`. |

## Contract errors mapped over HTTP

The API maps `Error(Contract, #N)` to a stable code + HTTP status. The same `#N`
means different things on different contracts, so match the code to the contract.

| Code | Status | Cause |
|------|--------|-------|
| `vault_already_exists` | 409 | Vault already deployed for owner + salt (safe on create). |
| `vault_revoked` | 410 | Vault revoked; writes blocked. |
| `vault_not_initialized` | 404 | No vault for this owner yet; create it first. |
| `vc_not_found` | 404 | No credential with that `vcId`. |
| `vc_already_exists` | 409 | `vcId` already used; pick a new one. |
| `vc_already_revoked` | 409 | Credential already revoked. |
| `issuer_not_authorized` | 403 | Issuer is blocked (denied) for this vault. |
| `invalid_vault_contract` | 400 | `vaultContract` does not match the called vault. |
| `vault_full` | 409 | Vault at max active credentials. |
| `input_too_long` | 413 | A field exceeds its on-chain cap. |
| `batch_too_large` / `batch_empty` | 400 | Batch size outside 1 to 5. |
| `issuer_list_too_long` | 400 | Denied-issuer list full (1,000). |
| `fee_out_of_bounds` | 400 | Batch fee total overflowed. |
| `contract_not_initialized` | 503 | Contract state missing; check network. |
| `no_pending_admin` | 404 | Admin accept without a pending nomination. |

## Raw contract error numbers

If you read raw `Error(Contract, #N)` from RPC/Horizon, the number depends on the
contract. Key ones:

### Vault (vc-vault), deny-by-exception model

`#4` VaultRevoked, `#6` VCNotFound, `#7` VCAlreadyRevoked, `#8` VaultNotInitialized,
`#9` NotInitialized, `#10` InvalidVaultContract, `#12` VCAlreadyExists,
`#13` NoPendingAdmin, `#15` VaultFull, `#16` LimitTooLarge, `#17` BatchTooLarge,
`#18` BatchEmpty, `#19` InputTooLong, `#20` IssuerListTooLong (max 1,000),
`#23` FeeOutOfBounds, `#24` SourceNotAVault, `#25` IssuerDenied,
`#26` PushOwnerMismatch. (`#2`/`#3` retired from the old whitelist model.)

### Factory (vc-vault-factory)

`#1` NoPendingAdmin, `#2` InvalidFeeAmount, `#3` FeeOutOfBounds, `#4` FeeBelowMin,
`#5` FeeNotConfigured, `#6` ExpiryInPast, `#7` NotInitialized.

### did:stellar registry

`#1` DidAlreadyExists, `#2` DidNotFound, `#3` VersionMismatch, `#4` DidDeactivated,
`#5` InvalidAuthKeyCount, `#6` InvalidAssertionKeyCount, `#7` InvalidKeyAgreementCount,
`#8` InvalidServiceCount, `#9` DuplicateKey, and more (see contract-errors in the docs).

## Issuance fee failures (mainnet USDC)

The issuance fee transfer runs inside the fee token contract, so its errors are
about trustlines and balances, not vaults. This is the most common real-world
mainnet issuance failure.

| Symptom | Fix |
|---------|-----|
| "trustline entry is missing for account" | Add a USDC trustline (Circle USDC on mainnet) to the issuer wallet, then retry. |
| "balance is not sufficient" | Top up the issuer wallet with USDC and retry. |

On testnet the fee is native XLM (5 per credential), so no trustline is involved.
Identify a fee failure by the diagnostic text and the token contract id in the
event log, not by a bare `#N`.

Authoritative enums live in `contracts-acta` (`vc-vault`, `vc-vault-factory`,
`did-stellar-registry` `error.rs`). Confirm against the source for your release.
