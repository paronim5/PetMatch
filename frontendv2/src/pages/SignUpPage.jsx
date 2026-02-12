import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { authService } from '../services/auth';
import { userService } from '../services/user';
import { validateImage } from '../utils/imageValidation';
import { FaUser, FaEnvelope, FaLock, FaPhone, FaCalendarAlt, FaVenusMars, FaMapMarkerAlt, FaBriefcase, FaGraduationCap, FaCamera, FaChevronRight, FaChevronLeft } from 'react-icons/fa';

const SignUpPage = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1: Account
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    phone_country_code: '+420',
    phone_number: '',
    // Step 2: Basic Profile
    first_name: '',
    surname: '',
    date_of_birth: '',
    gender: 'other',
    // Step 3: Lifestyle & Work
    height_value: '',
    height_unit: 'cm',
    education: '',
    occupation: '',
    relationship_goal: 'relationship',
    smoking: 'never',
    drinking: 'never',
    interests: '',
    // Step 4: Final Details
    bio: '',
    location_city: '',
    latitude: '',
    longitude: '',
    // Preferences
    min_age: 18,
    max_age: 100,
    max_distance: 50,
    preferred_genders: ['female', 'male']
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
        }
      });
    }
  };

  const validateField = (name, value, currentData) => {
    let error = null;
    switch (name) {
      case 'username':
        if (value && !/^[a-zA-Z0-9_-]+$/.test(value)) {
          error = 'Only letters, numbers, underscores, and hyphens.';
        } else if (value && value.length < 3) {
          error = 'Min 3 characters.';
        }
        break;
      case 'height_value':
      case 'height_unit': {
        const val = name === 'height_value' ? parseFloat(value) : parseFloat(currentData.height_value);
        const unit = name === 'height_unit' ? value : currentData.height_unit;
        if (!isNaN(val)) {
          if (unit === 'cm') {
            if (val < 100 || val > 250) error = 'Height must be between 100 and 250 cm.';
          } else {
            if (val < 36 || val > 96) error = 'Height must be between 36 and 96 inches.';
          }
        }
        break;
      }
      case 'date_of_birth':
        if (value) {
          const today = new Date();
          const birthDate = new Date(value);
          let age = today.getFullYear() - birthDate.getFullYear();
          if (age < 18) error = 'Must be at least 18 years old.';
        }
        break;
      case 'password':
        if (value && value.length < 6) error = 'Min 6 characters.';
        break;
      case 'confirmPassword':
        if (value && value !== currentData.password) error = 'Passwords do not match.';
        break;
    }
    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextFormData = { ...formData, [name]: value };
    setFormData(nextFormData);
    const error = validateField(name, value, nextFormData);
    setFieldErrors(prev => ({ ...prev, [name]: error }));
  };

  const nextStep = (e) => {
    e.preventDefault();
    const currentStepErrors = {};
    let hasError = false;

    if (step === 1) {
      ['email', 'username', 'password', 'confirmPassword', 'phone_number'].forEach(field => {
        if (!formData[field]) {
          currentStepErrors[field] = 'Required';
          hasError = true;
        }
        const error = validateField(field, formData[field], formData);
        if (error) {
          currentStepErrors[field] = error;
          hasError = true;
        }
      });
    }

    if (hasError) {
      setFieldErrors(prev => ({ ...prev, ...currentStepErrors }));
      return;
    }
    setStep(step + 1);
  };

  const handleFileSelect = async (files) => {
    if (files.length === 0) return;
    const uniqueFiles = files.filter(file => 
        !profilePhotoFiles.some(existing => existing.name === file.name && existing.size === file.size)
    );
    const newFiles = [...profilePhotoFiles, ...uniqueFiles];
    setProfilePhotoFiles(newFiles);
    
    for (const file of uniqueFiles) {
        setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'loading', message: 'Validating...' } }));
        const clientValid = await validateImage(file);
        if (!clientValid.ok) {
            setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'error', message: clientValid.message } }));
            continue;
        }
        try {
            const result = await userService.validatePhoto(file);
            if (result.quarantine || !result.is_safe || (!result.is_animal && !result.has_human_face)) {
                setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'error', message: 'Invalid image content' } }));
            } else {
                setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'success', message: 'Valid' } }));
            }
        } catch (err) {
            setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'error', message: 'Validation failed' } }));
        }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus('Creating account...');
    try {
      const sanitizedLocal = (formData.phone_number || '').replace(/[^0-9]/g, '');
      const phoneE164 = `${formData.phone_country_code}${sanitizedLocal}`;
      await authService.register(formData.email, formData.password, phoneE164, formData.username);
      const loginData = await authService.login(formData.email, formData.password);
      localStorage.setItem('token', loginData.access_token);
      
      const validPhotos = profilePhotoFiles.filter(f => photoValidations[f.name]?.status === 'success');
      if (validPhotos.length > 0) await userService.uploadPhotos(validPhotos);
      
      await userService.updateProfile({
        first_name: formData.first_name,
        surname: formData.surname,
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        bio: formData.bio,
        location_city: formData.location_city,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null
      });
      navigate('/matching');
    } catch (error) {
      setErrorMessage(error.message || 'Registration failed');
    } finally {
      setSubmitStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-orange-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-rose-500 p-8 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-rose-400 rounded-full opacity-20 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-orange-400 rounded-full opacity-20 blur-3xl"></div>
            
            <h2 className="text-3xl font-black tracking-tight">Join PetMatch</h2>
            <p className="mt-2 text-rose-100 font-medium">Step {step} of 4</p>
            
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4 px-2">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    step >= s ? 'bg-white text-rose-500 shadow-lg' : 'bg-rose-400 text-rose-100'
                  }`}>
                    {s}
                  </div>
                ))}
              </div>
              <div className="h-1.5 bg-rose-400/30 rounded-full overflow-hidden mx-2">
                <div 
                  className="h-full bg-white transition-all duration-500 ease-out" 
                  style={{ width: `${((step - 1) / 3) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="p-8">
            <form onSubmit={step === 4 ? handleSubmit : nextStep} className="space-y-6">
              {errorMessage && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{errorMessage}</div>}

              {step === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <div className="relative">
                        <FaEnvelope className="absolute left-3 top-3 text-gray-400" />
                        <input type="email" name="email" value={formData.email} onChange={handleChange} required className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-rose-500 focus:border-rose-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                      <div className="relative">
                        <FaUser className="absolute left-3 top-3 text-gray-400" />
                        <input type="text" name="username" value={formData.username} onChange={handleChange} required className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-rose-500 focus:border-rose-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <div className="relative">
                        <FaLock className="absolute left-3 top-3 text-gray-400" />
                        <input type="password" name="password" value={formData.password} onChange={handleChange} required className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-rose-500 focus:border-rose-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                      <div className="relative">
                        <FaLock className="absolute left-3 top-3 text-gray-400" />
                        <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-rose-500 focus:border-rose-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <div className="flex gap-2">
                        <select name="phone_country_code" value={formData.phone_country_code} onChange={handleChange} className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-rose-500 focus:border-rose-500">
                          <option value="+420">+420</option>
                          <option value="+421">+421</option>
                        </select>
                        <div className="relative flex-1">
                          <FaPhone className="absolute left-3 top-3 text-gray-400" />
                          <input type="tel" name="phone_number" value={formData.phone_number} onChange={handleChange} required className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-rose-500 focus:border-rose-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                      <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} required className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-rose-500 focus:border-rose-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Surname</label>
                      <input type="text" name="surname" value={formData.surname} onChange={handleChange} className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-rose-500 focus:border-rose-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                    <div className="relative">
                      <FaCalendarAlt className="absolute left-3 top-3 text-gray-400" />
                      <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} required className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-rose-500 focus:border-rose-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <div className="flex gap-4">
                      {['male', 'female', 'other'].map(g => (
                        <label key={g} className={`flex-1 flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all ${
                          formData.gender === g ? 'border-rose-500 bg-rose-50 text-rose-600 font-bold' : 'border-gray-100 hover:border-rose-200 text-gray-500'
                        }`}>
                          <input type="radio" name="gender" value={g} checked={formData.gender === g} onChange={handleChange} className="hidden" />
                          {g.charAt(0).toUpperCase() + g.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          name="height_value" 
                          value={formData.height_value} 
                          onChange={handleChange} 
                          className={`block w-full px-3 py-2 border rounded-lg focus:ring-rose-500 ${fieldErrors.height_value ? 'border-red-500' : 'border-gray-300'}`} 
                          placeholder={formData.height_unit === 'cm' ? 'cm' : 'inches'} 
                        />
                        <select name="height_unit" value={formData.height_unit} onChange={handleChange} className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-rose-500 focus:border-rose-500">
                          <option value="cm">cm</option>
                          <option value="in">in</option>
                        </select>
                      </div>
                      {fieldErrors.height_value && <p className="mt-1 text-xs text-red-500">{fieldErrors.height_value}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
                      <div className="relative">
                        <FaBriefcase className="absolute left-3 top-3 text-gray-400" />
                        <input type="text" name="occupation" value={formData.occupation} onChange={handleChange} className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-rose-500 focus:border-rose-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Education</label>
                      <div className="relative">
                        <FaGraduationCap className="absolute left-3 top-3 text-gray-400" />
                        <input type="text" name="education" value={formData.education} onChange={handleChange} className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-rose-500 focus:border-rose-500" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Relationship Goal</label>
                    <select name="relationship_goal" value={formData.relationship_goal} onChange={handleChange} className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-rose-500 focus:border-rose-500">
                      <option value="relationship">Long-term Relationship</option>
                      <option value="friendship">Friendship</option>
                      <option value="casual">Casual Dating</option>
                    </select>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <GooglePlacesAutocomplete selectProps={{ value: address, onChange: handleAddressSelect, classNamePrefix: "react-select" }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Profile Bio</label>
                    <textarea name="bio" value={formData.bio} onChange={handleChange} rows="4" className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-rose-500 focus:border-rose-500" placeholder="Tell us about yourself and your pets..."></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pet Photos</label>
                    <div className="grid grid-cols-3 gap-2">
                      {profilePhotoFiles.map((file, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border">
                          <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                          <div className={`absolute inset-0 flex items-center justify-center bg-black/40 text-white text-[10px] text-center p-1`}>
                            {photoValidations[file.name]?.status === 'loading' ? 'Validating...' : photoValidations[file.name]?.message}
                          </div>
                        </div>
                      ))}
                      <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-rose-200 rounded-lg cursor-pointer hover:bg-rose-50 transition-all">
                        <FaCamera className="text-rose-400 mb-1" />
                        <span className="text-[10px] text-rose-500">Add Photo</span>
                        <input type="file" multiple className="hidden" onChange={(e) => handleFileSelect(Array.from(e.target.files))} />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                {step > 1 && (
                  <button type="button" onClick={() => setStep(step - 1)} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all">
                    <FaChevronLeft /> Back
                  </button>
                )}
                <button type="submit" disabled={!!submitStatus} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 transition-all disabled:opacity-50">
                  {submitStatus ? submitStatus : step === 4 ? 'Create Account' : (
                    <>Next <FaChevronRight /></>
                  )}
                </button>
              </div>
            </form>
            
            <p className="mt-8 text-center text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-rose-600 hover:text-rose-500">Log in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
