import { useState, useEffect } from 'react';
import useDataStore, { DocumentItem, RenewalItem } from '../../store/dataStore';
import useHeaderStore from '../../store/headerStore';
import { Search, FileText, X, Check, Calendar, Upload, Download, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDate, parseDateFromInput, formatDateForGoogleSheets } from '../../utils/dateFormatter';
import { fetchDocumentsFromGoogleSheets, updateGoogleSheetCellsBySn, submitToGoogleSheets, fetchRenewalHistoryFromGoogleSheets } from '../../utils/googleSheetsService';

const DocumentRenewal = () => {
    const { setTitle } = useHeaderStore();
    const { documents, setDocuments: setStoreDocuments, updateDocument, addRenewalHistory } = useDataStore();

    useEffect(() => {
        setTitle('Document Renewal');
    }, [setTitle]);

    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    // Removed local documents state to use global store
    const [historyDocuments, setHistoryDocuments] = useState<RenewalItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);

    // Form State
    const [againRenewal, setAgainRenewal] = useState(true);
    const [nextRenewalDate, setNextRenewalDate] = useState('');
    const [newFileName, setNewFileName] = useState('');
    const [newFileContent, setNewFileContent] = useState<string>('');

    // Fetch documents from Google Sheets
    const loadDocuments = async (refreshDocuments = true) => {
        try {
            setIsLoading(true);
            setError(null);

            console.log('Fetching documents for renewal...');

            const promises: Promise<any>[] = [fetchRenewalHistoryFromGoogleSheets()];
            if (refreshDocuments || documents.length === 0) {
                promises.push(fetchDocumentsFromGoogleSheets());
            }

            const results = await Promise.all(promises);
            const fetchedHistory = results[0];
            const fetchedDocs = results.length > 1 ? results[1] : documents;

            // Remove duplicates at frontend level
            const uniqueDocs = removeDuplicates(fetchedDocs);

            if (refreshDocuments || documents.length === 0) {
                console.log(`Loaded ${uniqueDocs.length} unique documents for renewal (Fresh Fetch)`);
                setStoreDocuments(uniqueDocs);
            } else {
                console.log('Using existing documents from store');
            }

            // Merge metadata into history items
            const mergedHistory = fetchedHistory.map((historyItem: RenewalItem) => {
                const matchingDoc = uniqueDocs.find(d => d.sn === historyItem.sn);
                if (matchingDoc) {
                    return {
                        ...historyItem,
                        documentName: matchingDoc.documentName,
                        documentType: matchingDoc.documentType,
                        category: matchingDoc.category,
                        companyName: matchingDoc.companyName,
                        documentId: matchingDoc.id
                    };
                }
                return historyItem;
            });

            setHistoryDocuments(mergedHistory);
        } catch (err) {
            console.error("Error loading documents for renewal:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to load documents from Google Sheets";
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper function to remove duplicates
    const removeDuplicates = (docs: DocumentItem[]): DocumentItem[] => {
        const uniqueMap = new Map<string, DocumentItem>();

        docs.forEach(doc => {
            // Create a unique key using serial number, document name, and company
            const uniqueKey = `${doc.sn}_${doc.documentName}_${doc.companyName}`.toLowerCase().trim();

            if (!uniqueMap.has(uniqueKey)) {
                uniqueMap.set(uniqueKey, doc);
            } else {
                /* Duplicate warning suppressed */
            }
        });

        return Array.from(uniqueMap.values());
    };

    useEffect(() => {
        // If we have documents in store (likely from Resource Manager or previous load), 
        // don't overwrite them immediately to avoid stale-read issues. 
        // Just fetch history.
        if (documents.length > 0) {
            loadDocuments(false);
        } else {
            loadDocuments(true);
        }
    }, []);

    // Filter Pending Documents: needsRenewal is true AND date is approaching (within 2 days) or past
    // Filter Pending Documents: directly show all documents where needsRenewal is true
    // AND 'Actual 1' (Column L) is NOT present (meaning it's still pending)
    // Filter Pending Documents
    // 1. needsRenewal must be true
    // 2. 'Actual 1' must be empty (processed items have Actual 1)
    // 3. Date must be missing, past, or impending (<= 30 days away)
    const pendingDocuments = documents.filter(doc => {
        return doc.needsRenewal;
    }).filter(doc =>
        doc.documentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.sn.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredHistory = historyDocuments.filter(item =>
        (item.documentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.sn || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOpenRenewal = (doc: DocumentItem) => {
        setSelectedDoc(doc);
        setAgainRenewal(true);
        setNextRenewalDate('');
        setNewFileName('');
        setNewFileContent('');
        setIsRenewalModalOpen(true);
    };

    const handleCloseRenewal = () => {
        setIsRenewalModalOpen(false);
        setSelectedDoc(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setNewFileName(file.name);
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewFileContent(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDownload = (fileContent: string | undefined, fileName: string | null) => {
        if (!fileContent) {
            alert("File content not available for download.");
            return;
        }

        // Check if it's a Google Drive URL
        let fileUrl = fileContent;

        // Convert Google Drive view/edit URLs to direct view URLs
        if (fileUrl.includes('drive.google.com')) {
            // Extract file ID from various Google Drive URL formats
            let fileId = null;

            // Format: https://drive.google.com/file/d/FILE_ID/view
            const viewMatch = fileUrl.match(/\/file\/d\/([^/]+)/);
            if (viewMatch) {
                fileId = viewMatch[1];
            }

            // Format: https://drive.google.com/open?id=FILE_ID
            const openMatch = fileUrl.match(/[?&]id=([^&]+)/);
            if (openMatch) {
                fileId = openMatch[1];
            }

            // If we found a file ID, create a preview-friendly URL
            if (fileId) {
                fileUrl = `https://drive.google.com/file/d/${fileId}/preview`;
            }
        }

        // If it's a data URI (base64 from local upload), trigger download
        if (fileUrl.startsWith("data:")) {
            const link = document.createElement("a");
            link.href = fileUrl;
            link.download = fileName || 'document';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }

        // Open in new tab for preview (URLs)
        window.open(fileUrl, '_blank');
    };

    const handleSaveRenewal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDoc) return;

        if (againRenewal && !nextRenewalDate) {
            toast.error("Please select Next Renewal Date");
            return;
        }

        // Format date properly to avoid timezone issues
        const formattedNextRenewalDate = nextRenewalDate
            ? parseDateFromInput(nextRenewalDate)
            : '';

        // 1. Create History Record
        const historyItem: RenewalItem = {
            id: Math.random().toString(36).substr(2, 9),
            documentId: selectedDoc.id,
            sn: selectedDoc.sn,
            documentName: selectedDoc.documentName,
            documentType: selectedDoc.documentType,
            category: selectedDoc.category,
            companyName: selectedDoc.companyName,
            entryDate: selectedDoc.date,
            oldRenewalDate: selectedDoc.renewalDate || '-',
            oldFile: selectedDoc.file || null,
            oldFileContent: selectedDoc.fileContent,
            renewalStatus: againRenewal ? 'Yes' : 'No',
            nextRenewalDate: againRenewal ? formattedNextRenewalDate : null,
            newFile: newFileName || null,
            newFileContent: newFileContent || undefined
        };

        addRenewalHistory(historyItem);

        // 2. Update Local Store
        const updates: Partial<DocumentItem> = {};
        if (againRenewal) {
            updates.renewalDate = formattedNextRenewalDate;
            if (newFileName) {
                updates.file = newFileName;
                updates.fileContent = newFileContent;
            }
        } else {
            updates.needsRenewal = false;
            updates.renewalDate = undefined;
        }

        updateDocument(selectedDoc.id, updates);

        // 3. Update Google Sheets
        try {
            if (selectedDoc.rowIndex) {
                toast.loading("Updating document in Google Sheets...", { id: "update-sheet" });

                // Prepare updated row data for Google Sheets
                const updatedDoc = {
                    ...selectedDoc,
                    ...updates
                };

                // Check and upload file if new one is selected
                let uploadedFileUrl = updatedDoc.fileContent;
                if (newFileContent && newFileName) {
                    try {
                        toast.loading("Uploading file to Drive...", { id: "update-sheet" });
                        const uploadRes = await submitToGoogleSheets({
                            action: 'uploadFile',
                            data: {
                                base64Data: newFileContent,
                                fileName: newFileName,
                                mimeType: newFileContent.split(';')[0].split(':')[1],
                                folderId: import.meta.env.VITE_GOOGLE_RENEWAL_FOLDER_ID
                            }
                        });

                        if (uploadRes.success && uploadRes.fileUrl) {
                            uploadedFileUrl = uploadRes.fileUrl;
                            // Update local store with the new URL
                            updateDocument(selectedDoc.id, {
                                ...updates,
                                fileContent: uploadedFileUrl
                            });
                            // Also update 'updatedDoc' so subsequent sheet updates utilize the URL
                            updatedDoc.fileContent = uploadedFileUrl;
                        } else {
                            throw new Error("Upload failed");
                        }
                    } catch (uploadError) {
                        console.error("File upload error:", uploadError);
                        toast.error("File upload failed, but proceeding with data update", { id: "update-sheet" });
                    }
                }

                // Format renewal date for Google Sheets
                // User Request: If No renewal, store BLANK in date column, not "No"
                const renewalDateForSheet = updatedDoc.needsRenewal
                    ? (updatedDoc.renewalDate ? formatDateForGoogleSheets(updatedDoc.renewalDate) : '')
                    : '';

                // Prepare cell updates
                const cellUpdates = [
                    { column: 7, value: updatedDoc.needsRenewal ? 'Yes' : 'No' }, // Need Renewal (G)
                    { column: 8, value: renewalDateForSheet }, // Renewal Date (H) - Now blank if No
                ];

                // Update file content if it changed and exists.
                // We allow updating the image even if renewal is "No" (as per user request)
                if (updatedDoc.fileContent) {
                    cellUpdates.push({ column: 9, value: updatedDoc.fileContent }); // Image (I)
                }

                console.log('Updating Google Sheets by SN:', {
                    sn: selectedDoc.sn,
                    updates: cellUpdates
                });

                await updateGoogleSheetCellsBySn('Documents', selectedDoc.sn, cellUpdates);

                // 4. Log to "Document Renewal" Sheet
                const logStatus = againRenewal ? 'Yes' : 'No';
                const logNewDate = (againRenewal && formattedNextRenewalDate) ? formatDateForGoogleSheets(formattedNextRenewalDate) : '';
                const logNewImage = updatedDoc.fileContent || '';

                const renewalLogData = [
                    new Date().toLocaleString(), // A: Timestamp
                    selectedDoc.sn, // B: Serial No
                    // C: Last Renewal Date
                    (selectedDoc.renewalDate && selectedDoc.renewalDate !== 'No') ? formatDateForGoogleSheets(selectedDoc.renewalDate) : '',
                    selectedDoc.fileContent || '', // D: Old Image
                    logStatus, // E: Need Renewal
                    logNewDate, // F: New Renewal Date
                    logNewImage // G: New Image
                ];

                await submitToGoogleSheets({
                    action: 'insert',
                    sheetName: 'Document Renewal',
                    data: renewalLogData
                });
                console.log('Logged to Document Renewal sheet');

                toast.success("Document updated in Google Sheets", { id: "update-sheet" });
            }
        } catch (error) {
            console.error("Failed to update Google Sheets:", error);
            toast.error("Updated locally, but failed to update Google Sheets", { id: "update-sheet" });
        }

        // 4. Refresh documents from Google Sheets
        await loadDocuments();

        toast.success("Renewal processed successfully");
        handleCloseRenewal();
    };

    // Loading State
    if (isLoading) {
        return (
            <div className="space-y-6 p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Document Renewals</h1>
                        <p className="text-sm text-gray-500 mt-1">Loading documents Please Wait ...</p>
                    </div>
                </div>
                <div className="flex justify-center items-center py-12">
                    <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                        <p className="text-gray-500">Loading documents...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Error State
    if (error) {
        return (
            <div className="space-y-6 p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Document Renewals</h1>
                        <p className="text-sm text-gray-500 mt-1">Manage pending and history of document renewals</p>
                    </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-medium text-red-800">
                                Error loading documents
                            </h3>
                            <p className="text-sm text-red-700 mt-1">{error}</p>
                            <button
                                onClick={() => loadDocuments(true)}
                                className="mt-3 text-sm font-medium text-red-600 hover:text-red-500"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            {/* Unified Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Document Renewals</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage pending and history of document renewals</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-center">
                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <input
                            type="text"
                            placeholder="Search documents..."
                            className="pl-10 pr-4 py-2.5 w-full border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Refresh Button */}
                    <button
                        onClick={() => loadDocuments(true)}
                        title="Refresh Data from Google Sheets"
                        className="p-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 hover:text-indigo-600 transition-colors"
                        disabled={isLoading}
                    >
                        <RotateCcw size={20} className={isLoading ? "animate-spin" : ""} />
                    </button>

                    {/* Tabs */}
                    <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'pending'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Pending ({pendingDocuments.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'history'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            History ({historyDocuments.length})
                        </button>
                    </div>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-[calc(100vh-350px)]">
                {activeTab === 'pending' ? (
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
                                <tr className="border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                    <th className="p-3 text-center bg-gray-50">Action</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Serial No</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Document Name</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Document Type</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Category</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Name</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Entry Date</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Renewal</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Document File</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm">
                                {pendingDocuments.length > 0 ? pendingDocuments.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-gray-50/80 transition-colors">
                                        <td className="p-3 text-center">
                                            <button
                                                onClick={() => handleOpenRenewal(doc)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
                                            >
                                                <RotateCcw size={14} />
                                                Renewal
                                            </button>
                                        </td>
                                        <td className="p-3 font-bold font-mono text-xs text-gray-700">{doc.sn}</td>
                                        <td className="p-3 font-medium text-gray-900">{doc.documentName}</td>
                                        <td className="p-3 text-gray-600">{doc.documentType}</td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                                                {doc.category}
                                            </span>
                                        </td>
                                        <td className="p-3 text-gray-900">{doc.companyName}</td>
                                        <td className="p-3 text-gray-500 font-mono text-xs">{formatDate(doc.date)}</td>
                                        <td className="p-3 text-center">
                                            <span className="inline-flex items-center justify-center px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded text-xs font-medium">
                                                {doc.planned1 ? formatDate(doc.planned1) : (doc.renewalDate ? formatDate(doc.renewalDate) : 'Pending')}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            {doc.fileContent ? (
                                                <div
                                                    onClick={() => handleDownload(doc.fileContent, doc.file || 'document')}
                                                    className="flex items-center gap-2 text-indigo-600 text-xs cursor-pointer hover:underline"
                                                >
                                                    <Download size={14} />
                                                    <span className="truncate max-w-[100px]">View</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={9} className="p-12 text-center">
                                            <div className="flex flex-col items-center justify-center p-8 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
                                                <div className="h-16 w-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4">
                                                    <Check size={32} />
                                                </div>
                                                <h3 className="text-gray-900 font-bold text-lg">All Caught Up!</h3>
                                                <p className="text-gray-500 text-sm mt-1">No documents require renewal at this time.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
                                <tr className="border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Serial No</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Document Name</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Document Type</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Category</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Name</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Entry Date</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Renewal</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Document File</th>
                                    <th className="p-3 whitespace-nowrap text-center bg-gray-50">Renewal Status</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">Next Renewal Date</th>
                                    <th className="p-3 whitespace-nowrap bg-gray-50">New Document File</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm">
                                {filteredHistory.length > 0 ? filteredHistory.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                                        <td className="p-3 font-bold font-mono text-xs text-gray-700">{item.sn}</td>
                                        <td className="p-3 font-medium text-gray-900">{item.documentName}</td>
                                        <td className="p-3 text-gray-600">{item.documentType}</td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="p-3 text-gray-900">{item.companyName}</td>
                                        <td className="p-3 text-gray-500 font-mono text-xs">{formatDate(item.entryDate)}</td>
                                        <td className="p-3 text-gray-500 font-mono text-xs line-through decoration-red-400">
                                            {formatDate(item.oldRenewalDate)}
                                        </td>
                                        <td className="p-3 text-gray-500">
                                            {item.oldFileContent ? (
                                                <div
                                                    onClick={() => handleDownload(item.oldFileContent, item.oldFile)}
                                                    className="flex items-center gap-1 text-gray-600 text-xs cursor-pointer hover:text-indigo-600 hover:underline"
                                                >
                                                    <Download size={12} />
                                                    <span className="truncate max-w-[100px]">View</span>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="p-3 text-center">
                                            {item.renewalStatus === 'Yes' ? (
                                                <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-green-100">
                                                    <Check size={12} /> Yes
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-gray-100">
                                                    <X size={12} /> No
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 font-medium text-indigo-600 font-mono text-xs">
                                            {formatDate(item.nextRenewalDate)}
                                        </td>
                                        <td className="p-3">
                                            {item.newFileContent ? (
                                                <span
                                                    onClick={() => handleDownload(item.newFileContent, item.newFile)}
                                                    className="text-indigo-600 font-medium flex items-center gap-1 cursor-pointer hover:underline text-xs"
                                                >
                                                    <Download size={12} /> View
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={11} className="p-12 text-center text-gray-500">
                                            <p>No renewal history available</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col gap-4">
                {activeTab === 'pending' ? (
                    pendingDocuments.length > 0 ? pendingDocuments.map((doc) => (
                        <div key={doc.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-mono font-bold text-gray-900 bg-gray-50 px-2 py-0.5 rounded">{doc.sn}</span>
                                    <h3 className="font-semibold text-gray-900 mt-1">{doc.companyName}</h3>
                                    <p className="text-xs text-gray-500">{doc.documentType}</p>
                                </div>
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                                    {doc.category}
                                </span>
                            </div>

                            <div className="pt-2 border-t border-gray-50">
                                <p className="text-sm font-medium text-gray-700 mb-2">{doc.documentName}</p>
                                <div className="flex justify-between items-center text-xs text-gray-500">
                                    <span>Entry: {formatDate(doc.date)}</span>
                                    <span className="flex items-center gap-1 font-medium text-amber-600 bg-amber-50 px-1.5 rounded">
                                        Renewal: {doc.planned1 ? formatDate(doc.planned1) : (doc.renewalDate ? formatDate(doc.renewalDate) : 'Pending')}
                                    </span>
                                </div>
                            </div>

                            <div className="pt-3 flex items-center justify-between gap-3">
                                {doc.fileContent ? (
                                    <button
                                        onClick={() => handleDownload(doc.fileContent, doc.file || 'document')}
                                        className="flex items-center gap-1.5 text-indigo-600 text-xs font-medium bg-indigo-50 px-2 py-1.5 rounded-lg"
                                    >
                                        <Download size={14} />
                                        View File
                                    </button>
                                ) : (
                                    <span className="text-gray-400 text-xs italic">No file</span>
                                )}
                                <button
                                    onClick={() => handleOpenRenewal(doc)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg shadow-sm"
                                >
                                    <RotateCcw size={14} />
                                    Renewal
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div className="bg-white p-8 rounded-xl text-center text-gray-500">
                            <div className="flex flex-col items-center justify-center p-8 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
                                <div className="h-16 w-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4">
                                    <Check size={32} />
                                </div>
                                <h3 className="text-gray-900 font-bold text-lg">All Caught Up!</h3>
                                <p className="text-gray-500 text-sm mt-1">No documents require renewal at this time.</p>
                            </div>
                        </div>
                    )
                ) : (
                    filteredHistory.length > 0 ? filteredHistory.map((item) => (
                        <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-mono font-bold text-gray-900 bg-gray-50 px-2 py-0.5 rounded">{item.sn}</span>
                                    <h3 className="font-semibold text-gray-900 mt-1">{item.companyName}</h3>
                                </div>
                                <div className="text-right">
                                    {item.renewalStatus === 'Yes' ? (
                                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                            <Check size={10} /> Yes
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                            <X size={10} /> No
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="pt-2 border-t border-gray-50">
                                <p className="text-sm font-medium text-gray-700 mb-1">{item.documentName}</p>
                                <div className="text-xs text-gray-500 grid grid-cols-2 gap-2 mt-2">
                                    <div>
                                        <span className="block text-gray-400 text-[10px] uppercase">Old Renewal</span>
                                        <span className="line-through decoration-red-300">{formatDate(item.oldRenewalDate)}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-400 text-[10px] uppercase">Next Renewal</span>
                                        <span className="font-medium text-indigo-600">{item.nextRenewalDate ? formatDate(item.nextRenewalDate) : '-'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 flex items-center justify-between gap-3 border-t border-gray-50 mt-1">
                                <div className="flex gap-3">
                                    {item.oldFileContent && (
                                        <button
                                            onClick={() => handleDownload(item.oldFileContent, item.oldFile)}
                                            className="flex items-center gap-1 text-gray-500 text-xs hover:text-indigo-600"
                                        >
                                            <Download size={14} />
                                            Old File
                                        </button>
                                    )}
                                    {item.newFileContent && (
                                        <button
                                            onClick={() => handleDownload(item.newFileContent, item.newFile)}
                                            className="flex items-center gap-1 text-indigo-600 text-xs font-medium"
                                        >
                                            <Download size={14} />
                                            New File
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="bg-white p-8 rounded-xl text-center text-gray-500">
                            <p>No renewal history available</p>
                        </div>
                    )
                )}
            </div>

            {/* Renewal Modal */}
            {isRenewalModalOpen && selectedDoc && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-base font-bold text-gray-800">Process Renewal</h3>
                                <p className="text-[10px] text-gray-500 mt-0.5">Update renewal status for this document</p>
                            </div>
                            <button onClick={handleCloseRenewal} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveRenewal} className="p-4 space-y-4">
                            {/* Pre-filled Info Grid */}
                            <div className="grid grid-cols-2 gap-3 text-xs bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                                <div className="col-span-2">
                                    <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Document</label>
                                    <div className="font-medium text-gray-900">{selectedDoc.documentName}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Serial No</label>
                                    <div className="font-mono text-gray-700">{selectedDoc.sn}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Name</label>
                                    <div className="text-gray-700">{selectedDoc.companyName}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Category</label>
                                    <div className="text-gray-700">{selectedDoc.category}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Current Renewal</label>
                                    <div className="text-amber-600 font-medium">{selectedDoc.renewalDate ? formatDate(selectedDoc.renewalDate) : 'N/A'}</div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Current File</label>
                                    {selectedDoc.fileContent ? (
                                        <div
                                            onClick={() => handleDownload(selectedDoc.fileContent, selectedDoc.file || 'document')}
                                            className="text-indigo-600 truncate cursor-pointer hover:underline flex items-center gap-1 font-medium"
                                            title="Click to view document"
                                        >
                                            <FileText size={14} />
                                            {selectedDoc.file || 'View Document'}
                                        </div>
                                    ) : (
                                        <div className="text-gray-400 italic text-[11px]">No file attached</div>
                                    )}
                                </div>
                            </div>

                            {/* Inputs */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-2.5 border border-gray-200 rounded-xl hover:border-indigo-200 transition-colors cursor-pointer" onClick={() => setAgainRenewal(!againRenewal)}>
                                    <span className="font-medium text-sm text-gray-700">Again Renewal?</span>
                                    <div className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 ${againRenewal ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${againRenewal ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                </div>

                                {againRenewal && (
                                    <div className="space-y-3 animate-fade-in-up">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Next Renewal Date</label>
                                            <div className="relative">
                                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                                                <input
                                                    type="date"
                                                    required
                                                    className="w-full pl-9 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    value={nextRenewalDate}
                                                    onChange={e => setNextRenewalDate(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* File Upload - Always Visible & Enabled */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">New Document File (Optional)</label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            id="renewal-file"
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                        <label
                                            htmlFor="renewal-file"
                                            className="flex items-center justify-center gap-2 w-full p-2.5 border border-dashed border-gray-300 rounded-xl text-gray-600 cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                                        >
                                            <Upload size={16} />
                                            <span className="text-xs font-medium truncate max-w-[180px]">{newFileName || "Upload New Version"}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCloseRenewal}
                                    className="flex-1 py-2 px-4 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 px-4 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                                >
                                    Save Record
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentRenewal;