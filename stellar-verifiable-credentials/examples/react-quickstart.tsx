"use client";

/**
 * ACTA end-to-end quickstart (React / Next.js App Router).
 *
 * Flow: issuer identity (did:stellar) -> single-tenant vault -> issue -> verify.
 *
 * Prerequisites:
 *   npm install @acta-team/credentials @stellar/freighter-api
 *   - A Freighter wallet on testnet, funded with XLM (issuing costs 5 XLM/credential on testnet).
 *   - A testnet API key created in the dApp (https://dapp.acta.build) -> API Keys.
 *     Put it in NEXT_PUBLIC_ACTA_API_KEY.
 *
 * Switch to mainnet by importing `mainNet` instead of `testNet`, using a mainnet
 * API key, and funding the issuer wallet with USDC (+ trustline; 1 USDC/credential).
 */

import {
  ActaConfig,
  testNet,
  useActaClient,
  useVault,
  useCredential,
  useVaultRead,
  normalizeError,
} from "@acta-team/credentials";
import { signTransaction } from "@stellar/freighter-api";
import { useState } from "react";

// 1. Wrap your tree with the provider (usually in app/providers.tsx).
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ActaConfig baseURL={testNet} apiKey={process.env.NEXT_PUBLIC_ACTA_API_KEY}>
      {children}
    </ActaConfig>
  );
}

// A signer backed by the user's wallet. Any Stellar wallet works.
const sign = async (xdr: string, opts: { networkPassphrase: string }) => {
  const res = await signTransaction(xdr, {
    networkPassphrase: opts.networkPassphrase,
  });
  return res.signedTxXdr;
};

export function IssueDemo({ wallet }: { wallet: string }) {
  const client = useActaClient();
  const { createVault } = useVault();
  const { issue } = useCredential();
  const { verifyVc } = useVaultRead();
  const [log, setLog] = useState<string>("");

  const run = async () => {
    try {
      // 2. Issuer identity: one wallet signature the first time, reused afterwards.
      const identity = await client.getOrCreateIssuerIdentity({
        controller: wallet,
        signTransaction: sign,
      });

      // 3. Vault: one-time per wallet. "already exists" is safe to treat as success.
      try {
        await createVault({
          owner: wallet,
          ownerDid: identity.did,
          signTransaction: sign,
        });
      } catch (e) {
        const err = normalizeError(e);
        if (err.code !== "vault_already_exists") throw e;
      }

      // 4. Issue. issuerDid is auto-filled from step 2. Issuer pays the on-chain fee.
      const vcId = "employee-badge-001";
      await issue({
        owner: wallet,
        vcId,
        vcData: {
          "@context": ["https://www.w3.org/ns/credentials/v2"],
          type: ["VerifiableCredential"],
          credentialSubject: {
            id: identity.did, // the holder DID lives inside vcData
            name: "Ada Lovelace",
            role: "Engineer",
          },
        },
        issuer: wallet,
        signTransaction: sign,
      });

      // 5. Verify (free read; open to any valid API key).
      const status = await verifyVc({ owner: wallet, vcId });
      setLog(`Issued ${vcId}. Status: ${status.status}`);
    } catch (e) {
      const err = normalizeError(e);
      setLog(`Error [${err.code ?? err.status}]: ${err.message}`);
    }
  };

  return (
    <div>
      <button onClick={run}>Issue credential</button>
      <pre>{log}</pre>
    </div>
  );
}
