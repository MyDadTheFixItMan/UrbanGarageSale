import React, { useState, useRef } from 'react';
import { Upload, Trash2, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SVGEditor() {
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    
    const [uploadedImages, setUploadedImages] = useState([]);
    const [draggingImage, setDraggingImage] = useState(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    // Handle image upload/paste
    const handleImagePaste = (e) => {
        const files = e.target.files || e.clipboard?.files;
        if (!files) return;

        Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                setUploadedImages((prev) => [
                    ...prev,
                    {
                        id: Date.now(),
                        src: event.target.result,
                        x: 50,
                        y: 50,
                        width: 200,
                        height: 150,
                    },
                ]);
                toast.success('Image added!');
            };
            reader.readAsDataURL(file);
        });
    };

    // Paste image from clipboard
    const handleCanvasPaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                handleImagePaste({ target: { files: [file] } });
            }
        }
    };

    const deleteImage = (id) => {
        setUploadedImages((prev) => prev.filter((img) => img.id !== id));
        toast.success('Image deleted');
    };

    const handleImageMouseDown = (id, e) => {
        e.preventDefault();
        setDraggingImage(id);
        const image = uploadedImages.find((img) => img.id === id);
        const rect = canvasRef.current.getBoundingClientRect();
        setOffset({
            x: e.clientX - rect.left - image.x,
            y: e.clientY - rect.top - image.y,
        });
    };

    const handleCanvasMouseMove = (e) => {
        if (draggingImage && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const newX = e.clientX - rect.left - offset.x;
            const newY = e.clientY - rect.top - offset.y;

            setUploadedImages((prev) =>
                prev.map((img) =>
                    img.id === draggingImage
                        ? { ...img, x: Math.max(0, newX), y: Math.max(0, newY) }
                        : img
                )
            );
        }
    };

    const handleCanvasMouseUp = () => {
        setDraggingImage(null);
    };

    return (
        <div className="min-h-screen bg-[#f5f1e8] pt-20 px-4">
            <div className="max-w-6xl mx-auto">
                <div>
                    <h1 className="text-4xl font-bold text-[#1e3a5f] mb-2">Logo Design Assistant</h1>
                    <p className="text-slate-600 mb-8">Upload or paste reference images to show how you want the logo arranged</p>
                </div>

                <div>
                    <div className="bg-white rounded-lg shadow-md p-4 border-2 border-slate-200 mb-6">
                        <div className="flex gap-3 mb-4">
                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-[#f97316] hover:bg-[#ea580c] text-white gap-2"
                            >
                                <Upload className="w-4 h-4" />
                                Upload Reference Image
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImagePaste}
                                className="hidden"
                                multiple
                            />
                            <span className="text-sm text-slate-600 flex items-center">
                                💡 Or paste an image (Ctrl+V)
                            </span>
                        </div>

                        <div
                            ref={canvasRef}
                            onMouseMove={handleCanvasMouseMove}
                            onMouseUp={handleCanvasMouseUp}
                            onMouseLeave={handleCanvasMouseUp}
                            onPaste={handleCanvasPaste}
                            className="relative w-full bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg"
                            style={{ minHeight: '600px' }}
                            tabIndex={0}
                        >
                            {uploadedImages.length === 0 ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                                    <Upload className="w-12 h-12 mb-2 opacity-50" />
                                    <p className="text-center">
                                        Upload or paste reference images here<br />
                                        <span className="text-xs">Drag to reposition</span>
                                    </p>
                                </div>
                            ) : null}

                            {uploadedImages.map((image) => (
                                <div
                                    key={image.id}
                                    className="absolute group"
                                    style={{
                                        left: `${image.x}px`,
                                        top: `${image.y}px`,
                                        cursor: draggingImage === image.id ? 'grabbing' : 'grab',
                                    }}
                                    onMouseDown={(e) => handleImageMouseDown(image.id, e)}
                                >
                                    <img
                                        src={image.src}
                                        alt="Reference"
                                        style={{
                                            width: `${image.width}px`,
                                            height: `${image.height}px`,
                                            userSelect: 'none',
                                            borderRadius: '8px',
                                        }}
                                        className="shadow-lg border-2 border-[#f97316]"
                                        draggable={false}
                                    />
                                    <button
                                        onClick={() => deleteImage(image.id)}
                                        className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <div className="absolute -top-8 left-0 bg-[#f97316] text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <Move className="w-3 h-3" />
                                        Drag to move
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <p className="text-sm text-blue-800">
                                <strong>📸 Reference Images:</strong> Upload or paste screenshots showing how you want the logo to look.
                            </p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                            <p className="text-sm text-green-800">
                                <strong>💾 Next Step:</strong> Once you've arranged your references, I can code the actual logo based on your design.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
