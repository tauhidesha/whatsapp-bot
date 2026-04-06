/**
 * Utilitas untuk mengulang eksekusi (retry) asinkron dengan Exponential Backoff.
 * Digunakan secara khusus untuk pemanggilan API LLM eksternal guna memitigasi isu Rate Limit / Timeout.
 * 
 * @param {Function} asyncFn - Fungsi asinkron yang akan dieksekusi (contoh: () => model.invoke(...))
 * @param {Object} options - Konfigurasi retry (maxRetries, baseDelayMs)
 * @returns {Promise<any>} Hasil eksekusi fungsi
 */
async function withRetry(asyncFn, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const baseDelayMs = options.baseDelayMs || 1000; // Mulai dari 1 detik
    
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            return await asyncFn();
        } catch (error) {
            attempt++;
            console.error(`[withRetry] Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
            
            // Jika mencapai batas maksimal percobaan, buang error (throw)
            if (attempt >= maxRetries) {
                console.error(`[withRetry] Max retries reached. Throwing error.`);
                throw error;
            }
            
            // Exponential backoff delay (misal: 1000, 2000, 4000...)
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            console.log(`[withRetry] Waiting ${delay}ms before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

module.exports = { withRetry };
