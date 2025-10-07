import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { FormFields, GenerationResult, Template, Ratio, InlineData } from './types';
import { generateAdImage, generateAdCopy } from './services/geminiService';

// To satisfy TypeScript for CDN-loaded libraries
declare var JSZip: any;
declare var saveAs: any;
declare var Cropper: any;

// --- Helper Functions ---
const fileToInlineData = (file: File): Promise<InlineData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            const mimeType = result.split(';')[0].split(':')[1];
            const data = result.split(',')[1];
            resolve({ mimeType, data });
        };
        reader.onerror = (error) => reject(error);
    });
};

const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error("Could not parse mime type");
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

const downloadImage = (src: string, filename: string) => {
    const link = document.createElement('a');
    link.href = src;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


// --- SVG Icons ---
const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 13.5 3 3m0 0 3-3m-3 3v-6m1.06-4.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
);

const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
    </svg>
);

const ErrorIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
);

const RotateCwIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
    </svg>
);

const Spinner: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


// --- UI Components ---
const Header: React.FC<{ onDownloadZip: () => void; canDownload: boolean }> = ({ onDownloadZip, canDownload }) => (
    <header className="fixed top-0 left-0 right-0 z-10 bg-slate-950/60 backdrop-blur-sm border-b border-slate-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                <h1 className="text-xl font-bold text-white">
                    Latief Ads — <span className="text-blue-500">Affiliate Photo Ads Generator</span>
                </h1>
                <button
                    onClick={onDownloadZip}
                    disabled={!canDownload}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md shadow-md hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500"
                >
                    <DownloadIcon className="w-5 h-5" />
                    Download ZIP
                </button>
            </div>
        </div>
    </header>
);

const Footer: React.FC = () => (
    <footer className="w-full py-6 text-center text-slate-500 text-sm">
        <p>© 2025 Latief Ads — From Idea to App 🚀</p>
    </footer>
);

interface ImageEditorModalProps {
    imageSrc: string;
    onSave: (editedFile: File) => void;
    onClose: () => void;
}

const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ imageSrc, onSave, onClose }) => {
    const imageRef = useRef<HTMLImageElement>(null);
    const cropperRef = useRef<any>(null);

    useEffect(() => {
        if (imageRef.current) {
            cropperRef.current = new Cropper(imageRef.current, {
                aspectRatio: NaN, // Free crop
                viewMode: 1,
                background: false,
                responsive: true,
                autoCropArea: 0.8,
                zoomable: true,
            });
        }
        return () => {
            cropperRef.current?.destroy();
        };
    }, [imageSrc]);

    const handleRotate = () => {
        cropperRef.current?.rotate(90);
    };

    const handleSave = () => {
        if (cropperRef.current) {
            const dataUrl = cropperRef.current.getCroppedCanvas().toDataURL('image/png');
            const file = dataURLtoFile(dataUrl, 'edited-product.png');
            onSave(file);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl border border-slate-700">
                <div className="p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white">Edit Product Image</h3>
                </div>
                <div className="p-4 max-h-[60vh] overflow-hidden">
                    <img ref={imageRef} src={imageSrc} alt="Image editor" style={{ maxWidth: '100%' }} />
                </div>
                 <div className="p-4 flex justify-between items-center bg-slate-900/50 rounded-b-2xl">
                    <button onClick={handleRotate} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-600 rounded-md hover:bg-slate-700 transition-colors">
                        <RotateCwIcon className="w-5 h-5" />
                        Rotate
                    </button>
                    <div className="flex gap-3">
                         <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-transparent rounded-md hover:bg-slate-700 transition-colors">Cancel</button>
                        <button onClick={handleSave} className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">Save</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface ConfigFormProps {
    fields: FormFields;
    setFields: React.Dispatch<React.SetStateAction<FormFields>>;
    brandColor: string;
    setBrandColor: (color: string) => void;
    template: Template;
    setTemplate: (template: Template) => void;
    ratios: Ratio[];
    setRatios: (ratios: Ratio[]) => void;
    watermark: boolean;
    setWatermark: (watermark: boolean) => void;
    batchSize: number;
    setBatchSize: (size: number) => void;
    onGenerate: () => void;
    isLoading: boolean;
    productFile: File | null;
    onProductFileChange: (file: File) => void;
    logoFile: File | null;
    setLogoFile: (file: File | null) => void;
    autoCopyProduct: string;
    setAutoCopyProduct: (product: string) => void;
    adCopyLanguage: 'id' | 'en';
    setAdCopyLanguage: (lang: 'id' | 'en') => void;
    onGenerateAdCopy: () => void;
    isCopyLoading: boolean;
}

const ConfigForm: React.FC<ConfigFormProps> = (props) => {
    const {
        fields, setFields, brandColor, setBrandColor, template, setTemplate,
        ratios, setRatios, watermark, setWatermark, batchSize, setBatchSize,
        onGenerate, isLoading, productFile, onProductFileChange, logoFile, setLogoFile,
        autoCopyProduct, setAutoCopyProduct, adCopyLanguage, setAdCopyLanguage,
        onGenerateAdCopy, isCopyLoading
    } = props;
    
    const productPreview = useMemo(() => productFile ? URL.createObjectURL(productFile) : null, [productFile]);
    const logoPreview = useMemo(() => logoFile ? URL.createObjectURL(logoFile) : null, [logoFile]);

    const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFields(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRatioChange = (ratio: Ratio) => {
        setRatios(
            ratios.includes(ratio)
                ? ratios.filter(r => r !== ratio)
                : [...ratios, ratio]
        );
    };

    const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onProductFileChange(e.target.files[0]);
        }
    };

    const isGenerateDisabled = !productFile || !fields.headline || ratios.length === 0 || isLoading;
    const TEMPLATE_OPTIONS: Template[] = ['Hero', 'Price Tag', 'UGC Style', 'Minimalist', 'Bold Typography', 'Benefit-focused'];

    return (
        <div className="lg:col-span-1 space-y-6 p-6 bg-slate-900/50 border border-slate-800 rounded-2xl shadow-lg">
            {/* Section 1: Upload */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-blue-400 border-b border-slate-700 pb-2">1. Upload Assets</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Product Upload */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Foto Produk (Wajib)</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-600 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                {productPreview ? <img src={productPreview} alt="Product Preview" className="mx-auto h-24 w-24 object-cover rounded-md"/> : <UploadIcon className="mx-auto h-12 w-12 text-slate-500" />}
                                <div className="flex text-sm text-slate-400">
                                    <label htmlFor="product-upload" className="relative cursor-pointer bg-slate-800 rounded-md font-medium text-blue-400 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-slate-900 focus-within:ring-blue-500 px-1">
                                        <span>Upload & Edit</span>
                                        <input id="product-upload" name="product-upload" type="file" className="sr-only" accept="image/png, image/jpeg" onChange={handleProductUpload} />
                                    </label>
                                </div>
                                <p className="text-xs text-slate-500">PNG, JPG up to 10MB</p>
                            </div>
                        </div>
                    </div>
                     {/* Logo Upload */}
                    <div>
                         <label className="block text-sm font-medium text-slate-300 mb-1">Logo (Opsional)</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-600 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                {logoPreview ? <img src={logoPreview} alt="Logo Preview" className="mx-auto h-24 w-24 object-contain rounded-md"/> : <UploadIcon className="mx-auto h-12 w-12 text-slate-500" />}
                                <div className="flex text-sm text-slate-400">
                                    <label htmlFor="logo-upload" className="relative cursor-pointer bg-slate-800 rounded-md font-medium text-blue-400 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-slate-900 focus-within:ring-blue-500 px-1">
                                        <span>Upload a file</span>
                                        <input id="logo-upload" name="logo-upload" type="file" className="sr-only" accept="image/png, image/jpeg" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
                                    </label>
                                </div>
                                <p className="text-xs text-slate-500">PNG, JPG up to 5MB</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 2 & 3: Template & Ratio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="template" className="block text-sm font-medium text-blue-400">2. Template</label>
                    <select id="template" value={template} onChange={e => setTemplate(e.target.value as Template)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-slate-800 border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md text-white">
                        {TEMPLATE_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
                    </select>
                </div>
                <div>
                     <label className="block text-sm font-medium text-blue-400">3. Ratio</label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {(['1:1', '4:5', '9:16', '16:9'] as Ratio[]).map(r => (
                            <label key={r} className={`flex items-center justify-center px-3 py-2 text-sm rounded-md cursor-pointer transition-colors ${ratios.includes(r) ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700'}`}>
                                <input type="checkbox" checked={ratios.includes(r)} onChange={() => handleRatioChange(r)} className="sr-only" />
                                {r}
                            </label>
                        ))}
                    </div>
                </div>
            </div>

             {/* Section 4: Text Fields */}
             <div>
                <h2 className="text-lg font-semibold text-blue-400 border-b border-slate-700 pb-2 mb-4">4. Ad Copy</h2>
                <div className="mb-6 bg-slate-800/50 p-3 rounded-lg">
                     <div className="flex justify-between items-center mb-2">
                        <label htmlFor="auto-copy-product" className="block text-sm font-medium text-slate-300">Generate Ad Copy Otomatis</label>
                        <select value={adCopyLanguage} onChange={e => setAdCopyLanguage(e.target.value as 'id' | 'en')} className="text-xs bg-slate-700 border-slate-600 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1">
                            <option value="id">Bahasa Indonesia</option>
                            <option value="en">English</option>
                        </select>
                     </div>
                    <div className="flex gap-2">
                        <input id="auto-copy-product" type="text" value={autoCopyProduct} onChange={e => setAutoCopyProduct(e.target.value)} placeholder="Sebutkan produk atau layanan Anda" className="input-style flex-grow" disabled={isCopyLoading}/>
                        <button onClick={onGenerateAdCopy} className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-wait font-semibold" disabled={isCopyLoading || !autoCopyProduct}>
                            {isCopyLoading ? <Spinner className="w-5 h-5" /> : <><SparklesIcon className="w-5 h-5" /> Buat</>}
                        </button>
                    </div>
                     <p className="text-xs text-slate-500 mt-1">AI akan mengisi Headline, Subheadline, & CTA.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input type="text" name="headline" value={fields.headline} onChange={handleFieldChange} placeholder="Headline" className="input-style"/>
                    <input type="text" name="subheadline" value={fields.subheadline} onChange={handleFieldChange} placeholder="Subheadline" className="input-style"/>
                    <div className="flex items-center bg-slate-800 rounded-md border border-slate-700 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-slate-900 focus-within:ring-blue-500 transition-all">
                        <select name="currency" value={fields.currency} onChange={handleFieldChange} className="bg-transparent appearance-none pl-3 pr-2 border-0 focus:ring-0 text-slate-400 text-sm cursor-pointer">
                            <option className="bg-slate-800 text-white" value="IDR">IDR</option>
                            <option className="bg-slate-800 text-white" value="USD">USD</option>
                            <option className="bg-slate-800 text-white" value="EUR">EUR</option>
                            <option className="bg-slate-800 text-white" value="GBP">GBP</option>
                        </select>
                        <div className="w-px h-5 bg-slate-600"></div>
                        <input type="number" name="price" value={fields.price} onChange={handleFieldChange} placeholder="Harga" className="input-style !border-0 !ring-0 !shadow-none flex-grow bg-transparent pl-2"/>
                    </div>
                    <input type="number" name="discount" value={fields.discount} onChange={handleFieldChange} placeholder="Diskon %" className="input-style"/>
                    <input type="text" name="cta" value={fields.cta} onChange={handleFieldChange} placeholder="CTA Text" className="input-style sm:col-span-2"/>
                </div>
             </div>

            {/* Section 5: Brand Settings */}
            <div>
                <h2 className="text-lg font-semibold text-blue-400 border-b border-slate-700 pb-2 mb-4">5. Brand Settings</h2>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                         <label htmlFor="brand-color" className="text-sm font-medium text-slate-300">Brand Color</label>
                         <input id="brand-color" type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="w-10 h-10 p-1 bg-slate-800 border border-slate-600 rounded-md cursor-pointer"/>
                    </div>
                    <div>
                         <label htmlFor="batch-size" className="block text-sm font-medium text-slate-300">Batch Size: <span className="font-bold text-blue-400">{batchSize}</span></label>
                         <input id="batch-size" type="range" min="1" max="6" value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"/>
                    </div>
                    <div className="flex items-center">
                        <input id="watermark" type="checkbox" checked={watermark} onChange={e => setWatermark(e.target.checked)} className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"/>
                        <label htmlFor="watermark" className="ml-2 block text-sm text-slate-300">Add "LATIEF ADS" watermark</label>
                    </div>
                </div>
            </div>

            {/* Section 6: Action */}
            <div className="pt-5">
                <div className="flex justify-end">
                    <div className="relative group w-full">
                         <button
                            onClick={onGenerate}
                            disabled={isGenerateDisabled}
                            className="w-full flex justify-center items-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all"
                        >
                            {isLoading ? <><Spinner /> Generating...</> : 'Generate'}
                        </button>
                        <span className="absolute bottom-full mb-2 hidden group-hover:block w-72 p-2 text-xs text-center text-white bg-slate-700 rounded-md left-1/2 -translate-x-1/2">
                            Gunakan headline singkat dan CTA jelas untuk hasil optimal.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface PreviewGridProps {
    results: GenerationResult[];
    isLoading: boolean;
    onDownloadZip: () => void;
    error: string | null;
    progress: { current: number; total: number };
}

const PreviewGrid: React.FC<PreviewGridProps> = ({ results, isLoading, onDownloadZip, error, progress }) => {
    const handleDownload = (result: GenerationResult) => {
        downloadImage(result.src, `latief-ads-${result.ratio}-${result.id}.png`);
    };

    const EmptyState = () => (
        <div className="flex items-center justify-center h-full border-2 border-dashed border-slate-700 rounded-2xl">
            <div className="text-center">
                <p className="mt-2 text-sm font-medium text-slate-400">Belum ada hasil.</p>
                <p className="text-sm text-slate-500">Isi form dan klik Generate.</p>
            </div>
        </div>
    );

    const LoadingState = () => (
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <Spinner className="w-12 h-12 text-blue-500 mx-auto" />
                <p className="mt-4 text-lg font-medium text-slate-300">Generating your ads...</p>
                 {progress.total > 0 && (
                    <p className="text-sm font-semibold text-slate-400 bg-slate-800/50 px-3 py-1 rounded-full mt-2">
                        {progress.current} / {progress.total}
                    </p>
                )}
                <p className="text-sm text-slate-500 mt-2">This might take a moment.</p>
            </div>
        </div>
    );
    
    const ErrorState = () => (
         <div className="flex items-center justify-center h-full border-2 border-dashed border-red-500/50 bg-red-500/10 rounded-2xl p-4">
            <div className="text-center">
                 <ErrorIcon className="w-12 h-12 text-red-400 mx-auto" />
                 <p className="mt-3 text-lg font-semibold text-red-400">Generation Failed</p>
                 <p className="mt-1 text-sm text-slate-300 max-w-md">{error}</p>
            </div>
        </div>
    );

    const renderContent = () => {
        if (error) return <ErrorState />;
        if (isLoading && results.length === 0) return <LoadingState />;
        if (!isLoading && results.length === 0) return <EmptyState />;

        return (
            <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {results.map((result) => (
                        <div key={result.id} className="relative group cursor-pointer" onClick={() => handleDownload(result)}>
                            <img src={result.src} alt={`Generated Ad ${result.ratio}`} className="w-full h-auto object-cover rounded-lg shadow-md aspect-auto" />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 rounded-lg flex items-center justify-center">
                                <DownloadIcon className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transform group-hover:scale-110 transition-all duration-300"/>
                            </div>
                            <span className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                {result.ratio}
                            </span>
                        </div>
                    ))}
                    {isLoading && results.length > 0 && 
                       <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-slate-700 rounded-lg aspect-square p-4">
                           <Spinner className="w-8 h-8 text-blue-500"/>
                           <p className="text-sm text-slate-400 mt-2 text-center">Generating more...</p>
                           {progress.total > 0 && (
                               <p className="text-xs font-semibold text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded-full mt-1">
                                   {progress.current} / {progress.total}
                               </p>
                           )}
                       </div>
                    }
                </div>
                {!isLoading && (
                    <div className="mt-6 text-center">
                       <button onClick={onDownloadZip} className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-md shadow-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500">
                           Download All as ZIP
                       </button>
                    </div>
                )}
            </>
        );
    };

    return (
        <div className="lg:col-span-2 p-6 bg-slate-900/50 border border-slate-800 rounded-2xl shadow-lg min-h-[60vh] flex flex-col">
            <div className="flex-grow">
              {renderContent()}
            </div>
        </div>
    );
};


// --- Main App Component ---
export default function App() {
    const [fields, setFields] = useState<FormFields>({ headline: '', subheadline: '', price: '', discount: '', cta: 'Beli Sekarang', currency: 'IDR' });
    const [brandColor, setBrandColor] = useState('#2563EB');
    const [template, setTemplate] = useState<Template>('Hero');
    const [ratios, setRatios] = useState<Ratio[]>(['1:1']);
    const [watermark, setWatermark] = useState(false);
    const [batchSize, setBatchSize] = useState(4);
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<GenerationResult[]>([]);
    const [productFile, setProductFile] = useState<File | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [autoCopyProduct, setAutoCopyProduct] = useState('');
    const [isCopyLoading, setIsCopyLoading] = useState(false);
    const [adCopyLanguage, setAdCopyLanguage] = useState<'id' | 'en'>('id');
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [isEditingImage, setIsEditingImage] = useState(false);
    const [imageToEdit, setImageToEdit] = useState<string | null>(null);


    const handleGenerateAdCopy = useCallback(async () => {
        if (!autoCopyProduct) return;
        setIsCopyLoading(true);
        setError(null);
        try {
            const adCopy = await generateAdCopy(autoCopyProduct, adCopyLanguage);
            if (adCopy) {
                setFields(prev => ({
                    ...prev,
                    headline: adCopy.headline || prev.headline,
                    subheadline: adCopy.subheadline || prev.subheadline,
                    cta: adCopy.cta || prev.cta,
                }));
            }
        } catch (error) {
            console.error("Failed to generate ad copy", error);
            setError("Failed to generate ad copy. Please try again.");
        } finally {
            setIsCopyLoading(false);
        }
    }, [autoCopyProduct, adCopyLanguage]);
    
    const handleProductFileChange = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            setImageToEdit(reader.result as string);
            setIsEditingImage(true);
        };
        reader.readAsDataURL(file);
    };

    const handleImageEditorSave = (editedFile: File) => {
        setProductFile(editedFile);
        setIsEditingImage(false);
        setImageToEdit(null);
    };

    const handleGenerate = useCallback(async () => {
        if (!productFile || ratios.length === 0) return;
        
        setIsLoading(true);
        setResults([]);
        setError(null);

        try {
            const productInlineData = await fileToInlineData(productFile);
            const logoInlineData = logoFile ? await fileToInlineData(logoFile) : null;
            
            const generationTasks = [];
            for (let i = 0; i < batchSize; i++) {
                for (const ratio of ratios) {
                    generationTasks.push({ ratio });
                }
            }

            setProgress({ current: 0, total: generationTasks.length });

            let count = 0;
            for (const task of generationTasks) {
                try {
                    count++;
                    setProgress({ current: count, total: generationTasks.length });
                    
                    const imageUrl = await generateAdImage(productInlineData, logoInlineData, fields, template, task.ratio, brandColor, watermark);
                    
                    setResults(prev => [...prev, { id: crypto.randomUUID(), src: imageUrl, ratio: task.ratio }]);
                    
                    if (count < generationTasks.length) {
                        await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5s delay
                    }
                } catch (e: any) {
                     console.error("A single generation task failed:", e);
                     setError(e.message || "An unknown error occurred during generation.");
                     break; 
                }
            }

        } catch (error: any) {
            console.error("Generation failed:", error);
            setError(error.message || "An unexpected error occurred. Please check the console.");
        } finally {
            setIsLoading(false);
            setProgress({ current: 0, total: 0 });
        }
    }, [productFile, logoFile, ratios, fields, template, brandColor, watermark, batchSize]);

    const handleDownloadZip = useCallback(() => {
        if (results.length === 0) return;

        const zip = new JSZip();
        const promises = results.map(async (result, index) => {
            const response = await fetch(result.src);
            const blob = await response.blob();
            zip.file(`latief-ads-${result.ratio.replace(':', 'x')}-${index + 1}.png`, blob);
        });

        Promise.all(promises).then(() => {
            zip.generateAsync({ type: 'blob' }).then((content: any) => {
                saveAs(content, 'latief-ads-generated.zip');
            });
        });
    }, [results]);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 font-sans">
            <Header onDownloadZip={handleDownloadZip} canDownload={results.length > 0 && !isLoading} />

            <main className="pt-24 pb-12 container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <ConfigForm
                        fields={fields} setFields={setFields}
                        brandColor={brandColor} setBrandColor={setBrandColor}
                        template={template} setTemplate={setTemplate}
                        ratios={ratios} setRatios={setRatios}
                        watermark={watermark} setWatermark={setWatermark}
                        batchSize={batchSize} setBatchSize={setBatchSize}
                        onGenerate={handleGenerate}
                        isLoading={isLoading}
                        productFile={productFile} onProductFileChange={handleProductFileChange}
                        logoFile={logoFile} setLogoFile={setLogoFile}
                        autoCopyProduct={autoCopyProduct} setAutoCopyProduct={setAutoCopyProduct}
                        adCopyLanguage={adCopyLanguage} setAdCopyLanguage={setAdCopyLanguage}
                        onGenerateAdCopy={handleGenerateAdCopy}
                        isCopyLoading={isCopyLoading}
                    />
                    <PreviewGrid 
                        results={results}
                        isLoading={isLoading}
                        onDownloadZip={handleDownloadZip}
                        error={error}
                        progress={progress}
                    />
                </div>
            </main>

            <Footer />

            {isEditingImage && imageToEdit && (
                <ImageEditorModal
                    imageSrc={imageToEdit}
                    onSave={handleImageEditorSave}
                    onClose={() => setIsEditingImage(false)}
                />
            )}

            {/* Custom input styles */}
            <style>{`
                .input-style {
                    width: 100%;
                    background-color: #1e293b; /* slate-800 */
                    border: 1px solid #334155; /* slate-700 */
                    color: white;
                    padding: 0.75rem;
                    border-radius: 0.375rem;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .input-style:focus {
                    outline: none;
                    border-color: #3b82f6; /* blue-500 */
                    box-shadow: 0 0 0 2px #2563eb; /* blue-600 */
                }
                .input-style::placeholder {
                    color: #64748b; /* slate-500 */
                }
            `}</style>
        </div>
    );
}