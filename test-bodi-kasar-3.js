const { formatterNode } = require('./src/ai/graph/nodes/formatter');

async function run() {
    const toolResult = {
  "success": true,
  "multiple_services_requested": true,
  "results": [
    {
      "success": true,
      "multiple_candidates": true,
      "category": "repaint_bodi_halus",
      "motor_model": "Yamaha Fazzio",
      "motor_size": "M",
      "candidates": [
        {
          "name": "Repaint Bodi Halus - Paket Premium",
          "summary": "Level tertinggi.",
          "price": 2250000,
          "price_formatted": "Rp2.250.000",
        },
        {
          "name": "Repaint Bodi Halus - Paket Standar",
          "summary": "Sweet spot.",
          "price": 1950000,
          "price_formatted": "Rp1.950.000",
        },
        {
          "name": "Repaint Bodi Halus - Paket Basic",
          "summary": "Upgrade.",
          "price": 1800000,
          "price_formatted": "Rp1.800.000",
        },
        {
          "name": "Repaint Bodi Halus - Paket Ekonomis",
          "summary": "Harga dasar.",
          "price": 1500000,
          "price_formatted": "Rp1.500.000",
        }
      ]
    },
    {
      "success": true,
      "service_name": "Repaint Bodi Kasar",
      "price": 380000,
      "price_formatted": "Rp380.000",
    }
  ]
};

    const state = {
        messages: [
            { _getType: () => 'human', text: "Oke kak, siap! Kalau gitu kita ambil Paket Basic ya untuk repaint bodi halusnya. Dengan tambahan repaint bodi kasar", content: "Oke kak, siap! Kalau gitu kita ambil Paket Basic ya untuk repaint bodi halusnya. Dengan tambahan repaint bodi kasar" }
        ],
        metadata: { 
            intent: "BOOKING_SERVICE", 
            extractedData: { vehicleType: "Yamaha Fazzio", serviceTypes: ["Repaint Bodi Halus", "Repaint Bodi Kasar"], colorChoice: "Moonlight Green" },
            toolResult: toolResult,
            replyMode: "inform"
        }
    };
    
    const result = await formatterNode(state);
    console.log(result.messages[0].content);
}
run();
