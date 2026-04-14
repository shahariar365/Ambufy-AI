import React, { useState, useEffect } from 'react';
import { executeSmartDispatch } from '../utils/dispatchHelper';
import { MapContainer, TileLayer, GeoJSON, Tooltip, Marker } from 'react-leaflet';
import { Activity, Car, MapPin, AlertTriangle, Users, ArrowRight, CheckCircle2, UserPlus, LogOut } from 'lucide-react'; // LogOut আইকন যুক্ত করা হয়েছে
import L from 'leaflet';
import { Link, useNavigate } from 'react-router-dom'; // useNavigate যুক্ত করা হয়েছে
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const ambulanceIcon = new L.Icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/2894/2894975.png', iconSize: [38, 38], iconAnchor:[19, 19], popupAnchor: [0, -15], className: 'drop-shadow-md' });

const getDistance = (lat1, lon1, lat2, lon2) => {
  const p = 0.017453292519943295; const c = Math.cos; const a = 0.5 - c((lat2 - lat1) * p)/2 + c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))/2;
  return 12742 * Math.asin(Math.sqrt(a)); 
};

const AdminDashboard = () => {
  const navigate = useNavigate(); // রিডাইরেক্ট করার জন্য

  // --- Security Check (Admin Protection) ---
  useEffect(() => {
    const adminToken = localStorage.getItem('admin_token');
    const adminInfoStr = localStorage.getItem('admin_info');
    
    if (!adminToken || !adminInfoStr) {
      navigate('/admin/login'); // টোকেন না থাকলে লগইন পেজে পাঠিয়ে দেবে
      return;
    }
    
    try {
        const adminInfo = JSON.parse(adminInfoStr);
        if (adminInfo.role !== 'admin') {
            navigate('/admin/login'); // রোল admin না হলেও বের করে দেবে
        }
    } catch (e) {
        navigate('/admin/login');
    }
  }, [navigate]);

  const center =[23.8103, 90.4125]; 
  const [zones, setZones] = useState([]); 
  const [fleet, setFleet] = useState([]); 
  const [timeWindow, setTimeWindow] = useState(1); 
  const [suggestions, setSuggestions] = useState([]);
  const [zoneStats, setZoneStats] = useState([]);

  useEffect(() => {
    const fetchDemandData = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/predict/demand?time_window=${timeWindow}`);
        if (response.ok) { const data = await response.json(); setZones(data.zones ||[]); }
      } catch (error) { console.error("Error:", error); }
    };

    const fetchFleetData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/fleet/live');
        if (response.ok) { const data = await response.json(); setFleet(data.ambulances ||[]); }
      } catch (error) { console.error("Error fetching fleet:", error); }
    };

    fetchDemandData(); fetchFleetData(); 
    const interval = setInterval(fetchFleetData, 10000);
    return () => clearInterval(interval);
  }, [timeWindow]); 

  useEffect(() => {
    if (zones.length === 0 || fleet.length === 0) return;

    let zoneStats = zones.map(z => ({ ...z, available_now: 0, deficit: 0 }));
    const availableFleet = fleet.filter(a => a.status === 'available');

    availableFleet.forEach(amb => {
      let nearestZone = null; let minDistance = Infinity;
      zoneStats.forEach(z => {
        const dist = getDistance(amb.current_lat, amb.current_lng, z.coords[0], z.coords[1]);
        if (dist < minDistance) { minDistance = dist; nearestZone = z.name; }
      });
      if (nearestZone) { zoneStats.find(z => z.name === nearestZone).available_now += 1; }
    });

    let surplusZones = []; let deficitZones = [];
    zoneStats.forEach(z => {
      z.deficit = z.required_ambulances - z.available_now;
      if (z.deficit > 0) deficitZones.push({ name: z.name, needed: z.deficit });
      else if (z.deficit < 0) surplusZones.push({ name: z.name, extra: Math.abs(z.deficit) });
    });

    let newSuggestions = [];
    deficitZones.forEach(dz => {
      while (dz.needed > 0 && surplusZones.length > 0) {
        let sz = surplusZones[0];
        let moveCount = Math.min(dz.needed, sz.extra);
        newSuggestions.push({ from: sz.name, to: dz.name, count: moveCount });
        dz.needed -= moveCount; sz.extra -= moveCount;
        if (sz.extra === 0) surplusZones.shift(); 
      }
    });

   setTimeout(() => { setSuggestions(newSuggestions); setZoneStats(zoneStats); }, 0);
  }, [zones, fleet]);

  const totalAmbulances = fleet.length;
  const availableFleet = fleet.filter(a => a.status === 'available').length;
  const activeEmergencies = fleet.filter(a => ['on_trip', 'accepted', 'enroute_to_hospital', 'arrived_patient'].includes(a.status)).length; // একটু আপডেট করা হয়েছে

  const stats =[
    { title: 'Total Ambulances', value: totalAmbulances.toString(), icon: Car, color: 'text-blue-500' },
    { title: 'Active Emergencies', value: activeEmergencies.toString(), icon: AlertTriangle, color: 'text-red-500' },
    { title: 'Available Fleet', value: availableFleet.toString(), icon: Users, color: 'text-green-500' },
  ];
  
  const getZoneStyle = (demand) => {
    return { fillColor: demand === 'High' ? '#ef4444' : demand === 'Medium' ? '#f59e0b' : '#10b981', weight: 1.5, opacity: 1, color: 'white', fillOpacity: 0.5 };
  };

  const handleDispatchAction = async () => {
    const confirm = window.confirm("Dispatch ambulances automatically to cover shortages?");
    if (!confirm) return;

    const success = await executeSmartDispatch(suggestions, zones, fleet);
    
    if(success) {
        alert("Success! Ambulances have been automatically relocated in the database.");
    } else {
        alert("Failed to dispatch ambulances.");
    }
  };

  // --- Admin Logout Function ---
  const handleAdminLogout = () => {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_info');
      navigate('/admin/login');
  };

  return (
    <div className="grow flex bg-gray-100 h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-6">
            <h2 className="text-2xl font-bold text-blue-400 mb-10">Ambufy AI</h2>
            <nav className="flex flex-col gap-4">
            <Link to="/admin" className="flex items-center gap-3 p-2 rounded-lg bg-slate-700 text-white">
                <Activity size={20} /> Dashboard
            </Link>
            <Link to="/admin/fleet" state={{ fleet: fleet }} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700 text-gray-300">
                <MapPin size={20} /> Fleet Status
            </Link>
            <Link to="/admin/reports" state={{ zoneStats: zoneStats }} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700 text-gray-300">
                <AlertTriangle size={20} /> Reports
            </Link>
            </nav>
        </div>
        <div className="mt-auto p-6">
            <button onClick={handleAdminLogout} className="flex items-center gap-3 p-2 w-full rounded-lg hover:bg-red-600/20 text-red-400 transition-colors">
                <LogOut size={20} /> Logout
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 flex flex-col gap-6 h-full overflow-y-auto">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-slate-800">Live Operations Dashboard</h1>
          <Link 
            to="/admin/add-driver"
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
          >
            <UserPlus size={18} />
            Add New Driver
          </Link>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 shrink-0">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white p-6 rounded-xl shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{stat.title}</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{stat.value}</p>
              </div>
              <div className={`p-4 rounded-full bg-gray-50 ${stat.color}`}><stat.icon size={28} /></div>
            </div>
          ))}
        </div>

        {/* --- Map and AI Suggestions Layout --- */}
        <div className="flex flex-col lg:flex-row gap-6 grow min-h-96">
          {/* Map Section */}
          <div className="bg-white rounded-xl shadow-sm flex flex-col lg:w-2/3 h-full">
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800">Predicted Demand Heatmap & Fleet</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-600">Forecast For:</span>
                <select value={timeWindow} onChange={(e) => setTimeWindow(parseInt(e.target.value))} className="border rounded-lg px-2 py-1 text-sm bg-gray-50 focus:outline-none focus:border-red-500 font-medium cursor-pointer">
                  <option value={1}>Next 1 Hour</option>
                  <option value={12}>Next 12 Hours</option>
                  <option value={24}>Next 24 Hours</option>
                  <option value={168}>Next 7 Days</option>
                </select>
              </div>
            </div>
            
            <div className="grow relative z-0">
              <MapContainer center={center} zoom={12} scrollWheelZoom={true} className="h-full w-full rounded-b-xl">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                
                {zones.map(zone => (
                  zone.boundary && (
                    <GeoJSON 
                      key={zone.name + timeWindow} 
                      data={typeof zone.boundary === 'string' ? JSON.parse(zone.boundary) : zone.boundary} 
                      style={getZoneStyle(zone.demand)}>
                      <Tooltip sticky className="bg-white p-2 rounded shadow-lg border-0">
                        <div className="font-bold text-lg text-slate-800 border-b pb-1 mb-1">{zone.name}</div>
                        <div className="text-sm text-slate-600 mt-1">📞 Expected Calls: <span className="font-bold text-red-500">{zone.total_prediction}</span></div>
                        <div className="text-sm text-slate-600 border-t pt-2 mt-1">🚑 Required Fleet: <span className="font-bold text-blue-600">{zone.required_ambulances}</span></div>
                        <div className={`text-sm font-bold mt-2 ${zone.demand === 'High' ? 'text-red-500' : zone.demand === 'Medium' ? 'text-orange-500' : 'text-green-500'}`}>
                          Risk Level: {zone.demand}
                        </div>
                      </Tooltip>
                  </GeoJSON>
                  )
                ))}

                {fleet.map(amb => (
                  amb.current_lat && amb.current_lng && (
                    <Marker key={amb.id} position={[amb.current_lat, amb.current_lng]} icon={ambulanceIcon}>
                      <Tooltip className="bg-white p-2 rounded shadow-lg border-0">
                        <div className="font-bold text-slate-800 border-b pb-1 mb-1">{amb.vehicle_number}</div>
                        <div className="text-sm">Type: {amb.type} | Status: {amb.status.toUpperCase()}</div>
                      </Tooltip>
                    </Marker>
                  )
                ))}
              </MapContainer>
            </div>
          </div>

          {/* AI Suggestions Panel */}
          <div className="bg-white rounded-xl shadow-sm lg:w-1/3 flex flex-col h-full">
            <div className="p-4 border-b bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Activity className="text-blue-600" size={20}/> 
                AI Fleet Rebalancing
              </h3>
              <p className="text-xs text-slate-500 mt-1">Smart suggestions to prevent shortages.</p>
            </div>
            
            <div className="p-4 overflow-y-auto grow">
              {suggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <CheckCircle2 size={48} className="text-green-400 mb-2" />
                  <p className="font-medium">Fleet is perfectly balanced!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suggestions.map((sug, i) => (
                    <div key={i} className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
                      <div className="flex justify-between items-center text-sm font-bold text-slate-700 mb-2">
                        <span>Move {sug.count} Ambulances</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600 bg-white p-2 rounded border">
                        <span className="truncate w-2/5 text-center text-red-500 font-semibold">{sug.from}</span>
                        <ArrowRight size={14} className="text-slate-400" />
                        <span className="truncate w-2/5 text-center text-green-600 font-semibold">{sug.to}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {suggestions.length > 0 && (
              <div className="p-4 border-t">
                <button 
                  onClick={handleDispatchAction}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-md transition-all active:scale-95"
                >
                  Approve & Dispatch All
                </button>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;