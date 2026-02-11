import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { FaEnvelope, FaLock } from 'react-icons/fa';
import { authService } from '../services/auth';
import { useGoogleLogin } from '@react-oauth/google';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await authService.login(email, password);
      localStorage.setItem('token', data.access_token);
      if (data.profile_incomplete) {
        navigate('/complete-profile');
      } else {
        navigate('/matching');
      }
    } catch (error) {
      setError(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      setLoading(true);
      setError('');
      try {
        const data = await authService.googleLogin(codeResponse.code);
        localStorage.setItem('token', data.access_token);
        if (data.profile_incomplete) {
            navigate('/complete-profile');
        } else {
            navigate('/matching');
        }
      } catch (error) {
        setError(error.message || 'Google login failed');
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
        setError('Google login failed');
    },
    flow: 'auth-code',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-orange-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 hover:shadow-rose-100">
          <div className="bg-rose-500 p-10 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-rose-400 rounded-full opacity-20 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-orange-400 rounded-full opacity-20 blur-3xl"></div>
            
            <h2 className="text-4xl font-black tracking-tight mb-2">Welcome Back</h2>
            <p className="text-rose-100 font-medium">Find the perfect match for your pet</p>
          </div>

          <div className="p-10">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl text-sm flex items-center gap-3 animate-shake">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-600"></div>
                  {error}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-rose-500 transition-colors">
                      <FaEnvelope />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-gray-700 placeholder-gray-400 shadow-sm"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2 ml-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Password</label>
                    <Link to="/forgot-password" name="forgot-password-link" className="text-xs font-bold text-rose-500 hover:text-rose-600">Forgot?</Link>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-rose-500 transition-colors">
                      <FaLock />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-gray-700 placeholder-gray-400 shadow-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300 rounded-lg cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-gray-600 font-medium cursor-pointer">
                    Remember me
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-2xl shadow-lg text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="px-4 bg-white text-gray-400 font-bold tracking-widest">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleGoogleLogin()}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-4 border-2 border-gray-100 rounded-2xl text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-200 transition-all active:scale-[0.98] shadow-sm"
              >
                <FcGoogle size={22} />
                <span>Sign in with Google</span>
              </button>
            </form>

            <p className="mt-10 text-center text-sm text-gray-500 font-medium">
              New to PetMatch?{' '}
              <Link to="/signup" name="signup-link" className="font-bold text-rose-500 hover:text-rose-600 underline-offset-4 hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
