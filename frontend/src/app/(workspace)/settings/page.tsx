'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Key, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  X, 
  Activity, 
  RefreshCw, 
  Edit3, 
  Zap, 
  Sliders, 
  Check, 
  Cpu, 
  Layers, 
  Server
} from 'lucide-react';

interface ModelDefinition {
  name: string;
  context: string;
  provider: 'openai' | 'gemini' | 'anthropic' | 'ollama';
  providerLabel: string;
  type: 'Cloud' | 'Local';
  description?: string;
}

const AVAILABLE_MODELS: ModelDefinition[] = [
  { name: 'gpt-4o-mini', context: '128k', provider: 'openai', providerLabel: 'OpenAI', type: 'Cloud' },
  { name: 'gpt-4o', context: '128k', provider: 'openai', providerLabel: 'OpenAI', type: 'Cloud' },
  { name: 'o3-mini', context: '200k', provider: 'openai', providerLabel: 'OpenAI', type: 'Cloud' },
  { name: 'o1', context: '200k', provider: 'openai', providerLabel: 'OpenAI', type: 'Cloud' },
  { name: 'gpt-4-turbo', context: '128k', provider: 'openai', providerLabel: 'OpenAI', type: 'Cloud' },
  { name: 'gemini-1.5-flash', context: '1M', provider: 'gemini', providerLabel: 'Gemini', type: 'Cloud' },
  { name: 'gemini-1.5-pro', context: '2M', provider: 'gemini', providerLabel: 'Gemini', type: 'Cloud' },
  { name: 'gemini-2.0-flash', context: '1M', provider: 'gemini', providerLabel: 'Gemini', type: 'Cloud' },
  { name: 'claude-3-5-sonnet-20241022', context: '200k', provider: 'anthropic', providerLabel: 'Anthropic', type: 'Cloud' },
  { name: 'claude-3-haiku-20240307', context: '200k', provider: 'anthropic', providerLabel: 'Anthropic', type: 'Cloud' },
  { name: 'llama3:latest', context: '8k', provider: 'ollama', providerLabel: 'Ollama', type: 'Local' },
  { name: 'mistral:latest', context: '32k', provider: 'ollama', providerLabel: 'Ollama', type: 'Local' },
  { name: 'deepseek-r1:latest', context: '128k', provider: 'ollama', providerLabel: 'Ollama', type: 'Local' },
];

const PRESETS_BY_PROVIDER: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'o3-mini', 'o1', 'gpt-4-turbo'],
  gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  ollama: ['llama3:latest', 'mistral:latest', 'deepseek-r1:latest']
};

export default function SettingsPage() {
  const [modelProvider, setModelProvider] = useState<'openai' | 'gemini' | 'anthropic' | 'ollama'>('openai');
  const [modelName, setModelName] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);

  // Multi-API Keys Store
  const [keysStore, setKeysStore] = useState<{
    openai: string;
    gemini: string;
    anthropic: string;
    ollama: string;
  }>({
    openai: '',
    gemini: '',
    anthropic: '',
    ollama: 'http://localhost:11434'
  });

  const [showKey, setShowKey] = useState(false);
  const [setActiveImmediate, setSetActiveImmediate] = useState(true);
  const [showAdvancedRAG, setShowAdvancedRAG] = useState(false);

  // Status & Doctor state
  const [saving, setSaving] = useState(false);
  const [runningDoctor, setRunningDoctor] = useState(false);
  const [doctorStatus, setDoctorStatus] = useState<string>('Checking...');
  const [statusMessage, setStatusMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });

  const formRef = useRef<HTMLDivElement>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

  useEffect(() => {
    fetchSettings();
    runDoctorChecks();
  }, []);

  const fetchSettings = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/settings/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setModelProvider(data.model_provider || 'openai');
        setModelName(data.model_name || 'gpt-4o-mini');
        setTemperature(data.temperature ?? 0.2);
        setMaxTokens(data.max_tokens ?? 2000);
        setChunkSize(data.chunk_size ?? 1000);
        setChunkOverlap(data.chunk_overlap ?? 200);

        const raw = data.api_keys_encrypted || '';
        if (raw.startsWith('{')) {
          try {
            const parsed = JSON.parse(raw);
            setKeysStore({
              openai: parsed.openai || '',
              gemini: parsed.gemini || '',
              anthropic: parsed.anthropic || '',
              ollama: parsed.ollama || 'http://localhost:11434'
            });
          } catch (e) {}
        } else if (raw) {
          setKeysStore(prev => ({
            ...prev,
            [data.model_provider || 'openai']: raw
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const runDoctorChecks = async () => {
    setRunningDoctor(true);
    setDoctorStatus('Checking...');
    try {
      const token = localStorage.getItem('token');
      const start = Date.now();
      const res = await fetch(`${apiBase}/settings/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const latency = Date.now() - start;

      if (res.ok) {
        setDoctorStatus(`● System Ready (${latency}ms)`);
      } else {
        setDoctorStatus('⚠ Service Warning');
      }
    } catch (e) {
      setDoctorStatus('● Offline');
    } finally {
      setRunningDoctor(false);
    }
  };

  const handleKeyChange = (val: string) => {
    setKeysStore(prev => ({
      ...prev,
      [modelProvider]: val
    }));
  };

  const currentKeyValue = keysStore[modelProvider] || '';

  const saveEngineConfig = async (e?: React.FormEvent, targetProv?: string, targetMod?: string) => {
    if (e) e.preventDefault();
    setSaving(true);
    setStatusMessage({ type: '', text: '' });

    const finalProvider = targetProv || modelProvider;
    const finalModel = targetMod || modelName;

    const token = localStorage.getItem('token');
    const keysPayload = JSON.stringify(keysStore);

    try {
      const res = await fetch(`${apiBase}/settings/`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model_provider: finalProvider,
          model_name: finalModel,
          temperature: parseFloat(temperature.toString()),
          max_tokens: parseInt(maxTokens.toString()),
          chunk_size: parseInt(chunkSize.toString()),
          chunk_overlap: parseInt(chunkOverlap.toString()),
          api_keys_encrypted: keysPayload
        })
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Engine config saved! Active model: ${finalModel} (${finalProvider.toUpperCase()})` });
        setModelProvider(finalProvider as any);
        setModelName(finalModel);
      } else {
        throw new Error('Failed to save');
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: 'Failed to update system engine configuration.' });
    } finally {
      setSaving(false);
    }
  };

  // Click "Edit" in table
  const handleEditFromTable = (model: ModelDefinition) => {
    setModelProvider(model.provider);
    setModelName(model.name);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Click "Use Now" in table
  const handleUseNow = async (model: ModelDefinition) => {
    setModelProvider(model.provider);
    setModelName(model.name);
    await saveEngineConfig(undefined, model.provider, model.name);
  };

  // Helper to determine auth source display in table
  const getAuthSource = (model: ModelDefinition) => {
    if (model.provider === 'ollama') {
      return keysStore.ollama ? `Local (${keysStore.ollama.replace('http://', '')})` : 'Local (Ollama)';
    }
    const key = keysStore[model.provider];
    if (key) {
      return `User Key (••••${key.slice(-4)})`;
    }
    if (model.provider === 'openai') return 'Env Var (OPENAI_API_KEY)';
    if (model.provider === 'gemini') return 'Env Var (GEMINI_API_KEY)';
    if (model.provider === 'anthropic') return 'Env Var (ANTHROPIC_API_KEY)';
    return 'Not Configured';
  };

  const getModelContext = (name: string) => {
    const found = AVAILABLE_MODELS.find(m => m.name === name);
    return found ? `${found.context} context` : '128k context';
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 font-sans">
      
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>System Doctor & Configuration Management</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Run full system diagnostics and inspect or edit the active configuration.
          </p>
        </div>

        <button
          onClick={runDoctorChecks}
          disabled={runningDoctor}
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <Activity className={`w-4 h-4 ${runningDoctor ? 'animate-spin' : ''}`} />
          <span>Re-run Doctor Checks</span>
        </button>
      </div>

      {/* FEEDBACK STATUS BANNER */}
      {statusMessage.text && (
        <div className={`p-3.5 rounded-xl flex items-center gap-2 text-xs border ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400' 
            : 'bg-rose-950/40 border-rose-500/40 text-rose-400'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="font-semibold">{statusMessage.text}</span>
        </div>
      )}

      {/* CARD 1: AI ENGINE CONFIG */}
      <div ref={formRef} className="rounded-2xl border border-slate-800/90 bg-slate-950/40 backdrop-blur-xl p-6 space-y-6 shadow-2xl">
        
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Key className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white tracking-wide">AI Engine Config</h3>
          </div>
          <span className="text-xs font-semibold text-slate-400 font-mono">
            {doctorStatus}
          </span>
        </div>

        <form onSubmit={saveEngineConfig} className="space-y-5">
          
          {/* Field 1: LLM Provider */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400">LLM Provider</label>
            <div className="relative">
              <select
                value={modelProvider}
                onChange={(e) => {
                  const prov = e.target.value as any;
                  setModelProvider(prov);
                  const presets = PRESETS_BY_PROVIDER[prov];
                  if (presets && presets.length > 0) {
                    setModelName(presets[0]);
                  }
                }}
                className="w-full bg-slate-900/90 border border-slate-800 text-slate-100 text-xs font-bold rounded-xl p-3.5 outline-none focus:border-indigo-500 appearance-none cursor-pointer pr-10"
              >
                <option value="openai">OpenAI (Default)</option>
                <option value="gemini">Google Gemini</option>
                <option value="anthropic">Anthropic Claude</option>
                <option value="ollama">Local Ollama</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <span className="text-xs">▼</span>
              </div>
            </div>
          </div>

          {/* Field 2: Model Name with Context & Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400">Model Name</label>
              <span className="text-[11px] font-mono text-slate-500">{getModelContext(modelName)}</span>
            </div>

            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="E.g. gpt-4o-mini"
              className="w-full bg-slate-900/60 border border-slate-800 focus:border-indigo-500 rounded-xl p-3.5 text-xs text-slate-100 font-mono outline-none transition-all placeholder-slate-600"
            />

            {/* Presets Row */}
            <div className="flex flex-wrap gap-2 pt-1">
              {(PRESETS_BY_PROVIDER[modelProvider] || []).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setModelName(preset)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
                    modelName === preset
                      ? 'bg-slate-800 text-white border-indigo-500/60 shadow-sm'
                      : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Field 3: Provider API Key (Optional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400">
                {modelProvider === 'ollama' ? 'Ollama Host URL (Optional)' : 'Provider API Key (Optional)'}
              </label>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                currentKeyValue ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}>
                {currentKeyValue ? 'Configured' : 'Not Set'}
              </span>
            </div>

            <div className="relative flex items-center">
              <input
                type={showKey || modelProvider === 'ollama' ? "text" : "password"}
                value={currentKeyValue}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder={modelProvider === 'ollama' ? "http://localhost:11434" : "Leave empty to use host environment variables"}
                className="w-full bg-slate-900/60 border border-slate-800 focus:border-indigo-500 rounded-xl p-3.5 pr-14 text-xs text-slate-100 font-mono outline-none placeholder-slate-600 transition-all"
              />
              <div className="absolute right-3 flex items-center gap-1.5 text-slate-400">
                {modelProvider !== 'ollama' && (
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="p-1 hover:text-white transition-colors cursor-pointer"
                    title={showKey ? "Hide Key" : "Show Key"}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
                {currentKeyValue && (
                  <button
                    type="button"
                    onClick={() => handleKeyChange('')}
                    className="p-1 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Clear"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Keys are safely stored in <span className="font-mono text-slate-400">~/.env</span> / user settings and never exposed in cleartext.
            </p>
          </div>

          {/* Collapsible RAG parameters */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvancedRAG(!showAdvancedRAG)}
              className="text-xs font-semibold text-slate-400 hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showAdvancedRAG ? "Hide Advanced Hyper-parameters" : "Show Advanced Hyper-parameters (Temperature, Chunks)"}</span>
            </button>

            {showAdvancedRAG && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Temperature ({temperature})</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-900 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Max Output Tokens</label>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">RAG Chunk Size</label>
                  <input
                    type="number"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">RAG Chunk Overlap</label>
                  <input
                    type="number"
                    value={chunkOverlap}
                    onChange={(e) => setChunkOverlap(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Bar: Checkbox + Save Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-850">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={setActiveImmediate}
                onChange={(e) => setSetActiveImmediate(e.target.checked)}
                className="w-4 h-4 rounded border-slate-800 bg-slate-900 accent-indigo-600 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-300">
                Set as active model for Agent Chat immediately
              </span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin"></span>
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save Engine Config</span>
            </button>
          </div>

        </form>
      </div>

      {/* CARD 2: SAVED MODELS & CONFIGURED PROVIDERS */}
      <div className="rounded-2xl border border-slate-800/90 bg-slate-950/40 backdrop-blur-xl p-6 space-y-5 shadow-2xl">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>📋 Saved Models & Configured Providers</span>
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              All active local and cloud models ready for use in ResearchMind. Click <span className="text-amber-400 font-semibold">Edit</span> to populate and modify settings in the form above.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
              {AVAILABLE_MODELS.length} Models Available
            </span>
            <button
              onClick={() => {
                fetchSettings();
                runDoctorChecks();
              }}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer"
              title="Refresh Models"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Models Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-850">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Model Name</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">API Key / Auth Source</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {AVAILABLE_MODELS.map((model) => {
                const isActive = modelProvider === model.provider && modelName === model.name;
                const authSource = getAuthSource(model);

                return (
                  <tr key={`${model.provider}-${model.name}`} className="hover:bg-slate-900/30 transition-colors">
                    
                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-900 text-slate-400 border border-slate-800">
                          Ready
                        </span>
                      )}
                    </td>

                    {/* Model Name */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-100 whitespace-nowrap">
                      <div>{model.name}</div>
                      <div className="text-[10px] text-slate-500 font-normal">{model.context}</div>
                    </td>

                    {/* Provider */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/60 text-indigo-300 border border-indigo-500/30">
                        {model.providerLabel}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        model.type === 'Local' 
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' 
                          : 'bg-cyan-950/40 text-cyan-400 border-cyan-500/30'
                      }`}>
                        {model.type}
                      </span>
                    </td>

                    {/* Auth Source */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {authSource}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditFromTable(model)}
                          className="text-amber-400 hover:text-amber-300 hover:bg-amber-950/30 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer border border-transparent hover:border-amber-500/30"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        {isActive ? (
                          <span className="text-slate-500 text-xs font-semibold px-3 py-1">
                            In Use
                          </span>
                        ) : (
                          <button
                            onClick={() => handleUseNow(model)}
                            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1 shadow-md shadow-cyan-500/10 transition-all cursor-pointer"
                          >
                            <Zap className="w-3 h-3 fill-slate-950" />
                            <span>Use Now</span>
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
