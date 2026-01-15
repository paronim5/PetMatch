import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { userService } from '../services/user';
import { subscriptionService } from '../services/subscription';
import { validateImage } from '../utils/imageValidation';
import { 
  FaTrash, FaPlus, FaCamera, FaMapMarkerAlt, FaRulerVertical, 
  FaGraduationCap, FaBriefcase, FaWineGlass, FaSmoking, 
  FaHeart, FaSignOutAlt, FaUserTimes, FaShieldAlt, FaCrown, FaPlay, FaVideo,
  FaCheckCircle, FaTimesCircle
} from 'react-icons/fa';

class PhotoSectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('PhotoSectionErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-4">
          Something went wrong while loading the photo section. Please reload the page and try again.
        </div>
      );
    }
    return this.props.children;
  }
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adLoading, setAdLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  
  const [profileData, setProfileData] = useState({
    first_name: '',
    surname: '',
    date_of_birth: '',
    bio: '',
    location_city: '',
    latitude: '',
    longitude: '',
    gender: 'other',
    height_value: '',
    height_unit: 'cm',
    education: '',
    occupation: '',
    relationship_goal: 'relationship',
    smoking: 'never',
    drinking: 'never',
    interests: ''
  });

  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [photoValidations, setPhotoValidations] = useState({});
  const [showPhotoInput, setShowPhotoInput] = useState(false);
  const [preferences, setPreferences] = useState({
    min_age: 18,
    max_age: 100,
    max_distance: 50,
    preferred_genders: ['female', 'male'],
    deal_breakers: [],
    notify_likes: true,
    notify_matches: true,
    notify_messages: true
  });
  const [formError, setFormError] = useState('');
  const [prefsError, setPrefsError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      navigate('/login');
    } else {
      fetchUserAndPhotos();
      fetchSubscription();
    }
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      if (searchParams.get('success') === 'true') {
        const sessionId = searchParams.get('session_id');
        if (sessionId) {
          try {
             // Verify session manually
             await subscriptionService.verifySession(sessionId);
          } catch (e) {
             console.error("Verification failed", e);
          }
        }
        setSuccessMessage('Subscription upgraded successfully!');
        fetchSubscription();
        setSearchParams({});
      }
      if (searchParams.get('canceled') === 'true') {
        setFormError('Subscription upgrade canceled.');
        setSearchParams({});
      }
    };
    checkStatus();
  }, [searchParams, setSearchParams]);

  const fetchSubscription = async () => {
    try {
      const status = await subscriptionService.getStatus();
      setSubscription(status);
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
      if (error.message && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    }
  };

  const handleWatchAd = async () => {
    setAdLoading(true);
    try {
      // Simulate ad delay (AdSense integration point)
      await new Promise(resolve => setTimeout(resolve, 3000));
      await subscriptionService.watchAd();
      await fetchSubscription();
      alert("You earned 5 extra swipes!");
    } catch (error) {
      console.error(error);
      alert("Failed to watch ad");
    } finally {
      setAdLoading(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      const response = await subscriptionService.createCheckoutSession('premium');
      if (response.checkout_url) {
        window.location.href = response.checkout_url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error(error);
      alert("Upgrade failed");
    } finally {
      setUpgradeLoading(false);
    }
  };

  // Helper to sanitize photo URLs
  const getPhotoUrl = (url) => {
    if (!url) return null;
    const staticIndex = url.indexOf('/static/');
    if (staticIndex !== -1) {
      return url.substring(staticIndex);
    }
    return url;
  };

  const fetchUserAndPhotos = async () => {
    setLoading(true);
    try {
      const [userRes, photosRes, prefsRes] = await Promise.allSettled([
        userService.getMe(),
        userService.getPhotos(),
        userService.getPreferences()
      ]);

      if (userRes.status === 'fulfilled') {
        const userData = userRes.value;
        setUser(userData);
        if (userData?.profile) {
          setProfileData({
            first_name: userData.profile.first_name || '',
            surname: userData.profile.surname || '',
            date_of_birth: userData.profile.date_of_birth || '',
            bio: userData.profile.bio || '',
            location_city: userData.profile.location_city || '',
            latitude: userData.profile.latitude || '',
            longitude: userData.profile.longitude || '',
            gender: userData.profile.gender || 'other',
            height_value: userData.profile.height_value || '',
            height_unit: userData.profile.height_unit || 'cm',
            education: userData.profile.education || '',
            occupation: userData.profile.occupation || '',
            relationship_goal: userData.profile.relationship_goal || 'relationship',
            smoking: userData.profile.smoking || 'never',
            drinking: userData.profile.drinking || 'never',
            interests: ''
          });
        }
      } else {
        // Handle 401 from user fetch
        const error = userRes.reason;
        if (error && error.message && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }
      }

      if (photosRes.status === 'fulfilled') {
        setPhotos(photosRes.value || []);
      }

      if (prefsRes.status === 'fulfilled' && prefsRes.value) {
        const prefsData = prefsRes.value;
        setPreferences({
          min_age: prefsData.min_age ?? 18,
          max_age: prefsData.max_age ?? 100,
          max_distance: prefsData.max_distance ?? 50,
          preferred_genders: prefsData.preferred_genders ?? ['female', 'male'],
          deal_breakers: prefsData.deal_breakers ?? [],
          notify_likes: prefsData.notify_likes ?? true,
          notify_matches: prefsData.notify_matches ?? true,
          notify_messages: prefsData.notify_messages ?? true
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setProfileData({
      ...profileData,
      [e.target.name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');

    // Validation
    if (!profileData.first_name || !profileData.first_name.trim()) {
      setFormError('First Name is required.');
      return;
    }
    if (!profileData.date_of_birth) {
      setFormError('Date of Birth is required.');
      return;
    }

    try {
      // Convert numeric types
      const payload = {
        ...profileData,
        height_value: profileData.height_value ? parseInt(profileData.height_value) : null,
        latitude: profileData.latitude ? parseFloat(profileData.latitude) : null,
        longitude: profileData.longitude ? parseFloat(profileData.longitude) : null,
      };
      
      await userService.updateProfile(payload);
      setIsEditing(false);
      fetchUserAndPhotos();
      setSuccessMessage('Profile updated successfully!');
      navigate('/matching');
    } catch (error) {
      console.error('Failed to update profile:', error);
      setFormError('We could not save your profile. Please check your inputs and try again.');
    }
  };
  
  const handlePreferencesSave = async () => {
    setPrefsError('');
    setSuccessMessage('');
    try {
      const normInt = (val) =>
        typeof val === 'number' && Number.isFinite(val) ? val : undefined;
      const payload = {
        min_age: normInt(preferences.min_age),
        max_age: normInt(preferences.max_age),
        max_distance: normInt(preferences.max_distance),
        preferred_genders: preferences.preferred_genders || undefined,
        deal_breakers: preferences.deal_breakers || undefined,
        notify_likes: preferences.notify_likes,
        notify_matches: preferences.notify_matches,
        notify_messages: preferences.notify_messages
      };
      await userService.updatePreferences(payload);
      setSuccessMessage('Preferences updated');
    } catch (e) {
      setPrefsError('Please review your preferences and try again.');
    }
  };

  const removePendingPhoto = (index) => {
    const nextFiles = [...pendingPhotos];
    const removed = nextFiles.splice(index, 1)[0];
    setPendingPhotos(nextFiles);
    setPhotoValidations((prev) => {
      const next = { ...prev };
      if (removed && removed.name in next) {
        delete next[removed.name];
      }
      return next;
    });
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    if (pendingPhotos.length + files.length > 10) {
      setUploadError('Maximum 10 photos allowed.');
      return;
    }

    setUploadError('');

    const uniqueFiles = files.filter(file =>
      !pendingPhotos.some(existing => existing.name === file.name && existing.size === file.size)
    );

    if (uniqueFiles.length < files.length) {
      console.log('Skipped duplicate files in profile upload');
    }

    if (uniqueFiles.length === 0) return;

    const newFiles = [...pendingPhotos, ...uniqueFiles];
    setPendingPhotos(newFiles);

    for (const file of uniqueFiles) {
      setPhotoValidations(prev => ({
        ...prev,
        [file.name]: { status: 'loading', message: 'Validating...' }
      }));

      const clientValid = await validateImage(file);
      if (!clientValid.ok) {
        setPhotoValidations(prev => ({
          ...prev,
          [file.name]: { status: 'error', message: clientValid.message }
        }));
        continue;
      }

      try {
        const result = await userService.validatePhoto(file);

        if (result.quarantine) {
          const reason =
            result.rejection_reason ||
            (result.has_human_face
              ? 'Human face detected. Please upload a pet photo without people.'
              : !result.is_animal
                ? 'No animal detected. Please upload a clear pet photo.'
                : result.unsafe_reason ||
                  'This photo cannot be used as a profile picture.');

          setPhotoValidations(prev => ({
            ...prev,
            [file.name]: { status: 'error', message: reason }
          }));
        } else if (!result.is_safe) {
          const unsafeMessage =
            result.unsafe_category === 'nsfw'
              ? (result.unsafe_reason ||
                 'Potential NSFW content detected. Please use a safe, family-friendly pet photo.')
              : (result.security_reason ||
                 'Unsafe content detected. Please try another image.');

          setPhotoValidations(prev => ({
            ...prev,
            [file.name]: { status: 'error', message: unsafeMessage }
          }));
        } else if (!result.is_animal && !result.has_human_face) {
          setPhotoValidations(prev => ({
            ...prev,
            [file.name]: {
              status: 'error',
              message: 'No animal or face detected. Please upload a clear pet photo.'
            }
          }));
        } else {
          setPhotoValidations(prev => ({
            ...prev,
            [file.name]: { status: 'success', message: 'Valid' }
          }));
        }
      } catch (err) {
        console.error('AI validation failed:', err);
        let msg = 'Validation failed';
        const anyErr = err && err.response && err.response.data && err.response.data.detail;
        if (anyErr) msg = anyErr;
        setPhotoValidations(prev => ({
          ...prev,
          [file.name]: { status: 'error', message: msg }
        }));
      }
    }

    e.target.value = '';
  };

  const handleUploadPhoto = async (e) => {
    e.preventDefault();
    const validPhotos = pendingPhotos.filter(
      (f) => photoValidations[f.name]?.status === 'success'
    );

    if (validPhotos.length === 0) {
      setUploadError('Please select at least one valid photo.');
      return;
    }

    const anyLoading = pendingPhotos.some(
      (f) => photoValidations[f.name]?.status === 'loading'
    );
    if (anyLoading) {
      setUploadError('Please wait for photo validation to complete.');
      return;
    }
    
    try {
      setPhotoUploading(true);
      await userService.uploadPhotos(validPhotos);
      setPendingPhotos([]);
      setPhotoValidations({});
      setShowPhotoInput(false);
      fetchUserAndPhotos();
    } catch (error) {
      console.error('Failed to add photo:', error);
      setUploadError(error.message || 'Failed to add photo');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) return;
    try {
      await userService.deletePhoto(photoId);
      fetchUserAndPhotos();
    } catch (error) {
      console.error('Failed to delete photo:', error);
      alert('Failed to delete photo');
    }
  };

  const useCurrentLocation = () => {
    // Check for secure context
    if (!window.isSecureContext) {
      alert("Location detection requires a secure connection (HTTPS) or localhost. Please enter your location manually.");
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setProfileData({
            ...profileData,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          alert(`Location found: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
        },
        (error) => {
          console.error("Error getting location:", error);
          let msg = "Could not get your location.";
          if (error.code === 1) {
             msg += " Permission denied. Please allow location access.";
          } else if (error.code === 2) {
             msg += " Position unavailable.";
          } else if (error.code === 3) {
             msg += " Timeout.";
          }
          alert(msg + " Please enter manually.");
        },
        {
           enableHighAccuracy: true,
           timeout: 10000,
           maximumAge: 0
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  if (loading) return <div className="min-h-screen flex justify-center items-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-3 md:py-12 md:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-4 md:space-y-8">
        
        {/* Subscription Card */}
        <div className="bg-white shadow rounded-lg p-4 md:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FaCrown className={subscription?.is_premium ? "text-yellow-500" : "text-gray-400"} />
                Subscription Status
              </h3>
              <p className="text-gray-500 mt-1">
                Current Plan: <span className="font-semibold capitalize text-gray-800">{subscription?.tier || 'Free'}</span>
              </p>
            </div>
            <div className="text-left sm:text-right w-full sm:w-auto">
               <p className="text-sm text-gray-500">Daily Swipes</p>
               <p className="text-2xl font-bold text-rose-600">
                 {subscription?.is_premium ? 'Unlimited' : `${subscription?.remaining_swipes ?? 0} / ${subscription?.daily_swipe_limit ?? 20}`}
               </p>
            </div>
          </div>

          {!subscription?.is_premium && (
            <div className="mt-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleUpgrade}
                  disabled={upgradeLoading}
                  className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-600 text-white py-3 px-4 rounded-lg shadow-md hover:from-yellow-600 hover:to-amber-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {upgradeLoading ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : <FaCrown />}
                  Upgrade to Premium
                </button>

                <button
                  onClick={handleWatchAd}
                  disabled={adLoading}
                  className="flex-1 bg-gray-900 text-white py-3 px-4 rounded-lg shadow-md hover:bg-gray-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {adLoading ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : <FaPlay />}
                  Watch Ad (+5 Swipes)
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Watch a short video ad to get 5 more swipes instantly. Google Play Billing integration is simulated.
              </p>
            </div>
          )}
          
          {subscription?.is_premium && (
             <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-100 text-yellow-800 flex items-center gap-3">
               <FaCrown size={24} />
               <div>
                 <p className="font-bold">You are a Premium Member!</p>
                 <p className="text-sm">Enjoy unlimited swipes and ad-free experience.</p>
               </div>
             </div>
          )}
        </div>

        {/* Profile Header */}
        <div className="bg-white shadow rounded-lg p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-center sm:text-left w-full sm:w-auto">
            <h2 className="text-2xl font-bold text-gray-900">Your Profile</h2>
            <p className="text-gray-500">Manage your photos and personal details</p>
          </div>
          <div className="flex flex-wrap justify-center sm:justify-end gap-3 w-full sm:w-auto">
            <button
              onClick={() => navigate('/matching')}
              className="bg-white py-2 px-4 border border-rose-300 rounded-md shadow-sm text-sm font-medium text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 flex items-center gap-2"
            >
              <FaHeart /> Find Matches
            </button>
            <button
              onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 flex items-center gap-2"
            >
              <FaSignOutAlt /> Logout
            </button>
            <button
              onClick={async () => {
                if (!window.confirm('This will permanently delete your account. Continue?')) return;
                try {
                  const token = localStorage.getItem('token');
                  const response = await fetch(`${import.meta.env.DEV ? '/api' : 'https://paroniim.xyz/api/v1'}/users/me`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  
                  if (!response.ok) {
                     const data = await response.json();
                     if (response.status === 403) {
                         alert(data.detail); // Show the backend message if restricted
                         return;
                     }
                     throw new Error(data.detail || 'Failed to delete account');
                  }
                  
                  localStorage.removeItem('token');
                  navigate('/signup');
                } catch (e) {
                  alert(e.message || 'Failed to delete account');
                }
              }}
              className="bg-white py-2 px-4 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center gap-2"
            >
              <FaUserTimes /> Delete
            </button>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-rose-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
              >
                Edit
              </button>
            )}
          </div>
        </div>
        
        {formError && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded">
            {formError}
          </div>
        )}
        {prefsError && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded">
            {prefsError}
          </div>
        )}
        {successMessage && (
          <div className="bg-green-50 text-green-700 text-sm p-3 rounded">
            {successMessage}
          </div>
        )}

        {/* Photos Section */}
        <PhotoSectionErrorBoundary>
        <div className="bg-white shadow rounded-lg p-4 md:p-6">
          <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
             <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
               <FaCamera className="text-rose-500" /> Photos
             </h3>
             <button 
               onClick={() => setShowPhotoInput(!showPhotoInput)}
               className="text-sm text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
             >
               <FaPlus /> Add Photo
             </button>
          </div>

          {showPhotoInput && (
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h4 className="font-medium text-gray-700 mb-2">Upload New Photo</h4>
              
              {/* Upload Guidelines */}
                      <div className="mb-4 p-4 bg-blue-50 text-blue-800 text-sm rounded border border-blue-100">
                        <p className="font-bold mb-3 flex items-center"><FaShieldAlt className="mr-2"/> Strict Content Guidelines:</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                           <div className="bg-white p-3 rounded border border-green-200">
                              <p className="font-bold text-green-700 mb-2 flex items-center"><FaCheckCircle className="mr-1"/> ACCEPTED</p>
                              <ul className="space-y-1 text-gray-600 text-xs">
                                <li>• Clear animal photos</li>
                                <li>• Cats, dogs, birds, etc.</li>
                                <li>• Well-lit & high quality</li>
                              </ul>
                           </div>
                           <div className="bg-white p-3 rounded border border-red-200">
                              <p className="font-bold text-red-700 mb-2 flex items-center"><FaTimesCircle className="mr-1"/> REJECTED</p>
                              <ul className="space-y-1 text-gray-600 text-xs">
                                <li>• Human faces (Strict)</li>
                                <li>• Blurry or dark photos</li>
                                <li>• Non-animal objects</li>
                              </ul>
                           </div>
                        </div>
                        <p className="mt-3 text-xs text-blue-600">
                           <strong>Note:</strong> Our AI automatically screens all uploads. Violations may result in account restrictions.
                        </p>
                      </div>

              {uploadError && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded border border-red-200">
                  {uploadError}
                </div>
              )}
              
              <form onSubmit={handleUploadPhoto} className="space-y-4">
                <input 
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
                />

                {pendingPhotos.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {pendingPhotos.map((file, idx) => (
                      <div key={idx} className="relative group border rounded-lg p-2 bg-gray-50">
                        <div className="aspect-square bg-gray-200 rounded mb-2 overflow-hidden">
                          <img
                            src={URL.createObjectURL(file)}
                            alt="preview"
                            className="w-full h-full object-cover"
                            onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                          />
                        </div>
                        <div className="text-xs truncate font-medium text-gray-700">{file.name}</div>
                        <div className="mt-1 text-xs font-medium">
                          {photoValidations[file.name]?.status === 'loading' && (
                            <span className="text-blue-600">Validating...</span>
                          )}
                          {photoValidations[file.name]?.status === 'success' && (
                            <span className="text-green-600">✓ Valid</span>
                          )}
                          {photoValidations[file.name]?.status === 'error' && (
                            <span className="text-red-600">✕ {photoValidations[file.name]?.message}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePendingPhoto(idx);
                          }}
                          className="absolute top-1 right-1 bg-white rounded-full p-1 shadow hover:bg-red-50 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove photo"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowPhotoInput(false);
                      setPendingPhotos([]);
                      setPhotoValidations({});
                      setUploadError('');
                      setPhotoUploading(false);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={pendingPhotos.length === 0 || photoUploading}
                    className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                      pendingPhotos.length === 0 || photoUploading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {photoUploading ? 'Uploading...' : 'Upload Photo'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group aspect-w-1 aspect-h-1 bg-gray-200 rounded-lg overflow-hidden">
                <img
                  src={getPhotoUrl(photo.photo_url) || 'https://via.placeholder.com/150'}
                  alt="Profile"
                  className="object-cover w-full h-40"
                  onError={(e) => {
                    // Try to load a local placeholder if external fails, or just hide it
                    e.target.src = '/vite.svg'; // Fallback to a local asset we know exists
                    e.target.onerror = null; // Prevent infinite loop
                  }} 
                />
                <button
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                >
                  <FaTrash size={12} />
                </button>
                {photo.is_primary && (
                  <span className="absolute bottom-2 left-2 bg-rose-500 text-white text-xs px-2 py-1 rounded-full">
                    Primary
                  </span>
                )}
              </div>
            ))}
            {photos.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                No photos yet. Add some to get matches!
              </div>
            )}
          </div>
        </div>
        </PhotoSectionErrorBoundary>

        {/* Details Form */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6 border-b pb-2">Personal Details</h3>
          
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    value={profileData.first_name}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    type="text"
                    name="surname"
                    value={profileData.surname}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={profileData.date_of_birth}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Gender</label>
                  <select
                    name="gender"
                    value={profileData.gender}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700">Occupation</label>
                   <input
                     type="text"
                     name="occupation"
                     value={profileData.occupation}
                     onChange={handleChange}
                     className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                   />
                </div>
              </div>

              {/* Location */}
              <div className="bg-blue-50 p-4 rounded-lg space-y-4">
                 <h4 className="font-medium text-blue-800 flex items-center gap-2">
                   <FaMapMarkerAlt /> Location
                 </h4>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-700">City</label>
                      <input
                        type="text"
                        name="location_city"
                        value={profileData.location_city}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-700">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        name="latitude"
                        value={profileData.latitude}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-700">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        name="longitude"
                        value={profileData.longitude}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                      />
                    </div>
                 </div>
                 <button
                   type="button"
                   onClick={useCurrentLocation}
                   className="text-sm text-blue-600 hover:text-blue-800 font-medium underline"
                 >
                   Use My Current Location
                 </button>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Bio</label>
                <textarea
                  name="bio"
                  rows={4}
                  value={profileData.bio}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                />
              </div>

              {/* Extended Details */}
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Height (cm)</label>
                    <input
                      type="number"
                      name="height_value"
                      value={profileData.height_value}
                      onChange={handleChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Education</label>
                    <input
                      type="text"
                      name="education"
                      value={profileData.education}
                      onChange={handleChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Relationship Goal</label>
                    <select
                      name="relationship_goal"
                      value={profileData.relationship_goal}
                      onChange={handleChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                    >
                      <option value="relationship">Long-term Relationship</option>
                      <option value="casual">Casual</option>
                      <option value="friendship">Friendship</option>
                      <option value="undecided">Undecided</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Smoking</label>
                    <select
                      name="smoking"
                      value={profileData.smoking}
                      onChange={handleChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                    >
                      <option value="never">Never</option>
                      <option value="occasionally">Occasionally</option>
                      <option value="regularly">Regularly</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                 </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-rose-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-rose-700 focus:outline-none"
                >
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                 <div className="sm:col-span-1">
                   <dt className="text-sm font-medium text-gray-500">Name</dt>
                   <dd className="mt-1 text-sm text-gray-900">{user?.profile?.first_name}</dd>
                 </div>
                 <div className="sm:col-span-1">
                   <dt className="text-sm font-medium text-gray-500">Age</dt>
                   <dd className="mt-1 text-sm text-gray-900">
                     {user?.profile?.date_of_birth ? 
                       new Date().getFullYear() - new Date(user?.profile?.date_of_birth).getFullYear() 
                       : 'N/A'}
                   </dd>
                 </div>
                 <div className="sm:col-span-2">
                   <dt className="text-sm font-medium text-gray-500">Bio</dt>
                   <dd className="mt-1 text-sm text-gray-900">{user?.profile?.bio || 'No bio yet.'}</dd>
                 </div>
                 <div className="sm:col-span-1">
                   <dt className="text-sm font-medium text-gray-500">Location</dt>
                   <dd className="mt-1 text-sm text-gray-900">{user?.profile?.location_city || 'Not set'}</dd>
                 </div>
                 <div className="sm:col-span-1">
                   <dt className="text-sm font-medium text-gray-500">Occupation</dt>
                   <dd className="mt-1 text-sm text-gray-900">{user?.profile?.occupation || 'Not set'}</dd>
                 </div>
                 <div className="sm:col-span-1">
                   <dt className="text-sm font-medium text-gray-500">Education</dt>
                   <dd className="mt-1 text-sm text-gray-900">{user?.profile?.education || 'Not set'}</dd>
                 </div>
                 <div className="sm:col-span-1">
                   <dt className="text-sm font-medium text-gray-500">Height</dt>
                   <dd className="mt-1 text-sm text-gray-900">{user?.profile?.height_value ? `${user?.profile?.height_value} ${user?.profile?.height_unit}` : 'Not set'}</dd>
                 </div>
              </dl>
            </div>
          )}
        </div>
        
        {/* Match Preferences */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b pb-2 gap-2">
            <h3 className="text-lg font-medium text-gray-900">Match Preferences</h3>
            <button
              onClick={() => navigate('/blocks')}
              className="text-gray-600 hover:text-rose-500 flex items-center gap-1 text-sm"
            >
              <FaShieldAlt /> Blocked Users
            </button>
          </div>
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Minimum Age</label>
              <input
                type="number"
                min={18}
                name="min_age"
                value={Number.isNaN(preferences.min_age) || preferences.min_age === undefined ? '' : preferences.min_age}
                onChange={(e) => {
                  const v = e.target.value;
                  setPreferences({ ...preferences, min_age: v === '' ? undefined : parseInt(v, 10) });
                }}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Maximum Age</label>
              <input
                type="number"
                max={100}
                name="max_age"
                value={Number.isNaN(preferences.max_age) || preferences.max_age === undefined ? '' : preferences.max_age}
                onChange={(e) => {
                  const v = e.target.value;
                  setPreferences({ ...preferences, max_age: v === '' ? undefined : parseInt(v, 10) });
                }}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Max Distance (km)</label>
              <input
                type="number"
                min={1}
                name="max_distance"
                value={Number.isNaN(preferences.max_distance) || preferences.max_distance === undefined ? '' : preferences.max_distance}
                onChange={(e) => {
                  const v = e.target.value;
                  setPreferences({ ...preferences, max_distance: v === '' ? undefined : parseInt(v, 10) });
                }}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Preferred Genders</label>
              <select
                multiple
                value={preferences.preferred_genders}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions).map(o => o.value);
                  setPreferences({ ...preferences, preferred_genders: opts });
                }}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non_binary">Non-binary</option>
                <option value="other">Other</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <button
              onClick={handlePreferencesSave}
              className="bg-rose-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-rose-700"
            >
              Save Preferences
            </button>
          </div>
        </div>
        
        {/* Notification Settings */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6 border-b pb-2">Notification Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <label className="text-sm font-medium text-gray-700">New Likes</label>
               <input
                 type="checkbox"
                 checked={preferences.notify_likes ?? true}
                 onChange={(e) => setPreferences({...preferences, notify_likes: e.target.checked})}
                 className="h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300 rounded"
               />
            </div>
            <div className="flex items-center justify-between">
               <label className="text-sm font-medium text-gray-700">New Matches</label>
               <input
                 type="checkbox"
                 checked={preferences.notify_matches ?? true}
                 onChange={(e) => setPreferences({...preferences, notify_matches: e.target.checked})}
                 className="h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300 rounded"
               />
            </div>
            <div className="flex items-center justify-between">
               <label className="text-sm font-medium text-gray-700">New Messages</label>
               <input
                 type="checkbox"
                 checked={preferences.notify_messages ?? true}
                 onChange={(e) => setPreferences({...preferences, notify_messages: e.target.checked})}
                 className="h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300 rounded"
               />
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <button
              onClick={handlePreferencesSave}
              className="bg-rose-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-rose-700"
            >
              Save Notification Settings
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProfilePage;
