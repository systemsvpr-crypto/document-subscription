import React, { useState } from 'react';
import useDataStore, { LoanItem } from '../../store/dataStore';
import { toast } from 'react-hot-toast';
import { X, Save, Loader2 } from 'lucide-react';
import { submitToGoogleSheets } from '../../utils/googleSheetsService';

interface AddLoanProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddLoan: React.FC<AddLoanProps> = ({ isOpen, onClose }) => {
  const { loans, addLoan } = useDataStore();
  const [formData, setFormData] = useState({
    loanName: '',
    bankName: '',
    amount: '',
    emi: '',
    startDate: '',
    endDate: '',
    providedDocument: '',
    remarks: '',
    file: null as string | null,
    fileContent: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          file: file.name,
          fileContent: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);

      // 1. Handle File Upload if exists
      let driveFileUrl = "";
      if (formData.file && formData.fileContent) {
        try {
          const uploadRes = await submitToGoogleSheets({
            action: "uploadFile",
            data: {
              base64Data: formData.fileContent,
              fileName: formData.file,
              mimeType: "application/octet-stream",
              folderId: import.meta.env.VITE_GOOGLE_LOAN_FOLDER_ID || "12zBHFw6truibhysD3UK1lBKbSHN0026z",
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

      // 2. Auto-generate SN-xxx (Max based)
      const maxSn = loans.reduce((max, loan) => {
        const match = loan.sn.match(/(\d+)/);
        const num = match ? parseInt(match[0], 10) : 0;
        return num > max ? num : max;
      }, 0);
      
      const nextNum = maxSn + 1;
      const sn = `SN-${String(nextNum).padStart(3, '0')}`;
      const now = new Date();
      const timestamp = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}, ${now.toLocaleTimeString('en-GB', { hour12: false })}`;

      // 3. Prepare Row Data for 'Loan' sheet
      // A: Timestamp | B: Serial No. | C: Loan Name | D: Bank Name | E: Amount | F: EMI | G: Start Date | H: End Date | I: Provided Doc | J: File | K: Remarks
      const rowData = [
        timestamp,              // A
        sn,                      // B
        formData.loanName,       // C
        formData.bankName,       // D
        formData.amount,         // E
        formData.emi,            // F
        formData.startDate,      // G
        formData.endDate,        // H
        formData.providedDocument, // I
        driveFileUrl || "No File", // J
        formData.remarks          // K
      ];

      const result = await submitToGoogleSheets({
        action: 'insert',
        sheetName: 'Loan',
        data: rowData
      });

      if (result.success) {
        const newItem: LoanItem = {
          id: Math.random().toString(36).substr(2, 9),
          sn,
          Timestamp: timestamp,
          ...formData,
          file: driveFileUrl || formData.file // Prefer Drive URL
        };
        addLoan(newItem);
        toast.success('Loan added and saved to Google Sheets');
        onClose();
        setFormData({
          loanName: '',
          bankName: '',
          amount: '',
          emi: '',
          startDate: '',
          endDate: '',
          providedDocument: '',
          remarks: '',
          file: null,
          fileContent: ''
        });
      } else {
        toast.error("Failed to save to Google Sheets");
      }
    } catch (error) {
      console.error("Loan Submission Error:", error);
      toast.error("Error saving loan details");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-input my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Add New Loan</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8">
          <form id="add-loan-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan Name</label>
                <input
                  type="text"
                  required
                  className="w-full p-2.5 shadow-input border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.loanName}
                  onChange={e => setFormData({ ...formData, loanName: e.target.value })}
                  placeholder="e.g. Home Loan"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bank Name</label>
                <input
                  type="text"
                  required
                  className="w-full p-2.5 shadow-input border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.bankName}
                  onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                  placeholder="e.g. HDFC Bank"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Amount</label>
                <input
                  type="text"
                  required
                  className="w-full p-2.5 shadow-input border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="e.g. ₹50,00,000"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">EMI</label>
                <input
                  type="text"
                  required
                  className="w-full p-2.5 shadow-input border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.emi}
                  onChange={e => setFormData({ ...formData, emi: e.target.value })}
                  placeholder="e.g. ₹45,000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan Start Date</label>
                <input
                  type="date"
                  required
                  className="w-full p-2.5 shadow-input border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan End Date</label>
                <input
                  type="date"
                  required
                  className="w-full p-2.5 shadow-input border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
                  value={formData.endDate}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Provided Document Name</label>
                <input
                  type="text"
                  required
                  className="w-full p-2.5 shadow-input border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.providedDocument}
                  onChange={e => setFormData({ ...formData, providedDocument: e.target.value })}
                  placeholder="e.g. Property Deed"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Upload Document</label>
                <input
                  type="file"
                  className="w-full p-2 shadow-input border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  onChange={handleFileChange}
                />
                {formData.file && <p className="text-xs text-green-600 mt-1">Selected: {formData.file}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Remarks</label>
              <input
                type="text"
                className="w-full p-2.5 shadow-input border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={formData.remarks}
                onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Optional remarks"
              />
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl shadow-input border-none text-gray-700 font-medium hover:bg-white hover:border-gray-300 transition-all shadow-sm"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-loan-form"
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Loan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddLoan;
