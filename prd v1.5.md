PRD: Tool Ecosystem Cleanup & Supertool Upgrade (getServiceDetails)
1. Overview

Saat ini sistem AI Bosmat menggunakan banyak tools dengan fungsi yang overlap, khususnya terkait pricing, motor size inference, dan repaint surcharge.

Hal ini menyebabkan:

redundant tool calls oleh AI

peningkatan latency

pemborosan token

tool call loops

penurunan determinism dalam tool selection

Tujuan dari PRD ini adalah:

Cleanup redundant tools

Menjadikan getServiceDetails sebagai single source of truth untuk semua informasi layanan

Mengintegrasikan paint color surcharge ke dalam getServiceDetails

Mengurangi jumlah total tools secara signifikan

Meningkatkan determinism dan efisiensi tool calling

2. Goals
Primary Goals

Menjadikan getServiceDetails sebagai supertool tunggal untuk:

service info

pricing

model-based repaint pricing

motor size resolution

repaint surcharge lookup

Menghapus tools redundant yang overlap fungsinya

Mengurangi multi-tool chaining untuk pricing menjadi single tool call

Success Criteria

AI dapat menjawab semua pertanyaan pricing repaint hanya dengan 1 tool call

Tidak ada lagi call ke:

getMotorSizeDetailsTool

listServicesByCategoryTool

getRepaintColorSurchargeTool

Response tetap backward-compatible

3. Current Problems
Problem 1: Tool Redundancy

Saat ini terdapat tools berikut yang overlap:

getServiceDetailsTool

getMotorSizeDetailsTool

getRepaintColorSurchargeTool

listServicesByCategoryTool

Padahal getServiceDetailsTool sudah memiliki:

motor size resolution

repaint model lookup

price resolution

memory integration

Problem 2: Paint surcharge terpisah

Paint surcharge saat ini dihandle oleh tool terpisah:

getRepaintColorSurchargeTool

Ini menyebabkan AI melakukan 2 tool calls:

getServiceDetails

getRepaintColorSurcharge

Ini harus digabung.

4. Scope
In Scope

Update getServiceDetailsTool

Remove redundant tools from tool registry

Integrate surcharge logic

Update toolDefinition schema

Out of Scope

Booking tools

Promo tools

Admin tools

Memory system

5. Tool Cleanup Plan

Remove these tools completely from:

app.js

Remove imports
getMotorSizeDetailsTool
getRepaintColorSurchargeTool
listServicesByCategoryTool
Remove from:
availableTools
toolDefinitions
Remove files (optional cleanup)
src/ai/tools/getMotorSizeDetailsTool.js
src/ai/tools/getRepaintColorSurchargeTool.js
src/ai/tools/listServicesByCategoryTool.js
6. Supertool Upgrade Requirements

Upgrade:

src/ai/tools/getServiceDetailsTool.js

6.1 Add New Input Parameter

Add optional parameter:

color_name

Schema:

color_name: {
  type: "string",
  description: "Nama warna repaint, misal: chrome red, candy red, bunglon, dll"
}
6.2 Add surcharge lookup logic

Use existing:

warnaSpesial

Add function:

function lookupColorSurcharge(colorName)

Logic:

normalize string

fuzzy match warnaSpesial entries

return surcharge amount if exists

6.3 Add surcharge fields to response

Add fields:

color_name
color_surcharge
color_surcharge_formatted
final_price
final_price_formatted

Example:

{
 price: 1200000,
 color_surcharge: 300000,
 final_price: 1500000
}
6.4 Final price calculation logic
final_price = base_price + color_surcharge

If base price range:

final_price_min
final_price_max
7. Tool Definition Update

Update toolDefinition parameters:

parameters: {
  type: "object",
  properties: {

    service_name: { type: "string" },

    motor_model: { type: "string" },

    size: {
      type: "string",
      enum: ["S", "M", "L", "XL"]
    },

    color_name: {
      type: "string",
      description: "Nama warna repaint untuk cek surcharge"
    },

    senderNumber: {
      type: "string"
    }

  },
  required: ["service_name"]
}
8. Response Format

New response example:

{
 success: true,

 service_name: "Repaint Bodi Halus",

 motor_model: "NMax",

 motor_size: "M",

 price: 1200000,

 price_formatted: "Rp1.200.000",

 color_name: "Candy Red",

 color_surcharge: 300000,

 color_surcharge_formatted: "Rp300.000",

 final_price: 1500000,

 final_price_formatted: "Rp1.500.000",

 estimated_duration: "5 hari kerja"
}
9. Backward Compatibility

If color_name not provided:

Behavior remains unchanged.

No breaking changes.

10. Tool Priority Instruction Update

Update SYSTEM_PROMPT:

Add instruction:

Gunakan getServiceDetails untuk semua pertanyaan harga, repaint, surcharge warna, dan detail layanan.
11. Expected Outcome

Before:

Tool calls per pricing query:
2–4 calls

After:

Tool calls per pricing query:
1 call

Latency reduction:
30–60%

Token reduction:
20–40%

Determinism increase:
Significant

12. Migration Steps

Step 1: Update getServiceDetailsTool

Step 2: Remove redundant tools from registry

Step 3: Update toolDefinitions

Step 4: Update SYSTEM_PROMPT

Step 5: Test repaint queries

Test cases:

repaint nmax

repaint nmax candy red

repaint velg

repaint tanpa warna spesial

repaint dengan warna spesial

13. Acceptance Criteria

System is complete when:

AI uses only getServiceDetails for repaint pricing

surcharge included in response

no redundant tool calls

no regression in pricing accuracy

END OF PRD