import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { userService } from '../services/user';
import { subscriptionService } from '../services/subscription';
import { useNotification } from '../context/useNotification';
import { validateImage } from '../utils/imageValidation';
import {
  FaTrash, FaPlus, FaCamera, FaMapMarkerAlt, FaRulerVertical,
  FaGraduationCap, FaBriefcase, FaSignOutAlt, FaUserTimes, FaShieldAlt,
  FaCrown, FaPlay, FaCheckCircle, FaTimesCircle, FaPencilAlt, FaSave,
  FaTimes, FaFire, FaComments, FaHeart, FaUser, FaPaw, FaBell
} from 'react-icons/fa';

class PhotoSectionErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error('PhotoSectionErrorBoundary:', error, errorInfo); }
  render() {
    if (this.state.hasError) return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
        Something went wrong loading photos. Please reload.
      </div>
    );
    return this.props.children;
  }
}

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

const inputCls = 'w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500 transition-all';
const labelCls = 'block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5';
const cardCls = 'bg-gray-900 border border-gray-800 rounded-2xl p-5';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adLoading, setAdLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const [profileData, setProfileData] = useState({
    first_name: '', surname: '', date_of_birth: '', bio: '',
    location_city: '', latitude: '', longitude: '', gender: 'other',
    height_value: '', height_unit: 'cm', education: '', occupation: '',
    relationship_goal: 'relationship', smoking: 'never', drinking: 'never', interests: ''
  });

  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [photoValidations, setPhotoValidations] = useState({});
  const [showPhotoInput, setShowPhotoInput] = useState(false);
  const [preferences, setPreferences] = useState({
    min_age: 18, max_age: 100, max_distance: 50,
    preferred_genders: ['female', 'male', 'non_binary', 'other'],
    deal_breakers: [], notify_likes: true, notify_matches: true, notify_messages: true
  });
  const [formError, setFormError] = useState('');
  const [prefsError, setPrefsError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); navigate('/login'); }
    else { fetchUserAndPhotos(); fetchSubscription(); }
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      if (searchParams.get('success') === 'true') {
        const sessionId = searchParams.get('session_id');
        if (sessionId) { try { await subscriptionService.verifySession(sessionId); } catch (e) { console.error(e); } }
        setSuccessMessage('Subscription upgraded successfully!');
        fetchSubscription();
        setSearchParams({});
      }
      if (searchParams.get('canceled') === 'true') { setFormError('Subscription upgrade canceled.'); setSearchParams({}); }
    };
    checkStatus();
  }, [searchParams, setSearchParams]);

  const fetchSubscription = async () => {
    try { setSubscription(await subscriptionService.getStatus()); }
    catch (error) {
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        localStorage.removeItem('token'); navigate('/login');
      }
    }
  };

  const handleWatchAd = async () => {
    setAdLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await subscriptionService.watchAd();
      await fetchSubscription();
      addToast('You earned 5 extra swipes!', 'success');
    } catch { addToast('Failed to watch ad.', 'error'); }
    finally { setAdLoading(false); }
  };

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      const response = await subscriptionService.createCheckoutSession('premium');
      if (response.checkout_url) window.location.href = response.checkout_url;
      else throw new Error('No checkout URL');
    } catch { addToast('Upgrade failed.', 'error'); }
    finally { setUpgradeLoading(false); }
  };

  const getPhotoUrl = (url) => {
    if (!url) return null;
    const i = url.indexOf('/static/');
    return i !== -1 ? url.substring(i) : url;
  };

  const fetchUserAndPhotos = async () => {
    setLoading(true);
    try {
      const [userRes, photosRes, prefsRes] = await Promise.allSettled([
        userService.getMe(), userService.getPhotos(), userService.getPreferences()
      ]);
      if (userRes.status === 'fulfilled') {
        const userData = userRes.value;
        setUser(userData);
        if (userData?.profile) {
          setProfileData({
            first_name: userData.profile.first_name || '', surname: userData.profile.surname || '',
            date_of_birth: userData.profile.date_of_birth || '', bio: userData.profile.bio || '',
            location_city: userData.profile.location_city || '', latitude: userData.profile.latitude || '',
            longitude: userData.profile.longitude || '', gender: userData.profile.gender || 'other',
            height_value: userData.profile.height_value || '', height_unit: userData.profile.height_unit || 'cm',
            education: userData.profile.education || '', occupation: userData.profile.occupation || '',
            relationship_goal: userData.profile.relationship_goal || 'relationship',
            smoking: userData.profile.smoking || 'never', drinking: userData.profile.drinking || 'never', interests: ''
          });
        }
      } else {
        const err = userRes.reason;
        if (err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
          localStorage.removeItem('token'); navigate('/login'); return;
        }
      }
      if (photosRes.status === 'fulfilled') setPhotos(photosRes.value || []);
      if (prefsRes.status === 'fulfilled' && prefsRes.value) {
        const p = prefsRes.value;
        setPreferences({
          min_age: p.min_age ?? 18, max_age: p.max_age ?? 100, max_distance: p.max_distance ?? 50,
          preferred_genders: p.preferred_genders ?? ['female', 'male', 'non_binary', 'other'],
          deal_breakers: p.deal_breakers ?? [], notify_likes: p.notify_likes ?? true,
          notify_matches: p.notify_matches ?? true, notify_messages: p.notify_messages ?? true
        });
      }
    } finally { setLoading(false); }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setProfileData({ ...profileData, [e.target.name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(''); setSuccessMessage('');
    if (!profileData.first_name?.trim()) { setFormError('First Name is required.'); return; }
    if (!profileData.date_of_birth) { setFormError('Date of Birth is required.'); return; }
    try {
      await userService.updateProfile({
        ...profileData,
        height_value: profileData.height_value ? parseInt(profileData.height_value) : null,
        latitude: profileData.latitude ? parseFloat(profileData.latitude) : null,
        longitude: profileData.longitude ? parseFloat(profileData.longitude) : null,
      });
      setIsEditing(false);
      fetchUserAndPhotos();
      setSuccessMessage('Profile updated!');
    } catch { setFormError('Could not save profile. Check your inputs.'); }
  };

  const handlePreferencesSave = async () => {
    setPrefsError(''); setSuccessMessage('');
    try {
      const normInt = (v) => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
      await userService.updatePreferences({
        min_age: normInt(preferences.min_age), max_age: normInt(preferences.max_age),
        max_distance: normInt(preferences.max_distance),
        preferred_genders: preferences.preferred_genders || undefined,
        deal_breakers: preferences.deal_breakers || undefined,
        notify_likes: preferences.notify_likes, notify_matches: preferences.notify_matches,
        notify_messages: preferences.notify_messages
      });
      setSuccessMessage('Preferences saved!');
    } catch { setPrefsError('Please review your preferences.'); }
  };

  const removePendingPhoto = (index) => {
    const next = [...pendingPhotos];
    const removed = next.splice(index, 1)[0];
    setPendingPhotos(next);
    setPhotoValidations(prev => { const n = { ...prev }; if (removed?.name in n) delete n[removed.name]; return n; });
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (pendingPhotos.length + files.length > 10) { setUploadError('Maximum 10 photos allowed.'); return; }
    setUploadError('');
    const uniqueFiles = files.filter(f => !pendingPhotos.some(ex => ex.name === f.name && ex.size === f.size));
    if (!uniqueFiles.length) return;
    setPendingPhotos(prev => [...prev, ...uniqueFiles]);
    for (const file of uniqueFiles) {
      setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'loading', message: 'Validating...' } }));
      const clientValid = await validateImage(file);
      if (!clientValid.ok) { setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'error', message: clientValid.message } })); continue; }
      try {
        const result = await userService.validatePhoto(file);
        if (result.quarantine) {
          const reason = result.rejection_reason || (result.has_human_face ? 'Human face detected.' : 'No animal detected.');
          setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'error', message: reason } }));
        } else if (!result.is_safe) {
          setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'error', message: result.unsafe_reason || 'Unsafe content.' } }));
        } else {
          setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'success', message: 'Valid' } }));
        }
      } catch { setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'error', message: 'Validation failed' } })); }
    }
    e.target.value = '';
  };

  const handleUploadPhoto = async (e) => {
    e.preventDefault();
    const valid = pendingPhotos.filter(f => photoValidations[f.name]?.status === 'success');
    if (!valid.length) { setUploadError('No valid photos selected.'); return; }
    if (pendingPhotos.some(f => photoValidations[f.name]?.status === 'loading')) { setUploadError('Wait for validation.'); return; }
    try {
      setPhotoUploading(true);
      await userService.uploadPhotos(valid);
      setPendingPhotos([]); setPhotoValidations({}); setShowPhotoInput(false);
      fetchUserAndPhotos();
    } catch (err) { setUploadError(err.message || 'Upload failed'); }
    finally { setPhotoUploading(false); }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm('Delete this photo?')) return;
    try { await userService.deletePhoto(photoId); fetchUserAndPhotos(); }
    catch { addToast('Failed to delete photo.', 'error'); }
  };

  const useCurrentLocation = () => {
    if (!window.isSecureContext) { addToast('Location requires HTTPS.', 'warning'); return; }
    if (!navigator.geolocation) { addToast('Geolocation not supported.', 'error'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setProfileData(prev => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude })); addToast('Location detected!', 'success'); },
      (err) => { const msgs = { 1: 'Permission denied.', 2: 'Position unavailable.', 3: 'Timed out.' }; addToast(`Location error: ${msgs[err.code] || ''}`, 'error'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const getAge = (dob) => dob ? new Date().getFullYear() - new Date(dob).getFullYear() : null;

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-violet-600/30 border-t-violet-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FaPaw className="text-violet-400" />
          <h1 className="text-xl font-bold text-white">Profile</h1>
        </div>
        <button
          onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}
          className="flex items-center gap-1.5 text-gray-500 hover:text-red-400 transition-colors text-sm"
        >
          <FaSignOutAlt size={14} /> Logout
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Alerts */}
        {(formError || prefsError) && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {formError || prefsError}
          </div>
        )}
        {successMessage && (
          <div className="px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
            {successMessage}
          </div>
        )}

        {/* User hero */}
        <div className={`${cardCls} flex items-center gap-4`}>
          {photos[0] ? (
            <img src={getPhotoUrl(photos[0].photo_url)} alt="avatar" className="w-16 h-16 rounded-full object-cover ring-2 ring-violet-500/30 flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
              <FaUser className="text-gray-400 text-2xl" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-lg truncate">
              {user?.profile?.first_name || user?.username || 'Your Profile'}
              {getAge(user?.profile?.date_of_birth) && <span className="text-gray-400 font-normal ml-1">, {getAge(user?.profile?.date_of_birth)}</span>}
            </h2>
            <p className="text-gray-500 text-sm truncate">{user?.profile?.location_city || 'No location set'}</p>
            <p className="text-gray-600 text-xs mt-0.5">@{user?.username}</p>
          </div>
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all">
              <FaPencilAlt size={12} /> Edit
            </button>
          )}
        </div>

        {/* Subscription */}
        <div className={cardCls}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-white flex items-center gap-2">
                <FaCrown className={subscription?.is_premium ? 'text-yellow-400' : 'text-gray-600'} size={16} />
                {subscription?.is_premium ? 'Premium Member' : 'Free Plan'}
              </h3>
              <p className="text-gray-500 text-sm mt-0.5">
                {subscription?.is_premium ? 'Unlimited swipes & ad-free' : `${subscription?.remaining_swipes ?? 0} / ${subscription?.daily_swipe_limit ?? 20} swipes left today`}
              </p>
            </div>
            {subscription?.is_premium && (
              <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold px-2.5 py-1 rounded-full">PREMIUM</span>
            )}
          </div>
          {!subscription?.is_premium && (
            <div className="flex gap-2">
              <button onClick={handleUpgrade} disabled={upgradeLoading} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-yellow-500/20">
                {upgradeLoading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FaCrown size={13} />}
                Upgrade
              </button>
              <button onClick={handleWatchAd} disabled={adLoading} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-750 transition-all disabled:opacity-50">
                {adLoading ? <span className="w-3.5 h-3.5 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" /> : <FaPlay size={11} />}
                Watch Ad (+5)
              </button>
            </div>
          )}
        </div>

        {/* Photos */}
        <PhotoSectionErrorBoundary>
          <div className={cardCls}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white flex items-center gap-2"><FaCamera className="text-violet-400" size={14} /> Photos</h3>
              <button onClick={() => setShowPhotoInput(!showPhotoInput)} className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 text-sm font-semibold transition-colors">
                <FaPlus size={11} /> Add
              </button>
            </div>

            {showPhotoInput && (
              <div className="mb-4 p-4 bg-gray-800 border border-gray-700 rounded-xl">
                <div className="mb-4 p-3 bg-violet-500/5 border border-violet-500/20 rounded-xl text-xs text-gray-400">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-green-400 font-semibold flex items-center gap-1 mb-1"><FaCheckCircle size={10} /> Accepted</p>
                      <p>Clear animal photos (cats, dogs, etc.)</p>
                    </div>
                    <div>
                      <p className="text-red-400 font-semibold flex items-center gap-1 mb-1"><FaTimesCircle size={10} /> Rejected</p>
                      <p>Human faces, non-animal objects</p>
                    </div>
                  </div>
                </div>

                {uploadError && <p className="text-red-400 text-sm mb-3">{uploadError}</p>}

                <form onSubmit={handleUploadPhoto} className="space-y-3">
                  <input type="file" multiple accept="image/*" onChange={handleFileSelect}
                    className="block w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-violet-600 file:text-white hover:file:bg-violet-500" />

                  {pendingPhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {pendingPhotos.map((file, idx) => (
                        <div key={idx} className="relative group rounded-xl overflow-hidden bg-gray-700 aspect-square">
                          <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" onLoad={(e) => URL.revokeObjectURL(e.target.src)} />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-[10px] font-bold">
                            {photoValidations[file.name]?.status === 'loading' && <span className="text-yellow-300">Validating...</span>}
                            {photoValidations[file.name]?.status === 'success' && <span className="text-green-400">Valid</span>}
                            {photoValidations[file.name]?.status === 'error' && <span className="text-red-400">Invalid</span>}
                          </div>
                          <button type="button" onClick={() => removePendingPhoto(idx)} className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-400 transition-all">
                            <FaTimes size={8} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => { setShowPhotoInput(false); setPendingPhotos([]); setPhotoValidations({}); setUploadError(''); }}
                      className="px-3 py-2 bg-gray-700 border border-gray-600 text-gray-300 rounded-xl text-sm transition-all hover:bg-gray-600">
                      Cancel
                    </button>
                    <button type="submit" disabled={!pendingPhotos.length || photoUploading}
                      className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
                      {photoUploading ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                      {photoUploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group aspect-square bg-gray-800 rounded-xl overflow-hidden">
                  <img src={getPhotoUrl(photo.photo_url) || '/vite.svg'} alt="Profile" className="object-cover w-full h-full"
                    onError={(e) => { e.target.src = '/vite.svg'; e.target.onerror = null; }} />
                  <button onClick={() => handleDeletePhoto(photo.id)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-400 flex items-center justify-center">
                    <FaTrash size={10} />
                  </button>
                  {photo.is_primary && (
                    <span className="absolute bottom-1.5 left-1.5 bg-violet-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">Primary</span>
                  )}
                </div>
              ))}
              {photos.length === 0 && (
                <div className="col-span-3 text-center py-8 border-2 border-dashed border-gray-700 rounded-xl">
                  <FaCamera className="text-gray-600 text-2xl mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No photos yet</p>
                </div>
              )}
            </div>
          </div>
        </PhotoSectionErrorBoundary>

        {/* Profile details */}
        <div className={cardCls}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-white">Personal Details</h3>
            {isEditing && (
              <button onClick={() => setIsEditing(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <FaTimes size={16} />
              </button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>First Name</label>
                  <input type="text" name="first_name" value={profileData.first_name} onChange={handleChange} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <input type="text" name="surname" value={profileData.surname} onChange={handleChange} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Date of Birth</label>
                  <input type="date" name="date_of_birth" value={profileData.date_of_birth} onChange={handleChange} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Gender</label>
                  <select name="gender" value={profileData.gender} onChange={handleChange} className={inputCls}>
                    <option value="male" className="bg-gray-800">Male</option>
                    <option value="female" className="bg-gray-800">Female</option>
                    <option value="non_binary" className="bg-gray-800">Non-binary</option>
                    <option value="other" className="bg-gray-800">Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Height (cm)</label>
                  <input type="number" name="height_value" value={profileData.height_value} onChange={handleChange} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Occupation</label>
                  <input type="text" name="occupation" value={profileData.occupation} onChange={handleChange} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Education</label>
                  <input type="text" name="education" value={profileData.education} onChange={handleChange} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Relationship Goal</label>
                  <select name="relationship_goal" value={profileData.relationship_goal} onChange={handleChange} className={inputCls}>
                    <option value="relationship" className="bg-gray-800">Relationship</option>
                    <option value="casual" className="bg-gray-800">Casual</option>
                    <option value="friendship" className="bg-gray-800">Friendship</option>
                    <option value="undecided" className="bg-gray-800">Undecided</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Bio</label>
                <textarea name="bio" rows={3} value={profileData.bio} onChange={handleChange} className={`${inputCls} resize-none`} placeholder="Tell us about yourself..." />
              </div>

              {/* Location */}
              <div className="p-4 bg-violet-500/5 border border-violet-500/20 rounded-xl space-y-3">
                <h4 className="text-violet-400 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5"><FaMapMarkerAlt size={11} /> Location</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className={labelCls}>City</label>
                    <input type="text" name="location_city" value={profileData.location_city} onChange={handleChange} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Latitude</label>
                    <input type="number" step="any" name="latitude" value={profileData.latitude} onChange={handleChange} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Longitude</label>
                    <input type="number" step="any" name="longitude" value={profileData.longitude} onChange={handleChange} className={inputCls} />
                  </div>
                </div>
                <button type="button" onClick={useCurrentLocation} className="text-violet-400 hover:text-violet-300 text-xs font-semibold flex items-center gap-1 transition-colors">
                  <FaMapMarkerAlt size={10} /> Use my current location
                </button>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm font-semibold transition-all hover:bg-gray-700">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-violet-600/20 flex items-center gap-1.5">
                  <FaSave size={12} /> Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Name', value: `${user?.profile?.first_name || ''} ${user?.profile?.surname || ''}`.trim() || '—' },
                { label: 'Age', value: getAge(user?.profile?.date_of_birth) ? `${getAge(user?.profile?.date_of_birth)} years` : '—' },
                { label: 'Location', value: user?.profile?.location_city || '—' },
                { label: 'Occupation', value: user?.profile?.occupation || '—' },
                { label: 'Education', value: user?.profile?.education || '—' },
                { label: 'Height', value: user?.profile?.height_value ? `${user.profile.height_value} ${user.profile.height_unit}` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-800 rounded-xl p-3">
                  <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-0.5">{label}</p>
                  <p className="text-white text-sm font-medium truncate">{value}</p>
                </div>
              ))}
              {user?.profile?.bio && (
                <div className="col-span-2 bg-gray-800 rounded-xl p-3">
                  <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-1">Bio</p>
                  <p className="text-white text-sm leading-relaxed">{user.profile.bio}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Match Preferences */}
        <div className={cardCls}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-white">Match Preferences</h3>
            <button onClick={() => navigate('/blocks')} className="flex items-center gap-1.5 text-gray-500 hover:text-violet-400 text-xs font-semibold transition-colors">
              <FaShieldAlt size={12} /> Blocked Users
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className={labelCls}>Min Age</label>
              <input type="number" min={18} value={Number.isNaN(preferences.min_age) ? '' : preferences.min_age}
                onChange={(e) => setPreferences({ ...preferences, min_age: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Max Age</label>
              <input type="number" max={100} value={Number.isNaN(preferences.max_age) ? '' : preferences.max_age}
                onChange={(e) => setPreferences({ ...preferences, max_age: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Max Distance (km)</label>
              <input type="number" min={1} value={Number.isNaN(preferences.max_distance) ? '' : preferences.max_distance}
                onChange={(e) => setPreferences({ ...preferences, max_distance: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                className={inputCls} />
            </div>
          </div>
          <div className="mb-4">
            <label className={labelCls}>Preferred Genders</label>
            <div className="flex flex-wrap gap-2">
              {['male', 'female', 'non_binary', 'other'].map(g => {
                const selected = preferences.preferred_genders?.includes(g);
                return (
                  <button key={g} type="button"
                    onClick={() => {
                      const curr = preferences.preferred_genders || [];
                      setPreferences({ ...preferences, preferred_genders: selected ? curr.filter(x => x !== g) : [...curr, g] });
                    }}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all capitalize ${selected ? 'bg-violet-600 border-violet-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}
                  >
                    {g.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>
          <button onClick={handlePreferencesSave} className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-violet-600/20">
            Save Preferences
          </button>
        </div>

        {/* Notification Settings */}
        <div className={cardCls}>
          <h3 className="font-bold text-white flex items-center gap-2 mb-4"><FaBell className="text-violet-400" size={14} /> Notifications</h3>
          <div className="space-y-3">
            {[
              { key: 'notify_likes', label: 'New Likes' },
              { key: 'notify_matches', label: 'New Matches' },
              { key: 'notify_messages', label: 'New Messages' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-1">
                <span className="text-gray-300 text-sm">{label}</span>
                <button
                  type="button"
                  onClick={() => setPreferences(prev => ({ ...prev, [key]: !prev[key] }))}
                  className={`w-11 h-6 rounded-full transition-all relative ${preferences[key] ? 'bg-violet-600' : 'bg-gray-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${preferences[key] ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={handlePreferencesSave} className="w-full mt-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl text-sm font-semibold transition-all">
            Save Notification Settings
          </button>
        </div>

        {/* Danger Zone */}
        <div className={`${cardCls} border-red-500/20`}>
          <h3 className="font-bold text-red-400 mb-3 text-sm uppercase tracking-wider">Danger Zone</h3>
          <button
            onClick={async () => {
              if (!window.confirm('This will permanently delete your account. Continue?')) return;
              try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${import.meta.env.DEV ? '/api' : 'https://paroniim.xyz/api/v1'}/users/me`, {
                  method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) { const d = await res.json(); addToast(d.detail || 'Failed.', 'error'); return; }
                localStorage.removeItem('token');
                navigate('/signup');
              } catch (e) { addToast(e.message || 'Failed to delete account.', 'error'); }
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-sm font-semibold transition-all"
          >
            <FaUserTimes size={13} /> Delete My Account
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
