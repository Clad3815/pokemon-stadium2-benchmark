import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, 
    PolarRadiusAxis, Radar, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { ArrowLeft, RefreshCw, LayoutGrid, Layers, BarChart3, PieChart as PieChartIcon, 
         Table2, Award, Shield, Heart, Zap, Activity, Clock, BookOpen, Flame, Cpu, CircleAlert,
         Swords, Trophy, Skull } from 'lucide-react';

// --- Theme & Configuration ---

const COLORS = [
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#06b6d4', // cyan-500
    '#ec4899', // pink-500
    '#84cc16', // lime-500
    '#f97316', // orange-500
    '#6366f1', // indigo-500
];

const ATTACK_CATEGORY_COLORS = {
    Physical: '#ef4444',
    Special: '#3b82f6',
    Status: '#10b981',
    Unknown: '#64748b'
};

const chartTheme = {
    grid: { stroke: '#334155', strokeDasharray: '3 3' },
    axis: { stroke: '#64748b', fontSize: 12, tickLine: false, axisLine: false },
};

const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'models', label: 'Models', icon: Award },
    { id: 'pokemon', label: 'Pokémon', icon: Heart },
    { id: 'battles', label: 'Battles', icon: Swords },
    { id: 'moves', label: 'Moves', icon: Zap },
];

// --- Reusable UI Components ---

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl z-50">
                {label && <p className="text-slate-300 text-xs uppercase font-bold tracking-wider mb-3">{label}</p>}
                <div className="space-y-2">
                    {payload.map((entry, index) => {
                        const name = (entry.name || '').toString().replace('_', ' ');
                        return (
                            <div key={index} className="flex items-center justify-between gap-6">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: entry.color || entry.payload.fill }} />
                                    <span className="text-slate-300 text-sm font-medium capitalize">{name}:</span>
                                </div>
                                <span className="text-white font-bold">{entry.value}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    return null;
};

const Card = ({ title, icon: Icon, children, className = '', headerRight }) => (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col backdrop-blur-sm shadow-sm ${className}`}>
        {(title || headerRight) && (
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    {Icon && <Icon className="h-5 w-5 text-slate-400" />}
                    {title && <h3 className="font-semibold text-slate-200">{title}</h3>}
                </div>
                {headerRight && <div>{headerRight}</div>}
            </div>
        )}
        <div className="p-5 flex-1">
            {children}
        </div>
    </div>
);

const StatCard = ({ title, value, subtitle, icon: Icon, colorClass }) => (
    <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex items-start gap-4 shadow-sm backdrop-blur-sm">
        <div className={`p-3 rounded-xl ${colorClass} bg-opacity-10`}>
            <Icon className={`h-6 w-6 ${colorClass.replace('bg-', 'text-').replace('/10', '')}`} />
        </div>
        <div>
            <p className="text-slate-400 text-sm font-medium">{title}</p>
            <h4 className="text-2xl font-bold text-white mt-1">{value}</h4>
            {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
        </div>
    </div>
);

const SegmentedControl = ({ options, value, onChange }) => (
    <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-inner">
        {options.map(opt => (
            <button
                key={opt.id}
                onClick={() => onChange(opt.id)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                    value === opt.id 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
            >
                {opt.label}
            </button>
        ))}
    </div>
);

const PlayerBadge = ({ name, isWinner }) => (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${
        isWinner 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
            : 'bg-slate-800 text-slate-300 border-slate-700'
    }`}>
        {isWinner && <Trophy className="w-3 h-3 mr-1.5" />}
        {name}
    </span>
);

// --- Main Component ---

const StatsPage = ({ ias }) => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chartType, setChartType] = useState('grouped');
    const [activeTab, setActiveTab] = useState('overview');
    const [battleType, setBattleType] = useState('All');
    const [battleFormat, setBattleFormat] = useState('All');

    // Fetch data
    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const response = await fetch('http://localhost:2233/battle_stats');
                if (!response.ok) throw new Error(`Server error: ${response.status}`);
                const data = await response.json();
                setStats(data.battle_stats?.battles ? data : { battle_stats: { battles: [] } });
                setError(null);
            } catch (err) {
                console.error('Error fetching stats:', err);
                setError('Unable to load statistics.');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    // Memoized Data Processing
    const battles = useMemo(() => {
        const allBattles = stats?.battle_stats?.battles || [];
        return allBattles.filter(battle => {
            const typeMatch = battleType === 'All' || battle.battleType === battleType;
            const formatMatch = battleFormat === 'All' || battle.battleFormat === battleFormat;
            return typeMatch && formatMatch;
        });
    }, [stats, battleType, battleFormat]);

    const pokemonUsageData = useMemo(() => preparePokemonUsageData(battles, ias), [battles, ias]);
    const bannedPokemonData = useMemo(() => prepareBannedPokemonData(battles, ias), [battles, ias]);
    const modelComparisonData = useMemo(() => prepareModelComparisonData(battles, ias), [battles, ias]);
    const battleDecisionTypeData = useMemo(() => prepareBattleDecisionTypeData(battles), [battles]);
    const modelVsModelData = useMemo(() => prepareModelVsModelData(battles, ias), [battles, ias]);
    const modelByBattleLengthData = useMemo(() => prepareModelByBattleLengthData(battles, ias), [battles, ias]);
    const moveUsageData = useMemo(() => prepareMoveUsageData(battles), [battles]);
    const modelDecisionData = useMemo(() => prepareModelDecisionData(battles, ias), [battles, ias]);
    const typeDistributionData = useMemo(() => prepareTypeDistributionData(battles), [battles]);
    const turnAnalysisData = useMemo(() => prepareTurnAnalysisData(battles), [battles]);
    const pokemonSynergyData = useMemo(() => preparePokemonSynergyData(battles), [battles]);
    const formatWinRateData = useMemo(() => prepareFormatWinRateData(battles, ias), [battles, ias]);
    const durationByModelData = useMemo(() => prepareDurationByModelData(battles, ias), [battles, ias]);
    const attackCategoryData = useMemo(() => prepareAttackCategoryData(battles), [battles]);

    const handleManualRefresh = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:2233/battle_stats');
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            const data = await response.json();
            setStats(data.battle_stats?.battles ? data : { battle_stats: { battles: [] } });
            setError(null);
        } catch (err) {
            console.error('Error refreshing:', err);
            setError('Unable to load statistics.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#0B1120] text-slate-200 font-sans selection:bg-blue-500/30 pb-20">
            {/* Minimalist Background Pattern */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.02]" 
                 style={{ backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            
            {/* Ambient Gradients */}
            <div className="fixed top-0 left-1/4 w-1/2 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none z-0" />
            <div className="fixed bottom-0 right-1/4 w-1/2 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none z-0" />

            <div className="relative z-10 max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                        <button onClick={() => navigate('/')} className="text-sm font-medium text-slate-400 hover:text-white flex items-center gap-2 mb-4 transition-colors">
                            <ArrowLeft size={16} /> Back to Home
                        </button>
                        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-3">
                            Pokémon <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Statistics</span>
                        </h1>
                        <p className="text-slate-400 text-sm md:text-base max-w-xl leading-relaxed">
                            Detailed analysis of AI model performance, selections, and decisions.
                        </p>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3">
                        <button 
                            onClick={handleManualRefresh}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-2 px-4 rounded-xl transition-all shadow-sm font-medium text-sm"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 
                            Refresh
                        </button>
                        {stats?.battle_stats?.lastUpdated && (
                            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                <Clock size={12} /> Updated: {new Date(stats.battle_stats.lastUpdated).toLocaleTimeString()}
                            </div>
                        )}
                    </div>
                </div>

                {/* Filters Row */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-3 mb-8 flex flex-col xl:flex-row items-center justify-between gap-4 backdrop-blur-sm shadow-sm">
                    <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                                    activeTab === tab.id 
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' 
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                }`}
                            >
                                <tab.icon size={16} /> {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 w-full xl:w-auto overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <SegmentedControl 
                            options={[{ id: 'All', label: 'All' }, { id: '3vs3', label: '3v3' }, { id: '6vs6', label: '6v6' }]} 
                            value={battleType} 
                            onChange={setBattleType} 
                        />
                        <SegmentedControl 
                            options={[{ id: 'All', label: 'All' }, { id: 'single', label: 'BO1' }, { id: 'best3', label: 'BO3' }, { id: 'best5', label: 'BO5' }]} 
                            value={battleFormat} 
                            onChange={setBattleFormat} 
                        />
                    </div>
                </div>

                {/* Main Content Areas */}
                {loading && !stats ? (
                    <div className="flex flex-col items-center justify-center p-20 text-center border border-slate-800 rounded-2xl bg-slate-900/50 backdrop-blur-sm">
                        <RefreshCw className="h-10 w-10 text-blue-500 animate-spin mb-4" />
                        <p className="text-slate-300 font-medium">Loading data...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center p-20 text-center border border-rose-900/30 rounded-2xl bg-rose-900/10 backdrop-blur-sm">
                        <CircleAlert className="h-10 w-10 text-rose-500 mb-4" />
                        <p className="text-rose-400 font-medium mb-4">{error}</p>
                        <button onClick={() => window.location.reload()} className="bg-slate-800 text-white py-2 px-6 rounded-xl hover:bg-slate-700 transition-colors">
                            Retry
                        </button>
                    </div>
                ) : battles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 text-center border border-amber-900/30 rounded-2xl bg-amber-900/10 backdrop-blur-sm">
                        <CircleAlert className="h-12 w-12 text-amber-500 mb-4" />
                        <h3 className="text-xl font-semibold mb-2 text-white">No data available</h3>
                        <p className="text-amber-200/70 max-w-md">
                            No battles match your current filters.
                        </p>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setBattleType('All')} className="bg-slate-800 hover:bg-slate-700 text-white py-2 px-4 rounded-xl transition-colors text-sm">
                                Reset Type
                            </button>
                            <button onClick={() => setBattleFormat('All')} className="bg-slate-800 hover:bg-slate-700 text-white py-2 px-4 rounded-xl transition-colors text-sm">
                                Reset Format
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="animate-in fade-in duration-500">
                        {activeTab === 'overview' && (
                            <OverviewTab
                                battles={battles}
                                modelComparisonData={modelComparisonData}
                                battleDecisionTypeData={battleDecisionTypeData}
                                pokemonUsageData={pokemonUsageData}
                                moveUsageData={moveUsageData}
                                formatWinRateData={formatWinRateData}
                                durationByModelData={durationByModelData}
                                attackCategoryData={attackCategoryData}
                            />
                        )}
                        {activeTab === 'models' && (
                            <ModelsTab
                                modelComparisonData={modelComparisonData}
                                chartType={chartType}
                                setChartType={setChartType}
                                modelVsModelData={modelVsModelData}
                                modelByBattleLengthData={modelByBattleLengthData}
                                modelDecisionData={modelDecisionData}
                            />
                        )}
                        {activeTab === 'pokemon' && (
                            <PokemonTab
                                pokemonUsageData={pokemonUsageData}
                                bannedPokemonData={bannedPokemonData}
                                typeDistributionData={typeDistributionData}
                                pokemonSynergyData={pokemonSynergyData}
                                battles={battles}
                            />
                        )}
                        {activeTab === 'battles' && (
                            <BattlesTab
                                battleDecisionTypeData={battleDecisionTypeData}
                                turnAnalysisData={turnAnalysisData}
                                battles={battles}
                                ias={ias}
                            />
                        )}
                        {activeTab === 'moves' && (
                            <MovesTab moveUsageData={moveUsageData} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Tabs Components ---

const OverviewTab = ({
    battles,
    modelComparisonData,
    battleDecisionTypeData,
    pokemonUsageData,
    moveUsageData,
    formatWinRateData,
    durationByModelData,
    attackCategoryData
}) => {
    const topDecision = [...battleDecisionTypeData].sort((a, b) => b.value - a.value)[0];
    const formatRows = formatWinRateData
        .slice(0, 6)
        .flatMap(formatGroup =>
            (formatGroup.models || []).slice(0, 3).map(model => ({
                key: `${formatGroup.formatKey}-${model.modelId}`,
                formatLabel: `${formatGroup.battleType || 'Unknown'} / ${formatGroup.battleFormat || 'Unknown'}`,
                ...model
            }))
        );
    const attackCategoryTotal = attackCategoryData.reduce((acc, category) => acc + (category.value || 0), 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Battles" value={battles.length} icon={Swords} colorClass="text-blue-500 bg-blue-500" />
                <StatCard title="Active Models" value={modelComparisonData.length} icon={Award} colorClass="text-emerald-500 bg-emerald-500" />
                <StatCard title="Top Pokémon" value={pokemonUsageData[0]?.name || 'N/A'} icon={Heart} colorClass="text-rose-500 bg-rose-500" subtitle={`${pokemonUsageData[0]?.count || 0} selections`} />
                <StatCard title="Top Decision" value={topDecision?.name ? topDecision.name.replace('_', ' ') : 'N/A'} icon={Activity} colorClass="text-amber-500 bg-amber-500" className="capitalize" />
            </div>

            <Card title="Top Models (Win Rate)" icon={Award} className="md:col-span-12 lg:col-span-6 h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={modelComparisonData.slice(0, 5)} margin={{ top: 10, right: 20, left: -20, bottom: 0 }} layout="vertical">
                        <CartesianGrid {...chartTheme.grid} horizontal={true} vertical={false} />
                        <XAxis type="number" {...chartTheme.axis} />
                        <YAxis dataKey="name" type="category" {...chartTheme.axis} width={85} tickFormatter={(val) => val.length > 10 ? `${val.substring(0, 10)}...` : val} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
                        <Bar dataKey="Win Rate (%)" name="Win Rate (%)" radius={[0, 4, 4, 0]}>
                            {modelComparisonData.slice(0, 5).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </Card>

            <Card title="Decision Types" icon={PieChartIcon} className="md:col-span-12 lg:col-span-6 h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={battleDecisionTypeData}
                            cx="50%" cy="45%"
                            innerRadius={70} outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {battleDecisionTypeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} formatter={(val) => <span className="capitalize">{val.replace('_', ' ')}</span>} />
                    </PieChart>
                </ResponsiveContainer>
            </Card>

            <Card title="Win Rate by Format" icon={Shield} className="md:col-span-12">
                {formatRows.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-sm text-slate-500">No format win rate data available.</div>
                ) : (
                    <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <table className="w-full text-left border-collapse min-w-[760px]">
                            <thead>
                                <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                                    <th className="pb-3 font-medium px-4">Format</th>
                                    <th className="pb-3 font-medium px-4">Model</th>
                                    <th className="pb-3 font-medium px-4 text-center">Games</th>
                                    <th className="pb-3 font-medium px-4 text-center">W-L</th>
                                    <th className="pb-3 font-medium px-4 text-center">Win Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {formatRows.map(row => (
                                    <tr key={row.key} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="py-3 px-4 text-sm text-slate-300">{row.formatLabel}</td>
                                        <td className="py-3 px-4 text-sm text-slate-100 font-medium">{row.name}</td>
                                        <td className="py-3 px-4 text-center text-slate-300 text-sm">{row.games}</td>
                                        <td className="py-3 px-4 text-center text-slate-300 text-sm">{row.wins} - {row.losses}</td>
                                        <td className="py-3 px-4 text-center text-sky-400 font-semibold text-sm">{row.winRate}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Card title="Duration / Turns by Model" icon={Clock} className="md:col-span-12 lg:col-span-7">
                {durationByModelData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-sm text-slate-500">No model duration data available.</div>
                ) : (
                    <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <table className="w-full text-left border-collapse min-w-[680px]">
                            <thead>
                                <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                                    <th className="pb-3 font-medium px-4">Model</th>
                                    <th className="pb-3 font-medium px-4 text-center">Games</th>
                                    <th className="pb-3 font-medium px-4 text-center">Avg Turns</th>
                                    <th className="pb-3 font-medium px-4 text-center">Avg Duration</th>
                                    <th className="pb-3 font-medium px-4 text-center">Win Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {durationByModelData.slice(0, 10).map(model => (
                                    <tr key={model.modelId} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="py-3 px-4 text-sm text-slate-100 font-medium">{model.name}</td>
                                        <td className="py-3 px-4 text-center text-slate-300 text-sm">{model.games}</td>
                                        <td className="py-3 px-4 text-center text-slate-300 text-sm">{model.averageTurns}</td>
                                        <td className="py-3 px-4 text-center text-slate-300 text-sm">{model.averageDuration}s</td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.max(0, Math.min(100, model.winRate))}%` }} />
                                                </div>
                                                <span className="text-sky-400 font-semibold text-sm w-10 text-right">{model.winRate}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Card title="Attack Category Split" icon={PieChartIcon} className="md:col-span-12 lg:col-span-5 h-[420px]">
                {attackCategoryData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-slate-500">No attack category data available.</div>
                ) : (
                    <div className="h-full grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="h-[240px] xl:h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={attackCategoryData}
                                        cx="50%" cy="50%"
                                        innerRadius={58} outerRadius={92}
                                        dataKey="value"
                                        nameKey="name"
                                        paddingAngle={3}
                                        stroke="none"
                                    >
                                        {attackCategoryData.map((entry) => (
                                            <Cell key={`attack-category-${entry.name}`} fill={ATTACK_CATEGORY_COLORS[entry.name] || ATTACK_CATEGORY_COLORS.Unknown} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-3 xl:my-auto">
                            {attackCategoryData.map(category => (
                                <div key={category.name} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ATTACK_CATEGORY_COLORS[category.name] || ATTACK_CATEGORY_COLORS.Unknown }} />
                                            <span className="text-sm text-slate-200 font-medium">{category.name}</span>
                                        </div>
                                        <span className="text-sm text-sky-400 font-semibold">{category.percentage}%</span>
                                    </div>
                                    <div className="text-xs text-slate-400">{category.value} uses</div>
                                </div>
                            ))}
                            <div className="text-xs text-slate-500 pt-1">Total counted attacks: {attackCategoryTotal}</div>
                        </div>
                    </div>
                )}
            </Card>

            <Card title="Most Used Moves" icon={Zap} className="md:col-span-12 h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={moveUsageData.slice(0, 10)} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid {...chartTheme.grid} vertical={false} />
                        <XAxis dataKey="name" {...chartTheme.axis} angle={-25} textAnchor="end" height={60} />
                        <YAxis {...chartTheme.axis} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
                        <Bar dataKey="count" name="Uses" radius={[4, 4, 0, 0]}>
                            {moveUsageData.slice(0, 10).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </Card>
        </div>
    );
};

const ModelsTab = ({ modelComparisonData, chartType, setChartType, modelVsModelData, modelByBattleLengthData, modelDecisionData }) => (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <Card 
            title="Overall Performance" 
            icon={BarChart3} 
            className="md:col-span-12 h-[450px]"
            headerRight={
                <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5 shadow-inner">
                    <button onClick={() => setChartType('grouped')} className={`px-3 py-1 text-xs rounded-md transition-all ${chartType === 'grouped' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Grouped</button>
                    <button onClick={() => setChartType('stacked')} className={`px-3 py-1 text-xs rounded-md transition-all ${chartType === 'stacked' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Stacked</button>
                </div>
            }
        >
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                    <CartesianGrid {...chartTheme.grid} vertical={false} />
                    <XAxis dataKey="name" {...chartTheme.axis} angle={-25} textAnchor="end" height={80} interval={0} />
                    <YAxis {...chartTheme.axis} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                    <Bar name="Battles" dataKey="Battles" fill="#10b981" radius={chartType === 'grouped' ? [3, 3, 0, 0] : 0} stackId={chartType === 'stacked' ? 'a' : undefined} />
                    <Bar name="Victories" dataKey="Victories" fill="#3b82f6" radius={chartType === 'grouped' ? [3, 3, 0, 0] : 0} stackId={chartType === 'stacked' ? 'a' : undefined} />
                    <Bar name="Defeats" dataKey="Defeats" fill="#ef4444" radius={chartType === 'grouped' ? [3, 3, 0, 0] : [3, 3, 0, 0]} stackId={chartType === 'stacked' ? 'a' : undefined} />
                </BarChart>
            </ResponsiveContainer>
        </Card>

        <Card title="Behavior by Model" icon={PieChartIcon} className="md:col-span-12 lg:col-span-6 h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelDecisionData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }} stackOffset="expand">
                    <CartesianGrid {...chartTheme.grid} vertical={false} />
                    <XAxis dataKey="name" {...chartTheme.axis} angle={-25} textAnchor="end" height={80} />
                    <YAxis {...chartTheme.axis} tickFormatter={(tick) => `${(tick * 100).toFixed(0)}%`} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                    <Bar name="Attack" dataKey="attackPercentage" fill="#ef4444" stackId="a" />
                    <Bar name="Switch" dataKey="switchPercentage" fill="#3b82f6" stackId="a" />
                    <Bar name="Other" dataKey="otherPercentage" fill="#f59e0b" stackId="a" />
                </BarChart>
            </ResponsiveContainer>
        </Card>

        <Card title="Performance by Battle Length" icon={Clock} className="md:col-span-12 lg:col-span-6 h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelByBattleLengthData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                    <CartesianGrid {...chartTheme.grid} vertical={false} />
                    <XAxis dataKey="name" {...chartTheme.axis} angle={-25} textAnchor="end" height={80} />
                    <YAxis {...chartTheme.axis} tickFormatter={(val) => `${val}%`} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                    <Bar dataKey="Short Battles (≤5)" name="Short (≤5)" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Medium Battles (6-10)" name="Medium (6-10)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Long Battles (>10)" name="Long (>10)" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </Card>

        <Card title="Head-to-Head Matchups" icon={Swords} className="md:col-span-12">
            <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                        <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                            <th className="pb-3 font-medium px-4 w-1/3">Matchup</th>
                            <th className="pb-3 font-medium px-4 text-center">Battles</th>
                            <th className="pb-3 font-medium px-4 text-center">Score</th>
                            <th className="pb-3 font-medium px-4 text-center">Win Rate</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {modelVsModelData.map((data, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/20 transition-colors group">
                                <td className="py-4 px-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-blue-400 font-medium text-sm w-1/2 text-right truncate">{data.model1Name}</span>
                                        <span className="text-slate-600 text-[10px] font-bold px-1.5 py-0.5 bg-slate-800 rounded">VS</span>
                                        <span className="text-rose-400 font-medium text-sm w-1/2 text-left truncate">{data.model2Name}</span>
                                    </div>
                                </td>
                                <td className="py-4 px-4 text-center text-slate-300 text-sm">{data.totalBattles}</td>
                                <td className="py-4 px-4 text-center">
                                    <span className="text-blue-400 font-bold">{data.model1Wins}</span>
                                    <span className="text-slate-600 mx-2">-</span>
                                    <span className="text-rose-400 font-bold">{data.model2Wins}</span>
                                </td>
                                <td className="py-4 px-4">
                                    <div className="flex items-center justify-center gap-3">
                                        <span className="text-xs text-blue-400 w-10 text-right font-medium">{data.model1WinRate}%</span>
                                        <div className="w-32 h-2 bg-slate-800 rounded-full flex overflow-hidden">
                                            <div className="bg-blue-500 h-full transition-all" style={{ width: `${data.model1WinRate}%` }} />
                                            <div className="bg-rose-500 h-full transition-all" style={{ width: `${data.model2WinRate}%` }} />
                                        </div>
                                        <span className="text-xs text-rose-400 w-10 text-left font-medium">{data.model2WinRate}%</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    </div>
);

const PokemonTab = ({ pokemonUsageData, bannedPokemonData, typeDistributionData, pokemonSynergyData, battles }) => {
    const totalBattles = battles.length;
    const maxPossible = totalBattles * 2;

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <Card title="Most Used Pokémon" icon={Heart} className="md:col-span-12 lg:col-span-8 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pokemonUsageData.slice(0, 10)} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid {...chartTheme.grid} vertical={false} />
                        <XAxis dataKey="name" {...chartTheme.axis} angle={-25} textAnchor="end" height={60} />
                        <YAxis {...chartTheme.axis} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
                        <Bar dataKey="count" name="Selections" radius={[4, 4, 0, 0]}>
                            {pokemonUsageData.slice(0, 10).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </Card>

            <Card title="Selection Rate" icon={Activity} className="md:col-span-12 lg:col-span-4 h-[400px]">
                <div className="space-y-4 overflow-y-auto h-full pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {pokemonUsageData.slice(0, 12).map((pokemon, idx) => {
                        const rate = (pokemon.count / maxPossible) * 100;
                        return (
                            <div key={idx}>
                                <div className="flex justify-between items-end mb-1.5">
                                    <span className="font-medium text-slate-200 text-sm">{pokemon.name}</span>
                                    <span className="text-blue-400 font-bold text-xs">{rate.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-slate-800/80 rounded-full h-1.5 mb-1.5 shadow-inner">
                                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${rate}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                                </div>
                                <div className="text-[10px] text-slate-500">
                                    {pokemon.count} selections out of {maxPossible} possible
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            <Card title="Type Distribution" icon={PieChartIcon} className="md:col-span-12 lg:col-span-6 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie 
                            data={typeDistributionData} 
                            cx="50%" cy="50%" 
                            innerRadius={60} outerRadius={100} 
                            paddingAngle={2}
                            dataKey="count"
                            nameKey="type"
                            stroke="none"
                        >
                            {typeDistributionData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                    </PieChart>
                </ResponsiveContainer>
            </Card>

            <Card title="Most Banned Pokémon" icon={Skull} className="md:col-span-12 lg:col-span-6 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bannedPokemonData.slice(0, 8).map(i => ({ name: i.name, count: i.total }))} margin={{ top: 10, right: 20, left: -20, bottom: 0 }} layout="vertical">
                        <CartesianGrid {...chartTheme.grid} horizontal={true} vertical={false} />
                        <XAxis type="number" {...chartTheme.axis} />
                        <YAxis dataKey="name" type="category" {...chartTheme.axis} width={80} tickFormatter={(val) => val.length > 10 ? val.substring(0,10)+'...' : val} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
                        <Bar dataKey="count" name="Banned" radius={[0, 4, 4, 0]}>
                            {bannedPokemonData.slice(0, 8).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </Card>

            <Card title="Best Synergies" icon={Layers} className="md:col-span-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pokemonSynergyData.slice(0, 9).map((pair, index) => (
                        <div key={index} className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-xl hover:bg-slate-800/50 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded text-xs font-medium">{pair.pokemon1}</span>
                                    <span className="text-slate-600 font-bold">+</span>
                                    <span className="px-2 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded text-xs font-medium">{pair.pokemon2}</span>
                                </div>
                                <span className="text-amber-400 font-bold text-sm">{pair.winRate.toFixed(1)}% WR</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-400">
                                <span>{pair.count} matches together</span>
                                <span>{pair.wins}W - {pair.losses}L</span>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};

const BattlesTab = ({ battleDecisionTypeData, turnAnalysisData, battles, ias }) => (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <Card title="Action Distribution by Turn" icon={Activity} className="md:col-span-12 h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={turnAnalysisData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid {...chartTheme.grid} vertical={false} />
                    <XAxis dataKey="turn" {...chartTheme.axis} />
                    <YAxis {...chartTheme.axis} tickFormatter={(val) => `${val}%`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                    <Line type="monotone" dataKey="attackRate" name="Attack (%)" stroke="#ef4444" strokeWidth={3} dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="switchRate" name="Switch (%)" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </LineChart>
            </ResponsiveContainer>
        </Card>

        <Card title="Full History" icon={Table2} className="md:col-span-12">
            <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                            <th className="pb-3 font-medium px-4">ID / Date</th>
                            <th className="pb-3 font-medium px-4">Player 1</th>
                            <th className="pb-3 font-medium px-4 text-center">VS</th>
                            <th className="pb-3 font-medium px-4">Player 2</th>
                            <th className="pb-3 font-medium px-4 text-center">Turns</th>
                            <th className="pb-3 font-medium px-4 text-center">Duration</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {[...battles].reverse().slice(0, 15).map((battle) => {
                            const p1Winner = battle.winner === 1;
                            const p2Winner = battle.winner === 2;
                            return (
                                <tr key={battle.id} className="hover:bg-slate-800/20 transition-colors group">
                                    <td className="py-3 px-4">
                                        <div className="text-sm font-medium text-slate-300">{String(battle.id).substring(0,8)}...</div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">{new Date(battle.timestamp).toLocaleString()}</div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <PlayerBadge name={getPlayerModelName(battle.player1, ias)} isWinner={p1Winner} />
                                    </td>
                                    <td className="py-3 px-4 text-center text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded">VS</td>
                                    <td className="py-3 px-4">
                                        <PlayerBadge name={getPlayerModelName(battle.player2, ias)} isWinner={p2Winner} />
                                    </td>
                                    <td className="py-3 px-4 text-center text-slate-400 text-sm font-medium">{battle.turns}</td>
                                    <td className="py-3 px-4 text-center text-slate-400 text-sm font-medium">{battle.duration}s</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    </div>
);

const MovesTab = ({ moveUsageData }) => {
    const moveTypes = moveUsageData.reduce((acc, move) => {
        const type = move.type || "Unknown";
        const existingType = acc.find(t => t.name === type);
        if (existingType) {
            existingType.value += move.count;
        } else {
            acc.push({ name: type, value: move.count });
        }
        return acc;
    }, []);

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <Card title="Most Used Moves" icon={Zap} className="md:col-span-12 lg:col-span-8 h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={moveUsageData.slice(0, 15)} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                        <CartesianGrid {...chartTheme.grid} vertical={false} />
                        <XAxis dataKey="name" {...chartTheme.axis} angle={-25} textAnchor="end" height={80} />
                        <YAxis {...chartTheme.axis} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
                        <Bar dataKey="count" name="Uses" radius={[4, 4, 0, 0]}>
                            {moveUsageData.slice(0, 15).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </Card>

            <Card title="Move Types" icon={PieChartIcon} className="md:col-span-12 lg:col-span-4 h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie 
                            data={moveTypes} 
                            cx="50%" cy="50%" 
                            innerRadius={50} outerRadius={100} 
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                        >
                            {moveTypes.map((type, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                    </PieChart>
                </ResponsiveContainer>
            </Card>
        </div>
    );
};

// --- Data Processing Utilities (kept intact) ---

const normalizeText = (value, fallback) => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed || fallback;
};

const safeNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeReasoningEffort = (value) => {
    if (typeof value !== 'string') {
        return 'default';
    }

    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === 'default') {
        return 'default';
    }

    return normalized;
};

const getPlayerModelKey = (player) => {
    const modelStatKey = normalizeText(player?.modelStatKey, '');
    if (modelStatKey) {
        return modelStatKey;
    }

    const modelId = normalizeText(player?.model, 'Unknown Model');
    const reasoningEffort = normalizeReasoningEffort(player?.reasoningEffort);
    return `${modelId}::${reasoningEffort}`;
};

const getPlayerModelName = (player, ias) => {
    const modelDisplayName = normalizeText(player?.modelDisplayName, '');
    if (modelDisplayName) {
        return modelDisplayName;
    }

    const modelId = normalizeText(player?.model, 'Unknown Model');
    const baseName = ias?.[modelId]?.name || modelId;
    const reasoningEffort = normalizeReasoningEffort(player?.reasoningEffort);

    return reasoningEffort !== 'default'
        ? `${baseName} (${reasoningEffort})`
        : baseName;
};

const prepareFormatWinRateData = (battles, ias) => {
    if (!Array.isArray(battles) || battles.length === 0) return [];
    const formatMap = {};

    battles.forEach(battle => {
        const safeBattleType = normalizeText(battle?.battleType, 'Unknown Type');
        const safeBattleFormat = normalizeText(battle?.battleFormat, 'Unknown Format');
        const formatKey = `${safeBattleType} / ${safeBattleFormat}`;

        if (!formatMap[formatKey]) {
            formatMap[formatKey] = {
                formatKey,
                battleType: safeBattleType,
                battleFormat: safeBattleFormat,
                models: {}
            };
        }

        [
            { player: battle?.player1, isWinner: battle?.winner === 1 },
            { player: battle?.player2, isWinner: battle?.winner === 2 }
        ].forEach(({ player, isWinner }) => {
            const modelId = getPlayerModelKey(player);
            const modelName = getPlayerModelName(player, ias);

            if (!formatMap[formatKey].models[modelId]) {
                formatMap[formatKey].models[modelId] = { games: 0, wins: 0, name: modelName };
            }

            formatMap[formatKey].models[modelId].games += 1;
            if (isWinner) formatMap[formatKey].models[modelId].wins += 1;
        });
    });

    return Object.values(formatMap)
        .map(formatGroup => {
            const models = Object.entries(formatGroup.models)
                .map(([modelId, modelStats]) => {
                    const games = modelStats?.games || 0;
                    const wins = modelStats?.wins || 0;
                    const losses = Math.max(0, games - wins);
                    const winRate = games > 0 ? (wins / games) * 100 : 0;

                    return {
                        modelId,
                        name: modelStats?.name || modelId,
                        games,
                        wins,
                        losses,
                        winRate: parseFloat(winRate.toFixed(1))
                    };
                })
                .sort((a, b) => b.games - a.games || b.wins - a.wins || a.losses - b.losses);

            return {
                ...formatGroup,
                models,
                totalGames: models.reduce((acc, model) => acc + model.games, 0)
            };
        })
        .sort((a, b) => b.totalGames - a.totalGames || a.formatKey.localeCompare(b.formatKey));
};

const prepareDurationByModelData = (battles, ias) => {
    if (!Array.isArray(battles) || battles.length === 0) return [];
    const modelMap = {};

    battles.forEach(battle => {
        const turns = safeNumber(battle?.turns);
        const duration = safeNumber(battle?.duration);

        [
            { player: battle?.player1, isWinner: battle?.winner === 1 },
            { player: battle?.player2, isWinner: battle?.winner === 2 }
        ].forEach(({ player, isWinner }) => {
            const modelId = getPlayerModelKey(player);
            const modelName = getPlayerModelName(player, ias);

            if (!modelMap[modelId]) {
                modelMap[modelId] = {
                    modelId,
                    name: modelName,
                    games: 0,
                    wins: 0,
                    totalTurns: 0,
                    totalDuration: 0
                };
            }

            modelMap[modelId].games += 1;
            modelMap[modelId].totalTurns += turns;
            modelMap[modelId].totalDuration += duration;
            if (isWinner) modelMap[modelId].wins += 1;
        });
    });

    return Object.values(modelMap)
        .map(model => {
            const games = model.games || 0;
            const wins = model.wins || 0;
            const losses = Math.max(0, games - wins);
            const averageTurns = games > 0 ? model.totalTurns / games : 0;
            const averageDuration = games > 0 ? model.totalDuration / games : 0;
            const winRate = games > 0 ? (wins / games) * 100 : 0;

            return {
                name: model.name || model.modelId,
                modelId: model.modelId,
                games,
                wins,
                losses,
                averageTurns: parseFloat(averageTurns.toFixed(1)),
                averageDuration: parseFloat(averageDuration.toFixed(1)),
                winRate: parseFloat(winRate.toFixed(1))
            };
        })
        .sort((a, b) => b.games - a.games || b.wins - a.wins || a.name.localeCompare(b.name));
};

const prepareAttackCategoryData = (battles) => {
    if (!Array.isArray(battles) || battles.length === 0) return [];
    const categoryCount = { Physical: 0, Special: 0, Status: 0, Unknown: 0 };

    const normalizeCategory = (category) => {
        if (typeof category !== 'string') return 'Unknown';
        const lowerCategory = category.trim().toLowerCase();
        if (lowerCategory === 'physical') return 'Physical';
        if (lowerCategory === 'special') return 'Special';
        if (lowerCategory === 'status') return 'Status';
        return 'Unknown';
    };

    battles.forEach(battle => {
        [...(battle?.player1?.decisions || []), ...(battle?.player2?.decisions || [])].forEach(decision => {
            if (decision?.type !== 'attack') return;
            const normalizedCategory = normalizeCategory(decision?.moveData?.category);
            categoryCount[normalizedCategory] += 1;
        });
    });

    const total = Object.values(categoryCount).reduce((acc, value) => acc + value, 0);
    if (total === 0) return [];

    return ['Physical', 'Special', 'Status', 'Unknown']
        .filter(category => categoryCount[category] > 0)
        .map(category => ({
            name: category,
            value: categoryCount[category],
            percentage: parseFloat(((categoryCount[category] / total) * 100).toFixed(1))
        }));
};

const preparePokemonUsageData = (battles, ias) => {
    if (!battles.length) return [];
    const usageMap = {};
    battles.forEach(battle => {
        [battle.player1, battle.player2].forEach((player) => {
            const model = getPlayerModelKey(player);
            const team = player.finalTeam;
            (team || []).forEach(p => {
                if (!usageMap[p.name]) usageMap[p.name] = { count: 0, byModel: {} };
                usageMap[p.name].count += 1;
                usageMap[p.name].byModel[model] = (usageMap[p.name].byModel[model] || 0) + 1;
            });
        });
    });
    return Object.entries(usageMap).map(([name, data]) => ({
        name,
        count: data.count,
        byModel: data.byModel
    })).sort((a, b) => b.count - a.count).slice(0, 50);
};

const prepareBannedPokemonData = (battles, ias) => {
    if (!battles.length) return [];
    const bannedMap = {};
    battles.forEach(battle => {
        [battle.player1, battle.player2].forEach(player => {
            const modelKey = getPlayerModelKey(player);
            if (player.bannedPokemon?.pokemonIds) {
                player.bannedPokemon.pokemonIds.forEach(p => {
                    if (!bannedMap[p.name]) bannedMap[p.name] = { total: 0, byModel: {} };
                    bannedMap[p.name].total += 1;
                    bannedMap[p.name].byModel[modelKey] = (bannedMap[p.name].byModel[modelKey] || 0) + 1;
                });
            }
        });
    });
    return Object.entries(bannedMap).map(([name, data]) => ({
        name,
        total: data.total,
        byModel: data.byModel
    })).sort((a, b) => b.total - a.total).slice(0, 50);
};

const prepareModelComparisonData = (battles, ias) => {
    if (!battles.length) return [];
    const modelMap = {};
    battles.forEach(battle => {
        const m1 = getPlayerModelKey(battle.player1);
        const m2 = getPlayerModelKey(battle.player2);
        const m1Name = getPlayerModelName(battle.player1, ias);
        const m2Name = getPlayerModelName(battle.player2, ias);
        if (!modelMap[m1]) modelMap[m1] = { name: m1Name, battles: 0, wins: 0 };
        if (!modelMap[m2]) modelMap[m2] = { name: m2Name, battles: 0, wins: 0 };
        modelMap[m1].battles += 1;
        modelMap[m2].battles += 1;
        if (battle.winner === 1) modelMap[m1].wins += 1;
        else if (battle.winner === 2) modelMap[m2].wins += 1;
    });
    return Object.entries(modelMap).map(([model, stats]) => {
        const losses = stats.battles - stats.wins;
        const winRate = stats.battles > 0 ? (stats.wins / stats.battles) * 100 : 0;
        return {
            name: stats.name || model,
            modelId: model,
            'Battles': stats.battles,
            'Victories': stats.wins,
            'Defeats': losses,
            'Win Rate (%)': parseFloat(winRate.toFixed(1)),
        };
    }).sort((a, b) => b['Battles'] - a['Battles'] || b['Victories'] - a['Victories'] || a['Defeats'] - b['Defeats']);
};

const prepareBattleDecisionTypeData = (battles) => {
    if (!battles.length) return [];
    const decisionsCount = { attack: 0, switch_pokemon: 0, ready: 0 };
    battles.forEach(battle => {
        [...(battle.player1.decisions || []), ...(battle.player2.decisions || [])].forEach(d => {
            if (d.type in decisionsCount) decisionsCount[d.type] += 1;
        });
    });
    return Object.entries(decisionsCount).map(([name, value]) => ({ name, value }));
};

const getTopModels = (battles) => {
    if (!battles.length) return [];
    const modelCount = {};
    battles.forEach(battle => {
        [getPlayerModelKey(battle.player1), getPlayerModelKey(battle.player2)].forEach(m => {
            modelCount[m] = (modelCount[m] || 0) + 1;
        });
    });
    return Object.entries(modelCount).sort((a, b) => b[1] - a[1]).map(([model]) => model).slice(0, 5);
};

const prepareModelVsModelData = (battles, ias) => {
    if (!battles.length) return [];
    const confrontations = {};
    battles.forEach(battle => {
        const player1Model = getPlayerModelKey(battle.player1);
        const player2Model = getPlayerModelKey(battle.player2);
        const player1Name = getPlayerModelName(battle.player1, ias);
        const player2Name = getPlayerModelName(battle.player2, ias);
        const [modelA, modelB] = [player1Model, player2Model].sort();
        if (modelA === modelB) return;
        const modelPair = `${modelA}-vs-${modelB}`;
        if (!confrontations[modelPair]) {
            confrontations[modelPair] = {
                total: 0,
                modelA,
                modelB,
                wins: { [modelA]: 0, [modelB]: 0 },
                names: {}
            };
        }
        confrontations[modelPair].names[player1Model] = player1Name;
        confrontations[modelPair].names[player2Model] = player2Name;
        confrontations[modelPair].total += 1;
        if (battle.winner === 1) confrontations[modelPair].wins[player1Model] += 1;
        else if (battle.winner === 2) confrontations[modelPair].wins[player2Model] += 1;
    });
    return Object.values(confrontations).map(data => ({
        confrontation: `${data.modelA}-vs-${data.modelB}`,
        model1: data.modelA,
        model2: data.modelB,
        model1Name: data.names[data.modelA] || data.modelA,
        model2Name: data.names[data.modelB] || data.modelB,
        totalBattles: data.total,
        model1Wins: data.wins[data.modelA],
        model2Wins: data.wins[data.modelB],
        model1WinRate: data.total > 0 ? parseFloat((data.wins[data.modelA] / data.total * 100).toFixed(1)) : 0,
        model2WinRate: data.total > 0 ? parseFloat((data.wins[data.modelB] / data.total * 100).toFixed(1)) : 0
    })).sort((a, b) => b.totalBattles - a.totalBattles);
};

const prepareModelByBattleLengthData = (battles, ias) => {
    if (!battles.length) return [];
    const modelPerformance = {};
    const topModels = getTopModels(battles);
    topModels.forEach(modelId => {
        modelPerformance[modelId] = { name: modelId, short: { battles: 0, wins: 0 }, medium: { battles: 0, wins: 0 }, long: { battles: 0, wins: 0 } };
    });
    battles.forEach(battle => {
        const turns = battle.turns || 0;
        const lengthCategory = turns <= 5 ? 'short' : turns <= 10 ? 'medium' : 'long';
        [
            { player: battle.player1, isWinner: battle.winner === 1 },
            { player: battle.player2, isWinner: battle.winner === 2 }
        ].forEach(({ player, isWinner }) => {
            const model = getPlayerModelKey(player);
            const modelName = getPlayerModelName(player, ias);
            if (!modelPerformance[model]) return;
            modelPerformance[model].name = modelName;
            modelPerformance[model][lengthCategory].battles += 1;
            if (isWinner) modelPerformance[model][lengthCategory].wins += 1;
        });
    });
    return Object.entries(modelPerformance).map(([modelId, performance]) => {
        const shortWinRate = performance.short.battles > 0 ? (performance.short.wins / performance.short.battles) * 100 : 0;
        const mediumWinRate = performance.medium.battles > 0 ? (performance.medium.wins / performance.medium.battles) * 100 : 0;
        const longWinRate = performance.long.battles > 0 ? (performance.long.wins / performance.long.battles) * 100 : 0;
        return {
            name: performance.name || modelId,
            modelId,
            'Short Battles (≤5)': parseFloat(shortWinRate.toFixed(1)),
            'Medium Battles (6-10)': parseFloat(mediumWinRate.toFixed(1)),
            'Long Battles (>10)': parseFloat(longWinRate.toFixed(1)),
            shortBattles: performance.short.battles,
            shortWins: performance.short.wins,
            mediumBattles: performance.medium.battles,
            mediumWins: performance.medium.wins,
            longBattles: performance.long.battles,
            longWins: performance.long.wins
        };
    });
};

const prepareMoveUsageData = (battles) => {
    if (!battles.length) return [];
    const moveMap = {};
    
    battles.forEach(battle => {
        [battle.player1, battle.player2].forEach(player => {
            const decisions = player.decisions || [];
            decisions.forEach(decision => {
                if (decision.type === 'attack' && decision.moveData) {
                    const moveName = decision.moveData.name;
                    const moveType = decision.moveData.type;
                    
                    if (!moveMap[moveName]) {
                        moveMap[moveName] = { 
                            name: moveName, 
                            count: 0,
                            type: moveType,
                            power: decision.moveData.power !== "—" ? parseInt(decision.moveData.power) || 0 : 0,
                            accuracy: decision.moveData.accuracy !== "—" ? parseInt(decision.moveData.accuracy) || 0 : 0
                        };
                    }
                    moveMap[moveName].count += 1;
                }
            });
        });
    });
    
    return Object.values(moveMap).sort((a, b) => b.count - a.count);
};

const prepareModelDecisionData = (battles, ias) => {
    if (!battles.length) return [];
    const modelData = {};
    
    battles.forEach(battle => {
        [
            { player: battle.player1, winner: battle.winner === 1 },
            { player: battle.player2, winner: battle.winner === 2 }
        ].forEach(({ player, winner }) => {
            const modelId = getPlayerModelKey(player);
            const modelName = getPlayerModelName(player, ias);
            if (!modelData[modelId]) {
                modelData[modelId] = {
                    name: modelName,
                    modelId,
                    attacks: 0,
                    switches: 0,
                    other: 0,
                    total: 0,
                    totalDecisions: 0,
                    wins: 0,
                    battles: 0
                };
            }
            
            modelData[modelId].battles += 1;
            if (winner) modelData[modelId].wins += 1;
            
            (player.decisions || []).forEach((decision, index) => {
                modelData[modelId].total += 1;
                modelData[modelId].totalDecisions += 1;
                
                if (decision.type === 'attack') {
                    modelData[modelId].attacks += 1;
                } 
                else if (decision.type === 'switch_pokemon') {
                    modelData[modelId].switches += 1;
                } 
                else {
                    modelData[modelId].other += 1;
                }
            });
        });
    });
    
    return Object.values(modelData).map(model => ({
        name: model.name,
        modelId: model.modelId,
        attackPercentage: model.total > 0 ? parseFloat(((model.attacks / model.total) * 100).toFixed(1)) : 0,
        switchPercentage: model.total > 0 ? parseFloat(((model.switches / model.total) * 100).toFixed(1)) : 0,
        otherPercentage: model.total > 0 ? parseFloat(((model.other / model.total) * 100).toFixed(1)) : 0,
        winRate: model.battles > 0 ? parseFloat(((model.wins / model.battles) * 100).toFixed(1)) : 0
    }));
};

const prepareTypeDistributionData = (battles) => {
    if (!battles.length) return [];
    const typeCount = {};
    
    battles.forEach(battle => {
        [battle.player1, battle.player2].forEach(player => {
            (player.finalTeam || []).forEach(pokemon => {
                const types = pokemon.types || [];
                types.forEach(type => {
                    typeCount[type] = (typeCount[type] || 0) + 1;
                });
            });
        });
    });
    
    return Object.entries(typeCount).map(([type, count]) => ({
        type,
        count
    })).sort((a, b) => b.count - a.count);
};

const prepareTurnAnalysisData = (battles) => {
    if (!battles.length) return [];
    const turnData = {};
    
    for (let i = 1; i <= 20; i++) {
        turnData[i] = {
            turn: i,
            attackCount: 0,
            switchCount: 0,
            otherCount: 0,
            totalActions: 0
        };
    }
    
    battles.forEach(battle => {
        [battle.player1, battle.player2].forEach(player => {
            (player.decisions || []).forEach(decision => {
                if (decision.turn && decision.turn <= 20) {
                    const turn = decision.turn;
                    turnData[turn].totalActions += 1;
                    
                    if (decision.type === 'attack') {
                        turnData[turn].attackCount += 1;
                    } else if (decision.type === 'switch_pokemon') {
                        turnData[turn].switchCount += 1;
                    } else {
                        turnData[turn].otherCount += 1;
                    }
                }
            });
        });
    });
    
    return Object.values(turnData)
        .filter(data => data.totalActions > 0)
        .map(data => ({
            turn: data.turn,
            attackRate: parseFloat(((data.attackCount / data.totalActions) * 100).toFixed(1)),
            switchRate: parseFloat(((data.switchCount / data.totalActions) * 100).toFixed(1)),
            otherRate: parseFloat(((data.otherCount / data.totalActions) * 100).toFixed(1)),
            totalActions: data.totalActions
        }))
        .sort((a, b) => a.turn - b.turn);
};

const preparePokemonSynergyData = (battles) => {
    if (!battles.length) return [];
    const pairData = {};
    
    battles.forEach(battle => {
        const winner = battle.winner;
        
        [
            { player: battle.player1, isWinner: winner === 1 },
            { player: battle.player2, isWinner: winner === 2 }
        ].forEach(({ player, isWinner }) => {
            const team = player.finalTeam || [];
            
            for (let i = 0; i < team.length; i++) {
                for (let j = i + 1; j < team.length; j++) {
                    const pokemon1 = team[i].name;
                    const pokemon2 = team[j].name;
                    
                    const pairKey = [pokemon1, pokemon2].sort().join('-');
                    
                    if (!pairData[pairKey]) {
                        pairData[pairKey] = {
                            pokemon1: pokemon1,
                            pokemon2: pokemon2,
                            count: 0,
                            wins: 0,
                            losses: 0
                        };
                    }
                    
                    pairData[pairKey].count += 1;
                    if (isWinner) {
                        pairData[pairKey].wins += 1;
                    } else {
                        pairData[pairKey].losses += 1;
                    }
                }
            }
        });
    });
    
    return Object.values(pairData)
        .filter(pair => pair.count >= 2)
        .map(pair => ({
            ...pair,
            winRate: pair.count > 0 ? (pair.wins / pair.count) * 100 : 0
        }))
        .sort((a, b) => b.winRate - a.winRate);
};

export default StatsPage;
