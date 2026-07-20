const BaseTool = require('./baseTool');
const { getServiceDetailsTool } = require('../getServiceDetailsTool');

class PricingTool extends BaseTool {
    constructor() {
        super();
        this.description = 'Cek harga, durasi, dan SOP layanan (Repaint, Detailing, Coating)';
        this.capability = 'pricing';
    }

    async _run(parameters, state) {
        // Fallback to knownFacts if parameters are empty
        const knownFacts = state.consultation?.knownFacts || {};
        const vehicle = state.vehicle || {};
        
        const requestedServices = state.consultation?.requestedServices || [];
        let rawServiceName = parameters.service_name || parameters.service || parameters.partToRepaint || knownFacts.partToRepaint?.value;
        if (!rawServiceName && requestedServices.length > 0) {
            rawServiceName = requestedServices;
        }
        if (!rawServiceName) {
            rawServiceName = 'Repaint Bodi Halus';
        }
        let serviceNameArray = Array.isArray(rawServiceName) ? rawServiceName : [rawServiceName];

        // Normalize services and ensure "Repaint" prefix for known parts
        serviceNameArray = serviceNameArray.map(s => {
            if (typeof s === 'string') {
                let sLower = s.toLowerCase();
                
                // Do not touch other primary categories
                if (sLower.includes('detailing') || sLower.includes('coating') || sLower.includes('poles') || sLower.includes('cuci')) {
                    return s;
                }

                // If it's a repaint or an unknown part
                if (sLower.includes('repaint')) {
                    if (['bodi halus', 'bodi kasar', 'velg', 'full bodi', 'cvt', 'arm'].some(p => sLower.includes(p))) {
                        return s; // it's a known repaint package
                    }
                    return 'Repaint Bodi Halus'; // Unknown repaint part -> default to Bodi Halus
                } else {
                    if (['velg', 'bodi halus', 'bodi kasar', 'full bodi', 'cvt', 'arm'].some(part => sLower.includes(part))) {
                        return `Repaint ${s}`;
                    }
                    // If it doesn't have 'repaint' and isn't detailing/coating, assume it's a raw part name like "bodi belakang"
                    return 'Repaint Bodi Halus';
                }
            }
            return s;
        });

        // Validation block: Prevent premature tool calls for Repaint
        const isRepaint = serviceNameArray.some(s => typeof s === 'string' && s.toLowerCase().includes('repaint'));
        const partToRepaintStr = serviceNameArray.find(s => typeof s === 'string' && s.toLowerCase().includes('repaint')) || '';
        let partToRepaint = parameters.partToRepaint;
        if (!partToRepaint && isRepaint) {
            if (partToRepaintStr.toLowerCase().includes('halus')) partToRepaint = 'bodi halus';
            else if (partToRepaintStr.toLowerCase().includes('kasar')) partToRepaint = 'bodi kasar';
            else if (partToRepaintStr.toLowerCase().includes('velg')) partToRepaint = 'velg';
        }

        if (isRepaint && !partToRepaint) {
            return { error: "Missing parameter: partToRepaint. Tolong pastikan bagian motor yang ingin dicat (bodi halus, bodi kasar, velg, dll) sudah diketahui sebelum mengecek harga." };
        }

        // V1 implementation mapping
        // We pass arguments as required by V1 implementation: implementation({ service_name, motor_model, size, color_name })
        const motor_model = parameters.motor_model || parameters.motorModel || parameters.motor || knownFacts.motor?.value || vehicle.model?.value || vehicle.model || 'NMax';
        const size = parameters.size || parameters.motorSize;
        const color_name = parameters.color_name || parameters.paintColor || parameters.color || knownFacts.paintColor?.value || vehicle.paintType?.value;

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
                        if (c.description) text += `  Detail: ${c.description.replace(/\n/g, ' ')}\n`;
                        if (c.note) text += `  Catatan: ${c.note}\n`;
                        if (c.estimated_duration) text += `  Estimasi waktu: ${c.estimated_duration}\n`;
                    });
                } else if (res.price_formatted) {
                    text += `- ${res.name || res.service_name}: ${res.price_formatted}\n`;
                    if (res.summary) text += `  Keterangan: ${res.summary}\n`;
                    if (res.description) text += `  Detail: ${res.description.replace(/\n/g, ' ')}\n`;
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
