import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Power, LogOut, Navigation, Siren, CheckCircle, Check, X } from 'lucide-react';
import L from 'leaflet';
import { supabase } from '../supabaseClient';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: null, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;
const patientIcon = new L.Icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/3482/3482279.png', iconSize: [35, 35], iconAnchor: [17, 35], shadowUrl: null });
const hospitalIcon = new L.Icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/10476/10476199.png', iconSize: [35, 35], iconAnchor: [17, 35], shadowUrl: null });
const ambulanceIcon = new L.Icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/2894/2894975.png', iconSize: [38, 38], iconAnchor: [19, 19], shadowUrl: null });

const DriverApp = () => {
  const navigate = useNavigate();

  const [driver] = useState(() => JSON.parse(localStorage.getItem('driver_info')));
  const [ambulance] = useState(() => JSON.parse(localStorage.getItem('ambulance_info')));
  
  const [currentPosition, setCurrentPosition] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [routeToTarget, setRouteToTarget] = useState([]);
  const watchIdRef = useRef(null);

  // --- useEffect ১: অথেনটিকেশন এবং লোকেশন ট্র্যাকিং ---
  useEffect(() => {
    if (!driver) { navigate('/driver'); return; }
    
    if ("geolocation" in navigator) {
      const success = (pos) => setCurrentPosition([pos.coords.latitude, pos.coords.longitude]);
      const error = () => setCurrentPosition(ambulance?.current_lat ? [ambulance.current_lat, ambulance.current_lng] : [23.81, 90.41]);
      navigator.geolocation.getCurrentPosition(success, error);
      watchIdRef.current = navigator.geolocation.watchPosition(success, error, { enableHighAccuracy: true });
    } else {
      setCurrentPosition(ambulance?.current_lat ? [ambulance.current_lat, ambulance.current_lng] : [23.81, 90.41]);
    }
    
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- useEffect ২: লোকেশন ডাটাবেসে আপডেট ---
  useEffect(() => {
    if (!isOnline || !currentPosition || !ambulance?.id) return;
    const interval = setInterval(() => {
      supabase.from("ambulances").update({ current_lat: currentPosition[0], current_lng: currentPosition[1] }).eq("id", ambulance.id).then();
    }, 10000);
    return () => clearInterval(interval);
  }, [isOnline, currentPosition, ambulance?.id]);

  // --- useEffect ৩: রিয়েল-টাইম ট্রিপ নোটিফিকেশন ---
  useEffect(() => {
    if (!isOnline || !ambulance?.id) return;

    const getTripDetails = async (trip) => {
      if (!trip) return null;
      const { data: hospitalData } = await supabase.from('hospitals').select('*').eq('id', trip.destination_hospital_id).maybeSingle();
      const { data: patientData } = await supabase.from('patients').select('*').eq('id', trip.patient_id).maybeSingle();
      return { ...trip, hospital_data: hospitalData, patient_data: patientData };
    };

    const checkForPendingTrip = async () => {
        const { data: pendingTrip } = await supabase.from('trips').select('*').eq('ambulance_id', ambulance.id).eq('status', 'pending_driver').maybeSingle();
        if (pendingTrip) { setActiveTrip(await getTripDetails(pendingTrip)); }
    };
    checkForPendingTrip();

    const tripChannel = supabase.channel(`driver-room-${ambulance.id}-${Date.now()}`);
    tripChannel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `ambulance_id=eq.${ambulance.id}` }, async (payload) => {
        const newTripData = payload.new;
        if (newTripData && newTripData.status === 'pending_driver') {
          setActiveTrip(await getTripDetails(newTripData));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(tripChannel); };
  }, [isOnline, ambulance?.id]);

  // --- Helpers ---
  const calculateRoute = async (start, end) => { 
      if (!start || !end) return; 
      const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`; 
      const data = await (await fetch(url)).json(); 
      if (data.routes?.length) { setRouteToTarget(data.routes[0].geometry.coordinates.map(c => [c[1], c[0]])); } 
  };

  const handleToggleOnline = async () => { 
      const newStatus = !isOnline; 
      if (ambulance?.id) { await supabase.from('ambulances').update({ status: newStatus ? 'available' : 'offline' }).eq('id', ambulance.id); } 
      setIsOnline(newStatus); 
      if (!newStatus) { setActiveTrip(null); setRouteToTarget([]); } 
  };

  const handleLogout = async () => { 
      if (isOnline && ambulance?.id) { await supabase.from('ambulances').update({ status: 'offline' }).eq('id', ambulance.id); } 
      localStorage.clear(); navigate('/driver'); 
  };

  // --- ট্রিপের স্ট্যাটাস আপডেট এবং ডাটাবেসের Timestamp ফিলিং লজিক ---
  const handleTripResponse = async (accepted) => {
    if (!activeTrip) return;
    const newStatus = accepted ? 'accepted' : 'cancelled';
    
    let updateData = { status: newStatus };
    if (accepted) {
      updateData.driver_accepted_time = new Date().toISOString(); // Timestamp
    }

    await supabase.from('trips').update(updateData).eq('id', activeTrip.id);
    
    if (accepted) {
      setActiveTrip(prev => ({ ...prev, status: 'accepted' }));
      calculateRoute(currentPosition, [activeTrip.start_location_lat, activeTrip.start_location_lng]);
    } else {
      setActiveTrip(null);
      setRouteToTarget([]);
      await supabase.from('ambulances').update({ status: 'available' }).eq('id', ambulance.id);
    }
  };

  const updateTripStatus = async (newStatus) => {
    let updateData = { status: newStatus };
    
    if (newStatus === 'arrived_patient') {
      updateData.arrived_at_patient_time = new Date().toISOString();
      setRouteToTarget([]); 
    } else if (newStatus === 'enroute_to_hospital') {
      updateData.enroute_to_hospital_time = new Date().toISOString();
      calculateRoute(currentPosition, [activeTrip.hospital_data.latitude, activeTrip.hospital_data.longitude]);
    } else if (newStatus === 'completed') {
      updateData.arrived_at_hospital_time = new Date().toISOString();
      updateData.final_fare = activeTrip.estimated_fare;
      setRouteToTarget([]);
    }

    await supabase.from('trips').update(updateData).eq('id', activeTrip.id);
    setActiveTrip(prev => ({ ...prev, status: newStatus }));
  };

  const handlePaymentCollected = async () => {
    await supabase.from('ambulances').update({ status: 'available' }).eq('id', ambulance.id);
    setActiveTrip(null);
  }

  // --- JSX Rendering ---
  if (!driver || !currentPosition) { return <div className="h-dvh flex items-center justify-center font-bold text-lg text-slate-600">Loading Driver Dashboard...</div>; }
  const targetPosition = activeTrip && (activeTrip.status === 'accepted' ? [activeTrip.start_location_lat, activeTrip.start_location_lng] : activeTrip.status === 'enroute_to_hospital' ? [activeTrip.hospital_data.latitude, activeTrip.hospital_data.longitude] : null);
  const targetIcon = activeTrip && (activeTrip.status === 'accepted' ? patientIcon : hospitalIcon);
  
  return (
    <div className="grow relative h-dvh overflow-hidden">
      {/* Map Layer */}
      <MapContainer center={currentPosition} zoom={16} scrollWheelZoom={true} className="h-full w-full absolute top-0 left-0 z-0">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={currentPosition} icon={ambulanceIcon}><Popup>Your Live Location</Popup></Marker>
        {targetPosition && <Marker position={targetPosition} icon={targetIcon} />}
        {routeToTarget.length > 0 && <Polyline positions={routeToTarget} color="#3b82f6" weight={6} opacity={0.8}/>}
      </MapContainer>

      {/* Top Header */}
      <div className="absolute top-0 left-0 w-full z-10 p-4 pt-5 md:pt-4">
          <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-xl p-2 w-full flex justify-between items-center">
            <div className='ml-2'>
              <h1 className="text-lg font-bold text-slate-800">{driver.full_name}</h1>
              <p className="text-xs text-slate-500 font-medium">{ambulance?.vehicle_number || "No Vehicle"}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleToggleOnline} disabled={!ambulance} className={`px-4 py-2 rounded-full font-bold text-white transition-colors duration-300 flex items-center gap-2 ${!ambulance ? 'bg-gray-300' : isOnline ? 'bg-green-500 hover:bg-green-600' : 'bg-slate-400 hover:bg-slate-500'}`}><Power size={18} /> {isOnline ? 'ONLINE' : 'OFFLINE'}</button>
              <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white p-2.5 rounded-full transition-colors"><LogOut size={18} /></button>
            </div>
          </div>
      </div>
      
      {/* New Trip Notification Popup */}
      {activeTrip && activeTrip.status === 'pending_driver' && (
        <div className="absolute inset-0 z-20 bg-black/60 flex items-end justify-center p-4 pb-24">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-red-500">
                <div className="text-center"><Siren size={40} className="text-red-500 mx-auto mb-3" /><h2 className="text-2xl font-bold text-slate-800">New Emergency!</h2></div>
                <div className="bg-slate-50 p-4 rounded-lg mt-5 text-sm space-y-2 border">
                    <div className="flex justify-between"><span className="font-semibold text-slate-600">Patient:</span><span className="font-medium text-slate-800">{activeTrip.patient_data?.phone_number || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="font-semibold text-slate-600">To:</span><span className="font-medium text-slate-800 truncate ml-2">{activeTrip.hospital_data?.hospital_name || "N/A"}</span></div>
                    <div className="flex justify-between border-t mt-2 pt-2"><span className="font-semibold text-slate-600">Fare:</span><span className="font-bold text-green-600 text-lg">৳{Math.round(activeTrip.estimated_fare)}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-5">
                    <button onClick={() => handleTripResponse(false)} className="bg-red-100 text-red-700 hover:bg-red-200 font-bold py-3 rounded-lg flex items-center justify-center gap-1"><X size={18}/> Reject</button>
                    <button onClick={() => handleTripResponse(true)} className="bg-green-600 text-white hover:bg-green-700 font-bold py-3 rounded-lg flex items-center justify-center gap-1 shadow-md"><Check size={18}/> Accept</button>
                </div>
            </div>
        </div>
      )}

      {/* Bottom Action Area (Status Buttons & Payment Screen) */}
      <div className="fixed bottom-0 left-0 w-full z-[1000] bg-white shadow-[0_-15px_40px_rgba(0,0,0,0.15)] p-5 rounded-t-3xl pb-8 md:pb-5">
        {!ambulance ? ( <div className='text-center font-bold text-red-500 py-2'>No ambulance assigned.</div> ) 
         : activeTrip ? (
             activeTrip.status === 'completed' ? (
                <div className="text-center animate-fade-in-up">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Collect Payment</h2>
                    <div className="bg-slate-50 p-4 rounded-xl border mb-4">
                        <p className="text-sm text-slate-500 font-medium">Total Fare</p>
                        <p className="text-4xl font-black text-green-600 mt-1">৳{Math.round(activeTrip.final_fare || activeTrip.estimated_fare)}</p>
                        <p className="text-xs text-slate-400 mt-2">Ask patient to pay via Cash or bKash App.</p>
                    </div>
                    <button onClick={handlePaymentCollected} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 shadow-md">Payment Collected & Finish</button>
                </div>
             )
            : activeTrip.status === 'accepted' ? <button onClick={() => updateTripStatus('arrived_patient')} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 shadow-md"><Navigation size={20}/> Arrived at Patient</button>
            : activeTrip.status === 'arrived_patient' ? <button onClick={() => updateTripStatus('enroute_to_hospital')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 shadow-md"><Navigation size={20}/> Start Trip to Hospital</button>
            : activeTrip.status === 'enroute_to_hospital' ? <button onClick={() => updateTripStatus('completed')} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 shadow-md"><CheckCircle size={20}/> End Trip at Hospital</button>
            : null
         )
         : isOnline ? <div className="text-center text-green-600 font-medium py-4 flex items-center justify-center gap-2"><Siren size={20} className="animate-pulse"/> Searching for requests...</div>
         : <div className="text-center text-slate-500 font-medium py-4">Go online to receive requests.</div>
        }
      </div>
    </div>
  );
};

export default DriverApp;