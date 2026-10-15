import React, { useRef, useState } from 'react';
import { Image, Upload, X, Loader2 } from 'lucide-react';
import { toast } from "sonner";
import { firebase } from '@/api/firebaseClient';
import { compressImage } from '@/lib/imageOptimization';
import { FormSection } from './ListingSections';
import { MAX_PHOTOS, ALLOWED_PHOTO_TYPES, photoProblem } from './listingForm';

// Reads an image's pixel size, or null if the browser can't decode it.
function readDimensions(file) {
    return new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () => {
            URL.revokeObjectURL(img.src);
            resolve({ width: img.width, height: img.height });
        };
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(file);
    });
}

// Checks, compresses and uploads one photo. Returns its download URL, or null if it was refused.
async function uploadPhoto(file, userId) {
    const problem = photoProblem(file, await readDimensions(file));
    if (problem) {
        toast.error(problem);
        return null;
    }

    let upload = file;
    try {
        const compressed = await compressImage(file);
        if (compressed.size < file.size) upload = compressed;
    } catch {
        // Upload the original if compression fails
    }

    try {
        const suffix = Math.random().toString(36).substring(2, 8);
        const url = await firebase.storage.uploadImage(upload, `listings/${userId}/${Date.now()}-${suffix}-${file.name}`);
        toast.success(`"${file.name}" uploaded successfully`);
        return url;
    } catch (error) {
        console.error('Upload error for', file.name, error);
        toast.error(`"${file.name}" upload failed: ${error.message}`);
        return null;
    }
}

// `onChange` takes an updater function (photos => photos), so uploads that finish while the
// seller removes a photo don't overwrite each other.
export default function PhotosSection({ photos, onChange, userId }) {
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    const handleFiles = async (e) => {
        const files = Array.from(e.target.files || []);
        // Reset the input so the same file can be chosen again
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (!files.length) return;

        if (photos.length + files.length > MAX_PHOTOS) {
            toast.error(`Maximum ${MAX_PHOTOS} photos allowed`);
            return;
        }

        setUploading(true);
        try {
            const urls = await Promise.all(files.map((file) => uploadPhoto(file, userId)));
            onChange((prev) => [...prev, ...urls.filter(Boolean)]);
        } finally {
            setUploading(false);
        }
    };

    const removePhoto = (index) => onChange((prev) => prev.filter((_, i) => i !== index));

    return (
        <FormSection title="Photos" icon={Image}>
            <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {photos.map((photo, index) => (
                        <div key={photo} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                            <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                            <button
                                type="button"
                                aria-label={`Remove photo ${index + 1}`}
                                onClick={() => removePhoto(index)}
                                className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}

                    {photos.length < MAX_PHOTOS && (
                        <label className="aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-[#1e3a5f] transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-[#1e3a5f]">
                            {uploading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    <Upload className="w-6 h-6" />
                                    <span className="text-xs">Add Photo</span>
                                </>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={ALLOWED_PHOTO_TYPES.join(',')}
                                multiple
                                onChange={handleFiles}
                                className="hidden"
                            />
                        </label>
                    )}
                </div>

                <p className="text-sm text-slate-500">
                    Upload up to {MAX_PHOTOS} images (JPEG, PNG, WEBP). Max 5MB and 2560×1920px each. First image will be the cover.
                </p>
            </div>
        </FormSection>
    );
}
