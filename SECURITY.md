# Security Policy

This repository holds ACTA's agent skills — instructions loaded into AI coding
assistants to help developers integrate ACTA. Skills are **instructions, not
executables**, but they influence code that developers then ship. That is the
attack surface worth thinking about.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| Current `main` | :white_check_mark: |
| Any older commit or tag | :x: |

Skills are distributed from `main`, not versioned releases. Only the current
state of `main` is supported; a fix is a merged commit.

## Scope

**In scope**

- A skill instructing an assistant to write insecure code — leaking an API key
  into a client bundle, disabling signature verification, skipping ownership
  checks, or logging secrets
- Prompt injection: content that redirects an assistant away from the user's
  intent, exfiltrates repository contents, or induces unrelated actions
- A skill pointing at a wrong or attacker-controllable endpoint, package name,
  or contract address
- Documented examples that are exploitable if copied as written
- Instructions that would cause an assistant to run destructive commands

**Out of scope**

- A skill being incomplete, outdated, or giving unhelpful advice with no
  security consequence — open a normal issue for that
- Vulnerabilities in the assistants themselves — report to their vendors
- Vulnerabilities in ACTA's API, SDK, dApp or contracts, which have their own
  policies

**Why this matters:** a skill that quietly teaches an insecure pattern scales
that pattern across every developer who loads it. We treat that as a real
vulnerability, not a documentation bug.

## Reporting a Vulnerability

**Do not open a public issue for a security report.**

Use GitHub's private reporting:
[**Report a vulnerability**](https://github.com/ACTA-Team/skills/security/advisories/new)

Or email **acta.xyz@gmail.com** with `SECURITY` in the subject.

Include the skill file and section, what an assistant does when it follows it,
and the insecure output it produces. A transcript is the most useful evidence.

### What happens next

| Stage | Timeline |
| ----- | -------- |
| We acknowledge your report | Within **5 business days** |
| We confirm or reject it, with reasoning | Within **15 business days** |
| Fix merged for a confirmed high or critical | Target **14 days** from confirmation |
| Fix merged for moderate or low | Target **90 days** from confirmation |

**If we accept it:** we merge the corrected skill and credit you however you
prefer. If the bad guidance was live long enough to have been widely used, we
say so publicly rather than quietly editing it.

**If we decline it:** we explain why in writing.

### Disclosure

We ask for **90 days** or until the fix is merged, whichever comes first. If
we go quiet, disclose — we will not object.
