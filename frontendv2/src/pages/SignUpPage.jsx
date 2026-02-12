import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { authService } from '../services/auth';
import { userService } from '../services/user';
import { validateImage } from '../utils/imageValidation';

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
        } else {
          console.error('Geocode failed: ' + status);
        }
      });
    }
  };

  const validateField = (name, value, currentData) => {
    let error = null;
    switch (name) {
      case 'username':
        if (value && !/^[a-zA-Z0-9_-]+$/.test(value)) {
          error = 'Username can only contain letters, numbers, underscores, and hyphens. No spaces or special characters.';
        } else if (value && value.length < 3) {
          error = 'Username must be at least 3 characters.';
        }
        break;
      case 'date_of_birth':
        if (value) {
          const today = new Date();
          const birthDate = new Date(value);
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          if (age < 18) {
            error = 'You must be at least 18 years old to sign up.';
          }
        }
        break;
      case 'password':
        if (value && value.length < 6) {
            error = 'Password must be at least 6 characters.';
        }
        break;
      case 'confirmPassword':
        if (value && value !== currentData.password) {
            error = 'Passwords do not match.';
        }
        break;
      case 'height_value':
        if (value) {
            const val = parseInt(value);
            if (currentData.height_unit === 'cm') {
                if (val < 100 || val > 250) {
                    error = 'Height must be between 100 and 250 cm';
                }
            } else if (currentData.height_unit === 'feet_inches') {
                if (val < 36 || val > 96) {
                    error = 'Height must be between 36 and 96 inches';
                }
            }
        }
        break;
    }
    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextFormData = {
      ...formData,
      [name]: value
    };
    setFormData(nextFormData);

    const error = validateField(name, value, nextFormData);
    setFieldErrors(prev => {
        const next = { ...prev, [name]: error };
        // If password changes, re-validate confirmPassword
        if (name === 'password' && nextFormData.confirmPassword) {
            next.confirmPassword = validateField('confirmPassword', nextFormData.confirmPassword, nextFormData);
        }
        // If height unit changes, re-validate height value
        if (name === 'height_unit' && nextFormData.height_value) {
            next.height_value = validateField('height_value', nextFormData.height_value, nextFormData);
        }
        return next;
    });
  };

  const nextStep = (e) => {
    e.preventDefault();
    
    // Validate current step fields before proceeding
    const currentStepErrors = {};
    let hasError = false;

    if (step === 1) {
        ['username', 'password', 'confirmPassword'].forEach(field => {
            const error = validateField(field, formData[field], formData);
            if (error) {
                currentStepErrors[field] = error;
                hasError = true;
            }
        });
    } else if (step === 2) {
        const error = validateField('date_of_birth', formData.date_of_birth, formData);
        if (error) {
            currentStepErrors.date_of_birth = error;
            hasError = true;
        }
    } else if (step === 3) {
        const error = validateField('height_value', formData.height_value, formData);
        if (error) {
            currentStepErrors.height_value = error;
            hasError = true;
        }
    }

    if (hasError) {
        setFieldErrors(prev => ({ ...prev, ...currentStepErrors }));
        return;
    }

    setStep(step + 1);
  };

  const prevStep = (e) => {
    e.preventDefault();
    setStep(step - 1);
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
          setFormData({
            ...formData,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          alert(`Location found: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
        },
        (error) => {
          console.error("Error getting location", error);
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
      alert('Geolocation is not supported by this browser.');
    }
  };

  const handleFileSelect = async (files) => {
    if (files.length === 0) return;
    
    // Limit total photos
    if (profilePhotoFiles.length + files.length > 10) {
        setPhotoError("Maximum 10 photos allowed.");
        return;
    }
    
    setPhotoError('');
    
    // Filter duplicates
    const uniqueFiles = files.filter(file => 
        !profilePhotoFiles.some(existing => existing.name === file.name && existing.size === file.size)
    );
    
    if (uniqueFiles.length < files.length) {
         // Could show a warning, but for now just ignoring duplicates
         console.log("Skipped duplicates");
    }

    const newFiles = [...profilePhotoFiles, ...uniqueFiles];
    setProfilePhotoFiles(newFiles);
    
    // Validate new files
    for (const file of uniqueFiles) {
        // Init status
        setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'loading', message: 'Validating...' } }));
        
        // 1. Client-side checks
        const clientValid = await validateImage(file);
        if (!clientValid.ok) {
            setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'error', message: clientValid.message } }));
            continue;
        }
        
        // 2. Server-side AI check
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
            console.error(err);
            let msg = 'Validation failed';
            if (err.response?.data?.detail) msg = err.response.data.detail;
            setPhotoValidations(prev => ({ ...prev, [file.name]: { status: 'error', message: msg } }));
        }
    }
  };

  const removePhoto = (index) => {
      const newFiles = [...profilePhotoFiles];
      const removed = newFiles.splice(index, 1)[0];
      setProfilePhotoFiles(newFiles);
      setPhotoValidations(prev => {
          const next = { ...prev };
          delete next[removed.name];
          return next;
      });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }
    if (!formData.phone_number) {
      setErrorMessage('Phone number is required');
      return;
    }
    const sanitizedLocal = (formData.phone_number || '').replace(/[^0-9]/g, '');
    if (sanitizedLocal.length < 6) {
      setErrorMessage('Please enter at least 6 digits for the local number');
      return;
    }
    const phoneE164 = `${formData.phone_country_code}${sanitizedLocal}`;
    
    // Validate photo
    const validPhotos = profilePhotoFiles.filter(f => photoValidations[f.name]?.status === 'success');
    
    if (validPhotos.length === 0) {
      setPhotoError('Please upload at least one valid profile picture');
      setErrorMessage('Please upload at least one valid profile picture');
      return;
    }
    
    // Check if any are still loading
    const anyLoading = profilePhotoFiles.some(f => photoValidations[f.name]?.status === 'loading');
    if (anyLoading) {
        setPhotoError('Please wait for photo validation to complete');
        return;
    }

    setSubmitStatus('Creating account...');
    try {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Starting registration process...`);
      
      // 1. Register User
      console.log(`[${timestamp}] Step 1: Registering user...`);
      console.log(`[${timestamp}] details: email=${formData.email}, username=${formData.username}, phone=${phoneE164}`);
      
      await authService.register(formData.email, formData.password, phoneE164, formData.username || undefined);
      console.log(`[${new Date().toISOString()}] Step 1: User registered successfully.`);
      
      // 2. Auto Login
      setSubmitStatus('Logging in...');
      console.log(`[${new Date().toISOString()}] Step 2: Auto-logging in with email=${formData.email}...`);
      const loginData = await authService.login(formData.email, formData.password);
      localStorage.setItem('token', loginData.access_token);
      console.log(`[${new Date().toISOString()}] Step 2: Login successful, token stored.`);

      // 2a. Upload Profile Photos
      const photosToUpload = profilePhotoFiles.filter(f => photoValidations[f.name]?.status === 'success');
      
      if (photosToUpload.length > 0) {
        console.log(`[${new Date().toISOString()}] Step 2a: Uploading ${photosToUpload.length} photos...`);
        try {
            const photoResult = await userService.uploadPhotos(photosToUpload);
            console.log(`[${new Date().toISOString()}] Step 2a: Photos uploaded successfully:`, photoResult);
        } catch (photoErr) {
            console.error(`[${new Date().toISOString()}] Step 2a: Photo upload failed details:`, photoErr);
            throw new Error(`Photo upload failed: ${photoErr.message}`);
        }
      } else {
        console.log(`[${new Date().toISOString()}] Step 2a: No valid profile photos to upload.`);
      }

      // 3. Update Profile
      console.log(`[${new Date().toISOString()}] Step 3: Updating profile details...`);
      // Append interests to bio for now
      let finalBio = formData.bio;
      if (formData.interests) {
        finalBio += `\n\nInterests: ${formData.interests}`;
      }

      const profileData = {
        first_name: formData.first_name,
        surname: formData.surname || null,
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        bio: finalBio,
        location_city: formData.location_city,
        // Extended fields
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
      console.log(`[${new Date().toISOString()}] Profile data payload:`, profileData);
      
      await userService.updateProfile(profileData);
      console.log(`[${new Date().toISOString()}] Step 3: Profile updated successfully.`);
      
      // 3b. Set Preferences
      console.log(`[${new Date().toISOString()}] Step 3b: Updating preferences...`);
      const prefData = {
        min_age: formData.min_age,
        max_age: formData.max_age,
        max_distance: formData.max_distance,
        preferred_genders: formData.preferred_genders
      };
      console.log(`[${new Date().toISOString()}] Preferences payload:`, prefData);
      
      await userService.updatePreferences(prefData);
      console.log(`[${new Date().toISOString()}] Step 3b: Preferences updated successfully.`);

      // 4. Redirect
      console.log(`[${new Date().toISOString()}] Step 4: Registration complete. Redirecting to /matching...`);
      setSuccessMessage('Registration successful! Welcome to PetMatch.');
      navigate('/matching');
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Registration failed. Full error object:`, error);
      if (error.stack) {
        console.error(`[${new Date().toISOString()}] Error stack:`, error.stack);
      }
      let errorMessage = error.message;
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      if (errorMessage && errorMessage.includes("already exists")) {
        setErrorMessage('This email is already registered. Please log in instead.');
        navigate('/login');
      } else {
        setErrorMessage(errorMessage || 'We could not complete your registration. Please check your details and try again.');
      }
    } finally {
      setSubmitStatus('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-peach-light via-peach-medium to-rose-light p-4">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-xl md:text-2xl font-bold text-center text-primary mb-6">
          {step === 1 && "Create Account"}
          {step === 2 && "Tell us about yourself"}
          {step === 3 && "Lifestyle & Work"}
          {step === 4 && "Final Details"}
        </h2>
        {errorMessage && (
          <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3 rounded bg-green-50 text-green-700 text-sm">
            {successMessage}
          </div>
        )}

        <div className="mb-6 flex justify-between items-center px-4">
          <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-gray-200'}`}></div>
          <div className={`h-2 flex-1 mx-2 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-gray-200'}`}></div>
          <div className={`h-2 flex-1 mx-2 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-gray-200'}`}></div>
          <div className={`h-2 flex-1 rounded-full ${step >= 4 ? 'bg-primary' : 'bg-gray-200'}`}></div>
        </div>

        <form onSubmit={step === 4 ? handleSubmit : nextStep} className="space-y-4">
          
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className={`mt-1 block w-full px-3 py-2 border ${fieldErrors.username ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-primary focus:border-primary`}
                  required
                  placeholder="yourname"
                />
                {fieldErrors.username && (
                  <p className="mt-1 text-xs text-red-600 font-medium">
                    {fieldErrors.username}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <div className="flex gap-2">
                  <select
                    name="phone_country_code"
                    value={formData.phone_country_code}
                    onChange={handleChange}
                    className="mt-1 block w-36 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  >
                    <option value="+420">Czech Republic (+420)</option>
                    <option value="+1">United States (+1)</option>
                    <option value="+44">United Kingdom (+44)</option>
                    <option value="+91">India (+91)</option>
                    <option value="+61">Australia (+61)</option>
                    <option value="+81">Japan (+81)</option>
                    <option value="+49">Germany (+49)</option>
                    <option value="+33">France (+33)</option>
                    <option value="+86">China (+86)</option>
                    <option value="+971">UAE (+971)</option>
                  </select>
                  <input
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    inputMode="tel"
                    autoComplete="tel"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    required
                    placeholder="777427379
                    "
                    pattern="^[0-9\\- ]{6,}$"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Select country, then enter local number. Spaces or dashes allowed.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`mt-1 block w-full px-3 py-2 border ${fieldErrors.password ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-primary focus:border-primary`}
                  required
                />
                {fieldErrors.password && <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`mt-1 block w-full px-3 py-2 border ${fieldErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-primary focus:border-primary`}
                  required
                />
                {fieldErrors.confirmPassword && <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.confirmPassword}</p>}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  name="surname"
                  value={formData.surname}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  className={`mt-1 block w-full px-3 py-2 border ${fieldErrors.date_of_birth ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-primary focus:border-primary`}
                  required
                />
                {fieldErrors.date_of_birth && <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.date_of_birth}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non_binary">Non-binary</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Height</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="height_value"
                    value={formData.height_value}
                    onChange={handleChange}
                    className={`mt-1 block w-full px-3 py-2 border ${fieldErrors.height_value ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-primary focus:border-primary`}
                    placeholder="Height"
                  />
                  <select
                    name="height_unit"
                    value={formData.height_unit}
                    onChange={handleChange}
                    className="mt-1 block w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  >
                    <option value="cm">cm</option>
                    <option value="feet_inches">ft</option>
                  </select>
                </div>
                {fieldErrors.height_value && <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.height_value}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Education</label>
                <input
                  type="text"
                  name="education"
                  value={formData.education}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
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
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  placeholder="Current job"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Relationship Goal</label>
                <select
                  name="relationship_goal"
                  value={formData.relationship_goal}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                >
                  <option value="relationship">Relationship</option>
                  <option value="casual">Casual</option>
                  <option value="friendship">Friendship</option>
                  <option value="undecided">Undecided</option>
                </select>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">Smoking</label>
                  <select
                    name="smoking"
                    value={formData.smoking}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  >
                    <option value="never">Never</option>
                    <option value="occasionally">Occasionally</option>
                    <option value="regularly">Regularly</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">Drinking</label>
                  <select
                    name="drinking"
                    value={formData.drinking}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  >
                    <option value="never">Never</option>
                    <option value="occasionally">Occasionally</option>
                    <option value="regularly">Regularly</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Interests</label>
                <input
                  type="text"
                  name="interests"
                  value={formData.interests || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  placeholder="e.g. Hiking, Photography, Cooking"
                />
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Location (City)</label>
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
                {/* Hidden input to ensure required validation if needed, though we handle validation manually mostly */}
                <input type="hidden" name="location_city" value={formData.location_city} />
              </div>
              <div className="bg-blue-50 p-4 rounded-lg space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Profile Pictures (Max 10)</label>
                
                <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-rose-500 transition-colors cursor-pointer bg-white"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        handleFileSelect(Array.from(e.dataTransfer.files));
                    }}
                    onClick={() => document.getElementById('file-upload').click()}
                >
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => handleFileSelect(Array.from(e.target.files || []))}
                      className="hidden"
                    />
                    <div className="text-gray-500">
                        <p className="font-medium">Click to upload or drag and drop</p>
                        <p className="text-xs mt-1">Animal photos only (JPG, PNG, WebP, GIF)</p>
                        <p className="text-xs text-rose-500 mt-1">Strictly enforced: No humans allowed</p>
                    </div>
                </div>

                {photoError && <p className="text-xs text-red-600 mt-2">{photoError}</p>}
                
                {/* Photo List */}
                {profilePhotoFiles.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {profilePhotoFiles.map((file, idx) => (
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
                                
                                {/* Status Indicator */}
                                <div className="mt-1 text-xs font-medium">
                                    {photoValidations[file.name]?.status === 'loading' && (
                                        <span className="text-blue-600 flex items-center gap-1">
                                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                            Validating...
                                        </span>
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
                                    onClick={(e) => { e.stopPropagation(); removePhoto(idx); }}
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
              </div>
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <h4 className="font-medium text-gray-800">Match Preferences</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Min Age</label>
                    <input
                      type="number"
                      min={18}
                      name="min_age"
                      value={formData.min_age}
                      onChange={handleChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
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
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
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
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-2">Preferred Genders</span>
                  <div className="flex gap-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700">Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows="3"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  placeholder="I love dogs and hiking..."
                ></textarea>
              </div>
            </>
          )}

          <div className="flex gap-4 mt-6">
            {step > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={!!submitStatus}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              {submitStatus || (step === 4 ? 'Complete Sign Up' : 'Next')}
            </button>
          </div>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-rose-600 hover:text-rose-500">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignUpPage;


