import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import ProjectGoal from './pages/ProjectGoal';
import Technology from './pages/Technology';
import Features from './pages/Features';
import Contact from './pages/Contact';
import ProfilePage from './pages/ProfilePage';
import MatchingPage from './pages/MatchingPage';
import ChatPage from './pages/ChatPage';
import SwipeHistoryPage from './pages/SwipeHistoryPage';
import BlockHistoryPage from './pages/BlockHistoryPage';
import { NotificationProvider } from './context/NotificationContext';

function App() {
  return (
    <Router>
      <NotificationProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/project-goal" element={<ProjectGoal />} />
          <Route path="/technology" element={<Technology />} />
          <Route path="/features" element={<Features />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/matching" element={<MatchingPage />} />
          <Route path="/history" element={<SwipeHistoryPage />} />
          <Route path="/blocks" element={<BlockHistoryPage />} />
          <Route path="/chat" element={<ChatPage />} />
        </Routes>
      </NotificationProvider>
    </Router>
  );
}

export default App;
