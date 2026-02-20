import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Copy, Pencil, Plus, Save, Trash2, Database, Search, 
  Filter, Server, RefreshCw, Clock, CircleAlert
} from 'lucide-react';
import {
  createAdminModel,
  deleteAdminModel,
  fetchAdminModels,
  updateAdminModel
} from '../services/modelsAdminApi';

const DEFAULT_PROVIDER = 'openai';

const DEFAULT_FORM_STATE = {
  provider: DEFAULT_PROVIDER,
  model: '',
  name: '',
  shortName: '',
  chatTeam: '',
  chatUsername: '',
  maxTokens: 128000,
  structuredOutput: false,
  outputMode: '',
  reasoningModel: false,
  reasoningLevelsText: '',
  temperature: '',
  topP: '',
  topK: ''
};

function decodeSafe(value) {
  if (!value) {
    return '';
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseModelId(modelId) {
  if (!modelId || !modelId.includes('/')) {
    return { provider: DEFAULT_PROVIDER, model: '' };
  }

  const splitIndex = modelId.indexOf('/');
  return {
    provider: modelId.slice(0, splitIndex),
    model: modelId.slice(splitIndex + 1)
  };
}

function parseReasoningLevels(levelsText) {
  return Array.from(
    new Set(
      String(levelsText || '')
        .split(/[,\n]/)
        .map((level) => level.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function getProviderFromModelId(modelId) {
  return parseModelId(modelId).provider;
}

function buildCloneModelName(provider, sourceModel, modelsMap) {
  const baseName = `${sourceModel}-copy`;
  let candidate = baseName;
  let suffix = 2;

  while (modelsMap[`${provider}/${candidate}`]) {
    candidate = `${baseName}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function mapModelToFormState(modelId, modelConfig, modelsMap, isClone = false) {
  const { provider, model } = parseModelId(modelId);
  const resolvedModel = isClone ? buildCloneModelName(provider, model, modelsMap) : model;

  return {
    provider,
    model: resolvedModel,
    name: modelConfig?.name || '',
    shortName: modelConfig?.shortName || '',
    chatTeam: modelConfig?.chatTeam || '',
    chatUsername: modelConfig?.chatUsername || '',
    maxTokens: modelConfig?.maxTokens ?? 128000,
    structuredOutput: Boolean(modelConfig?.structuredOutput),
    outputMode: modelConfig?.outputMode || '',
    reasoningModel: Boolean(modelConfig?.reasoningModel),
    reasoningLevelsText: Array.isArray(modelConfig?.reasoningLevels)
      ? modelConfig.reasoningLevels.join(', ')
      : '',
    temperature: modelConfig?.temperature ?? '',
    topP: modelConfig?.topP ?? '',
    topK: modelConfig?.topK ?? ''
  };
}

function buildPayloadFromForm(formState) {
  const payload = {
    provider: formState.provider.trim().toLowerCase(),
    model: formState.model.trim(),
    config: {
      name: formState.name.trim(),
      shortName: formState.shortName.trim(),
      chatTeam: formState.chatTeam.trim(),
      chatUsername: formState.chatUsername.trim(),
      maxTokens: Number(formState.maxTokens),
      structuredOutput: Boolean(formState.structuredOutput),
      reasoningModel: Boolean(formState.reasoningModel)
    }
  };

  const outputMode = formState.outputMode.trim();
  if (outputMode) {
    payload.config.outputMode = outputMode;
  }

  if (formState.reasoningModel) {
    payload.config.reasoningLevels = parseReasoningLevels(formState.reasoningLevelsText);
  }

  if (String(formState.temperature).trim() !== '') {
    payload.config.temperature = Number(formState.temperature);
  }
  if (String(formState.topP).trim() !== '') {
    payload.config.topP = Number(formState.topP);
  }
  if (String(formState.topK).trim() !== '') {
    payload.config.topK = Number(formState.topK);
  }

  return payload;
}

function validateForm(formState, providers) {
  const errors = {};

  if (!providers.includes(formState.provider)) {
    errors.provider = `Provider must be one of: ${providers.join(', ')}`;
  }

  if (!formState.model.trim()) {
    errors.model = 'Model is required';
  } else if (formState.model.includes('/')) {
    errors.model = 'Model cannot contain "/"';
  }

  if (!formState.name.trim()) {
    errors.name = 'Name is required';
  }
  if (!formState.shortName.trim()) {
    errors.shortName = 'Short name is required';
  }
  if (!formState.chatTeam.trim()) {
    errors.chatTeam = 'Chat team is required';
  }
  if (!formState.chatUsername.trim()) {
    errors.chatUsername = 'Chat username is required';
  }

  const maxTokens = Number(formState.maxTokens);
  if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
    errors.maxTokens = 'Max tokens must be a positive integer';
  }

  if (formState.reasoningModel) {
    const reasoningLevels = parseReasoningLevels(formState.reasoningLevelsText);
    if (reasoningLevels.length === 0) {
      errors.reasoningLevelsText = 'Reasoning levels are required for reasoning models';
    }
  }

  const optionalNumericFields = ['temperature', 'topP', 'topK'];
  for (const fieldName of optionalNumericFields) {
    const rawValue = String(formState[fieldName]).trim();
    if (!rawValue) {
      continue;
    }

    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) {
      errors[fieldName] = `${fieldName} must be a valid number`;
    }
  }

  return errors;
}

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

function FieldError({ error }) {
  if (!error) {
    return null;
  }
  return <p className="mt-1.5 text-xs font-medium text-red-400">{error}</p>;
}

function TextInput({
  label,
  name,
  value,
  onChange,
  placeholder,
  error,
  type = 'text',
  icon: Icon
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-400 mb-1.5 block">{label}</span>
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="h-4 w-4 text-slate-500" />
          </div>
        )}
        <input
          className={`w-full rounded-xl border border-slate-800 bg-slate-900/50 py-2.5 text-sm text-slate-200 outline-none transition-all focus:border-blue-500 focus:bg-slate-800/80 shadow-sm ${Icon ? 'pl-10 pr-3' : 'px-3'}`}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          type={type}
        />
      </div>
      <FieldError error={error} />
    </label>
  );
}

export default function ModelsAdminPage({ mode = 'list' }) {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const [modelsMap, setModelsMap] = useState({});
  const [providers, setProviders] = useState([]);
  const [activeSelection, setActiveSelection] = useState({ player1: '', player2: '' });
  const [lastUpdated, setLastUpdated] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingModelId, setDeletingModelId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [searchValue, setSearchValue] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');

  const [formState, setFormState] = useState(DEFAULT_FORM_STATE);
  const [formErrors, setFormErrors] = useState({});
  const [formInitialized, setFormInitialized] = useState(false);

  const isFormMode = mode === 'create' || mode === 'edit';
  const requestedModelId = decodeSafe(params.modelId);
  const requestedCloneSourceId = decodeSafe(searchParams.get('clone'));

  async function loadModels() {
    setLoading(true);
    setErrorMessage('');

    try {
      const payload = await fetchAdminModels();
      setModelsMap(payload.models || {});
      setProviders(payload.providers || []);
      setActiveSelection(payload.activeSelection || { player1: '', player2: '' });
      setLastUpdated(payload.lastUpdated || '');
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    setFormInitialized(false);
    setFormErrors({});
    setErrorMessage('');
    setSuccessMessage('');
  }, [mode, requestedModelId, requestedCloneSourceId]);

  useEffect(() => {
    if (!isFormMode || loading || formInitialized) {
      return;
    }

    const fallbackProvider = providers[0] || DEFAULT_PROVIDER;

    if (mode === 'edit') {
      if (!requestedModelId) {
        setErrorMessage('Invalid model identifier');
        return;
      }

      const modelConfig = modelsMap[requestedModelId];
      if (!modelConfig) {
        setErrorMessage(`Model "${requestedModelId}" not found`);
        return;
      }

      setFormState(mapModelToFormState(requestedModelId, modelConfig, modelsMap, false));
      setFormInitialized(true);
      return;
    }

    if (requestedCloneSourceId && modelsMap[requestedCloneSourceId]) {
      setFormState(mapModelToFormState(
        requestedCloneSourceId,
        modelsMap[requestedCloneSourceId],
        modelsMap,
        true
      ));
      setFormInitialized(true);
      setSuccessMessage(`Clone source loaded from "${requestedCloneSourceId}"`);
      return;
    }

    setFormState({
      ...DEFAULT_FORM_STATE,
      provider: fallbackProvider
    });
    setFormInitialized(true);
  }, [
    isFormMode,
    loading,
    formInitialized,
    mode,
    requestedModelId,
    requestedCloneSourceId,
    providers,
    modelsMap
  ]);

  const modelRows = useMemo(() => {
    return Object.entries(modelsMap)
      .sort(([modelA], [modelB]) => modelA.localeCompare(modelB))
      .filter(([modelId, modelConfig]) => {
        const provider = getProviderFromModelId(modelId);
        if (providerFilter !== 'all' && provider !== providerFilter) {
          return false;
        }

        const searchableText = [
          modelId,
          modelConfig?.name || '',
          modelConfig?.shortName || '',
          modelConfig?.chatTeam || '',
          modelConfig?.chatUsername || ''
        ]
          .join(' ')
          .toLowerCase();

        return searchableText.includes(searchValue.trim().toLowerCase());
      });
  }, [modelsMap, providerFilter, searchValue]);

  function updateField(name, value) {
    setFormState((previousState) => ({
      ...previousState,
      [name]: value
    }));
    setFormErrors((previousErrors) => ({
      ...previousErrors,
      [name]: undefined
    }));
  }

  async function handleDelete(modelId) {
    if (!window.confirm(`Delete model "${modelId}"? This cannot be undone.`)) {
      return;
    }

    setDeletingModelId(modelId);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await deleteAdminModel(modelId);
      await loadModels();
      setSuccessMessage(`Model "${modelId}" deleted`);
    } catch (error) {
      setErrorMessage(error.message || `Failed to delete "${modelId}"`);
    } finally {
      setDeletingModelId('');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const validationErrors = validateForm(formState, providers);
    setFormErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const payload = buildPayloadFromForm(formState);
    setSaving(true);

    try {
      if (mode === 'edit') {
        await updateAdminModel(requestedModelId, payload);
        setSuccessMessage(`Model "${payload.provider}/${payload.model}" updated`);
      } else {
        await createAdminModel(payload);
        setSuccessMessage(`Model "${payload.provider}/${payload.model}" created`);
      }

      await loadModels();
      navigate('/models-admin');
    } catch (error) {
      setErrorMessage(error.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function renderListView() {
    return (
      <div className="animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
                <button onClick={() => navigate('/benchmark')} className="text-sm font-medium text-slate-400 hover:text-white flex items-center gap-2 mb-4 transition-colors">
                    <ArrowLeft size={16} /> Back to Benchmark
                </button>
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-3">
                    Models <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Admin</span>
                </h1>
                <p className="text-slate-400 text-sm md:text-base max-w-xl leading-relaxed">
                    Manage AI models configurations, providers, and parameters used in the benchmark.
                </p>
            </div>
            
            <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={loadModels}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-2 px-4 rounded-xl transition-all shadow-sm font-medium text-sm disabled:opacity-50"
                        disabled={loading}
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 
                        Refresh
                    </button>
                    <button 
                        onClick={() => navigate('/models-admin/new')}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded-xl transition-all shadow-md shadow-blue-900/20 font-medium text-sm"
                    >
                        <Plus size={16} /> 
                        Add Model
                    </button>
                </div>
                {lastUpdated && (
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Clock size={12} /> Updated: {new Date(lastUpdated).toLocaleTimeString()}
                    </div>
                )}
            </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-sm shadow-sm">
            <div className="flex-1 w-full md:max-w-md relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-500" />
                </div>
                <input
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/50 py-2.5 pl-10 pr-3 text-sm text-slate-200 outline-none transition-all focus:border-blue-500 focus:bg-slate-800/80 shadow-sm"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder="Search by name, ID, team..."
                />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-400">Provider:</span>
                </div>
                <select
                    className="rounded-xl border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-slate-200 outline-none transition-all focus:border-blue-500 focus:bg-slate-800/80 shadow-sm min-w-[160px] appearance-none"
                    value={providerFilter}
                    onChange={(e) => setProviderFilter(e.target.value)}
                >
                    <option value="all">All providers</option>
                    {providers.map((provider) => (
                        <option key={provider} value={provider}>
                            {provider}
                        </option>
                    ))}
                </select>
            </div>
        </div>

        <Card title="Available Models" icon={Database} headerRight={<span className="text-xs font-medium text-slate-500">{modelRows.length} models found</span>}>
            <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                        <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                            <th className="pb-3 font-medium px-4">Model ID</th>
                            <th className="pb-3 font-medium px-4">Name</th>
                            <th className="pb-3 font-medium px-4">Provider</th>
                            <th className="pb-3 font-medium px-4">Capabilities</th>
                            <th className="pb-3 font-medium px-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {modelRows.length === 0 ? (
                            <tr>
                                <td className="px-4 py-12 text-center text-slate-500" colSpan={5}>
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <CircleAlert className="h-8 w-8 text-slate-600" />
                                        <span>No models match your current filters.</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            modelRows.map(([modelId, modelConfig]) => {
                                const provider = getProviderFromModelId(modelId);
                                const isActivePlayer1 = activeSelection.player1 === modelId;
                                const isActivePlayer2 = activeSelection.player2 === modelId;
                                
                                return (
                                    <tr className="hover:bg-slate-800/20 transition-colors group" key={modelId}>
                                        <td className="py-3 px-4 font-mono text-xs text-slate-300">{modelId}</td>
                                        <td className="py-3 px-4">
                                            <p className="font-medium text-slate-200">{modelConfig?.name || modelId}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{modelConfig?.shortName || '-'}</p>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-medium border bg-slate-800/50 text-slate-300 border-slate-700 uppercase tracking-wider">
                                                {provider}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex flex-wrap gap-1.5">
                                                {modelConfig?.reasoningModel && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                        Reasoning
                                                    </span>
                                                )}
                                                {modelConfig?.structuredOutput && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        Structured
                                                    </span>
                                                )}
                                                {isActivePlayer1 && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                        Active P1
                                                    </span>
                                                )}
                                                {isActivePlayer2 && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                        Active P2
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all shadow-sm"
                                                    onClick={() => navigate(`/models-admin/${encodeURIComponent(modelId)}/edit`)}
                                                    title="Edit"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all shadow-sm"
                                                    onClick={() => navigate(`/models-admin/new?clone=${encodeURIComponent(modelId)}`)}
                                                    title="Clone"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                                <button
                                                    className="p-1.5 rounded-lg border border-red-900/50 bg-red-900/20 text-red-400 hover:bg-red-900/40 hover:text-red-300 transition-all shadow-sm disabled:opacity-50"
                                                    disabled={deletingModelId === modelId}
                                                    onClick={() => handleDelete(modelId)}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
      </div>
    );
  }

  function renderFormView() {
    const generatedModelId = formState.provider && String(formState.model).trim()
      ? `${formState.provider}/${String(formState.model).trim()}`
      : '-';

    return (
      <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
                <button onClick={() => navigate('/models-admin')} className="text-sm font-medium text-slate-400 hover:text-white flex items-center gap-2 mb-4 transition-colors">
                    <ArrowLeft size={16} /> Back to List
                </button>
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-3">
                    {mode === 'edit' ? 'Edit' : 'Create'} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Model</span>
                </h1>
                <p className="text-slate-400 text-sm md:text-base max-w-xl leading-relaxed">
                    Configure the specific settings, API behaviors, and meta-data for <code className="text-blue-300 font-mono text-xs bg-blue-900/30 px-1.5 py-0.5 rounded">{generatedModelId}</code>.
                </p>
            </div>
        </div>

        <Card title="Model Configuration" icon={Server}>
            <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid gap-6 md:grid-cols-2">
                    <label className="block">
                        <span className="text-sm font-medium text-slate-400 mb-1.5 block">Provider</span>
                        <select
                            className="w-full rounded-xl border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-slate-200 outline-none transition-all focus:border-blue-500 focus:bg-slate-800/80 shadow-sm appearance-none"
                            value={formState.provider}
                            onChange={(event) => updateField('provider', event.target.value)}
                        >
                            {providers.map((provider) => (
                                <option key={provider} value={provider}>
                                    {provider}
                                </option>
                            ))}
                        </select>
                        <FieldError error={formErrors.provider} />
                    </label>

                    <TextInput
                        label="Model Identifier"
                        name="model"
                        value={formState.model}
                        onChange={(event) => updateField('model', event.target.value)}
                        placeholder="gpt-4o"
                        error={formErrors.model}
                    />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <TextInput
                        label="Display Name"
                        name="name"
                        value={formState.name}
                        onChange={(event) => updateField('name', event.target.value)}
                        placeholder="GPT-4o"
                        error={formErrors.name}
                    />
                    <TextInput
                        label="Short Name"
                        name="shortName"
                        value={formState.shortName}
                        onChange={(event) => updateField('shortName', event.target.value)}
                        placeholder="4o"
                        error={formErrors.shortName}
                    />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <TextInput
                        label="Chat Team"
                        name="chatTeam"
                        value={formState.chatTeam}
                        onChange={(event) => updateField('chatTeam', event.target.value)}
                        placeholder="OpenAI"
                        error={formErrors.chatTeam}
                    />
                    <TextInput
                        label="Chat Username"
                        name="chatUsername"
                        value={formState.chatUsername}
                        onChange={(event) => updateField('chatUsername', event.target.value)}
                        placeholder="GPT-4o"
                        error={formErrors.chatUsername}
                    />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <TextInput
                        label="Max Tokens"
                        name="maxTokens"
                        type="number"
                        value={formState.maxTokens}
                        onChange={(event) => updateField('maxTokens', event.target.value)}
                        placeholder="128000"
                        error={formErrors.maxTokens}
                    />
                    <TextInput
                        label="Output Mode (Optional)"
                        name="outputMode"
                        value={formState.outputMode}
                        onChange={(event) => updateField('outputMode', event.target.value)}
                        placeholder="json"
                        error={formErrors.outputMode}
                    />
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    <TextInput
                        label="Temperature (Optional)"
                        name="temperature"
                        type="number"
                        value={formState.temperature}
                        onChange={(event) => updateField('temperature', event.target.value)}
                        error={formErrors.temperature}
                        placeholder="0.7"
                    />
                    <TextInput
                        label="Top P (Optional)"
                        name="topP"
                        type="number"
                        value={formState.topP}
                        onChange={(event) => updateField('topP', event.target.value)}
                        error={formErrors.topP}
                        placeholder="1"
                    />
                    <TextInput
                        label="Top K (Optional)"
                        name="topK"
                        type="number"
                        value={formState.topK}
                        onChange={(event) => updateField('topK', event.target.value)}
                        error={formErrors.topK}
                        placeholder="50"
                    />
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex items-start">
                            <div className="flex h-6 items-center">
                                <input
                                    id="structuredOutput"
                                    name="structuredOutput"
                                    type="checkbox"
                                    checked={Boolean(formState.structuredOutput)}
                                    onChange={(event) => updateField('structuredOutput', event.target.checked)}
                                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-600 focus:ring-offset-slate-900"
                                />
                            </div>
                            <div className="ml-3 text-sm leading-6">
                                <label htmlFor="structuredOutput" className="font-medium text-slate-200 cursor-pointer">Structured Output</label>
                                <p className="text-slate-500 text-xs mt-0.5">Model natively supports JSON schema validation</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <div className="relative flex items-start">
                            <div className="flex h-6 items-center">
                                <input
                                    id="reasoningModel"
                                    name="reasoningModel"
                                    type="checkbox"
                                    checked={Boolean(formState.reasoningModel)}
                                    onChange={(event) => updateField('reasoningModel', event.target.checked)}
                                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-600 focus:ring-offset-slate-900"
                                />
                            </div>
                            <div className="ml-3 text-sm leading-6">
                                <label htmlFor="reasoningModel" className="font-medium text-slate-200 cursor-pointer">Reasoning Model</label>
                                <p className="text-slate-500 text-xs mt-0.5">Model uses thinking/reasoning effort parameters (e.g. o1, o3)</p>
                            </div>
                        </div>
                    </div>

                    {formState.reasoningModel && (
                        <div className="pt-2 pl-7 animate-in slide-in-from-top-2 duration-300">
                            <TextInput
                                label="Reasoning Levels (comma-separated, e.g. low, medium, high)"
                                name="reasoningLevelsText"
                                value={formState.reasoningLevelsText}
                                onChange={(event) => updateField('reasoningLevelsText', event.target.value)}
                                placeholder="low, medium, high"
                                error={formErrors.reasoningLevelsText}
                            />
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-800">
                    <button
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 px-6 rounded-xl transition-all shadow-md shadow-blue-900/20 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={saving}
                        type="submit"
                    >
                        <Save size={16} />
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                    <button
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-2.5 px-6 rounded-xl transition-all shadow-sm font-medium text-sm"
                        onClick={() => navigate('/models-admin')}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-300 py-2.5 px-6 rounded-xl transition-all font-medium text-sm ml-auto"
                        onClick={() => setFormState(DEFAULT_FORM_STATE)}
                        type="button"
                    >
                        <RefreshCw size={14} />
                        Reset
                    </button>
                </div>
            </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0B1120] text-slate-200 font-sans selection:bg-blue-500/30 pb-20">
      {/* Minimalist Background Pattern */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.02]" 
           style={{ backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      
      {/* Ambient Gradients */}
      <div className="fixed top-0 left-1/4 w-1/2 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-0 right-1/4 w-1/2 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none z-0" />

      <div className="relative z-10 max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8">
        {errorMessage && (
          <div className="mb-6 rounded-xl border border-rose-900/30 bg-rose-900/10 p-4 text-sm text-rose-400 flex items-center gap-3 backdrop-blur-sm shadow-sm animate-in fade-in duration-300">
            <CircleAlert className="h-5 w-5" />
            <p>{errorMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-xl border border-emerald-900/30 bg-emerald-900/10 p-4 text-sm text-emerald-400 flex items-center gap-3 backdrop-blur-sm shadow-sm animate-in fade-in duration-300">
            <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            <p>{successMessage}</p>
          </div>
        )}

        {loading && !isFormMode ? (
          <div className="flex flex-col items-center justify-center p-20 text-center border border-slate-800 rounded-2xl bg-slate-900/50 backdrop-blur-sm">
            <RefreshCw className="h-10 w-10 text-blue-500 animate-spin mb-4" />
            <p className="text-slate-300 font-medium">Loading models...</p>
          </div>
        ) : (
          isFormMode ? renderFormView() : renderListView()
        )}
      </div>
    </div>
  );
}