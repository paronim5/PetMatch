import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/user';
import { useNotification } from '../context/useNotification';
import { FaArrowLeft, FaBan, FaUnlock, FaFlag, FaUser } from 'react-icons/fa';

const BlockHistoryPage = () => {
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const [activeTab, setActiveTab] = useState('blocks'); // 'blocks' or 'reports'
  const [blocks, setBlocks] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'blocks') {
        const data = await userService.getBlocks();
        setBlocks(data);
      } else {
        const data = await userService.getReports();
        setReports(data);
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
      console.error('Failed to unblock:', err);
      addToast('Failed to unblock user. Please try again.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 flex items-center px-6">
        <button 
          onClick={() => navigate('/profile')}
          className="mr-4 text-gray-600 hover:text-rose-500"
        >
          <FaArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Blocking & Reporting</h1>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-200">
        <button
          className={`flex-1 py-4 text-center font-medium ${activeTab === 'blocks' ? 'text-rose-500 border-b-2 border-rose-500' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('blocks')}
        >
          Blocked Users
        </button>
        <button
          className={`flex-1 py-4 text-center font-medium ${activeTab === 'reports' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('reports')}
        >
          My Reports
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-8">{error}</div>
        ) : activeTab === 'blocks' ? (
          /* Blocks List */
          blocks.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <FaBan className="mx-auto text-4xl mb-2 text-gray-300" />
              <p>You haven't blocked anyone yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {blocks.map((block) => (
                <div key={block.id} className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-3 text-gray-500">
                      <FaUser />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">
                        {block.blocked?.username || `User #${block.blocked_id}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        Blocked on {new Date(block.created_at).toLocaleDateString()}
                      </p>
                      {block.reason && (
                        <p className="text-sm text-gray-600 mt-1 italic">"{block.reason}"</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnblock(block.blocked_id)}
                    className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1"
                  >
                    <FaUnlock size={12} /> Unblock
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Reports List */
          reports.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <FaFlag className="mx-auto text-4xl mb-2 text-gray-300" />
              <p>You haven't submitted any reports.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div key={report.id} className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3 text-orange-500">
                        <FaFlag size={14} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          Reported {report.reported?.username || `User #${report.reported_id}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(report.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                      report.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      report.status === 'resolved' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {report.status}
                    </span>
                  </div>
                  <div className="ml-11">
                    <p className="text-sm font-medium text-gray-700">Reason: {report.reason}</p>
                    {report.description && (
                      <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                    )}
                    {report.resolution_notes && (
                      <div className="mt-3 bg-gray-50 p-2 rounded text-sm border-l-2 border-gray-300">
                        <span className="font-bold text-gray-700">Resolution:</span> {report.resolution_notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default BlockHistoryPage;
