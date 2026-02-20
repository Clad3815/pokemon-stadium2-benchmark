const fs = require('fs');
const path = require('path');

const aiModels = require('./data/ai_models.json');

const SUPPORTED_PROVIDERS = ['openai', 'gemini', 'anthropic', 'openrouter', 'deepseek', 'mistral'];
const MODELS_FILE_PATH = path.join(__dirname, 'data', 'ai_models.json');

let lastUpdatedAt = getInitialLastUpdatedAt();

function getInitialLastUpdatedAt() {
  try {
    return fs.statSync(MODELS_FILE_PATH).mtime.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function createModelRegistryError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeRequiredString(value, fieldName) {
  if (value === undefined || value === null) {
    throw createModelRegistryError(400, `"${fieldName}" is required`);
  }

  const normalized = String(value).trim();
  if (!normalized) {
    throw createModelRegistryError(400, `"${fieldName}" cannot be empty`);
  }

  return normalized;
}

function normalizeOptionalNumber(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw createModelRegistryError(400, `"${fieldName}" must be a finite number`);
  }

  return numericValue;
}

function normalizeProvider(provider) {
  const normalizedProvider = normalizeRequiredString(provider, 'provider').toLowerCase();
  if (!SUPPORTED_PROVIDERS.includes(normalizedProvider)) {
    throw createModelRegistryError(
      400,
      `"provider" must be one of: ${SUPPORTED_PROVIDERS.join(', ')}`
    );
  }

  return normalizedProvider;
}

function normalizeModelName(model) {
  const normalizedModel = normalizeRequiredString(model, 'model');
  if (normalizedModel.includes('/')) {
    throw createModelRegistryError(400, '"model" cannot contain "/"');
  }

  return normalizedModel;
}

function normalizeReasoningLevels(levels) {
  if (!Array.isArray(levels)) {
    throw createModelRegistryError(400, '"config.reasoningLevels" must be an array');
  }

  const normalizedLevels = levels
    .map((level) => String(level).trim().toLowerCase())
    .filter(Boolean);

  const uniqueLevels = Array.from(new Set(normalizedLevels));
  if (uniqueLevels.length === 0) {
    throw createModelRegistryError(
      400,
      '"config.reasoningLevels" cannot be empty when "config.reasoningModel" is true'
    );
  }

  return uniqueLevels;
}

function sanitizeModelConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    throw createModelRegistryError(400, '"config" must be an object');
  }

  const sanitizedConfig = {
    name: normalizeRequiredString(rawConfig.name, 'config.name'),
    shortName: normalizeRequiredString(rawConfig.shortName, 'config.shortName'),
    chatTeam: normalizeRequiredString(rawConfig.chatTeam, 'config.chatTeam'),
    chatUsername: normalizeRequiredString(rawConfig.chatUsername, 'config.chatUsername')
  };

  const maxTokens = Number(rawConfig.maxTokens);
  if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
    throw createModelRegistryError(400, '"config.maxTokens" must be a positive integer');
  }
  sanitizedConfig.maxTokens = maxTokens;

  if (typeof rawConfig.structuredOutput !== 'boolean') {
    throw createModelRegistryError(400, '"config.structuredOutput" must be a boolean');
  }
  sanitizedConfig.structuredOutput = rawConfig.structuredOutput;

  const outputMode = rawConfig.outputMode === undefined || rawConfig.outputMode === null
    ? ''
    : String(rawConfig.outputMode).trim();
  if (outputMode) {
    sanitizedConfig.outputMode = outputMode;
  }

  if (rawConfig.reasoningModel !== undefined && typeof rawConfig.reasoningModel !== 'boolean') {
    throw createModelRegistryError(400, '"config.reasoningModel" must be a boolean');
  }

  const reasoningModel = rawConfig.reasoningModel === true;
  sanitizedConfig.reasoningModel = reasoningModel;
  if (reasoningModel) {
    sanitizedConfig.reasoningLevels = normalizeReasoningLevels(rawConfig.reasoningLevels);
  } else if (rawConfig.reasoningLevels !== undefined && rawConfig.reasoningLevels !== null) {
    const hasNonEmptyReasoningLevels = Array.isArray(rawConfig.reasoningLevels)
      ? rawConfig.reasoningLevels.some((level) => String(level).trim() !== '')
      : true;
    if (hasNonEmptyReasoningLevels) {
      throw createModelRegistryError(
        400,
        '"config.reasoningLevels" can only be set when "config.reasoningModel" is true'
      );
    }
  }

  const temperature = normalizeOptionalNumber(rawConfig.temperature, 'config.temperature');
  if (temperature !== undefined) {
    sanitizedConfig.temperature = temperature;
  }

  const topP = normalizeOptionalNumber(rawConfig.topP, 'config.topP');
  if (topP !== undefined) {
    sanitizedConfig.topP = topP;
  }

  const topK = normalizeOptionalNumber(rawConfig.topK, 'config.topK');
  if (topK !== undefined) {
    sanitizedConfig.topK = topK;
  }

  return sanitizedConfig;
}

function buildModelId(provider, model) {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedModel = normalizeModelName(model);
  return `${normalizedProvider}/${normalizedModel}`;
}

function splitModelId(modelId) {
  const normalizedModelId = normalizeRequiredString(modelId, 'modelId');
  const slashIndex = normalizedModelId.indexOf('/');
  if (slashIndex <= 0 || slashIndex === normalizedModelId.length - 1) {
    throw createModelRegistryError(400, `Invalid model id "${normalizedModelId}"`);
  }

  return {
    provider: normalizedModelId.slice(0, slashIndex),
    model: normalizedModelId.slice(slashIndex + 1)
  };
}

function sortModels(modelsMap) {
  return Object.fromEntries(
    Object.entries(modelsMap).sort(([modelA], [modelB]) => modelA.localeCompare(modelB))
  );
}

function replaceModelsInMemory(nextModelsMap) {
  const currentKeys = Object.keys(aiModels);
  for (const key of currentKeys) {
    delete aiModels[key];
  }

  for (const [key, value] of Object.entries(nextModelsMap)) {
    aiModels[key] = value;
  }
}

function writeModelsFile(nextModelsMap) {
  const sortedModelsMap = sortModels(nextModelsMap);
  const tempFilePath = `${MODELS_FILE_PATH}.tmp-${process.pid}-${Date.now()}`;
  const serializedModels = `${JSON.stringify(sortedModelsMap, null, 4)}\n`;

  fs.writeFileSync(tempFilePath, serializedModels, 'utf8');

  try {
    fs.renameSync(tempFilePath, MODELS_FILE_PATH);
  } catch (error) {
    if (error.code === 'EEXIST' || error.code === 'EPERM') {
      fs.copyFileSync(tempFilePath, MODELS_FILE_PATH);
      fs.unlinkSync(tempFilePath);
    } else {
      throw error;
    }
  }

  replaceModelsInMemory(sortedModelsMap);
  lastUpdatedAt = new Date().toISOString();
}

function listModels() {
  return {
    models: JSON.parse(JSON.stringify(aiModels)),
    providers: [...SUPPORTED_PROVIDERS],
    lastUpdatedAt
  };
}

function getModel(modelId) {
  return aiModels[modelId] ? JSON.parse(JSON.stringify(aiModels[modelId])) : null;
}

function getLastUpdatedAt() {
  return lastUpdatedAt;
}

function createModel({ provider, model, config }) {
  const modelId = buildModelId(provider, model);
  if (aiModels[modelId]) {
    throw createModelRegistryError(409, `Model "${modelId}" already exists`);
  }

  const sanitizedConfig = sanitizeModelConfig(config);
  const nextModelsMap = {
    ...aiModels,
    [modelId]: sanitizedConfig
  };

  writeModelsFile(nextModelsMap);

  return {
    modelId,
    model: JSON.parse(JSON.stringify(aiModels[modelId]))
  };
}

function updateModel(currentModelId, { provider, model, config }) {
  if (!aiModels[currentModelId]) {
    throw createModelRegistryError(404, `Model "${currentModelId}" not found`);
  }

  const nextModelId = buildModelId(provider, model);
  if (nextModelId !== currentModelId && aiModels[nextModelId]) {
    throw createModelRegistryError(409, `Model "${nextModelId}" already exists`);
  }

  const sanitizedConfig = sanitizeModelConfig(config);
  const nextModelsMap = {
    ...aiModels
  };
  delete nextModelsMap[currentModelId];
  nextModelsMap[nextModelId] = sanitizedConfig;

  writeModelsFile(nextModelsMap);

  return {
    currentModelId,
    nextModelId,
    renamed: currentModelId !== nextModelId,
    model: JSON.parse(JSON.stringify(aiModels[nextModelId]))
  };
}

function deleteModel(modelId) {
  if (!aiModels[modelId]) {
    throw createModelRegistryError(404, `Model "${modelId}" not found`);
  }

  const nextModelsMap = {
    ...aiModels
  };
  delete nextModelsMap[modelId];

  writeModelsFile(nextModelsMap);

  return {
    modelId
  };
}

module.exports = {
  SUPPORTED_PROVIDERS,
  buildModelId,
  createModel,
  createModelRegistryError,
  deleteModel,
  getLastUpdatedAt,
  getModel,
  listModels,
  splitModelId,
  updateModel
};
