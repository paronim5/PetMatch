import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { api } from '../services/api';
import { userService } from '../services/user';
import { validateImage } from '../utils/imageValidation';
import { FaShieldAlt, FaCheckCircle, FaTimesCircle, FaMapMarkerAlt, FaUser, FaCamera, FaHeart, FaCog } from 'react-icons/fa';

const CompleteProfilePage = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [formData, setFormData] = useState({
    first_name: '',
    surname: '',
    date_of_birth: '',
    gender: '',
    location_city: '',
    latitude: '',
    longitude: '',
    phone_country_code: '+420',
    phone_number: '',
    bio: '',
    height_value: '',
    height_unit: 'cm',
    education: '',
    occupation: '',
    relationship_goal: 'relationship',
    smoking: 'never',
    drinking: 'never',
    interests: '',
    min_age: 18,
    max_age: 100,
    max_distance: 50,
    preferred_genders: ['female', 'male']
  });
  
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [address, setAddress] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = await userService.getMe();
        if (user.profile) {
            setFormData(prev => ({
                ...prev,
                first_name: user.profile.first_name || '',
                surname: user.profile.surname || '',
                date_of_birth: user.profile.date_of_birth || '',
                gender: user.profile.gender || '',
                location_city: user.profile.location_city || '',
                bio: user.profile.bio || '',
                height_value: user.profile.height_value || '',
                height_unit: user.profile.height_unit || 'cm',
                education: user.profile.education || '',
                occupation: user.profile.occupation || '',
                relationship_goal: user.profile.relationship_goal || 'relationship',
                smoking: user.profile.smoking || 'never',
                drinking: user.profile.drinking || 'never'
            }));
        }
      } catch (err) {
        console.error('Failed to fetch user data:', err);
      }
    };
    fetchUserData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Clear error when field changes
    if (fieldErrors[name]) {
      setFieldErrors({ ...fieldErrors, [name]: null });
    }
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
    if (!window.isSecureContext) {
      alert("Location detection requires a secure connection (HTTPS) or localhost.");
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
          alert("Could not detect location. Please enter manually.");
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  const validateStep = (currentStep) => {
    const errors = {};
    if (currentStep === 1) {
      if (!formData.first_name) errors.first_name = 'First name is required';
      if (!formData.date_of_birth) errors.date_of_birth = 'Date of birth is required';
      if (!formData.gender) errors.gender = 'Gender is required';
      if (!formData.phone_number) errors.phone_number = 'Phone number is required';
      else if (formData.phone_number.replace(/[^0-9]/g, '').length < 6) {
        errors.phone_number = 'Please enter a valid phone number';
      }
      
      if (formData.date_of_birth) {
        const age = new Date().getFullYear() - new Date(formData.date_of_birth).getFullYear();
        if (age < 18) errors.date_of_birth = 'You must be at least 18 years old';
      }
    }
    
    if (currentStep === 2) {
      if (!profilePhotoFile && !photoError) {
        // Photo is highly recommended but maybe not strictly required if they already have one?
        // For Google login, they might have one, but we want a pet photo.
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
      window.scrollTo(0, 0);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validateStep(step)) return;

    setLoading(true);
    setSubmitStatus('Completing your profile...');
    
    try {
      const token = localStorage.getItem('token');
      const sanitizedLocal = formData.phone_number.replace(/[^0-9]/g, '');
      const phoneE164 = `${formData.phone_country_code}${sanitizedLocal}`;

      // 1. Upload Photo
      if (profilePhotoFile && !photoError) {
        try {
          await userService.uploadPhoto(profilePhotoFile);
        } catch (photoError) {
          console.error('Photo upload failed:', photoError);
        }
      }

      // 2. Update Profile
      let finalBio = formData.bio;
      if (formData.interests) {
        finalBio += `\n\nInterests: ${formData.interests}`;
      }

      const profilePayload = {
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
        phone_number: phoneE164,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null
      };

      await api.put('/users/me/profile', profilePayload, token);

      // 3. Update Preferences
      await userService.updatePreferences({
        min_age: formData.min_age,
        max_age: formData.max_age,
        max_distance: formData.max_distance,
        preferred_genders: formData.preferred_genders
      });

      setSubmitStatus('Success! Redirecting...');
      setTimeout(() => navigate('/matching'), 1500);
    } catch (error) {
      console.error('Profile completion failed:', error);
      setSubmitStatus('');
      alert('Failed to complete profile: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-orange-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            {[1, 2, 3, 4].map((s) => (
              <div 
                key={s}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step >= s ? 'bg-rose-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s}
              </div>
            ))}
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div 
              className="h-full bg-rose-500 rounded-full transition-all duration-300"
              style={{ width: `${((step - 1) / 3) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-rose-500 p-6 text-white text-center">
            <h2 className="text-2xl font-bold">Complete Your Profile</h2>
            <p className="text-rose-100">Help us find the perfect match for your pet</p>
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit}>
              {/* Step 1: Basic Info */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center space-x-2 text-rose-500 font-semibold mb-4">
                    <FaUser /> <span>Basic Information</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name*</label>
                      <input
                        name="first_name"
                        type="text"
                        value={formData.first_name}
                        onChange={handleChange}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500 ${fieldErrors.first_name ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {fieldErrors.first_name && <p className="text-red-500 text-xs mt-1">{fieldErrors.first_name}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                      <input
                        name="surname"
                        type="text"
                        value={formData.surname}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth*</label>
                      <input
                        name="date_of_birth"
                        type="date"
                        value={formData.date_of_birth}
                        onChange={handleChange}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500 ${fieldErrors.date_of_birth ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {fieldErrors.date_of_birth && <p className="text-red-500 text-xs mt-1">{fieldErrors.date_of_birth}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gender*</label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500 ${fieldErrors.gender ? 'border-red-500' : 'border-gray-300'}`}
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="non_binary">Non-binary</option>
                        <option value="other">Other</option>
                      </select>
                      {fieldErrors.gender && <p className="text-red-500 text-xs mt-1">{fieldErrors.gender}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number*</label>
                      <div className="flex gap-2">
                        <select
                          name="phone_country_code"
                          value={formData.phone_country_code}
                          onChange={handleChange}
                          className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                        >
                          <option value="+420">CZ (+420)</option>
                          <option value="+1">US (+1)</option>
                          <option value="+44">UK (+44)</option>
                        </select>
                        <input
                          name="phone_number"
                          type="tel"
                          placeholder="777 123 456"
                          value={formData.phone_number}
                          onChange={handleChange}
                          className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500 ${fieldErrors.phone_number ? 'border-red-500' : 'border-gray-300'}`}
                        />
                      </div>
                      {fieldErrors.phone_number && <p className="text-red-500 text-xs mt-1">{fieldErrors.phone_number}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Photo */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center space-x-2 text-rose-500 font-semibold mb-4">
                    <FaCamera /> <span>Profile Picture</span>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
                    <p className="font-bold flex items-center mb-2"><FaShieldAlt className="mr-2"/> Safety Guidelines</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-2 rounded border border-green-200 text-green-700">
                        <p className="font-bold flex items-center mb-1"><FaCheckCircle className="mr-1"/> DO</p>
                        <ul className="text-xs"><li>Pet photos</li><li>High quality</li></ul>
                      </div>
                      <div className="bg-white p-2 rounded border border-red-200 text-red-700">
                        <p className="font-bold flex items-center mb-1"><FaTimesCircle className="mr-1"/> DON'T</p>
                        <ul className="text-xs"><li>Human faces</li><li>Blurry images</li></ul>
                      </div>
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setProfilePhotoFile(file);
                          setPhotoError('');
                          const validation = await validateImage(file);
                          if (!validation.ok) setPhotoError(validation.message);
                          else {
                            try {
                              const ai = await userService.validatePhoto(file);
                              if (ai.quarantine) setPhotoError(ai.rejection_reason || 'Invalid photo');
                            } catch (err) { console.error(err); }
                          }
                        }
                      }}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label htmlFor="photo-upload" className="cursor-pointer flex flex-col items-center">
                      <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-4">
                        <FaCamera size={40} />
                      </div>
                      <span className="text-rose-500 font-semibold">Click to upload photo</span>
                      <span className="text-gray-400 text-xs mt-1">JPG, PNG, WebP (Max 5MB)</span>
                    </label>
                  </div>
                  {photoError && <p className="text-red-500 text-sm text-center">{photoError}</p>}
                  {profilePhotoFile && <p className="text-green-600 text-sm text-center">Selected: {profilePhotoFile.name}</p>}
                </div>
              )}

              {/* Step 3: Lifestyle & Bio */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="flex items-center space-x-2 text-rose-500 font-semibold mb-4">
                    <FaHeart /> <span>Lifestyle & About</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                      <div className="flex gap-2">
                        <input
                          name="height_value"
                          type="number"
                          value={formData.height_value}
                          onChange={handleChange}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                        />
                        <select
                          name="height_unit"
                          value={formData.height_unit}
                          onChange={handleChange}
                          className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                        >
                          <option value="cm">cm</option>
                          <option value="feet_inches">in</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Relationship Goal</label>
                      <select
                        name="relationship_goal"
                        value={formData.relationship_goal}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="relationship">Long-term</option>
                        <option value="casual">Casual</option>
                        <option value="friendship">Friendship</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                      <textarea
                        name="bio"
                        rows="4"
                        value={formData.bio}
                        onChange={handleChange}
                        placeholder="Tell us about your pet..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Preferences & Location */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="flex items-center space-x-2 text-rose-500 font-semibold mb-4">
                    <FaCog /> <span>Preferences & Location</span>
                  </div>
                  
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700">Location</label>
                    <GooglePlacesAutocomplete
                      selectProps={{
                        value: address,
                        onChange: handleAddressSelect,
                        placeholder: 'Search for your city...',
                        className: 'w-full'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleLocationDetect}
                      className="flex items-center space-x-2 text-rose-500 text-sm font-medium hover:text-rose-600"
                    >
                      <FaMapMarkerAlt /> <span>Use current location</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700">Age Range Preferences</label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="number"
                        name="min_age"
                        value={formData.min_age}
                        onChange={handleChange}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <span>to</span>
                      <input
                        type="number"
                        name="max_age"
                        value={formData.max_age}
                        onChange={handleChange}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="mt-8 flex justify-between">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold"
                  >
                    Back
                  </button>
                )}
                {step < 4 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="ml-auto px-8 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 font-bold shadow-lg shadow-rose-200 transition-all"
                  >
                    Next Step
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="ml-auto px-8 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 font-bold shadow-lg shadow-rose-200 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Finish Registration'}
                  </button>
                )}
              </div>
              {submitStatus && <p className="mt-4 text-center text-rose-500 font-medium">{submitStatus}</p>}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfilePage;
