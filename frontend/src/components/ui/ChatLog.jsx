import React, { useState, useRef, useEffect, useCallback } from 'react';
import TypeBadge from '../pokemon/TypeBadge';
import { Brain } from 'lucide-react';

// ThinkingView component - displayed during thinking state
const ThinkingView = React.memo(({ playerColor = 'blue', playerName = "AI" }) => {
  const colorClass = playerColor === 'blue' ? 'text-blue-400' : 'text-red-400';
  const flipClass = playerColor === 'blue' ? 'scale-x-[-1]' : ''; // Inverser horizontalement pour le joueur 1 (bleu)

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      <div className={`thinking-pokemon mb-4 ${colorClass}`}>
        {/* Dessin stylisé d'un Pokémon (Psyduck) */}
        <div className="w-48 h-48 mx-auto relative">
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/54.png"
            alt="Thinking Pokémon"
            className={`w-full h-full object-contain transform ${flipClass}`}
          />

          {/* Question marks spinning around Psyduck */}
          <div className="absolute top-0 right-1 w-8 h-8 animate-question-spin-1">
            <span className={`text-lg font-bold ${colorClass}`}>?</span>
          </div>
          <div className="absolute bottom-6 right-0 w-8 h-8 animate-question-spin-2">
            <span className={`text-lg font-bold ${colorClass}`}>?</span>
          </div>
          <div className="absolute top-8 left-0 w-8 h-8 animate-question-spin-3">
            <span className={`text-lg font-bold ${colorClass}`}>?</span>
          </div>
        </div>
      </div>

      {/* New layout as requested */}
      <div className={`text-xl font-bold ${colorClass} mb-2 tracking-wider text-center`}>
        Thinking
      </div>

      <div className="text-slate-400 text-sm text-center mb-2">
        <span className="font-bold">{playerName}</span>
      </div>

      <div className="text-slate-400 text-sm text-center mb-4">
        is analysing the situation...
      </div>

      {/* Dots at the bottom */}
      <div className="inline-flex items-center">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-white mr-1.5 animate-pulse"></span>
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-white mr-1.5 animate-pulse" style={{ animationDelay: '0.2s' }}></span>
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.4s' }}></span>
      </div>
    </div>
  );
});

// ChatMessageBubble Component - Restructured to mirror ThinkingView pattern
const ChatMessageBubble = React.memo(({ entry, playerColor = 'blue', onAnimationComplete }) => {
  const [animationState, setAnimationState] = useState('entering'); // 'entering', 'visible', 'exiting'
  const [displayedText, setDisplayedText] = useState(''); // For typewriter effect
  const timersRef = useRef({});

  // Determine which trainer sprite to use based on player color
  const trainerSprite = playerColor === 'blue'
    ? "https://play.pokemonshowdown.com/sprites/trainers/blue-gen2.png"
    : "https://play.pokemonshowdown.com/sprites/trainers/red-gen2.png";

  // Set up animation sequence
  useEffect(() => {
    // First show the bubble
    setAnimationState('entering');
    setDisplayedText(''); // Reset displayed text for typewriter effect

    // After a short delay, set to fully visible
    timersRef.current.visibleTimer = setTimeout(() => {
      setAnimationState('visible');

      // Start exit animation after display time
      timersRef.current.exitTimer = setTimeout(() => {
        setAnimationState('exiting');

        // Call completion callback after exit animation
        timersRef.current.completeTimer = setTimeout(() => {
          if (onAnimationComplete) {
            onAnimationComplete();
          }
        }, 600); // Match the duration of the exit transition

      }, 5000); // Visible duration - increased for better readability
    }, 600);

    // Cleanup timers
    return () => {
      clearTimeout(timersRef.current.visibleTimer);
      clearTimeout(timersRef.current.exitTimer);
      clearTimeout(timersRef.current.completeTimer);
      clearTimeout(timersRef.current.typewriterTimer);
    };
  }, [onAnimationComplete]);

  // Typewriter effect
  useEffect(() => {
    if (animationState === 'visible' && entry?.chatMessage) {
      // Clear any existing typewriter timer
      if (timersRef.current.typewriterTimer) {
        clearTimeout(timersRef.current.typewriterTimer);
      }

      // Start with empty string
      setDisplayedText('');

      // Gradually reveal the message character by character
      const fullMessage = entry.chatMessage;
      let currentIndex = 0;

      const typeNextChar = () => {
        if (currentIndex <= fullMessage.length) {
          setDisplayedText(fullMessage.substring(0, currentIndex));
          currentIndex++;

          // Speed of typing - adjust as needed (lower = faster)
          const typingSpeed = 8;

          // Schedule next character
          timersRef.current.typewriterTimer = setTimeout(typeNextChar, typingSpeed);
        }
      };

      // Start the typing effect
      typeNextChar();
    }

    return () => {
      if (timersRef.current.typewriterTimer) {
        clearTimeout(timersRef.current.typewriterTimer);
      }
    };
  }, [animationState, entry?.chatMessage]);

  // Dynamically set transition classes based on animation state
  const containerClasses = {
    entering: 'opacity-0',
    visible: 'opacity-100',
    exiting: 'opacity-0'
  };

  const trainerClasses = {
    entering: 'opacity-0 translate-y-12 scale-95',
    visible: 'opacity-100 translate-y-0 scale-100',
    exiting: 'opacity-0 translate-y-8 scale-95'
  };

  const bubbleClasses = {
    entering: 'opacity-0 translate-y-6 scale-95',
    visible: 'opacity-100 translate-y-0 scale-100',
    exiting: 'opacity-0 -translate-y-6 scale-95'
  };

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-6 transition-all duration-500 ${containerClasses[animationState]}`}>
      <div className="flex flex-col items-center max-w-full">
        {/* Message bubble with animation - ABOVE the sprite */}
        <div className={`message-bubble-wrapper transition-all duration-500 mb-6 transform ${bubbleClasses[animationState]}`}>
          <div className={`relative p-5 rounded-lg max-w-md mx-auto
            ${playerColor === 'blue'
              ? 'bg-blue-800/95 text-blue-50'
              : 'bg-red-800/95 text-red-50'
            }`}
          >
            {/* Triangle pointer for the bubble */}
            <div className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 
              border-l-[10px] border-r-[10px] border-t-[10px] border-b-0
              ${playerColor === 'blue'
                ? 'border-l-transparent border-r-transparent border-t-blue-800/95'
                : 'border-l-transparent border-r-transparent border-t-red-800/95'
              }`}>
            </div>

            {/* Cette div contient à la fois le texte invisible (pour dimensionner) et le texte visible (avec effet) */}
            <div className="relative w-full">
              {/* Texte invisible complet pour définir la taille de la bulle dès le début */}
              <div className="opacity-0 pointer-events-none absolute inset-0" aria-hidden="true">
                <p className="text-base font-pokemon-gb leading-relaxed tracking-wide whitespace-pre-wrap" style={{
                  letterSpacing: '0.05em',
                  lineHeight: '1.8',
                  fontSize: '0.9rem'
                }}>{entry?.chatMessage || " "}</p>
              </div>

              {/* Texte visible avec effet machine à écrire, dans un conteneur en position absolue */}
              <div className="relative z-10">
                <p className="text-base font-pokemon-gb leading-relaxed tracking-wide whitespace-pre-wrap min-h-[1.5rem]" style={{
                  letterSpacing: '0.05em',
                  lineHeight: '1.8',
                  fontSize: '0.9rem'
                }}>
                  {displayedText}
                  {/* Curseur clignotant quand la frappe est en cours */}
                  {displayedText.length < (entry?.chatMessage?.length || 0) && animationState === 'visible' &&
                    <span className="animate-pulse">|</span>
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Trainer sprite with animation */}
        <div className={`trainer-sprite transition-all duration-500 transform ${trainerClasses[animationState]}`}>
          <div className="relative">
            {/* Elliptical shadow behind the trainer - with thicker, more visible border */}
            <div className={`absolute top-16 left-1/2 transform -translate-x-1/2 scale-y-50
              w-40 h-40 rounded-full 
              ${playerColor === 'blue'
                ? 'bg-blue-900/20 border-4 border-blue-900/40'
                : 'bg-red-900/20 border-4 border-red-900/40'}
              -z-10`}>
            </div>

            {/* Trainer image */}
            <div className={`relative 
              rounded-full p-2 shadow-lg`}>
              <img
                src={trainerSprite}
                alt={playerColor === 'blue' ? "Blue" : "Red"}
                className={`w-40 h-40 object-contain ${playerColor === 'red' ? 'scale-x-[-1]' : ''}`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Déplacer le composant PokemonLists en dehors de EmptyLog
const PokemonLists = React.memo(({ battleData }) => {
  const hasBannedPokemon = battleData?.bannedPokemonList?.pokemonIds?.length > 0;
  const hasSelectedPokemon = battleData?.pokemonList?.length > 0;

  // State pour l'animation séquentielle
  const [visibleBannedCount, setVisibleBannedCount] = React.useState(0);
  const [visibleSelectedCount, setVisibleSelectedCount] = React.useState(0);

  // Refs pour suivre si l'animation a déjà été jouée
  const bannedAnimationPlayed = React.useRef(false);
  const selectedAnimationPlayed = React.useRef(false);

  // Détecter les changements dans les listes de Pokémon
  React.useEffect(() => {
    if (hasBannedPokemon && !bannedAnimationPlayed.current) {
      setVisibleBannedCount(0);
      let count = 0;
      const interval = setInterval(() => {
        count++;
        setVisibleBannedCount(count);
        if (count >= battleData.bannedPokemonList.pokemonIds.length) {
          clearInterval(interval);
          bannedAnimationPlayed.current = true;
        }
      }, 100);

      return () => clearInterval(interval);
    } else if (hasBannedPokemon) {
      setVisibleBannedCount(battleData.bannedPokemonList.pokemonIds.length);
    }
  }, [battleData?.bannedPokemonList?.pokemonIds]);

  React.useEffect(() => {
    if (hasSelectedPokemon && !selectedAnimationPlayed.current) {
      setVisibleSelectedCount(0);
      let count = 0;
      const interval = setInterval(() => {
        count++;
        setVisibleSelectedCount(count);
        if (count >= battleData.pokemonList.length) {
          clearInterval(interval);
          selectedAnimationPlayed.current = true;
        }
      }, 100);

      return () => clearInterval(interval);
    } else if (hasSelectedPokemon) {
      setVisibleSelectedCount(battleData.pokemonList.length);
    }
  }, [battleData?.pokemonList]);

  if (!hasBannedPokemon && !hasSelectedPokemon) return null;

  return (
    <div className="p-3 h-full w-full">
      {hasBannedPokemon && (
        <div className="mb-4">
          <div className="text-slate-300 text-sm font-medium mb-2 flex items-center">
            <svg className="w-4 h-4 mr-1 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path>
            </svg>
            Banned {battleData.bannedPokemonList.pokemonIds.length} Pokémon:
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-lg p-2">
            {battleData.bannedPokemonList.pokemonIds.map((pokemon, idx) => (
              <div
                key={`banned-${pokemon.id}-${idx}`}
                className={`bg-slate-700/30 rounded p-2 text-xs flex flex-col items-center transform transition-all duration-300 relative
                  ${idx < visibleBannedCount ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95'}`}
              >
                {/* Ban indicator overlay */}
                <div className="absolute inset-0 rounded overflow-hidden flex items-center justify-center">
                  <svg className="w-full h-full text-red-500/70 opacity-30" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z" />
                  </svg>
                </div>

                <div className="flex items-center justify-center mb-1 overflow-hidden relative z-10">
                  <img
                    src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`}
                    alt={pokemon.name}
                    className="w-16 h-16 object-contain"
                  />
                </div>
                <span className="text-slate-400 font-medium truncate w-full text-center relative z-10">{pokemon.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasSelectedPokemon && (
        <div className="mb-3">
          <div className="text-slate-300 text-sm font-medium mb-2 flex items-center">
            <svg className="w-4 h-4 mr-1 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Selected {battleData.pokemonList.length} Pokémon:
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-lg p-2">
            {battleData.pokemonList.map((pokemon, idx) => (
              <div
                key={`selected-${pokemon.id}-${idx}`}
                className={`bg-slate-700/30 rounded p-2 text-xs flex flex-col items-center transform transition-all duration-300
                  ${idx < visibleSelectedCount ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95'}`}
              >
                <div className="flex items-center justify-center mb-1 overflow-hidden">
                  <img
                    src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`}
                    alt={pokemon.name}
                    className="w-16 h-16 object-contain"
                  />
                </div>
                <span className="text-slate-200 font-medium truncate w-full text-center">{pokemon.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// Simplifier EmptyLog pour ne montrer que le message vide
const EmptyLog = React.memo(({ playerName }) => {
  return (
    <div className={`text-slate-500 text-center py-8 flex flex-col items-center w-full`}>
      <svg className="w-10 h-10 mb-3 text-slate-600 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
      </svg>
      <p className="text-sm">No logs for {playerName}.</p>
      <p className="text-xs mt-1 text-slate-400">AI analysis will appear here during the battle.</p>
    </div>
  );
});

// Composant pour afficher les types d'action avec des icônes et couleurs appropriées
const ActionTypeIndicator = React.memo(({ type, value, humanReadable, moveData, pokemonData, oldPokemonData }) => {
  // Configuration en fonction du type d'action
  let icon, title, displayText, borderColor;

  // Couleurs unifiées - updated to match Strategy/Analysis style
  const bgColor = "bg-slate-800/90";

  switch (type) {
    case 'attack':
      icon = (
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"></path>
        </svg>
      );
      title = "Attack";
      displayText = humanReadable || (value ? `Attack #${value}` : 'Attack');
      borderColor = "border-l-yellow-500"; // Changed to left-border style
      break;
    case 'switch_pokemon':
      icon = (
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
        </svg>
      );
      title = "Switch";
      displayText = humanReadable || (value ? `Switch to #${value}` : 'Switch Pokémon');
      borderColor = "border-l-blue-500"; // Changed to left-border style
      break;
    case 'ready':
      icon = (
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"></path>
        </svg>
      );
      title = "Ready";
      displayText = "Ready";
      borderColor = "border-l-purple-500"; // Changed to left-border style
      break;
    default:
      icon = (
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
        </svg>
      );
      title = "Move";
      displayText = humanReadable || (value ? `Move: ${value}` : 'Action');
      borderColor = "border-l-emerald-500"; // Changed to left-border style
  }

  // Function to render HP bar with color based on percentage
  const renderHPBar = (current, max) => {
    const percentage = Math.max(0, Math.min(100, (current / max) * 100));
    let barColor;

    if (percentage > 50) barColor = 'bg-green-500';
    else if (percentage > 20) barColor = 'bg-orange-500';
    else barColor = 'bg-red-500';

    return (
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden w-full mt-1">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  };

  // Function to render type badges
  const renderTypeBadges = (types) => {
    if (!types || types.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {types.map((type, index) => (
          <TypeBadge key={index} type={type} size="xs" />
        ))}
      </div>
    );
  };

  // Function to render a single Pokemon card (compact, fits narrow containers)
  const renderPokemonCard = (pokemon) => {
    if (!pokemon) return null;

    return (
      <div className="opacity-90 bg-slate-200/5 p-1.5 rounded-lg overflow-hidden min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-8 h-8 flex-shrink-0 rounded overflow-hidden flex items-center justify-center">
            <img
              src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`}
              alt={pokemon.name}
              className="w-8 h-8 object-contain"
            />
          </div>
          <h3 className="text-white text-xs font-medium truncate capitalize min-w-0 flex-1">{pokemon.name}</h3>
        </div>

        <div className="bg-slate-800/50 rounded px-1.5 py-1">
          <div className="flex justify-between items-center text-[10px] mb-0.5">
            <span className="font-medium text-slate-300">HP</span>
            <span className={`font-medium ${pokemon.currentHP / pokemon.maxHP > 0.5 ? 'text-green-400' : pokemon.currentHP / pokemon.maxHP > 0.2 ? 'text-orange-400' : 'text-red-400'}`}>
              {pokemon.currentHP}/{pokemon.maxHP}
            </span>
          </div>
          {renderHPBar(pokemon.currentHP, pokemon.maxHP)}
        </div>
      </div>
    );
  };

  return (
    // Updated container styling to match Strategy/Analysis style with left border accent
    <div className={`${bgColor} p-3 rounded-md border-l-4 ${borderColor} mb-2 overflow-hidden`}>
      {/* Header - updated to match Strategy/Analysis styling */}
      <div className={`flex items-center text-${borderColor.replace('border-l-', '')} font-medium mb-2`}>
        {icon}
        <span className="text-sm uppercase tracking-wider">{title}</span>
      </div>

      {/* Content */}
      <div>
        {/* Enhanced content based on action type */}
        {type === 'switch_pokemon' ? (
          <div>
            {oldPokemonData && pokemonData ? (
              <div className="flex items-stretch gap-1.5 min-w-0 overflow-hidden">
                <div className="flex-1 min-w-0">
                  {renderPokemonCard(oldPokemonData)}
                </div>

                <div className="flex items-center justify-center flex-shrink-0 px-0.5">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  {renderPokemonCard(pokemonData)}
                </div>
              </div>
            ) : pokemonData ? (
              <div>
                {/* Fallback to old display if only pokemonData is available */}
                {renderPokemonCard(pokemonData)}
              </div>
            ) : (
              <div className="text-sm text-white">{displayText}</div>
            )}
          </div>
        ) : type === 'attack' && moveData ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-sm uppercase tracking-wide">{moveData.name}</h3>
              <div className="flex items-center">
                <span className="text-xs px-2 py-1 bg-slate-700/70 rounded text-blue-300 font-medium ml-1">
                  PP: {moveData.currentPP}/{moveData.maxPP}
                </span>
              </div>
            </div>

            {/* Type, Power, Accuracy */}
            <div className="flex items-center justify-between mb-3">
              {moveData.type && (
                <TypeBadge type={moveData.type} size="xs" />
              )}

              <div className="flex gap-2">
                {moveData.power && (
                  <span className="text-xs px-2 py-1 bg-slate-700/70 rounded text-orange-300">
                    PWR: {moveData.power}
                  </span>
                )}
                {moveData.accuracy && (
                  <span className="text-xs px-2 py-1 bg-slate-700/70 rounded text-yellow-300">
                    ACC: {moveData.accuracy}
                  </span>
                )}
              </div>
            </div>

            {/* Category and Effect */}
            {moveData.category && (
              <div className="text-xs text-slate-300 mb-2">
                <span className="font-medium">Category:</span> {moveData.category}
              </div>
            )}

            {/* Description */}
            {moveData.description && (
              <p className="text-xs text-slate-300 leading-snug mb-2 bg-slate-900/40 p-2 rounded">
                {moveData.description}
              </p>
            )}

            {/* Effect if different from description */}
            {moveData.effect && moveData.effect !== moveData.description && (
              <p className="text-xs text-yellow-200 leading-snug bg-slate-900/40 p-2 rounded">
                <span className="font-medium">Effect:</span> {moveData.effect}
              </p>
            )}
          </div>
        ) : (
          <div className="text-sm text-white">{displayText}</div>
        )}
      </div>
    </div>
  );
});


const ChatEntry = React.memo(({ entry, index, playerColor = 'blue' }) => {
  // Determine color theme based on player color
  const headerText = playerColor === 'blue' ? 'text-blue-200' : 'text-red-200';

  return (
    <div className="chat-entry mt-3 grid grid-cols-1 gap-2 w-full">
      {/* Strategy display area */}
      <div className="strategy-display w-full">
        {/* Action type indicator */}
        {(entry.decision) && (
          <div className="type-indicator mb-2">
            <ActionTypeIndicator
              type={entry.decision}
              value={entry.move}
              humanReadable={entry.humanReadable || null}
              moveData={entry.moveData || null}
              pokemonData={entry.pokemonData || null}
              oldPokemonData={entry.oldPokemonData || null}
            />
          </div>
        )}

        {entry.move && !entry.decision && (
          <div className="move mb-2">
            <div className="bg-slate-800/90 p-2 rounded-md border border-slate-700 ">
              <div className="flex items-center text-slate-300 font-medium mb-1">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                </svg>
                <span className="text-sm">Move</span>
              </div>
              <div className="text-white text-sm">{entry.move}</div>
            </div>
          </div>
        )}

        {/* Strategy Section - Simplified */}
        {entry.reasoning && (
          <div className={`strategy bg-slate-800/90 p-3 rounded-md border-l-4 ${playerColor === 'blue' ? 'border-l-blue-500' : 'border-l-red-500'} mb-3`}>
            <div className={`flex items-center ${headerText} font-medium mb-2`}>
              <Brain className="w-4 h-4 mr-2" />
              <span className="text-sm uppercase tracking-wider">Reasoning</span>
            </div>
            <p className="text-white leading-relaxed" style={{ fontFamily: 'var(--font-primary)', fontSize: '0.8rem' }}>{entry.reasoning}</p>
          </div>
        )}

        {/* Strategy Section - Simplified */}
        {entry.strategy && (
          <div className={`strategy bg-slate-800/90 p-3 rounded-md border-l-4 ${playerColor === 'blue' ? 'border-l-blue-500' : 'border-l-red-500'} mb-3`}>
            <div className={`flex items-center ${headerText} font-medium mb-2`}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span className="text-sm uppercase tracking-wider">Strategy</span>
            </div>
            <p className="text-white leading-relaxed" style={{ fontFamily: 'var(--font-primary)', fontSize: '0.8rem' }}>{entry.strategy}</p>
          </div>
        )}

        {/* Analysis - Simplified */}
        {entry.analysis && (
          <div className={`analysis bg-slate-800/90 p-3 rounded-md border-l-4 ${playerColor === 'blue' ? 'border-l-blue-500' : 'border-l-red-500'}`}>
            <div className={`flex items-center ${headerText} font-medium mb-2`}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span className="text-sm uppercase tracking-wider">Analysis</span>
            </div>
            <p className="text-white leading-relaxed" style={{ fontFamily: 'var(--font-primary)', fontSize: '0.8rem' }}>{entry.analysis}</p>
          </div>
        )}
      </div>
    </div>
  );
});

// Fonction pour comparer si les props chatLog ont changé
const areEqual = (prevProps, nextProps) => {
  // Si les références sont identiques, pas besoin de re-rendre
  if (
    prevProps.chatLog === nextProps.chatLog &&
    prevProps.battleData === nextProps.battleData &&
    prevProps.isThinking === nextProps.isThinking &&
    prevProps.showMessageBubble === nextProps.showMessageBubble
  ) {
    return true;
  }

  // Si isThinking a changé, on doit re-rendre
  if (prevProps.isThinking !== nextProps.isThinking) {
    return false;
  }

  // Si showMessageBubble a changé, on doit re-rendre
  if (prevProps.showMessageBubble !== nextProps.showMessageBubble) {
    return false;
  }

  // Si les longueurs sont différentes, il y a eu un changement
  if (prevProps.chatLog.length !== nextProps.chatLog.length) {
    return false;
  }

  // Vérifier si battleData a changé
  if (prevProps.battleData !== nextProps.battleData) {
    // Vérifier spécifiquement si les bannedPokemonList ou pokemonList ont changé
    if (
      prevProps.battleData?.bannedPokemonList !== nextProps.battleData?.bannedPokemonList ||
      prevProps.battleData?.pokemonList !== nextProps.battleData?.pokemonList
    ) {
      return false;
    }
  }

  // Vérification détaillée des entrées
  for (let i = 0; i < prevProps.chatLog.length; i++) {
    if (prevProps.chatLog[i] !== nextProps.chatLog[i]) {
      return false;
    }
  }

  return true;
};

// Modifications à apporter au composant ChatLog

const ChatLog = ({ chatLog = [], playerName = "Player 1", player1Name = "Unknown AI", playerNum = 1, battleData, isThinking = false }) => {
  const lastPlayerLog = chatLog.length > 0 ? chatLog[chatLog.length - 1] : null;
  const playerColor = playerNum === 1 ? "blue" : "red";

  const [wasThinking, setWasThinking] = useState(false);
  const [showMessageBubble, setShowMessageBubble] = useState(false);
  const [lastMessageId, setLastMessageId] = useState(null);
  // Référence pour l'élément audio
  const audioRef = useRef(null);

  // Effect to detect when thinking state changes from true to false
  useEffect(() => {
    // If we just stopped thinking and there's a message
    if (wasThinking && !isThinking && lastPlayerLog?.chatMessage) {
      console.log("Thinking just ended - showing message bubble");
      setShowMessageBubble(true);
      setLastMessageId(chatLog.length > 0 ? JSON.stringify(lastPlayerLog) : null);
    }

    // Update wasThinking state
    setWasThinking(isThinking);
  }, [isThinking, lastPlayerLog, wasThinking, chatLog]);

  // Effect to detect new messages when not in thinking mode
  useEffect(() => {
    // If we're not thinking and there's a new message
    if (!isThinking && lastPlayerLog?.chatMessage) {
      const currentMessageId = JSON.stringify(lastPlayerLog);

      // If the message has changed
      if (currentMessageId !== lastMessageId) {
        console.log("New message detected - showing bubble");
        setShowMessageBubble(true);
        setLastMessageId(currentMessageId);
      }
    }
  }, [lastPlayerLog, isThinking, lastMessageId]);

  // Référence pour suivre l'ID du message audio actuellement joué
  const currentPlayingAudioId = useRef(null);

  // Nouvel effet pour gérer la lecture de l'audio TTS
  useEffect(() => {
    // Si un nouveau message avec audio TTS est détecté
    if (lastPlayerLog?.tts_audio_base64 && lastMessageId) {
      // Vérifier si nous avons déjà joué cet audio
      if (currentPlayingAudioId.current === lastMessageId) {
        console.log("This audio is already playing, skipping");
        return;
      }
      
      console.log("TTS audio detected - playing audio");
      
      // Si un audio est déjà en cours de lecture, on l'arrête
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current = null;
      }
      
      // Création d'un nouvel élément audio
      const audio = new Audio();
      audio.loop = false; // S'assurer que l'audio ne boucle pas
      
      // Définir l'ID du message audio en cours de lecture
      currentPlayingAudioId.current = lastMessageId;
      
      // Gestionnaire d'événement pour la fin de l'audio
      audio.onended = () => {
        console.log("Audio playback completed");
        currentPlayingAudioId.current = null;
        audioRef.current = null;
      };
      
      // Gestionnaire d'erreur
      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        currentPlayingAudioId.current = null;
        audioRef.current = null;
      };
      
      // Configuration de la source audio à partir des données base64
      audio.src = `data:audio/mp3;base64,${lastPlayerLog.tts_audio_base64}`;
      audioRef.current = audio;
      
      // Lecture de l'audio une seule fois
      audio.play().catch(e => {
        console.error("Error playing TTS audio:", e);
        currentPlayingAudioId.current = null;
      });
    }
  }, [lastMessageId, lastPlayerLog?.tts_audio_base64]);

  // Nettoyage de l'audio lors du démontage du composant
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current = null;
        currentPlayingAudioId.current = null;
      }
    };
  }, []);

  // Handle when the chat bubble animation completes
  const handleChatBubbleComplete = useCallback(() => {
    console.log("Chat bubble animation completed");
    setShowMessageBubble(false);
    // Ensure there's a small delay before showing content to avoid visual overlap
    setTimeout(() => {
      // Content will become visible due to the showMessageBubble being false
    }, 100);
  }, []);
  
  return (
    <div className="chat-log-container h-full flex flex-col rounded-lg overflow-hidden relative w-full min-w-[300px]">
      {/* Le reste du code reste inchangé */}
      
      {/* Main content - hidden during thinking or when message bubble is shown */}
      <div className={`w-full h-full ${isThinking || showMessageBubble ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}>
        {/* Pokemon Lists - present but hidden when logs are showing */}
        <div className={`absolute inset-0 z-10 ${chatLog.length === 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <PokemonLists battleData={battleData} />
        </div>

        {/* Empty Log Message */}
        {chatLog.length === 0 && !battleData?.bannedPokemonList?.pokemonIds?.length && !battleData?.pokemonList?.length && (
          <EmptyLog playerName={playerName} />
        )}

        {/* Chat Logs - strategy content only */}
        {chatLog.length > 0 && (
          <div className="player-log w-full p-2 h-full flex flex-col overflow-y-auto">
            <ChatEntry
              key={`strategy-${lastMessageId || 'latest'}`}
              entry={lastPlayerLog}
              index={0}
              playerColor={playerColor}
            />
          </div>
        )}
      </div>

      {/* Chat Message Bubble Layer - shown when showMessageBubble is true */}
      {showMessageBubble && lastPlayerLog?.chatMessage && (
        <div className="absolute inset-0 z-30 pointer-events-none">
          <ChatMessageBubble
            entry={lastPlayerLog}
            playerColor={playerColor}
            onAnimationComplete={handleChatBubbleComplete}
          />
        </div>
      )}

      {/* Transparent blocker during message bubble to prevent content interaction */}
      {showMessageBubble && (
        <div className="absolute inset-0 z-20 bg-transparent"></div>
      )}

      {/* Thinking View Layer - shown during thinking */}
      {isThinking && (
        <div className="absolute inset-0 z-40">
          <ThinkingView playerColor={playerColor} playerName={player1Name} />
        </div>
      )}
    </div>
  );
};
// Export the optimized ChatLog component with memo
export default React.memo(ChatLog, areEqual);
