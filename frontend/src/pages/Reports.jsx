import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { FileText, TrendingUp, AlertTriangle, ArrowLeft } from 'lucide-react';

const Reports = () => {
  const location = useLocation();
  const { zoneStats } = location.state || { zoneStats: [] };

  // --- Summary Calculations ---
  const totalRequiredNow = zoneStats.reduce((sum, zone) => sum + zone.required_ambulances, 0);
  const totalAvailableNow = zoneStats.reduce((sum, zone) => sum + zone.available_now, 0);
  const overallDeficit = totalRequiredNow - totalAvailableNow;

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto">
      <div className="mb-6">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>
      
      <h1 className="text-3xl font-bold text-slate-800 mb-6 flex items-center gap-3">
        <FileText /> Operational Reports
      </h1>

      {/* --- New Summary Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-blue-500">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Optimal Fleet Required</p>
            <p className="text-4xl font-black text-slate-800 mt-2">{totalRequiredNow}</p>
            <p className="text-xs text-slate-400 mt-1">To cover current Dhaka city demand</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-green-500">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Available Now</p>
            <p className="text-4xl font-black text-slate-800 mt-2">{totalAvailableNow}</p>
            <p className="text-xs text-slate-400 mt-1">Currently idle and ready for dispatch</p>
        </div>
        <div className={`bg-white p-5 rounded-xl shadow-sm border-l-4 ${overallDeficit > 0 ? 'border-red-500' : 'border-slate-300'}`}>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Overall Shortage</p>
            <p className={`text-4xl font-black mt-2 ${overallDeficit > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                {overallDeficit > 0 ? overallDeficit : 0}
            </p>
            {overallDeficit > 0 && <p className="text-xs text-red-500 font-medium mt-1">Warning: Need to acquire more vehicles!</p>}
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-bold text-slate-700 mb-4 flex items-center gap-2">
          <TrendingUp size={22} className="text-blue-600" />
          Zone Demand vs. Fleet Availability Analysis
        </h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Zone Name</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Predicted Demand (Avg/hr)</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Required Fleet</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Available Fleet</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {zoneStats.map((zone, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">{zone.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-slate-600">{zone.avg_hourly_demand}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-blue-600">{zone.required_ambulances}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-slate-700">{zone.available_now}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    {zone.deficit > 0 ? (
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 items-center justify-center gap-1">
                        <AlertTriangle size={14} /> Deficit ({zone.deficit})
                      </span>
                    ) : (
                       <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${zone.deficit < 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                        {zone.deficit < 0 ? `Surplus (${Math.abs(zone.deficit)})` : 'Balanced'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;