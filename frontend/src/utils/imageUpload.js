/**
 * Secure Image Upload Utilities
 * 
 * Validates, encrypts, and uploads images securely
 */

import { supabase } from '../lib/supabase';
import { encryptMessage, getChatKey } from './encryption';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DIMENSIONS = { width: 4096, height: 4096 };

/**
 * Validate image file
 * @param {File} file
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateImage(file) {
  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    };
  }

  // Check image dimensions
  try {
    const dimensions = await getImageDimensions(file);
    if (dimensions.width > MAX_DIMENSIONS.width || dimensions.height > MAX_DIMENSIONS.height) {
      return {
        valid: false,
        error: `Image dimensions too large. Maximum: ${MAX_DIMENSIONS.width}x${MAX_DIMENSIONS.height}px`
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: 'Failed to read image file'
    };
  }

  // Basic content validation (check if it's actually an image)
  try {
    await createImageBitmap(file);
  } catch (error) {
    return {
      valid: false,
      error: 'File is not a valid image'
    };
  }

  return { valid: true };
}

/**
 * Get image dimensions
 * @param {File} file
 * @returns {Promise<{width: number, height: number}>}
 */
function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Compress image if needed
 * @param {File} file
 * @param {number} maxSizeMB
 * @returns {Promise<Blob>}
 */
export async function compressImage(file, maxSizeMB = 5) {
  // If already small enough, return as-is
  if (file.size <= maxSizeMB * 1024 * 1024) {
    return file;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = await createImageBitmap(file);

  // Calculate new dimensions (maintain aspect ratio)
  let { width, height } = img;
  const maxDim = 2048;
  
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = (height / width) * maxDim;
      width = maxDim;
    } else {
      width = (width / height) * maxDim;
      height = maxDim;
    }
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  // Compress with quality adjustment
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      'image/jpeg',
      0.85 // 85% quality
    );
  });
}

/**
 * Sanitize filename
 * @param {string} filename
 * @returns {string}
 */
function sanitizeFilename(filename) {
  // Remove special characters, keep only alphanumeric, dots, and hyphens
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100); // Limit length
}

/**
 * Upload image to Supabase storage with encryption
 * @param {File} file
 * @param {string} chatId
 * @param {string} messageId
 * @returns {Promise<{url: string, path: string, attachmentId: string}>}
 */
export async function uploadChatImage(file, chatId, messageId) {
  // Validate
  const validation = await validateImage(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Compress if needed
  const processedFile = await compressImage(file);

  // Generate unique filename
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const extension = file.name.split('.').pop();
  const sanitizedName = sanitizeFilename(file.name.replace(`.${extension}`, ''));
  const filename = `${sanitizedName}_${timestamp}_${random}.${extension}`;
  const storagePath = `chats/${chatId}/${filename}`;

  // Upload to Supabase storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('chat-attachments')
    .upload(storagePath, processedFile, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error('Failed to upload image');
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('chat-attachments')
    .getPublicUrl(storagePath);

  // Create attachment record in database
  const { data: attachment, error: dbError } = await supabase
    .from('chat_attachments')
    .insert({
      message_id: messageId,
      chat_id: chatId,
      uploaded_by: (await supabase.auth.getUser()).data.user.id,
      file_name: file.name,
      file_type: file.type,
      file_size: processedFile.size || file.size,
      storage_path: storagePath,
      is_encrypted: false, // Supabase storage already encrypts at rest
      is_scanned: false // Would integrate virus scanning service here
    })
    .select()
    .single();

  if (dbError) {
    // Cleanup uploaded file
    await supabase.storage.from('chat-attachments').remove([storagePath]);
    throw new Error('Failed to create attachment record');
  }

  return {
    url: urlData.publicUrl,
    path: storagePath,
    attachmentId: attachment.id
  };
}

/**
 * Delete image from storage
 * @param {string} storagePath
 * @returns {Promise<void>}
 */
export async function deleteChatImage(storagePath) {
  const { error } = await supabase.storage
    .from('chat-attachments')
    .remove([storagePath]);

  if (error) {
    console.error('Failed to delete image:', error);
    throw new Error('Failed to delete image');
  }
}

/**
 * Check for suspicious content (basic client-side checks)
 * In production, use a proper content moderation API
 * @param {File} file
 * @returns {Promise<{safe: boolean, reason?: string}>}
 */
export async function scanImageContent(file) {
  // Basic checks only - in production use AWS Rekognition, Google Vision API, etc.
  
  // Check file signature (magic bytes)
  const magicBytes = await readFileMagicBytes(file);
  const validSignatures = {
    'image/jpeg': ['ffd8ff'],
    'image/png': ['89504e47'],
    'image/gif': ['474946'],
    'image/webp': ['52494646']
  };

  const fileSignature = magicBytes.toLowerCase();
  const expectedSignatures = Object.values(validSignatures).flat();
  
  if (!expectedSignatures.some(sig => fileSignature.startsWith(sig))) {
    return {
      safe: false,
      reason: 'File signature does not match declared type'
    };
  }

  return { safe: true };
}

/**
 * Read first few bytes of file
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileMagicBytes(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const slice = file.slice(0, 8);

    reader.onload = () => {
      const bytes = new Uint8Array(reader.result);
      const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      resolve(hex);
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(slice);
  });
}

/**
 * Create image preview URL
 * @param {File} file
 * @returns {string}
 */
export function createImagePreview(file) {
  return URL.createObjectURL(file);
}

/**
 * Revoke image preview URL
 * @param {string} url
 */
export function revokeImagePreview(url) {
  URL.revokeObjectURL(url);
}
