import React from "react";
import { User } from "lucide-react";
import useAuthStore from "../store/authStore";
import useHeaderStore from "../store/headerStore";

interface HeaderProps {
  children?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ children }) => {
  const { currentUser } = useAuthStore();
  const { title } = useHeaderStore();

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm relative z-10">
      <div className="flex justify-between items-center px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          {children}

          {/* Mobile Title / Dynamic Title */}
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {title || (
                <>
                  Document & Subscription <span className="text-orange-400">Manager</span>
                </>
              )}
            </h1>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 pl-4 w-full justify-end">
            <div className="hidden md:block text-right">
              <p className="text-sm font-semibold text-gray-700">{currentUser?.name || currentUser?.id || "Guest"}</p>
              <p className="text-xs text-gray-500 capitalize">
                {currentUser?.role || "User"}
              </p>
            </div>
            <div className="flex justify-center items-center w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-full shadow-sm">
              <User size={20} className="text-indigo-600" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;