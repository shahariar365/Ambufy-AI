import React from 'react';
import { Link } from 'react-router-dom';
import { Siren, Clock, ShieldCheck, Activity, Lock, Car, ArrowRight } from 'lucide-react';

const Home = () => {
  const bgImageUrl = "https://t3.ftcdn.net/jpg/02/45/34/08/360_F_245340864_c5PkVqyHuhYwOnqOf49m50bu8UKzDT0g.jpg";

  return (
    <div className="h-screen w-screen relative flex flex-col items-center justify-center overflow-hidden bg-slate-900">
      
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgImageUrl})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-slate-900/40"></div>
      </div>

      {/* Main Content - Mobile এ pt-32 দিয়ে একটু নিচে নামানো হয়েছে */}
      <main className="relative z-10 w-full h-full max-w-7xl px-4 flex flex-col justify-center items-center text-center pt-32 sm:pt-20">
        
        {/* Top Siren Icon - mt-8 যোগ করা হয়েছে মোবাইল ভিউর ফাঁকা জায়গা কমাতে */}
        <div className="relative w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 mt-8 sm:mt-0 border border-white/20">
          <Siren size={36} className="text-red-500 animate-pulse relative z-10" />
          <div className="absolute inset-0 rounded-2xl bg-red-500/20 animate-ping"></div>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white mb-3 tracking-tight leading-tight">
          Emergency? <br/>
          <span className="text-red-500">Ambufy AI</span> is Here.
        </h1>
        
        <p className="text-sm sm:text-lg text-slate-300 mb-8 max-w-2xl font-medium">
          Dhaka's fastest AI-powered ambulance dispatch system.
        </p>

        <div className="mb-10">
          <Link 
            to="/request" 
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-10 rounded-full text-lg transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] flex items-center justify-center gap-3 active:scale-95 whitespace-nowrap"
          >
            <Siren size={22} />
            Request Ambulance Now
          </Link>
        </div>

        {/* Features Section */}
        <div className="w-full max-w-sm sm:max-w-4xl grow flex flex-col justify-end pb-12">
            <div className="w-full overflow-x-auto no-scrollbar snap-x snap-mandatory">
                <div className="flex sm:grid sm:grid-cols-3 gap-4 sm:gap-6 w-max sm:w-full mx-auto px-2">
                    
                    <div className="w-[80vw] sm:w-auto bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl text-left snap-center shrink-0">
                        <Activity className="text-blue-400 mb-4" size={32}/>
                        <h3 className="text-white font-bold text-xl mb-1">Smart Dispatch</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">AI predicts demand & dispatches the nearest vehicle to you.</p>
                    </div>

                    <div className="w-[80vw] sm:w-auto bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl text-left snap-center shrink-0">
                        <Clock className="text-green-400 mb-4" size={32}/>
                        <h3 className="text-white font-bold text-xl mb-1">Real-Time ETA</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">Get accurate arrival times factoring in current Dhaka traffic.</p>
                    </div>

                    <div className="w-[80vw] sm:w-auto bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl text-left snap-center shrink-0">
                        <ShieldCheck className="text-yellow-400 mb-4" size={32}/>
                        <h3 className="text-white font-bold text-xl mb-1">Verified Fleet</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">All drivers and vehicles are verified & well-equipped.</p>
                    </div>
                </div>
            </div>
            <div className="sm:hidden text-center mt-4 text-slate-500 text-xs font-semibold flex items-center justify-center gap-2 animate-pulse">
                Swipe to explore <ArrowRight size={14} />
            </div>
        </div>

      </main>

      {/* Bottom Corner Links */}
      <Link 
        to="/driver" 
        className="absolute bottom-4 left-4 text-white/40 hover:text-white/80 transition-colors p-2 z-50 flex items-center gap-2 sm:hidden"
      >
        <Car size={16} /> <span className="text-xs font-bold">Driver</span>
      </Link>
      <Link 
        to="/admin/login" 
        className="absolute bottom-4 right-4 text-white/20 hover:text-white/60 transition-colors p-2 z-50"
      >
        <Lock size={14} />
      </Link>

      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
};

export default Home;