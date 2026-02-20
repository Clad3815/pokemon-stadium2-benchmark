import React, { useState, useEffect } from 'react';
import MessageOverlay from './MessageOverlay';
import { Trophy, Shield, Swords } from 'lucide-react';

const ScreenShare = ({ chatLog, battleData, battleFormat, screenSharing }) => {
  const [fillMode, setFillMode] = useState('cover');
  const [zoomLevel, setZoomLevel] = useState(1.1);
  const [isHovering, setIsHovering] = useState(false);
  
  const {
    isSharing,
    sharingError,
    videoRef,
    startScreenShare,
    stopScreenShare
  } = screenSharing;

  // Afficher les contrôles brièvement au démarrage du partage
  useEffect(() => {
    if (isSharing) {
      setIsHovering(true);
      const timer = setTimeout(() => {
        setIsHovering(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSharing]);

  const toggleFillMode = () => {
    setFillMode(prev => prev === 'contain' ? 'cover' : 'contain');
  };

  const increaseZoom = () => {
    setZoomLevel(prev => Math.min(prev + 0.1, 1.5));
  };

  const decreaseZoom = () => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.8));
  };

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);

  // Obtenir l'icône et le texte pour le format de bataille
  const getBattleFormatDisplay = () => {
    switch(battleFormat) {
      case 'best3':
        return { 
          icon: <Shield size={16} className="text-blue-400 mr-1" />, 
          text: 'Best of 3', 
          color: 'bg-blue-500 text-blue-300' 
        };
      case 'best5':
        return { 
          icon: <Trophy size={16} className="text-purple-400 mr-1" />, 
          text: 'Best of 5', 
          color: 'bg-purple-500 text-purple-300' 
        };
      case 'single':
      default:
        return { 
          icon: <Swords size={16} className="text-yellow-400 mr-1" />, 
          text: 'Single Match', 
          color: 'bg-yellow-500 text-yellow-300' 
        };
    }
  };

  const formatDisplay = getBattleFormatDisplay();

  const resetSharing = () => {
    stopScreenShare();
    setTimeout(() => {
      startScreenShare();
    }, 500);
  };

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-lg flex flex-col">
      {isSharing ? (
        // Mode partage d'écran actif
        <div 
          className="relative flex-grow flex flex-col"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Conteneur vidéo simplifié avec overflow hidden pour empêcher le débordement */}
          <div className="relative flex-grow bg-black overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-${fillMode}`}
              style={{ 
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center'
              }}
            />
            
            {/* Overlay de messages */}
            {chatLog && chatLog.length > 0 && (
              <MessageOverlay 
                chatLog={chatLog} 
                battleData={battleData} 
                parentIsHovering={isHovering}
                className="absolute inset-0 pointer-events-none"
              />
            )}
          </div>

          {/* Barre de contrôle */}
          <div 
            className={`absolute bottom-0 left-0 right-0 p-4 transition-opacity duration-300 ${
              isHovering ? 'opacity-100' : 'opacity-0'
            } bg-gradient-to-t from-black/80 via-black/50 to-transparent`}
          >
            <div className="flex justify-between items-center">
              {/* Badge de format */}
              <div className={`px-3 py-1.5 rounded-lg flex items-center text-xs font-medium`}>
                {formatDisplay.icon}
                <span >{formatDisplay.text}</span>
              </div>

              {/* Contrôles */}
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 bg-slate-800/90 rounded-lg p-1">
                  <button
                    onClick={decreaseZoom}
                    className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                    title="Zoom out"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <button
                    onClick={increaseZoom}
                    className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                    title="Zoom in"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    onClick={toggleFillMode}
                    className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                    title={fillMode === 'contain' ? "Fit to window" : "Show entire screen"}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                        fillMode === 'contain' 
                          ? "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" 
                          : "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
                      } />
                    </svg>
                  </button>
                  <button
                    onClick={resetSharing}
                    className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                    title="Reset view"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={stopScreenShare}
                  className="py-1.5 px-2.5 bg-red-600 hover:bg-red-500 rounded-lg transition-colors flex items-center space-x-1.5 text-xs"
                  title="Stop sharing"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Stop</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Mode sans partage d'écran
        <div className="flex-grow flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full space-y-6">
            {sharingError ? (
              <div className="text-red-400 bg-red-900/20 p-4 rounded-lg">
                <div className="font-bold mb-1">Error</div>
                {sharingError}
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <img 
                    src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png" 
                    alt="Pikachu" 
                    className="w-24 h-24 mx-auto" 
                  />
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-2">Share your Pokémon Stadium game window</h2>
                    <p className="text-slate-400 text-sm">Click the button below to select the window you want to share</p>
                  </div>
                </div>

                <div className="space-y-4">

                  <button
                    onClick={startScreenShare}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-blue-500/25"
                  >
                    <svg 
                      className="w-6 h-6" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="font-medium text-lg">Select Game Window</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreenShare;