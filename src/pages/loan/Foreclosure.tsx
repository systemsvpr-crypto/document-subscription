import { useState, useEffect } from 'react';
import { Search, Building, Calendar, User, Clock, X } from 'lucide-react';
import useDataStore, { LoanItem } from '../../store/dataStore';
import useHeaderStore from '../../store/headerStore';
import { fetchLoansFromGoogleSheets, updateGoogleSheetCellsBySn } from '../../utils/googleSheetsService';
import { toast } from 'react-hot-toast';
import { formatDate } from '../../utils/dateFormatter';
import { Loader2 } from 'lucide-react';

const Foreclosure = () => {
    const { setTitle } = useHeaderStore();
    const { loans, updateLoan, setLoans } = useDataStore();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState<LoanItem | null>(null);
    const [formData, setFormData] = useState({
        requestDate: new Date().toISOString().split('T')[0],
        requesterName: 'Admin'
    });

    const formatCurrency = (amount: string | number | undefined) => {
        if (!amount) return '₹0';
        const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g, "")) : amount;
        if (isNaN(num)) return amount;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(num);
    };

    useEffect(() => {
        setTitle('Requested Foreclosure');
        loadLoans();
    }, [setTitle]);

    const loadLoans = async () => {
        try {
            setIsLoading(true);
            const fetchedLoans = await fetchLoansFromGoogleSheets();
            setLoans(fetchedLoans);
        } catch (error) {
            console.error('Error loading loans:', error);
            toast.error('Failed to load loans from Google Sheets');
        } finally {
            setIsLoading(false);
        }
    };

    // Pending: Planned 1 is Set AND Actual 1 is Empty
    const pendingLoans = loans.filter(loan =>
        (loan.planned1 && loan.planned1.trim() !== "") &&
        (!loan.actual1 || loan.actual1.trim() === "") &&
        loan.sn?.startsWith('SN-') &&
        (
            loan.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.loanName.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    // History: Planned 1 is Set AND Actual 1 is Set
    const historyLoans = loans.filter(loan =>
        (loan.planned1 && loan.planned1.trim() !== "") &&
        (loan.actual1 && loan.actual1.trim() !== "") &&
        (
            loan.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.loanName.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const handleActionClick = (loan: LoanItem) => {
        setSelectedLoan(loan);
        setFormData({
            requestDate: loan.requestDate && loan.requestDate.trim() !== ""
                ? loan.requestDate.split('/').reverse().join('-') // Convert DD/MM/YYYY to YYYY-MM-DD
                : new Date().toISOString().split('T')[0],
            requesterName: loan.requesterName || 'Admin'
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedLoan || !selectedLoan.rowIndex) {
            toast.error('Cannot update: Missing loan data or row index');
            return;
        }

        setIsSaving(true);
        try {
            // Update columns M (13), O (15) and P (16)
            await updateGoogleSheetCellsBySn('Loan', selectedLoan.sn, [
                {
                    column: 13, // Column M: Actual 1 (Request Date)
                    value: formData.requestDate.split('-').reverse().join('/')
                },
                {
                    column: 15, // Column O: Request Date
                    value: formData.requestDate.split('-').reverse().join('/')
                },
                {
                    column: 16, // Column P: Requester Name
                    value: formData.requesterName
                }
            ]);

            // Update local state
            updateLoan(selectedLoan.id, {
                actual1: formData.requestDate.split('-').reverse().join('/'),
                requestDate: formData.requestDate.split('-').reverse().join('/'),
                requesterName: formData.requesterName
            });

            toast.success('Foreclosure requested successfully');
            setIsModalOpen(false);
            setSelectedLoan(null);
        } catch (error: any) {
            console.error('Error saving foreclosure:', error);
            toast.error(error.message || 'Failed to save to Google Sheets');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedLoan(null);
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Requested Foreclosure</h1>
                    <p className="text-gray-500 text-sm mt-1">Manage foreclosure requests</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-center">
                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <input
                            type="text"
                            placeholder="Search loans..."
                            className="pl-10 pr-4 py-2.5 w-full border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'pending'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Pending
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'history'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            History
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    <p className="mt-4 text-gray-500 font-medium text-sm">Loading loan data...</p>
                </div>
            ) : activeTab === 'pending' ? (
                <>
                    {/* Desktop Table - Pending */}
                    <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                        <th className="p-4">Action</th>
                                        <th className="p-4">Serial No.</th>
                                        <th className="p-4">Loan Name</th>
                                        <th className="p-4">Bank Name</th>
                                        <th className="p-4">Amount</th>
                                        <th className="p-4">EMI</th>
                                        <th className="p-4">Loan Start Date</th>
                                        <th className="p-4">Loan End Date</th>
                                        <th className="p-4">Provided Document</th>
                                        <th className="p-4">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-gray-50">
                                    {pendingLoans.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="p-4">
                                                <button
                                                    onClick={() => handleActionClick(item)}
                                                    className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                                                >
                                                    Request
                                                </button>
                                            </td>
                                            <td className="p-4 font-medium text-gray-900">{item.sn}</td>
                                            <td className="p-4 font-medium text-gray-900">{item.loanName}</td>
                                            <td className="p-4 text-gray-600">{item.bankName}</td>
                                            <td className="p-4 text-gray-900 font-bold whitespace-nowrap">{formatCurrency(item.amount)}</td>
                                            <td className="p-4 text-gray-600 font-bold whitespace-nowrap">{formatCurrency(item.emi)}</td>
                                            <td className="p-4 text-gray-600 whitespace-nowrap">{formatDate(item.startDate)}</td>
                                            <td className="p-4 text-gray-600 whitespace-nowrap">{formatDate(item.endDate)}</td>
                                            <td className="p-4 text-gray-600">{item.providedDocument}</td>
                                            <td className="p-4 text-gray-500 italic max-w-xs truncate">{item.remarks}</td>
                                        </tr>
                                    ))}
                                    {pendingLoans.length === 0 && (
                                        <tr>
                                            <td colSpan={10} className="p-8 text-center text-gray-500">
                                                No pending loans found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Cards - Pending */}
                    <div className="md:hidden grid grid-cols-1 gap-4">
                        {pendingLoans.map((item) => (
                            <div key={item.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                            <Building size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">{item.loanName}</h3>
                                            <p className="text-xs text-gray-500 mt-0.5">{item.bankName} • {item.sn}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleActionClick(item)}
                                        className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                                    >
                                        Request
                                    </button>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Amount:</span>
                                        <span className="font-bold text-gray-900">{formatCurrency(item.amount)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>EMI:</span>
                                        <span className="font-bold text-indigo-600">{formatCurrency(item.emi)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Loan Start Date:</span>
                                        <span className="font-medium text-gray-900">{formatDate(item.startDate)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Loan End Date:</span>
                                        <span className="font-medium text-gray-900">{formatDate(item.endDate)}</span>
                                    </div>
                                    <div className="pt-2 border-t border-gray-100 flex flex-col gap-2 text-xs text-gray-500">
                                        <div className="flex justify-between">
                                            <span className="font-medium">Provided Document:</span>
                                            <span>{item.providedDocument}</span>
                                        </div>
                                        {item.remarks && (
                                            <div className="flex justify-between">
                                                <span className="font-medium">Remarks:</span>
                                                <span className="italic">{item.remarks}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {pendingLoans.length === 0 && (
                            <div className="bg-white p-8 rounded-xl border border-gray-100 text-center">
                                <p className="text-gray-500">No pending loans found</p>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <>
                    {/* Desktop Table - History */}
                    <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                        <th className="p-4">Serial No.</th>
                                        <th className="p-4">Loan Name</th>
                                        <th className="p-4">Bank Name</th>
                                        <th className="p-4">Amount</th>
                                        <th className="p-4">EMI</th>
                                        <th className="p-4">Loan Start Date</th>
                                        <th className="p-4">Loan End Date</th>
                                        <th className="p-4">Request Date</th>
                                        <th className="p-4">Requester Name</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-gray-50">
                                    {historyLoans.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="p-4 font-medium text-gray-900">{item.sn}</td>
                                            <td className="p-4 font-medium text-gray-900">{item.loanName}</td>
                                            <td className="p-4 text-gray-600">{item.bankName}</td>
                                            <td className="p-4 text-gray-900 font-bold whitespace-nowrap">{formatCurrency(item.amount)}</td>
                                            <td className="p-4 text-gray-600 font-bold whitespace-nowrap">{formatCurrency(item.emi)}</td>
                                            <td className="p-4 text-gray-600 whitespace-nowrap">{formatDate(item.startDate)}</td>
                                            <td className="p-4 text-gray-600 whitespace-nowrap">{formatDate(item.endDate)}</td>
                                            <td className="p-4 text-gray-600">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar size={14} className="text-gray-400" />
                                                    {formatDate(item.requestDate)}
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-600">
                                                <div className="flex items-center gap-1.5">
                                                    <User size={14} className="text-gray-400" />
                                                    {item.requesterName || 'N/A'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {historyLoans.length === 0 && (
                                        <tr>
                                            <td colSpan={9} className="p-8 text-center text-gray-500">
                                                No foreclosure history found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Cards - History */}
                    <div className="md:hidden grid grid-cols-1 gap-4">
                        {historyLoans.map((item) => (
                            <div key={item.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-gray-50 text-gray-600 rounded-xl">
                                            <Clock size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">{item.loanName}</h3>
                                            <p className="text-xs text-gray-500 mt-0.5">{item.bankName} • {item.sn}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Amount:</span>
                                        <span className="font-bold text-gray-900">{formatCurrency(item.amount)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>EMI:</span>
                                        <span className="font-bold text-indigo-600">{formatCurrency(item.emi)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Loan Start Date:</span>
                                        <span className="font-medium text-gray-900">{formatDate(item.startDate)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Loan End Date:</span>
                                        <span className="font-medium text-gray-900">{formatDate(item.endDate)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Requester Name:</span>
                                        <span className="font-medium text-gray-900">{item.requesterName || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Request Date:</span>
                                        <span className="font-medium text-gray-900">{formatDate(item.requestDate)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {historyLoans.length === 0 && (
                            <div className="bg-white p-8 rounded-xl border border-gray-100 text-center">
                                <p className="text-gray-500">No foreclosure history found</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Action Modal */}
            {isModalOpen && selectedLoan && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800">Request Foreclosure</h2>
                            <button
                                onClick={handleCloseModal}
                                className="text-gray-400 hover:text-gray-600"
                                disabled={isSaving}
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            {/* Read Only Fields */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="block text-gray-500 text-xs uppercase font-semibold mb-1">Serial No.</span>
                                    <span className="font-medium text-gray-900">{selectedLoan.sn}</span>
                                </div>
                                <div>
                                    <span className="block text-gray-500 text-xs uppercase font-semibold mb-1">Loan Name</span>
                                    <span className="font-medium text-gray-900">{selectedLoan.loanName}</span>
                                </div>
                                <div>
                                    <span className="block text-gray-500 text-xs uppercase font-semibold mb-1">Bank Name</span>
                                    <span className="font-medium text-gray-900">{selectedLoan.bankName}</span>
                                </div>
                                <div>
                                    <span className="block text-gray-500 text-xs uppercase font-semibold mb-1">Amount</span>
                                    <span className="font-bold text-gray-900">{formatCurrency(selectedLoan.amount)}</span>
                                </div>
                                <div>
                                    <span className="block text-gray-500 text-xs uppercase font-semibold mb-1">EMI</span>
                                    <span className="font-bold text-indigo-600">{formatCurrency(selectedLoan.emi)}</span>
                                </div>
                                <div>
                                    <span className="block text-gray-500 text-xs uppercase font-semibold mb-1">Loan Start Date</span>
                                    <span className="font-medium text-gray-900">{formatDate(selectedLoan.startDate)}</span>
                                </div>
                                <div>
                                    <span className="block text-gray-500 text-xs uppercase font-semibold mb-1">Loan End Date</span>
                                    <span className="font-medium text-gray-900">{formatDate(selectedLoan.endDate)}</span>
                                </div>
                                {selectedLoan.actual1 && selectedLoan.actual1.trim() !== "" && (
                                    <div className="col-span-2">
                                        <span className="block text-gray-500 text-xs uppercase font-semibold mb-1">Actual Payment Date</span>
                                        <span className="font-medium text-gray-900">{formatDate(selectedLoan.actual1)}</span>
                                    </div>
                                )}
                            </div>

                            <hr className="border-gray-100" />

                            {/* Input Fields */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Request Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                                    value={formData.requestDate}
                                    onChange={e => setFormData({ ...formData, requestDate: e.target.value })}
                                    disabled={isSaving}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Requester Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                                    value={formData.requesterName}
                                    onChange={e => setFormData({ ...formData, requesterName: e.target.value })}
                                    disabled={isSaving}
                                    placeholder="Enter requester name"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    disabled={isSaving}
                                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 py-2.5 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        'Submit Request'
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

export default Foreclosure;