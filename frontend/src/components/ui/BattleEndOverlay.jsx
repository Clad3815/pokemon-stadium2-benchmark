import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Trophy, AlertCircle, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Team Display component showing just Pokémon sprites
const TeamDisplay = React.memo(({ team, playerColor, winnerColor }) => {
  if (!team || team.length === 0) return null;
  
  // For blue player, reverse the team order
  const displayTeam = playerColor === 'blue' ? [...team].reverse() : team;
  
  // Check if this team belongs to the winner
  const isWinningTeam = playerColor === winnerColor;
  
  return (
    <div className={`team-sprites-container ${playerColor}-team mt-2`}>
      <div className="flex justify-center gap-1 items-end">
        {displayTeam.map((pokemon, index) => {
          // Check if this is the first Pokemon in original team
          const isFirstPokemon = playerColor === 'blue' 
            ? index === displayTeam.length - 1 
            : index === 0;
            
          // Size classes based on winning team and first Pokémon
          let sizeClass = '';
          if (isWinningTeam) {
            sizeClass = isFirstPokemon ? 'h-24 md:h-32' : 'h-16 md:h-24';
          } else {
            sizeClass = isFirstPokemon ? 'h-20 md:h-24' : 'h-12 md:h-18';
            sizeClass += ' filter grayscale-[50%] brightness-60 saturate-40';
          }
            
          return (
            <div 
              key={index} 
              className="pokemon-sprite-wrapper flex items-center justify-center"
            >
              <div className={`flex items-center justify-center ${sizeClass}`}>
                <img 
                  src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${pokemon.id}.gif`} 
                  alt={pokemon.name || `Pokemon #${pokemon.id}`}
                  className={`h-full w-auto object-contain ${playerColor === 'blue' ? 'filter-blue-tint scale-x-[-1]' : 'filter-red-tint'}`}
                  loading="lazy"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// HP Chart Component
const HPChart = React.memo(({ data, player1Model, player2Model }) => {
  return (
    <div className="hp-chart-container p-2 bg-black/30 rounded-lg border border-yellow-500/20 h-full">
      <h3 className="text-center text-sm md:text-base font-bold mb-1 text-yellow-300">HP Evolution</h3>
      <div className="w-full h-[calc(100%-24px)]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 2, right: 20, left: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="turn" stroke="#f8fafc" />
            <YAxis 
              stroke="#f8fafc" 
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#f8fafc'
              }}
              formatter={(value, name) => [`${value}%`, name]}
              labelFormatter={(label) => `Turn: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="blueHP"
              name={player1Model.name}
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 3, strokeWidth: 2, fill: '#3b82f6' }}
              activeDot={{ r: 5, strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="redHP"
              name={player2Model.name}
              stroke="#ef4444"
              strokeWidth={3}
              dot={{ r: 3, strokeWidth: 2, fill: '#ef4444' }}
              activeDot={{ r: 5, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

// Player Display component for both winner and loser
const BattleResultDisplay = React.memo(({ winnerColor, blueMessage, redMessage, blueTeam, redTeam, winner, player1Model, player2Model }) => {
  // Keep track of whether animation has been played
  const animationPlayed = useRef(false);
  const [showAnimation, setShowAnimation] = useState(false);
  
  // Run animation only once when component mounts
  useEffect(() => {
    if (!animationPlayed.current) {
      setShowAnimation(true);
      animationPlayed.current = true;
    }
  }, []);

  // Configure player sprite information
  const bluePlayer = {
    name: player1Model.name,
    sprite: "https://play.pokemonshowdown.com/sprites/trainers/blue-gen2.png",
    isWinner: winnerColor === 'blue'
  };

  const redPlayer = {
    name: player2Model.name,
    sprite: "https://play.pokemonshowdown.com/sprites/trainers/red-gen2.png",
    isWinner: winnerColor === 'red'
  };
  
  return (
    <div className="flex flex-col items-center justify-center w-full">
      {/* Players container - flex row on desktop, column on mobile */}
      <div className="flex flex-col md:flex-row items-center justify-center w-full gap-6 md:gap-16 lg:gap-24">
        {/* Blue player (left) section */}
        <div className={`flex-1 flex flex-col items-center ${showAnimation ? 'animate-fade-in' : ''}`}
             style={{ animationDelay: '200ms' }}>
          {/* Winner/Loser label */}
          {bluePlayer.isWinner ? (
            <div className="bg-yellow-500 text-black font-bold py-1.5 px-6 rounded-full mb-3 flex items-center">
              <Trophy size={18} className="mr-2" />
              <span className="text-lg">{bluePlayer.name}</span>
            </div>
          ) : (
            <div className="bg-gray-700 text-white font-bold py-1.5 px-6 rounded-full mb-3 flex items-center">
              <AlertCircle size={18} className="mr-2" />
              <span className="text-lg">{bluePlayer.name}</span>
            </div>
          )}
          
          {/* Message bubble */}
          <div className={`message-bubble-wrapper mb-4 w-full max-w-sm ${showAnimation ? 'animate-fade-in' : ''}`} 
               style={{ animationDelay: '400ms' }}>
            <div className={`relative p-5 rounded-lg
              ${bluePlayer.isWinner
                ? 'bg-blue-800/95 text-blue-50'
                : 'bg-gray-700/95 text-gray-200'
              }`}
            >
              {/* Triangle pointer */}
              <div className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 
                border-l-[10px] border-r-[10px] border-t-[10px] border-b-0
                ${bluePlayer.isWinner
                  ? 'border-l-transparent border-r-transparent border-t-blue-800/95'
                  : 'border-l-transparent border-r-transparent border-t-gray-700/95'
                }`}>
              </div>

              <p className="text-lg md:text-xl font-bold text-center leading-relaxed tracking-wide whitespace-pre-wrap">
                {blueMessage}
              </p>
            </div>
          </div>

          {/* Sprite */}
          <div className={`trainer-sprite relative ${bluePlayer.isWinner ? 'transform translate-y-[-25px]' : ''} ${showAnimation ? 'animate-fade-in' : ''}`}
               style={{ animationDelay: '600ms', zIndex: bluePlayer.isWinner ? 2 : 1 }}>
            <div className="relative">
              {/* Elliptical shadow with glow effect */}
              <div className={`absolute top-16 left-1/2 transform -translate-x-1/2 scale-y-50
                w-36 h-36 rounded-full 
                ${bluePlayer.isWinner 
                  ? 'bg-blue-900/30 border-4 border-blue-900/50 shadow-lg shadow-blue-500/30' 
                  : 'bg-gray-900/30 border-4 border-gray-800/40'}`}>
              </div>
              
              {/* Trainer image */}
              <div className="relative rounded-full p-3 shadow-lg bg-gradient-to-b from-transparent to-black/10">
                <img
                  src={bluePlayer.sprite}
                  alt={bluePlayer.name}
                  className={`w-36 h-36 object-contain ${!bluePlayer.isWinner ? 'filter grayscale-[10%] brightness-60 saturate-10' : 'filter brightness-125 contrast-110'}`}
                />
              </div>
            </div>
          </div>
          
          {/* Blue Team */}
          <TeamDisplay team={blueTeam} playerColor="blue" winnerColor={winnerColor} />
        </div>

        {/* VS divider - now always visible */}
        <div className="flex flex-col items-center justify-center my-2 md:my-0">
          <div className="text-yellow-500 text-3xl md:text-5xl font-extrabold my-4 px-3 py-1 rounded-full border-2 border-yellow-500/30 bg-black/30">VS</div>
        </div>
        
        {/* Red player (right) section */}
        <div className={`flex-1 flex flex-col items-center ${showAnimation ? 'animate-fade-in' : ''}`}
             style={{ animationDelay: '800ms', opacity: redPlayer.isWinner ? 1 : 0.8 }}>
          {/* Winner/Loser label */}
          {redPlayer.isWinner ? (
            <div className="bg-yellow-500 text-black font-bold py-1.5 px-6 rounded-full mb-3 flex items-center">
              <Trophy size={18} className="mr-2" />
              <span className="text-lg">{redPlayer.name}</span>
            </div>
          ) : (
            <div className="bg-gray-700 text-white font-bold py-1.5 px-6 rounded-full mb-3 flex items-center">
              <AlertCircle size={18} className="mr-2" />
              <span className="text-lg">{redPlayer.name}</span>
            </div>
          )}
          
          {/* Message bubble */}
          <div className={`message-bubble-wrapper mb-4 w-full max-w-sm ${showAnimation ? 'animate-fade-in' : ''}`} 
               style={{ animationDelay: '1000ms' }}>
            <div className={`relative p-5 rounded-lg
              ${redPlayer.isWinner
                ? 'bg-red-800/95 text-red-50'
                : 'bg-gray-700/95 text-gray-200'
              }`}
            >
              {/* Triangle pointer */}
              <div className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 
                border-l-[10px] border-r-[10px] border-t-[10px] border-b-0
                ${redPlayer.isWinner
                  ? 'border-l-transparent border-r-transparent border-t-red-800/95'
                  : 'border-l-transparent border-r-transparent border-t-gray-700/95'
                }`}>
              </div>

              <p className="text-lg md:text-xl font-bold text-center leading-relaxed tracking-wide whitespace-pre-wrap">
                {redMessage}
              </p>
            </div>
          </div>

          {/* Sprite */}
          <div className={`trainer-sprite relative ${redPlayer.isWinner ? 'transform translate-y-[-25px]' : ''} ${showAnimation ? 'animate-fade-in' : ''}`}
               style={{ animationDelay: '1200ms', zIndex: redPlayer.isWinner ? 2 : 1 }}>
            <div className="relative">
              {/* Elliptical shadow */}
              <div className={`absolute top-16 left-1/2 transform -translate-x-1/2 scale-y-50
                w-36 h-36 rounded-full 
                ${redPlayer.isWinner 
                  ? 'bg-red-900/30 border-4 border-red-900/50 shadow-lg shadow-red-500/30'
                  : 'bg-gray-900/30 border-4 border-gray-800/40'}`}>
              </div>
              
              {/* Trainer image - always flipped for Red */}
              <div className="relative rounded-full p-3 shadow-lg bg-gradient-to-b from-transparent to-black/10">
                <img
                  src={redPlayer.sprite}
                  alt={redPlayer.name}
                  className={`w-36 h-36 object-contain scale-x-[-1] ${!redPlayer.isWinner ? 'filter grayscale-[10%] brightness-60 saturate-10' : 'filter brightness-125 contrast-110'}`}
                />
              </div>
            </div>
          </div>
          
          {/* Red Team */}
          <TeamDisplay team={redTeam} playerColor="red" winnerColor={winnerColor} />
        </div>
      </div>
    </div>
  );
});

const BattleEndOverlay = ({ 
  ias, 
  onClose,
  setShowStartOverlay,
  endGameData,
  serverState
}) => {
  // State to track current round index - initialize to the last round
  const rounds = useMemo(() => {
    if (endGameData && Array.isArray(endGameData) && endGameData.length > 0) {
      return endGameData;
    }
    
    // Fallback to default data with 3 rounds if no real data is available
    return [
      {
        battleResult: {
          winnerColor: 'red',
          blueMessage: "My strategy was perfect for round 1!",
          redMessage: "First round is mine!",
          blueTeam: [
            { name: "Bulbasaur", id: 1 },
            { name: "Ivysaur", id: 2 },
            { name: "Venusaur", id: 3 }
          ],
          redTeam: [
            { name: "Charmander", id: 4 },
            { name: "Charmeleon", id: 5 },
            { name: "Charizard", id: 6 }
          ]
        },
        battleStats: {
          winner: "red",
          player1Model: "openai/gpt-4o-mini",
          player2Model: "anthropic/claude-3-5-haiku-latest"
        },
        hpEvolutionData: [
          { turn: 1, blueHP: 100, redHP: 100 },
          { turn: 2, blueHP: 90, redHP: 85 },
          { turn: 3, blueHP: 80, redHP: 75 },
          { turn: 4, blueHP: 65, redHP: 60 },
          { turn: 5, blueHP: 55, redHP: 40 },
          { turn: 6, blueHP: 40, redHP: 25 },
          { turn: 7, blueHP: 35, redHP: 15 },
          { turn: 8, blueHP: 25, redHP: 0 }
        ]
      },
      {
        battleResult: {
          winnerColor: 'blue',
          blueMessage: "Round 2 is mine! Comeback time!",
          redMessage: "You got lucky this round...",
          blueTeam: [
            { name: "Squirtle", id: 7 },
            { name: "Wartortle", id: 8 },
            { name: "Blastoise", id: 9 }
          ],
          redTeam: [
            { name: "Pikachu", id: 25 },
            { name: "Raichu", id: 26 },
            { name: "Jolteon", id: 135 }
          ]
        },
        battleStats: {
          winner: "blue",
          player1Model: "openai/gpt-4o-mini",
          player2Model: "anthropic/claude-3-5-haiku-latest"
        },
        hpEvolutionData: [
          { turn: 1, blueHP: 100, redHP: 100 },
          { turn: 2, blueHP: 85, redHP: 90 },
          { turn: 3, blueHP: 80, redHP: 70 },
          { turn: 4, blueHP: 70, redHP: 50 },
          { turn: 5, blueHP: 65, redHP: 30 },
          { turn: 6, blueHP: 55, redHP: 10 },
          { turn: 7, blueHP: 50, redHP: 0 }
        ]
      },
      {
        battleResult: {
          winnerColor: 'blue',
          blueMessage: "Final round victory! I'm the champion!",
          redMessage: "You won this time, but I'll be back!",
          blueTeam: [
            { name: "Mewtwo", id: 150 },
            { name: "Dragonite", id: 149 },
            { name: "Gyarados", id: 130 }
          ],
          redTeam: [
            { name: "Arcanine", id: 59 },
            { name: "Alakazam", id: 65 },
            { name: "Gengar", id: 94 }
          ]
        },
        battleStats: {
          winner: "blue",
          player1Model: "openai/gpt-4o-mini",
          player2Model: "anthropic/claude-3-5-haiku-latest"
        },
        hpEvolutionData: [
          { turn: 1, blueHP: 100, redHP: 100 },
          { turn: 2, blueHP: 95, redHP: 80 },
          { turn: 3, blueHP: 85, redHP: 65 },
          { turn: 4, blueHP: 70, redHP: 45 },
          { turn: 5, blueHP: 60, redHP: 30 },
          { turn: 6, blueHP: 45, redHP: 10 },
          { turn: 7, blueHP: 40, redHP: 0 }
        ]
      }
    ];
  }, [endGameData]);

  // Set initial round to the last round
  const [currentRoundIndex, setCurrentRoundIndex] = useState(() => rounds.length - 1);
  
  // Get current round data
  const currentRound = rounds[currentRoundIndex];
  
  // Extract battle data from current round
  const battleResult = currentRound.battleResult;
  const battleStats = currentRound.battleStats;
  const hpEvolutionData = currentRound.hpEvolutionData;

  const player1ModelData = {
    ...(ias?.[battleStats.player1Model] || {}),
    name: battleStats.player1ModelDisplayName
      || ias?.[battleStats.player1Model]?.name
      || battleStats.player1Model
      || 'Player 1'
  };

  const player2ModelData = {
    ...(ias?.[battleStats.player2Model] || {}),
    name: battleStats.player2ModelDisplayName
      || ias?.[battleStats.player2Model]?.name
      || battleStats.player2Model
      || 'Player 2'
  };
  
  // Navigation functions
  const goToPrevRound = () => {
    if (currentRoundIndex > 0) {
      setCurrentRoundIndex(currentRoundIndex - 1);
    }
  };
  
  const goToNextRound = () => {
    if (currentRoundIndex < rounds.length - 1) {
      setCurrentRoundIndex(currentRoundIndex + 1);
    }
  };
  
  // Function to show the start overlay
  const handleShowStartOverlay = () => {
    // Close the end overlay first
    onClose();
    
    // Show the start overlay
    if (setShowStartOverlay) {
      setShowStartOverlay(true);
    }
  };
  
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className="h-full w-full max-w-7xl flex flex-col items-center justify-between">
        {/* Header with title - at the top */}
        <div className="text-center mb-2 pt-4">
          <h1 className="text-3xl md:text-5xl font-extrabold title-shadow mb-2">
            <span className="text-white">Battle</span>
            <span className="text-yellow-300"> Finished!</span>
          </h1>
          <div className="w-full max-w-lg mx-auto h-px bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent"></div>
        </div>
        
        {/* Round navigation - only show if there's more than one round */}
        {rounds.length > 1 && (
          <div className="flex items-center justify-center mb-2 gap-4">
            <button 
              className={`p-2 rounded-full ${currentRoundIndex > 0 ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30' : 'bg-gray-700/20 text-gray-500 cursor-not-allowed'}`}
              onClick={goToPrevRound}
              disabled={currentRoundIndex === 0}
            >
              <ChevronLeft size={24} />
            </button>
            
            <div className="text-xl font-bold text-yellow-300">
              Round {currentRoundIndex + 1} of {rounds.length}
            </div>
            
            <button 
              className={`p-2 rounded-full ${currentRoundIndex < rounds.length - 1 ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30' : 'bg-gray-700/20 text-gray-500 cursor-not-allowed'}`}
              onClick={goToNextRound}
              disabled={currentRoundIndex === rounds.length - 1}
            >
              <ChevronRight size={24} />
            </button>
          </div>
        )}
        
        {/* Action Buttons - maintenant placé sous la navigation des rounds */}
        <div className="flex justify-center gap-4 mb-2 flex-shrink-0">
          {serverState === 'starting_next_round' ? (
            <div className="flex flex-col items-center justify-center py-2 px-6">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-400 mb-2"></div>
              <p className="text-yellow-300 text-lg font-medium">Next round starting soon...</p>
            </div>
          ) : (
            <button 
              className="button-primary bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center gap-2 py-2 px-6 text-xl rounded-full hover:shadow-lg hover:shadow-yellow-500/20 transition-all duration-300"
              onClick={handleShowStartOverlay}
            >
              <Play size={24} /> 
              Start New Battle
            </button>
          )}
        </div>
        
        {/* Battle result display section - Prend l'espace disponible restant avec proportions flexibles */}
        <div className="flex-1 w-full flex items-center justify-center px-4 min-h-0">
          <BattleResultDisplay 
            winnerColor={battleResult.winnerColor}
            winner={battleStats.winner}
            blueMessage={battleResult.blueMessage} 
            redMessage={battleResult.redMessage}
            blueTeam={battleResult.blueTeam}
            redTeam={battleResult.redTeam}
            player1Model={player1ModelData}
            player2Model={player2ModelData}
          />
        </div>
        
        {/* HP Chart Section - hauteur adaptative */}
        <div className="w-full max-w-5xl px-4 mb-2 flex-shrink-0" style={{ height: "22vh", minHeight: "160px", maxHeight: "220px" }}>
          <HPChart data={hpEvolutionData} player1Model={player1ModelData} player2Model={player2ModelData} />
        </div>
      </div>
    </div>
  );
};

export default BattleEndOverlay; 
