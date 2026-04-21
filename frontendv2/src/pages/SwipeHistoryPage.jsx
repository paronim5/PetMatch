import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useNotification } from '../context/useNotification';
import BottomNav from '../components/BottomNav';
import { pageBgStyle } from '../components/PageBackground';
import { FaArrowLeft, FaHeart, FaStar, FaSearch } from 'react-icons/fa';

const SwipeHistoryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const focusUserId = location.state?.focusUserId || null;
  const { notifications } = useNotification();
  const [swipes, setSwipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [highlightUserId, setHighlightUserId] = useState(null);

  const observer = useRef();
  const focusElementRef = useRef(null);
  const lastElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) setPage(p => p + 1);
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  useEffect(() => { setSwipes([]); setPage(0); setHasMore(true); }, [activeTab, searchTerm]);
  useEffect(() => { fetchHistory(); }, [page, activeTab, searchTerm]);
  useEffect(() => { setSwipes([]); setPage(0); setHasMore(true); }, [notifications.length]);
  useEffect(() => { if (focusUserId) setHighlightUserId(focusUserId); }, [focusUserId]);
  useEffect(() => { if (focusElementRef.current) focusElementRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [swipes, highlightUserId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { navigate('/login'); return; }

      let typeParam = null;
      if (activeTab === 'like') typeParam = 'like';
      if (activeTab === 'super_like') typeParam = 'super_like';

      const params = new URLSearchParams();
      if (typeParam) params.append('type', typeParam);
      params.append('skip', (page * 20).toString());
      params.append('limit', '20');

      let newSwipes = await api.get(`/matching/history?${params.toString()}`, token);
      if (searchTerm) {
        newSwipes = newSwipes.filter(s => s.swiper.username.toLowerCase().includes(searchTerm.toLowerCase()));
      }

      setSwipes(prev => {
        const existingIds = new Set(prev.map(s => s.id));
        return [...prev, ...newSwipes.filter(s => !existingIds.has(s.id))];
      });
      if (newSwipes.length < 20) setHasMore(false);
    } catch (error) {
      console.error('Failed to fetch swipe history', error);
    } finally {
      setLoading(false);
    }
  };

  const getPhotoUrl = (url) => {
    if (!url) return null;
    const i = url.indexOf('/static/');
    return i !== -1 ? url.substring(i) : url;
  };

  const getPartnerDetails = (swipe) => {
    const swiper = swipe.swiper;
    const profile = swiper.profile || {};
    const photos = swiper.photos || [];
    const mainPhotoUrl = photos.find(p => p.is_main)?.photo_url || photos[0]?.photo_url;
    return {
      id: swiper.id,
      name: swiper.username,
      photo: getPhotoUrl(mainPhotoUrl),
      age: profile.date_of_birth ? new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear() : '?',
    };
  };

  const tabs = [
    { key: 'all', label: 'All Likes' },
    { key: 'like', label: 'Likes' },
    { key: 'super_like', label: 'Super Likes' },
  ];

  return (
    <div className="min-h-screen flex flex-col pb-16" style={pageBgStyle}>
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white transition-colors p-1 -ml-1">
            <FaArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold text-white">Who Liked You</h1>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
            <input
              type="text"
              placeholder="Search username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-all"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-800">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-3 text-sm font-medium transition-all relative ${activeTab === key ? 'text-violet-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {label}
              {activeTab === key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500" />}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {swipes.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <FaHeart className="text-gray-600 text-2xl" />
            </div>
            <p className="text-gray-400 font-medium">No likes yet</p>
            <p className="text-gray-600 text-sm mt-1">Keep swiping to get noticed!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {swipes.map((swipe, index) => {
              const partner = getPartnerDetails(swipe);
              const isSuperLike = swipe.swipe_type === 'super_like';
              const isHighlighted = highlightUserId && partner.id === highlightUserId;
              const isLast = index === swipes.length - 1;

              return (
                <div
                  key={swipe.id}
                  ref={isHighlighted ? focusElementRef : isLast ? lastElementRef : null}
                  className={`bg-gray-900 border rounded-2xl p-4 flex items-center gap-4 transition-all ${isHighlighted ? 'border-violet-500 shadow-lg shadow-violet-500/10' : 'border-gray-800 hover:border-gray-700'}`}
                >
                  <div className="relative flex-shrink-0">
                    {partner.photo ? (
                      <img src={partner.photo} alt={partner.name} className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-700" />
                    ) : (
                      <div className="w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center text-gray-400 font-bold text-xl">
                        {partner.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-lg ${isSuperLike ? 'bg-blue-500' : 'bg-rose-500'}`}>
                      {isSuperLike ? <FaStar className="text-white" size={10} /> : <FaHeart className="text-white" size={10} />}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-white">{partner.name}, {partner.age}</h3>
                        <p className={`text-xs font-medium mt-0.5 ${isSuperLike ? 'text-blue-400' : 'text-rose-400'}`}>
                          {isSuperLike ? 'Super Liked you!' : 'Liked you!'}
                        </p>
                      </div>
                      <span className="text-gray-600 text-xs flex-shrink-0">
                        {new Date(swipe.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-6">
            <div className="w-8 h-8 border-2 border-violet-600/30 border-t-violet-600 rounded-full animate-spin" />
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default SwipeHistoryPage;
