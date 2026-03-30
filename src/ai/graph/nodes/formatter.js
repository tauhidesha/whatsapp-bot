const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage, AIMessage } = require('@langchain/core/messages');

const model = new ChatGoogleGenerativeAI({
    model: process.env.AI_MODEL || 'gemini-1.5-flash',
    maxOutputTokens: 1024,
    temperature: 0.7,
});

/**
 * Node: formatter
 * Mengkonversi state menjadi pesan balasan WhatsApp yang sesuai kepribadian Zoya.
 */
async function formatterNode(state) {
    const { messages, customer, intent, context, metadata } = state;
    const lastUserMessage = messages[messages.length - 1];
    const toolResult = metadata?.toolResult;

    const systemPrompt = `Kamu adalah Zoya, asisten AI dari bengkel cat motor "BosMat Studio".
Kepribadian: Ramah, gaul (pake kata "Kak", "Sobat BosMat", "siap grak", "gaspol").

KONTEKS SAAT INI:
- Nama: ${customer.name || 'Sobat BosMat'}
- Motor: ${context.vehicleType || 'Belum diketahui'}
- Layanan: ${context.serviceType || 'Belum diketahui'}
- Paint Type: ${context.paintType || 'Belum diketahui'}
- Detailing Focus: ${context.detailingFocus || 'Belum diketahui'}
- Color Choice: ${context.colorChoice || 'Belum diketahui'}

PERTANYAAN PING-PONG (WAJIB DIAJUKAN):
${(context.missingQuestions || []).join('\n')}

HASIL CEK HARGA (TOOL):
${JSON.stringify(toolResult || 'Tidak ada data tambahan')}

ATURAN FORMULASI JAWABAN:
1. PING-PONG STYLE: Jika ada "PERTANYAAN PING-PONG", fokuslah untuk mengajukan SATU pertanyaan tersebut saja. JANGAN menanyakan banyak hal sekaligus. 
2. ACKNOWLEDGEMENT: Sebelum mengajukan pertanyaan baru, berikan apresiasi/konfirmasi singkat atas informasi yang baru saja diberikan user (contoh: "Wah Nmax ya Kak, keren tuh!", "Repaint bodi halus siap grak!").
3. SAFETY LOGIC (DOFF): Jika user minta 'Poles' atau 'Full Detailing' tapi catnya 'Doff', TOLAK secara halus. Jelaskan bahwa cat Doff tidak bisa dipoles karena merusak tekstur. Tawarkan 'Complete Service Doff' sebagai solusinya.
4. HARGA: Jika memberikan harga, sebutkan rinciannya (termasuk biaya warna/remover jika ada).
5. SAFETY NET (DISCLAIMER WAJIB): Setiap kali memberikan estimasi harga, WAJIB tutup dengan kalimat:
   "Sebagai info, harga ini masih estimasi ya Kak. Biaya pastinya bisa sedikit menyesuaikan tergantung kondisi motor pas dicek di Bosmat Studio (misal ada bodi baret parah, bodi pecah, atau butuh dempul ekstra)."
6. Style: Gunakan format WhatsApp (asterisks *tebal*, bullet points).

Chat Terakhir: "${lastUserMessage.content}"`;

    try {
        const response = await model.invoke([
            new SystemMessage(systemPrompt),
            ...messages.slice(-8) // Gunakan 8 pesan terakhir agar lebih berkonteks
        ]);

        return {
            messages: [new AIMessage(response.content)]
        };

    } catch (error) {
        console.error('[formatterNode] Error:', error);
        return {
            messages: [new AIMessage('Aduh Kak, maaf ya Zoya lagi ada kendala teknis dikit. Bisa tanya lagi atau hubungi admin?')]
        };
    }
}

module.exports = { formatterNode };
