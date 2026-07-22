---
name: acta
description: >-
  Integrate ACTA verifiable credentials infrastructure on the Stellar blockchain.
  Use this skill whenever the user works with ACTA, the @acta-team/credentials SDK,
  did:stellar identities, credential vaults, or the ACTA REST API (api.testnet.acta.build /
  api.mainnet.acta.build). Covers issuing, verifying, and revoking W3C Verifiable
  Credentials, creating single-tenant vaults, managing issuer permissions, resolving
  did:stellar, error handling, and the security model. Trigger terms: ACTA, verifiable
  credentials, VC, credential vault, did:stellar, Soroban credentials, Stellar credentials,
  issue credential, verify credential, X-ACTA-Key.
license: MIT
metadata:
  version: 1.0.0
  homepage: https://docs.acta.build
  repository: https://github.com/ACTA-Team/skills
  package: "@acta-team/credentials"
  networks: [testnet, mainnet]
---

# ACTA: Verifiable Credentials on Stellar

ACTA is non-custodial Verifiable Credentials infrastructure for the Stellar
blockchain. Soroban smart contracts hold the credential lifecycle on-chain; an
app drives them through the ACTA REST API or the React SDK. This skill lets you
build correct ACTA integrations without guessing.

Authoritative source: https://docs.acta.build (also queryable via the
`@acta-team/docs-mcp` MCP server). When a detail here conflicts with the live
docs, the live docs win.

## When to use this skill

Use it when the task involves any of:

- Issuing, verifying, or revoking credentials with ACTA.
- The `@acta-team/credentials` React SDK (`ActaConfig`, `useCredential`,
  `useVault`, `useVaultRead`, `useActaClient`, `ActaClient`).
- The ACTA REST API (`/contracts/*`, `X-ACTA-Key` header, prepare/submit XDR flow).
- `did:stellar` issuer or holder identity.
- Credential vaults, issuer allow/deny, sponsored vaults, or credential push.

Do NOT use it for non-Stellar credential systems, or for generic Soroban work
unrelated to ACTA.

## Non-negotiable rules

These are the mistakes that break ACTA integrations. Follow them exactly.

1. **Package name is `@acta-team/credentials`.** Never `@acta-team/acta-sdk`
   (that name points at the same surface but is a stale reference). Never invent
   another package.
2. **Base URLs are host-per-network:**
   `https://api.testnet.acta.build` and `https://api.mainnet.acta.build`.
   Never use the legacy `acta.build/api/{network}` shape.
3. **Every `/contracts/*` request needs an API key** in the `X-ACTA-Key` header.
   Keys are 64-char hex, one per wallet per network, 6-month expiry. Create them
   in the dApp (https://dapp.acta.build), not by hardcoding.
4. **Issuer identity must be a registered, resolvable `did:stellar`.** Bare
   wallet addresses (`G...`) and `did:pkh` are rejected as the issuer DID. The
   SDK auto-onboards the issuer DID for you; do not build DID onboarding by hand
   in the app.
5. **Non-custodial: prepare/submit everywhere.** ACTA never holds private keys.
   Write operations return an unsigned XDR; the user's wallet signs it locally;
   the signed XDR is submitted back. Never send or log a secret key.
6. **The holder lives inside `vcData` as `credentialSubject.id` (a DID).** There
   is no separate `holder` or wallet field on issue requests.
7. **Vaults are single-tenant and deterministic.** Each owner has one canonical
   vault, derived from `(factory, owner, userSalt)` with `userSalt` defaulting to
   32 zero bytes. You pass `owner`, not a vault address. Only pass a custom
   `userSalt` if the user intentionally runs more than one vault.
8. **Issuance is open by default (deny-by-exception).** There is no allow-list.
   Owners block a specific issuer with `denyIssuer` and unblock with `allowIssuer`.
9. **Issuance charges an on-chain fee paid by the issuer:** 5 XLM per credential
   on testnet, 1 USDC per credential on mainnet (mainnet issuer needs a USDC
   trustline and balance). The API does not accept a fee override.

## The fastest correct path (React SDK)

The SDK is the shortest integration. Full runnable version:
`examples/react-quickstart.tsx`.

```bash
npm install @acta-team/credentials
```

```tsx
"use client";
import { ActaConfig, testNet } from "@acta-team/credentials";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ActaConfig baseURL={testNet} apiKey={process.env.NEXT_PUBLIC_ACTA_API_KEY}>
      {children}
    </ActaConfig>
  );
}
```

End-to-end flow (identity -> vault -> issue -> verify):

```tsx
import {
  useActaClient, useVault, useCredential, useVaultRead,
} from "@acta-team/credentials";
import { signTransaction } from "@stellar/freighter-api";

const client = useActaClient();
const { createVault } = useVault();
const { issue } = useCredential();
const { verifyVc } = useVaultRead();

const sign = async (xdr: string, o: { networkPassphrase: string }) =>
  (await signTransaction(xdr, { networkPassphrase: o.networkPassphrase })).signedTxXdr;

// 1. Issuer identity (one wallet signature, first time only; reused after)
const identity = await client.getOrCreateIssuerIdentity({
  controller: wallet, signTransaction: sign,
});

// 2. Vault (one-time per wallet; "already exists" is safe to treat as success)
try {
  await createVault({ owner: wallet, ownerDid: identity.did, signTransaction: sign });
} catch { /* vault already exists */ }

// 3. Issue (issuer pays the on-chain fee in the same tx)
await issue({
  owner: wallet,
  vcId: "employee-badge-001",          // unique, max 64 chars
  vcData: {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential"],
    credentialSubject: { id: identity.did, name: "Ada Lovelace", role: "Engineer" },
  },
  issuer: wallet,
  signTransaction: sign,               // issuerDid is auto-filled from step 1
});

// 4. Verify (free read; open to any valid API key)
const status = await verifyVc({ owner: wallet, vcId: "employee-badge-001" });
// { status: "valid" | "revoked" | "invalid", since?: string }
```

Going to mainnet: switch `baseURL` to `mainNet`, create a mainnet API key, and
make sure the issuer wallet holds USDC with a trustline.

## The REST API path (any language)

Use this when there is no React app. Every write is prepare then submit; sign the
returned `xdr` with the returned `network` passphrase in between. Full examples:
`examples/api-curl.sh`.

```bash
# Verify a credential (read; no signing; open to any valid key)
curl -X POST https://api.testnet.acta.build/contracts/vault/verify-vc \
  -H "X-ACTA-Key: $ACTA_KEY" -H "Content-Type: application/json" \
  -d '{ "owner": "G...", "vcId": "employee-badge-001" }'
# -> { "status": "valid", "since": "2026-01-01T00:00:00.000Z" }
```

Prepare returns `{ xdr, network }`; submit (same endpoint, body `{ "signedXdr": "..." }`)
returns `{ tx_id }`. Set an `Idempotency-Key` header on writes to make retries safe.

## Verifying a credential you received

Three ways, from zero-tooling to programmatic. Verification proves a credential
with that id exists in that owner's vault and its current status (valid / revoked
/ invalid). It does NOT by itself prove who issued it, so also check the issuer's
`did:stellar`. Details and issuer-DID resolution: `references/did.md` and the
verification section of `references/api.md`.

1. **Share link / QR** opens a public page on `dapp.acta.build`; status is always
   re-checked on-chain. No tools needed.
2. **`POST /contracts/vault/verify-vc`** with any valid API key. Returns status only.
3. **SDK `verifyVc`** in a React app.

## Reference map (read on demand)

Keep this file lean; open the reference that matches the task:

- `references/sdk.md` - full `@acta-team/credentials` surface: `ActaConfig`,
  every hook, `ActaClient` methods, env-var key resolution, server-side identity
  storage, deprecated methods.
- `references/api.md` - REST endpoints, auth, ownership rules, rate limits,
  idempotency, `/config` and `/health`, API-key creation.
- `references/did.md` - `did:stellar` syntax, DID document, controller model,
  lifecycle, issuer vs holder shape, resolution and issuer verification.
- `references/errors.md` - HTTP error envelope, validation codes, issuer-DID
  errors, contract error codes (vault / factory / registry), USDC fee failures.
- `references/security.md` - who signs what, what lives on-chain vs encrypted,
  the trust and immutability model, going to production.

Examples: `examples/react-quickstart.tsx`, `examples/api-curl.sh`,
`examples/verify.ts`. Template: `assets/vc-template.json`.

## Common failure modes and the fix

- `401` on a `/contracts/*` call -> missing or expired `X-ACTA-Key`; create a key
  in the dApp and send it on every request.
- `403` ownership violation on issue / get-vc / list-vc-ids -> the request `owner`
  must equal the wallet bound to your API key (admin keys are exempt).
- `issuerDid_controller_mismatch` -> sign with the wallet that controls the DID.
- `issuerDid_unresolvable` -> the DID is not registered on this network; register
  it (or let the SDK auto-onboard) before issuing.
- `vault_already_exists` (409) on create -> safe; treat as success.
- `vc_already_exists` (409) on issue -> pick a new `vcId`.
- Mainnet issue fails with "trustline missing" / "balance not sufficient" -> add a
  USDC trustline to the issuer wallet and top it up.
- Node/server mints a new DID on every restart -> supply a persistent
  `IssuerIdentityStorage`; the default server storage is in-memory (see
  `references/sdk.md`).
