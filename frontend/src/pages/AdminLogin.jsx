import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LoaderCircle, Phone, Lock } from 'lucide-react';

const AdminLogin = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); 
    setError('');

    try {
      const response = await fetch('http://127.0.0.1:8000/api/auth/login-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });

      const data = await response.json();

      if (response.ok) {
        // এখানে আমরা চেক করছি ইউজারের রোল 'admin' কিনা
        if (data.driver && data.driver.role === 'admin') {
            localStorage.setItem('admin_token', data.access_token);
            localStorage.setItem('admin_info', JSON.stringify(data.driver));
            navigate('/admin'); // সফল হলে ড্যাশবোর্ডে যাবে
        } else {
            setError('Access Denied. You do not have admin privileges.');
        }
      } else {
        setError(data.detail || 'Invalid phone number or password.');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border-t-4 border-blue-600">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} className="text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Admin Portal</h2>
          <p className="text-slate-500 text-sm mt-1">Authorized personnel only</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 border border-red-100 text-center font-medium animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number</label>
            <div className="relative">
                <Phone className="absolute left-3 top-3 text-slate-400" size={20} />
                <input 
                  type="text" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  required 
                  className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" 
                  placeholder="e.g. 01700000000" 
                />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" 
                  placeholder="••••••••" 
                />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 mt-2 shadow-lg hover:shadow-blue-500/30"
          >
            {loading ? <LoaderCircle className="animate-spin" size={20} /> : 'Secure Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;