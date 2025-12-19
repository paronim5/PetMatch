import React from 'react';
import { useNavigate } from 'react-router-dom';

const ProjectGoal = () => {
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
        <h1 className="text-4xl font-bold text-rose-600 mb-6">Project Goal</h1>
        <div className="prose lg:prose-xl text-gray-700">
          <p>
            The primary goal of PetMatch is to revolutionize the pet adoption process by creating a 
            seamless, engaging, and secure platform that connects potential pet owners with animals 
            in need. We aim to reduce the number of homeless pets by making adoption more accessible 
            and transparent.
          </p>
          <p className="mt-4">
            Our platform focuses on:
          </p>
          <ul className="list-disc pl-6 mt-4 space-y-2">
            <li>Simplifying the adoption application process</li>
            <li>Providing detailed personality profiles for pets</li>
            <li>Connecting shelters directly with adopters</li>
            <li>Educating new pet owners on responsible care</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ProjectGoal;
