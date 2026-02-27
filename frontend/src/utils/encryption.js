/**
 * End-to-End Encryption Utilities for Chat Messages
 * 
 * Uses Web Crypto API for AES-GCM encryption
 * Keys are generated per chat and stored in browser localStorage
 */

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Generate a new encryption key for a chat
 * @returns {Promise<CryptoKey>}
 */
export async function generateChatKey() {
  return await crypto.subtle.generateKey(
    {
      name: ENCRYPTION_ALGORITHM,
      length: KEY_LENGTH,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a key to be stored
 * @param {CryptoKey} key
 * @returns {Promise<string>} Base64 encoded key
 */
export async function exportKey(key) {
  const exported = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
}

/**
 * Import a key from storage
 * @param {string} keyData Base64 encoded key
 * @returns {Promise<CryptoKey>}
 */
export async function importKey(keyData) {
  const keyBuffer = base64ToArrayBuffer(keyData);
  return await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    {
      name: ENCRYPTION_ALGORITHM,
      length: KEY_LENGTH,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a message
 * @param {string} plaintext
 * @param {CryptoKey} key
 * @returns {Promise<string>} Base64 encoded encrypted data with IV prepended
 */
export async function encryptMessage(plaintext, key) {
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  // Encode plaintext
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    {
      name: ENCRYPTION_ALGORITHM,
      iv: iv,
    },
    key,
    data
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Return as base64
  return arrayBufferToBase64(combined.buffer);
}

/**
 * Decrypt a message
 * @param {string} encryptedData Base64 encoded encrypted data with IV prepended
 * @param {CryptoKey} key
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decryptMessage(encryptedData, key) {
  try {
    // Decode from base64
    const combined = base64ToArrayBuffer(encryptedData);
    
    // Extract IV and ciphertext
    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ENCRYPTION_ALGORITHM,
        iv: iv,
      },
      key,
      ciphertext
    );
    
    // Decode to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt message');
  }
}

/**
 * Get or create encryption key for a chat
 * @param {string} chatId
 * @returns {Promise<CryptoKey>}
 */
export async function getChatKey(chatId) {
  const storageKey = `chat_key_${chatId}`;
  const storedKey = localStorage.getItem(storageKey);
  
  if (storedKey) {
    return await importKey(storedKey);
  }
  
  // Generate new key
  const newKey = await generateChatKey();
  const exportedKey = await exportKey(newKey);
  localStorage.setItem(storageKey, exportedKey);
  
  return newKey;
}

/**
 * Delete encryption key for a chat
 * @param {string} chatId
 */
export function deleteChatKey(chatId) {
  const storageKey = `chat_key_${chatId}`;
  localStorage.removeItem(storageKey);
}

/**
 * Check if encryption is supported
 * @returns {boolean}
 */
export function isEncryptionSupported() {
  return !!(crypto && crypto.subtle && crypto.subtle.generateKey);
}

// Helper functions
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Share chat key with another user (for new participant)
 * In a real implementation, you'd use public key cryptography
 * For now, we'll just use the same key for both participants
 * 
 * @param {string} chatId
 * @param {string} recipientUserId
 * @returns {Promise<void>}
 */
export async function shareChatKey(chatId, recipientUserId) {
  // In production, implement key exchange using:
  // 1. Generate RSA key pair per user
  // 2. Encrypt chat key with recipient's public key
  // 3. Store encrypted key exchange in database
  // 4. Recipient decrypts with their private key
  
  console.log(`Key sharing for chat ${chatId} with user ${recipientUserId}`);
  // For now, both users generate the same key deterministically
  // or the key is shared via secure channel during chat creation
}
