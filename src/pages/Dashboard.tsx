import { useEffect, useState } from 'react';
import {
    FileText,
    CreditCard,
    Banknote,
    CheckCircle,
    FileCheck,
    RotateCcw,
    X
} from 'lucide-react';
import useDataStore from '../store/dataStore';
import useHeaderStore from '../store/headerStore';
import { fetchDocumentsFromGoogleSheets, fetchLoansFromGoogleSheets } from '../utils/googleSheetsService';
import { syncSubscriptions } from '../utils/subscriptionSync';
import { useNavigate } from 'react-router-dom';
import {
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';


const StatCard = ({ title, value, icon: Icon, color, subtext, onClick, bgColor = "bg-white" }: any) => (
    <div
        onClick={onClick}
        className={`${bgColor} p-5 sm:p-6 rounded-2xl shadow-input hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden`}
    >
        <div className="relative z-10 flex justify-between items-start">
            <div>
                <p className="text-gray-500 text-sm font-semibold tracking-wide uppercase">{title}</p>
                <h3 className="text-3xl font-extrabold text-gray-900 mt-2 tracking-tight group-hover:text-indigo-600 transition-colors">{value}</h3>
                {subtext && <p className="text-xs text-gray-400 mt-2 font-medium">{subtext}</p>}
            </div>
            <div className={`p-3 rounded-xl ${color} bg-opacity-10 group-hover:bg-opacity-20 transition-all`}>
                <Icon size={24} className={color.replace('bg-', 'text-')} />
            </div>
        </div>
    </div>
);

const Dashboard = () => {
    const { setTitle } = useHeaderStore();
    const { documents, subscriptions, loans, setDocuments, setLoans, setSubscriptions } = useDataStore();
    const navigate = useNavigate();
    const [selectedStat, setSelectedStat] = useState<{ type: string, title: string, data: { label: string, count: number }[], link: string } | null>(null);

    useEffect(() => {
        setTitle('Overview');
        const loadData = async () => {
             // Fetch Documents
             try {
                const docs = await fetchDocumentsFromGoogleSheets();
                setDocuments(docs);
             } catch (err) {
                console.error("Error fetching docs", err);
             }
             
             // Fetch Loans
             try {
                const loansData = await fetchLoansFromGoogleSheets();
                setLoans(loansData);
             } catch (err) {
                 console.error("Error fetching loans", err);
             }

             // Fetch Subscriptions
             try {
                 const subsData = await syncSubscriptions();
                 setSubscriptions(subsData);
             } catch (err) {
                 console.error("Error fetching subs", err);
             }
        };
        loadData();
    }, [setTitle, setDocuments, setLoans, setSubscriptions]);

    // --- Metrics Calculation ---
    const totalDocuments = documents.filter(doc => doc.sn && doc.sn.trim().length > 0).length;
    const totalSubscriptions = subscriptions.filter(sub => sub.sn && sub.sn.trim().length > 0).length;
    const totalLoans = loans.length;

    const totalRenewals = documents.filter(doc => (doc.planned1 && doc.planned1.trim() !== '') && (!doc.actual1 || doc.actual1.trim() === '')).length;
    const pendingApprovals = subscriptions.filter(sub => (sub.planned2 && sub.planned2.trim() !== '') && (!sub.actual2 || sub.actual2.trim() === '')).length;
    const nocCompleted = loans.filter(l => (l.planned2 && l.planned2.trim() !== '') && (l.actual2 && l.actual2.trim() !== '')).length;

    const monthlySubscriptionCost = subscriptions.reduce((acc, sub) => {
        let price = parseFloat(String(sub.price || 0).replace(/[^\d.]/g, '')) || 0;
        if (sub.frequency === 'Yearly') price = price / 12;
        if (sub.frequency === 'Quarterly') price = price / 3;
        if (sub.frequency === 'Half-Yearly' || sub.frequency === '6 Months') price = price / 6;
        return acc + price;
    }, 0);

    // --- Aggregation Logic ---
    const getDocumentStats = () => {
        const counts: Record<string, number> = {};
        documents.forEach(doc => {
            const key = doc.category || 'Uncategorized';
            counts[key] = (counts[key] || 0) + 1;
        });
        return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    };

    const getSubscriptionStats = () => {
        const counts: Record<string, number> = {};
        subscriptions
            .filter(sub => sub.sn && sub.sn.trim().length > 0)
            .forEach(sub => {
                const key = sub.frequency || 'Unknown';
                counts[key] = (counts[key] || 0) + 1;
            });
        return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    };

    const getPendingApprovalStats = () => {
        const counts: Record<string, number> = {};
        subscriptions
           .filter(sub => (sub.planned2 && sub.planned2.trim() !== '') && (!sub.actual2 || sub.actual2.trim() === ''))
            .forEach(sub => {
                const key = sub.frequency || 'Unknown';
                counts[key] = (counts[key] || 0) + 1;
            });
        return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    };

    const getLoanStats = () => {
        const counts: Record<string, number> = {};
        loans.forEach(loan => {
            const key = loan.bankName || 'Unknown Bank';
            counts[key] = (counts[key] || 0) + 1;
        });
        return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    };

    const getRenewalStats = () => {
        const counts: Record<string, number> = {};
        documents
            .filter(doc => (doc.planned1 && doc.planned1.trim() !== '') && (!doc.actual1 || doc.actual1.trim() === ''))
            .forEach(doc => {
                const key = doc.category || 'Uncategorized';
                counts[key] = (counts[key] || 0) + 1;
            });
        return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    };



    const getNocStats = () => {
        const counts: Record<string, number> = {};
        loans.filter(l => (l.planned2 && l.planned2.trim() !== '') && (l.actual2 && l.actual2.trim() !== '')).forEach(loan => {
            const key = loan.bankName || 'Unknown Bank';
            counts[key] = (counts[key] || 0) + 1;
        });
        return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    };

    const handleStatClick = (type: string, title?: string, data?: any[], link?: string) => {
        if (title && data && link) {
            setSelectedStat({ type, title, data, link });
            return;
        }

        if (type === 'documents') {
            setSelectedStat({ type: 'documents', title: 'Documents by Category', data: getDocumentStats(), link: '/document/all' });
        } else if (type === 'subscriptions') {
            setSelectedStat({ type: 'subscriptions', title: 'Subscriptions by Frequency', data: getSubscriptionStats(), link: '/subscription/all' });
        } else if (type === 'loans') {
            setSelectedStat({ type: 'loans', title: 'Loans by Bank', data: getLoanStats(), link: '/loan/all' });
        } else if (type === 'renewals') {
            setSelectedStat({ type: 'renewals', title: 'Pending Renewals by Category', data: getRenewalStats(), link: '/document/renewal' });
        } else if (type === 'approvals' || type === 'approval') {
            setSelectedStat({ type: 'approvals', title: 'Pending Approvals by Frequency', data: getPendingApprovalStats(), link: '/subscription/approval' });
        } else if (type === 'noc') {
            setSelectedStat({ type: 'noc', title: 'NOC Completed by Bank', data: getNocStats(), link: '/loan/noc' });
        }
    };

    // --- Data for Charts ---

    // 1. Subscription Status Breakdown
    // --- Data for Charts ---

    // 1. Subscription Status Breakdown
    // Logic: 
    // Renewal = Planned1 (!null) + Actual1 (null)
    // Active = Total (SN !null) - Renewal
    const subTotal = subscriptions.filter(s => s.sn && s.sn.trim()).length;
    const subRenewalCount = subscriptions.filter(s => (s.planned1 && s.planned1.trim() !== '') && (!s.actual1 || s.actual1.trim() === '')).length;
    const subActiveCount = Math.max(0, subTotal - subRenewalCount);

    const subscriptionStatusData = [
        { name: 'Active', value: subActiveCount, color: '#10B981' }, // Emerald
        { name: 'Renewal', value: subRenewalCount, color: '#F59E0B' }, // Amber
    ].filter(d => d.value > 0);

    // 2. Document Status Breakdown
    // Logic:
    // Expiring = Planned1 (!null) + Actual1 (null) -- Using 'Expiring' as label for this pending state
    // Active = Column J (Status) Not Null. (Chart Active = TotalWithStatus - Expiring)
    const docExpiringCount = documents.filter(d => (d.planned1 && d.planned1.trim() !== '') && (!d.actual1 || d.actual1.trim() === '')).length;
    const docWithStatusCount = documents.filter(d => d.status && d.status.trim() !== '').length;
    const docActiveCount = Math.max(0, docWithStatusCount - docExpiringCount);

    const documentStatusData = [
        { name: 'Active', value: docActiveCount, color: '#3B82F6' }, // Blue
        { name: 'Expiring', value: docExpiringCount, color: '#F97316' }, // Orange
    ].filter(d => d.value > 0);

    // 3. Loan Status Breakdown
    // Logic:
    // Closed = Planned2 (!null) + Actual2 (!null)
    // Active = Total (SN !null) - Closed
    const loanTotal = loans.filter(l => l.sn && l.sn.trim()).length;
    const loanClosedCount = loans.filter(l => (l.planned2 && l.planned2.trim() !== '') && (l.actual2 && l.actual2.trim() !== '')).length;
    const loanActiveCount = Math.max(0, loanTotal - loanClosedCount);

    const loanStatusData = [
        { name: 'Active', value: loanActiveCount, color: '#8B5CF6' }, // Violet
        { name: 'Closed', value: loanClosedCount, color: '#6B7280' }, // Gray
    ].filter(d => d.value > 0);




    return (
        <div className="space-y-8 pb-10 relative">

            {/* Modal Overlay */}
            {selectedStat && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animation-fade-in" onClick={() => setSelectedStat(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animation-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-800">{selectedStat.title}</h3>
                            <button onClick={() => setSelectedStat(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-0 max-h-[60vh] overflow-y-auto">
                            {selectedStat.data.length > 0 ? (
                                <div className="divide-y divide-gray-100">
                                    {selectedStat.data.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-4 hover:bg-gray-50 transition-colors">
                                            <span className="font-medium text-gray-700">{item.label}</span>
                                            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold">{item.count}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-400">No data available</div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => navigate(selectedStat.link)}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                View Full List
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Primary Stats: Totals */}
            <div>
                <h2 className="text-lg font-bold text-gray-800 mb-4 px-1">Resource Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard
                        title="Total Documents"
                        value={totalDocuments}
                        icon={FileText}
                        color="bg-blue-500 text-blue-600"
                        subtext="All stored records"
                        onClick={() => handleStatClick('documents')}
                    />
                    <StatCard
                        title="Total Subscriptions"
                        value={totalSubscriptions}
                        icon={CreditCard}
                        color="bg-purple-500 text-purple-600"
                        subtext={`${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(monthlySubscriptionCost)} / mo estimated`}
                        onClick={() => handleStatClick('subscriptions')}
                    />
                    <StatCard
                        title="Total Loans"
                        value={totalLoans}
                        icon={Banknote}
                        color="bg-emerald-500 text-emerald-600"
                        subtext="Active financial records"
                        onClick={() => handleStatClick('loans')}
                    />
                </div>
            </div>

            {/* Secondary Stats: Action Items */}
            <div>
                <h2 className="text-lg font-bold text-gray-800 mb-4 px-1">Action Items & Status</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard
                        title="Renewals Pending"
                        value={totalRenewals}
                        icon={RotateCcw}
                        color="bg-orange-500 text-orange-600"
                        subtext="Documents expiring soon"
                        onClick={() => handleStatClick('renewals')}
                    />
                    <StatCard
                        title="Pending Approvals"
                        value={pendingApprovals}
                        icon={CheckCircle}
                        color="bg-indigo-500 text-indigo-600"
                        subtext="Subscriptions waiting approval"
                        onClick={() => handleStatClick('approval', 'Pending Approvals', getPendingApprovalStats(), '/subscription/approval')}
                    />
                    <StatCard
                        title="NOC Completed"
                        value={nocCompleted}
                        icon={FileCheck}
                        color="bg-teal-500 text-teal-600"
                        subtext="Loans with NOC collected"
                        onClick={() => handleStatClick('noc')}
                    />
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* 1. Subscription Breakdown Chart */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-input flex flex-col items-center">
                    <h3 className="font-bold text-base text-gray-800 mb-2 w-full text-left">Subscriptions</h3>
                    <p className="text-xs text-gray-500 mb-4 w-full text-left">By status</p>
                    <div className="h-[200px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={subscriptionStatusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {subscriptionStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '12px' }} itemStyle={{ color: '#374151', fontSize: '12px', fontWeight: 600 }} />
                                <Legend verticalAlign="bottom" iconSize={8} formatter={(val) => <span className="text-xs text-gray-600">{val}</span>} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                            <span className="text-2xl font-bold text-gray-700">{totalSubscriptions}</span>
                        </div>
                    </div>
                </div>

                {/* 2. Document Status Chart */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-input flex flex-col items-center">
                    <h3 className="font-bold text-base text-gray-800 mb-2 w-full text-left">Documents</h3>
                    <p className="text-xs text-gray-500 mb-4 w-full text-left">By renewal status</p>
                    <div className="h-[200px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={documentStatusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {documentStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '12px' }} itemStyle={{ color: '#374151', fontSize: '12px', fontWeight: 600 }} />
                                <Legend verticalAlign="bottom" iconSize={8} formatter={(val) => <span className="text-xs text-gray-600">{val}</span>} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                            <span className="text-2xl font-bold text-gray-700">{totalDocuments}</span>
                        </div>
                    </div>
                </div>

                {/* 3. Loan Status Chart */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-input flex flex-col items-center">
                    <h3 className="font-bold text-base text-gray-800 mb-2 w-full text-left">Loans</h3>
                    <p className="text-xs text-gray-500 mb-4 w-full text-left">By active status</p>
                    <div className="h-[200px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={loanStatusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {loanStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '12px' }} itemStyle={{ color: '#374151', fontSize: '12px', fontWeight: 600 }} />
                                <Legend verticalAlign="bottom" iconSize={8} formatter={(val) => <span className="text-xs text-gray-600">{val}</span>} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                            <span className="text-2xl font-bold text-gray-700">{totalLoans}</span>
                        </div>
                    </div>
                </div>
            </div>


        </div>
    );
};
export default Dashboard;
