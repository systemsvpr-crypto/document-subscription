import React, { useState } from 'react';
import { X, Save, Building2 } from 'lucide-react';
import useDataStore, { MasterItem } from '../../store/dataStore';
import { toast } from 'react-hot-toast';
import SearchableInput from '../../components/SearchableInput';

interface AddMasterProps {
    isOpen: boolean;
    onClose: () => void;
}

const AddMaster: React.FC<AddMasterProps> = ({ isOpen, onClose }) => {
    const { addMasterData } = useDataStore();
    const [formData, setFormData] = useState({
        companyName: '',
        documentType: '',
        category: ''
    });

    // Strictly limit categories to these 3, ignoring any old data
    const categoryOptions = ['Personal', 'Company', 'Director'];

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const newItem: MasterItem = {
            id: Math.random().toString(36).substr(2, 9),
            companyName: formData.companyName,
            documentType: formData.documentType,
            category: formData.category
        };

        addMasterData(newItem);
        toast.success('Master record added successfully');
        setFormData({ companyName: '', documentType: '', category: '' });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl my-8">
                 {/* Modal Header */}
                 <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Building2 className="text-indigo-600" size={24} />
                        Add Master Record
                    </h2>
                    <button 
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6">
                    <form id="add-master-form" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Company Name</label>
                            <input
                                type="text"
                                required
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-400"
                                value={formData.companyName}
                                onChange={e => setFormData({...formData, companyName: e.target.value})}
                                placeholder="e.g. Acme Corp"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Document Type</label>
                            <input
                                type="text"
                                required
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-400"
                                value={formData.documentType}
                                onChange={e => setFormData({...formData, documentType: e.target.value})}
                                placeholder="e.g. Invoice"
                            />
                        </div>
                        <div>
                            {/* Strictly Limited Category Selection */}
                            <SearchableInput
                                label="Category"
                                value={formData.category}
                                onChange={(val) => setFormData({...formData, category: val})}
                                options={categoryOptions}
                                placeholder="Select category..."
                                required
                            />
                        </div>
                    </form>
                </div>

                 {/* Modal Footer */}
                <div className="flex gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-white hover:border-gray-300 transition-all shadow-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="add-master-form"
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                    >
                        <Save size={18} />
                        Save Record
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddMaster;
