import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { X, Save, Loader } from 'lucide-react';
import { submitToGoogleSheets } from '../../utils/googleSheetsService';

interface AddSubscriptionProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void; // Callback to refresh data after successful submission
}

interface SubscriptionFormData {
    companyName: string;
    subscriberName: string;
    subscriptionName: string;
    price: string;
    frequency: string;
    purpose: string;
}

const AddSubscription: React.FC<AddSubscriptionProps> = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState<SubscriptionFormData>({
    companyName: '',
    subscriberName: '',
    subscriptionName: '',
    price: '',
    frequency: '',
    purpose: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [nextSN, setNextSN] = useState('SN-001');

  // Fetch the next available SN when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchNextAvailableSN();
    }
  }, [isOpen]);

  const fetchNextAvailableSN = async () => {
    try {
      const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || "";
      
      if (!GOOGLE_SCRIPT_URL) {
        throw new Error("Google Script URL is not defined");
      }

      const url = new URL(GOOGLE_SCRIPT_URL);
      url.searchParams.set("sheet", "Subscription");
      url.searchParams.set("_t", new Date().getTime().toString());

      const res = await fetch(url.toString(), {
        method: "GET",
        mode: "cors",
      });

      if (!res.ok) {
        setNextSN('SN-001');
        return;
      }

      const json = await res.json();

      if (!json || json.success !== true || !Array.isArray(json.data)) {
        setNextSN('SN-001');
        return;
      }

      // Robust SN detection: Iterate all rows, look for SN-XXX pattern in Column B (index 1)
      const existingSNs = json.data
        .map((row: any[]) => {
            if (!row || row.length < 2) return null;
            const val = (row[1] || '').toString().trim();
            // Match SN-123 or SN123
            const match = val.match(/SN-?(\d+)/i);
            return match ? parseInt(match[1]) : 0;
        })
        .filter((num: number) => num > 0);

      // Find the highest SN number
      const maxSN = existingSNs.length > 0 ? Math.max(...existingSNs) : 0;
      
      // Generate next SN
      const nextSNNumber = maxSN + 1;
      const formattedSN = `SN-${String(nextSNNumber).padStart(3, '0')}`;
      
      setNextSN(formattedSN);
    } catch (error) {
      console.error('Error fetching next SN:', error);
      setNextSN('SN-001');
    }
  };

  if (!isOpen) return null;

  const getCurrentTimestamp = (): string => {
    const now = new Date();
    // Format: YYYY-MM-DD HH:mm (e.g., 2026-01-05 08:25)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0'); // 24-hour format
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const validateForm = (): boolean => {
    if (!formData.companyName.trim()) {
      toast.error('Company Name is required');
      return false;
    }
    if (!formData.subscriberName.trim()) {
      toast.error('Subscriber Name is required');
      return false;
    }
    if (!formData.subscriptionName.trim()) {
      toast.error('Subscription Name is required');
      return false;
    }
    if (!formData.price.trim()) {
      toast.error('Price is required');
      return false;
    }
    if (!formData.frequency.trim()) {
      toast.error('Frequency is required');
      return false;
    }
    if (!formData.purpose.trim()) {
      toast.error('Purpose is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading(
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
           <span className="font-bold">Submitting to Google Sheets...</span>
        </div>
        <div className="text-xs opacity-90">
           Sheet: Subscription<br/>
           Serial Number: {nextSN}
        </div>
      </div>
    );

    try {
      const timestamp = getCurrentTimestamp();
      const sn = nextSN; // Use the calculated SN

      // Prepare data for Google Sheets as an ARRAY in the correct order
      const rowData = [
        timestamp,                 // A: Timestamp
        sn,                        // B: SN No (formatted as SN-001, SN-002, etc.)
        formData.companyName,      // C: Company Name
        formData.subscriberName,   // D: Subscriber Name
        formData.subscriptionName, // E: Subscription Name
        formData.price,            // F: Price
        formData.frequency,        // G: Frequency (Column 7)
        formData.purpose           // H: Purpose
      ];

      console.log('Submitting to Google Sheets:', {
        sheetName: 'Subscription',
        rowData: rowData,
        nextSN: sn
      });

      // Submit to Google Sheets ONLY - NO localStorage
      const result = await submitToGoogleSheets({
        action: "insert",
        sheetName: "Subscription",
        data: rowData // Array, not object
      });

      console.log('Google Sheets response:', result);

      if (result.success) {
        toast.success(`Subscription ${sn} added successfully!`, { id: toastId });
        
        // Reset form
        setFormData({ 
          companyName: '', 
          subscriberName: '', 
          subscriptionName: '', 
          price: '', 
          frequency: '', 
          purpose: '' 
        });
        
        // Fetch next SN for next entry
        fetchNextAvailableSN();
        
        // Call onSuccess callback to refresh data
        if (onSuccess) {
          onSuccess();
        }
        
        // Close modal after a short delay
        setTimeout(() => {
          onClose();
        }, 1000);
        
      } else {
        throw new Error(result.error || 'Failed to save to Google Sheets');
      }
    } catch (error) {
      console.error('Error submitting to Google Sheets:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add subscription', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-input my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-800">Add Subscription</h2>
            <button 
                onClick={handleClose}
                disabled={submitting}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <X size={24} />
            </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8">
            <form id="add-sub-form" onSubmit={handleSubmit} className="space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="companyName"
                      required
                      disabled={submitting}
                      className="w-full p-3 shadow-input border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      value={formData.companyName}
                      onChange={handleInputChange}
                      placeholder="e.g. Netflix Inc"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Subscriber Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="subscriberName"
                      required
                      disabled={submitting}
                      className="w-full p-3 shadow-input border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      value={formData.subscriberName}
                      onChange={handleInputChange}
                      placeholder="e.g. John Doe"
                    />
                  </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Subscription Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="subscriptionName"
                  required
                  disabled={submitting}
                  className="w-full p-3 shadow-input border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  value={formData.subscriptionName}
                  onChange={handleInputChange}
                  placeholder="e.g. Netflix Premium"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="price"
                    required
                    disabled={submitting}
                    className="w-full p-3 shadow-input border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="e.g. ₹1499"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Frequency <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="frequency"
                    required
                    disabled={submitting}
                    className="w-full p-3 shadow-input border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                    value={formData.frequency}
                    onChange={handleInputChange}
                  >
                      <option value="" disabled>Select Frequency</option>
                      <option value="Yearly">Yearly</option>
                      <option value="Half-Yearly">Half-Yearly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Monthly">Monthly</option>
                      
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Purpose <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="purpose"
                  required
                  rows={3}
                  disabled={submitting}
                  className="w-full p-3 shadow-input border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                  value={formData.purpose}
                  onChange={handleInputChange}
                  placeholder="Why is this subscription needed? What is its purpose?"
                />
              </div>

              {/* Data Preview Removed - Now using Toast */}
            </form>
        </div>

        {/* Modal Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="flex-1 py-3 px-4 rounded-xl shadow-input border-none text-gray-700 font-medium hover:bg-white hover:border-gray-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-sub-form"
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                Saving {nextSN} to Google Sheets...
              </>
            ) : (
              <>
                <Save size={18} />
                Save as {nextSN}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddSubscription;