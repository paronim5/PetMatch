import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Star, Calendar, X, Search, Filter } from 'lucide-react';
import { api } from '../services/api';

const SwipeHistoryPage = () => {
  const navigate = useNavigate();
  const [swipes, setSwipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'like', 'super_like'
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  // Observer for infinite scroll
  const observer = useRef();
  const lastElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  // Reset when tab or search changes
  useEffect(() => {
    setSwipes([]);
    setPage(0);
    setHasMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, searchTerm]);

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, activeTab, searchTerm]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      let typeParam = null;
      if (activeTab === 'like') typeParam = 'like';
      if (activeTab === 'super_like') typeParam = 'super_like';
      
      const limit = 20;
      const skip = page * limit;

      // Construct query parameters manually
      const params = new URLSearchParams();
      if (typeParam) params.append('type', typeParam);
      params.append('skip', skip.toString());
      params.append('limit', limit.toString());
      
      const response = await api.get(`/matching/history?${params.toString()}`, token);
      
      let newSwipes = response;
      
      // Local search filtering if backend doesn't support it yet
      if (searchTerm) {
        newSwipes = newSwipes.filter(s => 
          s.swiper.username.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setSwipes(prev => {
        // Filter out duplicates based on swipe ID
        const existingIds = new Set(prev.map(s => s.id));
        const uniqueNew = newSwipes.filter(s => !existingIds.has(s.id));
        return [...prev, ...uniqueNew];
      });
      
      if (newSwipes.length < limit) {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Failed to fetch swipe history", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (swiperId, action) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      await api.post('/matching/swipe', {
        swiped_id: swiperId,
        swipe_type: action
      }, token);
      
      // Remove from list
      setSwipes(prev => prev.filter(s => s.swiper.id !== swiperId));
      
      // Show feedback (optional toast)
      // toast.success(`You ${action}d ${swiperId}`);
    } catch (error) {
      console.error(`Failed to ${action}`, error);
      alert(`Failed to ${action}: ` + (error.response?.data?.detail || error.message));
    }
  };

  const getPartnerDetails = (swipe) => {
    const swiper = swipe.swiper;
    const profile = swiper.profile || {};
    const photos = swiper.photos || [];
    const mainPhoto = photos.find(p => p.is_main)?.url || photos[0]?.url;
    return {
      id: swiper.id,
      name: swiper.username, 
      photo: mainPhoto,
      age: profile.date_of_birth ? new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear() : '?',
    };
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="mr-3 p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h1 className="text-xl font-bold text-gray-800">Who Liked You</h1>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 pb-3 text-sm font-medium ${activeTab === 'all' ? 'text-rose-600 border-b-2 border-rose-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            All Swipes
          </button>
          <button
            onClick={() => setActiveTab('like')}
            className={`flex-1 pb-3 text-sm font-medium ${activeTab === 'like' ? 'text-rose-600 border-b-2 border-rose-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Likes
          </button>
          <button
            onClick={() => setActiveTab('super_like')}
            className={`flex-1 pb-3 text-sm font-medium ${activeTab === 'super_like' ? 'text-rose-600 border-b-2 border-rose-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Super Likes
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {swipes.length === 0 && !loading ? (
          <div className="text-center py-10 text-gray-500">
            <Heart className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p>No swipes found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {swipes.map((swipe, index) => {
              const partner = getPartnerDetails(swipe);
              const isSuperLike = swipe.swipe_type === 'super_like';
              
              // Last element ref for infinite scroll
              const isLast = index === swipes.length - 1;
              
              return (
                <div 
                  key={swipe.id} 
                  ref={isLast ? lastElementRef : null}
                  className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex items-center"
                >
                  <div className="relative">
                    {partner.photo ? (
                      <img src={partner.photo} alt={partner.name} className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold text-lg">
                        {partner.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={`absolute -bottom-1 -right-1 p-1 rounded-full ${isSuperLike ? 'bg-blue-500' : 'bg-rose-500'}`}>
                      {isSuperLike ? <Star className="w-3 h-3 text-white" /> : <Heart className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  
                  <div className="ml-3 flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">{partner.name}, {partner.age}</h3>
                        <p className={`text-xs font-medium ${isSuperLike ? 'text-blue-500' : 'text-rose-500'}`}>
                          {isSuperLike ? 'Super Liked you!' : 'Liked you!'}
                        </p>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(swipe.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-2">
                      <button 
                        onClick={() => handleAction(partner.id, 'pass')}
                        className="flex-1 py-1 px-3 border border-gray-300 rounded-full text-gray-600 text-sm hover:bg-gray-50 flex items-center justify-center gap-1"
                      >
                        <X className="w-4 h-4" /> Pass
                      </button>
                      <button 
                        onClick={() => handleAction(partner.id, 'like')}
                        className="flex-1 py-1 px-3 bg-rose-500 rounded-full text-white text-sm hover:bg-rose-600 flex items-center justify-center gap-1"
                      >
                        <Heart className="w-4 h-4" /> Like Back
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {loading && (
          <div className="flex justify-center items-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SwipeHistoryPage;
