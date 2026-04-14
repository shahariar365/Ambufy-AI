import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PhoneCall, X, ShieldAlert, Car } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();
  const isHomeRoute = location.pathname === '/';
  const isAdminRoute = location.pathname.includes('/admin');
  
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  let navStyle = "bg-white text-slate-800 shadow-sm sticky top-0";
  if (isHomeRoute) navStyle = "bg-transparent text-white absolute top-0 left-0 w-full";
  if (isAdminRoute) navStyle = "bg-slate-900 text-white shadow-md relative";

  if (['/driver', '/driver/dashboard', '/admin/login'].includes(location.pathname)) {
      return null;
  }

  return (
    <>
      <nav className={`w-full p-4 z-50 transition-all duration-300 ${navStyle}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          
          <Link to="/" className="flex items-center gap-2 transition-transform active:scale-95">
            <div className={`${isHomeRoute ? 'bg-white/20 backdrop-blur-md' : 'bg-slate-100'} p-1.5 rounded-lg shadow-sm`}>
              <img src="https://cdn-icons-png.flaticon.com/512/10695/10695210.png" alt="Logo" className="w-8 h-8" />
            </div>
            <span className={`text-2xl font-black tracking-tight ${isHomeRoute || isAdminRoute ? 'text-white' : 'text-slate-800'}`}>
              Ambufy <span className="text-red-500">AI</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {/* Driver Portal (Only shows on PC/Desktop View) */}
            <Link 
              to="/driver" 
              className={`hidden sm:flex text-sm font-bold items-center gap-2 px-4 py-2 rounded-full transition-all active:scale-95 ${
                isHomeRoute 
                  ? 'text-white/80 hover:text-white hover:bg-white/10' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Car size={16} /> Driver Portal
            </Link>

            <button 
              onClick={() => setIsHelpOpen(true)}
              className={`text-sm font-bold flex items-center gap-2 px-4 py-2 rounded-full transition-all active:scale-95 ${
                isHomeRoute 
                  ? 'bg-white/10 hover:bg-white/20 border border-white/20 text-white' 
                  : 'bg-red-50 hover:bg-red-100 text-red-600'
              }`}
            >
              <PhoneCall size={16} /> Help
            </button>
          </div>
          
        </div>
      </nav>

      {/* Help Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
            <div className="bg-red-600 p-4 flex justify-between items-center text-white"><h2 className="font-bold flex items-center gap-2"><ShieldAlert size={20} /> Emergency Contacts</h2><button onClick={() => setIsHelpOpen(false)} className="hover:bg-red-700 p-1 rounded-full"><X size={20}/></button></div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 mb-4">In a critical emergency, please call the national helpline immediately.</p>
              <a href="tel:999" className="flex items-center justify-between bg-slate-50 border border-slate-200 p-4 rounded-xl hover:border-red-300 transition-colors"><div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">National Emergency</p><p className="text-2xl font-black text-red-600">999</p></div><div className="bg-red-100 p-3 rounded-full text-red-600"><PhoneCall size={24}/></div></a>
              <a href="tel:01758058433" className="flex items-center justify-between bg-slate-50 border border-slate-200 p-4 rounded-xl hover:border-blue-300 transition-colors"><div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ambufy AI Support</p><p className="text-xl font-bold text-blue-600">01758-058433</p></div><div className="bg-blue-100 p-3 rounded-full text-blue-600"><PhoneCall size={20}/></div></a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;