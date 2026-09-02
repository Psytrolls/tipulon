import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Bus, 
  LayoutDashboard, 
  ClipboardCheck, 
  FileText, 
  Package, 
  Users, 
  History, 
  LogOut, 
  Menu, 
  X,
  AlertTriangle
} from 'lucide-react';

export default function Navbar({ currentView, setCurrentView }) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;

  const isAdmin = user.role === 'admin';

  const techLinks = [
    { id: 'new-treatment', label: 'טיפול חדש', icon: ClipboardCheck },
    { id: 'reports', label: 'היסטוריית טיפולים', icon: FileText },
  ];

  const adminLinks = [
    { id: 'dashboard', label: 'לוח בקרה', icon: LayoutDashboard },
    { id: 'fleet', label: 'צי אוטובוסים', icon: Bus },
    { id: 'follow-up', label: 'תור המשך טיפול', icon: AlertTriangle },
    { id: 'reports', label: 'דוחות והיסטוריה', icon: FileText },
    { id: 'products', label: 'ניהול מוצרים', icon: Package },
    { id: 'users', label: 'ניהול משתמשים', icon: Users },
    { id: 'audit-logs', label: 'יומן פעולות', icon: History },
  ];

  const links = isAdmin ? adminLinks : techLinks;

  const handleNav = (id) => {
    setCurrentView(id);
    setMobileMenuOpen(false);
  };

  return (
    <header 
      className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm transition-all"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView(isAdmin ? 'dashboard' : 'new-treatment')}>
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-200">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-xl text-slate-900 tracking-tight">טיפולון</span>
              <span className="hidden sm:inline-block mr-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                טיפול מונע באוטובוסים
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              const active = currentView === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleNav(link.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Info & Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-left items-end">
              <span className="text-sm font-bold text-slate-900 leading-tight">{user.fullName}</span>
              <span className="text-xs text-slate-500 font-medium">
                {isAdmin ? 'מנהל מערכת' : 'טכנאי שטח'}
              </span>
            </div>

            <span className={`text-xs px-2 py-0.5 rounded font-bold ${
              isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {isAdmin ? 'מנהל' : 'טכנאי'}
            </span>

            <button
              onClick={logout}
              title="התנתק מהמערכת"
              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1 shadow-lg">
          <div className="py-2 border-b border-slate-100 mb-2">
            <p className="text-sm font-bold text-slate-800">{user.fullName}</p>
            <p className="text-xs text-slate-500">{user.phone} ({isAdmin ? 'מנהל' : 'טכנאי'})</p>
          </div>
          {links.map((link) => {
            const Icon = link.icon;
            const active = currentView === link.id;
            return (
              <button
                key={link.id}
                onClick={() => handleNav(link.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-semibold text-right transition-colors ${
                  active
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{link.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
