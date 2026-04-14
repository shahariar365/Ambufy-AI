import { useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Car, User, MapPin } from 'lucide-react';
import React, { useState, useEffect } from 'react';

const LocationName = ({ lat, lng }) => {
  const [name, setName] = useState('Click to view');
  const [loading, setLoading] = useState(false);

  const fetchAddress = () => {
    if (!lat || !lng || loading) return;
    setLoading(true);
    setName('Fetching address...');
    
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      .then(res => res.json())
      .then(data => {
        const { road, suburb, neighbourhood, city, state } = data.address || {};
        const detailedAddress = [road, neighbourhood || suburb, city || state].filter(Boolean).join(', ');
        setName(detailedAddress || 'Unknown Location');
      })
      .catch(() => setName('Location Unavailable'))
      .finally(() => setLoading(false));
  };

  return (
    <button 
        onClick={fetchAddress} 
        disabled={loading}
        className={`text-left text-sm ${name === 'Click to view' ? 'text-blue-500 underline cursor-pointer hover:text-blue-700 font-medium' : 'text-slate-700'}`}
    >
        {name}
    </button>
  );
};


const FleetStatus = () => {
  const location = useLocation();
  const { fleet } = location.state || { fleet: [] };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'on_trip': return 'bg-red-100 text-red-800';
      case 'offline': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto">
      <div className="mb-6">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-red-500">
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-slate-800 mb-6 flex items-center gap-3"><Car /> Fleet Status Overview</h1>
      
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Vehicle Number</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Assigned Driver</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Current Location</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Coordinates</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {fleet.map((amb) => (
                <tr key={amb.id}>
                  <td className="px-6 py-4 font-semibold text-slate-800">{amb.vehicle_number}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{amb.type}</td>
                  <td className="px-6 py-4 text-sm text-blue-600 font-medium">
                    {amb.driver_id ? `Driver ID: ...${String(amb.driver_id).slice(-4)}` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    <LocationName lat={amb.current_lat} lng={amb.current_lng} />
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-mono">
                    {amb.current_lat ? `${amb.current_lat.toFixed(4)}, ${amb.current_lng.toFixed(4)}` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(amb.status)}`}>
                      {amb.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm">
                    <button className="text-indigo-600 hover:text-indigo-900 font-medium">Edit</button>
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

export default FleetStatus;