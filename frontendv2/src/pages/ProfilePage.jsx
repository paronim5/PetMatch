import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/user';
import { 
  FaTrash, FaPlus, FaCamera, FaMapMarkerAlt, FaRulerVertical, 
  FaGraduationCap, FaBriefcase, FaWineGlass, FaSmoking, 
  FaHeart, FaSignOutAlt, FaUserTimes, FaShieldAlt 
} from 'react-icons/fa';

const ProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  
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

  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState(null);
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
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchUserAndPhotos();
  }, []);

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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewPhotoFile(file);
      setNewPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadPhoto = async (e) => {
    e.preventDefault();
    if (!newPhotoFile) return;
    
    try {
      await userService.uploadPhoto(newPhotoFile);
      setNewPhotoFile(null);
      setNewPhotoPreview(null);
      setShowPhotoInput(false);
      fetchUserAndPhotos();
    } catch (error) {
      console.error('Failed to add photo:', error);
      alert('Failed to add photo');
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
          alert("Could not get your location. Please allow location access.");
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  if (loading) return <div className="min-h-screen flex justify-center items-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Profile Header */}
        <div className="bg-white shadow rounded-lg p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Profile</h2>
            <p className="text-gray-500">Manage your photos and personal details</p>
          </div>
          <div className="flex gap-4">
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
                  await fetch(`${import.meta.env.DEV ? '/api' : 'http://localhost:8000/api/v1'}/users/me`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  localStorage.removeItem('token');
                  navigate('/signup');
                } catch (e) {
                  alert('Failed to delete account');
                }
              }}
              className="bg-white py-2 px-4 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center gap-2"
            >
              <FaUserTimes /> Delete Account
            </button>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-rose-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
              >
                Edit Profile
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
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
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
            <form onSubmit={handleUploadPhoto} className="mb-6 space-y-4">
              <div className="flex gap-2 items-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-rose-50 file:text-rose-700
                    hover:file:bg-rose-100"
                />
                <button
                  type="submit"
                  disabled={!newPhotoFile}
                  className="bg-rose-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  Upload
                </button>
              </div>
              {newPhotoPreview && (
                <div className="w-32 h-32 relative rounded-lg overflow-hidden border border-gray-300">
                  <img src={newPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </form>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group aspect-w-1 aspect-h-1 bg-gray-200 rounded-lg overflow-hidden">
                <img 
                  src={photo.photo_url} 
                  alt="User photo" 
                  className="object-cover w-full h-40"
                  onError={(e) => {e.target.src = 'https://via.placeholder.com/150?text=Error'}} 
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
          <div className="flex justify-between items-center mb-6 border-b pb-2">
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
