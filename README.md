# �️ Mirfa Secure Transaction Vault

A professional-grade, full-stack monorepo demonstrating **Envelope Encryption** for secure transaction storage. Built for the Mirfa Software Engineer Intern Challenge.

---

## 🔗 Live Deployment

| Component | URL |
| :--- | :--- |
| **Frontend (Web)** | [https://mirfa-web.vercel.app](https://mirfa-web.vercel.app) |
| **Backend (API)** | [https://mirfa-api.vercel.app](https://mirfa-api.vercel.app) |

---

## 🏗️ System Architecture

This project is structured as a **Turborepo monorepo**, ensuring high modularity and efficient build pipelines.

- **`apps/web`**: A premium Next.js frontend with a dark-themed, glassmorphic UI.
- **`apps/api`**: A high-performance Fastify backend optimized for Vercel Serverless.
- **`packages/crypto`**: A dedicated library for industrial-standard encryption logic.

### Tech Stack
- **Mono-management**: pnpm Workspaces + Turborepo
- **Frontend**: Next.js 15+, React, Vanilla CSS
- **Backend**: Fastify, TypeScript
- **Encryption**: Node.js `crypto` (AES-256-GCM)
- **Deployment**: Vercel (Frontend & Serverless API)
- **Testing**: Vitest

---

## � Security: Envelope Encryption (AES-256-GCM)

The core requirement of this challenge was to implement **Envelope Encryption** correctly.

### How it works:
1. **DEK Generation**: For every unique transaction, a random 32-byte **Data Encryption Key (DEK)** is generated.
2. **Payload Encryption**: The sensitive data is encrypted using the DEK with **AES-256-GCM**.
3. **DEK Wrapping**: The DEK is then encrypted ("wrapped") using a static **Master Key (MK)** stored securely in environment variables.
4. **Storage**: The encrypted payload and the wrapped DEK are stored together in a single record.

### Why this is secure:
- Even if the database is compromised, the data cannot be decrypted without the Master Key.
- Rotating the Master Key only requires re-wrapping the DEKs, not re-encrypting the entire database.
- **GCM (Galois/Counter Mode)** provides both encryption and **authentication** (integrity), ensuring data hasn't been tampered with.

---

## 📦 Data Model

Every stored transaction follows this strict interface:

```typescript
export type TxSecureRecord = {
  id: string;           // UUID
  partyId: string;      // User/Entity ID
  createdAt: string;    // Timestamp
  
  // Encrypted Payload
  payload_nonce: string;
  payload_ct: string;
  payload_tag: string;  // Integrity Tag
  
  // Wrapped DEK
  dek_wrap_nonce: string;
  dek_wrapped: string;
  dek_wrap_tag: string;
  
  alg: "AES-256-GCM";
  mk_version: 1;
}
```

---

## 🧪 Testing & Validation

We have implemented a comprehensive test suite using **Vitest** to ensure the crypto implementation is bulletproof.

### Verified Scenarios:
- ✅ Successful **encrypt → decrypt** roundtrip.
- ✅ Rejection of records with **tampered ciphertext**.
- ✅ Rejection of records with **tampered integrity tags**.
- ✅ Validation of **nonce lengths** and **hex formats**.
- ✅ Handling of missing or invalid **Master Keys**.

Run tests locally:
```bash
pnpm test
```

---

## 🚀 Local Development

To run the entire system locally:

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```

2. **Set Environment Variables**:
   Create an `.env` file in `apps/api/` and `apps/web/`:
   ```bash
   # api/.env
   MASTER_KEY=000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f
   
   # web/.env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

3. **Start Development Server**:
   ```bash
   pnpm dev
   ```

---

## 🛠 Features & Improvements

- **Premium UI**: Uses a high-end "Plura" aesthetic with a deep black theme and electric blue accents.
- **Robust Deployment**: The API uses a custom serverless wrapper to ensure **CORS headers** are sent even during 500 errors or cold starts.
- **Strict Validation**: All API inputs and cryptographic parameters are strictly validated to prevent malformed data entry.
- **Error Transparency**: Implemented descriptive error handling for internal logic while keeping client-facing messages secure.

---

## 👨‍💻 Author
**Dipti Pathak** - Mirfa Software Engineer Intern Challenge
