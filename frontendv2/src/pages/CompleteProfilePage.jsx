import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { api } from '../services/api';
import { userService } from '../services/user';
import { validateImage } from '../utils/imageValidation';

const CompleteProfilePage = () => {
  const [formData, setFormData] = useState({
    first_name: '',
    surname: '',
    date_of_birth: '',
    gender: '',
    location_city: '',
    latitude: '',
    longitude: '',
    // New fields
    bio: '',
    height_value: '',
    height_unit: 'cm',
    education: '',
    occupation: '',
    relationship_goal: 'relationship',
    smoking: 'never',
    drinking: 'never',
    interests: '',
    // Preferences
    min_age: 18,
    max_age: 100,
    max_distance: 50,
    preferred_genders: ['female', 'male']
  });
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddressSelect = (option) => {
      setAddress(option);
      if (option && window.google) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ placeId: option.value.place_id }, (results, status) => {
              if (status === 'OK' && results[0]) {
                  const lat = results[0].geometry.location.lat();
                  const lng = results[0].geometry.location.lng();
                  
                  const cityComponent = results[0].address_components.find(
                      component => component.types.includes('locality')
                  );
                  const city = cityComponent ? cityComponent.long_name : option.label;
                  
                  setFormData(prev => ({
                      ...prev,
                      location_city: city,
                      latitude: lat,
                      longitude: lng
                  }));
              } else {
                  console.error('Geocode failed: ' + status);
              }
          });
      }
  };

  const handleLocationDetect = () => {
    // Check for secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      alert("Location detection requires a secure connection (HTTPS) or localhost. Please enter your location manually or ensure you are using a secure connection.");
      return;
    }

    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            location_city: 'Detected Location' 
          });
          setLoading(false);
        },
        (error) => {
          console.error("Error getting location", error);
          let msg = "Could not detect location.";
          if (error.code === 1) {
            msg += " Permission denied. Please allow location access in your browser settings.";
          } else if (error.code === 2) {
            msg += " Position unavailable.";
          } else if (error.code === 3) {
            msg += " Timeout.";
          }
          alert(msg + " Please enter manually.");
          setLoading(false);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      // 1. Upload Photo if selected
      if (profilePhotoFile) {
        const isValid = await validateImage(profilePhotoFile);
        if (!isValid.ok) {
            setPhotoError(isValid.message);
            return;
        }
        await userService.uploadPhoto(profilePhotoFile);
      }

      // Validate Height
      if (formData.height_value) {
          const hVal = parseInt(formData.height_value);
          if (formData.height_unit === 'cm') {
               if (hVal < 100 || hVal > 250) {
                   alert('Height must be between 100 and 250 cm');
                   return;
               }
          } else if (formData.height_unit === 'feet_inches') {
               if (hVal < 36 || hVal > 96) {
                   alert('Height must be between 36 and 96 inches');
                   return;
               }
          }
      }

      // 2. Prepare Profile Payload
      let finalBio = formData.bio;
      if (formData.interests) {
        finalBio += `\n\nInterests: ${formData.interests}`;
      }

      const payload = {
        first_name: formData.first_name,
        surname: formData.surname || null,
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        bio: finalBio,
        location_city: formData.location_city,
        height_value: formData.height_value ? parseInt(formData.height_value) : null,
        height_unit: formData.height_unit,
        education: formData.education,
        occupation: formData.occupation,
        relationship_goal: formData.relationship_goal,
        smoking: formData.smoking,
        drinking: formData.drinking,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null
      };

      await api.put('/users/me/profile', payload, token);

      // 3. Update Preferences
      await userService.updatePreferences({
        min_age: formData.min_age,
        max_age: formData.max_age,
        max_distance: formData.max_distance,
        preferred_genders: formData.preferred_genders
      });

      navigate('/matching');
    } catch (error) {
      console.error('Profile completion failed:', error);
      alert('Failed to complete profile: ' + (error.response?.data?.detail || error.message));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full space-y-8 bg-white p-8 rounded-lg shadow">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Complete Your Profile
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Tell us more about yourself to find better matches.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          
          {/* Basic Info */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Basic Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">First Name</label>
                    <input
                        id="first_name"
                        name="first_name"
                        type="text"
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500"
                        value={formData.first_name}
                        onChange={handleChange}
                    />
                </div>
                <div>
                    <label htmlFor="surname" className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input
                        id="surname"
                        name="surname"
                        type="text"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500"
                        value={formData.surname}
                        onChange={handleChange}
                    />
                </div>
                <div>
                    <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700">Date of Birth</label>
                    <input
                        id="date_of_birth"
                        name="date_of_birth"
                        type="date"
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500"
                        value={formData.date_of_birth}
                        onChange={handleChange}
                    />
                </div>
                <div>
                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
                    <select
                        id="gender"
                        name="gender"
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500"
                        value={formData.gender}
                        onChange={handleChange}
                    >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="non_binary">Non-binary</option>
                        <option value="other">Other</option>
                    </select>
                </div>
            </div>
          </div>

          {/* Profile Picture */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
             <h3 className="text-lg font-medium text-gray-900">Profile Picture</h3>
             
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
              </div>

             <div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0] || null;
                    setProfilePhotoFile(file);
                    setPhotoError('');
                    
                    if (file) {
                      const isValid = await validateImage(file);
                      if (!isValid.ok) {
                        setPhotoError(isValid.message);
                      }
                    }
                  }}
                  className="mt-1 block w-full text-sm"
                />
                {photoError && <p className="text-xs text-red-600 mt-1">{photoError}</p>}
                {profilePhotoFile && (
                  <p className="text-xs text-gray-500 mt-1">
                    Selected: {profilePhotoFile.name} ({(profilePhotoFile.size/1024/1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
          </div>

          {/* Lifestyle & Work */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
             <h3 className="text-lg font-medium text-gray-900">Lifestyle & Work</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Height</label>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            name="height_value"
                            value={formData.height_value}
                            onChange={handleChange}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500"
                            placeholder="Height"
                        />
                        <select
                            name="height_unit"
                            value={formData.height_unit}
                            onChange={handleChange}
                            className="mt-1 block w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500"
                        >
                            <option value="cm">cm</option>
                            <option value="feet_inches">ft</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Education</label>
                    <input
                        type="text"
                        name="education"
                        value={formData.education}
                        onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500"
                        placeholder="Highest degree/school"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Occupation</label>
                    <input
                        type="text"
                        name="occupation"
                        value={formData.occupation}
                        onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500"
                        placeholder="Current job"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Relationship Goal</label>
                    <select
                        name="relationship_goal"
                        value={formData.relationship_goal}
                        onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500"
                    >
                        <option value="relationship">Relationship</option>
                        <option value="casual">Casual</option>
                        <option value="friendship">Friendship</option>
                        <option value="undecided">Undecided</option>
                    </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Smoking</label>
                  <select
                    name="smoking"
                    value={formData.smoking}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500"
                  >
                    <option value="never">Never</option>
                    <option value="occasionally">Occasionally</option>
                    <option value="regularly">Regularly</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Drinking</label>
                  <select
                    name="drinking"
                    value={formData.drinking}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500"
                  >
                    <option value="never">Never</option>
                    <option value="occasionally">Occasionally</option>
                    <option value="regularly">Regularly</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
             </div>
             <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Interests</label>
                <input
                    type="text"
                    name="interests"
                    value={formData.interests}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500"
                    placeholder="e.g. Hiking, Photography, Cooking"
                />
             </div>
             <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Bio</label>
                <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    rows="3"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500"
                    placeholder="I love dogs and hiking..."
                ></textarea>
             </div>
          </div>

          {/* Location */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Location</h3>
            <div>
              <label htmlFor="location_city" className="block text-sm font-medium text-gray-700">City</label>
              <div className="mt-1">
                  <GooglePlacesAutocomplete
                      apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                      selectProps={{
                          value: address,
                          onChange: handleAddressSelect,
                          placeholder: 'Start typing your city...',
                          styles: {
                              control: (provided) => ({
                                  ...provided,
                                  borderColor: '#d1d5db',
                                  borderRadius: '0.375rem',
                                  boxShadow: 'none',
                                  '&:hover': {
                                      borderColor: '#e11d48'
                                  }
                              }),
                              input: (provided) => ({
                                  ...provided,
                                  color: '#374151'
                              }),
                              option: (provided, state) => ({
                                  ...provided,
                                  backgroundColor: state.isFocused ? '#fff1f2' : 'white',
                                  color: '#374151'
                              })
                          }
                      }}
                  />
              </div>
              <input type="hidden" name="location_city" value={formData.location_city} />
            </div>
            
             <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="latitude" className="block text-sm font-medium text-gray-700">Latitude</label>
                     <input
                        name="latitude"
                        type="number"
                        step="any"
                        placeholder="Latitude"
                        value={formData.latitude}
                        onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500"
                     />
                 </div>
                 <div>
                    <label htmlFor="longitude" className="block text-sm font-medium text-gray-700">Longitude</label>
                     <input
                        name="longitude"
                        type="number"
                        step="any"
                        placeholder="Longitude"
                        value={formData.longitude}
                        onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500"
                     />
                 </div>
             </div>
            <div>
                <button type="button" onClick={handleLocationDetect} disabled={loading} className="text-sm text-rose-600 hover:text-rose-500">
                    {loading ? "Detecting..." : "Use my current location"}
                </button>
            </div>
          </div>

          {/* Match Preferences */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Match Preferences</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Min Age</label>
                <input
                  type="number"
                  min={18}
                  name="min_age"
                  value={formData.min_age}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Max Age</label>
                <input
                  type="number"
                  max={100}
                  name="max_age"
                  value={formData.max_age}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Max Distance (km)</label>
                <input
                  type="number"
                  min={1}
                  name="max_distance"
                  value={formData.max_distance}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-2">Preferred Genders</span>
              <div className="flex gap-4 flex-wrap">
                {['male','female','non_binary','other'].map(g => (
                  <label key={g} className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.preferred_genders.includes(g)}
                      onChange={(e) => {
                        let next = [...formData.preferred_genders];
                        if (e.target.checked) {
                          if (!next.includes(g)) next.push(g);
                        } else {
                          next = next.filter(x => x !== g);
                        }
                        setFormData({ ...formData, preferred_genders: next });
                      }}
                    />
                    <span>{g.replace('_',' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div>
            {submitError && (
              <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                <span className="block sm:inline">{submitError}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                loading ? 'bg-rose-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500'
              } focus:outline-none focus:ring-2 focus:ring-offset-2`}
            >
              {loading ? 'Saving...' : 'Complete Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfilePage;



