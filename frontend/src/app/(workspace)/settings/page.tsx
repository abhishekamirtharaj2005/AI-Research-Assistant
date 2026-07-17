'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, Key, Sliders, CheckCircle, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const [modelProvider, setModelProvider] = useState('openai');
  const [modelName, setModelName] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const [apiKey, setApiKey] = useState('');

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001/api/v1';

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
        setModelProvider(data.model_provider);
        setModelName(data.model_name);
        setTemperature(data.temperature);
        setMaxTokens(data.max_tokens);
        setChunkSize(data.chunk_size);
        setChunkOverlap(data.chunk_overlap);
        setApiKey(data.api_keys_encrypted || '');
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
          api_keys_encrypted: apiKey
        })
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Configuration settings updated successfully.' });
      } else {
        throw new Error('Failed to save settings.');
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: 'Error saving settings to backend.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">System Settings</h2>
        <p className="text-slate-400 text-sm mt-1">Configure active AI providers, adjust chunking params, and set system hyper-parameters.</p>
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

      <form onSubmit={saveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Column: AI Provider Settings */}
        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Key className="w-5 h-5 text-indigo-400" />
            <h4 className="font-semibold text-white">AI Engine Config</h4>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400">LLM Provider</label>
            <select
              value={modelProvider}
              onChange={(e) => {
                setModelProvider(e.target.value);
                // Set default model name when changing provider
                if (e.target.value === 'openai') setModelName('gpt-4o-mini');
                else if (e.target.value === 'gemini') setModelName('gemini-1.5-flash');
                else if (e.target.value === 'anthropic') setModelName('claude-3-haiku-20240307');
                else if (e.target.value === 'ollama') setModelName('llama3');
              }}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl p-3 outline-none focus:border-indigo-500"
            >
              <option value="openai">OpenAI (Default)</option>
              <option value="gemini">Google Gemini</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="ollama">Local Ollama</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400">Model Name</label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="E.g. gpt-4o-mini"
              className="w-full bg-slate-900/50 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400">Provider API Key (Optional)</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave empty to use host environment variables"
              className="w-full bg-slate-900/50 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* Right Column: Hyper-parameters & RAG Params */}
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
              <label className="text-xs font-semibold text-slate-400">Max Output Tokens</label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full bg-slate-900/50 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-white outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-slate-850 pt-4">
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

        {/* Submit Bar */}
        <div className="col-span-1 md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-indigo-600/20 text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            {saving ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Configuration</span>
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
