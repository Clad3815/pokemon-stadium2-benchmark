import React from 'react';
import { Loader2 } from 'lucide-react';

const BattleStatusOverlay = ({ 
  serverState,
  onClose
}) => {
  // Définir les messages en fonction du state
  const getStatusMessage = () => {
    switch(serverState) {
      case 'starting_next_round':
        return {
          title: "Preparing Next Round",
          message: "The next round is being prepared. Please wait..."
        };
      case 'banning_step':
        return {
          title: "Pokémon Banning Phase",
          message: "AI trainers are deciding which Pokémon to ban from the battle."
        };
      case 'select_team_step':
        return {
          title: "Team Selection Phase",
          message: "AI trainers are selecting their battle teams."
        };
      default:
        return {
          title: "Processing",
          message: "Please wait while the game is processing..."
        };
    }
  };

  const { title, message } = getStatusMessage();
  
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md  rounded-3xl p-8 animate-fade-in text-center">
        {/* Spinner animation */}
        <div className="mb-6 flex justify-center">
          <Loader2 size={48} className="text-yellow-300 animate-spin" />
        </div>
        
        {/* Status message */}
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">{title}</h2>
        <p className="text-white/80 text-lg mb-6">{message}</p>
        
        {/* Optional close button - only if onClose is provided */}
        {onClose && (
          <button 
            onClick={onClose}
            className="text-white/60 hover:text-white text-sm transition-colors underline"
          >
            Dismiss message
          </button>
        )}
      </div>
    </div>
  );
};

export default BattleStatusOverlay; 