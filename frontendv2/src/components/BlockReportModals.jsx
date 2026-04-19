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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center">
              <FaBan className="text-red-400" size={13} />
            </div>
            Block User
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <FaTimes />
          </button>
        </div>

        <p className="mb-5 text-gray-400 text-sm">
          Block <span className="text-white font-semibold">{blockedUser?.username || blockedUser?.first_name || 'this user'}</span>?
          They won't be able to message you or see your profile.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
              Reason (optional)
            </label>
            <textarea
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500 transition-all resize-none"
              rows="3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you blocking this user?"
            />
          </div>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {loading ? 'Blocking...' : 'Block User'}
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
    if (!reason) { setError('Please select a reason.'); return; }
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

  const reportReasons = ['Spam', 'Inappropriate Content', 'Harassment', 'Fake Profile', 'Scam', 'Other'];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-500/10 border border-yellow-500/20 rounded-full flex items-center justify-center">
              <FaExclamationTriangle className="text-yellow-400" size={13} />
            </div>
            Report User
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <FaTimes />
          </button>
        </div>

        <p className="mb-5 text-gray-400 text-sm">
          Report <span className="text-white font-semibold">{reportedUser?.username || reportedUser?.first_name || 'this user'}</span>.
          Our team will review the report.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
              Reason
            </label>
            <select
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500 transition-all"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            >
              <option value="" className="bg-gray-800">Select a reason</option>
              {reportReasons.map((r) => (
                <option key={r} value={r} className="bg-gray-800">{r}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
              Description (optional)
            </label>
            <textarea
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500 transition-all resize-none"
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide more details..."
            />
          </div>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {loading ? 'Reporting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
