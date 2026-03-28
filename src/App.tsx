/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Calendar, 
  Users, 
  Car, 
  Plane, 
  Train, 
  Bus, 
  Wallet, 
  TrendingUp, 
  Navigation, 
  ChevronRight,
  Info,
  PieChart as PieChartIcon,
  ArrowRight,
  Map as MapIcon,
  Hotel,
  Utensils,
  Sparkles
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { 
  GoogleMap, 
  useJsApiLoader, 
  DirectionsService, 
  DirectionsRenderer,
  Autocomplete,
  Marker,
  InfoWindow,
  Libraries
} from '@react-google-maps/api';
import { cn } from './lib/utils';
import { GoogleGenAI } from "@google/genai";
import { TripDetails, CostEstimation, BUDGET_RATES, FUEL_PRICE } from './types';

const GOOGLE_MAPS_LIBRARIES: Libraries = ["places"];
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

declare global {
  interface Window {
    gm_authFailure: () => void;
  }
}

// Use the standard Vite way to access environment variables, with process.env fallback from vite.config.ts
const GOOGLE_MAPS_API_KEY = ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || (process.env as any).VITE_GOOGLE_MAPS_API_KEY || "").trim();

// Defensive check for missing or placeholder keys
const IS_GOOGLE_MAPS_CONFIGURED = !!(GOOGLE_MAPS_API_KEY && 
                                  GOOGLE_MAPS_API_KEY !== "undefined" && 
                                  GOOGLE_MAPS_API_KEY !== "null" && 
                                  !GOOGLE_MAPS_API_KEY.startsWith("YOUR_"));

function GoogleMapsLoader({ children }: { children: (isLoaded: boolean) => React.ReactNode }) {
  if (!IS_GOOGLE_MAPS_CONFIGURED) {
    return <>{children(false)}</>;
  }
  return <LoaderInner children={children} />;
}

function LoaderInner({ children }: { children: (isLoaded: boolean) => React.ReactNode }) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  if (loadError) {
    console.error("Google Maps Load Error:", loadError);
    // If there's an error loading the API (e.g. invalid key), fallback to demo mode
    return <>{children(false)}</>;
  }

  return <>{children(isLoaded)}</>;
}

// ... existing calculateDistance ...
// In a real app, this would call Google Maps Distance Matrix API
// We use Gemini as a smart fallback for realistic estimates when Google Maps is not available
const calculateDistance = async (source: string, destination: string, transportMode: string): Promise<{ distance: number; duration: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Estimate the road distance and travel duration between "${source}" and "${destination}" using ${transportMode}. 
      Return ONLY a JSON object with "distance" (number in km) and "duration" (string like "2h 30m"). 
      No other text. If you can't estimate, use 100km and 2h.`,
      config: {
        responseMimeType: "application/json",
      }
    });
    
    const result = JSON.parse(response.text || "{}");
    if (result.distance && result.duration) {
      return {
        distance: Number(result.distance),
        duration: String(result.duration)
      };
    }
  } catch (error) {
    console.error("AI distance estimation failed", error);
  }

  // Fallback to basic mock if AI fails
  const dist = Math.abs(source.length + destination.length) * 15 + 50;
  const hours = Math.floor(dist / 60);
  const mins = dist % 60;
  
  return {
    distance: dist,
    duration: `${hours}h ${mins}m`
  };
};

export default function App() {
  return (
    <GoogleMapsLoader>
      {(isLoaded) => <AppContent isLoaded={isLoaded} />}
    </GoogleMapsLoader>
  );
}

const MOCK_CITIES = [
  "Mumbai, Maharashtra, India", "Delhi, India", "Bangalore, Karnataka, India", "Hyderabad, Telangana, India", 
  "Ahmedabad, Gujarat, India", "Chennai, Tamil Nadu, India", "Kolkata, West Bengal, India", "Surat, Gujarat, India", 
  "Pune, Maharashtra, India", "Jaipur, Rajasthan, India", "Lucknow, Uttar Pradesh, India", "Kanpur, Uttar Pradesh, India", 
  "Nagpur, Maharashtra, India", "Indore, Madhya Pradesh, India", "Thane, Maharashtra, India", "Bhopal, Madhya Pradesh, India", 
  "Visakhapatnam, Andhra Pradesh, India", "Patna, Bihar, India", "Vadodara, Gujarat, India", "Ghaziabad, Uttar Pradesh, India", 
  "Ludhiana, Punjab, India", "Agra, Uttar Pradesh, India", "Nashik, Maharashtra, India", "Faridabad, Haryana, India", 
  "Meerut, Uttar Pradesh, India", "Rajkot, Gujarat, India", "Varanasi, Uttar Pradesh, India", "Srinagar, Jammu and Kashmir, India", 
  "Aurangabad, Maharashtra, India", "Dhanbad, Jharkhand, India", "Amritsar, Punjab, India", "Navi Mumbai, Maharashtra, India", 
  "Allahabad, Uttar Pradesh, India", "Ranchi, Jharkhand, India", "Howrah, West Bengal, India", "Coimbatore, Tamil Nadu, India", 
  "Jabalpur, Madhya Pradesh, India", "Gwalior, Madhya Pradesh, India", "Vijayawada, Andhra Pradesh, India", "Jodhpur, Rajasthan, India", 
  "Madurai, Tamil Nadu, India", "Raipur, Chhattisgarh, India", "Kota, Rajasthan, India", "Guwahati, Assam, India", 
  "Chandigarh, India", "Solapur, Maharashtra, India", "Hubli-Dharwad, Karnataka, India", "London, United Kingdom", 
  "New York, NY, USA", "Paris, France", "Tokyo, Japan", "Dubai, United Arab Emirates", "Singapore", 
  "Barcelona, Spain", "Rome, Italy", "Istanbul, Turkey", "Amsterdam, Netherlands"
];

function MockAutocomplete({ value, onChange, placeholder, icon: Icon }: { 
  value: string, 
  onChange: (val: string) => void, 
  placeholder: string,
  icon: any
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (val.length > 0) {
      const filtered = MOCK_CITIES.filter(city => 
        city.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
      setIsOpen(true);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
      <input 
        type="text" 
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
        value={value}
        onChange={handleInputChange}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        onFocus={() => value.length > 0 && setIsOpen(true)}
      />
      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
          >
            {suggestions.map((city, i) => (
              <button
                key={i}
                className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 flex items-center gap-3"
                onClick={() => {
                  onChange(city);
                  setIsOpen(false);
                }}
              >
                <MapPin className="w-3 h-3 text-blue-500" />
                <span className="truncate">{city}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AppContent({ isLoaded }: { isLoaded: boolean }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [mapsApiError, setMapsApiError] = useState(false);

  // Handle Google Maps authentication failures (e.g. invalid API key)
  useEffect(() => {
    window.gm_authFailure = () => {
      console.error("Google Maps authentication failed. Falling back to demo mode.");
      setMapsApiError(true);
    };
    return () => {
      window.gm_authFailure = () => {};
    };
  }, []);

  const effectiveIsLoaded = isLoaded && !mapsApiError && typeof google !== 'undefined';

  const [tripDetails, setTripDetails] = useState<TripDetails>({
    source: '',
    destination: '',
    days: 3,
    travelers: 2,
    transportMode: 'car',
    budgetCategory: 'mid-range',
    vehicleMileage: 15,
    includeInsurance: false,
    insuranceCost: 500
  });

  const [estimation, setEstimation] = useState<CostEstimation | null>(null);
  const [aiTips, setAiTips] = useState<string[]>([]);
  const [isGeneratingTips, setIsGeneratingTips] = useState(false);
  const [directionsResponse, setDirectionsResponse] = useState<any | null>(null);
  const [waypoints, setWaypoints] = useState<any[]>([]);
  const [mapTypeId, setMapTypeId] = useState<string>("roadmap");
  const [poiMarkers, setPoiMarkers] = useState<any[]>([]);
  const [hotels, setHotels] = useState<any[]>([]);
  const [selectedPoi, setSelectedPoi] = useState<any | null>(null);
  const [detailedHotel, setDetailedHotel] = useState<any | null>(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [minRating, setMinRating] = useState<number>(0);

  const [isSplit, setIsSplit] = useState(false);

  const onMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng && effectiveIsLoaded && directionsResponse) {
      const newWaypoint: google.maps.DirectionsWaypoint = {
        location: e.latLng,
        stopover: true,
      };
      setWaypoints(prev => [...prev, newWaypoint]);
    }
  };

  const fetchHotelDetails = (placeId: string) => {
    if (!effectiveIsLoaded || !placeId) return;
    setIsFetchingDetails(true);
    const service = new google.maps.places.PlacesService(document.createElement('div'));
    service.getDetails({
      placeId: placeId,
      fields: ['name', 'rating', 'formatted_phone_number', 'vicinity', 'reviews', 'website', 'url', 'opening_hours', 'photos', 'user_ratings_total', 'place_id']
    }, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        setDetailedHotel(place);
      }
      setIsFetchingDetails(false);
    });
  };

  useEffect(() => {
    if (effectiveIsLoaded && waypoints.length > 0 && tripDetails.source && tripDetails.destination) {
      const directionsService = new google.maps.DirectionsService();
      directionsService.route({
        origin: tripDetails.source,
        destination: tripDetails.destination,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
      }, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          setDirectionsResponse(result);
          if (result && result.routes[0]) {
            let totalDist = 0;
            let totalDur = 0;
            result.routes[0].legs.forEach(leg => {
              totalDist += leg.distance?.value || 0;
              totalDur += leg.duration?.value || 0;
            });
            setEstimation(prev => prev ? {
              ...prev,
              distance: totalDist / 1000,
              duration: `${Math.floor(totalDur / 3600)}h ${Math.floor((totalDur % 3600) / 60)}m`
            } : null);
          }
        }
      });
    }
  }, [waypoints, effectiveIsLoaded, tripDetails.source, tripDetails.destination]);

  const [sourceAutocomplete, setSourceAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [destAutocomplete, setDestAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const onSourceLoad = (autocomplete: google.maps.places.Autocomplete) => setSourceAutocomplete(autocomplete);
  const onDestLoad = (autocomplete: google.maps.places.Autocomplete) => setDestAutocomplete(autocomplete);

  const onSourcePlaceChanged = () => {
    if (sourceAutocomplete !== null) {
      const place = sourceAutocomplete.getPlace();
      if (place.formatted_address) {
        setTripDetails(prev => ({ ...prev, source: place.formatted_address! }));
      }
    }
  };

  const onDestPlaceChanged = () => {
    if (destAutocomplete !== null) {
      const place = destAutocomplete.getPlace();
      if (place.formatted_address) {
        setTripDetails(prev => ({ ...prev, destination: place.formatted_address! }));
      }
    }
  };

  const generateAiTips = async (dest: string, budget: string, transport: string) => {
    setIsGeneratingTips(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide 3 short, practical travel tips for someone visiting ${dest} with a ${budget} budget, traveling by ${transport}. Focus on local culture, hidden gems, or safety. Keep each tip under 15 words. Format as a simple list.`,
      });
      const tips = response.text?.split('\n').filter(t => t.trim()).map(t => t.replace(/^\d+\.\s*/, '').trim()) || [];
      setAiTips(tips.slice(0, 3));
    } catch (error) {
      console.error("AI tips failed", error);
      setAiTips([
        "Check local weather before heading out.",
        "Carry a reusable water bottle.",
        "Keep digital copies of your documents."
      ]);
    } finally {
      setIsGeneratingTips(false);
    }
  };

  const handleCalculate = async () => {
    setLoading(true);
    try {
      let distance = 0;
      let duration = "0h 0m";

      // Try to get real distance if Google Maps is loaded
      if (effectiveIsLoaded && tripDetails.source && tripDetails.destination && typeof google !== 'undefined') {
        try {
          const service = new google.maps.DistanceMatrixService();
          const response = await service.getDistanceMatrix({
            origins: [tripDetails.source],
            destinations: [tripDetails.destination],
            travelMode: google.maps.TravelMode.DRIVING,
          });

          const element = response.rows[0].elements[0];
          if (element.status === 'OK') {
            distance = element.distance.value / 1000; // meters to km
            duration = element.duration.text;
          } else {
            const mock = await calculateDistance(tripDetails.source, tripDetails.destination, tripDetails.transportMode);
            distance = mock.distance;
            duration = mock.duration;
          }
        } catch (e) {
          console.error("Distance Matrix failed", e);
          const mock = await calculateDistance(tripDetails.source, tripDetails.destination, tripDetails.transportMode);
          distance = mock.distance;
          duration = mock.duration;
        }
      } else {
        const mock = await calculateDistance(tripDetails.source, tripDetails.destination, tripDetails.transportMode);
        distance = mock.distance;
        duration = mock.duration;
      }

      generateAiTips(tripDetails.destination, tripDetails.budgetCategory, tripDetails.transportMode);
      
      const rates = BUDGET_RATES[tripDetails.budgetCategory];
      
      let fuelCost = 0;
      if (tripDetails.transportMode === 'car') {
        fuelCost = (distance / (tripDetails.vehicleMileage || 15)) * FUEL_PRICE;
      } else {
        // Mock ticket prices for other modes
        const baseTicket = tripDetails.transportMode === 'flight' ? 5000 : tripDetails.transportMode === 'train' ? 1200 : 800;
        fuelCost = baseTicket * tripDetails.travelers;
      }

      const accommodationCost = rates.accommodation * tripDetails.days * Math.ceil(tripDetails.travelers / 2);
      const foodCost = rates.food * tripDetails.days * tripDetails.travelers;
      const otherExpenses = 0; // Miscellaneous removed as per user request
      const insuranceCost = tripDetails.includeInsurance ? tripDetails.insuranceCost * tripDetails.travelers : 0;
      
      const totalCost = fuelCost + accommodationCost + foodCost + otherExpenses + insuranceCost;

      setEstimation({
        fuelCost,
        accommodationCost,
        foodCost,
        otherExpenses,
        insuranceCost,
        totalCost,
        distance,
        duration
      });

      // Fetch directions for the map
      if (effectiveIsLoaded && typeof google !== 'undefined') {
        try {
          const directionsService = new google.maps.DirectionsService();
          const results = await directionsService.route({
            origin: tripDetails.source,
            destination: tripDetails.destination,
            waypoints: waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
          });
          setDirectionsResponse(results);

          // Fetch POIs near destination
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ address: tripDetails.destination }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
              const location = results[0].geometry.location;
              const service = new google.maps.places.PlacesService(document.createElement('div'));
              
              // Fetch Tourist Attractions
              service.nearbySearch({
                location,
                radius: 5000,
                type: 'tourist_attraction'
              }, (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                  setPoiMarkers(results.slice(0, 10));
                }
              });

              // Fetch Hotels based on budget
              const priceLevels = {
                'budget': [0, 1],
                'mid-range': [2],
                'luxury': [3, 4]
              };

              service.nearbySearch({
                location,
                radius: 10000,
                type: 'lodging',
                // @ts-ignore - priceLevel is supported by the API but might be missing in types
                priceLevel: priceLevels[tripDetails.budgetCategory]
              }, (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                  setHotels(results.slice(0, 5));
                }
              });
            }
          });
        } catch (e) {
          console.error("Directions lookup failed", e);
        }
      }

      setStep(2);
    } catch (error) {
      console.error("Calculation failed", error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!estimation) return [];
    return [
      { name: 'Transport', value: Math.round(estimation.fuelCost), color: '#3b82f6' },
      { name: 'Stay', value: Math.round(estimation.accommodationCost), color: '#10b981' },
      { name: 'Food', value: Math.round(estimation.foodCost), color: '#f59e0b' },
    ];
  }, [estimation]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Navigation className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">TripWise</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Planner</a>
            <a href="#" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Explore</a>
            <a href="#" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Community</a>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid lg:grid-cols-2 gap-16 items-center"
            >
              <div className="space-y-8">
                <div className="space-y-4">
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-widest rounded-full"
                  >
                    Smart Travel Assistant
                  </motion.span>
                  <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
                    Plan your next <span className="text-blue-600">adventure</span> with precision.
                  </h1>
                  <p className="text-lg text-slate-500 max-w-lg leading-relaxed">
                    Get accurate cost estimations for fuel, stay, and daily expenses. Optimize your budget before you even pack your bags.
                  </p>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                        <span>Source</span>
                      </label>
                      <div className="relative">
                        {effectiveIsLoaded ? (
                          <>
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                            <Autocomplete onLoad={onSourceLoad} onPlaceChanged={onSourcePlaceChanged}>
                              <input 
                                type="text" 
                                placeholder="Starting point"
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                                value={tripDetails.source}
                                onChange={e => setTripDetails({...tripDetails, source: e.target.value})}
                              />
                            </Autocomplete>
                          </>
                        ) : (
                          <MockAutocomplete 
                            value={tripDetails.source}
                            onChange={(val) => setTripDetails({...tripDetails, source: val})}
                            placeholder="Starting point"
                            icon={MapPin}
                          />
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                        <span>Destination</span>
                      </label>
                      <div className="relative">
                        {effectiveIsLoaded ? (
                          <>
                            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                            <Autocomplete onLoad={onDestLoad} onPlaceChanged={onDestPlaceChanged}>
                              <input 
                                type="text" 
                                placeholder="Where to?"
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                                value={tripDetails.destination}
                                onChange={e => setTripDetails({...tripDetails, destination: e.target.value})}
                              />
                            </Autocomplete>
                          </>
                        ) : (
                          <MockAutocomplete 
                            value={tripDetails.destination}
                            onChange={(val) => setTripDetails({...tripDetails, destination: val})}
                            placeholder="Where to?"
                            icon={Navigation}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Duration (Days)</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="number" 
                          min="1"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                          value={tripDetails.days}
                          onChange={e => setTripDetails({...tripDetails, days: parseInt(e.target.value) || 1})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Travelers</label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="number" 
                          min="1"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                          value={tripDetails.travelers}
                          onChange={e => setTripDetails({...tripDetails, travelers: parseInt(e.target.value) || 1})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transport Mode</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'car', icon: Car },
                        { id: 'flight', icon: Plane },
                        { id: 'train', icon: Train },
                        { id: 'bus', icon: Bus }
                      ].map(mode => (
                        <button
                          key={mode.id}
                          onClick={() => setTripDetails({...tripDetails, transportMode: mode.id as any})}
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1",
                            tripDetails.transportMode === mode.id 
                              ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200" 
                              : "bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300"
                          )}
                        >
                          <mode.icon className="w-5 h-5" />
                          <span className="text-[10px] font-bold uppercase">{mode.id}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {tripDetails.transportMode === 'car' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2"
                    >
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vehicle Mileage (km/L)</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                        value={tripDetails.vehicleMileage}
                        onChange={e => setTripDetails({...tripDetails, vehicleMileage: parseInt(e.target.value) || 15})}
                      />
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Budget Preference</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['budget', 'mid-range', 'luxury'].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setTripDetails({...tripDetails, budgetCategory: cat as any})}
                          className={cn(
                            "py-2 rounded-xl border text-xs font-bold uppercase transition-all",
                            tripDetails.budgetCategory === cat 
                              ? "bg-slate-900 border-slate-900 text-white" 
                              : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                          <Info className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-slate-700">Travel Insurance</span>
                      </div>
                      <button 
                        onClick={() => setTripDetails(prev => ({ ...prev, includeInsurance: !prev.includeInsurance }))}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          tripDetails.includeInsurance ? "bg-blue-600" : "bg-slate-300"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          tripDetails.includeInsurance ? "left-7" : "left-1"
                        )} />
                      </button>
                    </div>
                    {tripDetails.includeInsurance && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2"
                      >
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Insurance Cost per Person (₹)</label>
                        <input 
                          type="number" 
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                          value={tripDetails.insuranceCost}
                          onChange={e => setTripDetails({...tripDetails, insuranceCost: parseInt(e.target.value) || 0})}
                        />
                      </motion.div>
                    )}
                  </div>

                  <button 
                    onClick={handleCalculate}
                    disabled={loading || !tripDetails.source || !tripDetails.destination}
                    className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Calculate Budget
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                  <button 
                    onClick={() => setStep(1)}
                    className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Back to Planner
                  </button>
                  <h2 className="text-4xl font-extrabold text-slate-900">Trip Estimation</h2>
                  <p className="text-slate-500 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {tripDetails.source} <ArrowRight className="w-3 h-3" /> {tripDetails.destination}
                  </p>
                </div>
                <div className="bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Distance</p>
                    <p className="text-xl font-bold text-slate-900">{estimation?.distance} km</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200" />
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Duration</p>
                    <p className="text-xl font-bold text-slate-900">{estimation?.duration}</p>
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-8">
                {/* Main Cost Card */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                      <Wallet className="w-32 h-32" />
                    </div>
                    <div className="relative z-10 space-y-8">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-6">
                            <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                  <Wallet className="w-4 h-4 text-blue-600" />
                                </div>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                                  {isSplit ? "Budget / Person" : "Total Budget"}
                                </p>
                                <button 
                                  onClick={() => setIsSplit(!isSplit)}
                                  className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all",
                                    isSplit ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  )}
                                >
                                  {isSplit ? "Show Total" : "Split"}
                                </button>
                              </div>
                              <h3 className="text-6xl font-black text-slate-900">
                                ₹{Math.round(isSplit ? (estimation?.totalCost || 0) / tripDetails.travelers : (estimation?.totalCost || 0)).toLocaleString()}
                              </h3>
                            </div>
                            <div className="h-16 w-px bg-slate-100" />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-50 rounded-lg">
                                  <MapIcon className="w-4 h-4 text-emerald-600" />
                                </div>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Distance</p>
                              </div>
                              <h3 className="text-4xl font-black text-blue-600">
                                {estimation?.distance || "0"} <span className="text-lg font-bold text-slate-400 uppercase">km</span>
                              </h3>
                            </div>
                          </div>
                        <div className="bg-green-50 text-green-600 px-4 py-2 rounded-xl flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          <span className="text-sm font-bold">Optimized</span>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-8 items-center">
                        <div className="h-[250px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <RechartsTooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-4">
                          {chartData.map((item) => (
                            <div key={item.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-sm font-semibold text-slate-600">{item.name}</span>
                              </div>
                              <span className="text-sm font-bold text-slate-900">₹{item.value.toLocaleString()}</span>
                            </div>
                          ))}
                          {tripDetails.includeInsurance && (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-blue-400" />
                                <span className="text-sm font-semibold text-blue-700">Insurance</span>
                              </div>
                              <span className="text-sm font-bold text-blue-900">₹{estimation?.insuranceCost.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                        <Hotel className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Accommodation</p>
                        <p className="text-lg font-bold">₹{estimation?.accommodationCost.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500 mt-1">Based on {tripDetails.budgetCategory} stay</p>
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                        <Utensils className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Food & Dining</p>
                        <p className="text-lg font-bold">₹{estimation?.foodCost.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500 mt-1">₹{BUDGET_RATES[tripDetails.budgetCategory].food}/day per person</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar / Recommendations */}
                <div className="space-y-6">
                  <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl space-y-6">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-6 h-6 text-blue-400" />
                      <h4 className="text-xl font-bold">Smart Tips</h4>
                    </div>
                    <ul className="space-y-4">
                      {isGeneratingTips ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="h-4 bg-white/10 rounded animate-pulse w-full" />
                          ))}
                        </div>
                      ) : (
                        aiTips.map((tip, idx) => (
                          <li key={idx} className="flex gap-3">
                            <div className="w-5 h-5 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                            </div>
                            <p className="text-sm text-slate-300 leading-relaxed">
                              {tip}
                            </p>
                          </li>
                        ))
                      )}
                      {!isGeneratingTips && aiTips.length === 0 && (
                        <li className="flex gap-3">
                          <div className="w-5 h-5 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                          </div>
                          <p className="text-sm text-slate-300 leading-relaxed">
                            Traveling by <span className="text-white font-medium">{tripDetails.transportMode}</span> is cost-effective for this distance.
                          </p>
                        </li>
                      )}
                    </ul>
                    <button className="w-full bg-white/10 hover:bg-white/20 py-3 rounded-xl text-sm font-bold transition-all border border-white/10">
                      View Detailed Itinerary
                    </button>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-800">Transport Details</h4>
                      <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {tripDetails.transportMode}
                      </div>
                    </div>
                    <div className="space-y-4">
                      {tripDetails.transportMode === 'flight' && (
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                            <Plane className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-blue-400 uppercase">Recommended Flight</p>
                            <p className="text-sm font-bold text-blue-900">Indigo 6E-2104 (Non-stop)</p>
                            <p className="text-[10px] text-blue-600 mt-0.5">Approx. ₹{Math.round(estimation?.fuelCost || 0).toLocaleString()} for {tripDetails.travelers} pax</p>
                            <a 
                              href={`https://www.google.com/travel/flights?q=Flights+from+${tripDetails.source}+to+${tripDetails.destination}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-2 px-3 py-1 bg-blue-600 text-white text-[10px] font-bold uppercase rounded-lg hover:bg-blue-700 transition-all"
                            >
                              View Deal
                            </a>
                          </div>
                        </div>
                      )}
                      {tripDetails.transportMode === 'train' && (
                        <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                            <Train className="w-6 h-6 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-orange-400 uppercase">Recommended Train</p>
                            <p className="text-sm font-bold text-orange-900">Rajdhani Express (3AC)</p>
                            <p className="text-[10px] text-orange-600 mt-0.5">Approx. ₹{Math.round(estimation?.fuelCost || 0).toLocaleString()} for {tripDetails.travelers} pax</p>
                            <a 
                              href="https://www.irctc.co.in/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-2 px-3 py-1 bg-orange-600 text-white text-[10px] font-bold uppercase rounded-lg hover:bg-orange-700 transition-all"
                            >
                              Book Now
                            </a>
                          </div>
                        </div>
                      )}
                      {tripDetails.transportMode === 'bus' && (
                        <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                            <Bus className="w-6 h-6 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-purple-400 uppercase">Recommended Bus</p>
                            <p className="text-sm font-bold text-purple-900">Volvo AC Sleeper</p>
                            <p className="text-[10px] text-purple-600 mt-0.5">Approx. ₹{Math.round(estimation?.fuelCost || 0).toLocaleString()} for {tripDetails.travelers} pax</p>
                            <a 
                              href="https://www.redbus.in/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-2 px-3 py-1 bg-purple-600 text-white text-[10px] font-bold uppercase rounded-lg hover:bg-purple-700 transition-all"
                            >
                              View Deal
                            </a>
                          </div>
                        </div>
                      )}
                      {tripDetails.transportMode === 'car' && (
                        <div className="p-4 bg-green-50 rounded-xl border border-green-100 flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                            <Car className="w-6 h-6 text-green-600" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-green-400 uppercase">Road Trip Info</p>
                            <p className="text-sm font-bold text-green-900">Estimated Fuel: {Math.round((estimation?.distance || 0) / (tripDetails.vehicleMileage || 15))} Liters</p>
                            <p className="text-[10px] text-green-600 mt-0.5">Average Fuel Price: ₹{FUEL_PRICE}/L</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-800">Recommended Stays near {tripDetails.destination}</h4>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Top rated hotels near your destination</p>
                      </div>
                      <Hotel className="w-5 h-5 text-emerald-500" />
                    </div>

                    {/* Rating Filter */}
                    <div className="flex items-center gap-2 pb-2 overflow-x-auto no-scrollbar">
                      <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Filter:</span>
                      {[0, 3, 4, 4.5].map((r) => (
                        <button
                          key={r}
                          onClick={() => setMinRating(r)}
                          className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold transition-all whitespace-nowrap border",
                            minRating === r 
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-sm" 
                              : "bg-slate-50 border-slate-200 text-slate-500 hover:border-emerald-200"
                          )}
                        >
                          {r === 0 ? "All" : `${r}+ ⭐`}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-3">
                      {hotels.filter(h => (h.rating || 0) >= minRating).length > 0 ? (
                        hotels.filter(h => (h.rating || 0) >= minRating).map((hotel, i) => (
                          <div 
                            key={i} 
                            className="p-4 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group cursor-pointer"
                            onClick={() => {
                              if (hotel.geometry?.location) {
                                setSelectedPoi(hotel);
                              }
                            }}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="space-y-0.5">
                                <h5 className="font-bold text-sm text-slate-800 group-hover:text-emerald-700">{hotel.name}</h5>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex items-center gap-1 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                                    <Sparkles className="w-2.5 h-2.5 text-orange-400" />
                                    <span className="text-[10px] font-bold text-orange-700">{hotel.rating || 'N/A'}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-medium">({hotel.user_ratings_total || 0} reviews)</span>
                                </div>
                              </div>
                              <div className="flex gap-0.5">
                                {[...Array(4)].map((_, idx) => (
                                  <span key={idx} className={cn("text-[10px] font-bold", idx < (hotel.price_level || 2) ? "text-emerald-600" : "text-slate-200")}>₹</span>
                                ))}
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-2 mb-3">
                              <MapPin className="w-3 h-3 text-slate-300 mt-0.5 shrink-0" />
                              <p className="text-[10px] text-slate-500 leading-relaxed">{hotel.vicinity}</p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetchHotelDetails(hotel.place_id);
                                }}
                                className="flex-1 text-center text-[10px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 py-2 rounded-lg transition-colors"
                              >
                                View Reviews
                              </button>
                              <a 
                                href={`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotel.name + ' ' + hotel.vicinity)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 text-center text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 py-2 rounded-lg transition-colors"
                              >
                                Booking
                              </a>
                              <a 
                                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hotel.name + ' ' + hotel.vicinity)}&destination_place_id=${hotel.place_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                                title="Navigate with Google Maps"
                              >
                                <Navigation className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          <Hotel className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-xs text-slate-500 font-medium">No hotels match your criteria</p>
                          <button 
                            onClick={() => setMinRating(0)}
                            className="text-[10px] font-bold text-emerald-600 mt-2 hover:underline"
                          >
                            Clear filters
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Hotel Details Modal */}
      <AnimatePresence>
        {detailedHotel && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="relative h-48 bg-slate-100">
                {detailedHotel.photos && detailedHotel.photos.length > 0 ? (
                  <img 
                    src={detailedHotel.photos[0].getUrl()} 
                    alt={detailedHotel.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Hotel className="w-12 h-12" />
                  </div>
                )}
                <button 
                  onClick={() => setDetailedHotel(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-slate-800 hover:bg-white transition-all shadow-lg"
                >
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto no-scrollbar space-y-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900">{detailedHotel.name}</h3>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100">
                        <Sparkles className="w-3 h-3 text-orange-400" />
                        <span className="text-xs font-bold text-orange-700">{detailedHotel.rating}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">({detailedHotel.user_ratings_total} verified reviews)</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(4)].map((_, idx) => (
                      <span key={idx} className={cn("text-sm font-bold", idx < (detailedHotel.price_level || 2) ? "text-emerald-600" : "text-slate-200")}>₹</span>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{detailedHotel.vicinity}</p>
                      </div>
                    </div>
                    {detailedHotel.formatted_phone_number && (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                          <Info className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact</p>
                          <p className="text-sm text-slate-700">{detailedHotel.formatted_phone_number}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <a 
                      href={detailedHotel.website || `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(detailedHotel.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all text-center shadow-lg shadow-blue-100"
                    >
                      Book Official Website
                    </a>
                    <div className="grid grid-cols-2 gap-2">
                      <a 
                        href={`https://www.agoda.com/search?city=${encodeURIComponent(detailedHotel.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-600 text-white py-3 rounded-xl font-bold text-[10px] hover:bg-emerald-700 transition-all text-center"
                      >
                        Agoda Deals
                      </a>
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(detailedHotel.name + ' ' + detailedHotel.vicinity)}&destination_place_id=${detailedHotel.place_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-100 text-slate-700 py-3 rounded-xl font-bold text-[10px] hover:bg-slate-200 transition-all text-center flex items-center justify-center gap-1"
                      >
                        <Navigation className="w-3 h-3" />
                        Navigate
                      </a>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-400" />
                    Guest Reviews
                  </h4>
                  <div className="space-y-4">
                    {detailedHotel.reviews && detailedHotel.reviews.length > 0 ? (
                      detailedHotel.reviews.slice(0, 3).map((review: any, idx: number) => (
                        <div key={idx} className="bg-slate-50 p-4 rounded-2xl space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-700">{review.author_name}</span>
                            <div className="flex gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <span key={i} className={cn("text-[10px]", i < review.rating ? "text-orange-400" : "text-slate-200")}>★</span>
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 italic leading-relaxed">"{review.text.length > 150 ? review.text.substring(0, 150) + '...' : review.text}"</p>
                          <p className="text-[10px] text-slate-400">{review.relative_time_description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No detailed reviews available for this property.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Navigation className="text-white w-5 h-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-800">TripWise</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              Empowering travelers with data-driven insights and accurate budget planning.
            </p>
          </div>
          <div>
            <h5 className="font-bold text-slate-900 mb-4">Product</h5>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#" className="hover:text-blue-600 transition-colors">Cost Estimator</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">Route Planner</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">Fuel Calculator</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-6">
            <a href="#" className="text-slate-400 hover:text-blue-600 transition-colors"><Info className="w-4 h-4" /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}
