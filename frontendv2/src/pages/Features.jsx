import React from 'react';
import { useNavigate } from 'react-router-dom';

const Features = () => {
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
        <h1 className="text-4xl font-bold text-rose-600 mb-6">Key Features</h1>
        <div className="grid gap-6">
          {[
            {
              title: "Smart Matching Algorithm",
              desc: "Our AI-powered system matches you with pets based on your lifestyle, living situation, and preferences."
            },
            {
              title: "Virtual Meet & Greet",
              desc: "Schedule video calls with shelters to meet pets before visiting in person."
            },
            {
              title: "Adoption Tracker",
              desc: "Track your adoption application status in real-time with detailed milestones."
            },
            {
              title: "Pet Care Resources",
              desc: "Access a vast library of articles, videos, and guides on pet care, training, and health."
            }
          ].map((feature, i) => (
            <div key={i} className="border-l-4 border-rose-500 pl-6 py-2">
              <h3 className="text-xl font-bold text-gray-800">{feature.title}</h3>
              <p className="text-gray-600 mt-1">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Features;
