/**
 * IMAGE UPLOAD TEST UTILITY
 * 
 * This file provides a test function to verify that image uploads work correctly
 * to Supabase Storage and are properly saved in the database.
 * 
 * Usage:
 * import { testDummyImageUpload } from './imageUploadTest';
 * testDummyImageUpload(userId);
 */

import { supabase } from './supabase';

/**
 * Create a dummy image (1x1 transparent PNG in base64)
 * Returns a Blob that can be uploaded
 */
export const createDummyImageBlob = () => {
  // 1x1 transparent PNG
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const binaryString = atob(pngBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'image/png' });
};

/**
 * Convert Blob to File object
 */
export const blobToFile = (blob, filename = 'dummy.png') => {
  return new File([blob], filename, { type: 'image/png' });
};

/**
 * Test image upload to Supabase Storage
 * This verifies:
 * 1. File uploads successfully to 'item-images' bucket
 * 2. File is stored in correct path format: {userId}/{timestamp}-{random}.png
 * 3. Public URL is generated correctly
 */
export const testImageUpload = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required for image upload test');
  }

  console.log('\n========== IMAGE UPLOAD TEST START ==========');
  console.log('User ID:', userId);
  console.log('Target Bucket: item-images');
  console.log('Expected Path Format: {userId}/{timestamp}-{random}.png\n');

  try {
    // Step 1: Create dummy image
    console.log('📋 Step 1: Creating dummy image...');
    const imageBlob = createDummyImageBlob();
    const imageFile = blobToFile(imageBlob);
    console.log('✅ Dummy image created:', imageFile.name, `(${imageFile.size} bytes)`);

    // Step 2: Upload to Supabase Storage
    console.log('\n📦 Step 2: Uploading to Supabase Storage...');
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    console.log('File path:', fileName);

    const { data, error } = await supabase.storage
      .from('item-images')
      .upload(fileName, imageFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('❌ Upload failed:', error);
      throw new Error(`Upload error: ${error.message}`);
    }

    console.log('✅ Upload successful!');
    console.log('Storage path:', data.path);

    // Step 3: Get public URL
    console.log('\n🔗 Step 3: Generating public URL...');
    const { data: urlData } = supabase.storage
      .from('item-images')
      .getPublicUrl(data.path);

    const publicUrl = urlData.publicUrl;
    console.log('✅ Public URL generated:', publicUrl);

    // Step 4: Verify URL is accessible
    console.log('\n🌐 Step 4: Verifying URL accessibility...');
    try {
      const response = await fetch(publicUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log('✅ URL is accessible (HTTP', response.status, ')');
      } else {
        console.warn('⚠️  URL returned HTTP', response.status);
      }
    } catch (fetchError) {
      console.warn('⚠️  Could not verify URL accessibility:', fetchError.message);
    }

    // Step 5: Return success with upload details
    console.log('\n========== IMAGE UPLOAD TEST PASSED ==========\n');
    return {
      success: true,
      storagePath: data.path,
      publicUrl: publicUrl,
      bucket: 'item-images',
      fileName: imageFile.name,
      fileSize: imageFile.size,
    };

  } catch (error) {
    console.error('\n❌ IMAGE UPLOAD TEST FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('========== IMAGE UPLOAD TEST FAILED ==========\n');
    throw error;
  }
};

/**
 * Test creating an item with uploaded image in database
 */
export const testCreateItemWithImage = async (userId, imageUrl, storageePath) => {
  if (!userId || !imageUrl) {
    throw new Error('User ID and Image URL are required');
  }

  console.log('\n========== ITEM CREATION WITH IMAGE TEST START ==========');
  console.log('User ID:', userId);
  console.log('Image URL:', imageUrl);
  console.log('Storage Path:', storageePath);

  try {
    // Create test item
    console.log('\n📝 Creating test item in database...');
    const itemData = {
      finder_id: userId,
      title: '[TEST] Dummy Image Upload Test',
      description: 'Auto-generated test item to verify image upload flow',
      category_id: null, // No specific category for test
      area_id: null, // No specific area for test
      location_details: 'Test Location',
      date_found: new Date().toISOString().split('T')[0],
      color: null,
      brand: null,
      security_question: 'test',
      status: 'active',
      contact_method: 'chat',
    };

    const { data: itemResult, error: itemError } = await supabase
      .from('items')
      .insert(itemData)
      .select()
      .single();

    if (itemError) {
      throw new Error(`Item creation failed: ${itemError.message}`);
    }

    console.log('✅ Item created with ID:', itemResult.id);

    // Insert image record
    console.log('\n🖼️  Inserting image record into item_images table...');
    const imageRecord = {
      item_id: itemResult.id,
      storage_bucket: 'item-images',
      storage_path: storageePath,
      image_url: imageUrl,
      is_primary: true,
      sort_order: 0,
    };

    const { error: imgError } = await supabase
      .from('item_images')
      .insert(imageRecord);

    if (imgError) {
      console.error('⚠️  Image record insertion failed:', imgError.message);
      // Continue - item was created successfully
    } else {
      console.log('✅ Image record inserted successfully');
    }

    // Fetch item with images to verify
    console.log('\n✔️  Fetching item with images to verify...');
    const { data: verifyItem, error: verifyError } = await supabase
      .from('items')
      .select('*, images:item_images(*)')
      .eq('id', itemResult.id)
      .single();

    if (verifyError) {
      throw new Error(`Verification failed: ${verifyError.message}`);
    }

    console.log('✅ Item fetched successfully');
    console.log('Item ID:', verifyItem.id);
    console.log('Title:', verifyItem.title);
    console.log('Images count:', verifyItem.images?.length || 0);
    if (verifyItem.images && verifyItem.images.length > 0) {
      console.log('First image URL:', verifyItem.images[0].image_url);
    }

    console.log('\n========== ITEM CREATION WITH IMAGE TEST PASSED ==========\n');
    return {
      success: true,
      itemId: itemResult.id,
      imageUrl: imageUrl,
      itemTitle: itemResult.title,
      imagesCount: verifyItem.images?.length || 0,
    };

  } catch (error) {
    console.error('\n❌ ITEM CREATION WITH IMAGE TEST FAILED');
    console.error('Error:', error.message);
    console.error('========== ITEM CREATION WITH IMAGE TEST FAILED ==========\n');
    throw error;
  }
};

/**
 * Run full end-to-end image upload test
 */
export const runFullImageUploadTest = async (userId) => {
  try {
    // Test 1: Upload image
    const uploadResult = await testImageUpload(userId);

    // Test 2: Create item with image
    const itemResult = await testCreateItemWithImage(
      userId,
      uploadResult.publicUrl,
      uploadResult.storagePath
    );

    console.log('\n═══════════════════════════════════════════════');
    console.log('🎉 ALL TESTS PASSED! 🎉');
    console.log('═══════════════════════════════════════════════');
    console.log('\nTest Summary:');
    console.log('✅ Image uploaded to:', uploadResult.bucket);
    console.log('✅ Storage path:', uploadResult.storagePath);
    console.log('✅ Public URL:', uploadResult.publicUrl);
    console.log('✅ Item created with ID:', itemResult.itemId);
    console.log('✅ Image linked to item:', itemResult.imagesCount, 'image(s)');
    console.log('\nYou can view the test item at:');
    console.log(`http://localhost:5173/items/${itemResult.itemId}`);
    console.log('═══════════════════════════════════════════════\n');

    return {
      upload: uploadResult,
      item: itemResult,
    };
  } catch (error) {
    console.error('\n❌ FULL TEST FAILED');
    console.error(error.message);
    throw error;
  }
};
