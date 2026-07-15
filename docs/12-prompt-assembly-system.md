# ZOYA V2

Prompt Assembly System

Version 2.0

---

# Philosophy

Prompt tidak pernah ditulis utuh.
Prompt dibangun setiap request.

---

Planner Prompt
=
Identity
+
Planner Rules
+
Relevant Knowledge
+
Conversation State
+
Business Flags
+
Few Shot (optional)

Misalnya customer lagi ngomong repaint. Prompt Builder cuma mengambil:
- identity
- planner rules
- repaint knowledge
- state
- flags

Tidak ikut membawa detailing. Tidak ikut booking. Tidak ikut coating.
Token turun drastis.

---

# Prompt Builder

Input
```text
Conversation State
```
↓
Output
```text
Planner Prompt
```

---

# Knowledge Selection

Planner membaca `requestedService`.
↓
Router memilih `knowledge/repaint.yaml`.
↓
Planner.

---

# Dynamic Context

Misalnya customer upload foto.
↓
Tambah `vision_context.md`.
Kalau gak upload, jangan.

---

# Few Shot

Menurut gue maksimum 3 contoh. Jangan 20.

---

# Token Budget

Planner
≤2500 token

Composer
≤2000 token

Gemini Flash Lite bakal aman.

---

# Cache

- Identity: Cache.
- Persona: Cache.
- Knowledge: Cache.
- State: Dynamic.

---

# Golden Rule

Planner hanya membaca knowledge yang relevan. Bukan seluruh bisnis Bosmat.

---

# Peran Prompt Compiler

Prompt Engineer dihapus, diganti **Prompt Compiler**.
Prompt bukan ditulis, prompt dirakit.
