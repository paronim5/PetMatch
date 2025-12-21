import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { authService } from '../services/auth';
import { useGoogleLogin } from '@react-oauth/google';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await authService.login(email, password);
      console.log('Login successful:', data);
      localStorage.setItem('token', data.access_token);
      // Redirect based on profile status
      if (data.profile_incomplete) {
        navigate('/complete-profile');
      } else {
        navigate('/matching');
      }
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed: ' + error.message);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      try {
        const data = await authService.googleLogin(codeResponse.code);
        console.log('Google login successful:', data);
        localStorage.setItem('token', data.access_token);
        if (data.profile_incomplete) {
            navigate('/complete-profile');
        } else {
            navigate('/matching');
        }
      } catch (error) {
        console.error('Google login failed:', error);
        alert('Google login failed: ' + (error.message || 'Unknown error'));
      }
    },
    onError: (error) => {
        console.error('Google login error:', error);
        alert('Google login failed');
    },
    flow: 'auth-code',
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-peach-light via-peach-medium to-rose-light p-4">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-xl md:text-2xl font-bold text-center text-rose-dark mb-6">Login to PetMatch</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-3 text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-rose-dark focus:border-rose-dark"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-3 text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-rose-dark focus:border-rose-dark"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-rose-dark text-white h-12 rounded-md hover:bg-rose-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-dark text-base font-medium"
          >
            Login
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-dark"
            >
              <FcGoogle className="w-5 h-5 mr-2" />
              Login with Google
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link to="/signup" className="font-medium text-rose-dark hover:text-rose-light">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
