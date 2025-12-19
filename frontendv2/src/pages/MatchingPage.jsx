import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import { matchingService } from '../services/matching';
import { BlockModal, ReportModal } from '../components/BlockReportModals';
import { 
  FaHeart, FaTimes, FaStar, FaUndo, FaBolt, FaUser, 
  FaRulerVertical, FaGraduationCap, FaBriefcase, FaWineGlass, 
  FaSmoking, FaComments, FaHistory, FaFlag, FaBan 
} from 'react-icons/fa';

const MatchingPage = () => {
  const [candidates, setCandidates] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  // Block/Report State
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Swipe State
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const users = await matchingService.getCandidates();
      setCandidates(users);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
      setError('Failed to load matches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Logic to handle success from Block/Report modals
  const handleBlockReportSuccess = () => {
    setShowBlockModal(false);
    setShowReportModal(false);
    // Remove the current user from the stack
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
          console.error('Swipe failed:', err);
          setCurrentIndex(currentIndex + 1);
          setSwipeDirection(null);
        }
      }, 300);
    }
  };

  // Touch/Mouse Handlers
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

  const getCardStyle = () => {
    if (swipeDirection) {
      const x = swipeDirection === 'right' ? 1000 : swipeDirection === 'left' ? -1000 : 0;
      const y = swipeDirection === 'up' ? -1000 : 0;
      const rot = swipeDirection === 'right' ? 20 : swipeDirection === 'left' ? -20 : 0;
      return {
        transform: `translate(${x}px, ${y}px) rotate(${rot}deg)`,
        transition: 'transform 0.3s ease-out',
        opacity: 0
      };
    }
    
    if (isDragging && dragCurrent && dragStart) {
      const deltaX = dragCurrent.x - dragStart.x;
      const deltaY = dragCurrent.y - dragStart.y;
      const rot = deltaX * 0.1;
      return {
        transform: `translate(${deltaX}px, ${deltaY}px) rotate(${rot}deg)`,
        transition: 'none',
        cursor: 'grabbing'
      };
    }
    return { transition: 'transform 0.3s ease-out', cursor: 'grab' };
  };

  const handleRewind = () => alert("Rewind is a Premium feature!");
  const handleBoost = () => alert("Boost is active!");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={fetchCandidates} className="px-4 py-2 bg-rose-500 text-white rounded hover:bg-rose-600">Retry</button>
        </div>
      </div>
    );
  }

  if (candidates.length === 0 || currentIndex >= candidates.length) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-100">
        <div className="w-full bg-white shadow-sm p-4 flex justify-between items-center px-6">
          <h1 className="text-2xl font-bold text-rose-500">PetMatch</h1>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <Link to="/chat" className="text-gray-600 hover:text-rose-500"><FaComments size={24} /></Link>
            <Link to="/profile" className="text-gray-600 hover:text-rose-500"><FaUser size={24} /></Link>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md mx-4">
            <h2 className="text-2xl font-bold text-gray-700 mb-2">No more profiles!</h2>
            <button onClick={() => { setCurrentIndex(0); fetchCandidates(); }} className="w-full mt-4 px-4 py-2 bg-rose-500 text-white rounded">Refresh Matches</button>
          </div>
        </div>
      </div>
    );
  }

  const currentUser = candidates[currentIndex];
  const currentProfile = currentUser.profile;
  const photos = Array.isArray(currentUser?.photos) ? currentUser.photos : [];
  const activePhotoUrl = photos.length > 0 ? photos[Math.min(photoIndex, photos.length - 1)]?.photo_url : null;
  const getAge = (dob) => dob ? new Date().getFullYear() - new Date(dob).getFullYear() : '??';

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-100 relative">
      <div className="w-full bg-white shadow-sm p-4 flex justify-between items-center px-6">
        <h1 className="text-2xl font-bold text-rose-500">PetMatch</h1>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <Link to="/chat" className="text-gray-600 hover:text-rose-500"><FaComments size={24} /></Link>
          <Link to="/history" className="text-gray-600 hover:text-rose-500"><FaHistory size={24} /></Link>
          <Link to="/profile" className="text-gray-600 hover:text-rose-500"><FaUser size={24} /></Link>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md p-4">
        <div 
          className="relative w-full bg-white rounded-2xl shadow-xl overflow-hidden h-[600px] flex flex-col select-none touch-none"
          style={getCardStyle()}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          {/* Photo Area */}
          <div className="h-3/5 bg-gray-300 flex items-center justify-center relative overflow-hidden" onClick={() => setPhotoIndex((prev) => (photos.length ? (prev + 1) % photos.length : 0))}>
             {activePhotoUrl ? (
               <img src={activePhotoUrl} alt={currentProfile?.first_name} className="w-full h-full object-cover" />
             ) : (
               <span className="text-4xl text-gray-400">No Photo</span>
             )}
             
             <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6 text-white">
                <h2 className="text-3xl font-bold drop-shadow-md">
                  {currentProfile?.first_name || 'Unknown'}, {getAge(currentProfile?.date_of_birth)}
                </h2>
                <p className="text-lg opacity-90 drop-shadow-sm">{currentProfile?.location_city || 'Unknown Location'}</p>
             </div>

             {/* Safety Buttons (Report/Block) */}
             <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowReportModal(true); }}
                  className="p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors"
                >
                  <FaFlag size={14} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowBlockModal(true); }}
                  className="p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors"
                >
                  <FaBan size={14} />
                </button>
             </div>
          </div>
          
          <div className="h-2/5 p-6 overflow-y-auto">
            {currentProfile?.bio && <p className="text-gray-600 mb-4 text-lg">{currentProfile.bio}</p>}
            
            <div className="flex flex-wrap gap-2 mb-4">
               {/* Restored Details: Height, Education, Occupation, Drinking, Smoking */}
               {currentProfile?.height_value && (
                 <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700 flex items-center gap-1">
                   <FaRulerVertical className="text-rose-400" /> {currentProfile.height_value} {currentProfile.height_unit}
                 </span>
               )}
               {currentProfile?.education && (
                 <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700 flex items-center gap-1">
                   <FaGraduationCap className="text-rose-400" /> {currentProfile.education}
                 </span>
               )}
               {currentProfile?.occupation && (
                 <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700 flex items-center gap-1">
                   <FaBriefcase className="text-rose-400" /> {currentProfile.occupation}
                 </span>
               )}
               {currentProfile?.drinking && currentProfile.drinking !== 'prefer_not_to_say' && (
                 <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700 flex items-center gap-1">
                   <FaWineGlass className="text-rose-400" /> {currentProfile.drinking}
                 </span>
               )}
               {currentProfile?.smoking && currentProfile.smoking !== 'prefer_not_to_say' && (
                 <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700 flex items-center gap-1">
                   <FaSmoking className="text-rose-400" /> {currentProfile.smoking}
                 </span>
               )}
            </div>
            
            {/* Restored Relationship Goal */}
            <div className="text-xs text-gray-400 mt-4 uppercase tracking-wider font-semibold">
              Relationship Goal: {currentProfile?.relationship_goal || 'Not specified'}
            </div>
          </div>
        </div>

        {/* Swipe Controls */}
        <div className="flex items-center justify-center gap-6 mt-6 w-full">
          <button onClick={handleRewind} className="p-3 bg-white rounded-full shadow-lg text-yellow-500 hover:scale-110 transition-all"><FaUndo size={20} /></button>
          <button onClick={() => handleSwipe('left')} className="p-4 bg-white rounded-full shadow-lg text-red-500 hover:scale-110 transition-all border border-red-100"><FaTimes size={32} /></button>
          <button onClick={() => handleSwipe('up')} className="p-3 bg-white rounded-full shadow-lg text-blue-500 hover:scale-110 transition-all -mt-8"><FaStar size={24} /></button>
          <button onClick={() => handleSwipe('right')} className="p-4 bg-white rounded-full shadow-lg text-green-500 hover:scale-110 transition-all border border-green-100"><FaHeart size={32} /></button>
          <button onClick={handleBoost} className="p-3 bg-white rounded-full shadow-lg text-purple-500 hover:scale-110 transition-all"><FaBolt size={20} /></button>
        </div>
      </div>
      
      <BlockModal 
        show={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        onBlock={handleBlockReportSuccess}
        blockedUser={currentUser}
      />
      
      <ReportModal
        show={showReportModal}
        onClose={() => setShowReportModal(false)}
        onReport={handleBlockReportSuccess}
        reportedUser={currentUser}
      />
    </div>
  );
};

export default MatchingPage;