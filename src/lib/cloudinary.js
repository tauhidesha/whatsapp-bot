/**
 * Cloudinary upload wrapper
 * Uploads a file buffer or local path to Cloudinary.
 * Returns { url, publicId, resourceType, format }
 *
 * Env required:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */

const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file to Cloudinary.
 * @param {string|Buffer} source - File path, URL, or base64 data URI
 * @param {Object} options
 * @param {string} [options.folder='bosmat-progress'] - Cloudinary folder
 * @param {string} [options.resourceType='auto'] - 'image', 'video', or 'auto'
 * @returns {Promise<{url: string, publicId: string, resourceType: string, format: string}>}
 */
async function uploadToCloudinary(source, options = {}) {
    const folder      = options.folder       || 'bosmat-progress';
    const resourceType = options.resourceType || 'auto';

    return new Promise((resolve, reject) => {
        const uploadOptions = {
            folder,
            resource_type: resourceType,
            use_filename: false,
            unique_filename: true,
        };

        const handleResult = (error, result) => {
            if (error) return reject(error);
            resolve({
                url:          result.secure_url,
                publicId:     result.public_id,
                resourceType: result.resource_type,
                format:       result.format,
            });
        };

        if (Buffer.isBuffer(source)) {
            // Upload from buffer
            const stream = cloudinary.uploader.upload_stream(uploadOptions, handleResult);
            stream.end(source);
        } else {
            // Upload from file path, URL, or base64
            cloudinary.uploader.upload(source, uploadOptions, handleResult);
        }
    });
}

module.exports = { uploadToCloudinary, cloudinary };
