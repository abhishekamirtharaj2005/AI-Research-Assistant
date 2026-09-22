'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Trash2, 
  Plus, 
  Sparkles, 
  FileCode, 
  File, 
  CheckCircle, 
  AlertCircle 
} from 'lucide-react';
import MarkdownRenderer from '@/components/MarkdownRenderer';

interface Paper {
  id: number;
  title: string;
}

interface Report {
  id: number;
  title: string;
  type: string;
  content: string;
  created_at: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaperIds, setSelectedPaperIds] = useState<number[]>([]);
  const [reportType, setReportType] = useState('review'); // review, summary, gap, presentation, bibtex
  const [customPrompt, setCustomPrompt] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeReport, setActiveReport] = useState<Report | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

  useEffect(() => {
    fetchReports();
    fetchPapers();
  }, []);

  const fetchReports = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/reports/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data);
        if (data.length > 0) {
          setActiveReport(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
    }
  };

  const handleCheckboxChange = (id: number) => {
    setSelectedPaperIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const generateReport = async () => {
    if (selectedPaperIds.length === 0) return;
    setGenerating(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/reports/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: reportType,
          paper_ids: selectedPaperIds,
          custom_prompt: customPrompt || undefined
        })
      });

      if (res.ok) {
        const newReport = await res.json();
        setReports(prev => [newReport, ...prev]);
        setActiveReport(newReport);
        setCustomPrompt('');
        setSelectedPaperIds([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteReport = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this report?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/reports/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== id));
        if (activeReport?.id === id) {
          setActiveReport(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const triggerExport = (reportId: number, format: string) => {
    const token = localStorage.getItem('token');
    // Open in a new tab to initiate file stream downloads
    window.open(`${apiBase}/reports/${reportId}/export/${format}?token=${token}`, '_blank');
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">Research Reports</h2>
        <p className="text-slate-400 text-sm mt-1">Compile comprehensive literature reviews, gaps reviews, slides summaries, or export references.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Build Report & List */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Create Report Panel */}
          <div className="glass-panel p-6 space-y-4">
            <h4 className="text-base font-semibold text-white">Generate Custom Report</h4>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Report Type</label>
              <select 
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl p-3 outline-none focus:border-indigo-500"
              >
                <option value="review">Literature Review</option>
                <option value="gap">Gap Finder Report</option>
                <option value="summary">Detailed Summaries</option>
                <option value="presentation">Presentation Outline</option>
                <option value="bibtex">BibTeX references</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Include Papers</label>
              <div className="space-y-2 border border-slate-800 bg-slate-950/20 p-3 rounded-xl max-h-40 overflow-y-auto">
                {papers.length === 0 ? (
                  <p className="text-[10px] text-slate-500 text-center py-2">No papers found. Upload first.</p>
                ) : (
                  papers.map(p => (
                    <label key={p.id} className="flex items-center gap-2 text-[10px] font-semibold text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={selectedPaperIds.includes(p.id)}
                        onChange={() => handleCheckboxChange(p.id)}
                        className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-600 focus:ring-offset-slate-950 accent-indigo-500"
                      />
                      <span className="truncate">{p.title}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Custom Focus instructions (Optional)</label>
              <textarea 
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="E.g., Focus on accuracy improvements or mathematical frameworks."
                className="w-full h-20 bg-slate-900/50 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none transition-all resize-none"
              />
            </div>

            <button
              onClick={generateReport}
              disabled={selectedPaperIds.length === 0 || generating}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-600/20 text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              {generating ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Report</span>
                </>
              )}
            </button>
          </div>

          {/* List of previously generated reports */}
          <div className="glass-panel p-6 space-y-4">
            <h4 className="text-base font-semibold text-white font-bold">Report Library</h4>
            
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              </div>
            ) : reports.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No reports compiled yet.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {reports.map(r => (
                  <div 
                    key={r.id}
                    onClick={() => setActiveReport(r)}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      activeReport?.id === r.id 
                        ? 'border-indigo-500/80 bg-indigo-950/10 text-white' 
                        : 'border-slate-800 hover:border-slate-750 bg-slate-900/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="overflow-hidden flex items-center gap-2">
                      <FileText className="w-4 h-4 shrink-0 text-indigo-400" />
                      <span className="text-xs font-bold truncate block">{r.title}</span>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteReport(r.id, e)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Report View */}
        <div className="lg:col-span-2 space-y-4 flex flex-col h-full">
          {activeReport ? (
            <div className="glass-panel p-6 space-y-4 flex-1 flex flex-col">
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-indigo-950/40 text-indigo-400 border border-indigo-500/20">
                    {activeReport.type}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1.5">{activeReport.title}</h3>
                  <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                    Generated on {new Date(activeReport.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                {/* Export Buttons */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => triggerExport(activeReport.id, 'pdf')}
                    className="flex items-center gap-1 py-1.5 px-3 rounded-lg border border-slate-850 bg-slate-900/20 hover:bg-slate-900 text-xs font-bold text-slate-300 hover:text-white hover:border-slate-700 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                  <button 
                    onClick={() => triggerExport(activeReport.id, 'markdown')}
                    className="flex items-center gap-1 py-1.5 px-3 rounded-lg border border-slate-850 bg-slate-900/20 hover:bg-slate-900 text-xs font-bold text-slate-300 hover:text-white hover:border-slate-700 transition-all"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Markdown</span>
                  </button>
                  <button 
                    onClick={() => triggerExport(activeReport.id, 'html')}
                    className="flex items-center gap-1 py-1.5 px-3 rounded-lg border border-slate-850 bg-slate-900/20 hover:bg-slate-900 text-xs font-bold text-slate-300 hover:text-white hover:border-slate-700 transition-all"
                  >
                    <File className="w-3.5 h-3.5" />
                    <span>HTML</span>
                  </button>
                </div>
              </div>

              {/* Document Content View */}
              <div className="flex-1 overflow-y-auto pt-4 max-h-[500px]">
                <MarkdownRenderer content={activeReport.content} />
              </div>
            </div>
          ) : (
            <div className="glass-panel p-20 text-center flex flex-col items-center justify-center gap-3 border-dashed flex-1">
              <FileText className="w-12 h-12 text-slate-750" />
              <div className="space-y-1">
                <span className="text-sm font-semibold text-slate-300">No report selected</span>
                <p className="text-xs text-slate-500 max-w-sm">Create a new literature review or overview on the left panel to populate content here.</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
