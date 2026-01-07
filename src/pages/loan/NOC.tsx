import { useState, useEffect } from 'react';
import { Search, Clock, X, FileCheck } from 'lucide-react';
import useDataStore from '../../store/dataStore';
import useHeaderStore from '../../store/headerStore';
import { fetchLoansFromGoogleSheets, updateGoogleSheetCellsBySn } from '../../utils/googleSheetsService';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { formatDate } from '../../utils/dateFormatter';

const LoanNOC = () => {
    const { setTitle } = useHeaderStore();
    const { loans, updateLoan, setLoans } = useDataStore();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setTitle('Collect NOC');
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
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState<any | null>(null);
    const [collectNoc, setCollectNoc] = useState('Yes');

    // Pending: Planned 2 is Set AND Actual 2 is Empty
    const pendingLoans = loans.filter(loan =>
        (loan.planned2 && loan.planned2.trim() !== "") &&
        (!loan.actual2 || loan.actual2.trim() === "") &&
        (
            loan.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.loanName.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    // History: Planned 2 is Set AND Actual 2 is Set
    const historyLoans = loans.filter(loan =>
        (loan.planned2 && loan.planned2.trim() !== "") &&
        (loan.actual2 && loan.actual2.trim() !== "") &&
        (
            loan.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.loanName.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const [isSaving, setIsSaving] = useState(false);

    const [nocDate, setNocDate] = useState('');

    const handleActionClick = (loan: any) => {
        setSelectedLoan(loan);
        setCollectNoc(loan.collectNocStatus || 'Yes');
        // Initialize NOC Date with existing Actual 2 or Today
        const existingDate = loan.actual2 
            ? loan.actual2.split('/').reverse().join('-') 
            : new Date().toISOString().split('T')[0];
        setNocDate(existingDate);
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
            const formattedDate = nocDate.split('-').reverse().join('/');
            
            // Update column T (20) for Collect NOC Status and R (18) for Actual 2
            await updateGoogleSheetCellsBySn('Loan', selectedLoan.sn, [
                {
                    column: 18, // Column R: Actual 2
                    value: formattedDate
                },
                {
                    column: 20, // Column T: Collect NOC Status
                    value: collectNoc
                }
            ]);

            // Update local state
            updateLoan(selectedLoan.id, {
                collectNocStatus: collectNoc as 'Yes' | 'No',
                actual2: formattedDate
            });

            toast.success('NOC status and date updated successfully');
            setIsModalOpen(false);
            setSelectedLoan(null);
        } catch (error: any) {
            console.error('Error saving NOC status:', error);
            toast.error(error.message || 'Failed to save to Google Sheets');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Unified Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Collect NOC</h1>
                    <p className="text-gray-500 text-sm mt-1">Track NOC collection status</p>
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
                    <p className="mt-4 text-gray-500 font-medium text-sm">Loading NOC data...</p>
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
                                        <th className="p-4">Loan Start Date</th>
                                        <th className="p-4">Loan End Date</th>
                                        <th className="p-4">Closer Request Date</th>
                                        <th className="p-4">Collect NOC</th>
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
                                                    Action
                                                </button>
                                            </td>
                                            <td className="p-4 font-medium text-gray-900">{item.sn}</td>
                                            <td className="p-4 font-medium text-gray-900">{item.loanName}</td>
                                            <td className="p-4 text-gray-600">{item.bankName}</td>
                                            <td className="p-4 text-gray-600">{formatDate(item.startDate)}</td>
                                            <td className="p-4 text-gray-600">{formatDate(item.endDate)}</td>
                                            <td className="p-4 text-gray-600">{formatDate(item.requestDate)}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.collectNocStatus === 'Yes'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {item.collectNocStatus || 'Pending'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {pendingLoans.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-gray-500">No pending NOC collections</td>
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
                                            <FileCheck size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">{item.loanName}</h3>
                                            <p className="text-xs text-gray-500 mt-0.5">{item.bankName}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleActionClick(item)}
                                        className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                                    >
                                        Action
                                    </button>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Loan Start Date:</span>
                                        <span className="font-medium text-gray-900">{formatDate(item.startDate)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Loan End Date:</span>
                                        <span className="font-medium text-gray-900">{formatDate(item.endDate)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Closer Request Date:</span>
                                        <span className="font-medium text-gray-900">{formatDate(item.requestDate)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Collect NOC:</span>
                                        <span className={`font-medium ${item.collectNocStatus === 'Yes' ? 'text-green-600' : 'text-red-600'
                                            }`}>{item.collectNocStatus || 'Pending'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
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
                                        <th className="p-4">Loan Start Date</th>
                                        <th className="p-4">Loan End Date</th>
                                        <th className="p-4">Closer Request Date</th>
                                        <th className="p-4">Actual 2 Date</th>
                                        <th className="p-4">Collect NOC</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-gray-50">
                                    {historyLoans.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="p-4 font-medium text-gray-900">{item.sn}</td>
                                            <td className="p-4 font-medium text-gray-900">{item.loanName}</td>
                                            <td className="p-4 text-gray-600">{item.bankName}</td>
                                            <td className="p-4 text-gray-600">{formatDate(item.startDate)}</td>
                                            <td className="p-4 text-gray-600">{formatDate(item.endDate)}</td>
                                            <td className="p-4 text-gray-600">{formatDate(item.requestDate)}</td>
                                            <td className="p-4 text-gray-600">{formatDate(item.actual2)}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.collectNocStatus === 'Yes'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {item.collectNocStatus}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {historyLoans.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-gray-500">No NOC history found</td>
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
                                            <p className="text-xs text-gray-500 mt-0.5">{item.bankName}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${item.collectNocStatus === 'Yes'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                        }`}>
                                        NOC: {item.collectNocStatus}
                                    </span>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Loan Start Date:</span>
                                        <span className="font-medium text-gray-900">{formatDate(item.startDate)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Loan End Date:</span>
                                        <span className="font-medium text-gray-900">{formatDate(item.endDate)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Closer Request Date:</span>
                                        <span className="font-medium text-gray-900">{formatDate(item.requestDate)}</span>
                                    </div>
                                     <div className="flex justify-between text-gray-600">
                                        <span>Actual 2 Date:</span>
                                        <span className="font-medium text-gray-900">{formatDate(item.actual2)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Action Modal */}
            {isModalOpen && selectedLoan && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800">Collect NOC</h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
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
                                    <span className="block text-gray-500">Serial No.</span>
                                    <span className="font-medium text-gray-900">{selectedLoan.sn}</span>
                                </div>
                                <div>
                                    <span className="block text-gray-500">Loan Name</span>
                                    <span className="font-medium text-gray-900">{selectedLoan.loanName}</span>
                                </div>
                                <div>
                                    <span className="block text-gray-500">Bank Name</span>
                                    <span className="font-medium text-gray-900">{selectedLoan.bankName}</span>
                                </div>
                                <div>
                                    <span className="block text-gray-500">Loan Start Date</span>
                                    <span className="font-medium text-gray-900">{formatDate(selectedLoan.startDate)}</span>
                                </div>
                                <div>
                                    <span className="block text-gray-500">Loan End Date</span>
                                    <span className="font-medium text-gray-900">{formatDate(selectedLoan.endDate)}</span>
                                </div>
                                <div>
                                    <span className="block text-gray-500">Closer Request Date</span>
                                    <span className="font-medium text-gray-900">{formatDate(selectedLoan.requestDate)}</span>
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">NOC Collected Date</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    value={nocDate}
                                    onChange={e => setNocDate(e.target.value)}
                                    disabled={isSaving}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Collect NOC</label>
                                <select
                                    className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    value={collectNoc}
                                    onChange={e => setCollectNoc(e.target.value)}
                                    disabled={isSaving}
                                >
                                    <option value="Yes">Yes</option>
                                    <option value="No">No</option>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={isSaving}
                                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 py-2.5 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-md disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        'Save'
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

export default LoanNOC;
