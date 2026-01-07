import React from 'react';
import { Construction } from 'lucide-react';

interface UnderConstructionProps {
  title: string;
}

const UnderConstruction: React.FC<UnderConstructionProps> = ({ title }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full mb-6 relative overflow-hidden">
        <Construction size={48} className="relative z-10" />
        <div className="absolute inset-0 bg-indigo-200/50 blur-xl"></div>
      </div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-500 max-w-md mx-auto">
        This feature is currently under development. Stay tuned for updates!
      </p>
    </div>
  );
};

export default UnderConstruction;
