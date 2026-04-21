import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { userService } from '../services/user';
import { useNotification } from '../context/useNotification';
import BottomNav from '../components/BottomNav';
import { pageBgStyle } from '../components/PageBackground';
import { FaArrowLeft, FaBan, FaUnlock, FaFlag, FaUser } from 'react-icons/fa';

const BlockHistoryPage = () => {
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const [activeTab, setActiveTab] = useState('blocks');
  const [blocks, setBlocks] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchData(); }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'blocks') {
        setBlocks(await userService.getBlocks());
      } else {
        setReports(await userService.getReports());
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (blockedId) => {
    try {
      await userService.unblockUser(blockedId);
      setBlocks(prev => prev.filter(b => b.blocked_id !== blockedId));
      addToast('User unblocked successfully.', 'success');
    } catch (err) {
      addToast('Failed to unblock user.', 'error');
    }
  };

  const statusColors = {
    pending: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    resolved: 'bg-green-500/10 text-green-400 border border-green-500/20',
    default: 'bg-gray-800 text-gray-400 border border-gray-700',
  };

  return (
    <div className="min-h-screen flex flex-col pb-16" style={pageBgStyle}>
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 flex items-center gap-3 px-4 py-4">
        <button onClick={() => navigate('/profile')} className="text-gray-400 hover:text-white transition-colors p-1 -ml-1">
          <FaArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-white">Blocking & Reports</h1>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-900 border-b border-gray-800">
        {[
          { key: 'blocks', label: 'Blocked Users', icon: FaBan },
          { key: 'reports', label: 'My Reports', icon: FaFlag },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all relative ${activeTab === key ? 'text-violet-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Icon size={14} /> {label}
            {activeTab === key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 border-violet-600/30 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center text-red-400 py-8">{error}</div>
        ) : activeTab === 'blocks' ? (
          blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <FaBan className="text-gray-600 text-2xl" />
              </div>
              <p className="text-gray-400">No blocked users</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blocks.map((block) => (
                <div key={block.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-gray-400">
                      <FaUser size={16} />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{block.blocked?.username || `User #${block.blocked_id}`}</p>
                      <p className="text-xs text-gray-500">Blocked {new Date(block.created_at).toLocaleDateString()}</p>
                      {block.reason && <p className="text-xs text-gray-500 mt-0.5 italic">"{block.reason}"</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnblock(block.blocked_id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-sm text-gray-300 transition-all"
                  >
                    <FaUnlock size={11} /> Unblock
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <FaFlag className="text-gray-600 text-2xl" />
              </div>
              <p className="text-gray-400">No reports submitted</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <div key={report.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center">
                        <FaFlag className="text-orange-400" size={13} />
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm">
                          Reported {report.reported?.username || `User #${report.reported_id}`}
                        </p>
                        <p className="text-xs text-gray-500">{new Date(report.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold uppercase ${statusColors[report.status] || statusColors.default}`}>
                      {report.status}
                    </span>
                  </div>
                  <div className="ml-12">
                    <p className="text-sm text-gray-300">Reason: <span className="text-gray-400">{report.reason}</span></p>
                    {report.description && <p className="text-sm text-gray-500 mt-1">{report.description}</p>}
                    {report.resolution_notes && (
                      <div className="mt-3 bg-gray-800 border-l-2 border-violet-500 p-3 rounded-r-xl text-sm text-gray-400">
                        <span className="font-semibold text-gray-300">Resolution: </span>{report.resolution_notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default BlockHistoryPage;
