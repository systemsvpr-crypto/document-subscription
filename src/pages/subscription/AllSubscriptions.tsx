import { useState, useEffect, useDeferredValue, useMemo } from 'react';
import { Plus, Search, CreditCard, Loader, RefreshCw } from 'lucide-react';
import useHeaderStore from '../../store/headerStore';
import AddSubscription from './AddSubscription';
import useDataStore from '../../store/dataStore';
import { syncSubscriptions } from '../../utils/subscriptionSync';

const AllSubscriptions = () => {
  const { setTitle } = useHeaderStore();
  const { subscriptions, setSubscriptions } = useDataStore();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [filterFrequency, setFilterFrequency] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptionsFromGoogleSheets = async () => {
    if (loading) return;
    try {
      setLoading(true);
      setError(null);
      const data = await syncSubscriptions();
      setSubscriptions(data);
    } catch (error) {
      console.error('Fetch Error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTitle('All Subscriptions');
    if (subscriptions.length === 0) {
      fetchSubscriptionsFromGoogleSheets();
    }
  }, [setTitle]);

  const handleRefresh = () => {
    fetchSubscriptionsFromGoogleSheets();
  };

  const handleAddSuccess = () => {
    fetchSubscriptionsFromGoogleSheets();
  };

  const filteredData = useMemo(() => {
    return subscriptions.filter(item => {
      const matchesSearch = (item.subscriptionName || '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (item.companyName || '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (item.subscriberName || '').toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (item.sn || '').toLowerCase().includes(deferredSearch.toLowerCase());

      const matchesfreq = filterFrequency ? item.frequency === filterFrequency : true;

      return matchesSearch && matchesfreq;
    }).sort((a, b) => {
      const getSn = (s: string) => {
        const match = (s || '').match(/SN-?(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      };
      return getSn(a.sn) - getSn(b.sn);
    });
  }, [subscriptions, deferredSearch, filterFrequency]);

  if (loading && subscriptions.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader className="h-8 w-8 text-indigo-600 animate-spin" />
          <p className="text-gray-600">Loading subscriptions from Google Sheets...</p>
        </div>
      </div>
    );
  }

  if (error && subscriptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="text-red-600 font-medium mb-2">Error Loading Data</div>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 rounded-xl shadow-input">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">All Subscriptions</h1>
            <p className="text-gray-500 text-sm mt-1">
              Track your recurring payments from Google Sheets
              {subscriptions.length > 0 && (
                <span className="ml-2 text-xs text-green-600">
                  ({subscriptions.length} records)
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search by SN, Company, Subscriber..."
                className="pl-10 pr-4 py-2.5 w-full shadow-input border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
              <select
                value={filterFrequency}
                onChange={(e) => setFilterFrequency(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2.5 shadow-input border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-700 text-sm font-medium cursor-pointer hover:bg-gray-100 transition-colors w-full sm:w-auto"
              >
                <option value="">All Frequencies</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
                <option value="Weekly">Weekly</option>
                <option value="Daily">Daily</option>
                <option value="One-time">One-time</option>
                {Array.from(new Set(subscriptions.map(s => s.frequency)))
                  .filter(freq => freq && freq !== 'N/A' && !['Monthly', 'Quarterly', 'Yearly', 'Weekly', 'Daily', 'One-time'].includes(freq))
                  .sort()
                  .map(freq => (
                    <option key={freq} value={freq}>{freq}</option>
                  ))}
              </select>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg transition-all shadow-sm hover:shadow whitespace-nowrap disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg whitespace-nowrap"
            >
              <Plus className="h-5 w-5" />
              <span className="hidden sm:inline">Add New</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:flex flex-col bg-white rounded-xl shadow-input overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider whitespace-nowrap">
                  <th className="px-3 py-2">Serial No</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Company Name</th>
                  <th className="px-3 py-2">Subscriber Name</th>
                  <th className="px-3 py-2">Subscription Name</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Frequency</th>
                  <th className="px-3 py-2">Purpose</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-50">
                {filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-3 py-2 font-bold text-indigo-600 text-xs font-mono">{item.sn}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${item.status === 'Paid' ? 'bg-green-50 text-green-700 border-green-100' :
                        item.status === 'Approved' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          item.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                            'bg-gray-50 text-gray-600 border-gray-100'
                        }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{item.requestedDate}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{item.companyName}</td>
                    <td className="px-3 py-2 text-gray-700">{item.subscriberName}</td>
                    <td className="px-3 py-2 font-medium text-indigo-600">{item.subscriptionName}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{item.price}</td>
                    <td className="px-3 py-2 text-gray-600">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                        {item.frequency}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 max-w-xs truncate" title={item.purpose}>{item.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredData.length === 0 && !loading && (
              <div className="p-8 text-center text-gray-500">
                <Search className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <p>No results found</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden flex flex-col gap-4">
          {filteredData.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-xl shadow-input space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex gap-3 items-start">
                  <div className="h-10 w-10 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg shrink-0 mt-0.5">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shadow-input border-none">{item.sn}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${item.status === 'Paid' ? 'bg-green-50 text-green-700 border-green-100' :
                        item.status === 'Approved' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          item.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                            'bg-gray-50 text-gray-600 border-gray-100'
                        }`}>
                        {item.status}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 leading-tight">{item.subscriptionName}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 font-medium">{item.companyName}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <AddSubscription
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />
    </>
  );
};

export default AllSubscriptions;