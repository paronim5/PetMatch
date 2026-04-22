import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/useNotification';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { pageBgStyle } from '../components/PageBackground';
import { api } from '../services/api';
import { userService } from '../services/user';
import { validateImage } from '../utils/imageValidation';
import { FaShieldAlt, FaCheckCircle, FaTimesCircle, FaMapMarkerAlt, FaUser, FaCamera, FaHeart, FaCog, FaChevronLeft, FaChevronRight, FaSpinner, FaLock, FaPaw } from 'react-icons/fa';

const inputClass = 'block w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all text-sm';
const labelClass = 'block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5';
const errorClass = 'mt-1 text-[10px] text-red-400 font-bold';

const CompleteProfilePage = () => {
  const { addToast } = useNotification();
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
    preferred_genders: ['female', 'male', 'non_binary', 'other'],
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

  const steps = [
    { icon: FaUser, label: 'Basic Info' },
    { icon: FaCamera, label: 'Photo' },
    { icon: FaCog, label: 'Details' },
    { icon: FaHeart, label: 'Preferences' },
  ];

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

    setTimeout(async () => {
      const clientValid = await validateImage(file);
      if (!clientValid.ok) {
        setPhotoValidation({ status: 'error', message: clientValid.message });
        return;
      }
      const validFormats = ['image/jpeg', 'image/png'];
      if (!validFormats.includes(file.type)) {
        setPhotoValidation({ status: 'error', message: 'Only JPEG and PNG formats are allowed.' });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setPhotoValidation({ status: 'error', message: 'File size must be less than 10MB.' });
        return;
      }
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
    if (option) {
      setFormData(prev => ({ ...prev, location_city: option.value.city || option.label, latitude: option.value.lat, longitude: option.value.lon }));
    }
  };

  const handlePhotoDelete = async () => {
    if (profilePhotoFile) {
      setProfilePhotoFile(null);
      setPhotoValidation({ status: 'idle', message: '' });
      if (existingPhotos.length > 0) {
        const primary = existingPhotos.find(p => p.is_primary) || existingPhotos[0];
        setPhotoPreview(primary.photo_url.startsWith('http') ? primary.photo_url : `${import.meta.env.VITE_API_URL}/static/uploads/${primary.photo_url}`);
        setPhotoValidation({ status: 'success', message: 'Current profile photo' });
      } else {
        setPhotoPreview(null);
      }
      return;
    }
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
        addToast('Failed to remove photo. Please try again.', 'error');
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
    if (validateStep(step)) setStep(step + 1);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validateStep(step)) return;
    setLoading(true);
    setSubmitStatus('Saving profile...');
    try {
      if (profilePhotoFile && photoValidation.status === 'success') {
        try {
          await userService.uploadPhoto(profilePhotoFile);
        } catch (uploadErr) {
          if (!uploadErr.message?.toLowerCase().includes('duplicate')) throw uploadErr;
        }
      }
      const sanitizedLocal = formData.phone_number.replace(/[^0-9]/g, '');
      const phoneE164 = `${formData.phone_country_code}${sanitizedLocal}`;
      await userService.updateProfile({ ...formData, phone_number: phoneE164 });
      await userService.updatePreferences({ min_age: formData.min_age, max_age: formData.max_age, max_distance: formData.max_distance, preferred_genders: formData.preferred_genders });
      if (formData.password) {
        if (formData.password !== formData.confirmPassword) throw new Error('Passwords do not match');
        await userService.updateProfile({ password: formData.password });
      }
      setSubmitStatus('Profile complete!');
      addToast('Profile saved successfully!', 'success');
      setTimeout(() => navigate('/matching'), 1500);
    } catch (error) {
      setSubmitStatus('');
      addToast(error.message || 'Failed to save profile. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const genderOptions = [
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male' },
    { value: 'non_binary', label: 'Non-binary' },
    { value: 'other', label: 'Other' },
  ];

  const toggleGender = (value) => {
    setFormData(prev => ({
      ...prev,
      preferred_genders: prev.preferred_genders.includes(value)
        ? prev.preferred_genders.filter(g => g !== value)
        : [...prev.preferred_genders, value]
    }));
  };

  return (
    <div className="min-h-screen py-10 px-4" style={pageBgStyle}>
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-lg mx-auto relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-violet-600 rounded-2xl mb-3 shadow-lg shadow-violet-600/30">
            <FaPaw className="text-xl text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Complete Your Profile</h1>
          <p className="text-gray-400 text-sm mt-1">Step {step} of {steps.length}</p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 px-1">
            {steps.map(({ icon: Icon, label }, i) => {
              const s = i + 1;
              const active = step === s;
              const done = step > s;
              return (
                <div key={s} className="flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    done ? 'bg-violet-600 text-white' :
                    active ? 'bg-violet-600 text-white ring-4 ring-violet-600/20' :
                    'bg-gray-800 text-gray-500'
                  }`}>
                    <Icon size={14} />
                  </div>
                  <span className={`text-[9px] font-semibold uppercase tracking-wider ${active || done ? 'text-violet-400' : 'text-gray-600'}`}>{label}</span>
                </div>
              );
            })}
          </div>
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-violet-600 transition-all duration-500" style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }} />
          </div>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Step 1: Basic Info */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>First Name *</label>
                      <input type="text" name="first_name" value={formData.first_name} onChange={handleChange}
                        className={`${inputClass} ${fieldErrors.first_name ? 'border-red-500' : ''}`}
                        placeholder="Your first name" />
                      {fieldErrors.first_name && <p className={errorClass}>{fieldErrors.first_name}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>Surname</label>
                      <input type="text" name="surname" value={formData.surname} onChange={handleChange}
                        className={inputClass} placeholder="Optional" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Date of Birth *</label>
                      <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange}
                        className={`${inputClass} ${fieldErrors.date_of_birth ? 'border-red-500' : ''}`} />
                      {fieldErrors.date_of_birth && <p className={errorClass}>{fieldErrors.date_of_birth}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>Gender *</label>
                      <select name="gender" value={formData.gender} onChange={handleChange}
                        className={`${inputClass} ${fieldErrors.gender ? 'border-red-500' : ''}`}>
                        <option value="" className="bg-gray-800">Select...</option>
                        <option value="male" className="bg-gray-800">Male</option>
                        <option value="female" className="bg-gray-800">Female</option>
                        <option value="non_binary" className="bg-gray-800">Non-binary</option>
                        <option value="other" className="bg-gray-800">Other</option>
                      </select>
                      {fieldErrors.gender && <p className={errorClass}>{fieldErrors.gender}</p>}
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Phone Number *</label>
                    <div className="flex gap-2">
                      <select name="phone_country_code" value={formData.phone_country_code} onChange={handleChange}
                        className="w-28 px-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500 transition-all">
                        <option value="+420" className="bg-gray-800">🇨🇿 +420</option>
                        <option value="+421" className="bg-gray-800">🇸🇰 +421</option>
                        <option value="+1" className="bg-gray-800">🇺🇸 +1</option>
                        <option value="+44" className="bg-gray-800">🇬🇧 +44</option>
                        <option value="+49" className="bg-gray-800">🇩🇪 +49</option>
                      </select>
                      <input type="tel" name="phone_number" value={formData.phone_number} onChange={handleChange}
                        className={`${inputClass} ${fieldErrors.phone_number ? 'border-red-500' : ''}`}
                        placeholder="777 123 456" />
                    </div>
                    {fieldErrors.phone_number && <p className={errorClass}>{fieldErrors.phone_number}</p>}
                  </div>

                  <div className="pt-4 border-t border-gray-800">
                    <h4 className="text-xs font-bold text-gray-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                      <FaLock className="text-violet-400" size={11} /> Account Security (Optional)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>New Password</label>
                        <input type="password" name="password" value={formData.password} onChange={handleChange}
                          className={inputClass} placeholder="Set a password" />
                      </div>
                      <div>
                        <label className={labelClass}>Confirm Password</label>
                        <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
                          className={inputClass} placeholder="Repeat password" />
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-gray-500">Set a password to log in with your email later.</p>
                  </div>
                </div>
              )}

              {/* Step 2: Photo */}
              {step === 2 && (
                <div className="flex flex-col items-center space-y-5 py-2">
                  {fieldErrors.photo && (
                    <div className="w-full p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center">
                      {fieldErrors.photo}
                    </div>
                  )}

                  <div className="relative w-44 h-44">
                    <div className={`w-full h-full rounded-2xl overflow-hidden border-2 border-dashed transition-all flex items-center justify-center bg-gray-800 ${
                      photoValidation.status === 'error' ? 'border-red-500/50' :
                      photoValidation.status === 'success' ? 'border-green-500/50' :
                      'border-gray-700'
                    }`}>
                      {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <FaCamera className="text-4xl text-gray-600" />
                      )}
                      {photoValidation.status === 'loading' && (
                        <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center gap-2">
                          <div className="w-6 h-6 border-2 border-violet-600/30 border-t-violet-600 rounded-full animate-spin" />
                          <span className="text-xs text-gray-400">Validating...</span>
                        </div>
                      )}
                    </div>

                    <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-lg flex items-center justify-center cursor-pointer transition-all hover:scale-110">
                      <FaCamera size={16} />
                      <input type="file" className="hidden" accept="image/jpeg,image/png" onChange={handlePhotoSelect} />
                    </label>

                    {photoPreview && (
                      <button type="button" onClick={handlePhotoDelete}
                        className="absolute -top-2 -right-2 w-8 h-8 bg-red-600 hover:bg-red-500 text-white rounded-lg shadow-lg flex items-center justify-center transition-all hover:scale-110">
                        <FaTimesCircle size={13} />
                      </button>
                    )}
                  </div>

                  {photoValidation.message && (
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold ${
                      photoValidation.status === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                      photoValidation.status === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {photoValidation.status === 'success' && <FaCheckCircle size={12} />}
                      {photoValidation.status === 'error' && <FaTimesCircle size={12} />}
                      {photoValidation.message}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 text-center max-w-[220px]">
                    Upload a clear photo of your pet. Our AI will verify it for quality and safety.
                  </p>
                </div>
              )}

              {/* Step 3: Details */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Occupation</label>
                      <input type="text" name="occupation" value={formData.occupation} onChange={handleChange}
                        className={inputClass} placeholder="e.g. Software Engineer" />
                    </div>
                    <div>
                      <label className={labelClass}>Education</label>
                      <input type="text" name="education" value={formData.education} onChange={handleChange}
                        className={inputClass} placeholder="e.g. University" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Height</label>
                      <input type="number" name="height_value" value={formData.height_value} onChange={handleChange}
                        className={`${inputClass} ${fieldErrors.height_value ? 'border-red-500' : ''}`}
                        placeholder={formData.height_unit === 'cm' ? 'cm' : 'inches'} />
                      {fieldErrors.height_value && <p className={errorClass}>{fieldErrors.height_value}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>Unit</label>
                      <select name="height_unit" value={formData.height_unit} onChange={handleChange} className={inputClass}>
                        <option value="cm" className="bg-gray-800">cm</option>
                        <option value="feet_inches" className="bg-gray-800">inches</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Bio</label>
                    <textarea name="bio" value={formData.bio} onChange={handleChange} rows="4"
                      className={inputClass} placeholder="Tell us about your pet's personality..." />
                  </div>
                </div>
              )}

              {/* Step 4: Preferences */}
              {step === 4 && (
                <div className="space-y-5">
                  <div>
                    <label className={labelClass}>Location</label>
                    <LocationAutocomplete
                      selectProps={{
                        value: address,
                        onChange: handleAddressSelect,
                        placeholder: "Search for your city...",
                      }}
                    />
                  </div>

                  <div className="p-5 bg-violet-500/5 border border-violet-500/20 rounded-2xl space-y-5">
                    <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2">
                      <FaCog size={12} /> Match Settings
                    </h4>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className={labelClass}>Max Distance</label>
                        <span className="text-xs font-bold text-white bg-gray-800 px-3 py-1 rounded-lg">{formData.max_distance} km</span>
                      </div>
                      <input type="range" min="1" max="200" value={formData.max_distance}
                        onChange={(e) => setFormData({ ...formData, max_distance: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-violet-500" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Min Age</label>
                        <input type="number" value={formData.min_age}
                          onChange={(e) => setFormData({ ...formData, min_age: parseInt(e.target.value) })}
                          className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Max Age</label>
                        <input type="number" value={formData.max_age}
                          onChange={(e) => setFormData({ ...formData, max_age: parseInt(e.target.value) })}
                          className={inputClass} />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Show Me</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {genderOptions.map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => toggleGender(value)}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                              formData.preferred_genders.includes(value)
                                ? 'bg-violet-600 text-white'
                                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3 pt-2">
                {step > 1 && (
                  <button type="button" onClick={() => setStep(step - 1)}
                    className="flex-1 py-3 px-4 border border-gray-700 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-bold text-gray-300 transition-all flex items-center justify-center gap-2">
                    <FaChevronLeft size={12} /> Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={step === 4 ? handleSubmit : handleNext}
                  disabled={loading || (step === 2 && photoValidation.status === 'loading')}
                  className="flex-1 py-3 px-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                  ) : step === 4 ? 'Finish Profile' : (
                    <>{step === 2 && photoValidation.status === 'loading' ? 'Validating...' : 'Next'} <FaChevronRight size={12} /></>
                  )}
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
