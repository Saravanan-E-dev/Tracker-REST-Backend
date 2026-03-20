import crypto from 'crypto';

const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.DB_ENCRYPTION_KEY, 'hex'); // Same 32-byte key from .env

export const decrypt = (encryptedText, ivHex) => {
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedData = Buffer.from(encryptedText, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString(); // Returns the original API Key/Secret
};