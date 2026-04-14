import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Siren, LoaderCircle, Hospital, Car, MapPin as MapPinIcon, Clock, Navigation, CheckCircle } from 'lucide-react';
import L from 'leaflet';
import { supabase } from '../supabaseClient';

const ambulanceIcon = new L.Icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/2894/2894975.png', iconSize: [38, 38], iconAnchor: [19, 19], shadowUrl: null });
const hospitalIcon = new L.Icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/10476/10476199.png', iconSize: [35, 35], iconAnchor: [17, 35], shadowUrl: null });

const useLocationInfo = (position) => {
  const [info, setInfo] = useState({ zone: null, address: 'Loading address...' });
  useEffect(() => {
    if (!position) return;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position[0]}&lon=${position[1]}`)
      .then(res => res.json()).then(data => {
        const { road, suburb, neighbourhood, city } = data.address || {};
        let detectedZone = 'Dhanmondi & Green Road'; 
        if (suburb?.includes('Gulshan') || neighbourhood?.includes('Banani')) detectedZone = 'Gulshan & Banani';
        else if (suburb?.includes('Mirpur')) detectedZone = 'Mirpur - Central';
        setInfo({ zone: detectedZone, address: road || suburb || neighbourhood || city });
      });
  }, [position]);
  return info;
};

const PatientApp = () => {
  const [step, setStep] = useState('form');
  const [currentPosition, setCurrentPosition] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [formData, setFormData] = useState({ phone: '', emergency_type: 'Cardiac', required_ambulance_type: 'Any', hospital_id: '' });
  const [tripInfo, setTripInfo] = useState(null);
  const [error, setError] = useState('');
  
  const locationInfo = useLocationInfo(currentPosition);
  const [routeCoords, setRouteCoords] = useState([]);
  const [scheduleTime, setScheduleTime] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(pos => setCurrentPosition([pos.coords.latitude, pos.coords.longitude]));
    fetch('https://ambufy-ai.onrender.com/api/hospitals').then(res => res.json()).then(data => setHospitals(data));
  }, []);

  // --- EXACT FIX: পেশেন্ট অ্যাপ রিয়েল-টাইম ট্রিপ স্ট্যাটাস সিঙ্ক ---
   useEffect(() => {
    // যদি ট্রিপ আইডি না থাকে, তবে রিটার্ন করবে
    if (!tripInfo?.trip_id || step !== 'confirmed') {
        return;
    }

    console.log("🔥 Subscribing to Trip ID:", tripInfo.trip_id); // এই লাইনটি চেক করবে আইডি ঠিক আছে কিনা

    // চ্যানেলের নাম
    const patientTripChannel = supabase.channel(`patient-trip-${tripInfo.trip_id}-${Date.now()}`);
    
    patientTripChannel
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'trips', 
          filter: `id=eq.${tripInfo.trip_id}` 
      }, (payload) => {
        console.log("🚀 PATIENT RECEIVED UPDATE:", payload.new);
        
        // স্ট্যাটাস আপডেট করা
        if (payload.new && payload.new.status) {
            setTripInfo(prev => ({ 
                ...prev, 
                status: payload.new.status,
                final_fare: payload.new.final_fare || prev.final_fare
            }));
        }
      })
      .subscribe((status, err) => {
          if(status === 'SUBSCRIBED') {
              console.log("✅ Patient Realtime Subscribed Successfully!");
          }
          if(err) {
              console.error("❌ Patient Subscription Error:", err);
          }
      });

    return () => { supabase.removeChannel(patientTripChannel); };
  }, [tripInfo?.trip_id, step]);

  // --- পেশেন্ট অ্যাপে ড্রাইভারের লাইভ লোকেশন ট্র্যাকিং ---
  useEffect(() => {
    if (!tripInfo?.ambulance?.id || !['accepted', 'enroute_to_hospital'].includes(tripInfo?.status)) return;

    const patientAmbChannel = supabase.channel(`patient-amb-${tripInfo.ambulance.id}-${Date.now()}`);
    patientAmbChannel
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ambulances', filter: `id=eq.${tripInfo.ambulance.id}` }, (payload) => {
        setTripInfo(prev => ({
          ...prev, 
          ambulance: { ...prev.ambulance, current_lat: payload.new.current_lat, current_lng: payload.new.current_lng }
        }));
      })
      .subscribe();

    return () => { supabase.removeChannel(patientAmbChannel); };
  }, [tripInfo?.ambulance?.id, tripInfo?.status]);

  const handleRequest = async () => {
    if (!formData.phone) { setError('Please enter your phone number'); return; }
    setStep('searching'); setError('');
    
    try {
      const response = await fetch('https://ambufy-ai.onrender.com/api/patients/request-ambulance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formData.phone, emergency_type: formData.emergency_type, required_ambulance_type: formData.required_ambulance_type,
          hospital_id: formData.hospital_id ? parseInt(formData.hospital_id) : null,
          patient_lat: currentPosition[0], patient_lng: currentPosition[1], zone_name: locationInfo.zone
        })
      });
      const data = await response.json();
      if (!response.ok || data.status === 'failed') throw new Error(data.message || 'Could not find an ambulance.');
      
      setTripInfo(data);
      
      try { 
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${data.ambulance.current_lng},${data.ambulance.current_lat};${currentPosition[1]},${currentPosition[0]}?overview=full&geometries=geojson`;
        const routeData = await (await fetch(osrmUrl)).json();
        if (routeData.routes?.length > 0) setRouteCoords(routeData.routes[0].geometry.coordinates.map(c => [c[1], c[0]]));
      } catch (e) { console.error("Route error:", e); }

      setStep('payment');
    } catch (err) {
      setError(err.message || 'Failed to request ambulance.');
      setStep('form');
    }
  };

  const handleConfirmBooking = async () => {
      try {
        const res = await fetch('https://ambufy-ai.onrender.com/api/patients/confirm-trip', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trip_id: tripInfo.trip_id })
        });
        if (res.ok) {
          setTripInfo({...tripInfo, status: 'pending_driver'}); 
          setStep('confirmed');
        } else { alert("Failed to confirm booking."); }
      } catch (e) { console.error(e); }
  };

  if (!currentPosition) return <div className="flex h-screen items-center justify-center font-bold text-slate-500">Fetching your location...</div>;

  const ambPos = tripInfo?.ambulance ? [tripInfo.ambulance.current_lat, tripInfo.ambulance.current_lng] : null;
  const hosPos = tripInfo?.hospital ? [tripInfo.hospital.latitude, tripInfo.hospital.longitude] : null;


  return (
    <div className="grow relative">
      <div className="absolute top-0 left-0 h-full w-full z-0">
        <MapContainer center={currentPosition} zoom={15} scrollWheelZoom={true} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={currentPosition}><Popup>Your Location</Popup></Marker>
          
          {(step === 'payment' || step === 'confirmed') && ambPos && <Marker position={ambPos} icon={ambulanceIcon}><Popup>Ambulance</Popup></Marker>}
          {(step === 'payment' || step === 'confirmed') && hosPos && <Marker position={hosPos} icon={hospitalIcon}><Popup>Hospital</Popup></Marker>}
          {(step === 'payment' || step === 'confirmed') && routeCoords.length > 0 ? <Polyline positions={routeCoords} color="#3b82f6" weight={5} opacity={0.7} /> 
          : (step === 'payment' || step === 'confirmed') && ambPos ? <Polyline positions={[ambPos, currentPosition]} color="red" dashArray="5, 10" /> : null}
        </MapContainer>
      </div>
      
      <div className="absolute bottom-0 w-full z-10 bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] p-6 max-w-lg mx-auto left-0 right-0">
        
        {step === 'form' && (
          <form onSubmit={(e) => { e.preventDefault(); handleRequest(); }} className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Ambulance Request</h2>
            <div className='bg-slate-50 p-3 rounded-lg border'><p className='text-xs font-semibold text-slate-500 flex items-center gap-1'><MapPinIcon size={14}/> Your Location</p><p className='text-sm text-slate-700 font-medium'>{locationInfo.address}</p></div>
            <input name="manual_location" onChange={(e) => setFormData({...formData, location_text: e.target.value})} placeholder="Or type manually (e.g., House 1, Road 2)" className="w-full p-3 border rounded-lg outline-none focus:border-red-500" />
            {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
            <input name="phone" onChange={(e) => setFormData({...formData, phone: e.target.value})} required placeholder="Mobile Number (01...)" className="w-full p-3 border rounded-lg outline-none focus:border-red-500"/>
            
            <div className='grid grid-cols-2 gap-3'>
              <select name="emergency_type" onChange={(e) => setFormData({...formData, emergency_type: e.target.value})} className="w-full p-3 border rounded-lg bg-gray-50 outline-none">
                <option value="Cardiac">Cardiac</option><option value="Trauma">Trauma</option><option value="Respiratory">Respiratory</option><option value="Pregnancy">Pregnancy</option><option value="Other">Other</option>
              </select>
              <select name="required_ambulance_type" onChange={(e) => setFormData({...formData, required_ambulance_type: e.target.value})} className="w-full p-3 border rounded-lg bg-gray-50 outline-none">
                <option value="Any">Any Type</option><option value="ICU">ICU</option><option value="AC">AC</option><option value="Non-AC">Non-AC</option><option value="BLS">BLS</option><option value="ALS">ALS</option><option value="Freezer">Freezer</option>
              </select>
            </div>
            <select name="hospital_id" onChange={(e) => setFormData({...formData, hospital_id: e.target.value})} className="w-full p-3 border rounded-lg bg-gray-50 outline-none">
              <option value="">Nearest Suitable Hospital (Auto)</option>
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.hospital_name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3 mt-4">
  <button type="submit" className="w-full bg-red-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md hover:bg-red-700">
    <Siren size={18} /> Request Now
  </button>
  <button 
    type="button" 
    onClick={() => setIsScheduling(!isScheduling)} 
    className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md hover:bg-slate-900"
  >
    <Clock size={18} /> Schedule
  </button>
</div>

{/* যদি Schedule বাটন চাপে, তবে টাইম পিকার দেখাবে */}
{isScheduling && (
  <div className="mt-4 p-4 bg-slate-100 rounded-xl border animate-fade-in-up">
    <label className="block text-sm font-semibold text-slate-700 mb-2">Select Date & Time</label>
    <input 
      type="datetime-local" 
      value={scheduleTime}
      onChange={(e) => setScheduleTime(e.target.value)}
      className="w-full p-3 border rounded-lg outline-none focus:border-slate-800 mb-3"
    />
    <button 
      type="button" 
      onClick={() => {
        if(!scheduleTime) { alert("Please select a time."); return; }
        alert(`Trip Scheduled for ${new Date(scheduleTime).toLocaleString()}.\n\n(Backend Cron Job integration required for auto-dispatch)`);
        setStep('form');
        setIsScheduling(false);
      }}
      className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg shadow-md"
    >
      Confirm Schedule
    </button>
  </div>
)}
          </form>
        )}
        
        {step === 'searching' && ( <div className="text-center py-8"><LoaderCircle size={48} className="text-red-500 animate-spin mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-800">Finding Fastest Ambulance...</h2></div> )}

        {step === 'payment' && tripInfo && (
            <div>
                <h2 className="text-2xl text-center font-bold text-slate-800 mb-6">Confirm Your Ride</h2>
                <div className="bg-slate-50 p-4 rounded-xl border mb-4">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2"><Car className="text-blue-600" size={20}/><div><p className="font-bold text-slate-800">{tripInfo.ambulance.vehicle_number}</p><p className="text-xs text-slate-500">{tripInfo.ambulance.type} Ambulance</p></div></div>
                        <div className="text-right bg-blue-100 px-3 py-1 rounded-lg"><p className="text-xs font-semibold text-blue-800">Arrives in</p><p className="font-black text-blue-700 text-lg">{tripInfo.arrival_eta_mins} min</p></div>
                    </div>
                    <div className="border-t pt-3 mt-2 flex items-center gap-2"><Hospital className="text-rose-500" size={16}/><p className="text-sm font-semibold text-slate-700">{tripInfo.hospital.hospital_name}</p></div>
                </div>
                <div className="bg-rose-50 p-5 rounded-xl border border-rose-100 flex justify-between items-center mb-6">
                    <div><p className="text-sm font-bold text-rose-900">Estimated Fare</p><p className="text-xs text-rose-700 mt-0.5">Pay via Cash or Bkash</p></div>
                    <p className="text-4xl font-black text-rose-600">৳{Math.round(tripInfo.estimated_fare)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setStep('form')} className="w-full bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl">Cancel</button>
                    <button onClick={handleConfirmBooking} className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-md">Confirm Booking</button>
                </div>
            </div>
        )}

        {/* --- ফাইনাল ট্র্যাকিং এবং স্ট্যাটাস স্ক্রিন --- */}
        {step === 'confirmed' && tripInfo && (
            <div className="text-center py-4">
                
                {tripInfo.status === 'pending_driver' && (
                    <><div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse"><Siren className="text-blue-600" size={32} /></div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Waiting for Driver</h2>
                    <p className="text-slate-600 mb-6">Driver is reviewing your request...</p></>
                )}
                
                {tripInfo.status === 'accepted' && (
                    <><div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><Car className="text-green-600" size={32} /></div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Driver is on the way!</h2>
                    <div className="bg-slate-50 p-4 rounded-xl border flex justify-between items-center text-left mb-6">
                        <div><p className="text-xs font-bold text-slate-500 uppercase">Arriving in</p><p className="text-4xl font-black text-slate-800 mt-1">{tripInfo.arrival_eta_mins} <span className="text-xl text-slate-500">min</span></p></div>
                        <div className="animate-pulse flex items-center gap-2 text-blue-600 font-semibold text-sm bg-blue-100 px-3 py-2 rounded-lg"><LoaderCircle size={16} className="animate-spin" /> Live Tracking</div>
                    </div></>
                )}

                {tripInfo.status === 'arrived_patient' && (
                    <><div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce"><Siren className="text-orange-600" size={32} /></div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Ambulance Arrived!</h2>
                    <p className="text-slate-600 font-medium mb-6 text-lg">Please go outside and board the ambulance.</p></>
                )}

                {tripInfo.status === 'enroute_to_hospital' && (
                     <><div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"><Navigation className="text-blue-600" size={32} /></div>
                     <h2 className="text-2xl font-bold text-slate-800 mb-2">Heading to Hospital</h2>
                     <p className="text-slate-600 mb-6">Stay calm. You are in safe hands.</p></>
                )}

                {tripInfo.status === 'completed' && (
                     <div className="animate-fade-in-up">
                     <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="text-green-600" size={32} /></div>
                     <h2 className="text-2xl font-bold text-slate-800 mb-2">Trip Completed</h2>
                     <p className="text-slate-600 mb-4">Hope you reach safety soon.</p>
                     
                     <div className="bg-slate-50 p-6 rounded-2xl border mb-6">
                         <p className="text-sm font-bold text-slate-500">Amount to Pay</p>
                         <p className="text-5xl font-black text-green-600 my-2">৳{Math.round(tripInfo.final_fare || tripInfo.estimated_fare)}</p>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                         <button onClick={() => { alert('Cash Payment Handed to Driver'); setStep('form'); }} className="bg-slate-800 text-white font-bold py-3 rounded-xl">Pay via Cash</button>
                         <button onClick={() => { alert('Redirecting to bKash App...'); setStep('form'); }} className="bg-pink-600 text-white font-bold py-3 rounded-xl">Pay via bKash</button>
                     </div>
                  </div>
                )}
                
                {['pending_driver', 'accepted'].includes(tripInfo.status) && (
                   <button onClick={() => setStep('form')} className="text-sm font-semibold text-slate-500 hover:text-red-500 underline mt-4">Cancel Trip</button>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default PatientApp;