const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');

/**
 * Implementation: generateMarketingCopy
 * Generates high-converting marketing copy using a dedicated LLM call with a specialist persona.
 */
async function implementation({ type, subject, tone = 'gaul', extra_context = '' }) {
  console.log(`[generateMarketingCopy] Generating ${type} for subject: ${subject} (Tone: ${tone})`);

  const model = new ChatGoogleGenerativeAI({
    model: process.env.AI_MODEL || 'gemini-1.5-flash',
    maxOutputTokens: 2048,
    temperature: 0.7, // Higher temperature for more creative marketing copy
    responseMimeType: "application/json",
  });

  const typeInstructions = {
    ig_caption: `
      - Opening hook: 1 kalimat yang stop-scroll (pertanyaan, fakta mengejutkan, atau pain point).
      - Body: 2-3 kalimat benefit, boleh pakai emoji secukupnya.
      - CTA: ajak DM, tap link bio, atau hubungi WA.
      - Hashtag: 10-15 hashtag relevan campuran besar dan niche.
      - Max panjang: 150 kata.`,
    meta_ads: `
      - Hook (Primary Text baris 1): max 40 karakter, stop-scroll.
      - Body: 2-3 kalimat, benefit konkret, boleh sebut pain point.
      - CTA text: pilih salah satu — "Hubungi Sekarang", "Cek Harga", "Pesan Sekarang".
      - Sertakan 3 variasi hook alternatif untuk A/B test.
      - Tidak ada hashtag untuk Meta Ads.`,
    ig_story: `
      - Teks singkat, max 2-3 baris (layar vertikal).
      - 1 hook kuat di atas, 1 CTA di bawah.
      - Boleh pakai capslock untuk penekanan.
      - Hashtag: 3-5 saja.`,
    whatsapp_blast: `
      - Gaya personal, seolah dari teman — bukan broadcast iklan.
      - Pembuka: sapa natural (Halo Kak / Halo Mas).
      - Isi: 2-3 kalimat, langsung ke point.
      - CTA: ajak reply atau tanya lebih lanjut.
      - Tidak ada hashtag.
      - Max 80 kata.`
  };

  const systemPrompt = `Kamu adalah copywriter ahli untuk bengkel motor premium.
Studio: BosMat Studio — Spesialis Repaint, Detailing & Coating Motor.
Lokasi: Depok. Target pasar: pemilik motor matic & sport usia 20-40 tahun.

PRINSIP WAJIB:
1. Benefit-first, bukan feature-first.
   JANGAN: "Kami pakai cat PU grade premium"
   HARUS: "Motor kamu bakal keliatan baru keluar dealer lagi"
2. Satu CTA yang jelas di setiap copy.
3. Bahasa sesuai tone yang diminta (gaul/hype/formal).
4. JANGAN sebut harga kecuali diminta di subject.
5. JANGAN buat klaim yang tidak bisa dibuktikan ("terbaik di Indonesia" dll).

KHUSUS UNTUK TIPE: ${type.toUpperCase()}
${typeInstructions[type] || ''}

FORMAT OUTPUT (JSON only, no markdown):
{
  "main_copy": "...",
  "hooks": ["...", "...", "..."],
  "cta": "...",
  "hashtags": "..." 
}`;

  const userPrompt = `
SUBJECT: ${subject}
TONE: ${tone}
EXTRA CONTEXT: ${extra_context}
  `.trim();

  try {
    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ]);

    // Parse the JSON output from the model
    const content = response.content.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(content);
  } catch (error) {
    console.error('[generateMarketingCopy] Error:', error);
    return {
      success: false,
      error: error.message,
      message: "Maaf Bos, lagi ada kendala pas bikin copy marketingnya. Coba lagi bentar ya."
    };
  }
}

const generateMarketingCopyTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: "generateMarketingCopy",
      description: "Generate marketing copy for BosMat Studio — IG captions, Meta Ads, or WhatsApp blasts. Call this when admin asks to create promotional content.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["ig_caption", "meta_ads", "ig_story", "whatsapp_blast"],
            description: "Type of marketing content to generate"
          },
          subject: {
            type: "string",
            description: "What is the copy about? E.g. 'promo coating bulan ini diskon 20%', 'repaint velg mulai 150rb'"
          },
          tone: {
            type: "string",
            enum: ["gaul", "hype", "formal"],
            description: "Tone of the copy. Default: gaul"
          },
          extra_context: {
            type: "string",
            description: "Optional additional context. E.g. 'target: motor matic warna gelap', 'promo berlaku sampai akhir bulan'"
          }
        },
        required: ["type", "subject"]
      }
    }
  },
  implementation
};

module.exports = { generateMarketingCopyTool };
