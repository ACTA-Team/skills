# did:stellar reference

`did:stellar` is a W3C Decentralized Identifier method built on Stellar, developed
by ACTA and registered in the W3C DID Extensions registry as the `stellar` method.
Its state lives in a Soroban registry contract, so anyone can resolve and verify a
DID with only a Stellar RPC endpoint and the registry contract id.

It is the mandatory issuer identity for ACTA credential issuance. Bare wallet
addresses (`G...`) and `did:pkh` are not accepted as the issuer DID.

## Why it matters for issuance

- `POST /contracts/vc/issue` requires an `issuerDid` that resolves on the
  network's registry and whose on-chain controller equals the signing issuer,
  otherwise the API returns `issuerDid_controller_mismatch`.
- The Credentials SDK auto-onboards it: calling `issue` without `issuerDid`
  generates keys, registers a `did:stellar` with one wallet signature, and reuses
  it afterwards. Integrators should NOT reimplement DID onboarding in the app.
- The dApp guides registration with a single wallet signature.

## Syntax

```
did:stellar:{network}:{didId}
```

| Part | Rule |
|------|------|
| `network` | `mainnet` or `testnet` (closed set, no aliases) |
| `didId` | 16 random bytes as RFC 4648 base32 lowercase, no padding: exactly 26 chars of `[a-z2-7]` |

Validation regex: `^did:stellar:(mainnet|testnet):([a-z2-7]{26})$`

Example (real, permanently resolvable testnet DID):
`did:stellar:testnet:znfxngsh46vkyqu6inrx4omphi`

## The DID is not your wallet

The 128-bit `didId` is opaque and not derived from any Stellar account:

- The DID string survives key rotation. `transfer_controller` hands control to a
  new wallet and the DID string does not change.
- One wallet can control many DIDs.
- The controlling wallet appears only as the `controller` in the on-chain record,
  never inside the DID string.

## Controller model

The controller is a classic Stellar account (`G...`). Every mutation (`update`,
`transfer_controller`, `deactivate`) requires the current controller's signature
on-chain (`controller.require_auth()`). The HTTP resolver has no privileged role.

## DID document

Resolving yields a W3C DID Core 1.1 document. Keys use Multikey; verification
relationships hold fragment references (`#auth-1`, `#assert-1`, `#keyagr-1`).
`didDocumentMetadata.method.stellarAccount` exposes the controller account, which
is how a verifier binds the DID to a wallet.

## Key types

| Relationship | Curve | Multibase prefix | Count |
|--------------|-------|------------------|-------|
| `authentication` | Ed25519 | `z6Mk...` | 1 to 3 (at least 1) |
| `assertionMethod` | Ed25519 | `z6Mk...` | 0 to 3 |
| `keyAgreement` | X25519 | `z6LS...` | 0 or 1 |

The same key may appear in more than one relationship. The idiomatic issuer shape
is one Ed25519 key in both `authentication` and `assertionMethod`.

## Roles

- Holder: `authentication` key only.
- Issuer: `authentication` plus at least one `assertionMethod` key (mandatory; W3C
  verifiers reject credentials signed without an assertion key).
- DIDComm recipient: adds an X25519 `keyAgreement` key.

## Lifecycle

| Operation | Signed by | Notes |
|-----------|-----------|-------|
| `register` | Controller | Creates the DID; `version` starts at 1 |
| `update` | Controller | Full record replacement; requires `expectedVersion` |
| `transfer_controller` | Controller | Rotates the wallet; DID string unchanged |
| `deactivate` | Controller | Irreversible; DID resolves as a tombstone (HTTP 410) |

Every mutation increments `version` (optimistic concurrency). A stale
`expectedVersion` fails with `version_mismatch`.

## Resolving a DID (verifying an issuer)

The hosted resolver is a stateless convenience, not a gatekeeper.

```bash
curl https://did.acta.build/1.0/identifiers/did:stellar:mainnet:...
```

- The result exposes the controller wallet
  (`didDocumentMetadata.method.stellarAccount`) and the issuer's public keys.
- A deactivated DID resolves with HTTP `410`.
- The ACTA API already enforces, at issuance time, that the DID's on-chain
  controller equals the wallet that signed the issue transaction.

To trust a received credential: verify status on-chain (see `api.md` verify) AND
resolve its issuer DID to confirm the issuer is who you expect.

## Proof of Control (DID login)

An off-chain challenge/response protocol shipped in the TypeScript library:

1. Verifier issues a challenge `{ did, domain, nonce, timestamp }`.
2. Signer canonicalizes with JCS (RFC 8785) and signs with an Ed25519
   `authentication` key (signature base64url, no padding).
3. Verifier checks: timestamp within a 5-minute window, domain match, nonce
   freshness, and the signature against every `authentication` key of the resolved
   document.

## Separation of concerns

The credentials API deliberately does not import the DID library; identity and
credentials evolve as separate trust domains. Full method docs (registry,
resolver, TypeScript library) live in the DID section of https://docs.acta.build.
