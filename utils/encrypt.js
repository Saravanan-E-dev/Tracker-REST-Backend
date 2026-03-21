import crypto from 'crypto';

// const algorithm = 'aes-256-cbc';
// const key = Buffer.from(process.env.DB_ENCRYPTION_KEY, 'hex'); // 32 bytes

export const encrypt = (text, providedIv = null) => {
    const iv = providedIv ? Buffer.from(providedIv, 'hex') : crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(process.env.DB_ENCRYPTION_KEY, 'hex'), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
        iv: iv.toString('hex'),
        encryptedData: encrypted
    };
};