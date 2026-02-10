# 🚀 Mirfa Software Engineer Intern Challenge
## Secure Transactions Mini-App (Turbo + Fastify + Vercel)

Welcome 👋

This is **not a coding test**.

This challenge simulates a **real engineering task** you might receive on your first week at Mirfa.

Instead of solving algorithm puzzles, you will:

- structure a real monorepo
- design an API
- implement encryption correctly
- deploy to production
- explain your thinking

If you enjoy building real systems end-to-end, you’ll probably enjoy this 🙂

---

# 🎯 What we evaluate

We care about:

- problem solving
- system design
- clean code
- correctness
- debugging skills
- deployment ability
- ownership & clarity

We **do NOT** care about:

- fancy UI
- perfect styling
- trick algorithms
- memorized LeetCode problems

---

# ⏱ Timebox

Expected effort: **6–10 hours total**

Deadline: **submit within 2–3 days**

You may use:
- Google
- StackOverflow
- ChatGPT / Claude / LLMs

But you **must fully understand and explain your solution**.

If you cannot explain it, we assume you did not build it.

---

# 🧩 What you will build

Create a **TurboRepo monorepo** containing:

apps/web → Next.js frontend
apps/api → Fastify backend
packages/crypto → shared encryption logic


The app should allow a user to:

1. Enter a JSON payload + partyId
2. Encrypt & store it
3. Retrieve encrypted record
4. Decrypt it back to original

Think of this as a **mini secure transaction service**.

---

# 🛠 Tech Requirements

Please use:

- Node.js 20+
- pnpm
- TurboRepo
- Fastify (API)
- Next.js (Web)
- TypeScript
- Vercel deployment

Project must run locally with:

pnpm install
pnpm dev


---

# 📦 Functional Requirements

## Backend (Fastify)

### POST `/tx/encrypt`

Input:

```json
{
  "partyId": "party_123",
  "payload": { "amount": 100, "currency": "AED" }
}
Output: encrypted record

GET /tx/:id
Return stored encrypted record (no decrypt)

POST /tx/:id/decrypt
Return original decrypted payload

Storage can be:

in-memory Map ✅ fine

SQLite/Postgres ✅ bonus

💻 Frontend (Next.js)
Single page is enough:

input: partyId

textarea: JSON payload

Encrypt & Save

Fetch

Decrypt

show results

Keep it simple and clean.

🔐 Core Task — Encryption (Important)
Implement Envelope Encryption using AES-256-GCM.

Steps
Generate random DEK (32 bytes)

Encrypt payload using DEK (AES-256-GCM)

Wrap DEK using Master Key (AES-256-GCM)

Store everything

Binary values should be stored as hex strings.

📦 Data Model
export type TxSecureRecord = {
  id: string
  partyId: string
  createdAt: string

  payload_nonce: string
  payload_ct: string
  payload_tag: string

  dek_wrap_nonce: string
  dek_wrapped: string
  dek_wrap_tag: string

  alg: "AES-256-GCM"
  mk_version: 1
}
✅ Validation Rules
Must reject if:

nonce is not 12 bytes

tag is not 16 bytes

invalid hex

ciphertext tampered

tag tampered

decryption fails

🧪 Tests (required)
Write tests verifying:

encrypt → decrypt works

tampered ciphertext fails

tampered tag fails

wrong nonce length fails

Minimum ~5 tests.

🚀 Deployment (required)
Deploy BOTH:

Web → Vercel

API → Vercel

Provide working URLs.

🎥 Loom Video (very important)
Record a 2–3 minute walkthrough explaining:

how Turbo is configured

how encryption works

how deployment works

one bug you solved

what you'd improve
