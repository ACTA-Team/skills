/**
 * Verify an ACTA credential from Node (no React, no wallet).
 *
 *   npm install @acta-team/credentials
 *   ACTA_API_KEY=<64-hex> node --loader ts-node/esm verify.ts <owner> <vcId>
 *
 * verify-vc is open to any valid API key, so third parties can verify credentials
 * they do not own. It returns status only, never the credential contents.
 *
 * To also trust WHO issued it, resolve the issuer's did:stellar (see references/did.md):
 *   curl https://did.acta.build/1.0/identifiers/<issuerDid>
 */

import { ActaClient, testNet, normalizeError } from "@acta-team/credentials";

async function main() {
  const [owner, vcId] = process.argv.slice(2);
  if (!owner || !vcId) {
    console.error("usage: verify.ts <owner G...> <vcId>");
    process.exit(1);
  }

  // Use `mainNet` for mainnet credentials. Key is read from ACTA_API_KEY.
  const client = new ActaClient(testNet, process.env.ACTA_API_KEY);

  try {
    const result = await client.vaultVerify({ owner, vcId });
    // { status: "valid" | "revoked" | "invalid", since?: string }
    console.log(JSON.stringify(result, null, 2));

    if (result.status !== "valid") {
      process.exitCode = 2; // let CI branch on it
    }
  } catch (e) {
    const err = normalizeError(e);
    console.error(`Error [${err.code ?? err.status}]: ${err.message}`);
    process.exit(1);
  }
}

main();
