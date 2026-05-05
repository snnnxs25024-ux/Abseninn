import React from 'react';
import { LayoutDashboard, CalendarCheck, Database, Link, Settings, FileSpreadsheet } from 'lucide-react';
import { Page } from '../App';

interface BottomNavProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentPage, setCurrentPage }) => {
  const navItems = [
    { label: 'Dashboard' as Page, icon: <LayoutDashboard size={20} /> },
    { label: 'Absensi' as Page, icon: <CalendarCheck size={20} /> },
    { label: 'Open List' as Page, icon: <Link size={20} /> },
    { label: 'MPP' as Page, icon: <FileSpreadsheet size={20} /> },
    { label: 'Data Base' as Page, icon: <Database size={20} /> },
    { label: 'Pengaturan' as Page, icon: <Settings size={20} /> },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 pb-safe">
      <nav className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const isActive = currentPage === item.label;
          return (
            <button
              key={item.label}
              onClick={() => setCurrentPage(item.label)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'
              }`}
            >
              <div className={`transition-transform duration-300 ${isActive ? 'scale-110 mb-0.5' : ''}`}>
                {item.icon}
              </div>
              <span className={`text-[9px] font-semibold tracking-tight ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-blue-600 absolute bottom-1"></span>
              )}
            </button>
          );
        })}
      </nav>
      <style>{`
        .pb-safe {
          padding-bottom: env(safe-area-inset-bottom);
        }
      `}</style>
    </div>
  );
};

export default BottomNav;
