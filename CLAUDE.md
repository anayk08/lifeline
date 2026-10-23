# Lifeline

SpartHill Hacks 2026, Track 5. Lifeline is a verified, offline-ready resource finder for San José, built as an installable web app (PWA) hosted on AWS Amplify.

## Working style

- Do the work end to end without asking. Involve Anay only for things only they can do: browser sign-ins, approvals the safety rules require (sending real messages, publishing, deleting), and product decisions with no sensible default. Batch any questions into one message.
- Make sensible default choices yourself and mention them briefly afterward.

## AWS account

- This project runs in the hackathon's AWS Workshop Studio event account (8095-4230-6332), not a new-experience project. The global rules about AWS Settings, projects, spend limits and Region lookup don't apply here.
- AWS CLI profile: `lifeline`. Region: `us-east-1`. Create every Regional resource there.
- The event account is deleted when the event ends (around 2026-10-26).

<!-- BEGIN AWS Agent Toolkit rules -->
# AWS Guidance

- Where these AWS rules conflict with the project's own instructions, the
  project's instructions take precedence.
- Prefer the AWS MCP Server for AWS interactions — it provides sandboxed
  execution, observability, and audit logging. If unavailable, use the
  AWS CLI directly.
- Before starting a task, check whether a relevant AWS skill is available.
  Load the skill with `retrieve_skill` and prefer its guidance over
  general knowledge.
- When uncertain about specific AWS details (API parameters, permissions,
  limits, error codes), verify against documentation rather than guessing.
  State uncertainty explicitly if you cannot confirm.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or
  CloudFormation) over direct CLI commands.
- When working with infrastructure, follow AWS Well-Architected Framework
  principles.
- Do not use em dashes in AWS resource names or descriptions. Use
  hyphens instead.

## Secret Safety

- MUST load the `aws-secrets-manager` skill first for any secret,
  credential, API key, token, or password task. MUST NOT call
  `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST
  NOT hit the Secrets Manager Agent daemon directly. MUST use
  `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with
  `asm-exec` so the secret resolves at runtime without entering context.
<!-- END AWS Agent Toolkit rules -->
