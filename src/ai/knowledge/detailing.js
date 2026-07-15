/**
 * Service Knowledge Model: Detailing
 * Defined in JS for performance, structured like YAML.
 */

const detailingKnowledge = {
    service: "Detailing",
    requiredSlots: [
        {
            name: "motorModel",
            description: "Jenis/model motor customer",
            promptAction: "Tanya jenis motornya apa"
        },
        {
            name: "isBongkarTotal",
            description: "Sejauh mana detailing yang diinginkan (Apakah sampai bongkar rangka?)",
            promptAction: "Tanya apakah mau detailing bodi luar aja atau sampai bongkar rangka full"
        },
        {
            name: "paintType",
            description: "Jenis cat (Glossy atau Doff)",
            promptAction: "Tanya jenis cat motor (Glossy atau Doff)"
        }
    ],
    optionalSlots: [
        {
            name: "mesinOnly",
            description: "Apakah hanya mau detailing mesin saja",
            promptAction: "Tanyakan ini jika customer menyebut masalah mesin kotor"
        }
    ],
    businessRule: [
        "Jika Bodi Luar & Cat Doff -> Tawarkan Coating Doff (melindungi bodi & detailing kaki)",
        "Jika Bodi Luar & Cat Glossy -> Tawarkan Poles Bodi atau Coating Glossy",
        "Jika Bongkar Full & Cat Doff -> Tawarkan Cuci Komplit atau Complete Service Doff",
        "Jika Bongkar Full & Cat Glossy -> Tawarkan Full Detailing atau Complete Service Glossy",
        "Jika Detailing Mesin Saja -> Jelaskan detail pengerjaan, lalu tawarkan sekalian detailing bodi (cross-sell)"
    ],
    recommendation: [],
    upsell: [
        "Poles Bodi",
        "Coating Glossy",
        "Coating Doff"
    ],
    restriction: [],
    pricingCapability: "getDetailingPricing",
    bookingCapability: "createBooking"
};

module.exports = {
    detailingKnowledge
};
