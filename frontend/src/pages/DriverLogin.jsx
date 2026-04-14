import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, ShieldAlert } from 'lucide-react';

const DriverLogin = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true); setError('');

    try {
      const response = await fetch('https://ambufy-ai.onrender.com/api/auth/login-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.detail || 'Login failed');

      // লগইন সফল হলে ইউজারের তথ্য ব্রাউজারে সেভ করে রাখা
      localStorage.setItem('driver_token', data.access_token);
      localStorage.setItem('driver_info', JSON.stringify(data.driver));
      localStorage.setItem('ambulance_info', JSON.stringify(data.ambulance));

      // মূল ড্রাইভার ড্যাশবোর্ডে পাঠিয়ে দেওয়া
      navigate('/driver/dashboard');
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck size={32} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Driver Portal Login</h1>
          <p className="text-slate-500 text-sm mt-2">Welcome back! Please login to your account.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-6 flex items-center gap-2 text-sm">
            <ShieldAlert size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number</label>
            <input 
              type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="01XXXXXXXXX"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <input 
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit" disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-md transition-all active:scale-95 disabled:bg-blue-400"
          >
            {isLoading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default DriverLogin;