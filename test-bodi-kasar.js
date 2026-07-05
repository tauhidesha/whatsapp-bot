const { infoCollectorNode } = require('./src/ai/graph/nodes/infoCollector');

async function run() {
    const state = {
        messages: [
            { _getType: () => 'human', text: "Oke kak, siap! Kalau gitu kita ambil Paket Basic ya untuk repaint bodi halusnya. Dengan tambahan repaint bodi kasar", content: "Oke kak, siap! Kalau gitu kita ambil Paket Basic ya untuk repaint bodi halusnya. Dengan tambahan repaint bodi kasar" }
        ],
        metadata: { intent: "BOOKING_SERVICE", extractedData: { vehicleType: "Yamaha Fazzio", serviceTypes: ["Repaint Bodi Halus", "Repaint Bodi Kasar"], colorChoice: "Moonlight Green" } }
    };
    
    const result = await infoCollectorNode(state);
    console.log(JSON.stringify(result, null, 2));
}
run();
