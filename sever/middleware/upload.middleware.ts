import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file định dạng JPG, PNG, WEBP hoặc PDF'));
    }
};

export const uploadLicense = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // Giới hạn 5MB
});

// Avatar upload config — uses MEMORY storage for Cloudinary upload
const imageOnlyFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file ảnh JPG, PNG hoặc WEBP'));
    }
};

export const uploadAvatar = multer({
    storage: multer.memoryStorage(),
    fileFilter: imageOnlyFilter,
    limits: { fileSize: 3 * 1024 * 1024 } // Giới hạn 3MB
});

// Post media upload config (images + videos)
// Uses MEMORY storage — files are uploaded to Cloudinary from buffer, not saved to disk
const postMediaFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/webp', // Images
        'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm' // Videos
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file ảnh (JPG, PNG, WEBP) hoặc video (MP4, MOV, AVI, WEBM)'));
    }
};

export const uploadPostMedia = multer({
    storage: multer.memoryStorage(),
    fileFilter: postMediaFilter,
    limits: { fileSize: 100 * 1024 * 1024 } // Giới hạn 100MB cho video
});

// Report evidence upload config
const reportEvidenceDir = path.join(uploadDir, 'report_evidence');
if (!fs.existsSync(reportEvidenceDir)) {
    fs.mkdirSync(reportEvidenceDir, { recursive: true });
}

const reportEvidenceStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, reportEvidenceDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const reportEvidenceFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/webp', // Images
        'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', // Videos
        'application/pdf' // PDF
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận ảnh, video, hoặc PDF'));
    }
};

export const uploadReportEvidence = multer({
    storage: reportEvidenceStorage,
    fileFilter: reportEvidenceFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // Giới hạn 50MB cho evidence
});
