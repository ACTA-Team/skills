#!/usr/bin/env bash
#
# ACTA REST API walkthrough with curl (no SDK).
# Every write is prepare -> sign -> submit. This script shows prepare + verify;
# the signing step happens in your Stellar wallet and is out of scope for curl.
#
# Set these first:
#   export ACTA_BASE="https://api.testnet.acta.build"   # or https://api.mainnet.acta.build
#   export ACTA_KEY="<64-char-hex-key>"                 # create one in the dApp
#   export OWNER="G..."                                 # your wallet (bound to the key)
#   export ISSUER="$OWNER"
#   export ISSUER_DID="did:stellar:testnet:..."         # registered, resolvable
set -euo pipefail

: "${ACTA_BASE:?set ACTA_BASE}"
: "${ACTA_KEY:?set ACTA_KEY}"
: "${OWNER:?set OWNER}"

VC_ID="employee-badge-001"

echo "== health (public, no key) =="
curl -sS "$ACTA_BASE/health"; echo

echo "== config (public bootstrap, no key) =="
curl -sS "$ACTA_BASE/config"; echo

echo "== prepare: create vault =="
# Returns { xdr, network }. Sign xdr with the network passphrase, then submit
# the same endpoint with { "signedXdr": "..." } to get { tx_id }.
curl -sS -X POST "$ACTA_BASE/contracts/vault/create" \
  -H "X-ACTA-Key: $ACTA_KEY" -H "Content-Type: application/json" \
  -d "{ \"owner\": \"$OWNER\", \"didUri\": \"${ISSUER_DID:-did:stellar:testnet:...}\", \"sourcePublicKey\": \"$OWNER\" }"
echo

echo "== prepare: issue credential =="
# vcData must include @context (>= w3.org/ns/credentials/v2) and credentialSubject.id (holder DID).
VC_DATA='{"@context":["https://www.w3.org/ns/credentials/v2"],"type":["VerifiableCredential"],"credentialSubject":{"id":"did:stellar:testnet:...","name":"Ada Lovelace"}}'
curl -sS -X POST "$ACTA_BASE/contracts/vc/issue" \
  -H "X-ACTA-Key: $ACTA_KEY" -H "Content-Type: application/json" \
  -H "Idempotency-Key: issue-$VC_ID-001" \
  -d "$(cat <<JSON
{
  "owner": "$OWNER",
  "vcId": "$VC_ID",
  "vcData": $(printf '%s' "$VC_DATA" | python -c 'import json,sys;print(json.dumps(sys.stdin.read()))'),
  "issuer": "${ISSUER:-$OWNER}",
  "issuerDid": "${ISSUER_DID:-did:stellar:testnet:...}",
  "sourcePublicKey": "$OWNER"
}
JSON
)"
echo

echo "== verify (read; open to any valid key) =="
curl -sS -X POST "$ACTA_BASE/contracts/vault/verify-vc" \
  -H "X-ACTA-Key: $ACTA_KEY" -H "Content-Type: application/json" \
  -d "{ \"owner\": \"$OWNER\", \"vcId\": \"$VC_ID\" }"
echo

echo "== list ids (owner-bound: owner must match the key's wallet) =="
curl -sS -X POST "$ACTA_BASE/contracts/vault/list-vc-ids" \
  -H "X-ACTA-Key: $ACTA_KEY" -H "Content-Type: application/json" \
  -d "{ \"owner\": \"$OWNER\" }"
echo
