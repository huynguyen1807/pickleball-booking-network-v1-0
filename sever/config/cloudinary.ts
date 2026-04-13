import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary
 * @param buffer - File buffer (from multer memory storage)
 * @param options - Cloudinary upload options
 * @returns Cloudinary upload result with secure_url, public_id, etc.
 */
export const uploadToCloudinary = (
    buffer: Buffer,
    options: {
        folder?: string;
        resource_type?: 'image' | 'video' | 'auto';
        public_id?: string;
    } = {}
): Promise<any> => {
    return new Promise((resolve, reject) => {
        const uploadOptions = {
            folder: options.folder || 'pickleball/posts',
            resource_type: options.resource_type || 'auto' as const,
            ...(options.public_id && { public_id: options.public_id }),
        };

        const stream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
                if (error) {
                    console.error('❌ Cloudinary upload error:', error.message);
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );

        stream.end(buffer);
    });
};

/**
 * Delete a file from Cloudinary by public_id
 */
export const deleteFromCloudinary = async (
    publicId: string,
    resourceType: 'image' | 'video' = 'image'
): Promise<any> => {
    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
        });
        console.log(`🗑️ Cloudinary deleted: ${publicId}`, result);
        return result;
    } catch (error: any) {
        console.error(`⚠️ Cloudinary delete error for ${publicId}:`, error.message);
        return null;
    }
};

export default cloudinary;
