import React from 'react';

const getEffortLabel = (effort) => {
  if (!effort) {
    return 'Default';
  }
  return effort.charAt(0).toUpperCase() + effort.slice(1);
};

const getEffortDescription = (effort) => {
  if (!effort) {
    return 'Use provider default reasoning effort';
  }
  return `Use ${effort} reasoning effort`;
};

const ReasoningEffortModal = ({
  isOpen = false,
  modelName = 'Model',
  reasoningLevels = [],
  onSelect,
  onClose
}) => {
  if (!isOpen) {
    return null;
  }

  const normalizedLevels = (Array.isArray(reasoningLevels) ? reasoningLevels : [])
    .map((level) => String(level).trim().toLowerCase())
    .filter(Boolean);

  const options = [
    null,
    ...Array.from(new Set(normalizedLevels))
  ];

  return (
    <div
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-700/70 bg-slate-900/95 p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-1">Reasoning Effort</h3>
        <p className="text-sm text-slate-300 mb-4">
          Select effort level for <span className="font-semibold text-yellow-300">{modelName}</span>.
        </p>

        <div className="grid grid-cols-1 gap-2">
          {options.map((effort) => (
            <button
              key={effort || 'default'}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/70 px-4 py-3 text-left text-white transition-colors hover:bg-slate-700/80"
              onClick={() => onSelect(effort)}
            >
              <div className="font-semibold">{getEffortLabel(effort)}</div>
              <div className="text-xs text-slate-300 mt-0.5">
                {getEffortDescription(effort)}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReasoningEffortModal;
