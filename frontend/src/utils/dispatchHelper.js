import { supabase } from '../supabaseClient';

export const executeSmartDispatch = async (suggestions, zones, fleet) => {
    if (!suggestions || suggestions.length === 0) {
        alert("No dispatch suggestions available.");
        return false;
    }

    try {
        let dispatchPromises = [];

        for (const sug of suggestions) {
            // টার্গেট জোনের সেন্টার কোঅর্ডিনেট বের করা
            const targetZone = zones.find(z => z.name === sug.to);
            if (!targetZone) continue;

            // শুধুমাত্র ডামি অ্যাম্বুলেন্স (যাদের driver_id নেই) এবং available গাড়িগুলো ফিল্টার করা
            const availableDummyCars = fleet.filter(a => a.status === 'available' && !a.driver_id);
            
            // যতগুলো গাড়ি দরকার ততগুলো সিলেক্ট করা
            const carsToMove = availableDummyCars.slice(0, sug.count);

            for (const car of carsToMove) {
                // সব গাড়ি একই বিন্দুতে না গিয়ে জোনের আশেপাশে একটু ছড়ানো ছিটানো থাকবে
                const newLat = targetZone.coords[0] + (Math.random() - 0.5) * 0.015;
                const newLng = targetZone.coords[1] + (Math.random() - 0.5) * 0.015;

                // ডাটাবেসে আপডেট প্রমিজ অ্যাড করা
                const promise = supabase.from('ambulances')
                    .update({ current_lat: newLat, current_lng: newLng })
                    .eq('id', car.id);
                
                dispatchPromises.push(promise);
            }
        }

        // সব আপডেট একসাথে Execute করা
        await Promise.all(dispatchPromises);
        return true; // Success
    } catch (error) {
        console.error("Dispatch Error:", error);
        return false; // Failed
    }
};