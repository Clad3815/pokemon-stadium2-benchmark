import React, { useState, useEffect } from 'react';
import { Play, ChevronDown, Award, Shield, Swords, Monitor, MonitorPlay, Settings, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReasoningEffortModal from './ReasoningEffortModal';

const BattleStartOverlay = ({ 
  ias, 
  selectedIA1, 
  setSelectedIA1, 
  selectedIA2, 
  setSelectedIA2,
  selectedIA1ReasoningEffort,
  selectedIA2ReasoningEffort,
  setSelectedIA1ReasoningEffort,
  setSelectedIA2ReasoningEffort,
  battleFormat,
  setBattleFormat,
  startBenchmark,
  battleType,
  setBattleType,
  onClose,
  screenSharing
}) => {
  // États locaux pour les sélections d'IA
  const [localSelectedIA1, setLocalSelectedIA1] = useState(selectedIA1);
  const [localSelectedIA2, setLocalSelectedIA2] = useState(selectedIA2);
  const [localSelectedIA1ReasoningEffort, setLocalSelectedIA1ReasoningEffort] = useState(selectedIA1ReasoningEffort || null);
  const [localSelectedIA2ReasoningEffort, setLocalSelectedIA2ReasoningEffort] = useState(selectedIA2ReasoningEffort || null);
  const [localBattleFormat, setLocalBattleFormat] = useState(battleFormat);
  const [localBattleType, setLocalBattleType] = useState(battleType);
  
  const [player1MenuOpen, setPlayer1MenuOpen] = useState(false);
  const [player2MenuOpen, setPlayer2MenuOpen] = useState(false);
  const [reasoningModalState, setReasoningModalState] = useState({
    isOpen: false,
    player: null,
    modelKey: null
  });
  const navigate = useNavigate();

  useEffect(() => {
    setLocalSelectedIA1(selectedIA1);
    setLocalSelectedIA2(selectedIA2);
    setLocalSelectedIA1ReasoningEffort(selectedIA1ReasoningEffort || null);
    setLocalSelectedIA2ReasoningEffort(selectedIA2ReasoningEffort || null);
    setLocalBattleFormat(battleFormat);
    setLocalBattleType(battleType);
  }, [
    selectedIA1,
    selectedIA2,
    selectedIA1ReasoningEffort,
    selectedIA2ReasoningEffort,
    battleFormat,
    battleType
  ]);

  // Utiliser le partage d'écran centralisé
  const {
    isSharing,
    sharingError,
    startScreenShare,
    stopScreenShare
  } = screenSharing;
  
  // Fonction pour démarrer une nouvelle partie avec les IA sélectionnées localement
  const handleStartBattle = () => {
    // Mettre à jour les états globaux avec les sélections locales
    setSelectedIA1(localSelectedIA1);
    setSelectedIA2(localSelectedIA2);
    setSelectedIA1ReasoningEffort(localSelectedIA1ReasoningEffort);
    setSelectedIA2ReasoningEffort(localSelectedIA2ReasoningEffort);
    setBattleFormat(localBattleFormat);
    setBattleType(localBattleType);
    // Démarrer la partie en passant directement les IA sélectionnées localement et le format de bataille
    startBenchmark(
      localSelectedIA1,
      localSelectedIA2,
      localBattleFormat,
      localBattleType,
      localSelectedIA1ReasoningEffort,
      localSelectedIA2ReasoningEffort
    );
    // Fermer l'overlay
    onClose();
  };

  // Fonction pour gérer le partage d'écran
  const handleScreenShare = async () => {
    if (isSharing) {
      stopScreenShare();
    } else {
      await startScreenShare();
    }
  };

  const getModelDisplayName = (modelKey, reasoningEffort = null) => {
    const baseName = ias?.[modelKey]?.name || modelKey || 'Select AI';
    return reasoningEffort ? `${baseName} (${reasoningEffort})` : baseName;
  };

  const setLocalPlayerModel = (player, modelKey, reasoningEffort = null) => {
    if (player === 1) {
      setLocalSelectedIA1(modelKey);
      setLocalSelectedIA1ReasoningEffort(reasoningEffort);
      setPlayer1MenuOpen(false);
      return;
    }

    setLocalSelectedIA2(modelKey);
    setLocalSelectedIA2ReasoningEffort(reasoningEffort);
    setPlayer2MenuOpen(false);
  };

  const handleModelSelection = (player, modelKey) => {
    const modelData = ias?.[modelKey];
    const hasReasoningLevels = Array.isArray(modelData?.reasoningLevels) && modelData.reasoningLevels.length > 0;

    if (hasReasoningLevels) {
      if (player === 1) {
        setPlayer1MenuOpen(false);
      } else {
        setPlayer2MenuOpen(false);
      }
      setReasoningModalState({
        isOpen: true,
        player,
        modelKey
      });
      return;
    }

    setLocalPlayerModel(player, modelKey, null);
  };

  const closeReasoningModal = () => {
    setReasoningModalState({
      isOpen: false,
      player: null,
      modelKey: null
    });
  };

  const handleReasoningEffortSelection = (reasoningEffort) => {
    const player = reasoningModalState.player;
    const modelKey = reasoningModalState.modelKey;

    if (!player || !modelKey) {
      closeReasoningModal();
      return;
    }

    setLocalPlayerModel(player, modelKey, reasoningEffort);
    closeReasoningModal();
  };
  
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-4xl  rounded-3xl p-8 m-6 animate-fade-in">
        {/* Header with title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-5xl font-extrabold title-shadow mb-3">
            <span className="text-white">Pokémon</span>
            <span className="text-yellow-300"> Stadium AI</span>
          </h1>
          <p className="text-white text-lg opacity-80 max-w-3xl mx-auto">
            Select AI engines and battle format to begin
          </p>
        </div>
        
        {/* Trainer Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Player 1 Selection */}
          <div className="player-selection">
            <div className="flex items-center mb-3">
              <div className="player-badge player-badge-blue">
                <span>Player 1</span>
              </div>
            </div>
            
            <div className="relative">
              <button 
                className="ai-selector-button bg-blue-700 hover:bg-blue-600 transition-all text-white w-full py-3 px-5 rounded-lg flex justify-between items-center"
                onClick={() => setPlayer1MenuOpen(!player1MenuOpen)}
              >
                <div className="flex items-center">
                  <div className="pokeball-avatar blue mr-3 w-6 h-6">
                    <div className="center-circle"></div>
                  </div>
                  <span className="font-medium">{getModelDisplayName(localSelectedIA1, localSelectedIA1ReasoningEffort)}</span>
                </div>
                <ChevronDown size={18} className={`transition-transform ${player1MenuOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {player1MenuOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-blue-800 rounded-lg z-20 max-h-48 overflow-y-auto custom-scrollbar">
                  {Object.entries(ias).map(([key, ia]) => (
                    <button
                      key={key}
                      className={`w-full text-left px-5 py-2 hover:bg-blue-700 transition-colors text-white flex items-center
                        ${localSelectedIA1 === key ? 'bg-blue-600' : ''}`}
                      onClick={() => handleModelSelection(1, key)}
                    >
                      <div className="pokeball-avatar blue mr-3 w-6 h-6">
                        <div className="center-circle"></div>
                      </div>
                      {ia.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Player 2 Selection */}
          <div className="player-selection">
            <div className="flex items-center mb-3">
              <div className="player-badge player-badge-red">
                <span>Player 2</span>
              </div>
            </div>
            
            <div className="relative">
              <button 
                className="ai-selector-button bg-red-700 hover:bg-red-600 transition-all text-white w-full py-3 px-5 rounded-lg flex justify-between items-center"
                onClick={() => setPlayer2MenuOpen(!player2MenuOpen)}
              >
                <div className="flex items-center">
                  <div className="pokeball-avatar red mr-3 w-6 h-6">
                    <div className="center-circle"></div>
                  </div>
                  <span className="font-medium">{getModelDisplayName(localSelectedIA2, localSelectedIA2ReasoningEffort)}</span>
                </div>
                <ChevronDown size={18} className={`transition-transform ${player2MenuOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {player2MenuOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-red-800 rounded-lg z-20 max-h-48 overflow-y-auto custom-scrollbar">
                  {Object.entries(ias).map(([key, ia]) => (
                    <button
                      key={key}
                      className={`w-full text-left px-5 py-2 hover:bg-red-700 transition-colors text-white flex items-center
                        ${localSelectedIA2 === key ? 'bg-red-600' : ''}`}
                      onClick={() => handleModelSelection(2, key)}
                    >
                      <div className="pokeball-avatar red mr-3 w-6 h-6">
                        <div className="center-circle"></div>
                      </div>
                      {ia.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Battle Format Selection */}
        <div className="mb-8">
          <h2 className="text-white text-xl font-bold text-center mb-4">Battle Format</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
            <button 
              className={`
                flex flex-col items-center justify-center p-4 rounded-lg
                border transition-all duration-300
                ${localBattleFormat === 'single' 
                  ? 'bg-slate-700/70 border-yellow-400/70' 
                  : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/70'
                }
              `}
              onClick={() => setLocalBattleFormat('single')}
            >
              <Swords size={24} className={`mb-2 ${localBattleFormat === 'single' ? 'text-yellow-400' : 'text-slate-400'}`} />
              <span className="font-bold text-white">Single Battle</span>
              <span className="text-xs text-slate-300 text-center">One decisive match</span>
            </button>
            
            <button 
              className={`
                flex flex-col items-center justify-center p-4 rounded-lg
                border transition-all duration-300
                ${localBattleFormat === 'best3' 
                  ? 'bg-slate-700/70 border-blue-400/70' 
                  : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/70'
                }
              `}
              onClick={() => setLocalBattleFormat('best3')}
            >
              <Shield size={24} className={`mb-2 ${localBattleFormat === 'best3' ? 'text-blue-400' : 'text-slate-400'}`} />
              <span className="font-bold text-white">Best-of-3</span>
              <span className="text-xs text-slate-300 text-center">First to 2 wins</span>
            </button>
            
            <button 
              className={`
                flex flex-col items-center justify-center p-4 rounded-lg
                border transition-all duration-300
                ${localBattleFormat === 'best5' 
                  ? 'bg-slate-700/70 border-purple-400/70' 
                  : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/70'
                }
              `}
              onClick={() => setLocalBattleFormat('best5')}
            >
              <Award size={24} className={`mb-2 ${localBattleFormat === 'best5' ? 'text-purple-400' : 'text-slate-400'}`} />
              <span className="font-bold text-white">Best-of-5</span>
              <span className="text-xs text-slate-300 text-center">First to 3 wins</span>
            </button>
          </div>
        </div>
        
        {/* Battle Type Selection */}
        <div className="mb-8">
          <h2 className="text-white text-xl font-bold text-center mb-4">Team Size</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl mx-auto">
            <button 
              className={`
                flex flex-col items-center justify-center p-4 rounded-lg
                border transition-all duration-300
                ${localBattleType === '3vs3' 
                  ? 'bg-slate-700/70 border-emerald-400/70' 
                  : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/70'
                }
              `}
              onClick={() => setLocalBattleType('3vs3')}
            >
              <div className="flex items-center gap-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              </div>
              <span className="font-bold text-white">3 vs 3</span>
              <span className="text-xs text-slate-300 text-center">Quick battles</span>
            </button>
            
            <button 
              className={`
                flex flex-col items-center justify-center p-4 rounded-lg
                border transition-all duration-300
                ${localBattleType === '6vs6' 
                  ? 'bg-slate-700/70 border-emerald-400/70' 
                  : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/70'
                }
              `}
              onClick={() => setLocalBattleType('6vs6')}
            >
              <div className="flex items-center gap-1 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              </div>
              <span className="font-bold text-white">6 vs 6</span>
              <span className="text-xs text-slate-300 text-center">Full team battles</span>
            </button>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col items-center gap-4">
          <button 
            className="button-primary bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center gap-2 py-3 px-6 text-lg"
            onClick={handleStartBattle}
            disabled={!localSelectedIA1 || !localSelectedIA2}
          >
            <Play size={20} /> 
            Start Battle
          </button>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-600/60 bg-slate-700/60 px-5 py-2.5 text-sm font-medium text-slate-200 transition-all duration-200 hover:bg-slate-600/70"
              onClick={() => navigate('/models-admin')}
              type="button"
            >
              <Settings size={16} />
              Manage Models
            </button>
            <button
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-600/60 bg-slate-700/60 px-5 py-2.5 text-sm font-medium text-slate-200 transition-all duration-200 hover:bg-slate-600/70"
              onClick={() => navigate('/statistics')}
              type="button"
            >
              <BarChart3 size={16} />
              Statistics
            </button>
          </div>
          
          {/* Screen Sharing Button */}
          <div className="flex flex-col items-center gap-2">
            <button 
              className={`
                flex items-center justify-center gap-2 py-2.5 px-5 text-sm rounded-lg font-medium
                transition-all duration-200 border
                ${isSharing 
                  ? 'bg-green-600/80 border-green-500/50 text-white hover:bg-green-500/80' 
                  : 'bg-slate-700/60 border-slate-600/50 text-slate-200 hover:bg-slate-600/70'
                }
              `}
              onClick={handleScreenShare}
            >
              {isSharing ? (
                <>
                  <MonitorPlay size={16} />
                  Screen Shared ✓
                </>
              ) : (
                <>
                  <Monitor size={16} />
                  Share Game Screen
                </>
              )}
            </button>
            
            {sharingError && (
              <p className="text-red-400 text-xs text-center max-w-xs">
                {sharingError}
              </p>
            )}
            
            {isSharing && (
              <p className="text-green-400 text-xs text-center">
                Screen sharing is ready for battle
              </p>
            )}
          </div>
        </div>
      </div>

      <ReasoningEffortModal
        isOpen={reasoningModalState.isOpen}
        modelName={reasoningModalState.modelKey ? (ias?.[reasoningModalState.modelKey]?.name || reasoningModalState.modelKey) : 'Model'}
        reasoningLevels={reasoningModalState.modelKey ? (ias?.[reasoningModalState.modelKey]?.reasoningLevels || []) : []}
        onSelect={handleReasoningEffortSelection}
        onClose={closeReasoningModal}
      />
    </div>
  );
};

export default BattleStartOverlay; 
