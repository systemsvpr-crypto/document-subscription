import React, { useState, useMemo, useEffect } from 'react';
import useDataStore, { DocumentItem, MasterItem } from '../../store/dataStore';
import { toast } from 'react-hot-toast';
import { X, Save, Upload, Loader2 } from 'lucide-react';
import SearchableInput from '../../components/SearchableInput';
import { submitToGoogleSheets, fetchMasterFromGoogleSheets } from '../../utils/googleSheetsService';

interface EditDocumentProps {
    isOpen: boolean;
    onClose: () => void;
    documentId: string | null;
}

const EditDocument: React.FC<EditDocumentProps> = ({ isOpen, onClose, documentId }) => {
    const { documents, updateDocument, masterData, addMasterData } = useDataStore();

    const [formData, setFormData] = useState<Partial<DocumentItem>>({});
    const [fileName, setFileName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [remoteDocTypes, setRemoteDocTypes] = useState<string[]>([]);
    const [remoteCategories, setRemoteCategories] = useState<string[]>([]);

    // Options: Combine local masterData with remote fetched data
    const docTypeOptions = useMemo(() => {
        const local = masterData?.map(m => m.documentType) || [];
        // Add some common defaults if list is empty to avoid bad UX
        const defaults = ['Invoice', 'Receipt', 'Contract', 'ID', 'Utility Bill', 'Insurance', 'Bank Statement', 'Tax Document'];
        const combined = [...remoteDocTypes, ...local];
        if (combined.length === 0) return defaults;
        return Array.from(new Set(combined)).filter(Boolean);
    }, [masterData, remoteDocTypes]);

    const categoryOptions = useMemo(() => {
        const local = masterData?.map(m => m.category) || [];
        const defaults = ['Personal', 'Company', 'Director'];
        return Array.from(new Set([...remoteCategories, ...local, ...defaults])).filter(Boolean);
    }, [masterData, remoteCategories]);

    // Fetch Master Data on Open
    useEffect(() => {
        if (!isOpen) return;

        let mounted = true;
        (async () => {
            try {
                console.log("Fetching Master Data for Dropdowns...");
                const rows = await fetchMasterFromGoogleSheets();
                console.log("Master Data Fetched:", rows);

                if (!mounted) return;

                const docTypes = rows
                    .map((r: { documentType: string; category: string }) => r.documentType)
                    .filter((v: string) => typeof v === "string" && v.trim().length > 0);
                const cats = rows
                    .map((r: { documentType: string; category: string }) => r.category)
                    .filter((v: string) => typeof v === "string" && v.trim().length > 0);

                setRemoteDocTypes(Array.from(new Set(docTypes)));
                setRemoteCategories(Array.from(new Set(cats)));
            } catch (err) {
                console.error("Failed to fetch master data", err);
                toast.error("Could not load dropdown options (Network/CORS)");
            }
        })();

        return () => {
            mounted = false;
        };
    }, [isOpen, documentId]);

    useEffect(() => {
        if (isOpen && documentId) {
            const doc = documents.find(d => d.id === documentId);
            if (doc) {
                setFormData({ ...doc });
                // If it's a URL, display a generic name or "Current File"
                // If we have a local file name stored in 'file' property (from fetch mapping logic), utilize it.
                setFileName(doc.file || (doc.fileContent && doc.fileContent.startsWith('http') ? 'Current File' : ''));
            }
        }
    }, [isOpen, documentId, documents]);

    if (!isOpen || !documentId) return null;

    const handleChange = (field: keyof DocumentItem, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onloadend = () => {
                // Store file name in 'file'
                handleChange('file', file.name);
                // Store base64 content
                handleChange('fileContent', reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const getNameLabel = (category?: string) => {
        const c = category?.toLowerCase() || '';
        if (c.includes('personal')) return 'Person Name';
        if (c.includes('director')) return 'Director Name';
        if (c.includes('company')) return 'Company Name';
        return 'Name';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.companyName || !formData.documentType || !formData.category || !formData.documentName) {
            toast.error("Please fill all required fields.");
            return;
        }

        if (formData.needsRenewal && !formData.renewalDate) {
            toast.error("Please select a renewal date.");
            return;
        }

        setIsSubmitting(true);

        try {
            // Check for new Master Data
            const exists = masterData?.some(m =>
                m.companyName.toLowerCase() === formData.companyName?.toLowerCase() &&
                m.documentType.toLowerCase() === formData.documentType?.toLowerCase() &&
                m.category.toLowerCase() === formData.category?.toLowerCase()
            );

            if (!exists && formData.companyName && formData.documentType && formData.category) {
                const newMaster: MasterItem = {
                    id: Math.random().toString(36).substr(2, 9),
                    companyName: formData.companyName,
                    documentType: formData.documentType,
                    category: formData.category
                };
                addMasterData(newMaster);
            }

            // Handle File Upload if it's new (Base64)
            const folderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;
            let fileUrl = formData.fileContent || "";

            // If it's a new file (base64 data URI), upload it
            if (formData.fileContent && formData.fileContent.startsWith("data:") && folderId) {
                try {
                    // Extract base64 content
                    const base64Content = formData.fileContent.split(',')[1] || formData.fileContent;
                    
                    // Guess mime type from header if present
                    let mimeType = 'application/octet-stream';
                    const matches = formData.fileContent.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
                    if (matches && matches.length > 1) {
                        mimeType = matches[1];
                    }

                    const uploadRes = await submitToGoogleSheets({
                        action: "uploadFile",
                        folderId: folderId,
                        fileName: fileName || `doc-${Date.now()}`,
                        fileContent: base64Content,
                        data: {
                            mimeType: mimeType,
                            fileName: fileName || `doc-${Date.now()}`,
                            base64Data: base64Content,
                            folderId: folderId
                        }
                    });

                    if (uploadRes && (uploadRes.fileUrl || uploadRes.url)) {
                        fileUrl = uploadRes.fileUrl || uploadRes.url;
                    } else {
                        toast.error("File uploaded but no URL returned.");
                    }
                } catch (err) {
                    console.error("File upload failed", err);
                    toast.error("Failed to upload new file, continuing with update...");
                }
            } else if (formData.fileContent && (formData.fileContent.includes("drive.google.com") || formData.fileContent.includes("docs.google.com"))) {
                 // Existing Google Drive URL - keep it
                 fileUrl = formData.fileContent;
            } else if (formData.fileContent && formData.fileContent.startsWith("http")) {
                 // Other HTTP link - keep it
                 fileUrl = formData.fileContent;
            }

            // Prepare row data matching the SHEET columns:
            // Preservation Logic: Use existing date/timestamp if available.
            // Strict cleanup: If it contains 'T' and 'Z' (ISO), convert it back to YYYY-MM-DD HH:mm:ss
            // If it's already clean, keep it.
            let timestampToUse = new Date().toLocaleString(); 
            
            if (formData.date && typeof formData.date === 'string') {
                 if (formData.date.includes('T') || formData.date.includes('Z')) {
                      // It's ISO, clean it
                      const d = new Date(formData.date);
                      if (!isNaN(d.getTime())) {
                        timestampToUse = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
                      }
                 } else {
                     // Assume it's already clean or valid enough
                     timestampToUse = formData.date;
                 }
            } else {
                 // Fallback if empty
                 const now = new Date();
                 timestampToUse = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            }
            
            // Note: Google Sheets sometimes auto-detects date. Putting a ' before it forces string but might break other things.
            // Ideally, sending strict "YYYY-MM-DD HH:mm:ss" without T/Z is treated as string or custom date by Sheets.

            const sheetRow = [
                timestampToUse,                               // 0: Timestamp (Preserves existing)
                formData.sn,                                  // 1: Serial No
                formData.documentName,                        // 2: Document name
                formData.documentType,                        // 3: Document Type
                formData.category,                            // 4: Category
                formData.companyName,                         // 5: Name
                formData.needsRenewal ? "Yes" : "No",         // 6: Renewal
                formData.renewalDate ? new Date(formData.renewalDate).toLocaleDateString("en-GB") : "", // 7: Renewal Date
                fileUrl                                       // 8: Image URL
            ];

            // Submit Update with rowIndex if available
            await submitToGoogleSheets({
                action: "update",
                sheetName: "Documents",
                data: sheetRow,
                rowIndex: formData.rowIndex // Passed if it exists (from fetch)
            });

            // Update Local State
            updateDocument(documentId, {
                ...formData,
                fileContent: fileUrl, // Update content to URL if uploaded
                file: "View Document" // Standardize
            });

            toast.success("Document updated successfully");
            onClose();

        } catch (error) {
            console.error("Update failed:", error);
            toast.error("Failed to update document in Google Sheets.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/40 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl my-4">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Edit Document</h2>
                        {formData.sn && <p className="text-xs text-gray-500 font-mono">{formData.sn}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 max-h-[75vh] overflow-y-auto bg-gray-50/30">
                    <form id="edit-doc-form" onSubmit={handleSubmit} className="space-y-3">
                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                                {/* 1. Document Name (Input) */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Document Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none font-medium bg-gray-50/50 focus:bg-white transition-colors"
                                        value={formData.documentName || ''}
                                        onChange={e => handleChange('documentName', e.target.value)}
                                    />
                                </div>

                                {/* 2. Document Type (Searchable) */}
                                <div>
                                    <SearchableInput compact
                                        label="Document Type"
                                        value={formData.documentType || ''}
                                        onChange={val => handleChange('documentType', val)}
                                        options={docTypeOptions}
                                        placeholder="Select Type..."
                                        required
                                    />
                                </div>

                                {/* 3. Category (Searchable) */}
                                <div>
                                    <SearchableInput compact
                                        label="Category"
                                        value={formData.category || ''}
                                        onChange={val => handleChange('category', val)}
                                        options={categoryOptions}
                                        placeholder="Select Category..."
                                        required
                                    />
                                </div>

                                {/* 4. Name (Input with Dynamic Label) */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">{getNameLabel(formData.category)} <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none font-medium bg-gray-50/50 focus:bg-white transition-colors"
                                        value={formData.companyName || ''}
                                        onChange={e => handleChange('companyName', e.target.value)}
                                        placeholder={`Enter ${getNameLabel(formData.category)}...`}
                                    />
                                </div>

                                {/* 5. Needs Renewal & Date */}
                                <div className="flex items-center gap-3 bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                            checked={formData.needsRenewal || false}
                                            onChange={e => handleChange('needsRenewal', e.target.checked)}
                                        />
                                        <span className="text-xs font-medium text-gray-700">Need Renewal</span>
                                    </label>
                                    {formData.needsRenewal && (
                                        <div className="flex-1">
                                            <input
                                                type="date"
                                                className="w-full p-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                                                value={formData.renewalDate || ''}
                                                onChange={e => handleChange('renewalDate', e.target.value)}
                                                required
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* 6. File Upload */}
                                <div>
                                    <div className="relative">
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Upload File</label>
                                        <input
                                            type="file"
                                            id="edit-file-upload"
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                        <label
                                            htmlFor="edit-file-upload"
                                            className="flex items-center justify-center gap-2 w-full p-2 border border-dashed border-gray-300 rounded-lg text-gray-600 cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-all bg-white"
                                        >
                                            <Upload size={14} />
                                            <span className="text-xs font-medium truncate max-w-[180px]">{fileName || "Change File"}</span>
                                        </label>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </form>
                </div>

                <div className="flex gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2 px-3 rounded-lg border border-gray-200 text-gray-700 text-sm font-bold hover:bg-white hover:border-gray-300 transition-all shadow-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="edit-doc-form"
                        disabled={isSubmitting}
                        className={`flex-[2] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-white text-sm font-bold transition-all shadow-md shadow-indigo-100 ${isSubmitting ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {isSubmitting ? 'Updating...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditDocument;
