// SubscriptionApproval.tsx
import { useState, useMemo, useEffect } from 'react';
import useDataStore, { SubscriptionItem } from '../../store/dataStore';
import useHeaderStore from '../../store/headerStore';
import useAuthStore from '../../store/authStore';
import { CheckCircle, FileText, X, Save, Search, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDate } from '../../utils/dateFormatter';
import { submitToGoogleSheets, updateGoogleSheetCellsBySn } from '../../utils/googleSheetsService';

const SubscriptionApproval = () => {
    const { subscriptions, updateSubscription, setSubscriptions } = useDataStore();
    const { setTitle } = useHeaderStore();
    const { currentUser } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [selectedSub, setSelectedSub] = useState<SubscriptionItem | null>(null);
    const [approvalStatus, setApprovalStatus] = useState<'Approve' | 'Reject'>('Approve');
    const [remarks, setRemarks] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Initial Sync on Mount
    useEffect(() => {
        setTitle('Approval');
        refreshData();
    }, [setTitle]);

    const refreshData = async () => {
        try {
            setIsLoading(true);
            const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || "";
            if (!GOOGLE_SCRIPT_URL) return;

            // 1. Fetch Base Subscriptions
            const subUrl = new URL(GOOGLE_SCRIPT_URL);
            subUrl.searchParams.set("sheet", "Subscription");
            subUrl.searchParams.set("_t", Date.now().toString());

            const subRes = await fetch(subUrl.toString());
            const subJson = await subRes.json();

            if (!subJson.success) throw new Error("Failed to fetch subscriptions");

            // Transform base subscriptions (starting from Row 1)
            const rawSubs = subJson.data;
            const baseSubs: SubscriptionItem[] = rawSubs
                .filter((row: any[]) => {
                    const sn = String(row[1] || "").toLowerCase();
                    const company = String(row[2] || "").toLowerCase();

                    // Skip if:
                    // 1. SN is missing
                    // 2. Row is a Header (contains labels like "Subscription No" or "Company Name")
                    // 3. Row is largely empty
                    if (!row[1] || sn.includes('subscription') || sn.includes('serial') || company.includes('company')) {
                        return false;
                    }
                    return row[2] || row[4]; // Must have company or service name
                })
                .map((row: any[], index: number) => {
                    let sn = row[1] || "";
                    // Standardize SN format
                    const snMatch = sn.toString().match(/(\d+)/);
                    if (snMatch) sn = `SN-${String(snMatch[0]).padStart(3, '0')}`;

                    return {
                        id: `sub-${sn}-${index}`,
                        sn: sn,
                        requestedDate: row[0] || "",
                        companyName: row[2] || "N/A",
                        subscriberName: row[3] || "N/A",
                        subscriptionName: row[4] || "N/A",
                        price: row[5] || "N/A",
                        frequency: row[6] || "N/A",
                        purpose: row[7] || "N/A",
                        status: "Pending",
                        actual2: (row[14] || "").toString().trim(), // Column O
                        startDate: "",
                        endDate: ""
                    };
                });

            // 2. Fetch Approval Logs
            const appUrl = new URL(GOOGLE_SCRIPT_URL);
            appUrl.searchParams.set("sheet", "Approval");
            appUrl.searchParams.set("_t", Date.now().toString());

            const appRes = await fetch(appUrl.toString());
            const appJson = await appRes.json();

            if (appJson.success && Array.isArray(appJson.data)) {
                const approvalLogs = appJson.data.slice(1); // Skip header

                // Merge approvals into base subscriptions
                approvalLogs.forEach((log: any[]) => {
                    const subNo = log[2]; // Subscription No (SN-xxx)
                    const status = log[4]; // Approval Status
                    const apNo = log[1];   // Approval No
                    const note = log[5];   // Note
                    const date = log[0];   // Timestamp

                    const subIndex = baseSubs.findIndex(s => s.sn === subNo);
                    if (subIndex !== -1) {
                        baseSubs[subIndex] = {
                            ...baseSubs[subIndex],
                            status: status,
                            approvalNo: apNo,
                            remarks: note,
                            approvalDate: date
                        };
                    } else {
                        // If log exists but subscription is missing from base sheet, 
                        // add it as a history-only item
                        baseSubs.push({
                            id: `sub-orphan-${subNo}`,
                            sn: subNo,
                            requestedDate: "",
                            companyName: "N/A (Removed)",
                            subscriberName: "N/A",
                            subscriptionName: "N/A",
                            price: "N/A",
                            frequency: "N/A",
                            purpose: "N/A",
                            status: status,
                            approvalNo: apNo,
                            remarks: note,
                            approvalDate: date,
                            startDate: "",
                            endDate: ""
                        });
                    }
                });
            }

            setSubscriptions(baseSubs);
        } catch (error) {
            console.error("Sync Error:", error);
            toast.error("Failed to sync with Google Sheets");
        } finally {
            setIsLoading(false);
        }
    };

    const pendingSubscriptions = useMemo(() =>
        subscriptions.filter(s =>
            !s.actual2 && // Show in Pending ONLY if Actual 2 is null
            (
                s.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.subscriptionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.sn.toLowerCase().includes(searchTerm.toLowerCase())
            )
        ),
        [subscriptions, searchTerm]);

    const historySubscriptions = useMemo(() =>
        subscriptions.filter(s =>
            (s.approvalNo || s.approvalDate) &&
            (
                s.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.subscriptionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.sn.toLowerCase().includes(searchTerm.toLowerCase())
            )
        ),
        [subscriptions, searchTerm]);

    const handleActionClick = (sub: SubscriptionItem) => {
        setSelectedSub(sub);
        setApprovalStatus('Approve');
        setRemarks('');
    };

    const handleCloseModal = () => {
        setSelectedSub(null);
        setRemarks('');
    };

    const fetchNextApprovalSN = async () => {
        try {
            const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || "";
            if (!GOOGLE_SCRIPT_URL) return `AN-${Date.now().toString().slice(-6)}`;

            const url = new URL(GOOGLE_SCRIPT_URL);
            url.searchParams.set("sheet", "Approval");
            url.searchParams.set("_t", new Date().getTime().toString());

            const res = await fetch(url.toString(), {
                method: "GET",
                mode: "cors",
            });

            if (!res.ok) return `AN-${Date.now().toString().slice(-6)}`;
            const json = await res.json();
            if (!json || json.success !== true || !Array.isArray(json.data)) return `AN-${Date.now().toString().slice(-6)}`;

            const rows = json.data;
            const body = rows.length > 1 ? rows.slice(1) : [];

            // Extract all numbers from existing data (Column B is index 1)
            const existingNums = body
                .map((row: any[]) => row[1] || '')
                .map((val: any) => {
                    const match = val.toString().match(/\d+/);
                    return match ? parseInt(match[0]) : 0;
                });

            const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
            return `AN-${String(maxNum + 1).padStart(3, '0')}`;
        } catch (error) {
            console.error('Error fetching next Approval SN:', error);
            return `AN-${Date.now().toString().slice(-6)}`;
        }
    };

    const handleSave = async () => {
        if (!selectedSub) return;

        console.log("Submit Clicked - DATE FIX VERSION 1.5");
        setIsSubmitting(true);

        try {
            // Generate unique Approval No (e.g., AN-001)
            const apNo = await fetchNextApprovalSN();
            const newStatus = approvalStatus === 'Approve' ? 'Approved' : 'Rejected';
            const loginUsername = currentUser?.id || 'Admin';

            // Generate Current Date in YYYY-MM-DD HH:mm:ss format (Adding seconds to help sheet parsing)
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const formattedCurrentDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

            // Prepare data for Google Sheet as an ARRAY
            // ( Timestamp, Approval No, Subscription No, Approved By, Approval Status, Note )
            const rowData = [
                String(formattedCurrentDate),      // A: Timestamp
                String(apNo),           // B: Approval No (Unique Number)
                String(selectedSub.sn),  // C: Subscription No (Serial No of Subscription)
                String(loginUsername),   // D: Approved By
                String(newStatus),      // E: Approval Status
                String(remarks || "")   // F: Note
            ];

            console.log("Submitting rowData:", rowData);

            // Submit to Google Sheets (Approval Log)
            const result = await submitToGoogleSheets({
                action: 'insert',
                sheetName: 'Approval',
                data: rowData
            });

            if (result.success) {
                // Update Local State IMMEDIATELY with actual2 to move it to History
                updateSubscription(selectedSub.id, {
                    status: newStatus,
                    approvalNo: apNo,
                    remarks: remarks,
                    approvalDate: now.toISOString().split('T')[0],
                    actual2: formattedCurrentDate, // Setting this removes it from Pending filter logic
                });

                // Update "Subscription" Sheet columns (Actual 2 and Approval Status)
                try {
                    const cellUpdates = [
                        { column: 15, value: formattedCurrentDate }, // Column O: Actual 2
                        { column: 17, value: newStatus }             // Column Q: Approval Status
                    ];
                    
                    console.log("Updating strictly Columns 15 (Actual 2) and 17 (Status)...");
                    await updateGoogleSheetCellsBySn('Subscription', selectedSub.sn, cellUpdates);
                } catch (updateErr) {
                    console.error('Failed to update Subscription sheet:', updateErr);
                }

                toast.success(`Subscription ${newStatus} with ${apNo}. Updated Actual 2 & Status.`);
                handleCloseModal();
            } else {
                toast.error(result.error || 'Failed to save approval to Google Sheets');
            }
        } catch (error) {
            console.error('Error saving approval:', error);
            toast.error('Error saving approval. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Unified Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Approval</h1>
                    <p className="text-sm text-gray-500 mt-1">Review and approve pending subscription requests</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-center">
                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="pl-10 pr-4 py-2.5 w-full border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Tabs */}
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

            {/* Desktop Table View */}
            <div className="hidden md:flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-[calc(100vh-210px)]">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold whitespace-nowrap">
                            <tr>
                                {activeTab === 'history' && <th className="p-3">Approval No</th>}
                                {activeTab === 'pending' && <th className="p-3">Action</th>}
                                <th className="p-3">Serial No</th>
                                <th className="p-3">Company</th>
                                <th className="p-3">Subscriber</th>
                                <th className="p-3">Subscription</th>
                                <th className="p-3">Price</th>
                                <th className="p-3">Frequency</th>
                                <th className="p-3">Requested On</th>
                                {activeTab === 'history' && <th className="p-3 whitespace-nowrap">Approval Date</th>}
                                {activeTab === 'history' && <th className="p-3">Status</th>}
                                {activeTab === 'history' && <th className="p-3">Remarks</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {(activeTab === 'pending' ? pendingSubscriptions : historySubscriptions).map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                    {activeTab === 'history' && (
                                        <td className="p-3 font-mono font-bold text-gray-700 text-xs">{item.approvalNo || '-'}</td>
                                    )}
                                    {activeTab === 'pending' && (
                                        <td className="p-3">
                                            <button
                                                onClick={() => handleActionClick(item)}
                                                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors"
                                            >
                                                Approve
                                            </button>
                                        </td>
                                    )}
                                    <td className="p-3 font-mono text-sm font-bold text-gray-700">{item.sn}</td>
                                    <td className="p-3 font-medium text-gray-900">{item.companyName}</td>
                                    <td className="p-3 text-gray-700">{item.subscriberName}</td>
                                    <td className="p-3 text-indigo-600 font-medium">{item.subscriptionName}</td>
                                    <td className="p-3 font-medium text-gray-900">{item.price}</td>
                                    <td className="p-3 text-gray-500">{item.frequency}</td>
                                    <td className="p-3 text-gray-500 whitespace-nowrap">{formatDate(item.requestedDate)}</td>
                                    {activeTab === 'history' && (
                                        <td className="p-3 text-gray-500 whitespace-nowrap">{formatDate(item.approvalDate)}</td>
                                    )}
                                    {activeTab === 'history' && (
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded-full text-sm font-bold uppercase ${item.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                    )}
                                    {activeTab === 'history' && (
                                        <td className="p-3 text-gray-500 max-w-xs truncate" title={item.remarks}>{item.remarks || '-'}</td>
                                    )}
                                </tr>
                            ))}
                            {(activeTab === 'pending' ? pendingSubscriptions : historySubscriptions).length === 0 && (
                                <tr>
                                    <td colSpan={activeTab === 'history' ? 11 : 8} className="p-12 text-center text-gray-500">
                                        No {activeTab} subscriptions found.
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
                                <div className="h-10 w-10 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg shrink-0 mt-0.5">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{item.sn}</span>
                                        {activeTab === 'history' && (
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${item.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
                                                }`}>
                                                {item.status}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-sm font-bold text-gray-900 leading-tight">{item.subscriptionName}</h3>
                                    <p className="text-sm text-gray-500 mt-0.5 font-medium">{item.companyName}</p>
                                </div>
                            </div>

                            {/* Action Button for Pending */}
                            {activeTab === 'pending' && (
                                <button
                                    onClick={() => handleActionClick(item)}
                                    className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"
                                >
                                    <CheckCircle size={18} />
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
                            {activeTab === 'history' && item.approvalNo && (
                                <div>
                                    <span className="block text-gray-400 mb-0.5 text-[10px] uppercase font-semibold">Approval No</span>
                                    <span className="font-mono text-gray-700 font-medium">{item.approvalNo}</span>
                                </div>
                            )}
                        </div>

                        {/* Dates Footer */}
                        <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-2 text-[10px] border border-gray-100">
                            <div>
                                <span className="block text-gray-400 mb-0.5 uppercase tracking-wider font-semibold">Req. Date</span>
                                <span className="font-mono text-gray-600 font-bold">{formatDate(item.requestedDate)}</span>
                            </div>
                            {activeTab === 'history' && (
                                <div className="text-right pl-2 border-l border-gray-200">
                                    <span className="block text-gray-400 mb-0.5 uppercase tracking-wider font-semibold">Apr. Date</span>
                                    <span className="font-mono text-indigo-600 font-bold">{formatDate(item.approvalDate)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {(activeTab === 'pending' ? pendingSubscriptions : historySubscriptions).length === 0 && (
                    <div className="flex flex-col items-center justify-center p-8 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                        <FileText size={32} className="mb-2 opacity-50" />
                        <p className="text-sm font-medium">No {activeTab} subscriptions</p>
                    </div>
                )}
            </div>

            {/* Approval Modal */}
            {selectedSub && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-800">Subscription Action</h3>
                            <button onClick={handleCloseModal} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Read-only details grid */}
                            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div>
                                    <span className="block text-xs text-gray-500 uppercase font-semibold">Serial No</span>
                                    <span className="font-mono text-gray-700">{selectedSub.sn}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-gray-500 uppercase font-semibold">Requested On</span>
                                    <span className="text-gray-700">{formatDate(selectedSub.requestedDate)}</span>
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
                                    <span className="block text-xs text-gray-500 uppercase font-semibold">Price</span>
                                    <span className="font-medium text-gray-900">{selectedSub.price}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-gray-500 uppercase font-semibold">Frequency</span>
                                    <span className="text-gray-700">{selectedSub.frequency}</span>
                                </div>
                            </div>

                            {/* Action Form */}
                            <div className="space-y-3 pt-2">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Action Status</label>
                                    <select
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                                        value={approvalStatus}
                                        onChange={(e) => setApprovalStatus(e.target.value as 'Approve' | 'Reject')}
                                    >
                                        <option value="Approve">Approve</option>
                                        <option value="Reject">Reject</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Remarks</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-400"
                                        placeholder="Enter remarks..."
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={handleCloseModal}
                                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-white transition-all shadow-sm"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSubmitting}
                                className={`flex-1 py-2.5 rounded-xl text-white font-bold shadow-lg transition-all flex justify-center items-center gap-2 ${approvalStatus === 'Approve'
                                    ? 'bg-green-600 hover:bg-green-700 shadow-green-200'
                                    : 'bg-red-600 hover:bg-red-700 shadow-red-200'
                                    } ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center">
                                        <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Saving...
                                    </span>
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

export default SubscriptionApproval;