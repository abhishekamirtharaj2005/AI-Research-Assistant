'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  UploadCloud, 
  Search, 
  Trash2, 
  Star, 
  FileText, 
  MessageSquare, 
  TrendingUp, 
  Plus, 
  BookOpen, 
  CheckCircle, 
  AlertCircle 
} from 'lucide-react';

interface Paper {
  id: number;
  title: string;
  authors: string;
  abstract: string;
  file_path: string;
  upload_date: string;
  status: string;
  is_favorite: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Upload states
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(-1); // -1 means idle
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001/api/v1';

  const fetchPapers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/papers/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setPapers(data);
      }
    } catch (e) {
      console.error("Error fetching papers:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    setUploadError('');
    setUploadSuccess(false);
    setUploadProgress(0);

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    // Simulate progress while uploading
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const res = await fetch(`${apiBase}/papers/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      clearInterval(interval);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Upload failed. Only PDF/TXT/DOCX are supported.');
      }

      setUploadProgress(100);
      setUploadSuccess(true);
      setTimeout(() => {
        setUploadProgress(-1);
        setUploadSuccess(false);
      }, 2000);
      
      fetchPapers(); // refresh papers list
    } catch (err: any) {
      clearInterval(interval);
      setUploadError(err.message || 'File upload failed.');
      setUploadProgress(-1);
    }
  };

  const handleDeletePaper = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening paper in workspace
    if (!confirm('Are you sure you want to delete this paper? This will remove its vector index.')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/papers/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setPapers(prev => prev.filter(p => p.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleFavorite = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/papers/${id}/favorite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const updated = await res.json();
        setPapers(prev => prev.map(p => p.id === id ? updated : p));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenPaper = (id: number) => {
    router.push(`/workspace?paperId=${id}`);
  };

  const filteredPapers = papers.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.authors && p.authors.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const favoritePapersCount = papers.filter(p => p.is_favorite).length;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Research Dashboard</h2>
          <p className="text-slate-400 text-sm mt-1">Manage your library, index new documents, and run AI synthesis.</p>
        </div>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-5 rounded-xl shadow-lg shadow-indigo-600/20 text-sm flex items-center gap-2 active:scale-95 transition-all self-start"
        >
          <Plus className="w-5 h-5" />
          <span>Upload Paper</span>
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
          className="hidden" 
          accept=".pdf,.txt,.docx"
        />
      </header>

      {/* Stats Overview */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 flex items-center justify-between hover-scale">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase">Total Papers</span>
            <h3 className="text-2xl font-bold text-white">{papers.length}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-950/50 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>
        
        <div className="glass-panel p-6 flex items-center justify-between hover-scale">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase">Favorites</span>
            <h3 className="text-2xl font-bold text-white">{favoritePapersCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-950/50 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Star className="w-6 h-6 fill-amber-400/20" />
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center justify-between hover-scale">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase">Reports</span>
            <h3 className="text-2xl font-bold text-white">4</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-950/50 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center justify-between hover-scale">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase">Index Health</span>
            <h3 className="text-2xl font-bold text-emerald-400">Optimal</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-950/50 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </section>

      {/* Main Grid: Upload Area & Recent List */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Upload Dropzone & Search */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 space-y-4">
            <h4 className="text-base font-semibold text-white">Index New Document</h4>
            
            {/* Dropzone */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 ${
                dragOver 
                  ? 'border-indigo-500 bg-indigo-950/10' 
                  : 'border-slate-800 hover:border-slate-700 bg-slate-900/10'
              }`}
            >
              <UploadCloud className={`w-10 h-10 ${dragOver ? 'text-indigo-400 animate-pulse' : 'text-slate-500'}`} />
              <div className="text-center">
                <span className="text-sm font-semibold text-slate-200">Drag & drop files here</span>
                <p className="text-xs text-slate-500 mt-1">Supports PDF, TXT, or DOCX (max 20MB)</p>
              </div>
            </div>

            {/* Upload progress & status */}
            {uploadProgress >= 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Processing document...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-200" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {uploadSuccess && (
              <div className="bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl flex items-center gap-2 text-xs">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Paper indexed successfully in Vector Store!</span>
              </div>
            )}

            {uploadError && (
              <div className="bg-rose-950/30 border border-rose-500/30 text-rose-400 p-3 rounded-xl flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

          {/* Quick Actions Card */}
          <div className="glass-panel p-6 space-y-4">
            <h4 className="text-base font-semibold text-white">Quick Tasks</h4>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => router.push('/compare')}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-950/30 hover:bg-slate-900/30 transition-all text-slate-300 hover:text-white text-center gap-2"
              >
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-medium">Compare Papers</span>
              </button>
              <button 
                onClick={() => router.push('/reports')}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-950/30 hover:bg-slate-900/30 transition-all text-slate-300 hover:text-white text-center gap-2"
              >
                <FileText className="w-5 h-5 text-purple-400" />
                <span className="text-xs font-medium">Create Report</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Library List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h4 className="text-lg font-bold text-white self-start">My Library</h4>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, authors..."
                className="w-full bg-slate-900/50 border border-slate-800 focus:border-indigo-500 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Papers List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
              <p className="text-xs text-slate-500">Loading library...</p>
            </div>
          ) : filteredPapers.length === 0 ? (
            <div className="glass-panel p-12 text-center flex flex-col items-center justify-center gap-3 border-dashed">
              <BookOpen className="w-12 h-12 text-slate-600" />
              <div className="space-y-1">
                <span className="text-sm font-semibold text-slate-300">No papers found</span>
                <p className="text-xs text-slate-500 max-w-sm">Upload a research PDF on the left to start interacting with it using AI.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredPapers.map((paper) => (
                <div 
                  key={paper.id}
                  onClick={() => handleOpenPaper(paper.id)}
                  className="glass-panel p-5 flex items-start justify-between gap-4 cursor-pointer hover:border-slate-700/80 transition-all group"
                >
                  <div className="space-y-2 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        paper.status === 'completed' 
                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20' 
                          : paper.status === 'processing' 
                          ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/20 animate-pulse'
                          : 'bg-rose-950/40 text-rose-400 border border-rose-500/20'
                      }`}>
                        {paper.status}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        {new Date(paper.upload_date).toLocaleDateString()}
                      </span>
                    </div>
                    <h5 className="font-bold text-slate-200 group-hover:text-indigo-400 transition-colors truncate">
                      {paper.title}
                    </h5>
                    <p className="text-xs text-slate-400 font-medium truncate">
                      {paper.authors || 'Unknown Authors'}
                    </p>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => handleToggleFavorite(paper.id, e)}
                      className="p-2 rounded-lg border border-slate-800/80 hover:border-slate-700 bg-slate-900/10 hover:bg-slate-900/60 transition-all text-slate-400 hover:text-amber-400"
                    >
                      <Star className={`w-4 h-4 ${paper.is_favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                    <button 
                      onClick={(e) => handleDeletePaper(paper.id, e)}
                      className="p-2 rounded-lg border border-slate-800/80 hover:border-rose-950 hover:bg-rose-950/10 transition-all text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
