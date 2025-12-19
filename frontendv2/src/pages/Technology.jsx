import React from 'react';
import { useNavigate } from 'react-router-dom';

const Technology = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 px-6 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"
      >
        ← Back to Home
      </button>
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-4xl font-bold text-rose-600 mb-6">Technology Stack</h1>
        <div className="prose lg:prose-xl text-gray-700">
          <p>
            PetMatch is built using cutting-edge web technologies to ensure a fast, responsive, 
            and immersive user experience.
          </p>
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <div className="bg-blue-50 p-6 rounded-xl">
              <h3 className="text-xl font-bold text-blue-700 mb-2">Frontend</h3>
              <ul className="list-disc pl-5">
                <li>React 18</li>
                <li>Three.js & React Three Fiber (3D Animations)</li>
                <li>Tailwind CSS (Styling)</li>
                <li>Vite (Build Tool)</li>
              </ul>
            </div>
            <div className="bg-green-50 p-6 rounded-xl">
              <h3 className="text-xl font-bold text-green-700 mb-2">Backend</h3>
              <ul className="list-disc pl-5">
                <li>Node.js & Express</li>
                <li>MongoDB (Database)</li>
                <li>JWT Authentication</li>
                <li>Cloudinary (Image Hosting)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Technology;
