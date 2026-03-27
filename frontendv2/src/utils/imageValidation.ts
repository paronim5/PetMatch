export const validateImage = (file: File): Promise<{ ok: boolean; message: string }> => {
  return new Promise((resolve) => {
    if (!file) {
      resolve({ ok: false, message: 'No file selected' });
      return;
    }

    // 1. Check Format
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      resolve({ 
        ok: false, 
        message: 'Invalid image format. Please upload a JPEG, PNG, WebP, or GIF image.' 
      });
      return;
    }

    // 2. Check Size (e.g., max 5MB to match backend)
    const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeInBytes) {
      resolve({ 
        ok: false, 
        message: `Image size is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Please upload an image smaller than 5MB.` 
      });
      return;
    }

    // 3. Optional: Check Dimensions (if needed, but format/size is usually enough for basic validation)
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      // Example: Min 200x200
      if (img.width < 200 || img.height < 200) {
        resolve({
            ok: false,
            message: 'Image resolution is too low. Please upload an image at least 200x200px.'
        });
      } else {
        resolve({ ok: true, message: 'Valid image' });
      }
    };
    img.onerror = () => {
        URL.revokeObjectURL(img.src);
        resolve({ ok: false, message: 'Invalid image file.' });
    };
  });
};
