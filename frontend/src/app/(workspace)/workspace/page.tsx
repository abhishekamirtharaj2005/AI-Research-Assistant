'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Send, 
  User, 
  Sparkles, 
  CheckCircle, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  MessageSquare, 
  FileText, 
  TrendingUp, 
  Layers, 
  Settings,
  HelpCircle,
  Copy,
  Check,
  Plus,
  Bot,
  Paperclip,
  X,
  ChevronDown,
  Trash2,
  FileCheck2,
  Layers3
} from 'lucide-react';
import MarkdownRenderer from '@/components/MarkdownRenderer';

interface Paper {
  id: number;
  title: string;
  authors: string;
  abstract: string;
  file_path: string;
  metadata_json?: string;
}

interface Citation {
  source_index: number;
  paper_id: number;
  paper_title: string;
  page_number: number;
  snippet: string;
  confidence: number;
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

interface ChatSession {
  id: number;
  title: string;
  paper_id?: number | null;
  paper_ids?: number[];
  model_provider?: string;
  model_name?: string;
  created_at: string;
}

const MODEL_OPTIONS = [
  { group: 'Google Gemini', provider: 'gemini', model: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Fast)' },
  { group: 'Google Gemini', provider: 'gemini', model: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Deep)' },
  { group: 'Google Gemini', provider: 'gemini', model: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { group: 'OpenAI', provider: 'openai', model: 'gpt-4o-mini', label: 'GPT-4o Mini (Default)' },
  { group: 'OpenAI', provider: 'openai', model: 'gpt-4o', label: 'GPT-4o (Advanced)' },
  { group: 'OpenAI', provider: 'openai', model: 'o3-mini', label: 'o3 Mini (Reasoning)' },
  { group: 'Anthropic', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { group: 'Anthropic', provider: 'anthropic', model: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  { group: 'Local Ollama', provider: 'ollama', model: 'llama3', label: 'Ollama (Llama 3)' },
  { group: 'Local Ollama', provider: 'ollama', model: 'mistral', label: 'Ollama (Mistral)' },
  { group: 'Local Ollama', provider: 'ollama', model: 'deepseek-r1', label: 'Ollama (DeepSeek R1)' },
];

function WorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activePaperIdParam = searchParams.get('paperId');

  const [papers, setPapers] = useState<Paper[]>([]);
  const [activePaper, setActivePaper] = useState<Paper | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageText, setPageText] = useState('Loading page content...');
  const [pagesList, setPagesList] = useState<{page_number: number, text: string}[]>([]);

  // Workspace View Tabs: 'chat' | 'summary' | 'gaps' | 'bibtex'
  const [activeTab, setActiveTab] = useState<'chat' | 'summary' | 'gaps' | 'bibtex'>('chat');

  // AI Chat States
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [streamingMessage, setStreamingMessage] = useState('');
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
  const [activeAgent, setActiveAgent] = useState('coordinator');
  const [loadingChat, setLoadingChat] = useState(false);

  // In-Chat Model Selection
  const [activeModel, setActiveModel] = useState({
    provider: 'openai',
    model: 'gpt-4o-mini'
  });

  // Multi-File Chat Context & Scope
  const [chatScope, setChatScope] = useState<'current' | 'all'>('current');
  const [attachedPaperIds, setAttachedPaperIds] = useState<number[]>([]);
  const [showFileModal, setShowFileModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');

  // Copied bibtex state
  const [copied, setCopied] = useState(false);

  // Summary generation states
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<string>('');

  // Gap generator states
  const [generatingGaps, setGeneratingGaps] = useState(false);
  const [gapsData, setGapsData] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

  // Load basic details
  useEffect(() => {
    fetchUserSettings();
    fetchPapers();
  }, []);

  // Fetch user default setting for initial model
  const fetchUserSettings = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/settings/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.model_provider && data.model_name) {
          setActiveModel({
            provider: data.model_provider,
            model: data.model_name
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Sync active paper when ID changes
  useEffect(() => {
    if (activePaperIdParam && papers.length > 0) {
      const selected = papers.find(p => p.id === parseInt(activePaperIdParam));
      if (selected) {
        handleSelectPaper(selected);
      }
    }
  }, [activePaperIdParam, papers]);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const fetchPapers = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/papers/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPapers(data);
        if (data.length > 0 && !activePaperIdParam) {
          handleSelectPaper(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch chat sessions scoped to paper or global
  const fetchChatSessions = async (paperId?: number | null, fallbackCreate = true) => {
    const token = localStorage.getItem('token');
    try {
      const query = paperId ? `?paper_id=${paperId}` : '';
      const res = await fetch(`${apiBase}/chats/${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data: ChatSession[] = await res.json();
        setSessions(data);
        if (data.length > 0) {
          handleSelectSession(data[0]);
        } else if (fallbackCreate) {
          // Auto create initial session for this scope
          const defaultTitle = paperId 
            ? `Chat: ${activePaper?.title.slice(0, 25) || 'Paper'}...`
            : "General Multi-Paper Session";
          createSession(defaultTitle, paperId ? [paperId] : []);
        } else {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createSession = async (title: string, pIds: number[] = []) => {
    const token = localStorage.getItem('token');
    const targetPaperId = activePaper?.id || null;
    const finalPaperIds = pIds.length > 0 ? pIds : (targetPaperId ? [targetPaperId] : []);

    try {
      const res = await fetch(`${apiBase}/chats/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          title: title.trim() || 'New Chat Session',
          paper_id: targetPaperId,
          paper_ids: finalPaperIds,
          model_provider: activeModel.provider,
          model_name: activeModel.model
        })
      });
      if (res.ok) {
        const newSession: ChatSession = await res.json();
        setSessions(prev => [newSession, ...prev]);
        handleSelectSession(newSession);
        setShowNewChatModal(false);
        setNewChatTitle('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectSession = async (session: ChatSession) => {
    setActiveSessionId(session.id);
    setMessages([]);

    // Restore session model if saved
    if (session.model_provider && session.model_name) {
      setActiveModel({
        provider: session.model_provider,
        model: session.model_name
      });
    }

    // Restore attached paper IDs
    if (session.paper_ids && session.paper_ids.length > 0) {
      setAttachedPaperIds(session.paper_ids);
    } else if (session.paper_id) {
      setAttachedPaperIds([session.paper_id]);
    } else if (activePaper) {
      setAttachedPaperIds([activePaper.id]);
    }

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/chats/${session.id}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          citations: m.citations ? JSON.parse(m.citations) : undefined
        })));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSession = async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/chats/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const remaining = sessions.filter(s => s.id !== sessionId);
        setSessions(remaining);
        if (activeSessionId === sessionId) {
          if (remaining.length > 0) {
            handleSelectSession(remaining[0]);
          } else {
            setActiveSessionId(null);
            setMessages([]);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Update session attached papers
  const updateSessionAttachedPapers = async (newPaperIds: number[]) => {
    setAttachedPaperIds(newPaperIds);
    if (!activeSessionId) return;

    const token = localStorage.getItem('token');
    try {
      await fetch(`${apiBase}/chats/${activeSessionId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paper_ids: newPaperIds
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Update session chosen model
  const handleModelChange = async (provider: string, model: string) => {
    setActiveModel({ provider, model });
    if (!activeSessionId) return;

    const token = localStorage.getItem('token');
    try {
      await fetch(`${apiBase}/chats/${activeSessionId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model_provider: provider,
          model_name: model
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectPaper = async (paper: Paper, switchChat = true) => {
    setActivePaper(paper);
    setActivePage(1);

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/papers/${paper.id}/pages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const pages = await res.json();
        setPagesList(pages);
        setTotalPages(pages.length);
        if (pages.length > 0) {
          setPageText(pages[0].text);
        } else {
          setPageText('No readable text extracted for this document.');
        }
      }
    } catch (e) {
      console.error(e);
    }

    if (switchChat) {
      setAttachedPaperIds([paper.id]);
      if (chatScope === 'current') {
        fetchChatSessions(paper.id);
      }
    }
  };

  const handlePageChange = (direction: 'next' | 'prev') => {
    let nextP = activePage;
    if (direction === 'next' && activePage < totalPages) nextP += 1;
    if (direction === 'prev' && activePage > 1) nextP -= 1;
    
    setActivePage(nextP);
    if (pagesList[nextP - 1]) {
      setPageText(pagesList[nextP - 1].text);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !activeSessionId || loadingChat) return;

    const userText = inputMessage;
    setInputMessage('');
    setLoadingChat(true);
    setErrorChat('');

    // Append temporary user message to UI
    const tempUserMsg: Message = { id: Date.now(), role: 'user', content: userText };
    setMessages(prev => [...prev, tempUserMsg]);

    setStreamingMessage('');
    setStreamingCitations([]);

    const token = localStorage.getItem('token');
    const paperIdsQuery = attachedPaperIds.length > 0 
      ? `&paper_ids=${attachedPaperIds.join(',')}` 
      : (activePaper ? `&active_paper_id=${activePaper.id}` : '');
    const modelQuery = `&model_provider=${activeModel.provider}&model_name=${activeModel.model}`;

    try {
      const res = await fetch(`${apiBase}/chats/${activeSessionId}/stream?agent_type=${activeAgent}${paperIdsQuery}${modelQuery}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: userText,
          agent_type: activeAgent
        })
      });

      if (!res.ok) {
        throw new Error('Streaming failed.');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (!reader) return;

      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Parse lines in buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith('event: citations')) {
            const dataLine = lines[i + 1] || '';
            if (dataLine.startsWith('data: ')) {
              try {
                const citations = JSON.parse(dataLine.replace('data: ', '').trim());
                setStreamingCitations(citations);
              } catch (err) {}
            }
          }
          else if (line.startsWith('event: token')) {
            const dataLine = lines[i + 1] || '';
            if (dataLine.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(dataLine.replace('data: ', '').trim());
                if (parsed.token) {
                  setStreamingMessage(prev => prev + parsed.token);
                }
              } catch (err) {}
            }
          }
        }
      }

      // Stream fully done, refresh messages list
      const activeSess = sessions.find(s => s.id === activeSessionId);
      if (activeSess) handleSelectSession(activeSess);
    } catch (e) {
      console.error(e);
      setErrorChat('Failed to connect to AI Agent service.');
    } finally {
      setLoadingChat(false);
      setStreamingMessage('');
      setStreamingCitations([]);
    }
  };

  const [errorChat, setErrorChat] = useState('');

  const triggerSummary = async () => {
    if (!activePaper) return;
    setGeneratingSummary(true);
    setSummaryData('');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/reports/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `Summary - ${activePaper.title}`,
          type: 'summary',
          paper_ids: [activePaper.id]
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data.content);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const triggerGaps = async () => {
    if (!activePaper) return;
    setGeneratingGaps(true);
    setGapsData('');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/reports/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `Research Gaps - ${activePaper.title}`,
          type: 'gap',
          paper_ids: [activePaper.id]
        })
      });
      if (res.ok) {
        const data = await res.json();
        setGapsData(data.content);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingGaps(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const metaData = activePaper?.metadata_json ? JSON.parse(activePaper.metadata_json) : {};
  const bibtexCode = metaData.bibtex || `@article{author2026, \n  title={${activePaper?.title}},\n  author={${activePaper?.authors}},\n  year={2026}\n}`;

  return (
    <div className="flex h-full w-full overflow-hidden">
      
      {/* LEFT PANEL: Document Reader */}
      <div className="w-1/2 h-full border-r border-slate-800 flex flex-col bg-slate-950/20">
        
        {/* Reader Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-indigo-400 shrink-0" />
            <select 
              value={activePaper?.id || ''} 
              onChange={(e) => {
                const selected = papers.find(p => p.id === parseInt(e.target.value));
                if (selected) handleSelectPaper(selected);
              }}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs font-semibold rounded-lg p-2 max-w-sm outline-none focus:border-indigo-500 truncate"
            >
              {papers.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          
          {/* Page Selector */}
          {activePaper && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handlePageChange('prev')}
                disabled={activePage === 1}
                className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 hover:bg-slate-900 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-slate-300 whitespace-nowrap">
                Page {activePage} of {totalPages}
              </span>
              <button 
                onClick={() => handlePageChange('next')}
                disabled={activePage === totalPages}
                className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 hover:bg-slate-900 transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Reader Document Text Area */}
        <div className="flex-1 overflow-y-auto p-8 leading-relaxed text-sm text-slate-300 whitespace-pre-wrap font-sans bg-slate-900/10">
          <div className="max-w-2xl mx-auto glass-panel p-8 shadow-2xl border-slate-800/40">
            {pageText}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Workspace Sidebar (Tabs) */}
      <div className="w-1/2 h-full flex flex-col bg-slate-900/10">
        
        {/* Tabs Selectors */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 py-4 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'chat' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>AI Chat</span>
          </button>
          
          <button 
            onClick={() => { setActiveTab('summary'); if (!summaryData) triggerSummary(); }}
            className={`flex items-center gap-2 py-4 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'summary' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Summaries</span>
          </button>

          <button 
            onClick={() => { setActiveTab('gaps'); if (!gapsData) triggerGaps(); }}
            className={`flex items-center gap-2 py-4 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'gaps' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Gap Finder</span>
          </button>

          <button 
            onClick={() => setActiveTab('bibtex')}
            className={`flex items-center gap-2 py-4 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'bibtex' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>BibTeX / Refs</span>
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          
          {/* 1. CHAT TAB */}
          {activeTab === 'chat' && (
            <>
              {/* CHAT CONTROL HEADER: Sessions + Model + Agent */}
              <div className="p-3 border-b border-slate-800 bg-slate-950/30 space-y-2.5">
                
                {/* Top Row: Chat Thread Switcher & Actions */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 overflow-hidden">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Chat:</span>
                    <select
                      value={activeSessionId || ''}
                      onChange={(e) => {
                        const sess = sessions.find(s => s.id === parseInt(e.target.value));
                        if (sess) handleSelectSession(sess);
                      }}
                      className="bg-slate-900 border border-slate-800 text-slate-200 text-xs font-semibold rounded-lg p-1.5 outline-none focus:border-indigo-500 flex-1 truncate"
                    >
                      {sessions.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => setShowNewChatModal(true)}
                      className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 transition-all flex items-center gap-1 text-xs font-bold shrink-0 cursor-pointer"
                      title="Create New Chat Thread"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">New Chat</span>
                    </button>
                  </div>

                  {/* Scope filter: This File vs All Files */}
                  <div className="flex items-center border border-slate-800 rounded-lg p-0.5 bg-slate-900/60 text-[10px] font-bold shrink-0">
                    <button
                      onClick={() => {
                        setChatScope('current');
                        fetchChatSessions(activePaper?.id || null);
                      }}
                      className={`px-2 py-1 rounded transition-all cursor-pointer ${
                        chatScope === 'current' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      File Chat
                    </button>
                    <button
                      onClick={() => {
                        setChatScope('all');
                        fetchChatSessions(null);
                      }}
                      className={`px-2 py-1 rounded transition-all cursor-pointer ${
                        chatScope === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      All Chats
                    </button>
                  </div>
                </div>

                {/* Second Row: Model Selector & Agent Selector */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-850">
                  {/* Model Selector */}
                  <div className="flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-400">Model:</span>
                    <select
                      value={`${activeModel.provider}::${activeModel.model}`}
                      onChange={(e) => {
                        const [p, m] = e.target.value.split('::');
                        handleModelChange(p, m);
                      }}
                      className="bg-slate-900/90 border border-slate-800 text-slate-200 text-xs font-bold rounded-lg p-1.5 outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {['Google Gemini', 'OpenAI', 'Anthropic', 'Local Ollama'].map(group => (
                        <optgroup key={group} label={group}>
                          {MODEL_OPTIONS.filter(opt => opt.group === group).map(opt => (
                            <option key={`${opt.provider}::${opt.model}`} value={`${opt.provider}::${opt.model}`}>
                              {opt.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Active Agent Selector */}
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-400">Agent:</span>
                    <select 
                      value={activeAgent}
                      onChange={(e) => setActiveAgent(e.target.value)}
                      className="bg-slate-900/90 border border-slate-800 text-slate-200 text-xs font-bold rounded-lg p-1.5 outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="coordinator">Coordinator</option>
                      <option value="research">Research</option>
                      <option value="summary">Summary</option>
                      <option value="citation">Citation</option>
                      <option value="gap">Gap Finder</option>
                      <option value="reviewer">Reviewer</option>
                      <option value="planner">Planner</option>
                    </select>
                  </div>
                </div>

                {/* Third Row: Multi-File Context Bar */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-850 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
                    <Paperclip className="w-3 h-3 text-indigo-400" />
                    Context Files ({attachedPaperIds.length}):
                  </span>

                  <div className="flex flex-wrap items-center gap-1 flex-1">
                    {attachedPaperIds.map(pid => {
                      const paper = papers.find(p => p.id === pid);
                      return (
                        <span 
                          key={pid}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 rounded-md px-2 py-0.5"
                        >
                          <span className="truncate max-w-[120px]">{paper?.title || `Paper #${pid}`}</span>
                          <button
                            onClick={() => {
                              const updated = attachedPaperIds.filter(id => id !== pid);
                              updateSessionAttachedPapers(updated);
                            }}
                            className="hover:text-rose-400 transition-colors p-0.5"
                            title="Remove from chat context"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      );
                    })}

                    <button
                      onClick={() => setShowFileModal(true)}
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/60 rounded-md px-2 py-0.5 bg-slate-900 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Attach Files</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Chat Message Window */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 && !streamingMessage && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-3">
                    <Sparkles className="w-12 h-12 text-slate-700 animate-pulse" />
                    <div className="space-y-1">
                      <h5 className="font-bold text-slate-300 text-sm">Ask anything about your document</h5>
                      <p className="text-xs text-slate-500 max-w-sm">
                        The {activeAgent.toUpperCase()} agent with {activeModel.model} will search across {attachedPaperIds.length} attached document(s) and provide cited page references.
                      </p>
                    </div>
                  </div>
                )}
                
                {messages.map((m) => (
                  <div 
                    key={m.id}
                    className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold shadow-inner shrink-0 ${
                      m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-indigo-400 border border-indigo-500/20'
                    }`}>
                      {m.role === 'user' ? 'U' : 'AI'}
                    </div>
                    <div className="space-y-2">
                      <div className={`p-4 rounded-2xl text-xs leading-relaxed ${
                        m.role === 'user' 
                          ? 'bg-indigo-600 text-white rounded-tr-none whitespace-pre-wrap' 
                          : 'bg-slate-850 border border-slate-800 text-slate-200 rounded-tl-none'
                      }`}>
                        {m.role === 'user' ? (
                          m.content
                        ) : (
                          <MarkdownRenderer content={m.content} />
                        )}
                      </div>
                      
                      {/* Citations list */}
                      {m.citations && m.citations.length > 0 && (
                        <div className="flex flex-wrap gap-2 px-1">
                          {m.citations.map((c, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                if (c.paper_id && activePaper?.id !== c.paper_id) {
                                  const targetPaper = papers.find(p => p.id === c.paper_id);
                                  if (targetPaper) handleSelectPaper(targetPaper, false);
                                }
                                setActivePage(c.page_number);
                                setPageText(pagesList[c.page_number - 1]?.text || '');
                              }}
                              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-950/80 border border-indigo-500/20 rounded-lg px-2.5 py-1 transition-all flex items-center gap-1 cursor-pointer"
                              title={c.snippet}
                            >
                              <span>[{c.source_index}] {c.paper_title ? c.paper_title.slice(0, 15) + '...' : ''} p. {c.page_number}</span>
                              <span className="text-[8px] text-slate-500 font-normal">({Math.round(c.confidence*100)}% match)</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* SSE stream component */}
                {streamingMessage && (
                  <div className="flex gap-3 max-w-[85%]">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-xs font-semibold shadow-inner shrink-0">
                      AI
                    </div>
                    <div className="space-y-2 w-full">
                      <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 text-slate-200 rounded-tl-none text-xs leading-relaxed">
                        <MarkdownRenderer content={streamingMessage} />
                        <span className="inline-block w-1.5 h-3.5 bg-indigo-500 ml-1 animate-pulse align-middle"></span>
                      </div>
                      
                      {/* Streaming Citations */}
                      {streamingCitations.length > 0 && (
                        <div className="flex flex-wrap gap-2 px-1">
                          {streamingCitations.map((c, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                if (c.paper_id && activePaper?.id !== c.paper_id) {
                                  const targetPaper = papers.find(p => p.id === c.paper_id);
                                  if (targetPaper) handleSelectPaper(targetPaper, false);
                                }
                                setActivePage(c.page_number);
                                setPageText(pagesList[c.page_number - 1]?.text || '');
                              }}
                              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 border border-indigo-500/20 rounded-lg px-2.5 py-1 transition-all cursor-pointer"
                            >
                              [{c.source_index}] p. {c.page_number}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Scroll Anchor */}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-4 border-t border-slate-800 bg-slate-900/40">
                <form 
                  onSubmit={handleSendMessage}
                  className="relative flex items-center"
                >
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={activeSessionId ? `Ask about attached ${attachedPaperIds.length} file(s)...` : "Create a chat session first..."}
                    disabled={!activeSessionId || loadingChat}
                    className="w-full bg-slate-950/60 border border-slate-800/80 rounded-2xl py-3 pl-4 pr-12 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || loadingChat || !activeSessionId}
                    className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </>
          )}

          {/* 2. SUMMARIES TAB */}
          {activeTab === 'summary' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {generatingSummary ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
                  <p className="text-xs text-slate-500">Synthesizing multi-level summary...</p>
                </div>
              ) : summaryData ? (
                <div className="glass-panel p-6 border-slate-800/80">
                  <MarkdownRenderer content={summaryData} />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-3">
                  <FileText className="w-12 h-12 text-slate-700" />
                  <h5 className="font-bold text-slate-300 text-sm">No summary generated</h5>
                  <button 
                    onClick={triggerSummary}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-xl text-xs cursor-pointer"
                  >
                    Generate Summary
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. GAPS TAB */}
          {activeTab === 'gaps' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {generatingGaps ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
                  <p className="text-xs text-slate-500">Critiquing methodology & finding research gaps...</p>
                </div>
              ) : gapsData ? (
                <div className="glass-panel p-6 border-slate-800/80">
                  <MarkdownRenderer content={gapsData} />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-3">
                  <TrendingUp className="w-12 h-12 text-slate-700" />
                  <h5 className="font-bold text-slate-300 text-sm">No analysis performed</h5>
                  <button 
                    onClick={triggerGaps}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-xl text-xs cursor-pointer"
                  >
                    Perform Gap Analysis
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 4. BIBTEX TAB */}
          {activeTab === 'bibtex' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="glass-panel p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h5 className="font-bold text-slate-200 text-xs">BibTeX Citation Code</h5>
                  <button 
                    onClick={() => copyToClipboard(bibtexCode)}
                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold bg-indigo-950/40 border border-indigo-500/20 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
                <pre className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed border border-slate-850">
                  {bibtexCode}
                </pre>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL: ATTACH MULTIPLE FILES TO CHAT */}
      {showFileModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-indigo-400" />
                <h4 className="font-bold text-white text-sm">Select Documents for Chat Context</h4>
              </div>
              <button 
                onClick={() => setShowFileModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Check all papers you want the AI to analyze and retrieve context from simultaneously.
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {papers.map(p => {
                const isSelected = attachedPaperIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-950/40 border-indigo-500/60 text-white' 
                        : 'bg-slate-900/40 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        const updated = isSelected 
                          ? attachedPaperIds.filter(id => id !== p.id)
                          : [...attachedPaperIds, p.id];
                        updateSessionAttachedPapers(updated);
                      }}
                      className="mt-0.5 accent-indigo-600 rounded"
                    />
                    <div className="overflow-hidden">
                      <span className="text-xs font-bold block truncate">{p.title}</span>
                      <span className="text-[10px] text-slate-500 block truncate">{p.authors || 'Unknown authors'}</span>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-850">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateSessionAttachedPapers(papers.map(p => p.id))}
                  className="text-[10px] font-bold text-slate-400 hover:text-indigo-300 cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => updateSessionAttachedPapers(activePaper ? [activePaper.id] : [])}
                  className="text-[10px] font-bold text-slate-400 hover:text-indigo-300 cursor-pointer"
                >
                  Only Active Paper
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowFileModal(false)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-1.5 px-4 rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW CHAT SESSION */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-sm w-full p-6 border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <h4 className="font-bold text-white text-sm">New Chat Thread</h4>
              </div>
              <button 
                onClick={() => setShowNewChatModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Thread Title</label>
              <input
                type="text"
                value={newChatTitle}
                onChange={(e) => setNewChatTitle(e.target.value)}
                placeholder="E.g. Methodology & Results Q&A"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 outline-none"
                autoFocus
              />
            </div>

            <p className="text-[10px] text-slate-500">
              This thread will start with {attachedPaperIds.length} attached document(s) and use {activeModel.model}.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="text-xs text-slate-400 hover:text-white px-3 py-1.5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createSession(newChatTitle, attachedPaperIds)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-1.5 px-4 rounded-xl cursor-pointer"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    }>
      <WorkspaceContent />
    </Suspense>
  );
}
