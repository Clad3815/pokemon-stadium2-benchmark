const aiModels = require('./data/ai_models.json');

const DEFAULT_REASONING_LEVELS = ['low', 'medium', 'high'];

function normalizeReasoningEffort(reasoningEffort) {
    if (reasoningEffort === null || reasoningEffort === undefined) {
        return null;
    }

    const normalized = String(reasoningEffort).trim().toLowerCase();
    if (!normalized || normalized === 'default') {
        return null;
    }

    return normalized;
}

function getModelInfo(modelName) {
    return aiModels[modelName] || null;
}

function isReasoningModel(modelName) {
    const modelInfo = getModelInfo(modelName);
    return Boolean(modelInfo && modelInfo.reasoningModel === true);
}

function getModelReasoningLevels(modelName) {
    if (!isReasoningModel(modelName)) {
        return [];
    }

    const modelInfo = getModelInfo(modelName);
    const configuredLevels = Array.isArray(modelInfo.reasoningLevels)
        ? modelInfo.reasoningLevels
        : DEFAULT_REASONING_LEVELS;

    const normalizedLevels = configuredLevels
        .map((level) => String(level).trim().toLowerCase())
        .filter(Boolean);

    return normalizedLevels.length > 0
        ? Array.from(new Set(normalizedLevels))
        : DEFAULT_REASONING_LEVELS;
}

function isReasoningEffortValidForModel(modelName, reasoningEffort) {
    const normalizedEffort = normalizeReasoningEffort(reasoningEffort);

    if (!isReasoningModel(modelName)) {
        return normalizedEffort === null;
    }

    if (normalizedEffort === null) {
        return true;
    }

    return getModelReasoningLevels(modelName).includes(normalizedEffort);
}

function sanitizeReasoningEffortForModel(modelName, reasoningEffort) {
    if (!isReasoningModel(modelName)) {
        return null;
    }

    const normalizedEffort = normalizeReasoningEffort(reasoningEffort);
    if (normalizedEffort === null) {
        return null;
    }

    return getModelReasoningLevels(modelName).includes(normalizedEffort)
        ? normalizedEffort
        : null;
}

function getModelBaseDisplayName(modelName, preferredField = 'name') {
    const modelInfo = getModelInfo(modelName);
    if (!modelInfo) {
        return modelName;
    }

    if (preferredField && modelInfo[preferredField]) {
        return modelInfo[preferredField];
    }

    return modelInfo.name || modelInfo.shortName || modelInfo.chatUsername || modelName;
}

function appendReasoningEffort(baseName, reasoningEffort) {
    const normalizedEffort = normalizeReasoningEffort(reasoningEffort);
    return normalizedEffort ? `${baseName} (${normalizedEffort})` : baseName;
}

function getModelDisplayName(modelName, reasoningEffort = null, preferredField = 'name') {
    const baseName = getModelBaseDisplayName(modelName, preferredField);
    const safeEffort = sanitizeReasoningEffortForModel(modelName, reasoningEffort);
    return appendReasoningEffort(baseName, safeEffort);
}

function getModelStatKey(modelName, reasoningEffort = null) {
    const safeEffort = sanitizeReasoningEffortForModel(modelName, reasoningEffort);
    return `${modelName}::${safeEffort || 'default'}`;
}

function getModelRuntimeInfo(modelName, reasoningEffort = null) {
    const safeEffort = sanitizeReasoningEffortForModel(modelName, reasoningEffort);

    return {
        model: modelName,
        reasoningEffort: safeEffort,
        modelDisplayName: getModelDisplayName(modelName, safeEffort, 'name'),
        modelShortDisplayName: getModelDisplayName(modelName, safeEffort, 'shortName'),
        modelChatDisplayName: getModelDisplayName(modelName, safeEffort, 'chatUsername'),
        modelStatKey: getModelStatKey(modelName, safeEffort)
    };
}

module.exports = {
    DEFAULT_REASONING_LEVELS,
    appendReasoningEffort,
    getModelBaseDisplayName,
    getModelDisplayName,
    getModelInfo,
    getModelReasoningLevels,
    getModelRuntimeInfo,
    getModelStatKey,
    isReasoningEffortValidForModel,
    isReasoningModel,
    normalizeReasoningEffort,
    sanitizeReasoningEffortForModel
};
