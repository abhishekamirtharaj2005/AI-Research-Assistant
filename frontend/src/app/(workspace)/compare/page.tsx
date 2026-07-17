'use client';

import { useState, useEffect } from 'react';
import { Columns, Sparkles, Check, Info } from 'lucide-react';

interface Paper {
  id: number;
  title: string;
  authors: string;
  is_favorite: boolean;
}

export default function ComparePage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [comparing, setComparing] = useState(false);
  const [matrixText, setMatrixText] = useState('');
  const [loading, setLoading] = useState(true);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001/api/v1';

  useEffect(() => {
    fetchPapers();
  }, []);

  const fetchPapers = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/papers/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPapers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const runComparison = async () => {
    if (selectedIds.length === 0) return;
    setComparing(true);
    setMatrixText('');

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/papers/compare`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ paper_ids: selectedIds })
      });
      if (res.ok) {
        const data = await res.json();
        setMatrixText(data.comparison_matrix);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setComparing(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">Compare Research Papers</h2>
        <p className="text-slate-400 text-sm mt-1">Select multiple documents from your library to generate side-by-side comparative matrices.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Selectors */}
        <div className="lg:col-span-1 glass-panel p-6 space-y-4 h-fit">
          <h4 className="text-base font-semibold text-white">Select Papers to Compare</h4>
          
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          ) : papers.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No papers indexed. Upload papers on the dashboard first.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {papers.map(p => (
                <label 
                  key={p.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedIds.includes(p.id) 
                      ? 'border-indigo-500/80 bg-indigo-950/10 text-white' 
                      : 'border-slate-800 hover:border-slate-750 bg-slate-900/10 text-slate-300'
                  }`}
                >
                  <input 
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => handleCheckboxChange(p.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-600 focus:ring-offset-slate-950 accent-indigo-500 outline-none"
                  />
                  <div className="overflow-hidden">
                    <span className="text-xs font-bold block truncate">{p.title}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5 truncate">{p.authors || 'Unknown author'}</span>
                  </div>
                </label>
              ))}
            </div>
          )}

          <button
            onClick={runComparison}
            disabled={selectedIds.length === 0 || comparing}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-600/20 text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            {comparing ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Compare Selected ({selectedIds.length})</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Comparison Matrix Display */}
        <div className="lg:col-span-2 space-y-4">
          <h4 className="text-lg font-bold text-white">Comparison Matrix</h4>

          {comparing ? (
            <div className="glass-panel p-20 flex flex-col items-center justify-center gap-4 text-center">
              <Sparkles className="w-10 h-10 text-indigo-400 animate-spin" />
              <div className="space-y-1">
                <span className="text-sm font-semibold text-slate-200">Generating Comparison Matrix</span>
                <p className="text-xs text-slate-500 max-w-sm">The Comparison Agent is extracting methodologies, datasets, accuracy, and pros/cons to generate a comparative grid...</p>
              </div>
            </div>
          ) : matrixText ? (
            <div className="glass-panel p-6 overflow-x-auto whitespace-pre-wrap leading-relaxed text-xs text-slate-200 prose max-w-none border-slate-800/80">
              {matrixText}
            </div>
          ) : (
            <div className="glass-panel p-16 text-center flex flex-col items-center justify-center gap-3 border-dashed">
              <Columns className="w-12 h-12 text-slate-700" />
              <div className="space-y-1">
                <span className="text-sm font-semibold text-slate-300">No comparison active</span>
                <p className="text-xs text-slate-500 max-w-sm">Select two or more papers from the checklist and hit compare to see differences.</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
