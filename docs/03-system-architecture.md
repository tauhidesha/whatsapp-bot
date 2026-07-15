# ZOYA V2 - System Architecture

Version: 2.0

---

# Architecture Philosophy

Zoya adalah Goal-Oriented AI Agent.

Bukan chatbot yang mengikuti flow.

Bukan intent classifier.

Bukan tool caller.

Zoya berpikir seperti sales consultant.

Flow dikendalikan oleh Goal, bukan Intent.

Business dikendalikan oleh Rule Engine, bukan LLM.

Percakapan dikendalikan oleh Response Composer.

---

# High Level Architecture

                    USER
                      │
                      ▼
          Conversation Manager
                      │
                      ▼
             Load Conversation State
                      │
                      ▼
              Conversation Planner
                      │
          ┌───────────┴────────────┐
          │                        │
          ▼                        ▼
 Business Rule Engine       Capability Decision
          │                        │
          └───────────┬────────────┘
                      ▼
             Capability Router
                      │
                      ▼
             Execute Tool(s)
                      │
                      ▼
          Update Conversation State
                      │
                      ▼
          Planner Re-Evaluation
                      │
                      ▼
           Response Composer
                      │
                      ▼
             Save Memory & Analytics
                      │
                      ▼
                     END

---

# Core Components

## 1. Conversation Manager

Responsibilities

- menerima message user
- load state
- load customer
- load memory
- memanggil planner

Tidak boleh:

- memilih tool
- membuat response

---

## 2. Planner

Planner adalah otak agent.

Planner bertugas memahami situasi.

Planner tidak boleh menghasilkan response.

Planner hanya menghasilkan keputusan.

Planner tidak boleh memanggil tool secara langsung.

Planner tidak boleh mengubah database.

Planner hanya mengeluarkan JSON.

---

## 3. Business Rule Engine

Business Rule Engine adalah deterministic layer.

Semua SOP Bosmat berada disini.

Tidak menggunakan LLM.

Semua output dapat di-unit-test.

---

## 4. Capability Router

Capability Router menerjemahkan kebutuhan planner menjadi tool.

Planner tidak mengenal tool.

Planner hanya mengenal capability.

Contoh

pricing

booking

customer

crm

notification

vision

Capability Router yang memilih tool sebenarnya.

---

## 5. Tool Layer

Tool Layer adalah satu-satunya layer yang boleh:

- membaca database
- mengubah database
- mengirim notifikasi
- membuat booking
- update customer

Semua side effect berasal dari layer ini.

---

## 6. Response Composer

Response Composer bertugas membuat bahasa alami.

Input

Conversation

Conversation State

Planner Result

Business Rules

Tool Result

Persona

Output

Natural Response

Response Composer tidak boleh:

memilih tool

mengubah state

mengambil keputusan bisnis

---

# Architectural Principles

LLM bertanggung jawab atas komunikasi.

Code bertanggung jawab atas keputusan bisnis.

State bertanggung jawab atas konteks.

Tool bertanggung jawab atas aksi.

Rule Engine bertanggung jawab atas SOP.

---

# Lifecycle

User Message

↓

Planner

↓

Rule Engine

↓

Need Capability?

↓

No
↓

Response Composer

↓

END


Need Capability

↓

Capability Router

↓

Tool

↓

Planner

↓

Response Composer

↓

END

---

# Why Planner Runs Twice

Planner pertama

↓

menentukan kebutuhan

↓

Tool

↓

Planner kedua

↓

menentukan apakah informasi sudah cukup

↓

Response

Hal ini membuat percakapan lebih natural.

---

# Scalability

Jika nanti Bosmat membuka:

Salon Mobil

PPF

Wrapping

Franchise

Body Repair

Planner tetap sama.

Yang bertambah hanya:

Capability

Business Rules

Tool

Slot Definition
