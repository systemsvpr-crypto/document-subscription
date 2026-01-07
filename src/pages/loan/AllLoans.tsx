import { useState, useEffect } from 'react';
import { Plus, Search, Building, FileText } from 'lucide-react';
import useDataStore from '../../store/dataStore';
import useHeaderStore from '../../store/headerStore';
import { fetchLoansFromGoogleSheets } from '../../utils/googleSheetsService';
import { toast } from 'react-hot-toast';
import { formatDate } from '../../utils/dateFormatter';
import AddLoan from './AddLoan';

const AllLoans = () => {
    const { setTitle } = useHeaderStore();
    const { loans, setLoans } = useDataStore();
    const [isLoading, setIsLoading] = useState(true);

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
        setTitle('All Loans');
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
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBank, setFilterBank] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const filteredData = loans.filter(item => {
        const matchesSearch = item.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.loanName.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesBank = filterBank ? item.bankName === filterBank : true;

        return matchesSearch && matchesBank;
    });

    const getFileUrl = (content: string | undefined) => {
        if (!content) return '#';
        if (content.includes('drive.google.com')) {
            const fileId = content.match(/\/file\/d\/([^/]+)/)?.[1] || content.match(/[?&]id=([^&]+)/)?.[1];
            if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`;
        }
        return content;
    };

    return (
        <>
            <div className="space-y-3">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm mt-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                        <p className="mt-4 text-gray-500 font-medium text-sm">Loading loans...</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">All Loans</h1>
                                <p className="text-gray-500 text-sm mt-1">Manage your outstanding loans with ease</p>
                            </div>
                            <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
                                <div className="relative flex-1 sm:min-w-[240px]">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                    <input
                                        type="text"
                                        placeholder="Search loans..."
                                        className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50/50 text-sm shadow-sm"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                <div className="relative">
                                    <select
                                        value={filterBank}
                                        onChange={(e) => setFilterBank(e.target.value)}
                                        className="appearance-none pl-4 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50/50 text-gray-700 text-sm font-medium cursor-pointer hover:bg-gray-100 transition-colors w-full"
                                    >
                                        <option value="">All Banks</option>
                                        {Array.from(new Set(loans.map(l => l.bankName))).filter(Boolean).sort().map(bank => (
                                            <option key={bank} value={bank}>{bank}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setIsAddModalOpen(true)}
                                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg transition-all shadow-md hover:shadow-lg whitespace-nowrap text-sm font-semibold"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Add New Loan</span>
                                </button>
                            </div>
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 h-[calc(100vh-250px)]">
                            <div className="overflow-auto h-full rounded-xl">
                                <table className="w-full text-left border-separate border-spacing-0">
                                    <thead className="sticky top-0 z-20 bg-gray-50">
                                        <tr className="text-xs uppercase text-gray-500 font-bold tracking-wider">
                                            <th className="px-4 py-4 border-b border-gray-100">Serial No.</th>
                                            <th className="px-4 py-4 border-b border-gray-100">Loan Name</th>
                                            <th className="px-4 py-4 border-b border-gray-100">Bank Name</th>
                                            <th className="px-4 py-4 border-b border-gray-100 text-right">Amount</th>
                                            <th className="px-4 py-4 border-b border-gray-100 text-right">EMI</th>
                                            <th className="px-4 py-4 border-b border-gray-100 whitespace-nowrap">Start Date</th>
                                            <th className="px-4 py-4 border-b border-gray-100 whitespace-nowrap">End Date</th>
                                            <th className="px-4 py-4 border-b border-gray-100">Document</th>
                                            <th className="px-4 py-4 border-b border-gray-100 text-right">File</th>
                                            <th className="px-4 py-4 border-b border-gray-100">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm divide-y divide-gray-50">
                                        {filteredData.map((item) => (
                                            <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group/row">
                                                <td className="px-4 py-4 font-mono text-xs font-semibold text-indigo-600">{item.sn}</td>
                                                <td className="px-4 py-4 font-semibold text-gray-900">{item.loanName}</td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-2 text-gray-700">
                                                        <div className="p-1 bg-indigo-50 rounded">
                                                            <Building size={14} className="text-indigo-600" />
                                                        </div>
                                                        {item.bankName}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-right font-bold text-gray-900 whitespace-nowrap">{formatCurrency(item.amount)}</td>
                                                <td className="px-4 py-4 text-right text-gray-600 font-bold whitespace-nowrap">{formatCurrency(item.emi)}</td>
                                                <td className="px-4 py-4 text-gray-500 text-xs whitespace-nowrap">{formatDate(item.startDate)}</td>
                                                <td className="px-4 py-4 text-gray-500 text-xs whitespace-nowrap">{formatDate(item.endDate)}</td>
                                                <td className="px-4 py-4 text-gray-600 text-xs">{item.providedDocument}</td>
                                                <td className="px-4 py-4 text-right">
                                                    {item.file ? (
                                                        <div className="group relative inline-block text-left">
                                                            <a
                                                                href={getFileUrl(item.fileContent)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all duration-200 shadow-sm"
                                                                title={item.file}
                                                            >
                                                                <FileText size={16} />
                                                                <span className="text-[11px] font-bold truncate max-w-[80px] hidden xl:inline">View</span>
                                                            </a>
                                                            {item.fileContent && (
                                                                <div className="absolute right-0 top-full mt-2 hidden group-hover:block z-[100] w-72 h-80 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
                                                                    {item.fileContent.startsWith('data:image') ? (
                                                                        <img src={item.fileContent} className="w-full h-full object-contain bg-gray-50 p-2" alt="Preview" />
                                                                    ) : (
                                                                        <iframe
                                                                            src={getFileUrl(item.fileContent)}
                                                                            className="w-full h-full border-none"
                                                                            title="Preview"
                                                                        />
                                                                    )}
                                                                    <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/90 backdrop-blur-sm px-3 py-1.5 text-[10px] text-white font-medium truncate">
                                                                        Preview: {item.file}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 font-mono">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-gray-500 italic text-xs max-w-[150px] truncate">{item.remarks}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden grid grid-cols-1 gap-4">
                            {filteredData.map((item) => (
                                <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
                                    <div className="flex justify-between items-start mb-5">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shadow-inner">
                                                <Building size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 text-lg leading-tight">{item.loanName}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{item.sn}</span>
                                                    <span className="text-xs text-gray-500 font-medium">{item.bankName}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-100 uppercase tracking-tight">
                                                Active
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-5 p-4 bg-gray-50/50 rounded-xl border border-gray-50">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Amount</span>
                                            <p className="font-bold text-gray-900 text-base">{formatCurrency(item.amount)}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">EMI</span>
                                            <p className="font-bold text-indigo-600 text-base">{formatCurrency(item.emi)}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Start Date</span>
                                            <p className="text-xs font-semibold text-gray-700">{formatDate(item.startDate)}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">End Date</span>
                                            <p className="text-xs font-semibold text-gray-700">{formatDate(item.endDate)}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-4 border-t border-gray-100">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-500 font-medium whitespace-nowrap mr-4">Provided Doc:</span>
                                            <span className="text-xs font-bold text-gray-700 text-right">{item.providedDocument}</span>
                                        </div>
                                        {item.file && (
                                            <div className="flex justify-between items-center bg-indigo-50/50 p-3 rounded-xl border border-indigo-50">
                                                <span className="text-xs text-gray-500 font-medium">Document File</span>
                                                <div className="group relative">
                                                    <a
                                                        href={getFileUrl(item.fileContent)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-800 transition-colors text-xs"
                                                    >
                                                        <FileText size={16} />
                                                        <span>View File</span>
                                                    </a>
                                                    {item.fileContent && (
                                                        <div className="absolute bottom-full right-0 mb-3 hidden group-hover:block z-[100] w-64 h-72 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200 ring-4 ring-indigo-50">
                                                            {item.fileContent.startsWith('data:image') ? (
                                                                <img src={item.fileContent} className="w-full h-full object-contain bg-gray-50 p-2" alt="Preview" />
                                                            ) : (
                                                                <iframe
                                                                    src={getFileUrl(item.fileContent)}
                                                                    className="w-full h-full border-none"
                                                                    title="Preview"
                                                                />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {item.remarks && (
                                            <div className="mt-3 p-3 bg-amber-50/30 rounded-lg border border-amber-50">
                                                <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block mb-1">Remarks</span>
                                                <p className="text-xs text-gray-600 italic leading-relaxed">{item.remarks}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {filteredData.length === 0 && (
                                <div className="text-center p-8 text-gray-500 bg-white rounded-xl border border-dashed border-gray-200">
                                    No loans found
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
            <AddLoan isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
        </>
    );
};

export default AllLoans;
