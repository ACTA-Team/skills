# ACTA Agent Skills

Official [Agent Skills](https://www.skills.sh) for building with
[ACTA](https://acta.build), the non-custodial Verifiable Credentials
infrastructure on the Stellar blockchain.

A skill is reusable context that teaches an AI coding agent (Claude Code, Cursor,
Copilot, Windsurf, Gemini, and others) how to do something correctly. Install one
and your agent stops guessing about ACTA: package names, base URLs, the
prepare/submit flow, `did:stellar` issuer identity, error codes, and the security
model come from the docs, not from stale training data.

**Browse on skills.sh:** [skills.sh/acta-team/skills](https://www.skills.sh/acta-team/skills)
· **Docs:** [docs.acta.build/en/agent-skills](https://docs.acta.build/en/agent-skills)

## Skills in this repo

| Skill | Page | What it does |
|-------|------|--------------|
| [`stellar-verifiable-credentials`](./stellar-verifiable-credentials) | [skills.sh](https://www.skills.sh/acta-team/skills/stellar-verifiable-credentials) | End-to-end ACTA integration: issue, verify, and revoke W3C Verifiable Credentials with the `@acta-team/credentials` SDK or the REST API; create single-tenant vaults; manage issuer allow/deny; resolve `did:stellar`; handle errors; understand the security model. |

## Install

Install into any supported agent with the skills CLI:

```bash
# Install every skill in this repo
npx skills add ACTA-Team/skills

# Or install just the credentials skill
npx skills add ACTA-Team/skills/stellar-verifiable-credentials
```

The CLI writes the skill into your agent's skills directory (for example
`.claude/skills/` for Claude Code) and the agent picks it up automatically. See
the [skills.sh docs](https://www.skills.sh/docs) for per-agent details.

### Manual install

Each skill is a self-contained folder with a `SKILL.md`. You can also copy the
`stellar-verifiable-credentials/` folder directly into your agent's skills
directory.

## What the `stellar-verifiable-credentials` skill covers

- The `@acta-team/credentials` React SDK: `ActaConfig`, `useCredential`,
  `useVault`, `useVaultRead`, `useActaClient`, and `ActaClient`.
- The REST API: `/contracts/*` endpoints, the `X-ACTA-Key` header, the
  prepare/submit XDR flow, ownership rules, rate limits, and idempotency.
- `did:stellar` issuer and holder identity, resolution, and issuer verification.
- Vaults: single-tenant, deterministic addressing, sponsored vaults, and push.
- Error handling: HTTP codes, validation, issuer-DID errors, contract errors, and
  the mainnet USDC fee failures.
- The security and data model: who signs what, what is on-chain vs encrypted.

The skill is structured for progressive disclosure.
`stellar-verifiable-credentials/SKILL.md` is the entry point; deeper material
lives in `stellar-verifiable-credentials/references/`, with runnable code in
`stellar-verifiable-credentials/examples/`.

## Source of truth

These skills are distilled from the official documentation at
[docs.acta.build](https://docs.acta.build), which is also queryable live through
the `@acta-team/docs-mcp` MCP server:

```json
{
  "mcpServers": {
    "acta-docs": { "command": "npx", "args": ["-y", "@acta-team/docs-mcp"] }
  }
}
```

When a detail in a skill conflicts with the live docs, the live docs win.

## Safety and scope

These skills are documentation only. They are passive context an agent reads
while writing code:

- **No execution.** No runnable automation, no install hooks, no network calls.
  Files under `examples/` are illustrative snippets for a developer to adapt.
- **No secrets.** Nothing here asks for, stores, logs, or transmits a secret key,
  seed phrase, or API key. API keys come from the integrator's own environment.
- **No custody, no signing.** ACTA is non-custodial: its API returns an *unsigned*
  transaction (XDR), the end user's own Stellar wallet signs it locally, and the
  signed result is submitted. Neither ACTA nor these skills ever hold a private
  key or can authorize a transfer.
- **No payments initiated.** The on-chain issuance fee (5 XLM on testnet, 1 USDC
  on mainnet) is charged by the vault contract and paid by the integrator's own
  issuer wallet under that wallet's own signature. The skill only documents it.

Because the subject matter is credential issuance on a blockchain, the content
necessarily references wallet signing and on-chain fees. That is documented
subject matter, not a capability these skills hold.

## Contributing

Issues and pull requests are welcome. Keep skills accurate to the current ACTA
release, favor concise `SKILL.md` files with detail pushed into `references/`, and
review any executable content before you install it.

## License

[MIT](./LICENSE)
