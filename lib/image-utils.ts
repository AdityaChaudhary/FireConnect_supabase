export async function blurImage(file: File, blurRadius: number = 40, quality: number = 0.8): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Failed to get canvas context"));
                return;
            }

            const scale = Math.min(1, 800 / Math.max(img.width, img.height));
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            ctx.filter = `blur(${blurRadius}px)`;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Failed to create blob from canvas"));
                }
            }, 'image/jpeg', quality);
        };
        img.onerror = (err) => reject(err);
        img.src = URL.createObjectURL(file);
    });
}

export async function compressImage(
    file: File,
    maxWidth: number = 1920,
    maxHeight: number = 1920,
    quality: number = 0.8
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Failed to get canvas context"));
                return;
            }

            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }

            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Failed to create blob from canvas"));
                }
            }, 'image/jpeg', quality);
        };
        img.onerror = (err) => reject(err);
        img.src = URL.createObjectURL(file);
    });
}

export function getDefaultAvatar(gender?: string | null): string {
    const g = (gender || '').toUpperCase();
    if (g === 'MALE') return 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix';
    if (g === 'FEMALE') return 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma';
    return 'https://api.dicebear.com/7.x/avataaars/svg?seed=neutral';
}
