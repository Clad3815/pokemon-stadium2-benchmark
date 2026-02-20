import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import BenchmarkPage from './components/BenchmarkPage';
import StatsPage from './components/StatsPage';
import benchmarkBg from '../assets/benchmark_bg.jpg';
import './App.css';

export default function PokemonBenchmarkUI({ page }) {
  const [selectedIA1, setSelectedIA1] = useState("gemini/gemini-2.0-pro-exp-02-05");
  const [selectedIA2, setSelectedIA2] = useState("openai/gpt-4.5-preview");
  const [selectedIA1ReasoningEffort, setSelectedIA1ReasoningEffort] = useState(null);
  const [selectedIA2ReasoningEffort, setSelectedIA2ReasoningEffort] = useState(null);
  const [battleFormat, setBattleFormat] = useState("single");
  const [battleType, setBattleType] = useState("6vs6");
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [teamTabs, setTeamTabs] = useState([0, 0]);
  const [apiStatus, setApiStatus] = useState({ connected: false, checking: true, message: "Checking connection..." });
  const [serverState, setServerState] = useState("idle");
  const [iaModels, setIaModels] = useState({});
  const [teams, setTeams] = useState([[], []]);
  const [chatLog, setChatLog] = useState([]);
  const [battleData, setBattleData] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [pokeApiCache, setPokeApiCache] = useState({});
  const [endGameData, setEndGameData] = useState([]);
  const navigate = useNavigate();

  // Function to start auto-refresh
  const startAutoRefresh = () => {
    stopAutoRefresh();
    const intervalId = setInterval(() => {
      checkApiStatus();
    }, 1000);
    setRefreshInterval(intervalId);
    console.log("Auto-refresh started");
  };

  const stopAutoRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
      console.log("Auto-refresh stopped");
    }
  };

  useEffect(() => {
    checkApiStatus();
    fetchModels();
    fetchPokeApiCache();
    return () => {
      stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    const isOnBenchmarkPage = page === 'benchmark';
    if ((isOnBenchmarkPage && (isReady || serverState !== 'idle')) && apiStatus.connected) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
    return () => {
      stopAutoRefresh();
    };
  }, [page, isReady, serverState, apiStatus.connected]);

  useEffect(() => {
    if (isReady || (serverState !== 'idle' && serverState !== 'finished')) {
      if (page !== 'benchmark') {
        if (page !== 'statistics') {
          navigate('/benchmark');
        }
      }
    }
  }, [isReady, serverState, page, navigate]);

  const fetchModels = async () => {
    try {
      const response = await fetch("http://localhost:2233/models", {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setIaModels(data);
        const modelKeys = Object.keys(data);
        if (modelKeys.length > 0) {
          const fallbackPlayer1 = modelKeys[0];
          const fallbackPlayer2 = modelKeys.length > 1 ? modelKeys[1] : modelKeys[0];

          setSelectedIA1((previousModel) => (data[previousModel] ? previousModel : fallbackPlayer1));
          setSelectedIA2((previousModel) => (data[previousModel] ? previousModel : fallbackPlayer2));
        }
      } else {
        console.error("Failed to fetch models:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching models:", error);
    }
  };

  const fetchPokeApiCache = async () => {
    try {
      const response = await fetch("http://localhost:2233/pokeapi_cache", {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setPokeApiCache(data);
      } else {
        console.error("Failed to fetch PokeAPI cache:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching PokeAPI cache:", error);
    }
  };

  const checkApiStatus = async () => {
    try {
      setApiStatus(prev => ({ ...prev, checking: true, message: "Checking connection..." }));
      const response = await fetch("http://localhost:2233/status", {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setApiStatus({ connected: true, checking: false, message: "Connected" });
        setServerState(data.state);
        setBattleData(data);

        if (data.clientData) {
          if (data.clientData.battleFormat) {
            setBattleFormat(data.clientData.battleFormat);
          }
          const player1Team = data.clientData.player1Data.team || [];
          const player2Team = data.clientData.player2Data.team || [];
          setTeams([player1Team, player2Team]);

          if (data.clientData.endGameData) {
            setEndGameData(data.clientData.endGameData);
          }

          const newChatLog = [];

          if (data.clientData.player1Data.history) {
            data.clientData.player1Data.history.forEach(entry => {
              newChatLog.push({
                playerNum: 1,
                analysis: entry.analysis || '',
                strategy: entry.battle_strategy || '',
                decision: entry.type || '',
                reasoning: entry.reasoning || '',
                move: entry.value || '',
                chatMessage: entry.chat_message || '',
                humanReadable: entry.humanReadable || '',
                moveData: entry.moveData || '',
                pokemonData: entry.pokemonData || '',
                oldPokemonData: entry.oldPokemonData || '',
                tts_audio_base64: entry.tts_audio_base64 || ''
              });
            });
          }

          if (data.clientData.player2Data.history) {
            data.clientData.player2Data.history.forEach(entry => {
              newChatLog.push({
                playerNum: 2,
                analysis: entry.analysis || '',
                strategy: entry.battle_strategy || '',
                decision: entry.type || '',
                reasoning: entry.reasoning || '',
                move: entry.value || '',
                chatMessage: entry.chat_message || '',
                humanReadable: entry.humanReadable || '',
                moveData: entry.moveData || '',
                pokemonData: entry.pokemonData || '',
                oldPokemonData: entry.oldPokemonData || '',
                tts_audio_base64: entry.tts_audio_base64 || ''
              });
            });
          }

          setChatLog(newChatLog);
        }

        if (data.models) {
          setSelectedIA1(data.models.player1);
          setSelectedIA2(data.models.player2);
        }
        if (data.reasoningEfforts) {
          setSelectedIA1ReasoningEffort(data.reasoningEfforts.player1 ?? null);
          setSelectedIA2ReasoningEffort(data.reasoningEfforts.player2 ?? null);
        }
      } else {
        throw new Error(`Server responded with status: ${response.status}`);
      }
    } catch (error) {
      console.error("API connection error:", error);
      setApiStatus({
        connected: false,
        checking: false,
        message: "Connection error. Retrying..."
      });
    }
  };

  const startBenchmark = async (
    player1Override = null,
    player2Override = null,
    battleFormatOverride = null,
    battleTypeOverride = null,
    player1ReasoningEffortOverride = undefined,
    player2ReasoningEffortOverride = undefined
  ) => {
    setIsLoading(true);

    try {
      const player1ToUse = player1Override !== null ? player1Override : selectedIA1;
      const player2ToUse = player2Override !== null ? player2Override : selectedIA2;
      const battleFormatToUse = battleFormatOverride !== null ? battleFormatOverride : battleFormat;
      const battleTypeToUse = battleTypeOverride !== null ? battleTypeOverride : battleType;
      const player1ReasoningEffortToUse = player1ReasoningEffortOverride !== undefined
        ? player1ReasoningEffortOverride
        : selectedIA1ReasoningEffort;
      const player2ReasoningEffortToUse = player2ReasoningEffortOverride !== undefined
        ? player2ReasoningEffortOverride
        : selectedIA2ReasoningEffort;

      const response = await fetch("http://localhost:2233/select_ai", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player1: player1ToUse,
          player2: player2ToUse,
          battleFormat: battleFormatToUse,
          battleType: battleTypeToUse,
          player1ReasoningEffort: player1ReasoningEffortToUse,
          player2ReasoningEffort: player2ReasoningEffortToUse
        })
      });

      if (response.ok) {
        setIsReady(true);
        navigate('/benchmark');
      } else {
        console.error("Failed to start battle:", response.statusText);
        alert("Échec du démarrage du combat. Veuillez réessayer.");
      }
    } catch (error) {
      console.error("Error starting battle:", error);
      alert("Erreur lors du démarrage du combat. Veuillez vérifier la connexion au serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const setTabForTeam = (teamIndex, tabIndex) => {
    const newTabs = [...teamTabs];
    newTabs[teamIndex] = tabIndex;
    setTeamTabs(newTabs);
  };

  return (
    <div className="app">
      <div
        className="app-background"
        style={{ backgroundImage: `url(${benchmarkBg})` }}
      />

      <div className="px-4 py-5 min-h-screen h-screen">
        {!apiStatus.connected ? (
          <div className="container mx-auto px-4 py-5 relative z-10 flex flex-col items-center justify-center min-h-screen">
            <div className=" p-8 rounded-xl max-w-md text-center">
              <div className="pokeball-avatar mx-auto mb-4"></div>
              <h1 className="text-3xl font-bold mb-4 text-white">Pokémon Stadium Benchmark</h1>

              <div className="relative py-4">
                <div className="loading-text text-white text-xl mb-4">
                  {apiStatus.message}
                </div>

                <div className="loading-container w-full h-3 bg-gray-700 rounded-full overflow-hidden mb-6">
                  <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"></div>
                </div>

                {!apiStatus.checking && !apiStatus.connected && (
                  <button
                    onClick={checkApiStatus}
                    className="button-primary mt-4 mx-auto block"
                  >
                    Retry Connection
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {page === 'benchmark' && (
              <BenchmarkPage
                selectedIA1={selectedIA1}
                selectedIA2={selectedIA2}
                teamTabs={teamTabs}
                setTabForTeam={setTabForTeam}
                teams={teams}
                chatLog={chatLog}
                ias={iaModels}
                battleData={battleData}
                serverState={serverState}
                setSelectedIA1={setSelectedIA1}
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
                endGameData={endGameData}
              />
            )}

            {page === 'statistics' && <StatsPage ias={iaModels} />}
          </>
        )}
      </div>
    </div>
  );
} 
