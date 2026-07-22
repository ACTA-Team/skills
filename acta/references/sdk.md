# SDK reference: `@acta-team/credentials`

React provider + hooks + HTTP client for ACTA. ESM and CJS with TypeScript
declarations. `ActaConfig` is a client component (`"use client"`), compatible
with the Next.js App Router. The network is selected by `baseURL` (`mainNet` vs
`testNet`); any custom string is also accepted (staging, localhost).

> Older references to `@acta-team/acta-sdk` point at the same surface. Always
> install and import `@acta-team/credentials`.

## Install

```bash
npm install @acta-team/credentials
# pnpm add @acta-team/credentials / yarn add @acta-team/credentials
```

## Exports

- `ActaConfig` - provider. Required `baseURL`; optional `apiKey`.
- `useActaClient` - returns the contextual `ActaClient` (must render under `ActaConfig`).
- Hooks: `useVault`, `useCredential`, `useVaultRead`.
- `ActaClient` - direct client, including methods the hooks do not wrap.
- URLs: `mainNet`, `testNet` (string constants for the two API hosts).
- Errors: `ActaApiError`, `normalizeError`.
- Identity: `getOrCreateIssuerIdentity` / `getIssuerIdentity` on the client, plus
  storage helpers `IndexedDbIssuerIdentityStorage`, `InMemoryIssuerIdentityStorage`,
  `autoSelectStorage`.
- Guards: `isTxPrepareResponse`, `isTxSubmitResponse`.
- Subpath exports: `@acta-team/credentials/types`, `@acta-team/credentials/hooks`.

## Provider

```tsx
import { ActaConfig, mainNet } from "@acta-team/credentials";

export function App() {
  return <ActaConfig baseURL={mainNet}>{/* your app */}</ActaConfig>;
}
```

Pass `apiKey` on the provider to skip env-based resolution.

## API key resolution

If you do not pass `apiKey` on `ActaConfig`, the client resolves it in order:

1. Network-specific: `ACTA_API_KEY_MAINNET`, `ACTA_API_KEY_TESTNET`
2. Fallback: `ACTA_API_KEY`

The key is sent as the `X-ACTA-Key` header. Construction throws if no key is found.

## The signer

Every write takes a `signTransaction` callback. It receives the unsigned XDR and
must return the signed XDR string.

```ts
type Signer = (
  unsignedXdr: string,
  opts: { networkPassphrase: string }
) => Promise<string>;
```

Freighter example:

```ts
import { signTransaction } from "@stellar/freighter-api";

const sign: Signer = async (xdr, { networkPassphrase }) =>
  (await signTransaction(xdr, { networkPassphrase })).signedTxXdr;
```

Any Stellar wallet works. See https://stellarwalletskit.dev for Freighter,
Albedo, WalletConnect, and more.

## `useCredential()`

```ts
const { issue, revoke } = useCredential();
```

### issue(args) -> Promise<{ txId: string }>

Stores the payload in the owner's vault and marks it valid, in one transaction.

| Field | Required | Notes |
|-------|----------|-------|
| `owner` | yes | Vault owner: `G...` account or `C...` smart-wallet contract id |
| `vcId` | yes | Unique id, max 64 chars |
| `vcData` | yes | JSON string or object; `@context` is added if missing |
| `issuer` | yes | Issuer Stellar public key |
| `issuerDid` | no | Registered, resolvable `did:stellar`; auto-onboarded if omitted |
| `signTransaction` | yes | Signer |
| `sourcePublicKey` | no | Explicit `G` signer; omit for defaults / relayer-signed `C` flows |
| `userSalt` | no | 32-byte hex salt selecting a non-default vault |
| `contractId` | no | Vault contract override; default is the derived vault |

The holder is `credentialSubject.id` inside `vcData`. The SDK auto-onboards the
issuer `did:stellar` via `getOrCreateIssuerIdentity` when `issuerDid` is omitted.

### revoke(args) -> Promise<{ txId: string }>

Signed by the vault owner. Fields: `owner`, `vcId`, `signTransaction`, optional
`date` (ISO; defaults to now), `sourcePublicKey`, `userSalt`, `contractId`.

## `useVault()`

```ts
const { createVault, denyIssuer, allowIssuer } = useVault();
// back-compat aliases: authorizeIssuer == allowIssuer, revokeIssuer == denyIssuer
```

- `createVault({ owner, ownerDid, signTransaction, sourcePublicKey?, userSalt?, contractId? })`
  - Deploys the owner's vault. Address derives from `(factory, owner, userSalt)`.
    Omit `userSalt` for the canonical vault.
- `denyIssuer({ owner, issuer, signTransaction, sourcePublicKey?, userSalt? })`
  - Blocks an issuer (issuance is open by default, so this is deny-by-exception).
- `allowIssuer({ owner, issuer, signTransaction, sourcePublicKey?, userSalt? })`
  - Unblocks a previously denied issuer.

For `G` owners, `sourcePublicKey` defaults to `owner`. For `C` owners, signing is
delegated to the relayer per API rules.

## `useVaultRead()`

Read-only; no signing, but a valid API key is required.

```ts
const { listVcIds, getVc, verifyVc } = useVaultRead();
```

- `listVcIds({ owner, contractId? })` -> `string[]`
- `getVc({ owner, vcId, contractId? })` -> `unknown | null` (null if not found)
- `verifyVc({ owner, vcId, contractId? })` -> `{ status: "valid" | "revoked" | "invalid"; since?: string }`

Ownership: `listVcIds` and `getVc` only work for the owner bound to your API key
(the API enforces it). `verifyVc` works for any owner. These hooks always read the
canonical vault; to read a non-default vault pass its resolved address as `contractId`.

## `ActaClient`

The HTTP client under every hook. Use it directly for methods hooks do not wrap
(`vaultSetDid`, `vaultPush`, `vaultSetNewOwner`, `sponsoredVaultCreate`), for
manual prepare/submit control, or outside React.

```ts
// Inside React (shares provider baseURL + key):
import { useActaClient } from "@acta-team/credentials";
const client = useActaClient();

// Outside React:
import { ActaClient, testNet } from "@acta-team/credentials";
const client = new ActaClient(testNet, process.env.ACTA_API_KEY);
```

Constructor: `new ActaClient(baseURL, apiKey?, identityOptions?)`. Network is
inferred from the URL. Requests time out after 30s; every failure rejects with
`ActaApiError`.

### Info & config

| Method | Returns |
|--------|---------|
| `getNetwork()` | `"mainnet"` or `"testnet"` |
| `getHealth()` | `GET /health` |
| `getConfig()` | `GET /config`, cached ~5 min |
| `clearConfigCache()` | Drops the cached config |

`getConfig()` returns `{ rpcUrl, networkPassphrase, networkType,
factoryContractId, vaultWasmHash, didStellarRegistryId, actaContractId }`.
`actaContractId` is a back-compat alias of `factoryContractId`.

### Issuer identity

| Method | Purpose |
|--------|---------|
| `getOrCreateIssuerIdentity({ controller, signTransaction })` | Returns the stored identity or mints + registers a new `did:stellar` (one wallet signature) |
| `getIssuerIdentity(controller)` | Returns the stored identity or `null`; never registers |

### Read methods

| Method | Endpoint |
|--------|----------|
| `vaultListVcIdsDirect({ owner, contractId? })` | `POST /contracts/vault/list-vc-ids` |
| `vaultGetVcDirect({ owner, vcId, contractId? })` | `POST /contracts/vault/get-vc` |
| `vaultVerify({ owner, vcId, vaultContractId? })` | `POST /contracts/vault/verify-vc` |
| `getContractVersion({ owner?, sourcePublicKey?, contractId? })` | `GET /contracts/version` |

### Write methods (prepare/submit)

Each write accepts either the prepare object (operation fields) or `{ signedXdr }`
to submit. Return type is `TxResponse`: `{ xdr, network }` (prepare) or
`{ tx_id }` (submit). Use `isTxPrepareResponse` / `isTxSubmitResponse` to branch.

| Method | Endpoint | Prepare fields |
|--------|----------|----------------|
| `vaultCreate` | `/contracts/vault/create` | `owner`, `didUri`, `sourcePublicKey?`, `userSalt?` |
| `vcIssue` | `/contracts/vc/issue` | `owner`, `vcId`, `vcData`, `issuer`, `issuerDid?`, `sourcePublicKey?`, `userSalt?` |
| `revokeCredentialViaApi` | `/contracts/vc/revoke` | `owner`, `vcId`, `date?`, `sourcePublicKey?`, `userSalt?` |
| `vaultDenyIssuer` / `vaultAllowIssuer` | `/contracts/vault/deny-issuer` / `allow-issuer` | `owner`, `issuer`, `sourcePublicKey?`, `userSalt?` |
| `vaultRevokeVault` | `/contracts/vault/revoke-vault` | `owner`, `sourcePublicKey`, `userSalt?` |
| `vaultSetNewOwner` | `/contracts/vault/set-new-owner` | `owner`, `newOwner`, `sourcePublicKey` |
| `vaultSetDid` | `/contracts/vault/set-vault-did` | `owner`, `didUri`, `sourcePublicKey?`, `userSalt?`, `vaultContract?` |
| `vaultPush` | `/contracts/vault/push` | `fromOwner`, `toOwner`, `vcId`, `issuer`, `sourcePublicKey` |
| `sponsoredVaultCreate` | `/contracts/sponsored-vault/create` | `sponsor`, `owner`, `didUri`, `sourcePublicKey` (admin key required) |

Manual prepare/submit:

```ts
import { isTxPrepareResponse, isTxSubmitResponse } from "@acta-team/credentials";

const prepared = await client.vaultSetDid({
  owner: "G...", didUri: "did:stellar:testnet:...", sourcePublicKey: "G...",
});
if (!isTxPrepareResponse(prepared)) throw new Error("prepare failed");

const signedXdr = await sign(prepared.xdr, { networkPassphrase: prepared.network });

const result = await client.vaultSetDid({ signedXdr });
if (isTxSubmitResponse(result)) console.log(result.tx_id);
```

## Server-side identity storage (important)

DID auto-onboarding persists the issuer identity:

- Browser: IndexedDB, private key encrypted at rest.
- Node / server: the default storage is in-memory, so a new DID is minted on
  every restart. Server integrators must supply a persistent
  `IssuerIdentityStorage` via `ActaClientIdentityOptions.storage`.

`identityOptions` (`ActaClientIdentityOptions`): `storage`, `rpcUrl`,
`registryContractId`, `allowHttp` (default false), `timeoutMs` (30000),
`configCacheTtlMs` (300000).

## Error handling

Every failing request rejects with `ActaApiError`: `status`, `code`, `requestId?`,
`isTimeout`, `isNetworkError`, `details?`. Convert unknown errors with
`normalizeError(err)`. See `errors.md` for the full code list.

```ts
import { ActaApiError, normalizeError } from "@acta-team/credentials";

try {
  await issue({ /* ... */ });
} catch (e) {
  const err = normalizeError(e);
  if (err.code === "issuerDid_controller_mismatch") {
    // sign with the wallet that controls the DID
  }
}
```

## Deprecated (removed in 2.0.0)

`createCredential`, `getDefaults`, `prepareStoreTx`, `prepareListVcIdsTx`,
`prepareGetVcTx`, `vaultStore`. Migrate to `vcIssue`, `getConfig`,
`vaultListVcIdsDirect`, `vaultGetVcDirect`, or the hooks.
