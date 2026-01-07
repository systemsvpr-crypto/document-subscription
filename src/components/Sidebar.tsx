import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LogOut,
  X,
  LayoutDashboard,
  FileText,
  Banknote,
  List,
  RefreshCw,
  Share2,
  CheckCircle,
  DollarSign,
  ShieldCheck,
  Ban,
  ChevronDown,
  ChevronRight,

  Settings as SettingsIcon,
  CreditCard
} from "lucide-react";
import useAuthStore from "../store/authStore";

interface SidebarProps {
  onClose?: () => void;
}

  // ... imports remain the same
  
  interface MenuItem {
    label: string;
    path?: string;
    icon?: React.ReactNode;
    subItems?: MenuItem[];
  }

  const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
    const { logout, currentUser } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
  
    // Helper to determine if a section should be open based on current path
    const isSectionActive = (item: MenuItem, currentPath: string): boolean => {
       if (item.path === currentPath) return true;
       if (item.subItems) {
           return item.subItems.some(sub => isSectionActive(sub, currentPath));
       }
       return false;
    };

    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  
    // Sync open sections with current URL
    useEffect(() => {
      const newOpenSections: Record<string, boolean> = {};
      
      const checkActive = (items: MenuItem[]) => {
          items.forEach(item => {
              if (isSectionActive(item, location.pathname)) {
                  newOpenSections[item.label] = true;
                  // If we found a match deep down, we need to mark all parents as open. 
                  // But our simple recursive check above just returns boolean.
                  // We need to traverse down and set true for any parent that has an active child.
                  if (item.subItems) {
                      checkActive(item.subItems);
                  }
              }
          });
      };
      
      // Better approach: traverse and set state
      const traverseAndOpen = (items: MenuItem[]) => {
        items.forEach(item => {
           if (item.subItems) {
               const hasActiveChild = item.subItems.some(sub => isSectionActive(sub, location.pathname + location.search));
               if (hasActiveChild || isSectionActive(item, location.pathname)) {
                   newOpenSections[item.label] = true;
                   traverseAndOpen(item.subItems);
               }
           }
        });
      };

      traverseAndOpen(allMenuItems);
      setOpenSections(newOpenSections);
    }, [location.pathname, location.search]);
  
    // Menu Configuration
    const allMenuItems: MenuItem[] = [
      {
        label: "Dashboard",
        path: "/",
        icon: <LayoutDashboard size={20} />,
      },
      {
        label: "Resource Manager",
        icon: <FileText size={20} />,
        subItems: [
          { label: "All Resources", path: "/resource-manager", icon: <List size={16} /> },
          { 
              label: "Renewals", 
              icon: <RefreshCw size={16} />,
              subItems: [
                  { label: "Document Renewal", path: "/document/renewal", icon: <FileText size={16} /> },
                  { label: "Subscription Renewal", path: "/subscription/renewal", icon: <CreditCard size={16} /> },
              ]
          },
          { label: "Document Shared", path: "/document/shared", icon: <Share2 size={16} /> },
          { label: "Subscription Approval", path: "/subscription/approval", icon: <CheckCircle size={16} /> },
          { label: "Subscription Payment", path: "/subscription/payment", icon: <DollarSign size={16} /> },
        ]
      },
      {
        label: "Loan",
        icon: <Banknote size={20} />,
        subItems: [
          { label: "All Loan", path: "/loan/all", icon: <List size={16} /> },
          { label: "Request Forecloser", path: "/loan/foreclosure", icon: <Ban size={16} /> },
          { label: "Collect NOC", path: "/loan/noc", icon: <ShieldCheck size={16} /> },
        ]
      },

      {
        label: "Settings",
        path: "/settings",
        icon: <SettingsIcon size={20} />,
      }
    ];
  
    const menuItems = allMenuItems.filter(item => {
        if (!currentUser) return false;
        if (currentUser.role === 'admin') return true;
        return currentUser.permissions?.includes(item.label);
    });
  
    const toggleSection = (label: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setOpenSections(prev => ({
        ...prev,
        [label]: !prev[label]
      }));
    };
  
    const handleNavigation = (path: string) => {
      if (path.includes('?')) {
          // Handle query params manual navigation if needed, or normal navigate works
          navigate(path);
      } else {
        navigate(path);
      }
      if (onClose) onClose();
    };
  
    const handleLogout = () => {
      logout();
      navigate("/login");
    };

    const renderMenuItem = (item: MenuItem, depth: number = 0) => {
        const hasChildren = item.subItems && item.subItems.length > 0;
        const paddingLeft = depth > 0 ? `${depth * 1.5 + 1}rem` : '1rem';
        const isOpen = openSections[item.label];

        // Ensure we check for query params equality too if present
        const isActiveLink = item.path && (location.pathname + location.search) === item.path;
        
        // Or generic active checking for parent folders highlighting (optional)
        // const isParentActive = hasChildren && item.subItems?.some(s => s.path === location.pathname);

        if (hasChildren) {
            return (
                <div key={item.label} className="mb-1">
                    <button
                        onClick={(e) => toggleSection(item.label, e)}
                        className={`w-full flex items-center justify-between py-3 pr-4 rounded-xl transition-all duration-200 ${
                            isOpen || isSectionActive(item, location.pathname) 
                            ? 'text-indigo-600 bg-indigo-50 font-medium' 
                            : 'text-gray-600 hover:bg-gray-100 hover:text-indigo-600'
                        }`}
                        style={{ paddingLeft: depth === 0 ? '1rem' : paddingLeft }}
                    >
                        <div className="flex items-center gap-3">
                            {item.icon}
                            <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>
                        </div>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    
                    {isOpen && (
                        <div className="space-y-1">
                            {/* Pass depth+1 so it indents further */}
                            {item.subItems!.map(sub => renderMenuItem(sub, depth + 1))}
                        </div>
                    )}
                </div>
            );
        } else {
            return (
                <div key={item.path || item.label} className="mb-1">
                     <button
                        onClick={() => handleNavigation(item.path!)}
                        className={`w-full flex items-center gap-3 py-2.5 pr-4 rounded-xl transition-all duration-200 ${
                            isActiveLink
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 font-medium"
                            : "text-gray-600 hover:text-indigo-600 hover:bg-gray-100"
                        }`}
                        style={{ paddingLeft: depth === 0 ? '1rem' : paddingLeft }}
                    >
                        {item.icon}
                        <span className={`text-sm whitespace-nowrap ${isActiveLink ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                    </button>
                </div>
            );
        }
    };
  
    return (
      <div className="flex flex-col h-full bg-white text-gray-800 border-r border-gray-200">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-200">
               DS
            </div>
            <span className="font-bold text-lg tracking-wide text-gray-900">Document & Subscription</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="lg:hidden text-gray-500 hover:text-indigo-600">
              <X size={24} />
            </button>
          )}
        </div>
  
        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4 space-y-1 px-3 no-scrollbar">
          {menuItems.map(item => renderMenuItem(item))}
        </div>
  
         {/* Footer / Logout */}
        <div className="px-4 py-3 border-t border-gray-100 mt-auto flex-shrink-0 pb-1 md:pb-1">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-1.5 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
          >
            <LogOut size={20} />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </div>
    );
  };

export default Sidebar;