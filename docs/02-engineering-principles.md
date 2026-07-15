# Engineering Principles

1.

Planner TIDAK BOLEH menghasilkan response.

2.

Response Composer TIDAK BOLEH memilih tool.

3.

Tool Router TIDAK BOLEH membaca chat user.

4.

Business Rule Engine TIDAK BOLEH menggunakan LLM.

5.

Conversation State adalah source of truth.

6.

Tool tidak pernah mengubah response.

7.

Planner hanya menghasilkan keputusan.

8.

Response Composer hanya menghasilkan bahasa.

9.

Semua side effect harus berasal dari Tool Layer.

10.

Semua reasoning harus bisa dijelaskan lewat planner output.
