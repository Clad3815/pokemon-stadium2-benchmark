import React from 'react';
import TypeBadge from './TypeBadge';
import './PokemonCard.css';

// Définition des mappages partagés
const STATUS_MAP = {
  0: { name: 'Normal', className: 'status-normal' },
  1: { name: 'Asleep', className: 'status-asleep' },
  2: { name: 'Asleep', className: 'status-asleep' },
  3: { name: 'Asleep', className: 'status-asleep' },
  8: { name: 'Poisoned', className: 'status-poisoned' },
  16: { name: 'Burned', className: 'status-burned' },
  32: { name: 'Frozen', className: 'status-frozen' },
  64: { name: 'Paralyzed', className: 'status-paralyzed' },
};

// Moves mapping commun
const MOVE_NAMES = {
  5: 'MegaPunch',
  9: 'ThunderPunch',
  12: 'Guillotine',
  17: 'Wing Attack',
  23: 'Stomp',
  36: 'Take Down',
  43: 'Leer',
  48: 'Supersonic',
  57: 'Surf',
  58: 'Ice Beam',
  63: 'Hyper Beam',
  70: 'Strength',
  73: 'LeechSeed',
  76: 'SolarBeam',
  77: 'PoisonPowder',
  83: 'Fire Spin',
  85: 'Thunderbolt',
  86: 'ThunderWave',
  87: 'Thunder',
  91: 'Dig',
  92: 'Toxic',
  94: 'Psychic',
  95: 'Hypnosis',
  101: 'Night Shade',
  104: 'Double Team',
  106: 'Harden',
  109: 'Confuse Ray',
  120: 'Barrier',
  124: 'SelfDestruct',
  126: 'Fire Blast',
  128: 'Clamp',
  129: 'Swift',
  131: 'Spike Cannon',
  152: 'Crabhammer',
  163: 'Slash',
  164: 'Substitute',
};

// Composant pour la barre de HP
const HPBar = ({ current, max }) => {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  const barColor = 
    percentage > 50 ? 'health-bar-fill-high' :
    percentage > 20 ? 'health-bar-fill-medium' :
    'health-bar-fill-low';
    
  return (
    <div className="health-bar">
      <div 
        className={`health-bar-fill ${barColor}`} 
        style={{ width: `${percentage}%` }} 
      />
    </div>
  );
};

// Récupérer les données de Pokémon depuis le cache
const getPokemonDataFromCache = (id, pokeApiCache) => {
  if (!pokeApiCache?.pokemon?.[id]) return null;
  return pokeApiCache.pokemon[id];
};

// Composant compact simplifié pour l'affichage en liste
export const PokemonCompact = React.memo(({ pokemon, onClick, isActive, pokeApiCache }) => {
  if (!pokemon) return null;
  
  // Handle both data formats (old and API)
  const isPokemonAPIFormat = pokemon.hasOwnProperty('currentHP') && pokemon.hasOwnProperty('maxHP');
  
  const id = pokemon.id;
  const cachedData = getPokemonDataFromCache(id, pokeApiCache);
  
  // Récupérer le nom du Pokémon
  let nom = isPokemonAPIFormat ? `Pokemon #${id}` : pokemon.nom || 'Pokemon';
  if (cachedData?.name) {
    nom = cachedData.name;
  }
  
  const pv = isPokemonAPIFormat ? pokemon.currentHP : pokemon.pv || 0;
  const pvMax = isPokemonAPIFormat ? pokemon.maxHP : pokemon.pvMax || 100;
  
  // Handle types
  let types = isPokemonAPIFormat ? pokemon.types || [] : [pokemon.type];
  if (cachedData?.types && (!types || types.length === 0)) {
    types = cachedData.types;
  }
  
  // Status handling
  const status = isPokemonAPIFormat ? pokemon.status : 0;
  const statusInfo = STATUS_MAP[status] || STATUS_MAP[0];
  
  // Calculate HP percentage
  const hpPercentage = Math.max(0, Math.min(100, Math.floor((pv / pvMax) * 100)));
  
  // Determine HP bar color
  const getHpBarColor = () => {
    if (hpPercentage > 50) return 'bg-green-500';
    if (hpPercentage > 20) return 'bg-orange-500';
    return 'bg-red-500';
  };
  
  return (
    <div 
      className={`w-full h-full bg-slate-800/80 backdrop-blur-sm rounded-lg  transition-all duration-200
        ${isActive ? 'ring-1 ring-slate-600' : ''} overflow-hidden flex flex-col`}
      onClick={onClick ? () => onClick(pokemon) : undefined}
    >
      {/* Header with name and ID */}
      <div className="flex items-center justify-between bg-slate-700/40 px-2 py-0.5">
        <h3 className="text-white text-xs font-medium truncate max-w-[75%] capitalize">{nom}</h3>
        <span className="text-sm text-slate-300">#{id}</span>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col p-2">
        {/* Image and types container */}
        <div className="relative flex justify-center mb-2">
          {/* Types badges - positioned top left */}
          <div className="absolute top-0 left-0 z-10 flex flex-col gap-1">
            {Array.isArray(types) && types.length > 0 ? (
              types.slice(0, 2).map((type, index) => (
                <TypeBadge key={index} type={type} size="xs" />
              ))
            ) : (
              <TypeBadge type={types} size="xs" />
            )}
          </div>
          
          {/* Status Badge - positioned top right */}
          {statusInfo.name !== 'Normal' && (
            <div className="absolute top-0 right-0 z-10">
              <span className={`text-xs px-1 py-0.5 rounded-sm ${statusInfo.className}`}>
                {statusInfo.name}
              </span>
            </div>
          )}
          
          {/* Pokemon image */}
          <div className="w-16 h-16 flex items-center justify-center">
            <img 
              src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`} 
              alt={nom} 
              className="w-12 h-12 object-contain" 
              loading="lazy"
              onError={(e) => {
                e.target.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
              }}
            />
          </div>
        </div>
        
        {/* HP Bar section */}
        <div className="mt-auto w-full">
          <div className="flex justify-between items-center text-sm mb-1">
            <span className="text-slate-400">HP</span>
            <span className={`${hpPercentage > 50 ? 'text-green-400' : hpPercentage > 20 ? 'text-orange-400' : 'text-red-400'}`}>
              {pv}/{pvMax}
            </span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
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

// Récupérer les noms des attaques depuis le cache PokeAPI si disponible
const getMoveNameFromCache = (moveId, pokeApiCache) => {
  if (pokeApiCache?.moves?.[moveId]?.name) {
    return pokeApiCache.moves[moveId].name;
  }
  
  // Fallback à la map de noms d'attaques commune
  return MOVE_NAMES[moveId] || `Move #${moveId}`;
};

// Composant principal simplifié
export const PokemonDetailed = React.memo(({ pokemon, isSelected = false, pokeApiCache }) => {
  if (!pokemon) return null;
  
  // Handle both data formats (old and API)
  const isPokemonAPIFormat = pokemon.hasOwnProperty('currentHP') && pokemon.hasOwnProperty('maxHP');
  
  const id = pokemon.id;
  const cachedData = getPokemonDataFromCache(id, pokeApiCache);
  
  // Récupérer les données de base
  let nom = isPokemonAPIFormat ? `Pokemon #${id}` : pokemon.nom || `Pokemon #${id}`;
  if (cachedData?.name) {
    nom = cachedData.name;
  }
  
  const lvl = isPokemonAPIFormat ? pokemon.level || 50 : pokemon.lvl || 50;
  const pv = isPokemonAPIFormat ? pokemon.currentHP : pokemon.pv || 0;
  const pvMax = isPokemonAPIFormat ? pokemon.maxHP : pokemon.pvMax || 100;
  
  // Handle types
  let types = isPokemonAPIFormat ? pokemon.types || [] : [pokemon.type];
  if (cachedData?.types && (!types || types.length === 0)) {
    types = cachedData.types;
  }
  
  // Status handling
  const status = isPokemonAPIFormat ? pokemon.status : 0;
  const statusInfo = STATUS_MAP[status] || STATUS_MAP[0];
  
  // Moves handling - Nouveau format: tableau d'objets {id, name, description, currentPP}
  const moves = Array.isArray(pokemon.moves) ? pokemon.moves : [];
  
  // Stats - Nouveau format API
  const stats = {
    attack: pokemon.attack,
    defense: pokemon.defense,
    speed: pokemon.speed,
    specialAttack: pokemon.specialAttack,
    specialDefense: pokemon.specialDefense
  };
  
  return (
    <div className={`pokemon-card detailed ${isSelected ? 'border-2 border-yellow-400' : 'border border-slate-700'}`}>
      <div className="p-4">
        {/* En-tête avec nom, niveau et statut */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="text-white text-lg font-bold truncate">{nom}</h3>
            <div className="flex items-center mt-1 gap-2">
              <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded-full text-slate-300">
                Lvl.{lvl}
              </span>
              <span className={`status-badge ${statusInfo.className}`}>
                {statusInfo.name}
              </span>
            </div>
          </div>
          <span className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
            #{id}
          </span>
        </div>
        
        {/* Section principale avec image et info */}
        <div className="flex gap-4">
          {/* Image container avec taille fixe */}
          <div className="w-24 h-24 flex-shrink-0 bg-slate-800/50 rounded-lg overflow-hidden flex items-center justify-center">
            <img 
              src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`} 
              alt={nom}
              className="w-full h-full object-contain p-1"
              loading="lazy"
              onError={(e) => {
                e.target.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
              }}
            />
          </div>
          
          {/* Informations de base */}
          <div className="flex-1 min-w-0">
            {/* Types */}
            <div className="flex flex-wrap gap-1 mb-2">
              {types && types.length > 0 ? (
                types.map((type, index) => (
                  <TypeBadge key={index} type={type} pokeApiCache={pokeApiCache} />
                ))
              ) : (
                <span className="text-xs text-slate-400">No type</span>
              )}
            </div>
            
            {/* HP Bar */}
            <div className="mb-3">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-medium text-slate-300">HP</span>
                <span className={`font-medium ${pv / pvMax > 0.5 ? 'text-green-400' : pv / pvMax > 0.2 ? 'text-orange-400' : 'text-red-400'}`}>
                  {pv}/{pvMax}
                </span>
              </div>
              <HPBar current={pv} max={pvMax} />
            </div>
            
            {/* Stats de base */}
            {Object.keys(stats).some(key => stats[key] !== undefined) && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
                {stats.attack !== undefined && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">ATK</span>
                    <span className="text-white font-medium">{stats.attack}</span>
                  </div>
                )}
                {stats.defense !== undefined && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">DEF</span>
                    <span className="text-white font-medium">{stats.defense}</span>
                  </div>
                )}
                {stats.speed !== undefined && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">SPD</span>
                    <span className="text-white font-medium">{stats.speed}</span>
                  </div>
                )}
                {stats.specialAttack !== undefined && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">SP.ATK</span>
                    <span className="text-white font-medium">{stats.specialAttack}</span>
                  </div>
                )}
                {stats.specialDefense !== undefined && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">SP.DEF</span>
                    <span className="text-white font-medium">{stats.specialDefense}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Moves section */}
        {moves.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm text-slate-300 font-bold mb-2 uppercase tracking-wide">Moves</h4>
            <div className="bg-slate-800/50 rounded-md overflow-hidden">
              {moves.map((move, index) => (
                <div 
                  key={index} 
                  className={`p-2 ${index < moves.length - 1 ? 'border-b border-slate-700/30' : ''}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <h5 className="text-white font-bold text-sm">{move.name}</h5>
                    <span className="text-xs px-1.5 py-0.5 bg-slate-700 rounded text-blue-300 font-medium">
                      PP: {move.currentPP}
                    </span>
                  </div>
                  
                  {move.description && (
                    <p className="text-xs text-slate-400 leading-snug">
                      {move.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// Composant pour afficher un Pokémon banni
export const PokemonBanned = React.memo(({ pokemon, pokeApiCache }) => {
  if (!pokemon) return null;
  
  // Récupérer l'ID du Pokémon (dans cette version, pokemon peut être directement l'ID)
  const id = typeof pokemon === 'number' ? pokemon : pokemon.id;
  const cachedData = getPokemonDataFromCache(id, pokeApiCache);
  
  // Récupérer le nom du Pokémon
  let nom = `Pokemon #${id}`;
  if (cachedData?.name) {
    nom = cachedData.name;
  }
  
  // Récupérer les types du Pokémon depuis le cache
  let types = [];
  if (cachedData?.types) {
    types = cachedData.types;
  }
  
  return (
    <div className="w-full h-full bg-slate-800/80 backdrop-blur-sm rounded-lg  transition-all duration-200 overflow-hidden border border-red-800/30">
      <div className="p-2 flex items-center">
        {/* Icône du Pokémon avec badge banned */}
        <div className="w-10 h-10 flex-shrink-0 rounded-md flex items-center justify-center mr-3 relative">
          <img 
            src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`} 
            alt={nom}
            className="grayscale opacity-60 w-8 h-8 object-contain" 
            loading="lazy"
          />
        </div>
        
        {/* Nom du Pokémon */}
        <div className="min-w-0 flex-1">
          <div className="flex justify-between items-center">
            <h3 className="text-white text-xs font-medium truncate capitalize">{nom}</h3>
            <span className="text-sm text-slate-400 ml-1">#{id}</span>
          </div>
          
          {/* Types */}
          {types && types.length > 0 && (
            <div className="flex gap-1 mt-1">
              {types.slice(0, 2).map((type, index) => (
                <TypeBadge key={index} type={type} size="xs" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default PokemonDetailed; 