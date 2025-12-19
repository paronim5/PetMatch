import React, { useState } from 'react';
import { userService } from '../services/user';
import { FaExclamationTriangle, FaBan, FaTimes } from 'react-icons/fa';

export const BlockModal = ({ show, onClose, onBlock, blockedUser }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await userService.blockUser(blockedUser.id, reason);
      onBlock(blockedUser.id);
      onClose();
    } catch (err) {
      setError('Failed to block user. ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-red-600 flex items-center">
            <FaBan className="mr-2" /> Block User
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FaTimes />
          </button>
        </div>
        
        <p className="mb-4 text-gray-700">
          Are you sure you want to block <strong>{blockedUser?.username || blockedUser?.first_name || 'this user'}</strong>? 
          They will no longer be able to message you or see your profile.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Reason (optional)
            </label>
            <textarea
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              rows="3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you blocking this user?"
            />
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center"
              disabled={loading}
            >
              {loading ? 'Blocking...' : 'Confirm Block'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ReportModal = ({ show, onClose, onReport, reportedUser }) => {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      setError('Please select a reason.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await userService.reportUser(reportedUser.id, reason, description);
      onReport(reportedUser.id);
      onClose();
    } catch (err) {
      setError('Failed to report user. ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const reportReasons = [
    'Spam',
    'Inappropriate Content',
    'Harassment',
    'Fake Profile',
    'Scam',
    'Other'
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-orange-600 flex items-center">
            <FaExclamationTriangle className="mr-2" /> Report User
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FaTimes />
          </button>
        </div>
        
        <p className="mb-4 text-gray-700">
          Please tell us why you are reporting <strong>{reportedUser?.username || reportedUser?.first_name || 'this user'}</strong>.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Reason
            </label>
            <select
              className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            >
              <option value="">Select a reason</option>
              {reportReasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Description (optional)
            </label>
            <textarea
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide more details..."
            />
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 flex items-center"
              disabled={loading}
            >
              {loading ? 'Reporting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
