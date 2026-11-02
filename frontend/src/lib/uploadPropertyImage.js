import axios from 'axios';

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const MAX_SOURCE_SIZE = 30 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

const imageBlob = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('تعذر تجهيز الصورة للرفع. جرّب صورة بصيغة JPG أو PNG.'));
  }, 'image/jpeg', quality);
});

async function compressImage(file) {
  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error('حجم الصورة الأصلية كبير جداً. اختر صورة لا يتجاوز حجمها 30 ميجابايت.');
  }

  let image;
  let releaseImage = () => {};
  try {
    if (typeof createImageBitmap === 'function') {
      image = await createImageBitmap(file);
      releaseImage = () => image.close?.();
    } else {
      const objectUrl = URL.createObjectURL(file);
      image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('تعذر قراءة الصورة. اختر صورة بصيغة JPG أو PNG.'));
        element.src = objectUrl;
      }).finally(() => URL.revokeObjectURL(objectUrl));
    }
  } catch {
    throw new Error('تعذر قراءة الصورة. اختر صورة بصيغة JPG أو PNG أو WebP.');
  }

  try {
    const sourceWidth = image.width;
    const sourceHeight = image.height;
    if (!sourceWidth || !sourceHeight) {
      throw new Error('أبعاد الصورة غير صالحة. اختر صورة أخرى.');
    }

    const scale = Math.min(1, 1920 / sourceWidth, 1920 / sourceHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) throw new Error('تعذر تجهيز الصورة للرفع.');

    const qualities = [0.88, 0.82, 0.76, 0.7, 0.64, 0.58, 0.52, 0.46];
    for (let attempt = 0; attempt < qualities.length; attempt += 1) {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await imageBlob(canvas, qualities[attempt]);
      if (blob.size <= MAX_UPLOAD_SIZE) {
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'property-image';
        return new File([blob], `${baseName}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
      }

      if (attempt >= 2) {
        canvas.width = Math.max(1, Math.round(canvas.width * 0.85));
        canvas.height = Math.max(1, Math.round(canvas.height * 0.85));
      }
    }
  } finally {
    releaseImage();
  }

  throw new Error('تعذر تصغير الصورة إلى الحجم المسموح. اختر صورة أصغر.');
}

async function prepareImage(file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (SUPPORTED_EXTENSIONS.has(extension) && file.size <= MAX_UPLOAD_SIZE) return file;
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('الملف المحدد ليس صورة.');
  }
  return compressImage(file);
}

export async function uploadPropertyImage(file) {
  const preparedFile = await prepareImage(file);
  const payload = new FormData();
  payload.append('file', preparedFile);

  const { data } = await axios.post(`${BACKEND_URL}/api/upload`, payload, {
    withCredentials: true,
  });

  if (!data?.url) throw new Error('رفع الصورة نجح لكن لم يصل رابطها من الخادم.');
  return new URL(data.url, `${BACKEND_URL || window.location.origin}/`).toString();
}
