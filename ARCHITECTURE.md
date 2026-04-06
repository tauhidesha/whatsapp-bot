# PROJECT META: BosMat WhatsApp AI & Admin System

> **Note for AI Agents**: This file provides a high-level architectural overview and current state of the project. Read this to avoid redundant analysis. Always follow the protocols in `GEMINI.md`.

---

## 🏗️ System Architecture

The ecosystem consists of two primary interconnected components:

1.  **WhatsApp Bot (Zoya)**: 
    - **Entry Point**: `app.js` (Node.js/Express).
    - **Engine**: LangChain + LangGraph (coordinated agentic flows).
    - **AI Model**: Google Gemini (1.5 Flash/Pro).
    - **Interface**: `WPPConnect` for WhatsApp integration.
    - **Responsibility**: Customer interaction, service lookup, booking creation, and human handover.

2.  **Admin Dashboard**:
    - **Path**: `/admin-frontend` (Next.js 14+ App Router).
    - **Responsibility**: Manual booking management, monitoring, invoice preview, and analytics.
    - **Key Feature**: Real-time sync with the bot via a shared PostgreSQL database (Supabase/GCP).

---

## 💾 Database Logic (Prisma)

Both systems point to the same database but maintain their own Prisma clients.
- **Main Schema**: `prisma/schema.prisma` (Root).
- **Admin Schema**: `admin-frontend/prisma/schema.prisma`.
- **Core Models**:
    - `Booking`: Stores service details, dates, status, and financial data (`subtotal`, `discount`, `totalAmount`).
    - `Customer`: WhatsApp-indexed user records.
    - `Vehicle`: Linked to customers, stores `plateNumber` and `modelName`.
    - `Transaction`: Linked to bookings for payment tracking.

---

## 🛠️ Key AI Tools (`src/ai/tools/`)

- `getServiceDetails`: **Supertool** for all pricing queries. Replaces redundant lookup tools.
- `createBookingTool` / `updateBookingTool`: Handles database persistence for bookings.
- `generateDocumentTool`: Generates PDFs/Images for Invoices & Warranties via `app.js` endpoints.
- `triggerBosMatTool`: Triggers human handover (snoozes AI, notifies admin).

---

## 📍 Financial & Logic Rules (Critical Context)

1.  **Discount Logic**:
    - `discount` is now a primary field in the `Booking` model.
    - On invoices, `Subtotal = Final Total + Discount`. 
    - AI tools automatically calculate `discount` as `subtotal - totalAmount` if an explicit discount isn't provided but a deal price is mentioned.

2.  **WhatsApp Identifiers**:
    - Uses `@lid` (Linked ID) for newer accounts and `@c.us` for older ones. 
    - Always use `getIdentifier` utility to handle these consistently.

3.  **Real Phone Support**:
    - `realPhone` field stores the human-readable number (e.g., `0812...`) for customer-facing documents, while `customerPhone` stores the WhatsApp WID.

---

## 🚀 Current Technical State (As of April 2026)

- [x] **Full Discount Persistence**: Integrated from AI tool to Admin UI to Invoice PDF.
- [x] **Submodule Sync**: Admin Frontend changes are pushed as a submodule (`admin-frontend`).
- [x] **Unified Pricing**: `getServiceDetails` is the single source of truth for pricing/surcharges.
- [ ] **Deployment**: Currently in GCP. Requires `npx prisma db push` and `npx prisma generate` after schema changes.

---

## 📜 Agent Guidelines (How to work here)

1.  **No Placeholders**: Use `generate_image` or actual logic. No `// TODO` without a plan.
2.  **Clean Code**: Follow `@skills/clean-code`.
3.  **Socratic Gate**: For complex changes, ask the user at least 3 discovery questions first.
4.  **Verification**: After logic changes, use `test_invoice_generate.js` or similar scripts in the root to verify.
