import React, { useState, useEffect, useRef } from 'react';

/**
 * Component to display chat messages as a chatbox overlay on the game screen
 * Shows messages from both players in a single chat container
 * Only visible when hovering over the component area
 */
const MessageOverlay = ({ chatLog = [], battleData, parentIsHovering = false }) => {
  // State to track messages and the chatbox visibility
  const [messages, setMessages] = useState([]);
  const [localIsHovering, setLocalIsHovering] = useState(false);
  const [playerNames, setPlayerNames] = useState({
    player1: 'Player 1',
    player2: 'Player 2'
  });
  
  // Refs for the last seen message index
  const lastSeenIndexRef = useRef({ player1: -1, player2: -1 });
  
  // Ref for the chat container to auto-scroll
  const chatContainerRef = useRef(null);

  // Combined hover state - true if either parent is being hovered or this component is being hovered
  const isHovering = parentIsHovering || localIsHovering;

  // Set player names from battle data
  useEffect(() => {
    if (battleData?.models) {
      setPlayerNames({
        player1: battleData.modelDisplayNames?.player1 || battleData.models.player1 || 'Player 1',
        player2: battleData.modelDisplayNames?.player2 || battleData.models.player2 || 'Player 2'
      });
    }
  }, [battleData]);

  // Handle mouse enter/leave events for the message container itself
  const handleMouseEnter = () => setLocalIsHovering(true);
  const handleMouseLeave = () => setLocalIsHovering(false);

  // Effect to process new messages
  useEffect(() => {
    // Process messages from both players
    const processMessages = () => {
      let hasNewMessages = false;
      const newMessages = [];
      
      // Process player 1 messages
      const player1Messages = chatLog.filter(entry => entry.playerNum === 1 && entry.chatMessage);
      if (player1Messages.length > 0 && lastSeenIndexRef.current.player1 < player1Messages.length - 1) {
        const latestP1Message = player1Messages[player1Messages.length - 1];
        lastSeenIndexRef.current.player1 = player1Messages.length - 1;
        
        if (latestP1Message.chatMessage) {
          newMessages.push({
            playerNum: 1,
            message: latestP1Message.chatMessage,
            timestamp: new Date().toISOString()
          });
          hasNewMessages = true;
        }
      }
      
      // Process player 2 messages
      const player2Messages = chatLog.filter(entry => entry.playerNum === 2 && entry.chatMessage);
      if (player2Messages.length > 0 && lastSeenIndexRef.current.player2 < player2Messages.length - 1) {
        const latestP2Message = player2Messages[player2Messages.length - 1];
        lastSeenIndexRef.current.player2 = player2Messages.length - 1;
        
        if (latestP2Message.chatMessage) {
          newMessages.push({
            playerNum: 2,
            message: latestP2Message.chatMessage,
            timestamp: new Date().toISOString()
          });
          hasNewMessages = true;
        }
      }
      
      // If we have new messages, add them to state
      if (hasNewMessages) {
        setMessages(prev => [...prev, ...newMessages]);
      }
    };
    
    processMessages();
  }, [chatLog]);

  // Auto-scroll to the bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current && messages.length > 0) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Keep only the last few messages to avoid cluttering the UI
  const recentMessages = messages;

  // Determine if we should render at all - only if we have messages
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-x-0 top-4 z-30 flex justify-center">
      <div 
        className={`w-full max-w-md mx-4 transition-opacity duration-300 ${isHovering ? 'opacity-100' : 'opacity-0'}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-gray-700 overflow-hidden">
          {/* Chat messages container */}
          <div 
            ref={chatContainerRef}
            className="p-2 max-h-40 overflow-y-auto custom-scrollbar"
          >
            {recentMessages.map((msg, index) => (
              <div 
                key={`${msg.timestamp}-${index}`} 
                className={`flex mb-1 ${msg.playerNum === 1 ? 'justify-start' : 'justify-end'}`}
              >
                <div 
                  className={`px-2 py-1 rounded-lg max-w-[240px] text-xs ${
                    msg.playerNum === 1 
                      ? 'bg-blue-900/80 text-white border border-blue-500/50 rounded-tl-none' 
                      : 'bg-red-900/80 text-white border border-red-500/50 rounded-tr-none'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageOverlay; 
