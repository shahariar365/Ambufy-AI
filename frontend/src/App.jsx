import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import AdminLogin from './pages/AdminLogin';
import Home from './pages/Home';
import PatientApp from './pages/PatientApp';
import DriverApp from './pages/DriverApp';
import AdminDashboard from './pages/AdminDashboard';
import Reports from './pages/Reports';
import FleetStatus from './pages/FleetStatus';
import AddDriver from './pages/AddDriver';
import DriverLogin from './pages/DriverLogin';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <Navbar />
        <div className="grow flex flex-col">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/request" element={<PatientApp />} />
            <Route path="/driver" element={<DriverLogin />} />
            <Route path="/driver/dashboard" element={<DriverApp />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/reports" element={<Reports />} />
            <Route path="/admin/fleet" element={<FleetStatus />} />
            <Route path="/admin/add-driver" element={<AddDriver />} />            
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;