# ZOYA V2

Observability

---

# Philosophy

Agent yang tidak bisa dijelaskan tidak bisa di-debug.
Semua keputusan harus bisa ditelusuri.

---

# Planner Log

Setiap planner run disimpan.

```json
{
  "goal": "...",
  "stage": "...",
  "missingFacts": [],
  "capability": "...",
  "confidence": 0.0,
  "strategy": "...",
  "reason": "..."
}
```

---

# Tool Log

```json
{
  "tool": "...",
  "latency": 0,
  "success": true,
  "retry": 0
}
```

---

# Conversation Timeline

Misalnya:
`Planner ↓ Rule ↓ Capability ↓ Tool ↓ Planner ↓ Composer`
Semuanya bisa dilihat.

---

# Dashboard

Metrik:
- Planner Accuracy
- Average Tool Call
- Average Latency
- Conversation Success
- Booking Conversion
- Escalation Rate
- Drop Off Stage

---

# Alert

Misalnya:
Planner confidence < 0.4 ↓ warning.
Tool gagal 5x ↓ critical.

---

# Replay

Engineer bisa replay:
`Conversation ↓ Planner ↓ Tool ↓ Composer`
Tanpa customer. Debug jadi gampang.
