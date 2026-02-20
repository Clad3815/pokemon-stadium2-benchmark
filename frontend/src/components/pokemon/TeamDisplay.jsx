import React, { useState, useCallback } from 'react';
import { PokemonDetailed } from './PokemonCard';
import TypeBadge from './TypeBadge';

// Composant compact pour l'affichage des Pokémon dans la section "Current Team"
const PokemonCurrentTeam = React.memo(({ pokemon, isSelected = false, pokeApiCache, isCompactMode = false }) => {
  if (!pokemon) return null;
  
  // Handle both data formats (old and API)
  const isPokemonAPIFormat = pokemon.hasOwnProperty('currentHP') && pokemon.hasOwnProperty('maxHP');
  
  const id = pokemon.id;
  
  // Récupérer le nom du Pokémon depuis le cache PokeAPI si disponible
  let nom = pokemon.name || pokemon.nom || `Pokemon #${id}`;
  if (pokeApiCache?.pokemon?.[id]?.name) {
    nom = pokeApiCache.pokemon[id].name;
  }
  
  const pv = isPokemonAPIFormat ? pokemon.currentHP : pokemon.pv || 0;
  const pvMax = isPokemonAPIFormat ? pokemon.maxHP : pokemon.pvMax || 100;
  
  // Handle types
  let types = isPokemonAPIFormat ? pokemon.types || [] : [pokemon.type];
  
  // Status mapping with colors
  const statusMap = {
    0: { name: 'Normal', color: 'bg-gray-600' },
    1: { name: 'Asleep', color: 'bg-indigo-500' },
    2: { name: 'Asleep', color: 'bg-indigo-500' },
    3: { name: 'Asleep', color: 'bg-indigo-500' },
    8: { name: 'Poisoned', color: 'bg-purple-600' },
    16: { name: 'Burned', color: 'bg-red-600' },
    32: { name: 'Frozen', color: 'bg-blue-400 text-slate-800' },
    64: { name: 'Paralyzed', color: 'bg-yellow-500 text-slate-800' },
  };

  const statusInfo = statusMap[pokemon.status] || { name: 'Normal', color: 'bg-gray-600' };
  
  // Calculate HP percentage for color visual cue
  const hpPercentage = Math.max(0, Math.min(100, Math.floor((pv / pvMax) * 100)));
  
  // Check if Pokémon is knocked out (KO)
  const isKnockedOut = pv <= 0;
  
  // Determine HP color based on percentage for the bar
  const getHpBarColor = () => {
    if (hpPercentage > 50) return 'bg-green-500';
    if (hpPercentage > 20) return 'bg-orange-500';
    return 'bg-red-500';
  };
  
  // Format HP text with appropriate color
  const hpText = `${pv}/${pvMax}`;
  const hpTextColor = isKnockedOut ? 'text-red-500' : hpPercentage > 50 ? 'text-green-400' : hpPercentage > 20 ? 'text-orange-400' : 'text-red-400';
  
  return (
    <div 
      className={`flex flex-col rounded-lg border border-slate-700/30 transition-all duration-200 h-full ${isSelected ? 'ring-1 ring-blue-500' : ''} ${isKnockedOut ? 'grayscale filter brightness-75' : ''}`}
    >
      {/* En-tête avec nom et ID */}
      <div className="flex items-center justify-between px-2 py-0.5">
        <h3 className="text-white text-xs font-medium truncate max-w-[75%] capitalize">{nom}</h3>
        <span className="text-sm text-slate-300 font-medium">#{id}</span>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col justify-between p-1">
        {/* Image section with types and status badges */}
        <div className={`relative flex justify-center items-center mb-0 overflow-visible ${isCompactMode ? 'h-12' : 'h-20'}`}>
          {/* Types badges - positioned top left */}
          <div className="absolute top-0 left-0 z-30 flex flex-col gap-1">
            {Array.isArray(types) && types.length > 0 ? (
              types.slice(0, 2).map((type, index) => (
                <TypeBadge key={index} type={type} size="xs" pokeApiCache={pokeApiCache} />
              ))
            ) : (
              <TypeBadge type={types} size="xs" pokeApiCache={pokeApiCache} />
            )}
          </div>
          
          {/* Status badge - on top right corner of image */}
          {statusInfo.name !== 'Normal' && (
            <div className="absolute top-0 right-0 z-30">
              <span className={`px-1 py-0.5 rounded-md ${statusInfo.color} text-xs font-medium flex items-center justify-center`}>
                {statusInfo.name}
              </span>
            </div>
          )}
          
          {/* Pokemon image - centered using flexbox */}
          <div className="z-20 flex items-center justify-center w-full h-full">
            <img 
              src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`}
              alt={nom} 
              className={`w-auto h-auto max-h-[${isCompactMode ? '60' : '90'}px] ${isCompactMode ? 'scale-100' : 'scale-125'} object-contain transition-all duration-200 ${isKnockedOut ? 'opacity-40 grayscale filter blur-[0.3px]' : ''}`}
              loading="lazy"
              style={{ transform: `translateY(${isCompactMode ? '0' : '10'}%)` }}
            />
          </div>
        </div>
        
        {/* HP section - toujours en bas */}
        <div className="w-full mt-0 z-10">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-300 font-medium">HP</span>
            <span className={`text-sm ${hpTextColor} font-medium`}>{hpText}</span>
          </div>
          
          {/* HP Bar */}
          <div className="h-2 rounded-full overflow-hidden mt-0.5 bg-slate-700">
            <div 
              className={`h-full ${getHpBarColor()} transition-all duration-300`} 
              style={{ width: `${hpPercentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

const TeamDisplay = ({ team, battleData }) => {
  // État pour suivre le Pokémon sélectionné
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  
  // Récupérer le cache PokeAPI depuis battleData
  const pokeApiCache = battleData?.pokeApi?.cache;

  // Récupération des données de l'équipe
  const getTeamData = useCallback(() => {
    // New API data format
    if (battleData) {
      return battleData.team || [];
    }
    
    // Previous data format fallback
    // Si l'équipe actuelle est vide, afficher tous les Pokémon
    if (!team.current || team.current.length === 0) {
      return team.chosen || [];
    }
    return team.current || [];
  }, [team, battleData]);

  const teamData = getTeamData();

  // Helper function to check if a Pokemon is currently in the battle
  const isInBattle = useCallback((pokemonId) => {
    if (!battleData?.team) return false;
    // battleData.activePokemon = id du pokemon actif (id du pokedex)
    return battleData.activePokemon === pokemonId;
  }, [battleData]);

  // Fonction pour gérer la sélection d'un Pokémon
  const handlePokemonClick = useCallback((pokemon) => {
    if (selectedPokemon && selectedPokemon.id === pokemon.id) {
      setSelectedPokemon(null); // Désélectionner si même Pokémon cliqué
    } else {
      setSelectedPokemon(pokemon); // Sélectionner le Pokémon cliqué
    }
  }, [selectedPokemon]);

  // Déterminer si on doit utiliser le mode compact (pour plus de 3 Pokémon)
  const isCompactMode = teamData.length > 3;
  
  // Déterminer le nombre de colonnes en fonction du nombre de Pokémon
  const getGridColumns = () => {
    if (teamData.length <= 3) return 'grid-cols-3';
    if (teamData.length <= 6) return 'grid-cols-3';
    return 'grid-cols-3'; // Fallback pour plus de 6 Pokémon
  };

  // Déterminer la hauteur maximale du conteneur
  const getContainerClasses = () => {
    if (teamData.length <= 3) return 'h-full';
    if (teamData.length <= 6) return 'max-h-full'; // Plus compact pour éviter le scroll
    return 'max-h-full';
  };

  // Rendu pour l'état vide
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center p-4">
      <svg className="w-8 h-8 mb-2 text-slate-500 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"></path>
      </svg>
      <p className="text-sm">NO ACTIVE POKÉMON</p>
    </div>
  );

  return (
    <div className="flex flex-col w-full h-full rounded-lg">


      {/* Contenu principal - flex-1 fait croître cette section pour remplir l'espace disponible */}
      <div className="flex-1 backdrop-blur-sm overflow-hidden">
        <div className={getContainerClasses()}>
          {teamData.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className={`${getGridColumns()} ${isCompactMode ? 'grid-rows-2' : ''} grid gap-2 p-2 h-full`}>
              {[...teamData].sort((a, b) => {
                // Vérifier si les Pokémon sont KO (0 HP)
                const aKO = a.currentHP <= 0;
                const bKO = b.currentHP <= 0;
                
                // Si l'un est KO et l'autre non, le KO va à la fin
                if (aKO && !bKO) return 1;
                if (!aKO && bKO) return -1;
                
                // Si les deux sont KO ou aucun n'est KO, on regarde si l'un est en combat
                if (isInBattle(a.id)) return -1;
                if (isInBattle(b.id)) return 1;
                
                return 0;
              }).map((pokemon, index) => (
                <div
                  key={`current-${pokemon.id}-${index}`}
                  className="cursor-pointer transition-transform duration-200 h-full"
                  onClick={() => handlePokemonClick(pokemon)}
                >
                  <PokemonCurrentTeam 
                    pokemon={pokemon} 
                    isSelected={isInBattle(pokemon.id)}
                    pokeApiCache={pokeApiCache}
                    isCompactMode={isCompactMode}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Affichage détaillé si un Pokémon est sélectionné */}
      {selectedPokemon && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div 
            className="rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold text-lg">Pokémon Details</h3>
                <button 
                  className="text-slate-400 hover:text-white rounded-full p-1 transition-colors" 
                  onClick={() => setSelectedPokemon(null)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              <PokemonDetailed 
                pokemon={selectedPokemon} 
                isSelected={true}
                pokeApiCache={pokeApiCache}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(TeamDisplay);