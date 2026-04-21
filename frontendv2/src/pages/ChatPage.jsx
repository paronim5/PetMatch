import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_URL } from '../config';
import { BlockModal, ReportModal } from '../components/BlockReportModals';
import BottomNav from '../components/BottomNav';
import { pageBgStyle } from '../components/PageBackground';
import { chatService } from '../services/chat';
import {
  FaFlag, FaBan, FaSmile, FaCheck, FaCheckDouble, FaArrowLeft,
  FaComments, FaHeart, FaUser, FaPaperPlane, FaPaw, FaUserPlus, FaTrash, FaHeartBroken
} from 'react-icons/fa';
import { Link } from 'react-router-dom';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

const ChatPage = () => {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const lastScrollTopRef = useRef(0);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const navigate = useNavigate();

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState(null);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false);
  const [longPressedMessageId, setLongPressedMessageId] = useState(null);
  const longPressTimer = useRef(null);

  const getToken = () => localStorage.getItem('token');

  const handleUnmatch = async () => {
    if (!selectedMatch) return;
    try {
      await chatService.unmatch(selectedMatch.id);
      setMatches(prev => prev.filter(m => m.id !== selectedMatch.id));
      setSelectedMatch(null);
      setMessages([]);
    } catch (err) {
      console.error('Unmatch failed:', err);
    } finally {
      setShowUnmatchConfirm(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const updated = await chatService.deleteMessage(messageId);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, message_text: null, deleted_at: updated.deleted_at } : m));
    } catch (err) {
      console.error('Delete message failed:', err);
    } finally {
      setLongPressedMessageId(null);
    }
  };

  const startLongPress = (messageId) => {
    longPressTimer.current = setTimeout(() => setLongPressedMessageId(messageId), 500);
  };

  const cancelLongPress = () => {
    clearTimeout(longPressTimer.current);
  };

  const handleReact = async (messageId, emoji) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/chat/messages/${messageId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ emoji })
      });
      if (res.ok) {
        const updatedMsg = await res.json();
        setMessages(prev => prev.map(m => m.id === messageId ? updatedMsg : m));
        setActiveReactionMessageId(null);
      }
    } catch (e) { console.error(e); }
  };

  const markRead = async (matchId) => {
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${API_URL}/chat/matches/${matchId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) { console.error(e); }
  };

  const getPartnerUser = (match) => {
    if (!match || !currentUserId) return null;
    return match.user1_id === currentUserId ? match.user2 : match.user1;
  };

  const handleBlockReportSuccess = () => {
    setMatches(prev => prev.filter(m => m.id !== selectedMatch.id));
    setSelectedMatch(null);
    setShowBlockModal(false);
    setShowReportModal(false);
  };

  const getPhotoUrl = (url) => {
    if (!url) return null;
    const i = url.indexOf('/static/');
    return i !== -1 ? url.substring(i) : url;
  };

  const getPartnerDetails = (match) => {
    if (!match || !currentUserId) return { name: 'Unknown', photo: null };
    const partner = getPartnerUser(match);
    if (!partner) return { name: `Match #${match.id}`, photo: null, username: `user_${match.user1_id === currentUserId ? match.user2_id : match.user1_id}` };
    return {
      name: partner.username || `Match #${match.id}`,
      photo: partner.photos?.length > 0 ? getPhotoUrl(partner.photos[0].photo_url) : null,
      username: partner.username
    };
  };

  const fetchCurrentUser = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const user = await res.json();
        setCurrentUserId(user.id);
        return user.id;
      }
    } catch (e) { console.error(e); }
  };

  const fetchMatches = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/chat/matches`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setMatches(data);
        const savedMatchId = sessionStorage.getItem('lastSelectedMatchId');
        if (savedMatchId) {
          const found = data.find(m => m.id.toString() === savedMatchId);
          if (found && !selectedMatch) setSelectedMatch(found);
          else if (data.length > 0 && !selectedMatch) setSelectedMatch(data[0]);
        } else if (data.length > 0 && !selectedMatch) {
          setSelectedMatch(data[0]);
        }
      }
    } catch (e) { console.error(e); }
  };

  const fetchMessages = async (matchId) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/chat/matches/${matchId}/messages?limit=100`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.reverse());
        const savedScroll = sessionStorage.getItem(`chatScroll_${matchId}`);
        if (savedScroll && scrollContainerRef.current) {
          setTimeout(() => { if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = parseInt(savedScroll, 10); }, 0);
        } else { scrollToBottom(); }
      }
    } catch (e) { console.error(e); }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedMatch) return;
    const token = getToken();
    try {
      const res = await fetch(`${API_URL}/chat/matches/${selectedMatch.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message_text: inputText })
      });
      if (res.ok) {
        const newMsg = await res.json();
        setMessages(prev => [...prev, newMsg]);
        setInputText('');
        setIsAutoScrollEnabled(true);
        setTimeout(scrollToBottom, 0);
      }
    } catch (e) { console.error(e); }
  };

  const handleJoinChat = async (e) => {
    e.preventDefault();
    const token = getToken();
    try {
      const trimmed = joinCode.trim();
      if (!trimmed) return;
      const res = await fetch(`${API_URL}/chat/join-by-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: trimmed })
      });
      if (res.ok) {
        const match = await res.json();
        setJoinCode('');
        fetchMatches();
        setSelectedMatch(match);
      }
    } catch (e) { console.error(e); }
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    if (selectedMatch) sessionStorage.setItem(`chatScroll_${selectedMatch.id}`, scrollTop.toString());
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsAutoScrollEnabled(scrollHeight - scrollTop - clientHeight < 50);
      lastScrollTopRef.current = scrollTop;
    }, 1000);
  };

  useEffect(() => { fetchCurrentUser().then(() => fetchMatches()); }, []);

  useEffect(() => {
    if (selectedMatch) {
      sessionStorage.setItem('lastSelectedMatchId', selectedMatch.id.toString());
      fetchMessages(selectedMatch.id);
      markRead(selectedMatch.id);
      const interval = setInterval(() => {
        const token = getToken();
        if (!token) return;
        fetch(`${API_URL}/chat/matches/${selectedMatch.id}/messages?limit=100`, { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.ok ? res.json() : [])
          .then(data => {
            const newMsgs = data.reverse();
            setMessages(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(newMsgs)) {
                if (isAutoScrollEnabled) setTimeout(scrollToBottom, 0);
                const lastMsg = newMsgs[newMsgs.length - 1];
                if (lastMsg && lastMsg.sender_id !== currentUserId) markRead(selectedMatch.id);
                return newMsgs;
              }
              return prev;
            });
          }).catch(console.error);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedMatch, isAutoScrollEnabled, currentUserId]);

  return (
    <div className="flex flex-col h-screen pb-16" style={pageBgStyle}>
      {/* Header */}
      <div className="w-full bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-3 flex-shrink-0">
        <FaPaw className="text-violet-400" />
        <h1 className="text-xl font-bold text-white">Messages</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`w-full md:w-80 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0 ${selectedMatch ? 'hidden md:flex' : 'flex'}`}>
          {/* Add by username */}
          <div className="p-4 border-b border-gray-800">
            <p className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1.5">
              <FaUserPlus size={10} /> Start a conversation
            </p>
            <form onSubmit={handleJoinChat} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter username"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-all"
              />
              <button type="submit" className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all">
                Add
              </button>
            </form>
          </div>

          {/* Match list */}
          <div className="flex-1 overflow-y-auto">
            {matches.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <FaHeart className="text-gray-700 text-3xl mb-3" />
                <p className="text-gray-500 text-sm">No matches yet.</p>
                <p className="text-gray-600 text-xs mt-1">Start swiping to find your match!</p>
              </div>
            )}
            {matches.map(match => {
              const partner = getPartnerDetails(match);
              const isActive = selectedMatch?.id === match.id;
              return (
                <div
                  key={match.id}
                  onClick={() => setSelectedMatch(match)}
                  className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all border-b border-gray-800/50 ${isActive ? 'bg-violet-600/10 border-l-2 border-l-violet-500' : 'hover:bg-gray-800/50'}`}
                >
                  {partner.photo ? (
                    <img src={partner.photo} alt={partner.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0 ring-2 ring-gray-700" />
                  ) : (
                    <div className="w-11 h-11 bg-gray-700 rounded-full flex-shrink-0 flex items-center justify-center text-gray-400 font-bold text-lg">
                      {partner.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className={`font-semibold truncate ${isActive ? 'text-violet-300' : 'text-white'}`}>{partner.name}</p>
                    <p className="text-gray-600 text-xs truncate">New match!</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat area */}
        <div className={`flex-1 flex flex-col bg-gray-950 min-w-0 ${selectedMatch ? 'flex' : 'hidden md:flex'}`}>
          {selectedMatch ? (
            <>
              {/* Chat header */}
              <div className="px-4 py-3.5 bg-gray-900 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedMatch(null)} className="md:hidden text-gray-400 hover:text-white transition-colors p-1 -ml-1">
                    <FaArrowLeft size={18} />
                  </button>
                  {(() => {
                    const partner = getPartnerDetails(selectedMatch);
                    return (
                      <>
                        {partner.photo ? (
                          <img src={partner.photo} alt={partner.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-700" />
                        ) : (
                          <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-gray-400 font-bold">
                            {partner.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-white text-sm">{partner.name}</h3>
                          <p className="text-gray-500 text-xs">Online</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowReportModal(true)} className="text-gray-500 hover:text-yellow-400 transition-colors p-1">
                    <FaFlag size={15} />
                  </button>
                  <button onClick={() => setShowBlockModal(true)} className="text-gray-500 hover:text-red-400 transition-colors p-1">
                    <FaBan size={15} />
                  </button>
                  <button onClick={() => setShowUnmatchConfirm(true)} className="text-gray-500 hover:text-pink-400 transition-colors p-1" title="Unmatch">
                    <FaHeartBroken size={15} />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollContainerRef} onScroll={handleScroll}>
                {messages.map((msg) => {
                  const isMine = msg.sender_id === currentUserId;
                  const isDeleted = !!msg.deleted_at;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className="relative group max-w-xs lg:max-w-sm"
                        onMouseDown={() => isMine && !isDeleted && startLongPress(msg.id)}
                        onMouseUp={cancelLongPress}
                        onMouseLeave={cancelLongPress}
                        onTouchStart={() => isMine && !isDeleted && startLongPress(msg.id)}
                        onTouchEnd={cancelLongPress}
                      >
                        {longPressedMessageId === msg.id && (
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 flex gap-2 z-30 shadow-xl">
                            <button onClick={() => handleDeleteMessage(msg.id)} className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs font-medium">
                              <FaTrash size={12} /> Delete
                            </button>
                            <button onClick={() => setLongPressedMessageId(null)} className="text-gray-400 hover:text-gray-300 text-xs">Cancel</button>
                          </div>
                        )}
                        <div className={`px-4 py-2.5 rounded-2xl ${isMine ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-100 rounded-bl-sm'} ${isDeleted ? 'opacity-50' : ''}`}>
                          <p className="text-sm leading-relaxed">{isDeleted ? <span className="italic text-gray-400">This message was deleted</span> : msg.message_text}</p>
                          <div className={`flex items-center gap-1 mt-1 text-xs ${isMine ? 'text-violet-200 justify-end' : 'text-gray-500'}`}>
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMine && (
                              <span className="ml-0.5">
                                {msg.reads?.length > 0 ? <FaCheckDouble size={10} /> : <FaCheck size={10} />}
                              </span>
                            )}
                          </div>
                        </div>

                        {msg.reactions?.length > 0 && (
                          <div className={`absolute -bottom-3 ${isMine ? 'right-1' : 'left-1'} bg-gray-800 border border-gray-700 rounded-full shadow px-2 py-0.5 flex gap-1 z-10 cursor-pointer`}>
                            {Object.entries(
                              msg.reactions.reduce((acc, r) => ({ ...acc, [r.reaction_emoji]: (acc[r.reaction_emoji] || 0) + 1 }), {})
                            ).map(([emoji, count]) => (
                              <span key={emoji} className="text-xs hover:bg-gray-700 rounded px-0.5" onClick={() => handleReact(msg.id, emoji)}>
                                {emoji}{count > 1 && ` ${count}`}
                              </span>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveReactionMessageId(activeReactionMessageId === msg.id ? null : msg.id); }}
                          className={`absolute top-1/2 -translate-y-1/2 ${isMine ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-violet-400 p-1`}
                        >
                          <FaSmile size={14} />
                        </button>

                        {activeReactionMessageId === msg.id && (
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 shadow-xl rounded-full px-3 py-2 flex gap-2 z-20">
                            {REACTION_EMOJIS.map(emoji => (
                              <button key={emoji} onClick={() => handleReact(msg.id, emoji)} className="hover:scale-125 transition-transform text-lg leading-none">{emoji}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 bg-gray-900 border-t border-gray-800 flex-shrink-0">
                <form onSubmit={sendMessage} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-sm transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="w-10 h-10 bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-lg shadow-violet-600/20"
                  >
                    <FaPaperPlane size={14} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <FaComments className="text-gray-700 text-5xl mb-4" />
              <p className="text-gray-400 font-medium">Select a conversation</p>
              <p className="text-gray-600 text-sm mt-1">Choose a match from the left to start chatting</p>
            </div>
          )}

          {selectedMatch && (
            <>
              <BlockModal show={showBlockModal} onClose={() => setShowBlockModal(false)} onBlock={handleBlockReportSuccess}
                blockedUser={getPartnerUser(selectedMatch) || { id: selectedMatch.user1_id === currentUserId ? selectedMatch.user2_id : selectedMatch.user1_id }} />
              <ReportModal show={showReportModal} onClose={() => setShowReportModal(false)} onReport={handleBlockReportSuccess}
                reportedUser={getPartnerUser(selectedMatch) || { id: selectedMatch.user1_id === currentUserId ? selectedMatch.user2_id : selectedMatch.user1_id }} />
              {showUnmatchConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                  <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
                    <FaHeartBroken className="text-pink-400 text-4xl mx-auto mb-4" />
                    <h3 className="text-white font-bold text-lg mb-2">Unmatch?</h3>
                    <p className="text-gray-400 text-sm mb-6">This will remove the match and all messages. This cannot be undone.</p>
                    <div className="flex gap-3">
                      <button onClick={() => setShowUnmatchConfirm(false)} className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-semibold transition-all text-sm">Cancel</button>
                      <button onClick={handleUnmatch} className="flex-1 px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-semibold transition-all text-sm">Unmatch</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default ChatPage;
