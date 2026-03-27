import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { FaPaw } from 'react-icons/fa';
import { authService } from '../services/auth';
import { useGoogleLogin } from '@react-oauth/google';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authService.login(email, password);
      localStorage.setItem('token', data.access_token);
      navigate(data.profile_incomplete ? '/complete-profile' : '/matching');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      setError('');
      setLoading(true);
      try {
        const data = await authService.googleLogin(codeResponse.code);
        localStorage.setItem('token', data.access_token);
        navigate(data.profile_incomplete ? '/complete-profile' : '/matching');
      } catch (err) {
        setError('Google login failed: ' + (err.message || 'Unknown error'));
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError('Google login failed'),
    flow: 'auth-code',
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-orange-50 to-rose-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Card header */}
        <div className="bg-gradient-to-r from-rose-500 to-orange-400 px-8 py-10 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FaPaw className="text-3xl text-white" />
          </div>
          <h1 className="text-3xl font-extrabold">Welcome back</h1>
          <p className="mt-1 text-rose-100 text-sm">Sign in to your PetMatch account</p>
        </div>

        <div className="px-8 py-8 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-gray-700 placeholder-gray-400"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-gray-700 placeholder-gray-400"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-orange-400 text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-gray-400 font-medium">or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-600 hover:bg-white hover:shadow-md transition-all disabled:opacity-50"
          >
            <FcGoogle className="text-xl" />
            Continue with Google
          </button>

          <p className="text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/signup" className="font-bold text-rose-500 hover:text-rose-600">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
