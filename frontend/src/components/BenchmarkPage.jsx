import React, { useState, useEffect } from 'react';
import { StadiumPattern } from './ui/BackgroundPatterns';
import TeamDisplay from './pokemon/TeamDisplay';
import ScreenShare from './ui/ScreenShare';
import ChatLog from './ui/ChatLog';
import BattleEndOverlay from './ui/BattleEndOverlay';
import BattleStartOverlay from './ui/BattleStartOverlay';
import BattleStatusOverlay from './ui/BattleStatusOverlay';
import BattleNotification from './ui/BattleNotification';
import useScreenSharing from '../hooks/useScreenSharing';
// Composant pour afficher les indicateurs de score (boules)
const ScoreIndicator = ({ maxWins, currentWins, playerColor }) => {
  // Déterminer les classes de couleur en fonction du joueur
  const filledClass = playerColor === 'blue'
    ? 'bg-blue-400 border-blue-500'
    : 'bg-red-400 border-red-500';

  const emptyClass = playerColor === 'blue'
    ? 'bg-blue-950/40 border-blue-900/70'
    : 'bg-red-950/40 border-red-900/70';

  return (
    <div className="flex space-x-1">
      {[...Array(maxWins)].map((_, index) => (
        <div
          key={index}
          className={`w-3 h-3 rounded-full border ${index < currentWins ? filledClass : emptyClass}`}
        />
      ))}
    </div>
  );
};

const BenchmarkPage = ({
  selectedIA1,
  selectedIA2,
  teamTabs,
  setTabForTeam,
  teams,
  chatLog,
  ias,
  battleData,
  serverState,
  setSelectedIA1,
  setSelectedIA2,
  selectedIA1ReasoningEffort,
  selectedIA2ReasoningEffort,
  setSelectedIA1ReasoningEffort,
  setSelectedIA2ReasoningEffort,
  battleFormat,
  setBattleFormat,
  battleType,
  setBattleType,
  startBenchmark,
  endGameData
}) => {
  const [showEndOverlay, setShowEndOverlay] = useState(false);
  const [showStartOverlay, setShowStartOverlay] = useState(false);
  const [showStatusOverlay, setShowStatusOverlay] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  // Centraliser le partage d'écran
  const screenSharing = useScreenSharing();

  // États qui nécessitent l'affichage du status overlay
  const statusOverlayStates = ['banning_step', 'select_team_step'];

  // États qui nécessitent l'affichage d'une notification en bas
  const notificationStates = ['select_final_team_step', 'select_pokemon_in_game_step'];

  // Effet pour afficher les overlays en fonction de l'état du serveur
  useEffect(() => {
    if (serverState === 'finished' || serverState === 'starting_next_round') {
      setShowEndOverlay(true);
      setShowStartOverlay(false);
      setShowStatusOverlay(false);
      setShowNotification(false);
    } else if (serverState === 'idle') {
      setShowStartOverlay(true);
      setShowEndOverlay(false);
      setShowStatusOverlay(false);
      setShowNotification(false);
    } else if (statusOverlayStates.includes(serverState)) {
      setShowStatusOverlay(true);
      setShowStartOverlay(false);
      setShowEndOverlay(false);
      setShowNotification(false);
    } else if (notificationStates.includes(serverState)) {
      setShowNotification(true);
      setShowStatusOverlay(false);
      setShowStartOverlay(false);
      setShowEndOverlay(false);
    } else {
      setShowStartOverlay(false);
      setShowEndOverlay(false);
      setShowStatusOverlay(false);
      setShowNotification(false);
    }
  }, [serverState]);

  // Fermer l'overlay sans relancer de partie
  const closeOverlay = () => {
    setShowEndOverlay(false);
  };

  // Fermer l'overlay de démarrage
  const closeStartOverlay = () => {
    setShowStartOverlay(false);
  };

  // Fermer l'overlay de status (optionnel)
  const closeStatusOverlay = () => {
    setShowStatusOverlay(false);
  };

  // Extraire le cache PokeAPI du battleData
  const pokeApiCache = battleData?.clientData?.pokeApi?.cache;

  // Filter chat logs by player
  const player1Logs = chatLog.filter(entry => entry.playerNum === 1);
  const player2Logs = chatLog.filter(entry => entry.playerNum === 2);

  // Déterminer si on doit afficher les scores et combien de manches sont nécessaires pour gagner
  const isMultipleRounds = battleFormat === 'best3' || battleFormat === 'best5';
  const maxWins = battleFormat === 'best3' ? 2 : (battleFormat === 'best5' ? 3 : 1);

  // Récupérer les scores depuis les données du serveur
  const player1Wins = battleData?.battleScores?.player1 || 0;
  const player2Wins = battleData?.battleScores?.player2 || 0;

  const buildDisplayName = (modelId, reasoningEffort) => {
    const baseName = ias?.[modelId]?.name || modelId || "Unknown AI";
    return reasoningEffort ? `${baseName} (${reasoningEffort})` : baseName;
  };

  const player1ModelKey = battleData?.models?.player1 || selectedIA1;
  const player2ModelKey = battleData?.models?.player2 || selectedIA2;

  const player1DisplayName = battleData?.modelDisplayNames?.player1
    || buildDisplayName(player1ModelKey, battleData?.reasoningEfforts?.player1 ?? selectedIA1ReasoningEffort);
  const player2DisplayName = battleData?.modelDisplayNames?.player2
    || buildDisplayName(player2ModelKey, battleData?.reasoningEfforts?.player2 ?? selectedIA2ReasoningEffort);

  return (
    <div className="flex flex-col w-full h-full max-h-screen overflow-hidden benchmark-page">

      {/* Conteneur principal - prend toute la hauteur après le status banner */}
      <div className="relative z-10 w-full h-full flex flex-col">

        {/* Contenu principal - occupe le reste de l'espace */}
        <div className="flex flex-col flex-grow w-full overflow-hidden pb-0">
          {/* Teams en haut */}
          <div className="w-full flex-shrink-0 flex team-container">
            {/* Team du Joueur 1 */}
            <div className="w-1/2 p-2">
              <div className="h-full rounded-lg overflow-hidden transition-all-normal">
                <TeamDisplay
                  team={teams[0]}
                  tabIndex={teamTabs[0]}
                  onTabChange={(tab) => setTabForTeam(0, tab)}
                  battleData={{
                    ...battleData?.clientData?.player1Data,
                    pokeApi: { cache: pokeApiCache }
                  }}
                />
              </div>
            </div>

            {/* Team du Joueur 2 */}
            <div className="w-1/2 p-2">
              <div className="h-full rounded-lg overflow-hidden transition-all-normal">
                <TeamDisplay
                  team={teams[1]}
                  tabIndex={teamTabs[1]}
                  onTabChange={(tab) => setTabForTeam(1, tab)}
                  battleData={{
                    ...battleData?.clientData?.player2Data,
                    pokeApi: { cache: pokeApiCache }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section avec le jeu et les chats - occupe tout l'espace restant avec gestion du débordement */}
          <div className="flex w-full flex-grow min-h-0 max-w-full">
            {/* Chat du Joueur 1 */}
            <div className="w-1/5 p-2 flex-shrink-0 overflow-hidden flex flex-col">
              <div className="rounded-lg flex flex-col h-full overflow-hidden">
                <div className="bg-gradient-to-r from-blue-800 to-blue-600 text-white p-2 font-medium flex items-center flex-shrink-0 text-sm">
                  <span className="mr-auto truncate">
                    {ias[player1ModelKey]?.chatTeam && (
                      <span
                        style={{
                          color: "rgba(220, 220, 220, 0.85)",
                          fontWeight: "600"
                        }}
                      >
                        {ias[player1ModelKey].chatTeam.toUpperCase()}
                      </span>
                    )}
                    {ias[player1ModelKey]?.chatTeam && <span style={{ opacity: 0.6, margin: "0 4px" }}>|</span>}
                    {player1DisplayName}
                  </span>
                  {isMultipleRounds && (
                    <ScoreIndicator
                      maxWins={maxWins}
                      currentWins={player1Wins}
                      playerColor="blue"
                    />
                  )}
                </div>
                <div className="flex-grow overflow-auto scrollbar-thin min-h-0">
                  <div className="chat-container h-full"
                    style={{
                      backdropFilter: 'blur(4px)',
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      overflow: 'auto'
                    }}
                  >
                    <ChatLog
                      chatLog={player1Logs}
                      player1Name={player1DisplayName}
                      player2Name=""
                      singlePlayerMode={true}
                      playerNum={1}
                      isThinking={battleData?.clientData?.player1Data?.isThinking}
                      battleData={{
                        ...battleData?.clientData?.player1Data,
                        pokeApi: { cache: pokeApiCache }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Écran de jeu - Conteneur central avec dimensions fixes */}
            <div className="w-3/5 p-2 flex-shrink-0 flex-grow-0 overflow-hidden flex flex-col">
              <div className="rounded-lg border border-yellow-500/20 h-full w-full flex flex-col relative">
                {/* Force le rapport d'aspect et la taille minimale */}
                <div className="w-full aspect-video bg-slate-900/30 absolute inset-0"></div>

                {/* Placeholder visible uniquement quand ScreenShare est vide */}
                <div className="absolute inset-0 bg-slate-800/50 flex items-center justify-center pointer-events-none z-0">
                  <div className="text-slate-400 text-center p-8">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                    <p className="text-lg font-medium">Battle Screen</p>
                    <p className="text-sm mt-2 max-w-md">Start a match to see the Pokémon battle in action</p>
                  </div>
                </div>

                {/* ScreenShare avec position relative et z-index pour être au-dessus du placeholder */}
                <div className="relative z-10 h-full w-full">
                  <ScreenShare
                    chatLog={chatLog}
                    battleData={battleData}
                    battleFormat={battleFormat}
                    screenSharing={screenSharing}
                  />
                </div>

                {/* Notification pour les états spécifiques sans bloquer l'écran */}
                {showNotification && (
                  <BattleNotification serverState={serverState} />
                )}

                {/* Overlay de fin de partie - affiché uniquement si showEndOverlay est true */}
                {showEndOverlay && (
                  <BattleEndOverlay
                    ias={ias}
                    onClose={closeOverlay}
                    setShowStartOverlay={setShowStartOverlay}
                    endGameData={endGameData}
                    serverState={serverState}
                  />
                )}


                {/* Overlay de démarrage - affiché uniquement si showStartOverlay est true */}
                {showStartOverlay && (
                  <BattleStartOverlay
                    ias={ias}
                    selectedIA1={selectedIA1}
                    setSelectedIA1={setSelectedIA1}
                    selectedIA2={selectedIA2}
                    setSelectedIA2={setSelectedIA2}
                    selectedIA1ReasoningEffort={selectedIA1ReasoningEffort}
                    selectedIA2ReasoningEffort={selectedIA2ReasoningEffort}
                    setSelectedIA1ReasoningEffort={setSelectedIA1ReasoningEffort}
                    setSelectedIA2ReasoningEffort={setSelectedIA2ReasoningEffort}
                    battleFormat={battleFormat}
                    setBattleFormat={setBattleFormat}
                    battleType={battleType}
                    setBattleType={setBattleType}
                    startBenchmark={startBenchmark}
                    onClose={closeStartOverlay}
                    screenSharing={screenSharing}
                  />
                )}

                {/* Overlay de status - affiché pour les états spécifiques */}
                {showStatusOverlay && (
                  <BattleStatusOverlay
                    serverState={serverState}
                    onClose={null} // Optionnel: peut être activé si l'on veut permettre à l'utilisateur de fermer ce message
                  />
                )}

              </div>
            </div>

            {/* Chat du Joueur 2 */}
            <div className="w-1/5 p-2 flex-shrink-0 overflow-hidden flex flex-col">
              <div className="rounded-lg flex flex-col h-full overflow-hidden">
                <div className="bg-gradient-to-r from-red-600 to-red-800 text-white p-2 font-medium flex items-center flex-shrink-0 text-sm">
                  <span className="mr-auto truncate">
                    {ias[player2ModelKey]?.chatTeam && (
                      <span
                        style={{
                          color: "rgba(220, 220, 220, 0.85)",
                          fontWeight: "600"
                        }}
                      >
                        {ias[player2ModelKey].chatTeam.toUpperCase()}
                      </span>
                    )}
                    {ias[player2ModelKey]?.chatTeam && <span style={{ opacity: 0.6, margin: "0 4px" }}>|</span>}
                    {player2DisplayName}
                  </span>
                  {isMultipleRounds && (
                    <ScoreIndicator
                      maxWins={maxWins}
                      currentWins={player2Wins}
                      playerColor="red"
                    />
                  )}
                </div>
                <div className="flex-grow overflow-auto min-h-0 scrollbar-thin">
                  <div className="chat-container h-full"
                    style={{
                      backdropFilter: 'blur(4px)',
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      overflow: 'auto'
                    }}>
                    <ChatLog
                      chatLog={player2Logs}
                      player1Name={player2DisplayName}
                      player2Name=""
                      singlePlayerMode={true}
                      playerNum={2}
                      isThinking={battleData?.clientData?.player2Data?.isThinking}
                      battleData={{
                        ...battleData?.clientData?.player2Data,
                        pokeApi: { cache: pokeApiCache }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BenchmarkPage;
