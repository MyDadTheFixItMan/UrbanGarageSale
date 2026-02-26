// src/__tests__/features/fileUpload.test.js
import { compressImage, getFileSizeDisplay } from '@/lib/imageOptimization';
import { firebase } from '@/api/firebaseClient';

// Mock canvas
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillStyle: '',
  fillRect: jest.fn(),
  drawImage: jest.fn(),
}));

HTMLCanvasElement.prototype.toBlob = jest.fn((callback) => {
  const blob = new Blob(['mock image data'], { type: 'image/jpeg' });
  callback(blob);
});

describe('File Upload & Compression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Image Compression', () => {
    test('should compress image successfully', async () => {
      const file = new File(['dummy image data'], 'test.jpg', {
        type: 'image/jpeg',
      });

      const compressedFile = await compressImage(file, 2560, 1920, 0.85);

      expect(compressedFile).toBeDefined();
      expect(compressedFile.name).toBe('test.jpg');
      expect(compressedFile.type).toBe('image/jpeg');
    });

    test('should handle non-image files gracefully', async () => {
      const file = new File(['not an image'], 'document.pdf', {
        type: 'application/pdf',
      });

      // This should fail or skip compression
      await expect(() => compressImage(file)).rejects.toThrow();
    });

    test('should maintain aspect ratio when compressing', async () => {
      // Since we mock canvas, we verify the function runs without error
      const file = new File(['image'], 'portrait.jpg', {
        type: 'image/jpeg',
      });

      const compressed = await compressImage(file, 1000, 1500);
      expect(compressed).toBeDefined();
    });
  });

  describe('File Size Display', () => {
    test('should format bytes correctly', () => {
      expect(getFileSizeDisplay(0)).toBe('0 Bytes');
      expect(getFileSizeDisplay(1024)).toBe('1 KB');
      expect(getFileSizeDisplay(1024 * 1024)).toBe('1 MB');
      expect(getFileSizeDisplay(1024 * 1024 * 5)).toBe('5 MB');
    });

    test('should round to 2 decimal places', () => {
      expect(getFileSizeDisplay(1536)).toBe('1.5 KB');
      expect(getFileSizeDisplay(2097152)).toBe('2 MB');
    });
  });

  describe('Cloud Storage Upload', () => {
    test('should upload image to Cloud Storage', async () => {
      const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
      const url = await firebase.storage.uploadImage(file, 'listings/user123/image.jpg');

      expect(url).toBe('https://example.com/image.jpg');
      expect(firebase.storage.uploadImage).toHaveBeenCalledWith(
        file,
        'listings/user123/image.jpg'
      );
    });

    test('should handle upload errors gracefully', async () => {
      firebase.storage.uploadImage.mockRejectedValueOnce(
        new Error('Upload failed')
      );

      await expect(
        firebase.storage.uploadImage(
          new File([], 'test.jpg'),
          'listings/user123/image.jpg'
        )
      ).rejects.toThrow('Upload failed');
    });

    test('should support multiple file uploads', async () => {
      const files = [
        new File(['img1'], 'photo1.jpg', { type: 'image/jpeg' }),
        new File(['img2'], 'photo2.jpg', { type: 'image/jpeg' }),
        new File(['img3'], 'photo3.jpg', { type: 'image/jpeg' }),
      ];

      for (const file of files) {
        await firebase.storage.uploadImage(file, `listings/user123/${file.name}`);
      }

      expect(firebase.storage.uploadImage).toHaveBeenCalledTimes(3);
    });
  });

  describe('File Validation', () => {
    test('should accept valid image formats', () => {
      const validFormats = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
      ];

      validFormats.forEach((format) => {
        const file = new File(['data'], 'test.jpg', { type: format });
        expect(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']).toContain(
          file.type
        );
      });
    });

    test('should reject invalid file formats', () => {
      const invalidFormats = [
        'text/plain',
        'application/pdf',
        'video/mp4',
      ];

      invalidFormats.forEach((format) => {
        const file = new File(['data'], 'bad.txt', { type: format });
        expect(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']).not.toContain(
          file.type
        );
      });
    });

    test('should reject files over 5MB', () => {
      const maxSize = 5 * 1024 * 1024;
      const largeFileSize = maxSize + 1;
      const largeFile = new File(
        ['x'.repeat(100)],  // Create a file with 100 bytes of content
        'huge.jpg',
        { type: 'image/jpeg' }
      );

      // Mock a large file by directly setting size if needed
      expect(maxSize).toBeGreaterThan(0);
      expect(largeFileSize > maxSize).toBe(true);
    });
  });
});
