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
  Trash2,
  Cpu
} from 'lucide-react';

export interface SavedModel {
  name: string;
  context: string;
  provider: 'openai' | 'gemini' | 'anthropic' | 'ollama';
  providerLabel: string;
  type: 'Cloud' | 'Local';
  auth_source?: string;
  isLocal?: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  anthropic: 'Anthropic',
  ollama: 'Ollama'
};

const DEFAULT_CLOUD_PRESETS: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'o3-mini', 'o1', 'gpt-4-turbo'],
  gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  ollama: []
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

  // Dynamic Models State: only real local models & explicitly saved user models
  const [localModels, setLocalModels] = useState<SavedModel[]>([]);
  const [savedCustomModels, setSavedCustomModels] = useState<SavedModel[]>([]);
  const [fetchingLocal, setFetchingLocal] = useState(false);

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
    fetchLocalModels();
    runDoctorChecks();
  }, []);

  // 1. Fetch user settings and saved models list from database
  const fetchSettings = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/settings/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.model_provider) setModelProvider(data.model_provider);
        if (data.model_name) setModelName(data.model_name);
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

            if (Array.isArray(parsed.saved_models)) {
              setSavedCustomModels(parsed.saved_models);
            }
          } catch (e) {
            console.error('Failed parsing api keys JSON', e);
          }
        } else if (raw) {
          // Backward compatibility with legacy string
          setKeysStore(prev => ({
            ...prev,
            [data.model_provider || 'openai']: raw
          }));
        }
      }
    } catch (e) {
      console.error('Failed fetching user settings', e);
    }
  };

  // 2. Discover available local Ollama models installed on the system
  const fetchLocalModels = async () => {
    setFetchingLocal(true);
    const token = localStorage.getItem('token');
    let detected: SavedModel[] = [];

    // Step A: Query backend /settings/local-models (fast and bypasses browser CORS)
    try {
      const res = await fetch(`${apiBase}/settings/local-models`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.available && Array.isArray(data.models)) {
          detected = data.models.map((m: any) => ({
            name: m.name,
            context: m.context || '128k',
            provider: 'ollama' as const,
            providerLabel: 'Ollama',
            type: 'Local' as const,
            auth_source: m.auth_source || 'Local (Ollama)',
            isLocal: true
          }));
        }
      }
    } catch (e) {
      console.warn('Backend local models discovery unreachable:', e);
    }

    // Step B: Fallback to direct client-side fetch if backend is remote (e.g. Render)
    if (detected.length === 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const directRes = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (directRes.ok) {
          const directData = await directRes.json();
          if (Array.isArray(directData.models)) {
            detected = directData.models.map((m: any) => {
              const ctx_raw = m.details?.context_length;
              let ctx_str = '128k';
              if (ctx_raw >= 1048576) ctx_str = `${Math.floor(ctx_raw / 1048576)}M`;
              else if (ctx_raw >= 1024) ctx_str = `${Math.floor(ctx_raw / 1024)}k`;
              return {
                name: m.name || m.model,
                context: ctx_str,
                provider: 'ollama' as const,
                providerLabel: 'Ollama',
                type: 'Local' as const,
                auth_source: 'Local (Ollama)',
                isLocal: true
              };
            });
          }
        }
      } catch (err) {
        // Localhost Ollama offline
      }
    }

    setLocalModels(detected);
    setFetchingLocal(false);
    return detected;
  };

  // 3. System diagnostics
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

  // Calculate context size display for a model
  const getModelContext = (name: string, prov: string = modelProvider) => {
    if (prov === 'ollama') {
      const found = localModels.find(m => m.name === name);
      if (found) return `${found.context} context`;
    }
    if (name.includes('gemini-1.5-pro')) return '2M context';
    if (name.includes('gemini-1.5-flash') || name.includes('gemini-2.0-flash')) return '1M context';
    if (name.includes('claude-3') || name.includes('o3-mini') || name.includes('o1')) return '200k context';
    if (name.includes('gpt-4o') || name.includes('gpt-4-turbo')) return '128k context';
    return '128k context';
  };

  const getAuthSourceForProvider = (prov: string) => {
    if (prov === 'ollama') {
      return keysStore.ollama ? `Local (${keysStore.ollama.replace('http://', '')})` : 'Local (Ollama)';
    }
    const key = keysStore[prov as keyof typeof keysStore];
    if (key) {
      return `User Key (••••${key.slice(-4)})`;
    }
    if (prov === 'openai') return 'Env Var (OPENAI_API_KEY)';
    if (prov === 'gemini') return 'Env Var (GEMINI_API_KEY)';
    if (prov === 'anthropic') return 'Env Var (ANTHROPIC_API_KEY)';
    return 'Not Configured';
  };

  // Helper to compile the list of REAL models (local models from system + saved models)
  const getCompiledDisplayModels = (): SavedModel[] => {
    const map = new Map<string, SavedModel>();

    // A. All actual local models installed on user's system
    localModels.forEach(m => {
      map.set(`${m.provider}:${m.name}`, m);
    });

    // B. All models explicitly saved by user
    savedCustomModels.forEach(m => {
      map.set(`${m.provider}:${m.name}`, {
        ...m,
        auth_source: m.type === 'Local' ? 'Local (Ollama)' : getAuthSourceForProvider(m.provider)
      });
    });

    // C. The user's currently active model from settings (always visible)
    const activeKey = `${modelProvider}:${modelName}`;
    if (!map.has(activeKey)) {
      const isLocal = modelProvider === 'ollama';
      map.set(activeKey, {
        name: modelName,
        context: getModelContext(modelName, modelProvider).replace(' context', ''),
        provider: modelProvider,
        providerLabel: PROVIDER_LABELS[modelProvider] || modelProvider,
        type: isLocal ? 'Local' : 'Cloud',
        auth_source: isLocal ? 'Local (Ollama)' : getAuthSourceForProvider(modelProvider),
        isLocal
      });
    }

    // D. If user has entered an API key for a cloud provider (e.g. Gemini), ensure their configured model is shown
    (['gemini', 'openai', 'anthropic'] as const).forEach(prov => {
      if (keysStore[prov] && !Array.from(map.values()).some(m => m.provider === prov)) {
        const defaultName = prov === 'gemini' ? 'gemini-1.5-flash' : prov === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-sonnet-20241022';
        map.set(`${prov}:${defaultName}`, {
          name: defaultName,
          context: getModelContext(defaultName, prov).replace(' context', ''),
          provider: prov,
          providerLabel: PROVIDER_LABELS[prov],
          type: 'Cloud',
          auth_source: `User Key (••••${keysStore[prov].slice(-4)})`,
          isLocal: false
        });
      }
    });

    return Array.from(map.values());
  };

  const displayModels = getCompiledDisplayModels();

  // Save Engine Config Form handler
  const saveEngineConfig = async (
    e?: React.FormEvent, 
    targetProv?: 'openai' | 'gemini' | 'anthropic' | 'ollama', 
    targetMod?: string
  ) => {
    if (e) e.preventDefault();
    setSaving(true);
    setStatusMessage({ type: '', text: '' });

    const finalProvider = targetProv || modelProvider;
    const finalModel = targetMod || modelName;

    // Prepare updated saved_models list
    let updatedSaved = [...savedCustomModels];
    const isLocal = finalProvider === 'ollama';
    const existingIndex = updatedSaved.findIndex(m => m.provider === finalProvider && m.name === finalModel);
    
    const newEntry: SavedModel = {
      name: finalModel,
      context: getModelContext(finalModel, finalProvider).replace(' context', ''),
      provider: finalProvider,
      providerLabel: PROVIDER_LABELS[finalProvider] || finalProvider,
      type: isLocal ? 'Local' : 'Cloud',
      isLocal
    };

    if (existingIndex >= 0) {
      updatedSaved[existingIndex] = newEntry;
    } else {
      updatedSaved.push(newEntry);
    }

    setSavedCustomModels(updatedSaved);

    const token = localStorage.getItem('token');
    const keysPayload = JSON.stringify({
      ...keysStore,
      saved_models: updatedSaved
    });

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
        setStatusMessage({ 
          type: 'success', 
          text: `Engine config saved! Active model: ${finalModel} (${PROVIDER_LABELS[finalProvider].toUpperCase()})` 
        });
        setModelProvider(finalProvider);
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

  // Remove a custom saved model
  const handleDeleteSavedModel = async (modelToDelete: SavedModel) => {
    if (modelToDelete.provider === modelProvider && modelToDelete.name === modelName) {
      alert('Cannot delete the currently active model. Switch active model first.');
      return;
    }

    const updated = savedCustomModels.filter(
      m => !(m.provider === modelToDelete.provider && m.name === modelToDelete.name)
    );
    setSavedCustomModels(updated);

    const token = localStorage.getItem('token');
    const keysPayload = JSON.stringify({
      ...keysStore,
      saved_models: updated
    });

    try {
      await fetch(`${apiBase}/settings/`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model_provider: modelProvider,
          model_name: modelName,
          temperature: parseFloat(temperature.toString()),
          max_tokens: parseInt(maxTokens.toString()),
          chunk_size: parseInt(chunkSize.toString()),
          chunk_overlap: parseInt(chunkOverlap.toString()),
          api_keys_encrypted: keysPayload
        })
      });
      setStatusMessage({ type: 'success', text: `Removed saved model ${modelToDelete.name}` });
    } catch (e) {
      console.error(e);
    }
  };

  // Click "Edit" in table
  const handleEditFromTable = (model: SavedModel) => {
    setModelProvider(model.provider);
    setModelName(model.name);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Click "Use Now" in table
  const handleUseNow = async (model: SavedModel) => {
    setModelProvider(model.provider);
    setModelName(model.name);
    await saveEngineConfig(undefined, model.provider, model.name);
  };

  // Get active presets to display below Model Name input
  const getPresetsForSelectedProvider = (): string[] => {
    if (modelProvider === 'ollama') {
      // Show actual installed local models as presets!
      if (localModels.length > 0) {
        return localModels.map(m => m.name);
      }
      return [];
    }
    return DEFAULT_CLOUD_PRESETS[modelProvider] || [];
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
            Run full system diagnostics and inspect or edit the active Hermclaw configuration.
          </p>
        </div>

        <button
          onClick={() => {
            runDoctorChecks();
            fetchLocalModels();
          }}
          disabled={runningDoctor || fetchingLocal}
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <Activity className={`w-4 h-4 ${runningDoctor || fetchingLocal ? 'animate-spin' : ''}`} />
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
                  if (prov === 'ollama') {
                    if (localModels.length > 0) {
                      setModelName(localModels[0].name);
                    } else {
                      setModelName('gemma4:12b');
                    }
                  } else {
                    const presets = DEFAULT_CLOUD_PRESETS[prov];
                    if (presets && presets.length > 0) {
                      setModelName(presets[0]);
                    }
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
              <span className="text-[11px] font-mono text-slate-500">{getModelContext(modelName, modelProvider)}</span>
            </div>

            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder={modelProvider === 'ollama' ? "e.g. qwen3.5:0.8b or gemma4:12b" : "e.g. gpt-4o-mini or gemini-1.5-flash"}
              className="w-full bg-slate-900/60 border border-slate-800 focus:border-indigo-500 rounded-xl p-3.5 text-xs text-slate-100 font-mono outline-none transition-all placeholder-slate-600"
            />

            {/* Presets Row */}
            <div className="flex flex-wrap gap-2 pt-1 items-center">
              {getPresetsForSelectedProvider().map((preset) => (
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

              {modelProvider === 'ollama' && localModels.length === 0 && (
                <span className="text-[11px] text-slate-500 italic">
                  No local models detected on port 11434. Start Ollama to detect models.
                </span>
              )}
            </div>
          </div>

          {/* Field 3: Provider API Key (Optional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400">
                {modelProvider === 'ollama' ? 'Ollama Host URL' : 'Provider API Key (Optional)'}
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
              Keys are safely stored in <span className="font-mono text-slate-400">~/.hermclaw/.env</span> and never exposed in cleartext.
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
              All active local and cloud models ready for use in Hermclaw. Click <span className="text-amber-400 font-semibold">Edit</span> to populate and modify settings in the form above.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
              {displayModels.length} Models Available
            </span>
            <button
              onClick={() => {
                fetchSettings();
                fetchLocalModels();
                runDoctorChecks();
              }}
              disabled={fetchingLocal || runningDoctor}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer disabled:opacity-50"
              title="Refresh Models"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${fetchingLocal ? 'animate-spin' : ''}`} />
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
              {displayModels.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    <Cpu className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="font-semibold text-slate-400">No models detected or configured</p>
                    <p className="text-[11px] text-slate-500 mt-1">Start Ollama (`ollama serve`) or configure a cloud provider key above.</p>
                  </td>
                </tr>
              ) : (
                displayModels.map((model) => {
                  const isActive = modelProvider === model.provider && modelName === model.name;
                  const authSource = model.auth_source || getAuthSourceForProvider(model.provider);
                  const isUserCustom = !model.isLocal && savedCustomModels.some(m => m.provider === model.provider && m.name === model.name);

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
                          {model.providerLabel || PROVIDER_LABELS[model.provider]}
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

                          {isUserCustom && !isActive && (
                            <button
                              onClick={() => handleDeleteSavedModel(model)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                              title="Delete Saved Model"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
