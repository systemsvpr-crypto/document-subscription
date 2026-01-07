import { useState, useEffect, useMemo } from 'react';
import useDataStore, { SubscriptionItem, SubscriptionRenewalItem } from '../../store/dataStore';
import { submitToGoogleSheets, updateGoogleSheetCellsBySn, fetchSubscriptionRenewalHistoryFromGoogleSheets } from '../../utils/googleSheetsService';
import useHeaderStore from '../../store/headerStore';
import { RotateCcw, X, Check, Save, Search, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDate } from '../../utils/dateFormatter';
import { syncSubscriptions } from '../../utils/subscriptionSync';

const SubscriptionRenewal = () => {
    const { setTitle } = useHeaderStore();
    const { subscriptions, subscriptionRenewalHistory, addSubscriptionRenewalHistory, updateSubscription, setSubscriptions, setSubscriptionRenewalHistory } = useDataStore();
    const [isLoading, setIsLoading] = useState(false);

    const refreshData = async () => {
        if (isLoading) return;
        try {
            setIsLoading(true);
            // 1. Fetch Subscriptions
            const subsData = await syncSubscriptions();
            setSubscriptions(subsData);

            // 2. Fetch Renewal History
            const renewalData = await fetchSubscriptionRenewalHistoryFromGoogleSheets();

            // 3. Map Renewal Data
            const mappedHistory = renewalData.map((r, index) => {
                const sub = subsData.find(s => s.sn === r.sn);
                return {
                    id: `renew-hist-${index}-${Date.now()}`,
                    renewalNo: r.renewalNo,
                    subscriptionId: sub?.id || '',
                    sn: r.sn,
                    companyName: sub?.companyName || 'Unknown',
                    subscriberName: sub?.subscriberName || 'Unknown',
                    subscriptionName: sub?.subscriptionName || 'Unknown',
                    frequency: sub?.frequency || '-',
                    price: sub?.price || '-',
                    endDate: sub?.endDate || '-',
                    renewalStatus: r.status
                };
            });

            setSubscriptionRenewalHistory(mappedHistory);
        } catch (error) {
            console.error("Sync Error:", error);
            toast.error("Failed to sync with Google Sheets");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setTitle('Subscription Renewal');
        refreshData();
    }, [setTitle]);

    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSub, setSelectedSub] = useState<SubscriptionItem | null>(null);
    const [renewalAction, setRenewalAction] = useState<'Renewed' | 'Rejected' | ''>('');

    // Logic: 
    // Pending: Planned1 is Set AND Actual1 is Empty
    // History: Planned1 is Set AND Actual1 is Set
    const pendingSubscriptions = useMemo(() =>
        subscriptions.filter(sub => {
            const matchesSearch =
                sub.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sub.subscriptionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sub.sn.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            // User Condition:
            // Pending if: Planned1 is NOT NULL/Empty AND Actual1 is NULL/Empty
            const hasPlanned1 = sub.planned1 && sub.planned1.trim().length > 0;
            const hasActual1 = sub.actual1 && sub.actual1.trim().length > 0;

            return hasPlanned1 && !hasActual1;
        }),
        [subscriptions, searchTerm]);

    const historySubscriptions = useMemo(() =>
        subscriptions.filter(sub => {
            const matchesSearch =
                sub.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sub.subscriptionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sub.sn.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            // User Condition:
            // History if: Planned1 is NOT NULL/Empty AND Actual1 is NOT NULL/Empty
            const hasPlanned1 = sub.planned1 && sub.planned1.trim().length > 0;
            const hasActual1 = sub.actual1 && sub.actual1.trim().length > 0;

            return hasPlanned1 && hasActual1;
        }),
        [subscriptions, searchTerm]);

    const handleAction = (sub: SubscriptionItem) => {
        setSelectedSub(sub);
        setRenewalAction(''); // Reset action
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedSub(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSub || !renewalAction) {
            toast.error("Please select an action");
            return;
        }

        // Generate Renewal Number (RN-001, RN-002...)
        const rnNumber = `RN-${String(subscriptionRenewalHistory.length + 1).padStart(3, '0')}`;

        // Calculate New End Date Logic (Lifted up)
        let newDateStr = '';
        if (selectedSub.endDate) {
            const [y, m, d] = selectedSub.endDate.split('-').map(Number);
            const date = new Date(y, m - 1, d);

            if (selectedSub.frequency.toLowerCase().includes('year')) {
                date.setFullYear(date.getFullYear() + 1);
            } else if (selectedSub.frequency.toLowerCase().includes('month')) {
                date.setMonth(date.getMonth() + 1);
            } else if (selectedSub.frequency.toLowerCase().includes('quarter')) {
                date.setMonth(date.getMonth() + 3);
            } else {
                date.setFullYear(date.getFullYear() + 1); // Default to 1 year
            }
            newDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        } else {
            const today = new Date();
            newDateStr = `${today.getFullYear() + 1}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        }

        try {
            setIsLoading(true);

            // 2. Submit to "RENEWAL" Sheet
            const renewalPayload = [
                (() => {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    return `${year}-${month}-${day} ${hours}:${minutes}`;
                })(), // Column A
                rnNumber,                    // Column B
                selectedSub.sn,              // Column C
                'Admin',                     // Column D
                renewalAction                // Column E
            ];

            await submitToGoogleSheets({
                action: 'insert',
                sheetName: 'RENEWAL',
                data: renewalPayload
            });

            // Calculate new count
            const currentCount = parseInt(selectedSub.renewalCount || '0', 10);
            const newCount = currentCount + 1;

            // 3. Update "Subscription" Sheet
            // Logic: Update Actual 1 (J/10), Renewal Status (L/12), Renewal Count (M/13)
            // And CLEAR: Actual 2 (O/15), Approval Status (Q/17), Actual 3 (S/19)
            const formattedDate = (() => {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day} ${hours}:${minutes}`;
            })();

            const cellUpdates = [
                { column: 10, value: formattedDate }, // Actual 1 (J)
                { column: 12, value: renewalAction }, // Renewal Status (L)
                { column: 13, value: String(newCount) }, // Renewal Count (M)
                { column: 15, value: "" }, // Actual 2 (O)
                { column: 17, value: "" }, // Approval Status (Q)
                { column: 19, value: "" }  // Actual 3 (S)
            ];

            await updateGoogleSheetCellsBySn('Subscription', selectedSub.sn, cellUpdates);

            // 4. Update Local State
            const newItem: SubscriptionRenewalItem = {
                id: Math.random().toString(36).substr(2, 9),
                renewalNo: rnNumber,
                subscriptionId: selectedSub.id,
                sn: selectedSub.sn,
                companyName: selectedSub.companyName,
                subscriberName: selectedSub.subscriberName,
                subscriptionName: selectedSub.subscriptionName,
                frequency: selectedSub.frequency,
                price: selectedSub.price,
                endDate: selectedSub.endDate, 
                renewalStatus: renewalAction
            };

            addSubscriptionRenewalHistory(newItem);

            // Update Subscription based on Action
            if (renewalAction === 'Renewed') {
                updateSubscription(selectedSub.id, {
                    endDate: newDateStr,
                    renewalStatus: 'Renewed',
                    renewalCount: String(newCount),
                    status: 'Renewed',
                    actual1: formattedDate // FORCE UPDATE LOCAL STATE for immediate UI reflection
                });
                toast.success("Subscription Renewed!");
            } else {
                updateSubscription(selectedSub.id, {
                    status: 'Rejected',
                    renewalStatus: 'Rejected',
                    renewalCount: String(newCount),
                    actual1: formattedDate // FORCE UPDATE LOCAL STATE
                });
                toast.success("Subscription Renewal Rejected");
            }

            handleCloseModal();
        } catch (error) {
            console.error("Renewal Save Error:", error);
            toast.error("Failed to save renewal data");
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="space-y-6 p-6">
            {/* Unified Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Subscription Renewals</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage pending and history of subscription renewals</p>
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

            {/* Content Filtered by Tab */}
            <div className="hidden md:flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-[calc(100vh-350px)]">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
                            <tr className="border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                {activeTab === 'pending' ? (
                                    <>
                                        <th className="p-3 text-center w-24 bg-gray-50">Action</th>
                                        <th className="p-3 whitespace-nowrap bg-gray-50">Subscription No</th>
                                        <th className="p-3 whitespace-nowrap bg-gray-50">Company</th>
                                        <th className="p-3 whitespace-nowrap bg-gray-50">Subscriber</th>
                                        <th className="p-3 whitespace-nowrap bg-gray-50">Subscription</th>
                                        <th className="p-3 whitespace-nowrap bg-gray-50">Frequency</th>
                                        <th className="p-3 whitespace-nowrap bg-gray-50">Price</th>
                                        <th className="p-3 whitespace-nowrap bg-gray-50">End Date</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="p-3 whitespace-nowrap bg-gray-50">Renewal Count</th>
                                        <th className="p-3 whitespace-nowrap bg-gray-50">Subscription No</th>
                                        <th className="p-3 whitespace-nowrap bg-gray-50">Company</th>
                                        <th className="p-3 whitespace-nowrap bg-gray-50">Subscriber</th>
                                        <th className="p-3 whitespace-nowrap bg-gray-50">Subscription</th>
                                        <th className="p-3 whitespace-nowrap bg-gray-50">Frequency</th>
                                        <th className="p-3 whitespace-nowrap bg-gray-50">Price</th>
                                        <th className="p-3 whitespace-nowrap bg-gray-50">End Date</th>
                                        <th className="p-3 whitespace-nowrap text-center bg-gray-50">Renewal Status</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {activeTab === 'pending' ? (
                                pendingSubscriptions.length > 0 ? (
                                    pendingSubscriptions.map((sub) => (
                                        <tr key={sub.id} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="p-3 text-center">
                                                <button
                                                    onClick={() => handleAction(sub)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
                                                >
                                                    <RotateCcw size={14} />
                                                    Action
                                                </button>
                                            </td>
                                            <td className="p-3 font-mono font-bold text-xs text-gray-700">{sub.sn}</td>
                                            <td className="p-3 font-medium text-gray-900">{sub.companyName}</td>
                                            <td className="p-3 text-gray-600">{sub.subscriberName}</td>
                                            <td className="p-3 text-gray-900">{sub.subscriptionName}</td>
                                            <td className="p-3">
                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">{sub.frequency}</span>
                                            </td>
                                            <td className="p-3 font-medium text-gray-900">{sub.price}</td>
                                            <td className="p-3 text-center">
                                                {sub.endDate ? (
                                                    <span className="inline-flex items-center justify-center px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded text-xs font-medium">
                                                        {formatDate(sub.endDate)}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 font-mono text-xs">N/A</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="p-12 text-center">
                                            <div className="flex flex-col items-center justify-center p-8 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
                                                <div className="h-16 w-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4">
                                                    <Check size={32} />
                                                </div>
                                                <h3 className="text-gray-900 font-bold text-lg">All Caught Up!</h3>
                                                <p className="text-gray-500 text-sm mt-1">No subscriptions require renewal at this time.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            ) : (
                                historySubscriptions.length > 0 ? (
                                    historySubscriptions.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="p-3 font-mono font-bold text-xs text-indigo-600">{item.renewalCount || 1}</td>
                                            <td className="p-3 font-mono text-xs text-gray-700">{item.sn}</td>
                                            <td className="p-3 font-medium text-gray-900">{item.companyName}</td>
                                            <td className="p-3 text-gray-600">{item.subscriberName}</td>
                                            <td className="p-3 text-gray-900">{item.subscriptionName}</td>
                                            <td className="p-3">
                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">{item.frequency}</span>
                                            </td>
                                            <td className="p-3 font-medium text-gray-900">{item.price}</td>
                                            <td className="p-3 text-gray-500 font-mono text-xs">{formatDate(item.endDate)}</td>
                                            <td className="p-3 text-center">
                                                {item.renewalStatus === 'Renewed' ? (
                                                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-green-100">
                                                        <Check size={12} /> Renewed
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-red-100">
                                                        <X size={12} /> {item.renewalStatus || 'Rejected'}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="p-12 text-center text-gray-500">
                                            <p>No renewal history available</p>
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden flex flex-col gap-4">
                {activeTab === 'pending' ? (
                    pendingSubscriptions.length > 0 ? (
                        pendingSubscriptions.map((sub) => (
                            <div key={sub.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-3 items-start">
                                        <div className="h-10 w-10 flex items-center justify-center bg-amber-50 text-amber-600 rounded-lg shrink-0 mt-0.5">
                                            <RotateCcw size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{sub.sn}</span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border bg-amber-50 text-amber-700 border-amber-100">
                                                    Expiring
                                                </span>
                                            </div>
                                            <h3 className="text-sm font-bold text-gray-900 leading-tight">{sub.subscriptionName}</h3>
                                            <p className="text-xs text-gray-500 mt-0.5 font-medium">{sub.companyName}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAction(sub)}
                                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm shadow-indigo-200"
                                    >
                                        Action
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs pt-3 border-t border-dashed border-gray-100">
                                    <div>
                                        <span className="block text-gray-400 mb-0.5 text-[10px] uppercase font-semibold">Subscriber</span>
                                        <span className="font-semibold text-gray-700">{sub.subscriberName}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-400 mb-0.5 text-[10px] uppercase font-semibold">Price / Freq</span>
                                        <span className="font-bold text-gray-900">{sub.price} <span className="text-gray-400 font-normal text-[10px]">/ {sub.frequency}</span></span>
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-2 text-[10px] border border-gray-100">
                                    <div>
                                        <span className="block text-gray-400 mb-0.5 uppercase tracking-wider font-semibold">Start Date</span>
                                        <span className="font-mono text-gray-600 font-bold">{sub.startDate ? formatDate(sub.startDate) : 'N/A'}</span>
                                    </div>
                                    <div className="text-right pl-2 border-l border-gray-200">
                                        <span className="block text-gray-400 mb-0.5 uppercase tracking-wider font-semibold">End Date</span>
                                        <span className="font-mono text-amber-600 font-bold">{sub.endDate ? formatDate(sub.endDate) : 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center p-8 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                            <Check size={32} className="mb-2 opacity-50 text-green-500" />
                            <p className="text-sm font-medium">No pending renewals</p>
                        </div>
                    )
                ) : (
                    historySubscriptions.length > 0 ? (
                        historySubscriptions.map((item) => (
                            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-3 items-start">
                                        <div className="h-10 w-10 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg shrink-0 mt-0.5">
                                            <RotateCcw size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{item.sn}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${item.renewalStatus === 'Renewed' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
                                                    }`}>
                                                    {item.renewalStatus || 'Rejected'}
                                                </span>
                                            </div>
                                            <h3 className="text-sm font-bold text-gray-900 leading-tight">{item.subscriptionName}</h3>
                                            <p className="text-xs text-gray-500 mt-0.5 font-medium">{item.companyName}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs pt-3 border-t border-dashed border-gray-100">
                                    <div>
                                        <span className="block text-gray-400 mb-0.5 text-[10px] uppercase font-semibold">Subscriber</span>
                                        <span className="font-semibold text-gray-700">{item.subscriberName}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-400 mb-0.5 text-[10px] uppercase font-semibold">Price / Freq</span>
                                        <span className="font-bold text-gray-900">{item.price} <span className="text-gray-400 font-normal text-[10px]">/ {item.frequency}</span></span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-400 mb-0.5 text-[10px] uppercase font-semibold">Renewal Count</span>
                                        <span className="font-mono text-indigo-600 font-medium">{item.renewalCount || 1}</span>
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-3 text-[10px] border border-gray-100 text-center">
                                    <span className="block text-gray-400 mb-0.5 uppercase tracking-wider font-semibold">End Date</span>
                                    <span className="font-mono text-gray-700 font-bold">{formatDate(item.endDate)}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center p-8 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                            <RotateCcw size={32} className="mb-2 opacity-50" />
                            <p className="text-sm font-medium">No renewal history</p>
                        </div>
                    )
                )}
            </div>

            {/* Action Popup Modal */}
            {isModalOpen && selectedSub && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-base font-bold text-gray-800">Process Renewal</h3>
                                <p className="text-[10px] text-gray-500 mt-0.5">Approve or Reject Subscription Renewal</p>
                            </div>
                            <button onClick={handleCloseModal} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-5 space-y-4">
                            {/* Pre-filled Info Grid */}
                            <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div>
                                    <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-0.5">Subscription No</label>
                                    <div className="font-mono text-gray-700 font-medium">{selectedSub.sn}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-0.5">Company</label>
                                    <div className="text-gray-900 font-medium">{selectedSub.companyName}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-0.5">Subscriber</label>
                                    <div className="text-gray-700">{selectedSub.subscriberName}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-0.5">Subscription</label>
                                    <div className="text-gray-700">{selectedSub.subscriptionName}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-0.5">Frequency</label>
                                    <div className="text-gray-700">{selectedSub.frequency}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-0.5">Price</label>
                                    <div className="text-gray-900 font-bold">{selectedSub.price}</div>
                                </div>
                                <div className="col-span-2 pt-2 border-t border-gray-200 mt-2">
                                    <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-0.5">Current End Date</label>
                                    <div className="text-amber-600 font-bold text-sm">{formatDate(selectedSub.endDate)}</div>
                                </div>
                            </div>

                            {/* Renewal Subscription Dropdown */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Renewal Subscription</label>
                                <div className="relative">
                                    <select
                                        value={renewalAction}
                                        onChange={(e) => setRenewalAction(e.target.value as 'Renewed' | 'Rejected')}
                                        className="w-full appearance-none bg-white border border-gray-200 text-gray-700 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    >
                                        <option value="" disabled>Select Action</option>
                                        <option value="Renewed">Renewed</option>
                                        <option value="Rejected">Rejected</option>  
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                                        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className={`flex-1 py-2.5 px-4 rounded-xl text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
                                        isLoading 
                                        ? 'bg-indigo-400 cursor-not-allowed shadow-none' 
                                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                                    }`}
                                >
                                    {isLoading ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16} />
                                            <span>Save</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubscriptionRenewal;
