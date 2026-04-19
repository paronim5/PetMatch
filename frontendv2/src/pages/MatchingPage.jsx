import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import PretextBio from '../components/PretextBio';
import { matchingService } from '../services/matching';
import { subscriptionService } from '../services/subscription';
import { useNotification } from '../context/useNotification';
import { BlockModal, ReportModal } from '../components/BlockReportModals';
import {
  FaHeart, FaTimes, FaStar, FaUndo, FaBolt, FaUser,
  FaRulerVertical, FaGraduationCap, FaBriefcase, FaWineGlass,
  FaSmoking, FaComments, FaHistory, FaFlag, FaBan, FaPlay, FaCrown, FaFire, FaPaw
} from 'react-icons/fa';

const BottomNav = () => {
  const { pathname } = useLocation();
  const links = [
    { to: '/matching', icon: FaFire, label: 'Discover' },
    { to: '/chat', icon: FaComments, label: 'Chat' },
    { to: '/history', icon: FaHeart, label: 'Likes' },
    { to: '/profile', icon: FaUser, label: 'Profile' },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-30">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {links.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link key={to} to={to} className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-all ${active ? 'text-violet-400' : 'text-gray-500 hover:text-gray-300'}`}>
              <Icon size={active ? 22 : 20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

const MatchingPage = () => {
  const { addToast } = useNotification();
  const [candidates, setCandidates] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [adLoading, setAdLoading] = useState(false);

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);

  useEffect(() => { fetchCandidates(); }, []);

  useEffect(() => {
    if (!loading && candidates.length > 0 && currentIndex >= candidates.length - 2) {
      fetchCandidates(true);
    }
  }, [currentIndex]);

  const fetchCandidates = async (append = false) => {
    if (!append) setLoading(true);
    try {
      const users = await matchingService.getCandidates();
      if (append) {
        setCandidates(prev => {
          const existingIds = new Set(prev.map(u => u.id));
          const fresh = users.filter(u => !existingIds.has(u.id));
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
      } else {
        setCandidates(users);
        setCurrentIndex(0);
      }
      setError(null);
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
      if (!append) setError('Failed to load matches. Please try again.');
    } finally {
      if (!append) setLoading(false);
    }
  };

  const handleBlockReportSuccess = () => {
    setShowBlockModal(false);
    setShowReportModal(false);
    setCurrentIndex((prev) => prev + 1);
    setPhotoIndex(0);
  };

  const handleSwipe = async (direction) => {
    if (currentIndex < candidates.length) {
      const userToSwipe = candidates[currentIndex];
      const swipeType = direction === 'right' ? 'like' : direction === 'up' ? 'super_like' : 'pass';
      setSwipeDirection(direction);
      setTimeout(async () => {
        try {
          await matchingService.swipe(userToSwipe.id, swipeType);
          setCurrentIndex(currentIndex + 1);
          setPhotoIndex(0);
          setSwipeDirection(null);
          setDragStart(null);
          setDragCurrent(null);
          setIsDragging(false);
        } catch (err) {
          if (err.response && err.response.status === 403) {
            setShowSubscriptionModal(true);
            setSwipeDirection(null);
            setDragStart(null);
            setDragCurrent(null);
            setIsDragging(false);
          } else {
            console.error('Swipe failed:', err);
            setCurrentIndex(currentIndex + 1);
            setSwipeDirection(null);
          }
        }
      }, 300);
    }
  };

  const handleDragStart = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX, y: clientY });
    setDragCurrent({ x: clientX, y: clientY });
    setIsDragging(true);
  };

  const handleDragMove = (e) => {
    if (!isDragging || !dragStart) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragCurrent({ x: clientX, y: clientY });
  };

  const handleDragEnd = () => {
    if (!isDragging || !dragStart || !dragCurrent) return;
    const deltaX = dragCurrent.x - dragStart.x;
    const deltaY = dragCurrent.y - dragStart.y;
    const threshold = 100;
    if (Math.abs(deltaX) > threshold) {
      handleSwipe(deltaX > 0 ? 'right' : 'left');
    } else if (deltaY < -threshold) {
      handleSwipe('up');
    } else {
      setDragStart(null);
      setDragCurrent(null);
      setIsDragging(false);
    }
  };

  const handleWatchAd = async () => {
    setAdLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await subscriptionService.watchAd();
      setShowSubscriptionModal(false);
      addToast('You earned 5 extra swipes!', 'success');
    } catch (error) {
      addToast('Failed to watch ad. Please try again.', 'error');
    } finally {
      setAdLoading(false);
    }
  };

  const handleUpgrade = async () => {
    try {
      await subscriptionService.upgrade('premium');
      setShowSubscriptionModal(false);
      addToast('Welcome to Premium!', 'success');
    } catch (error) {
      addToast('Upgrade failed. Please try again.', 'error');
    }
  };

  const getCardStyle = () => {
    if (swipeDirection) {
      const x = swipeDirection === 'right' ? 1000 : swipeDirection === 'left' ? -1000 : 0;
      const y = swipeDirection === 'up' ? -1000 : 0;
      const rot = swipeDirection === 'right' ? 20 : swipeDirection === 'left' ? -20 : 0;
      return { transform: `translate(${x}px, ${y}px) rotate(${rot}deg)`, transition: 'transform 0.3s ease-out', opacity: 0 };
    }
    if (isDragging && dragCurrent && dragStart) {
      const deltaX = dragCurrent.x - dragStart.x;
      const deltaY = dragCurrent.y - dragStart.y;
      return { transform: `translate(${deltaX}px, ${deltaY}px) rotate(${deltaX * 0.08}deg)`, transition: 'none', cursor: 'grabbing' };
    }
    return { transition: 'transform 0.3s ease-out', cursor: 'grab' };
  };

  const getPhotoUrl = (url) => {
    if (!url) return null;
    const i = url.indexOf('/static/');
    return i !== -1 ? url.substring(i) : url;
  };

  const getSwipeOverlay = () => {
    if (!isDragging || !dragStart || !dragCurrent) return null;
    const deltaX = dragCurrent.x - dragStart.x;
    if (Math.abs(deltaX) < 30) return null;
    return deltaX > 0 ? 'like' : 'nope';
  };

  const swipeOverlay = getSwipeOverlay();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-violet-600/30 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Finding your matches...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetchCandidates} className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold transition-all">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (candidates.length === 0 || currentIndex >= candidates.length) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col pb-16">
        <div className="w-full bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FaPaw className="text-violet-400" />
            <h1 className="text-xl font-bold text-white">PetMatch</h1>
          </div>
          <NotificationBell />
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-5">
              <FaFire className="text-3xl text-gray-600" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">You're all caught up!</h2>
            <p className="text-gray-400 mb-6">No more profiles to show right now. Check back later or refresh.</p>
            <button
              onClick={() => { setCurrentIndex(0); fetchCandidates(); }}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-violet-600/20"
            >
              Refresh Matches
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const currentUser = candidates[currentIndex];
  const currentProfile = currentUser.profile;
  const photos = Array.isArray(currentUser?.photos) ? currentUser.photos : [];
  const activePhotoUrl = photos.length > 0 ? getPhotoUrl(photos[Math.min(photoIndex, photos.length - 1)]?.photo_url) : null;
  const getAge = (dob) => dob ? new Date().getFullYear() - new Date(dob).getFullYear() : '??';
  const likedYou = currentUser.liked_you;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center pb-16">
      {/* Header */}
      <div className="w-full bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FaPaw className="text-violet-400" />
          <h1 className="text-xl font-bold text-white">PetMatch</h1>
        </div>
        <NotificationBell />
      </div>

      {/* Card Stack */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm px-4 pt-4">
        <div
          className="relative w-full rounded-2xl overflow-hidden shadow-2xl select-none touch-none"
          style={{ ...getCardStyle(), height: '62vh', minHeight: 420, maxHeight: 580 }}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          {/* Photo */}
          <div
            className="absolute inset-0 bg-gray-800"
            onClick={() => setPhotoIndex((prev) => (photos.length ? (prev + 1) % photos.length : 0))}
          >
            {activePhotoUrl ? (
              <img src={activePhotoUrl} alt={currentProfile?.first_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600">
                <FaUser size={64} />
              </div>
            )}
          </div>

          {/* Photo dots */}
          {photos.length > 1 && (
            <div className="absolute top-3 left-0 right-0 flex justify-center gap-1 px-4">
              {photos.map((_, i) => (
                <div key={i} className={`h-1 rounded-full flex-1 max-w-8 transition-all ${i === photoIndex ? 'bg-white' : 'bg-white/30'}`} />
              ))}
            </div>
          )}

          {/* Swipe overlay */}
          {swipeOverlay === 'like' && (
            <div className="absolute top-8 left-6 border-4 border-green-400 rounded-xl px-4 py-2 rotate-[-15deg]">
              <span className="text-green-400 font-black text-3xl">LIKE</span>
            </div>
          )}
          {swipeOverlay === 'nope' && (
            <div className="absolute top-8 right-6 border-4 border-red-400 rounded-xl px-4 py-2 rotate-[15deg]">
              <span className="text-red-400 font-black text-3xl">NOPE</span>
            </div>
          )}

          {/* Safety buttons */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
            <button onClick={(e) => { e.stopPropagation(); setShowReportModal(true); }} className="w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-all">
              <FaFlag size={12} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowBlockModal(true); }} className="w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-all">
              <FaBan size={12} />
            </button>
          </div>

          {/* Liked you badge */}
          {likedYou && (
            <div className="absolute top-4 left-4 bg-violet-600/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <FaHeart size={10} /> Liked you
            </div>
          )}

          {/* Gradient + Info */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5">
            <h2 className="text-2xl font-bold text-white">
              {currentProfile?.first_name || 'Unknown'}, {getAge(currentProfile?.date_of_birth)}
            </h2>
            <p className="text-white/70 text-sm mt-0.5">{currentProfile?.location_city || ''}</p>
            {currentProfile?.bio && (
              <PretextBio bio={currentProfile.bio} maxLines={2} className="mt-2" />
            )}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {currentProfile?.occupation && (
                <span className="bg-white/10 backdrop-blur-sm text-white/80 text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                  <FaBriefcase size={10} /> {currentProfile.occupation}
                </span>
              )}
              {currentProfile?.education && (
                <span className="bg-white/10 backdrop-blur-sm text-white/80 text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                  <FaGraduationCap size={10} /> {currentProfile.education}
                </span>
              )}
              {currentProfile?.height_value && (
                <span className="bg-white/10 backdrop-blur-sm text-white/80 text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                  <FaRulerVertical size={10} /> {currentProfile.height_value} {currentProfile.height_unit}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4 mt-5 w-full">
          <button
            onClick={() => addToast('Rewind is a Premium feature!', 'info')}
            className="w-12 h-12 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-yellow-400 hover:border-yellow-400/50 hover:scale-105 transition-all shadow-lg"
          >
            <FaUndo size={18} />
          </button>
          <button
            onClick={() => handleSwipe('left')}
            className="w-16 h-16 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-red-400 hover:border-red-400/50 hover:scale-105 transition-all shadow-lg"
          >
            <FaTimes size={28} />
          </button>
          <button
            onClick={() => handleSwipe('up')}
            className="w-12 h-12 bg-violet-600 rounded-full flex items-center justify-center text-white hover:bg-violet-500 hover:scale-105 transition-all shadow-lg shadow-violet-600/30 -mt-6"
          >
            <FaStar size={20} />
          </button>
          <button
            onClick={() => handleSwipe('right')}
            className="w-16 h-16 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-green-400 hover:border-green-400/50 hover:scale-105 transition-all shadow-lg"
          >
            <FaHeart size={28} />
          </button>
          <button
            onClick={() => addToast('Boost activated!', 'success')}
            className="w-12 h-12 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-purple-400 hover:border-purple-400/50 hover:scale-105 transition-all shadow-lg"
          >
            <FaBolt size={18} />
          </button>
        </div>
      </div>

      <BottomNav />

      <BlockModal show={showBlockModal} onClose={() => setShowBlockModal(false)} onBlock={handleBlockReportSuccess} blockedUser={currentUser} />
      <ReportModal show={showReportModal} onClose={() => setShowReportModal(false)} onReport={handleBlockReportSuccess} reportedUser={currentUser} />

      {/* Subscription Modal */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl">
            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaCrown className="text-yellow-400 text-2xl" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Out of Swipes</h2>
            <p className="text-gray-400 text-sm mb-6">Watch an ad for 5 more swipes or upgrade for unlimited access.</p>
            <div className="space-y-3">
              <button onClick={handleWatchAd} disabled={adLoading} className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl font-semibold hover:bg-gray-750 transition-all disabled:opacity-50">
                {adLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><FaPlay size={14} /> Watch Ad (+5 Swipes)</>}
              </button>
              <button onClick={handleUpgrade} className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg">
                <FaCrown size={14} /> Upgrade to Premium
              </button>
              <button onClick={() => setShowSubscriptionModal(false)} className="text-gray-500 hover:text-gray-400 text-sm transition-colors">
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchingPage;
