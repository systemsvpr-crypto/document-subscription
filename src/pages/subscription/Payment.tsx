import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import useDataStore, { SubscriptionItem } from '../../store/dataStore';
import useHeaderStore from '../../store/headerStore';
import { CreditCard, FileText, X, Save, Upload, Download, Search, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDate } from '../../utils/dateFormatter';
import { submitToGoogleSheets, updateGoogleSheetCellsBySn } from '../../utils/googleSheetsService';
import { syncSubscriptions } from '../../utils/subscriptionSync';

const SubscriptionPayment = () => {
    const { subscriptions, updateSubscription, setSubscriptions } = useDataStore();
    const { setTitle } = useHeaderStore();
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const deferredSearch = useDeferredValue(searchTerm); // Professional optimization
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setTitle('Subscription Payment');
        refreshData();
    }, [setTitle]);

    const refreshData = async () => {
        if (isLoading) return;
        try {
            setIsLoading(true);
            const data = await syncSubscriptions();
            setSubscriptions(data);
        } catch (error) {
            console.error("Sync Error:", error);
            toast.error("Network error: Failed to sync with Google Sheets");
        } finally {
            setIsLoading(false);
        }
    };

    // Modal State
    const [selectedSub, setSelectedSub] = useState<SubscriptionItem | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Credit Card');
    const [transactionId, setTransactionId] = useState('');
    const [fileName, setFileName] = useState('');
    const [fileContent, setFileContent] = useState<string>('');
    const [updatedPrice, setUpdatedPrice] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Auto-fill End Date based on Frequency
    useEffect(() => {
        if (startDate && selectedSub && selectedSub.frequency) {
            const start = new Date(startDate);
            const end = new Date(start);
            const freq = selectedSub.frequency.toLowerCase();

            if (freq === 'monthly') {
                end.setMonth(end.getMonth() + 1);
            } else if (freq === 'quarterly') {
                end.setMonth(end.getMonth() + 3);
            } else if (freq === 'half-yearly') {
                end.setMonth(end.getMonth() + 6);
            } else if (freq === 'yearly' || freq === 'annual') {
                end.setFullYear(end.getFullYear() + 1);
            } else if (freq === 'weekly') {
                end.setDate(end.getDate() + 7);
            }

            // Adjust to end of period (minus 1 day)
            // Example: Start Jan 1 -> End Jan 31 (Monthly)
            end.setDate(end.getDate() - 1);

            if (!isNaN(end.getTime())) {
                setEndDate(end.toISOString().split('T')[0]);
            }
        }
    }, [startDate, selectedSub]);

    // Optimized Filters with deferredSearch
    const pendingSubscriptions = useMemo(() =>
        subscriptions.filter(s =>
            s.status === 'Approved' &&
            (
                s.companyName.toLowerCase().includes(deferredSearch.toLowerCase()) ||
                s.subscriptionName.toLowerCase().includes(deferredSearch.toLowerCase()) ||
                s.sn.toLowerCase().includes(deferredSearch.toLowerCase())
            )
        ),
        [subscriptions, deferredSearch]);

    const historySubscriptions = useMemo(() =>
        subscriptions.filter(s =>
            s.status === 'Paid' &&
            (
                s.companyName.toLowerCase().includes(deferredSearch.toLowerCase()) ||
                s.subscriptionName.toLowerCase().includes(deferredSearch.toLowerCase()) ||
                s.sn.toLowerCase().includes(deferredSearch.toLowerCase())
            )
        ),
        [subscriptions, deferredSearch]);

    const handlePayClick = (sub: SubscriptionItem) => {
        setSelectedSub(sub);
        setStartDate('');
        setEndDate('');
        setPaymentMethod('Credit Card');
        setUpdatedPrice('');
        
        // Auto-fill Transaction ID
        const txIds = subscriptions
            .map(s => s.transactionId)
            .filter(tid => tid && tid.startsWith('TID-'))
            .map(tid => parseInt(tid?.split('-')[1] || '0', 10));
        
        const nextId = txIds.length > 0 ? Math.max(...txIds) + 1 : 1;
        setTransactionId(`TID-${String(nextId).padStart(3, '0')}`);

        setFileName('');
        setFileContent('');
    };

    const handleCloseModal = () => {
        setSelectedSub(null);
        setTransactionId('');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onloadend = () => {
                setFileContent(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!selectedSub) return;
        if (!startDate || !endDate) {
            toast.error("Please select Start and End dates");
            return;
        }

        try {
            setIsSubmitting(true);

            // Generate Current Date in YYYY-MM-DD HH:mm:ss format
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const formattedCurrentDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

            let driveFileUrl = "";
            // 1. Upload File to Drive if present
            if (fileContent && fileName) {
                try {
                    const uploadRes = await submitToGoogleSheets({
                        action: "uploadFile",
                        sheetName: "Subscription Payment",
                        data: {
                            base64Data: fileContent,
                            fileName: fileName,
                            mimeType: "application/octet-stream",
                            folderId: import.meta.env.VITE_GOOGLE_SUBSCRIPTION_FOLDER_ID,
                        },
                    });
                    if (uploadRes?.success && uploadRes.fileUrl) {
                        driveFileUrl = uploadRes.fileUrl;
                    }
                } catch (uploadErr) {
                    console.error("File upload failed:", uploadErr);
                    toast.error("File upload failed, saving record without file.");
                }
            }

            // Format for 'Payment' sheet based on user image:
            // A: Timestamp | B: Subscription No | C: Payment Mode | D: Transaction ID | E: Start Date | F: Insurance Document | G: End Date
            const rowData = [
                formattedCurrentDate,       // A: Timestamp
                selectedSub.sn,             // B: Subscription No
                paymentMethod,              // C: Payment Mode
                transactionId || "",        // D: Transaction ID
                startDate,                  // E: Start Date
                driveFileUrl || "No File",  // F: Insurance Document
                endDate,                    // G: End Date
                updatedPrice || "",         // H: Updated Price
                selectedSub.price || ""     // I: Old Price
            ];

            const result = await submitToGoogleSheets({
                action: 'insert',
                sheetName: 'PAYMENT',
                data: rowData
            });

            if (result.success) {
                // Update Local State IMMEDIATELY
                updateSubscription(selectedSub.id, {
                    status: 'Paid',
                    startDate: startDate,
                    endDate: endDate,
                    paymentMethod: paymentMethod,
                    transactionId: transactionId,
                    paymentFile: fileName,
                    paymentFileContent: fileContent,
                    paymentDate: now.toISOString().split('T')[0],
                    actual3: formattedCurrentDate, // Set Actual 3 to move to History
                    updatedPrice: updatedPrice,
                    price: updatedPrice || selectedSub.price // Update local price if changed
                });

                // Update "Subscription" Sheet columns
                try {
                    const cellUpdates = [
                        { column: 19, value: formattedCurrentDate }, // Column S: Actual 3
                        { column: 21, value: startDate },            // Column U: Start Date
                        { column: 22, value: endDate },              // Column V: End Date
                        { column: 23, value: driveFileUrl || "" },   // Column W: Document Copy
                        { column: 24, value: updatedPrice || "" }    // Column X: Updated Price
                    ];

                    // User Request: Update Column F (Price - Index 6) if updated price is provided
                    if (updatedPrice) {
                        cellUpdates.push({ column: 6, value: updatedPrice });
                    }
                    
                    console.log("Updating Subscription sheet Columns 19, 21, 22, 23...");
                    await updateGoogleSheetCellsBySn('Subscription', selectedSub.sn, cellUpdates);
                } catch (updateErr) {
                    console.error('Failed to update Subscription sheet:', updateErr);
                }

                toast.success("Payment recorded and saved to Google Sheets");
                handleCloseModal();
                refreshData();
            } else {
                toast.error("Failed to save to Google Sheets");
            }
        } catch (error) {
            console.error("Payment Error:", error);
            toast.error("Error saving payment");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewFile = (item: SubscriptionItem) => {
        const fileLink = item.paymentFile || "";
        const fileContent = item.paymentFileContent || "";

        // 1. If it's a Drive Link (stored in paymentFile)
        if (fileLink.startsWith('http')) {
            window.open(fileLink, '_blank');
        }
        // 2. If it's local Base64 content (for immediate view after upload)
        else if (fileContent.startsWith('data:')) {
            const link = document.createElement('a');
            link.href = fileContent;
            link.download = fileLink || 'document';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            toast.error("File link not found or invalid");
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Unified Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Subscription Payment</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage and track subscription payments</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-center">
                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <input
                            type="text"
                            placeholder="Search subscriptions..."
                            className="pl-10 pr-4 py-2.5 w-full border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={refreshData}
                        disabled={isLoading}
                        className="flex items-center justify-center p-2.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> : <RefreshCw className="h-5 w-5" />}
                    </button>

                    {/* Tabs & Sync */}
                    <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto items-center gap-1">
                        <div className="flex bg-gray-100 p-0 rounded-lg">
                            <button
                                onClick={() => setActiveTab('pending')}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'pending'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Pending
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'history'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                History
                            </button>
                        </div>

                        <button
                            onClick={refreshData}
                            disabled={isLoading}
                            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-white rounded-md transition-all disabled:opacity-50"
                            title="Sync with Google Sheets"
                        >
                            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="hidden md:flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-[calc(100vh-260px)]">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold whitespace-nowrap">
                            <tr>
                                {activeTab === 'history' && <th className="p-4">Payment Date</th>}
                                {activeTab === 'pending' && <th className="p-4">Action</th>}
                                <th className="p-4">Subscription No</th>
                                <th className="p-4">Company</th>
                                <th className="p-4">Subscriber</th>
                                <th className="p-4">Subscription</th>
                                <th className="p-4">Price</th>
                                <th className="p-4">Frequency</th>
                                <th className="p-4">Approved On</th>
                                {activeTab === 'history' && (
                                    <>
                                        <th className="p-4">Start Date</th>
                                        <th className="p-4">End Date</th>
                                        <th className="p-4">Payment Method</th>
                                        <th className="p-4">Insurance Doc</th>
                                        <th className="p-4">Updated Price</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {(activeTab === 'pending' ? pendingSubscriptions : historySubscriptions).map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                    {activeTab === 'history' && (
                                        <td className="p-4 text-gray-500 whitespace-nowrap">{formatDate(item.paymentDate)}</td>
                                    )}
                                    {activeTab === 'pending' && (
                                        <td className="p-4">
                                            <button
                                                onClick={() => handlePayClick(item)}
                                                className="px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 shadow-sm shadow-green-200 transition-colors flex items-center gap-1"
                                            >
                                                <CreditCard size={14} />
                                                Pay
                                            </button>
                                        </td>
                                    )}
                                    <td className="p-4 font-mono text-sm font-bold text-gray-700">{item.sn}</td>
                                    <td className="p-4 font-medium text-gray-900">{item.companyName}</td>
                                    <td className="p-4 text-gray-700">{item.subscriberName}</td>
                                    <td className="p-4">
                                        <div className="text-indigo-600 font-medium">{item.subscriptionName}</div>
                                        {activeTab === 'pending' && (
                                            <div className="text-orange-500 font-semibold mt-0.5 text-[10px] uppercase tracking-tight">
                                                pending payment waiting for approval
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 font-medium text-gray-900">{item.price}</td>
                                    <td className="p-4 text-gray-500">{item.frequency}</td>
                                    <td className="p-4 text-gray-500 whitespace-nowrap">{formatDate(item.actual2)}</td>
                                    {activeTab === 'history' && (
                                        <>
                                            <td className="p-4 text-gray-500 whitespace-nowrap">{formatDate(item.startDate)}</td>
                                            <td className="p-4 text-gray-500 whitespace-nowrap">{formatDate(item.endDate)}</td>
                                            <td className="p-4 text-gray-700">{item.paymentMethod}</td>
                                            <td className="p-4">
                                                {item.paymentFile ? (
                                                    <button
                                                        onClick={() => handleViewFile(item)}
                                                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                                                    >
                                                        <FileText size={14} /> View
                                                    </button>
                                                ) : <span className="text-gray-400">-</span>}
                                            </td>
                                            <td className="p-4 text-gray-700 font-bold">{item.updatedPrice || '-'}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                            {(activeTab === 'pending' ? pendingSubscriptions : historySubscriptions).length === 0 && (
                                <tr>
                                    <td colSpan={activeTab === 'history' ? 12 : 9} className="p-12 text-center text-gray-500">
                                        No {activeTab} payments found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden flex flex-col gap-4">
                {(activeTab === 'pending' ? pendingSubscriptions : historySubscriptions).map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
                        {/* Header */}
                        <div className="flex justify-between items-start">
                            <div className="flex gap-3 items-start">
                                <div className="h-10 w-10 flex items-center justify-center bg-green-50 text-green-600 rounded-lg shrink-0 mt-0.5">
                                    <CreditCard size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{item.sn}</span>
                                        {activeTab === 'history' && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border bg-green-50 text-green-700 border-green-100">
                                                Paid
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-sm font-bold text-gray-900 leading-tight">{item.subscriptionName}</h3>
                                    <p className="text-xs text-gray-500 mt-0.5 font-medium">{item.companyName}</p>
                                </div>
                            </div>

                            {/* Action Button for Pending */}
                            {activeTab === 'pending' && (
                                <button
                                    onClick={() => handlePayClick(item)}
                                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg shadow-sm shadow-green-200"
                                >
                                    Pay
                                </button>
                            )}
                            {/* View Button for History */}
                            {activeTab === 'history' && item.paymentFile && (
                                <button
                                    onClick={() => handleViewFile(item)}
                                    className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"
                                >
                                    <Download size={18} />
                                </button>
                            )}
                        </div>

                        {/* Key Info Grid */}
                        <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs pt-3 border-t border-dashed border-gray-100">
                            <div>
                                <span className="block text-gray-400 mb-0.5 text-[10px] uppercase font-semibold">Subscriber</span>
                                <span className="font-semibold text-gray-700">{item.subscriberName}</span>
                            </div>
                            <div>
                                <span className="block text-gray-400 mb-0.5 text-[10px] uppercase font-semibold">Price / Freq</span>
                                <span className="font-bold text-gray-900">{item.price} <span className="text-gray-400 font-normal text-[10px]">/ {item.frequency}</span></span>
                            </div>
                            {activeTab === 'history' && (
                                <div className="col-span-2">
                                    <span className="block text-gray-400 mb-0.5 text-[10px] uppercase font-semibold">Payment Method</span>
                                    <span className="text-gray-700">{item.paymentMethod}</span>
                                </div>
                            )}
                        </div>

                        {/* Dates Footer */}
                        <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-2 text-[10px] border border-gray-100">
                            <div>
                                <span className="block text-gray-400 mb-0.5 uppercase tracking-wider font-semibold">Approved On</span>
                                <span className="font-mono text-gray-600 font-bold">{formatDate(item.actual2)}</span>
                            </div>
                            {activeTab === 'history' ? (
                                <div className="text-right pl-2 border-l border-gray-200">
                                    <span className="block text-gray-400 mb-0.5 uppercase tracking-wider font-semibold">Paid On</span>
                                    <span className="font-mono text-green-600 font-bold">{formatDate(item.paymentDate)}</span>
                                </div>
                            ) : (
                                <div className="text-right pl-2 border-l border-gray-200">
                                    <span className="block text-gray-400 mb-0.5 uppercase tracking-wider font-semibold">Status</span>
                                    <span className="font-semibold text-orange-500 text-[9px] leading-tight block">
                                        Waiting for approval
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {(activeTab === 'pending' ? pendingSubscriptions : historySubscriptions).length === 0 && (
                    <div className="flex flex-col items-center justify-center p-8 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                        <CreditCard size={32} className="mb-2 opacity-50" />
                        <p className="text-sm font-medium">No {activeTab} payments</p>
                    </div>
                )}
            </div>

            {/* Payment Modal */}
            {selectedSub && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-800">Process Payment</h3>
                            <button onClick={handleCloseModal} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            {/* Read-only details */}
                            <div className="grid grid-cols-3 gap-4 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
                                <div>
                                    <span className="block text-xs text-gray-500 uppercase font-semibold">Subscription No</span>
                                    <span className="font-mono text-gray-700 font-bold">{selectedSub.sn}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-gray-500 uppercase font-semibold">Company</span>
                                    <span className="font-medium text-gray-900">{selectedSub.companyName}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-gray-500 uppercase font-semibold">Subscriber</span>
                                    <span className="text-gray-900">{selectedSub.subscriberName}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="block text-xs text-gray-500 uppercase font-semibold">Subscription</span>
                                    <span className="font-medium text-indigo-600">{selectedSub.subscriptionName}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-gray-500 uppercase font-semibold">Frequency</span>
                                    <span className="font-medium text-gray-900">{selectedSub.price} <span className="text-gray-500 font-normal">({selectedSub.frequency})</span></span>
                                </div>
                            </div>

                            {/* Input Form */}
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Start Date</label>
                                    <input
                                        type="date"
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">End Date</label>
                                    <input
                                        type="date"
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Payment Method</label>
                                    <select
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                    >
                                        <option value="Credit Card">Credit Card</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="UPI">UPI</option>
                                    </select>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Transaction ID</label>
                                    <input
                                        type="text"
                                        placeholder="TID-123456"
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={transactionId}
                                        onChange={(e) => setTransactionId(e.target.value)}
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Insurance Document</label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            onChange={handleFileChange}
                                            disabled={isSubmitting}
                                        />
                                        <div className="w-full p-2.5 border border-gray-300 border-dashed rounded-lg flex items-center gap-2 text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors">
                                            <Upload size={16} />
                                            <span className="text-xs truncate">{fileName || 'Choose file...'}</span>
                                        </div>
                                    </div>
                                </div>
                                {selectedSub.renewalStatus === 'Renewed' && (
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Updated Price</label>
                                        <input
                                            type="text"
                                            placeholder="Enter updated price"
                                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            value={updatedPrice}
                                            onChange={(e) => setUpdatedPrice(e.target.value)}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
                            <button
                                onClick={handleCloseModal}
                                disabled={isSubmitting}
                                className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-white transition-all shadow-sm disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSubmitting}
                                className="px-8 py-2.5 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow-lg shadow-green-200 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="animate-spin h-4 w-4 border-2 border-white/50 border-t-white rounded-full"></div>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Save
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubscriptionPayment;
