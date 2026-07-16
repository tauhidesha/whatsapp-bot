const BaseTool = require('./baseTool');
const { getServiceDetailsTool } = require('../getServiceDetailsTool');

class PricingTool extends BaseTool {
    constructor() {
        super();
        this.description = 'Cek harga, durasi, dan SOP layanan (Repaint, Detailing, Coating)';
        this.capability = 'pricing';
    }

    async _run(parameters, state) {
        // Ensure service_name is an array as expected by V1
        const serviceNameArray = Array.isArray(parameters.service_name) ? parameters.service_name : [parameters.service_name];

        // Validation block: Prevent premature tool calls for Repaint
        const isRepaint = serviceNameArray.some(s => typeof s === 'string' && s.toLowerCase().includes('repaint'));
        const partToRepaint = state.consultation?.knownFacts?.partToRepaint;

        if (isRepaint && !partToRepaint) {
            return { error: "Missing parameter: partToRepaint. Tolong pastikan bagian motor yang ingin dicat (bodi halus, bodi kasar, velg, dll) sudah diketahui sebelum mengecek harga." };
        }

        // V1 implementation mapping
        // We pass arguments as required by V1 implementation: implementation({ service_name, motor_model, size, color_name })
        const { motor_model, size, color_name } = parameters;

        const resultString = await getServiceDetailsTool.implementation({
            service_name: serviceNameArray,
            motor_model,
            size,
            color_name
        });

        // Format the raw JSON into a clean string so the Composer doesn't hallucinate
        let formattedText = "";
        
        try {
            const processResult = (res) => {
                let text = "";
                if (res.message) text += `${res.message}\n`;
                if (res.candidates && Array.isArray(res.candidates)) {
                    res.candidates.forEach(c => {
                        text += `- ${c.name}: ${c.price_formatted}\n`;
                        if (c.summary) text += `  Keterangan: ${c.summary}\n`;
                        if (c.note) text += `  Catatan: ${c.note}\n`;
                        if (c.estimated_duration) text += `  Estimasi waktu: ${c.estimated_duration}\n`;
                    });
                } else if (res.price_formatted) {
                    text += `- ${res.name || res.service_name}: ${res.price_formatted}\n`;
                    if (res.summary) text += `  Keterangan: ${res.summary}\n`;
                    if (res.estimated_duration) text += `  Estimasi waktu: ${res.estimated_duration}\n`;
                }
                return text;
            };

            if (resultString.multiple_services_requested && Array.isArray(resultString.results)) {
                formattedText = resultString.results.map(processResult).join('\n');
            } else {
                formattedText = processResult(resultString);
            }
        } catch (e) {
            console.error('[PricingTool] Failed to format result:', e);
            formattedText = "Gagal memformat harga, silakan cek manual.";
        }

        return {
            rawText: resultString,
            formattedText: formattedText,
            service: serviceNameArray.join(', ')
        };
    }
}

module.exports = new PricingTool();
