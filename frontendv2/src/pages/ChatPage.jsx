import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import { BlockModal, ReportModal } from '../components/BlockReportModals';
import { FaFlag, FaBan } from 'react-icons/fa';

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

  // Block/Report State
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const getToken = () => localStorage.getItem('token');

  // --- RESTORED/FIXED MISSING LOGIC ---
  const getPartnerUser = (match) => {
    if (!match || !currentUserId) return null;
    return match.user1_id === currentUserId ? match.user2 : match.user1;
  };

  const handleBlockReportSuccess = () => {
    // Remove the match from state and close modals
    setMatches(prev => prev.filter(m => m.id !== selectedMatch.id));
    setSelectedMatch(null);
    setShowBlockModal(false);
    setShowReportModal(false);
  };

  const getPartnerDetails = (match) => {
    if (!match || !currentUserId) return { name: 'Unknown', photo: null };
    const partner = getPartnerUser(match);

    if (!partner) {
        return { 
            name: `Match #${match.id}`, 
            photo: null,
            username: `user_${match.user1_id === currentUserId ? match.user2_id : match.user1_id}`
        };
    }

    const photoUrl = partner.photos && partner.photos.length > 0 ? partner.photos[0].photo_url : null;
    return {
        name: partner.username || `Match #${match.id}`,
        photo: photoUrl,
        username: partner.username
    };
  };

  // --- API CALLS ---
  const fetchCurrentUser = async () => {
      const token = getToken();
      if (!token) return;
      try {
          const res = await fetch(`${API_URL}/users/me`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
              const user = await res.json();
              setCurrentUserId(user.id);
          }
      } catch (e) { console.error(e); }
  };

  const fetchMatches = async () => {
    const token = getToken();
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/chat/matches`, {
            headers: { Authorization: `Bearer ${token}` }
        });
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
        const res = await fetch(`${API_URL}/chat/matches/${matchId}/messages?limit=100`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            const newMessages = data.reverse();
            setMessages(newMessages);
            const savedScroll = sessionStorage.getItem(`chatScroll_${matchId}`);
            if (savedScroll && scrollContainerRef.current) {
                setTimeout(() => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTop = parseInt(savedScroll, 10);
                    }
                }, 0);
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
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
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
          let res;
          if (trimmed.toLowerCase().startsWith('@username ')) {
              const username = trimmed.substring('@username '.length).trim();
              res = await fetch(`${API_URL}/chat/join-by-username`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ username })
              });
          } else {
              res = await fetch(`${API_URL}/chat/join`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ code: joinCode })
              });
          }
          if (res.ok) {
              const match = await res.json();
              setJoinCode('');
              fetchMatches();
              setSelectedMatch(match);
          }
      } catch (e) { console.error(e); }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = () => {
      if (!scrollContainerRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      if (selectedMatch) {
          sessionStorage.setItem(`chatScroll_${selectedMatch.id}`, scrollTop.toString());
      }
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
          const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
          setIsAutoScrollEnabled(isNearBottom);
          lastScrollTopRef.current = scrollTop;
      }, 1000);
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchMatches();
  }, []);

  useEffect(() => {
    if (selectedMatch) {
        sessionStorage.setItem('lastSelectedMatchId', selectedMatch.id.toString());
        fetchMessages(selectedMatch.id);
        const interval = setInterval(() => {
            const token = getToken();
            if(!token) return;
            fetch(`${API_URL}/chat/matches/${selectedMatch.id}/messages?limit=100`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                const newMsgs = data.reverse();
                setMessages(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(newMsgs)) {
                        if (isAutoScrollEnabled) setTimeout(scrollToBottom, 0);
                        return newMsgs;
                    }
                    return prev;
                });
            })
            .catch(console.error);
        }, 3000);
        return () => clearInterval(interval);
    }
  }, [selectedMatch, isAutoScrollEnabled]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="w-full bg-white shadow-sm p-4 flex justify-between items-center px-6">
        <h1 className="text-2xl font-bold text-rose-500">Chat</h1>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/matching')} className="px-4 py-2 bg-rose-500 text-white rounded hover:bg-rose-600">Find Matches</button>
          <button onClick={() => navigate('/profile')} className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50">Profile</button>
        </div>
      </div>
      <div className="flex flex-1 pt-2">
      {/* Sidebar */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Messages</h2>
            <form onSubmit={handleJoinChat} className="flex gap-2">
                <input type="text" placeholder="Enter @username [name]" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} className="flex-1 px-3 py-2 border rounded-md text-sm" />
                <button type="submit" className="bg-rose-500 text-white px-3 py-2 rounded-md text-sm hover:bg-rose-600">Join</button>
            </form>
        </div>
        <div className="flex-1 overflow-y-auto">
            {matches.map(match => {
                const partner = getPartnerDetails(match);
                return (
                <div key={match.id} onClick={() => setSelectedMatch(match)} className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${selectedMatch?.id === match.id ? 'bg-rose-50' : ''}`}>
                    <div className="flex items-center">
                        {partner.photo ? (
                             <img src={partner.photo} alt={partner.name} className="w-10 h-10 rounded-full mr-3 object-cover" />
                        ) : (
                             <div className="w-10 h-10 bg-gray-300 rounded-full mr-3 flex items-center justify-center text-gray-600 font-bold">
                                {partner.name.charAt(0).toUpperCase()}
                             </div>
                        )}
                        <div>
                            <p className="font-semibold text-gray-800">{partner.name}</p>
                            <p className="text-sm text-gray-500 truncate">Click to chat</p>
                        </div>
                    </div>
                </div>
                );
            })}
            {matches.length === 0 && <p className="p-4 text-center text-gray-500">No matches yet</p>}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedMatch ? (
            <>
                <div className="p-4 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between">
                    <div className="flex items-center">
                        {(() => {
                            const partner = getPartnerDetails(selectedMatch);
                            return (
                                <>
                                    {partner.photo ? (
                                        <img src={partner.photo} alt={partner.name} className="w-10 h-10 rounded-full mr-3 object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 bg-gray-300 rounded-full mr-3 flex items-center justify-center text-gray-600 font-bold">
                                            {partner.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <h3 className="text-lg font-bold text-gray-800">{partner.name}</h3>
                                </>
                            );
                        })()}
                    </div>
                    {/* RESTORED Safety UI Buttons */}
                    <div className="flex gap-4">
                        <button onClick={() => setShowReportModal(true)} className="text-gray-400 hover:text-amber-500 transition-colors"><FaFlag /></button>
                        <button onClick={() => setShowBlockModal(true)} className="text-gray-400 hover:text-red-500 transition-colors"><FaBan /></button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollContainerRef} onScroll={handleScroll}>
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs px-4 py-2 rounded-lg ${msg.sender_id === currentUserId ? 'bg-rose-500 text-white' : 'bg-white text-gray-800 shadow-sm'}`}>
                                <p>{msg.message_text}</p>
                                <span className={`text-xs block mt-1 text-right ${msg.sender_id === currentUserId ? 'text-rose-100' : 'text-gray-400'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 bg-white border-t border-gray-200">
                    <form onSubmit={sendMessage} className="flex gap-2">
                        <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type a message..." className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-rose-500" />
                        <button type="submit" disabled={!inputText.trim()} className="bg-rose-500 text-white px-6 py-2 rounded-full font-semibold hover:bg-rose-600 disabled:opacity-50">Send</button>
                    </form>
                </div>
            </>
        ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400"><p>Select a match to start chatting</p></div>
        )}
        
        {/* Modals placed correctly within logic */}
        {selectedMatch && (
            <>
                <BlockModal 
                    show={showBlockModal}
                    onClose={() => setShowBlockModal(false)}
                    onBlock={handleBlockReportSuccess}
                    blockedUser={getPartnerUser(selectedMatch) || { id: selectedMatch.user1_id === currentUserId ? selectedMatch.user2_id : selectedMatch.user1_id }}
                />
                <ReportModal
                    show={showReportModal}
                    onClose={() => setShowReportModal(false)}
                    onReport={handleBlockReportSuccess}
                    reportedUser={getPartnerUser(selectedMatch) || { id: selectedMatch.user1_id === currentUserId ? selectedMatch.user2_id : selectedMatch.user1_id }}
                />
            </>
        )}
      </div>
      </div>
    </div>
  );
};

export default ChatPage;