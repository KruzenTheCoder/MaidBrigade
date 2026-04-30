"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import './styles.css';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface Address {
  id: string;
  data: {
    street: string;
    city: string;
    zip: string;
    status: string;
    owner?: string;
    phone?: string;
    email?: string;
    assigned?: string;
    notes?: string;
    lat: number;
    lng: number;
    visits?: Array<{date: string; status: string}>;
    followUp?: string;
    priority?: string;
    value?: string;
    competitor?: string;
    updatedAt?: string;
    createdAt?: string;
  };
}

interface Schedule {
  id: string;
  data: {
    date: string;
    team: string;
    addresses: string[];
    timeSlots?: {[key: string]: string[]};
    notes?: string;
    createdAt?: string;
  };
}

export default function DriverPortal() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [todayRoutes, setTodayRoutes] = useState<Schedule[]>([]);
  const [currentTeam, setCurrentTeam] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState<'time' | 'address' | 'status'>('time');
  const [isMobile, setIsMobile] = useState(false);
  const [quickActions, setQuickActions] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{lat: number; lng: number} | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Get GPS location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('GPS access denied or unavailable');
        }
      );
    }
  }, []);

  const loadData = async () => {
    try {
      // Load addresses
      const { data: addrData, error: addrError } = await supabase
        .from('addresses')
        .select('*')
        .order('data->street', { ascending: true });

      if (addrError) throw addrError;
      setAddresses(addrData || []);

      // Load schedules
      const { data: schedData, error: schedError } = await supabase
        .from('schedules')
        .select('*')
        .order('data->date', { ascending: true });

      if (schedError) throw schedError;
      setSchedules(schedData || []);

      // Get today's routes
      const today = new Date().toISOString().split('T')[0];
      const todayScheds = (schedData || []).filter(s => s.data.date === today);
      setTodayRoutes(todayScheds);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTeamAddresses = (teamName: string) => {
    const teamSchedules = todayRoutes.filter(s => s.data.team === teamName);
    const addressIds = teamSchedules.flatMap(s => s.data.addresses);
    return addresses.filter(a => addressIds.includes(a.id));
  };

  const getDistance = (addr1: {lat: number; lng: number}, addr2: {lat: number; lng: number}) => {
    const R = 6371; // Earth's radius in km
    const dLat = (addr2.lat - addr1.lat) * Math.PI / 180;
    const dLng = (addr2.lng - addr1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(addr1.lat * Math.PI / 180) * Math.cos(addr2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getSortedTeamAddresses = (teamName: string) => {
    let teamAddresses = getTeamAddresses(teamName);
    
    // Sort by distance from current GPS location if available
    if (gpsLocation && teamAddresses.length > 0) {
      teamAddresses = [...teamAddresses].sort((a, b) => {
        const distA = getDistance(gpsLocation, {lat: a.data.lat, lng: a.data.lng});
        const distB = getDistance(gpsLocation, {lat: b.data.lat, lng: b.data.lng});
        return distA - distB;
      });
    }

    return sortedAddresses(teamAddresses);
  };

  const updateAddressStatus = async (addressId: string, newStatus: string, notes?: string) => {
    try {
      const address = addresses.find(a => a.id === addressId);
      if (!address) return;

      const updatedData = {
        ...address.data,
        status: newStatus,
        notes: notes || address.data.notes,
        updatedAt: new Date().toISOString(),
        visits: [
          ...(address.data.visits || []),
          { date: new Date().toISOString(), status: newStatus }
        ]
      };

      const { error } = await supabase
        .from('addresses')
        .update({ data: updatedData })
        .eq('id', addressId);

      if (error) throw error;

      // Update local state
      setAddresses(prev => prev.map(a => 
        a.id === addressId ? { ...a, data: updatedData } : a
      ));

      // Close modal
      setSelectedAddress(null);
      setQuickActions(false);
    } catch (error) {
      console.error('Error updating address:', error);
      alert('Error updating address. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: '#8E8E93',
      scheduled: '#007AFF',
      visited: '#FF9F0A',
      interested: '#30D158',
      converted: '#BF5AF2',
      declined: '#FF453A',
      'not-home': 'rgba(255,255,255,0.3)',
      callback: '#64D2FF'
    };
    return colors[status as keyof typeof colors] || '#8E8E93';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      pending: 'fa-clock',
      scheduled: 'fa-calendar-check',
      visited: 'fa-eye',
      interested: 'fa-star',
      converted: 'fa-handshake',
      declined: 'fa-times-circle',
      'not-home': 'fa-door-closed',
      callback: 'fa-phone-alt'
    };
    return icons[status as keyof typeof icons] || 'fa-home';
  };

  const sortedAddresses = (addresses: Address[]) => {
    let filtered = addresses;
    if (filterStatus !== 'all') {
      filtered = addresses.filter(a => a.data.status === filterStatus);
    }

    return filtered.sort((a, b) => {
      if (sortBy === 'address') {
        return a.data.street.localeCompare(b.data.street);
      } else if (sortBy === 'status') {
        return a.data.status.localeCompare(b.data.status);
      } else {
        // Default time-based sorting (using creation order)
        return 0;
      }
    });
  };

  const getProgress = (teamName: string) => {
    const teamAddresses = getTeamAddresses(teamName);
    const completed = teamAddresses.filter(a => 
      ['visited', 'interested', 'converted', 'declined', 'not-home'].includes(a.data.status)
    ).length;
    const total = teamAddresses.length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></div>
          <p className="text-gray-600">Loading routes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <i className="fas fa-broom text-white text-lg"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Maid Bridge</h1>
                <p className="text-sm text-gray-500">Driver Portal</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </span>
              {gpsLocation && (
                <div className="w-2 h-2 bg-green-500 rounded-full" title="GPS Active"></div>
              )}
              <button 
                onClick={loadData}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <i className="fas fa-sync-alt"></i>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Team Selection */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Select Your Team</h2>
            {currentTeam && (
              <div className="text-sm text-gray-600">
                Progress: {getProgress(currentTeam)}%
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {['Team Alpha', 'Team Bravo', 'Team Charlie'].map(team => {
              const teamRoutes = todayRoutes.filter(s => s.data.team === team);
              const addrCount = teamRoutes.reduce((sum, r) => sum + r.data.addresses.length, 0);
              const progress = getProgress(team);
              
              return (
                <button
                  key={team}
                  onClick={() => setCurrentTeam(team)}
                  className={`p-4 rounded-lg border-2 transition-all relative ${
                    currentTeam === team
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-medium text-gray-900">{team}</div>
                    <div className="text-sm text-gray-500">
                      {addrCount} addresses
                    </div>
                    {progress > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        {currentTeam && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-semibold text-gray-900">Quick Actions</h3>
              <button
                onClick={() => setQuickActions(!quickActions)}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
              >
                <i className={`fas ${quickActions ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
              </button>
            </div>
            
            {quickActions && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['visited', 'interested', 'not-home', 'declined'].map(status => (
                  <button
                    key={status}
                    onClick={() => {
                      if (selectedAddress) {
                        updateAddressStatus(selectedAddress.id, status);
                      } else {
                        alert('Please select an address first');
                      }
                    }}
                    className="p-3 rounded-lg border text-sm font-medium transition-all"
                    style={{
                      backgroundColor: getStatusColor(status) + '20',
                      borderColor: getStatusColor(status),
                      color: getStatusColor(status)
                    }}
                  >
                    <i className={`fas ${getStatusIcon(status)} mr-1`}></i>
                    {status.replace('-', ' ').toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filters and Sorting */}
        {currentTeam && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="visited">Visited</option>
                  <option value="interested">Interested</option>
                  <option value="converted">Converted</option>
                  <option value="declined">Declined</option>
                  <option value="not-home">Not Home</option>
                  <option value="callback">Callback</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'time' | 'address' | 'status')}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="time">Time Order</option>
                  <option value="address">Address</option>
                  <option value="status">Status</option>
                </select>
              </div>
              {gpsLocation && (
                <div className="text-sm text-green-600">
                  <i className="fas fa-location-dot mr-1"></i>
                  Sorted by distance
                </div>
              )}
            </div>
          </div>
        )}

        {/* Route List */}
        {currentTeam && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {currentTeam} - Today's Route
                </h2>
                <div className="text-sm text-gray-500">
                  {getSortedTeamAddresses(currentTeam).length} addresses
                </div>
              </div>
            </div>
            
            <div className="divide-y divide-gray-200">
              {getSortedTeamAddresses(currentTeam).map((address, index) => (
                <div 
                  key={address.id} 
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${
                    selectedAddress?.id === address.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedAddress(address)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: getStatusColor(address.data.status) }}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {address.data.street}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {address.data.city}, TX {address.data.zip}
                        </p>
                        {address.data.owner && (
                          <p className="text-sm text-gray-600">
                            {address.data.owner}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span 
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ 
                          backgroundColor: getStatusColor(address.data.status) + '20',
                          color: getStatusColor(address.data.status)
                        }}
                      >
                        <i className={`fas ${getStatusIcon(address.data.status)} mr-1`}></i>
                        {address.data.status.replace('-', ' ')}
                      </span>
                      
                      {isMobile && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAddress(address);
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="Update Status"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {address.data.phone && (
                    <div className="mt-2 flex items-center text-sm text-gray-600">
                      <i className="fas fa-phone mr-2"></i>
                      <a 
                        href={`tel:${address.data.phone}`} 
                        className="hover:text-blue-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {address.data.phone}
                      </a>
                    </div>
                  )}
                  
                  {address.data.notes && (
                    <div className="mt-2 p-2 bg-yellow-50 rounded text-sm text-gray-700">
                      <i className="fas fa-sticky-note mr-1"></i>
                      {address.data.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!currentTeam && (
          <div className="text-center py-12">
            <div className="fas fa-route text-4xl text-gray-400 mb-4"></div>
            <p className="text-gray-600">Select a team to view today's route</p>
          </div>
        )}
      </main>

      {/* Status Update Modal */}
      {selectedAddress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Update Status
                </h3>
                <button
                  onClick={() => setSelectedAddress(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {selectedAddress.data.street}
              </p>
            </div>
            
            <div className="p-4">
              <div className="space-y-3">
                {['visited', 'interested', 'converted', 'declined', 'not-home', 'callback'].map(status => (
                  <button
                    key={status}
                    onClick={() => updateAddressStatus(selectedAddress.id, status)}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                      selectedAddress.data.status === status
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                        style={{ backgroundColor: getStatusColor(status) }}
                      >
                        <i className={`fas ${getStatusIcon(status)}`}></i>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {status.replace('-', ' ').toUpperCase()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {status === 'visited' && 'Customer was home, no interest shown'}
                          {status === 'interested' && 'Customer showed interest in services'}
                          {status === 'converted' && 'Customer signed up for services'}
                          {status === 'declined' && 'Customer declined services'}
                          {status === 'not-home' && 'No one answered the door'}
                          {status === 'callback' && 'Customer requested callback'}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                  rows={3}
                  placeholder="Add notes about this visit..."
                  defaultValue={selectedAddress.data.notes || ''}
                  onChange={(e) => {
                    const notes = e.target.value;
                    if (notes) {
                      updateAddressStatus(selectedAddress.id, selectedAddress.data.status, notes);
                    }
                  }}
                />
              </div>

              {selectedAddress.data.phone && (
                <div className="mt-4">
                  <a
                    href={`tel:${selectedAddress.data.phone}`}
                    className="w-full bg-green-500 text-white p-3 rounded-lg text-center block hover:bg-green-600 transition-colors"
                  >
                    <i className="fas fa-phone mr-2"></i>
                    Call {selectedAddress.data.phone}
                  </a>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => setSelectedAddress(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}