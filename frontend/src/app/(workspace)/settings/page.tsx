'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  Key, 
  Sliders, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  X, 
  Sparkles, 
  Server, 
  ShieldCheck,
  Cpu
} from 'lucide-react';

export default function SettingsPage() {
  const [modelProvider, setModelProvider] = useState('openai');
  const [modelName, setModelName] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);

  // Multi-API Keys State
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');

  // Key Visibility Toggles
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

  useEffect(() => {
    fetchSettings();
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

        // Parse multi-API keys from api_keys_encrypted
        const rawKeys = data.api_keys_encrypted || '';
        if (rawKeys.startsWith('{')) {
          try {
            const parsed = JSON.parse(rawKeys);
            setOpenaiKey(parsed.openai || '');
            setGeminiKey(parsed.gemini || '');
            setAnthropicKey(parsed.anthropic || '');
            setOllamaUrl(parsed.ollama || 'http://localhost:11434');
          } catch (e) {
            // fallback if malformed
          }
        } else if (rawKeys) {
          // Legacy format single key: assign to active provider
          if (data.model_provider === 'gemini') setGeminiKey(rawKeys);
          else if (data.model_provider === 'anthropic') setAnthropicKey(rawKeys);
          else if (data.model_provider === 'ollama') setOllamaUrl(rawKeys);
          else setOpenaiKey(rawKeys);
        }
      }
    } catch (e) {
      console.error("Error loading settings:", e);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage({ type: '', text: '' });

    const token = localStorage.getItem('token');
    
    // Serialize all API keys into structured JSON
    const keysPayload = JSON.stringify({
      openai: openaiKey.trim(),
      gemini: geminiKey.trim(),
      anthropic: anthropicKey.trim(),
      ollama: ollamaUrl.trim() || 'http://localhost:11434'
    });

    try {
      const res = await fetch(`${apiBase}/settings/`, {
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

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'All API keys and system settings saved successfully.' });
      } else {
        throw new Error('Failed to save settings.');
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: 'Error saving settings to backend.' });
    } finally {
      setSaving(false);
    }
  };

  const modelPresets: Record<string, string[]> = {
    openai: ['gpt-4o-mini', 'gpt-4o', 'o3-mini'],
    gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
    ollama: ['llama3', 'mistral', 'deepseek-r1']
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
          <Settings className="w-8 h-8 text-indigo-400" />
          <span>System & API Settings</span>
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Manage your personal API keys for each AI provider, configure default models, and tune RAG chunking parameters.
        </p>
      </div>

      {statusMessage.text && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-xs border ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400' 
            : 'bg-rose-950/30 border-rose-500/30 text-rose-400'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={saveSettings} className="space-y-8">
        
        {/* SECTION 1: MULTI-API KEY MANAGER */}
        <div className="glass-panel p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" />
              <h4 className="font-semibold text-white">API Keys & Endpoints</h4>
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Saved per user account
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* OpenAI API Key */}
            <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <label className="text-xs font-bold text-slate-200">OpenAI API Key</label>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  openaiKey ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}>
                  {openaiKey ? 'Configured' : 'Not Set'}
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  type={showOpenai ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl py-2 pl-3 pr-16 text-xs text-white placeholder-slate-600 outline-none font-mono"
                />
                <div className="absolute right-2 flex items-center gap-1 text-slate-400">
                  <button
                    type="button"
                    onClick={() => setShowOpenai(!showOpenai)}
                    className="p-1 hover:text-white transition-colors"
                    title={showOpenai ? "Hide Key" : "Show Key"}
                  >
                    {showOpenai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  {openaiKey && (
                    <button
                      type="button"
                      onClick={() => setOpenaiKey('')}
                      className="p-1 hover:text-rose-400 transition-colors"
                      title="Clear Key"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-slate-500">Supports GPT-4o, GPT-4o-mini, and embeddings.</p>
            </div>

            {/* Google Gemini API Key */}
            <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                  <label className="text-xs font-bold text-slate-200">Google Gemini API Key</label>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  geminiKey ? 'bg-indigo-950/40 text-indigo-400 border-indigo-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}>
                  {geminiKey ? 'Configured' : 'Not Set'}
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  type={showGemini ? "text" : "password"}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl py-2 pl-3 pr-16 text-xs text-white placeholder-slate-600 outline-none font-mono"
                />
                <div className="absolute right-2 flex items-center gap-1 text-slate-400">
                  <button
                    type="button"
                    onClick={() => setShowGemini(!showGemini)}
                    className="p-1 hover:text-white transition-colors"
                    title={showGemini ? "Hide Key" : "Show Key"}
                  >
                    {showGemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  {geminiKey && (
                    <button
                      type="button"
                      onClick={() => setGeminiKey('')}
                      className="p-1 hover:text-rose-400 transition-colors"
                      title="Clear Key"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-slate-500">Supports Gemini 1.5 Flash, 1.5 Pro, and 2.0 Flash.</p>
            </div>

            {/* Anthropic Claude API Key */}
            <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <label className="text-xs font-bold text-slate-200">Anthropic Claude API Key</label>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  anthropicKey ? 'bg-amber-950/40 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}>
                  {anthropicKey ? 'Configured' : 'Not Set'}
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  type={showAnthropic ? "text" : "password"}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl py-2 pl-3 pr-16 text-xs text-white placeholder-slate-600 outline-none font-mono"
                />
                <div className="absolute right-2 flex items-center gap-1 text-slate-400">
                  <button
                    type="button"
                    onClick={() => setShowAnthropic(!showAnthropic)}
                    className="p-1 hover:text-white transition-colors"
                    title={showAnthropic ? "Hide Key" : "Show Key"}
                  >
                    {showAnthropic ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  {anthropicKey && (
                    <button
                      type="button"
                      onClick={() => setAnthropicKey('')}
                      className="p-1 hover:text-rose-400 transition-colors"
                      title="Clear Key"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-slate-500">Supports Claude 3.5 Sonnet and Claude 3 Haiku.</p>
            </div>

            {/* Ollama Base URL */}
            <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Server className="w-3 h-3 text-purple-400" />
                  <label className="text-xs font-bold text-slate-200">Ollama Host URL</label>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-purple-950/40 text-purple-400 border-purple-500/30">
                  Local / Ngrok
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434 or https://...ngrok.app"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl py-2 pl-3 pr-8 text-xs text-white placeholder-slate-600 outline-none font-mono"
                />
                {ollamaUrl !== 'http://localhost:11434' && (
                  <button
                    type="button"
                    onClick={() => setOllamaUrl('http://localhost:11434')}
                    className="absolute right-2 p-1 text-slate-400 hover:text-white transition-colors"
                    title="Reset to default localhost:11434"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-500">For deployed sites, enter your ngrok public URL tunnel.</p>
            </div>
          </div>
        </div>

        {/* SECTION 2: DEFAULT ENGINE & MODEL CONFIG */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass-panel p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <h4 className="font-semibold text-white">Default Model Selection</h4>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Default Provider</label>
              <select
                value={modelProvider}
                onChange={(e) => {
                  const prov = e.target.value;
                  setModelProvider(prov);
                  if (modelPresets[prov] && modelPresets[prov].length > 0) {
                    setModelName(modelPresets[prov][0]);
                  }
                }}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl p-3 outline-none focus:border-indigo-500"
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
                <option value="anthropic">Anthropic Claude</option>
                <option value="ollama">Local Ollama</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Default Model Name</label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="E.g. gpt-4o-mini"
                className="w-full bg-slate-900/50 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none transition-all"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(modelPresets[modelProvider] || []).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setModelName(preset)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-all ${
                      modelName === preset
                        ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/40'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Hyper-parameters & RAG Params */}
          <div className="glass-panel p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sliders className="w-5 h-5 text-purple-400" />
              <h4 className="font-semibold text-white">Hyper-parameters</h4>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Temperature ({temperature})</label>
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
                <label className="text-xs font-semibold text-slate-400">Max Tokens</label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  className="w-full bg-slate-900/50 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-white outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">RAG Chunk Size</label>
                <input
                  type="number"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value))}
                  className="w-full bg-slate-900/50 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-white outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Chunk Overlap</label>
                <input
                  type="number"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(parseInt(e.target.value))}
                  className="w-full bg-slate-900/50 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-white outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-3 px-8 rounded-xl shadow-lg shadow-indigo-600/20 text-sm flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
          >
            {saving ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save All Settings & Keys</span>
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
