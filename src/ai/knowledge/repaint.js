/**
 * Service Knowledge Model: Repaint
 * Defined in JS for performance, structured like YAML.
 */

const repaintKnowledge = {
    service: "Repaint Body Halus",
    requiredSlots: [
        {
            name: "motorModel",
            description: "Jenis/model motor customer",
            promptAction: "Tanya jenis motornya apa"
        },
        {
            name: "paintType",
            description: "Jenis cat (Polos, Mutiara, Xiralic, Candy)",
            promptAction: "Tanya mau pakai cat jenis apa. Jelaskan bedanya jika ditanya."
        },
        {
            name: "partToRepaint",
            description: "Bagian motor mana yang ingin di-repaint (Bodi Halus, Bodi Kasar, Velg, Full Bodi)",
            promptAction: "Tanya bagian mana yang ingin di-repaint"
        }
    ],
    optionalSlots: [
        {
            name: "color",
            description: "Warna spesifik yang diinginkan",
            promptAction: "Tanya mau warna apa"
        },
        {
            name: "velgCondition",
            description: "Kondisi velg (Masih cat original atau sudah pernah dicat ulang)",
            promptAction: "Jika pesan Repaint Velg, tanya kondisi velg saat ini"
        }
    ],
    businessRule: [
        "Repaint Bodi Halus: Beri info jika ada biaya tambahan untuk warna tertentu.",
        "Repair & Dempul: Layanan repaint sudah termasuk perbaikan (repair/dempul) ringan untuk bagian yang patah/lecet. Namun, jika perbaikannya berat atau sangat banyak, akan ada biaya tambahan. Estimasi biaya tambahan pasti hanya bisa diberikan setelah mekanik melihat kondisi fisik motor langsung di studio.",
        "Repaint Velg: Ada biaya tambahan jika mau warna Chrome atau Two-Tone dengan Polish.",
        "Repaint Velg: Ada biaya tambahan (paint remover) jika velg sudah pernah dicat ulang.",
        "Repaint Full Bodi: Mencakup Bodi Halus + Bodi Kasar.",
        "Pengerjaan standar memakan waktu 4-5 hari kerja",
        "Wajib DP minimal 50%",
        "Cat bergaransi 3 bulan untuk cacat pengerjaan"
    ],
    recommendation: [
        "Jika motor dipakai harian, sarankan warna solid agar mudah diretouch jika lecet"
    ],
    upsell: [
        "Repaint Velg",
        "Cuci Komplit"
    ],
    restriction: [
        "Dilarang menawarkan coating langsung setelah repaint (butuh curing 1 bulan)"
    ],
    pricingCapability: "getRepaintPricing",
    bookingCapability: "createBooking"
};

module.exports = {
    repaintKnowledge
};
