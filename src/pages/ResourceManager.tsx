import { useState } from 'react';
import { FileText, CreditCard, LayoutGrid } from 'lucide-react';
import AllDocuments from './document/AllDocuments';
import AllSubscriptions from './subscription/AllSubscriptions';
import useHeaderStore from '../store/headerStore';
import { useEffect } from 'react';

const ResourceManager = () => {
  const [activeTab, setActiveTab] = useState<'documents' | 'subscriptions'>('documents');
  const { setTitle } = useHeaderStore();

  useEffect(() => {
    setTitle('Resource Manager');
  }, [setTitle]);

  return (
    <div className="space-y-6 pb-20">
      {/* Tabs Header */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex gap-2">
        <button
          onClick={() => setActiveTab('documents')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'documents'
              ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          }`}
        >
          <FileText size={18} />
          <span>Documents</span>
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'subscriptions'
              ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          }`}
        >
          <CreditCard size={18} />
          <span>Subscriptions</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === 'documents' ? (
          <div>
            <AllDocuments />
          </div>
        ) : (
             <div>
                <AllSubscriptions />
             </div>
        )}
      </div>
    </div>
  );
};

export default ResourceManager;
