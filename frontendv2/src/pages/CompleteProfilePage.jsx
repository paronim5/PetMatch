import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { api } from '../services/api';
import { userService } from '../services/user';
import { validateImage } from '../utils/imageValidation';
import { FaShieldAlt, FaCheckCircle, FaTimesCircle, FaMapMarkerAlt, FaUser, FaCamera, FaHeart, FaCog, FaChevronLeft, FaChevronRight, FaSpinner, FaLock } from 'react-icons/fa';

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
    preferred_genders: ['female', 'male'],
    password: '',
    confirmPassword: ''
  });
  
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [photoValidation, setPhotoValidation] = useState({ status: 'idle', message: '' });
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
        if (user.photos && user.photos.length > 0) {
            setExistingPhotos(user.photos);
            const primary = user.photos.find(p => p.is_primary) || user.photos[0];
            setPhotoPreview(primary.photo_url.startsWith('http') ? primary.photo_url : `${import.meta.env.VITE_API_URL}/static/uploads/${primary.photo_url}`);
            setPhotoValidation({ status: 'success', message: 'Current profile photo' });
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
    if (fieldErrors[name]) setFieldErrors({ ...fieldErrors, [name]: null });
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProfilePhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoValidation({ status: 'loading', message: 'Validating photo...' });

    // Artificial delay to show validation process (3-5s as requested)
    setTimeout(async () => {
      // 1. Client-side validation (Format, Size, Dimensions)
      const clientValid = await validateImage(file);
      if (!clientValid.ok) {
        setPhotoValidation({ status: 'error', message: clientValid.message });
        return;
      }

      // 2. Format & Size checks (Specific to request: max 10MB, JPEG/PNG)
      const validFormats = ['image/jpeg', 'image/png'];
      if (!validFormats.includes(file.type)) {
        setPhotoValidation({ status: 'error', message: 'Only JPEG and PNG formats are allowed.' });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setPhotoValidation({ status: 'error', message: 'File size must be less than 10MB.' });
        return;
      }

      // 3. AI/Server-side Quality & Content Validation
      try {
        const result = await userService.validatePhoto(file);
        if (result.quarantine || !result.is_safe || (!result.is_animal && !result.has_human_face)) {
          setPhotoValidation({ status: 'error', message: 'Image quality or content is invalid.' });
        } else {
          setPhotoValidation({ status: 'success', message: 'Photo is valid and safe!' });
        }
      } catch (err) {
        setPhotoValidation({ status: 'error', message: 'Validation failed. Please try another image.' });
      }
    }, 2500);
  };

  const handleAddressSelect = (option) => {
    setAddress(option);
    if (option && window.google) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ placeId: option.value.place_id }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const lat = results[0].geometry.location.lat();
          const lng = results[0].geometry.location.lng();
          const cityComponent = results[0].address_components.find(c => c.types.includes('locality'));
          setFormData(prev => ({ ...prev, location_city: cityComponent ? cityComponent.long_name : option.label, latitude: lat, longitude: lng }));
        }
      });
    }
  };

  const handlePhotoDelete = async () => {
    // If we have a newly selected file, just remove it locally first
    if (profilePhotoFile) {
      setProfilePhotoFile(null);
      setPhotoValidation({ status: 'idle', message: '' });
      
      // If we had existing photos, restore the preview of the primary one
      if (existingPhotos.length > 0) {
        const primary = existingPhotos.find(p => p.is_primary) || existingPhotos[0];
        setPhotoPreview(primary.photo_url.startsWith('http') ? primary.photo_url : `${import.meta.env.VITE_API_URL}/static/uploads/${primary.photo_url}`);
        setPhotoValidation({ status: 'success', message: 'Current profile photo' });
      } else {
        setPhotoPreview(null);
      }
      return;
    }

    // If no new file but we have existing photos, delete them from server
    if (existingPhotos.length > 0) {
      if (!window.confirm('Are you sure you want to remove your current profile photo?')) return;
      
      try {
        setLoading(true);
        for (const photo of existingPhotos) {
          await userService.deletePhoto(photo.id);
        }
        setExistingPhotos([]);
        setPhotoPreview(null);
        setPhotoValidation({ status: 'idle', message: '' });
      } catch (err) {
        console.error('Failed to delete photos:', err);
        alert('Failed to remove current photo');
      } finally {
        setLoading(false);
      }
    }
  };

  const validateStep = (currentStep) => {
    const errors = {};
    if (currentStep === 1) {
      if (!formData.first_name) errors.first_name = 'Required';
      if (!formData.date_of_birth) errors.date_of_birth = 'Required';
      if (!formData.gender) errors.gender = 'Required';
      if (!formData.phone_number) errors.phone_number = 'Required';
    }
    if (currentStep === 2) {
      if (photoValidation.status === 'error') {
        errors.photo = photoValidation.message || 'Please upload a valid photo';
      } else if (!photoPreview && existingPhotos.length === 0) {
        errors.photo = 'A profile photo is required';
      }
    }
    if (currentStep === 3) {
      if (formData.height_value) {
        const val = parseFloat(formData.height_value);
        if (formData.height_unit === 'cm') {
          if (val < 100 || val > 250) errors.height_value = 'Height must be between 100 and 250 cm';
        } else {
          if (val < 36 || val > 96) errors.height_value = 'Height must be between 36 and 96 inches';
        }
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validateStep(step)) return;
    setLoading(true);
    setSubmitStatus('Saving profile...');
    try {
      if (profilePhotoFile && photoValidation.status === 'success') {
        await userService.uploadPhoto(profilePhotoFile);
      }
      const sanitizedLocal = formData.phone_number.replace(/[^0-9]/g, '');
      const phoneE164 = `${formData.phone_country_code}${sanitizedLocal}`;
      await userService.updateProfile({ ...formData, phone_number: phoneE164 });
      await userService.updatePreferences({ min_age: formData.min_age, max_age: formData.max_age, max_distance: formData.max_distance, preferred_genders: formData.preferred_genders });
      // Handle password update if provided
      if (formData.password) {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await userService.updateProfile({ password: formData.password });
      }

      setSubmitStatus('Profile complete!');
      setTimeout(() => navigate('/matching'), 1500);
    } catch (error) {
      setSubmitStatus('');
      alert('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-orange-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-all ${
                step >= s ? 'bg-rose-500 text-white' : 'bg-white text-gray-400'
              }`}>
                {s}
              </div>
            ))}
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${((step - 1) / 3) * 100}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-rose-500 p-8 text-white text-center">
            <h2 className="text-3xl font-extrabold">Complete Profile</h2>
            <p className="mt-2 text-rose-100">Step {step} of 4</p>
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {step === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">First Name</label>
                      <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className={`block w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500 transition-all ${fieldErrors.first_name ? 'ring-2 ring-red-500' : ''}`} placeholder="Your first name" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Surname</label>
                      <input type="text" name="surname" value={formData.surname} onChange={handleChange} className="block w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500 transition-all" placeholder="Optional" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Date of Birth</label>
                      <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} className={`block w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500 transition-all ${fieldErrors.date_of_birth ? 'ring-2 ring-red-500' : ''}`} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Gender</label>
                      <select name="gender" value={formData.gender} onChange={handleChange} className={`block w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500 transition-all ${fieldErrors.gender ? 'ring-2 ring-red-500' : ''}`}>
                        <option value="">Select...</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-gray-100">
                    <h4 className="text-xs font-bold text-gray-500 mb-4 flex items-center gap-2">
                      <FaLock className="text-rose-400" /> Account Security (Optional)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">New Password</label>
                        <input type="password" name="password" value={formData.password} onChange={handleChange} className="block w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500 transition-all" placeholder="Set a password" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Confirm Password</label>
                        <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="block w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500 transition-all" placeholder="Repeat password" />
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-gray-400">Set a password if you want to log in with your email later.</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Phone Number</label>
                    <div className="flex gap-2">
                      <select name="phone_country_code" value={formData.phone_country_code} onChange={handleChange} className="w-28 px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500 transition-all">
                        <option value="+420">🇨🇿 +420</option>
                        <option value="+421">🇸🇰 +421</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+44">🇬🇧 +44</option>
                        <option value="+49">🇩🇪 +49</option>
                      </select>
                      <input type="tel" name="phone_number" value={formData.phone_number} onChange={handleChange} className={`flex-1 px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500 transition-all ${fieldErrors.phone_number ? 'ring-2 ring-red-500' : ''}`} placeholder="777 123 456" />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6 animate-fadeIn flex flex-col items-center">
                  {fieldErrors.photo && (
                    <div className="w-full p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs font-bold text-center animate-bounce">
                      {fieldErrors.photo}
                    </div>
                  )}
                  <div className="relative w-40 h-40 group">
                    <div className={`w-full h-full rounded-3xl overflow-hidden border-2 border-dashed transition-all flex items-center justify-center bg-gray-50 ${
                      photoValidation.status === 'error' ? 'border-red-300' : 
                      photoValidation.status === 'success' ? 'border-green-300' : 'border-rose-200'
                    }`}>
                      {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <FaCamera className="text-4xl text-rose-200" />
                      )}
                      
                      {photoValidation.status === 'loading' && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>

                    <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-rose-500 text-white rounded-xl shadow-lg flex items-center justify-center cursor-pointer hover:bg-rose-600 transition-all hover:scale-110">
                      <FaCamera size={18} />
                      <input type="file" className="hidden" accept="image/jpeg,image/png" onChange={handlePhotoSelect} />
                    </label>

                    {photoPreview && (
                      <button 
                        type="button"
                        onClick={handlePhotoDelete}
                        className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-lg shadow-lg flex items-center justify-center hover:bg-red-600 transition-all hover:scale-110"
                      >
                        <FaTimesCircle size={14} />
                      </button>
                    )}
                  </div>
                  
                  {photoValidation.message && (
                    <p className={`mt-3 text-xs font-medium px-3 py-1 rounded-full ${
                      photoValidation.status === 'error' ? 'bg-red-50 text-red-600' : 
                      photoValidation.status === 'success' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {photoValidation.message}
                    </p>
                  )}
                  
                  <p className="mt-4 text-xs text-gray-400 text-center max-w-[200px]">
                    Upload a clear photo. Our AI will verify it for quality and safety.
                  </p>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Occupation</label>
                      <input
                        type="text"
                        name="occupation"
                        value={formData.occupation}
                        onChange={handleChange}
                        className="block w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-gray-700 placeholder-gray-400 shadow-sm"
                        placeholder="e.g. Software Engineer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Education</label>
                      <input
                        type="text"
                        name="education"
                        value={formData.education}
                        onChange={handleChange}
                        className="block w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-gray-700 placeholder-gray-400 shadow-sm"
                        placeholder="e.g. University of Prague"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Height</label>
                      <input
                        type="number"
                        name="height_value"
                        value={formData.height_value}
                        onChange={handleChange}
                        className={`block w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-gray-700 placeholder-gray-400 shadow-sm ${fieldErrors.height_value ? 'ring-2 ring-red-500' : ''}`}
                        placeholder={formData.height_unit === 'cm' ? 'cm' : 'inches'}
                      />
                      {fieldErrors.height_value && <p className="mt-1 text-[10px] text-red-500 font-bold ml-1">{fieldErrors.height_value}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Unit</label>
                      <select
                        name="height_unit"
                        value={formData.height_unit}
                        onChange={handleChange}
                        className="block w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-gray-700 shadow-sm appearance-none"
                      >
                        <option value="cm">cm</option>
                        <option value="feet_inches">inches</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Bio</label>
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}
                      rows="4"
                      className="block w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-gray-700 placeholder-gray-400 shadow-sm"
                      placeholder="Tell us about your pet's personality..."
                    />
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Location</label>
                    <div className="shadow-sm rounded-2xl overflow-hidden border-0">
                      <GooglePlacesAutocomplete 
                        apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                        selectProps={{ 
                          value: address, 
                          onChange: handleAddressSelect, 
                          classNamePrefix: "react-select",
                          placeholder: "Search for your city...",
                          styles: {
                            control: (base) => ({
                              ...base,
                              padding: '8px',
                              borderRadius: '16px',
                              border: 'none',
                              backgroundColor: '#f9fafb',
                              boxShadow: 'none',
                              '&:hover': {
                                backgroundColor: '#fff',
                                ring: '2px solid #f43f5e'
                              }
                            }),
                            input: (base) => ({
                              ...base,
                              color: '#374151'
                            }),
                            placeholder: (base) => ({
                              ...base,
                              color: '#9ca3af'
                            })
                          }
                        }} 
                      />
                    </div>
                  </div>
                  
                  <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100 shadow-sm">
                    <h4 className="text-sm font-black text-rose-600 mb-4 flex items-center gap-2 uppercase tracking-wider">
                      <FaCog /> Match Settings
                    </h4>
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-bold text-rose-500 uppercase tracking-widest">Max Distance</label>
                          <span className="text-sm font-black text-rose-600 bg-white px-3 py-1 rounded-full shadow-sm">{formData.max_distance} km</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="200" 
                          value={formData.max_distance} 
                          onChange={(e) => setFormData({...formData, max_distance: parseInt(e.target.value)})} 
                          className="w-full h-2 bg-rose-200 rounded-lg appearance-none cursor-pointer accent-rose-500" 
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-rose-500 uppercase tracking-widest block mb-2">Min Age</label>
                          <input 
                            type="number" 
                            value={formData.min_age} 
                            onChange={(e) => setFormData({...formData, min_age: parseInt(e.target.value)})}
                            className="w-full px-4 py-2 bg-white border-0 rounded-xl focus:ring-2 focus:ring-rose-500 text-gray-700 font-bold shadow-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-rose-500 uppercase tracking-widest block mb-2">Max Age</label>
                          <input 
                            type="number" 
                            value={formData.max_age} 
                            onChange={(e) => setFormData({...formData, max_age: parseInt(e.target.value)})}
                            className="w-full px-4 py-2 bg-white border-0 rounded-xl focus:ring-2 focus:ring-rose-500 text-gray-700 font-bold shadow-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-6">
                {step > 1 && (
                  <button type="button" onClick={() => setStep(step - 1)} className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                    <FaChevronLeft /> Back
                  </button>
                )}
                <button type="button" onClick={step === 4 ? handleSubmit : handleNext} disabled={loading || (step === 2 && photoValidation.status === 'loading')} className="flex-1 py-3 px-4 bg-rose-500 text-white rounded-xl text-sm font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? 'Saving...' : step === 4 ? 'Finish Profile' : <>{step === 2 && photoValidation.status === 'loading' ? 'Validating...' : 'Next'} <FaChevronRight /></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfilePage;
