import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { authService } from '../services/auth';
import { userService } from '../services/user';
import { validateImage } from '../utils/imageValidation';
import { FaChevronLeft, FaChevronRight, FaCamera, FaMapMarkerAlt, FaCog, FaPaw } from 'react-icons/fa';

const inputClass = 'block w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-gray-700 placeholder-gray-400 shadow-sm';
const labelClass = 'block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1';
const errorClass = 'mt-1 text-[10px] text-red-500 font-bold ml-1';

const STEP_TITLES = ['Create Account', 'About You', 'Lifestyle', 'Final Details'];

const SignUpPage = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    phone_country_code: '+420',
    phone_number: '',
    first_name: '',
    surname: '',
    date_of_birth: '',
    gender: 'other',
    height_value: '',
    height_unit: 'cm',
    education: '',
    occupation: '',
    relationship_goal: 'relationship',
    smoking: 'never',
    drinking: 'never',
    interests: '',
    bio: '',
    location_city: '',
    latitude: '',
    longitude: '',
    min_age: 18,
    max_age: 100,
    max_distance: 50,
    preferred_genders: ['female', 'male'],
  });
  const [submitStatus, setSubmitStatus] = useState('');
  const [profilePhotoFiles, setProfilePhotoFiles] = useState([]);
  const [photoValidations, setPhotoValidations] = useState({});
  const [photoError, setPhotoError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [address, setAddress] = useState(null);
  const navigate = useNavigate();

  const handleAddressSelect = (option) => {
    setAddress(option);
    if (option && window.google) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ placeId: option.value.place_id }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const lat = results[0].geometry.location.lat();
          const lng = results[0].geometry.location.lng();
          const cityComponent = results[0].address_components.find(c => c.types.includes('locality'));
          setFormData(prev => ({
            ...prev,
            location_city: cityComponent ? cityComponent.long_name : option.label,
            latitude: lat,
            longitude: lng,
          }));
        }
      });
    }
  };

  const validateField = (name, value, currentData) => {
    switch (name) {
      case 'username':
        if (value && !/^[a-zA-Z0-9_-]+$/.test(value)) return 'Username can only contain letters, numbers, underscores, and hyphens.';
        if (value && value.length < 3) return 'Username must be at least 3 characters.';
        break;
      case 'date_of_birth':
        if (value) {
          const today = new Date();
          const birthDate = new Date(value);
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
          if (age < 18) return 'You must be at least 18 years old to sign up.';
        }
        break;
      case 'password':
        if (value && value.length < 6) return 'Password must be at least 6 characters.';
        break;
      case 'confirmPassword':
        if (value && value !== currentData.password) return 'Passwords do not match.';
        break;
      case 'height_value':
        if (value) {
          const val = parseInt(value);
          if (currentData.height_unit === 'cm' && (val < 100 || val > 250)) return 'Height must be between 100 and 250 cm';
          if (currentData.height_unit === 'feet_inches' && (val < 36 || val > 96)) return 'Height must be between 36 and 96 inches';
        }
        break;
    }
    return null;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextData = { ...formData, [name]: value };
    setFormData(nextData);
    const error = validateField(name, value, nextData);
    setFieldErrors(prev => {
      const next = { ...prev, [name]: error };
      if (name === 'password' && nextData.confirmPassword)
        next.confirmPassword = validateField('confirmPassword', nextData.confirmPassword, nextData);
      if (name === 'height_unit' && nextData.height_value)
        next.height_value = validateField('height_value', nextData.height_value, nextData);
      return next;
    });
  };

  const nextStep = (e) => {
    e.preventDefault();
    const stepErrors = {};
    let hasError = false;
    const check = (field) => {
      const err = validateField(field, formData[field], formData);
      if (err) { stepErrors[field] = err; hasError = true; }
    };
    if (step === 1) ['username', 'password', 'confirmPassword'].forEach(check);
    if (step === 2) check('date_of_birth');
    if (step === 3) check('height_value');
    if (hasError) { setFieldErrors(prev => ({ ...prev, ...stepErrors })); return; }
    setStep(step + 1);
  };

  const prevStep = (e) => { e.preventDefault(); setStep(step - 1); };

  const useCurrentLocation = () => {
    if (!window.isSecureContext) { alert('Location requires HTTPS. Please enter manually.'); return; }
    if (!navigator.geolocation) { alert('Geolocation not supported.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setFormData(prev => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude })),
      () => alert('Could not get location. Please enter manually.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleFileSelect = async (files) => {
    if (files.length === 0) return;
    if (profilePhotoFiles.length + files.length > 10) { setPhotoError('Maximum 10 photos allowed.'); return; }
    setPhotoError('');
    const uniqueFiles = files.filter(f => !profilePhotoFiles.some(e => e.name === f.name && e.size === f.size));
    setProfilePhotoFiles(prev => [...prev, ...uniqueFiles]);
    for (const file of uniqueFiles) {
      setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'loading', message: 'Validating...' } }));
      const clientValid = await validateImage(file);
      if (!clientValid.ok) { setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'error', message: clientValid.message } })); continue; }
      try {
        const result = await userService.validatePhoto(file);
        if (result.quarantine) {
          const reason = result.rejection_reason || (result.has_human_face ? 'Human face detected. Please upload a pet photo.' : !result.is_animal ? 'No animal detected. Please upload a pet photo.' : 'This photo cannot be used.');
          setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'error', message: reason } }));
        } else if (!result.is_safe) {
          setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'error', message: result.unsafe_reason || 'Unsafe content detected.' } }));
        } else if (!result.is_animal && !result.has_human_face) {
          setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'error', message: 'No animal detected. Please upload a clear pet photo.' } }));
        } else {
          setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'success', message: 'Valid' } }));
        }
      } catch (err) {
        setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'error', message: 'Validation failed' } }));
      }
    }
  };

  const removePhoto = (index) => {
    const newFiles = [...profilePhotoFiles];
    const removed = newFiles.splice(index, 1)[0];
    setProfilePhotoFiles(newFiles);
    setPhotoValidations(prev => { const next = { ...prev }; delete next[removed.name]; return next; });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (formData.password !== formData.confirmPassword) { setErrorMessage('Passwords do not match'); return; }
    if (!formData.phone_number) { setErrorMessage('Phone number is required'); return; }
    const sanitizedLocal = (formData.phone_number || '').replace(/[^0-9]/g, '');
    if (sanitizedLocal.length < 6) { setErrorMessage('Please enter at least 6 digits for the local number'); return; }
    const phoneE164 = `${formData.phone_country_code}${sanitizedLocal}`;
    const hasInvalidPhotos = profilePhotoFiles.some(f => photoValidations[f.name]?.status === 'error');
    if (hasInvalidPhotos) { setPhotoError('One or more photos are invalid. Please remove them.'); return; }
    const validPhotos = profilePhotoFiles.filter(f => photoValidations[f.name]?.status === 'success');
    if (validPhotos.length === 0) { setPhotoError('Please upload at least one valid profile picture'); return; }
    if (profilePhotoFiles.some(f => photoValidations[f.name]?.status === 'loading')) { setPhotoError('Please wait for photo validation to complete'); return; }

    setSubmitStatus('Creating account...');
    try {
      await authService.register(formData.email, formData.password, phoneE164, formData.username || undefined);
      setSubmitStatus('Logging in...');
      const loginData = await authService.login(formData.email, formData.password);
      localStorage.setItem('token', loginData.access_token);
      if (validPhotos.length > 0) await userService.uploadPhotos(validPhotos);
      let finalBio = formData.bio;
      if (formData.interests) finalBio += `\n\nInterests: ${formData.interests}`;
      await userService.updateProfile({
        first_name: formData.first_name, surname: formData.surname || null,
        date_of_birth: formData.date_of_birth, gender: formData.gender,
        bio: finalBio, location_city: formData.location_city,
        height_value: formData.height_value ? parseInt(formData.height_value) : null,
        height_unit: formData.height_unit, education: formData.education,
        occupation: formData.occupation, relationship_goal: formData.relationship_goal,
        smoking: formData.smoking, drinking: formData.drinking,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      });
      await userService.updatePreferences({ min_age: formData.min_age, max_age: formData.max_age, max_distance: formData.max_distance, preferred_genders: formData.preferred_genders });
      navigate('/matching');
    } catch (error) {
      const msg = error.message || '';
      if (msg.includes('already exists')) { setErrorMessage('This email is already registered. Please log in instead.'); navigate('/login'); }
      else setErrorMessage(msg || 'Registration failed. Please try again.');
    } finally {
      setSubmitStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-rose-100 py-10 px-4">
      <div className="max-w-lg mx-auto">

        {/* Stepper */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-all ${step >= s ? 'bg-rose-500 text-white' : 'bg-white text-gray-400'}`}>
                {s}
              </div>
            ))}
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-rose-500 to-orange-400 transition-all duration-500" style={{ width: `${((step - 1) / 3) * 100}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Card header */}
          <div className="bg-gradient-to-r from-rose-500 to-orange-400 px-8 py-8 text-white text-center">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FaPaw className="text-2xl text-white" />
            </div>
            <h2 className="text-2xl font-extrabold">{STEP_TITLES[step - 1]}</h2>
            <p className="mt-1 text-rose-100 text-sm">Step {step} of 4</p>
          </div>

          <div className="px-8 py-8">
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">{errorMessage}</div>
            )}
            {successMessage && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm font-medium">{successMessage}</div>
            )}

            <form onSubmit={step === 4 ? handleSubmit : nextStep} className="space-y-4">

              {/* Step 1: Account */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="you@example.com" required />
                  </div>
                  <div>
                    <label className={labelClass}>Username</label>
                    <input type="text" name="username" value={formData.username} onChange={handleChange} className={`${inputClass} ${fieldErrors.username ? 'ring-2 ring-red-500' : ''}`} placeholder="yourname" required />
                    {fieldErrors.username && <p className={errorClass}>{fieldErrors.username}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <div className="flex gap-2">
                      <select name="phone_country_code" value={formData.phone_country_code} onChange={handleChange} className="w-28 px-3 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500 transition-all text-gray-700 text-sm">
                        <option value="+420">🇨🇿 +420</option>
                        <option value="+421">🇸🇰 +421</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+44">🇬🇧 +44</option>
                        <option value="+49">🇩🇪 +49</option>
                        <option value="+33">🇫🇷 +33</option>
                        <option value="+91">🇮🇳 +91</option>
                        <option value="+61">🇦🇺 +61</option>
                        <option value="+81">🇯🇵 +81</option>
                        <option value="+86">🇨🇳 +86</option>
                      </select>
                      <input type="tel" name="phone_number" value={formData.phone_number} onChange={handleChange} className={`flex-1 ${inputClass}`} placeholder="777 123 456" required pattern="^[0-9\- ]{6,}$" />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 ml-1">Select country, then enter local number.</p>
                  </div>
                  <div>
                    <label className={labelClass}>Password</label>
                    <input type="password" name="password" value={formData.password} onChange={handleChange} className={`${inputClass} ${fieldErrors.password ? 'ring-2 ring-red-500' : ''}`} placeholder="Min 6 characters" required />
                    {fieldErrors.password && <p className={errorClass}>{fieldErrors.password}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Confirm Password</label>
                    <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className={`${inputClass} ${fieldErrors.confirmPassword ? 'ring-2 ring-red-500' : ''}`} placeholder="Repeat password" required />
                    {fieldErrors.confirmPassword && <p className={errorClass}>{fieldErrors.confirmPassword}</p>}
                  </div>
                </div>
              )}

              {/* Step 2: About You */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>First Name</label>
                      <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className={inputClass} placeholder="First name" required />
                    </div>
                    <div>
                      <label className={labelClass}>Last Name</label>
                      <input type="text" name="surname" value={formData.surname} onChange={handleChange} className={inputClass} placeholder="Optional" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Date of Birth</label>
                      <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} className={`${inputClass} ${fieldErrors.date_of_birth ? 'ring-2 ring-red-500' : ''}`} required />
                      {fieldErrors.date_of_birth && <p className={errorClass}>{fieldErrors.date_of_birth}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>Gender</label>
                      <select name="gender" value={formData.gender} onChange={handleChange} className={inputClass}>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="non_binary">Non-binary</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Lifestyle */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Height</label>
                      <input type="number" name="height_value" value={formData.height_value} onChange={handleChange} className={`${inputClass} ${fieldErrors.height_value ? 'ring-2 ring-red-500' : ''}`} placeholder={formData.height_unit === 'cm' ? 'cm' : 'inches'} />
                      {fieldErrors.height_value && <p className={errorClass}>{fieldErrors.height_value}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>Unit</label>
                      <select name="height_unit" value={formData.height_unit} onChange={handleChange} className={inputClass}>
                        <option value="cm">cm</option>
                        <option value="feet_inches">inches</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Education</label>
                      <input type="text" name="education" value={formData.education} onChange={handleChange} className={inputClass} placeholder="e.g. University" />
                    </div>
                    <div>
                      <label className={labelClass}>Occupation</label>
                      <input type="text" name="occupation" value={formData.occupation} onChange={handleChange} className={inputClass} placeholder="e.g. Developer" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Relationship Goal</label>
                    <select name="relationship_goal" value={formData.relationship_goal} onChange={handleChange} className={inputClass}>
                      <option value="relationship">Relationship</option>
                      <option value="casual">Casual</option>
                      <option value="friendship">Friendship</option>
                      <option value="undecided">Undecided</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Smoking</label>
                      <select name="smoking" value={formData.smoking} onChange={handleChange} className={inputClass}>
                        <option value="never">Never</option>
                        <option value="occasionally">Occasionally</option>
                        <option value="regularly">Regularly</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Drinking</label>
                      <select name="drinking" value={formData.drinking} onChange={handleChange} className={inputClass}>
                        <option value="never">Never</option>
                        <option value="occasionally">Occasionally</option>
                        <option value="regularly">Regularly</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Interests</label>
                    <input type="text" name="interests" value={formData.interests || ''} onChange={handleChange} className={inputClass} placeholder="e.g. Hiking, Photography, Cooking" />
                  </div>
                </div>
              )}

              {/* Step 4: Final Details */}
              {step === 4 && (
                <div className="space-y-5">
                  {/* Location */}
                  <div>
                    <label className={labelClass}>Location</label>
                    <div className="rounded-2xl overflow-hidden shadow-sm">
                      <GooglePlacesAutocomplete
                        apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                        selectProps={{
                          value: address,
                          onChange: handleAddressSelect,
                          placeholder: 'Search for your city...',
                          styles: {
                            control: (base) => ({ ...base, padding: '6px', borderRadius: '16px', border: 'none', backgroundColor: '#f9fafb', boxShadow: 'none' }),
                            input: (base) => ({ ...base, color: '#374151' }),
                            placeholder: (base) => ({ ...base, color: '#9ca3af' }),
                            option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#fff1f2' : 'white', color: '#374151' }),
                          },
                        }}
                      />
                    </div>
                    <button type="button" onClick={useCurrentLocation} className="mt-2 flex items-center gap-1 text-xs text-rose-500 font-bold hover:text-rose-600 ml-1">
                      <FaMapMarkerAlt /> Use my current location
                    </button>
                  </div>

                  {/* Photos */}
                  <div>
                    <label className={labelClass}>Profile Pictures (max 10)</label>
                    <div
                      className="border-2 border-dashed border-rose-200 rounded-2xl p-6 text-center hover:border-rose-400 transition-colors cursor-pointer bg-gray-50"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); handleFileSelect(Array.from(e.dataTransfer.files)); }}
                      onClick={() => document.getElementById('file-upload').click()}
                    >
                      <input id="file-upload" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => handleFileSelect(Array.from(e.target.files || []))} className="hidden" />
                      <FaCamera className="text-2xl text-rose-300 mx-auto mb-2" />
                      <p className="text-sm font-bold text-gray-500">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-400 mt-1">Animal photos only (JPG, PNG, WebP)</p>
                    </div>
                    {photoError && <p className={errorClass}>{photoError}</p>}
                    {profilePhotoFiles.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        {profilePhotoFiles.map((file, idx) => (
                          <div key={idx} className="relative rounded-xl overflow-hidden bg-gray-100 aspect-square group">
                            <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-2 py-1 text-[10px] font-bold">
                              {photoValidations[file.name]?.status === 'loading' && <span className="text-yellow-300">Validating...</span>}
                              {photoValidations[file.name]?.status === 'success' && <span className="text-green-300">Valid</span>}
                              {photoValidations[file.name]?.status === 'error' && <span className="text-red-300">Invalid</span>}
                            </div>
                            <button type="button" onClick={(e) => { e.stopPropagation(); removePhoto(idx); }} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all text-xs">
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Match Preferences */}
                  <div className="p-5 bg-rose-50 rounded-2xl border border-rose-100">
                    <h4 className="text-xs font-black text-rose-600 mb-4 flex items-center gap-2 uppercase tracking-wider">
                      <FaCog /> Match Preferences
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-bold text-rose-500 uppercase tracking-widest">Max Distance</label>
                          <span className="text-sm font-black text-rose-600 bg-white px-3 py-1 rounded-full shadow-sm">{formData.max_distance} km</span>
                        </div>
                        <input type="range" min="1" max="200" value={formData.max_distance} onChange={(e) => setFormData(prev => ({ ...prev, max_distance: parseInt(e.target.value) }))} className="w-full h-2 bg-rose-200 rounded-lg appearance-none cursor-pointer accent-rose-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-rose-500 uppercase tracking-widest block mb-2">Min Age</label>
                          <input type="number" min={18} value={formData.min_age} onChange={(e) => setFormData(prev => ({ ...prev, min_age: parseInt(e.target.value) }))} className="w-full px-4 py-2 bg-white border-0 rounded-xl focus:ring-2 focus:ring-rose-500 text-gray-700 font-bold shadow-sm" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-rose-500 uppercase tracking-widest block mb-2">Max Age</label>
                          <input type="number" max={100} value={formData.max_age} onChange={(e) => setFormData(prev => ({ ...prev, max_age: parseInt(e.target.value) }))} className="w-full px-4 py-2 bg-white border-0 rounded-xl focus:ring-2 focus:ring-rose-500 text-gray-700 font-bold shadow-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-rose-500 uppercase tracking-widest block mb-2">Preferred Genders</label>
                        <div className="flex flex-wrap gap-3">
                          {['male', 'female', 'non_binary', 'other'].map(g => (
                            <label key={g} className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                              <input type="checkbox" checked={formData.preferred_genders.includes(g)} onChange={(e) => {
                                let next = [...formData.preferred_genders];
                                if (e.target.checked) { if (!next.includes(g)) next.push(g); } else { next = next.filter(x => x !== g); }
                                setFormData(prev => ({ ...prev, preferred_genders: next }));
                              }} className="accent-rose-500 w-4 h-4" />
                              <span className="capitalize font-medium">{g.replace('_', ' ')}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  <div>
                    <label className={labelClass}>Bio</label>
                    <textarea name="bio" value={formData.bio} onChange={handleChange} rows="3" className={inputClass} placeholder="Tell us about yourself..." />
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex gap-3 pt-4">
                {step > 1 && (
                  <button type="button" onClick={prevStep} className="flex-1 py-3 px-4 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                    <FaChevronLeft /> Back
                  </button>
                )}
                <button type="submit" disabled={!!submitStatus} className="flex-1 py-3 px-4 bg-gradient-to-r from-rose-500 to-orange-400 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitStatus || (step === 4 ? 'Complete Sign Up' : <><span>Next</span> <FaChevronRight /></>)}
                </button>
              </div>
            </form>

            <p className="mt-5 text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-rose-500 hover:text-rose-600">Log in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
