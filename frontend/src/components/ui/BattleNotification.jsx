import React from 'react';
import { Clock } from 'lucide-react';

const BattleNotification = ({ serverState }) => {
  // Définir les messages en fonction du state
  const getStatusMessage = () => {
    switch(serverState) {
      case 'select_final_team_step':
        return {
          title: "Team Selection",
          message: "AI trainers are building their teams..."
        };
      case 'select_pokemon_in_game_step':
        return {
          title: "Battle Preparation",
          message: "AI trainers are choosing their active Pokémon..."
        };
      default:
        return {
          title: "Battle Status",
          message: "Battle in progress..."
        };
    }
  };

  const { title, message } = getStatusMessage();
  
  return (
    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none">
      <div className="relative max-w-sm w-full">
        {/* Metallic border effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 rounded-lg opacity-20" />
        
        <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg py-1.5 px-3
                      border border-gray-500/30
                      animate-fade-in transition-all duration-300">
          <div className="flex items-center gap-1.5">
            <div className="flex-shrink-0">
              <Clock size={12} className="text-blue-300 animate-pulse" />
            </div>
            <div className="flex flex-col gap-0">
              <h3 className="text-white/90 text-sm font-semibold tracking-wide">
                {title}
              </h3>
              <span className="text-blue-100/80 text-sm font-medium tracking-wide leading-tight">
                {message}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BattleNotification; 