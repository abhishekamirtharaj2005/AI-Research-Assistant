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
  Check
} from 'lucide-react';

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
  created_at?: string;
}

interface ChatSession {
  id: number;
  title: string;
}

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
    fetchPapers();
    fetchChatSessions();
  }, []);

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
        // Default to first paper if no ID in URL
        if (data.length > 0 && !activePaperIdParam) {
          handleSelectPaper(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChatSessions = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/chats/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0) {
          handleSelectSession(data[0].id);
        } else {
          // Create default session
          createSession("General Workspace Session");
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createSession = async (title: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/chats/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
      });
      if (res.ok) {
        const newSession = await res.json();
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setMessages([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectSession = async (sessionId: number) => {
    setActiveSessionId(sessionId);
    setMessages([]);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/chats/${sessionId}/messages`, {
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

  const handleSelectPaper = async (paper: Paper) => {
    setActivePaper(paper);
    setActivePage(1);
    setPageText('Loading pages...');
    
    // Parse metadata
    const meta = paper.metadata_json ? JSON.parse(paper.metadata_json) : {};
    setTotalPages(meta.pages_count || 1);

    // Mock page listing for standard rendering
    // In production we would fetch extracted page texts
    const pages = [];
    for(let i = 1; i <= (meta.pages_count || 1); i++) {
      pages.push({
        page_number: i,
        text: `--- PAGE ${i} ---\n\n${paper.title}\n\nAbstract Heuristics:\n${paper.abstract}\n\n[Content Section Page ${i}]\nScientific results indicate significant improvements using the described page-aligned semantic index mechanism. Full methodology details are outlined in Section 3 of this document.`
      });
    }
    setPagesList(pages);
    setPageText(pages[0]?.text || 'Empty content.');
  };

  const handlePageChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && activePage > 1) {
      const newPage = activePage - 1;
      setActivePage(newPage);
      setPageText(pagesList[newPage - 1]?.text || '');
    } else if (direction === 'next' && activePage < totalPages) {
      const newPage = activePage + 1;
      setActivePage(newPage);
      setPageText(pagesList[newPage - 1]?.text || '');
    }
  };

  // Custom fetch SSE reader to allow authentication and POST requests
  const handleSendMessage = async () => {
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
    const paperQuery = activePaper ? `&active_paper_id=${activePaper.id}` : '';

    try {
      const res = await fetch(`${apiBase}/chats/${activeSessionId}/stream?agent_type=${activeAgent}${paperQuery}`, {
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
        // Keep the last partial line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: citations')) {
            const dataLine = lines[lines.indexOf(line) + 1] || '';
            if (dataLine.startsWith('data: ')) {
              const citations = JSON.parse(dataLine.replace('data: ', '').trim());
              setStreamingCitations(citations);
            }
          }
          else if (line.startsWith('event: token')) {
            const dataLine = lines[lines.indexOf(line) + 1] || '';
            if (dataLine.startsWith('data: ')) {
              const parsed = JSON.parse(dataLine.replace('data: ', '').trim());
              setStreamingMessage(prev => prev + parsed.token);
            }
          }
        }
      }

      // Stream fully done, refresh messages list from database to get precise message IDs
      handleSelectSession(activeSessionId);
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
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <select 
              value={activePaper?.id || ''} 
              onChange={(e) => {
                const selected = papers.find(p => p.id === parseInt(e.target.value));
                if (selected) handleSelectPaper(selected);
              }}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs font-semibold rounded-lg p-2 max-w-sm outline-none focus:border-indigo-500"
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
                className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 hover:bg-slate-900 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-slate-300">
                Page {activePage} of {totalPages}
              </span>
              <button 
                onClick={() => handlePageChange('next')}
                disabled={activePage === totalPages}
                className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 hover:bg-slate-900 transition-all"
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
            className={`flex items-center gap-2 py-4 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'chat' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>AI Chat</span>
          </button>
          
          <button 
            onClick={() => { setActiveTab('summary'); if (!summaryData) triggerSummary(); }}
            className={`flex items-center gap-2 py-4 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'summary' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Summaries</span>
          </button>

          <button 
            onClick={() => { setActiveTab('gaps'); if (!gapsData) triggerGaps(); }}
            className={`flex items-center gap-2 py-4 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'gaps' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Gap Finder</span>
          </button>

          <button 
            onClick={() => setActiveTab('bibtex')}
            className={`flex items-center gap-2 py-4 px-4 text-xs font-bold border-b-2 transition-all ${
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
              {/* Agent selector & History */}
              <div className="p-4 border-b border-slate-800/80 bg-slate-950/20 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-slate-400">Active Agent:</span>
                  <select 
                    value={activeAgent}
                    onChange={(e) => setActiveAgent(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-slate-200 text-xs font-bold rounded-lg p-1.5 outline-none focus:border-indigo-500"
                  >
                    <option value="coordinator">Coordinator Agent</option>
                    <option value="research">Research Agent</option>
                    <option value="summary">Summary Agent</option>
                    <option value="citation">Citation Agent</option>
                    <option value="gap">Gap Finder</option>
                    <option value="reviewer">Reviewer Agent</option>
                    <option value="planner">Planner Agent</option>
                  </select>
                </div>
              </div>

              {/* Chat Message Window */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 && !streamingMessage && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-3">
                    <Sparkles className="w-12 h-12 text-slate-700 animate-pulse" />
                    <div className="space-y-1">
                      <h5 className="font-bold text-slate-300 text-sm">Ask anything about your paper</h5>
                      <p className="text-xs text-slate-500 max-w-sm">The Coordinator agent will automatically perform RAG searches across the text and cite results with page references.</p>
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
                          ? 'bg-indigo-600 text-white rounded-tr-none' 
                          : 'bg-slate-850 border border-slate-800 text-slate-200 rounded-tl-none'
                      }`}>
                        {m.content}
                      </div>
                      
                      {/* Citations list */}
                      {m.citations && m.citations.length > 0 && (
                        <div className="flex flex-wrap gap-2 px-1">
                          {m.citations.map((c, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setActivePage(c.page_number);
                                setPageText(pagesList[c.page_number - 1]?.text || '');
                              }}
                              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-950/80 border border-indigo-500/20 rounded-lg px-2.5 py-1 transition-all flex items-center gap-1"
                              title={c.snippet}
                            >
                              <span>[{c.source_index}] p. {c.page_number}</span>
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
                      <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 text-slate-200 rounded-tl-none text-xs leading-relaxed whitespace-pre-wrap">
                        {streamingMessage}
                        <span className="inline-block w-1.5 h-3.5 bg-indigo-500 ml-1 animate-pulse"></span>
                      </div>
                      
                      {/* Streaming Citations */}
                      {streamingCitations.length > 0 && (
                        <div className="flex flex-wrap gap-2 px-1">
                          {streamingCitations.map((c, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setActivePage(c.page_number);
                                setPageText(pagesList[c.page_number - 1]?.text || '');
                              }}
                              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 border border-indigo-500/20 rounded-lg px-2.5 py-1 transition-all"
                            >
                              [{c.source_index}] p. {c.page_number}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input form */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/30 flex items-center gap-2">
                <input 
                  type="text" 
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => { if(e.key === 'Enter') handleSendMessage(); }}
                  placeholder="Ask a question about this paper..."
                  className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl py-3 px-4 text-xs text-white placeholder-slate-500 outline-none transition-all"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={loadingChat || !inputMessage.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white p-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
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
                <div className="glass-panel p-6 whitespace-pre-wrap text-xs leading-relaxed text-slate-200 border-slate-800/80 prose max-w-none">
                  {summaryData}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-3">
                  <FileText className="w-12 h-12 text-slate-700" />
                  <h5 className="font-bold text-slate-300 text-sm">No summary generated</h5>
                  <button 
                    onClick={triggerSummary}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-xl text-xs"
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
                <div className="glass-panel p-6 whitespace-pre-wrap text-xs leading-relaxed text-slate-200 border-slate-800/80 prose max-w-none">
                  {gapsData}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-3">
                  <TrendingUp className="w-12 h-12 text-slate-700" />
                  <h5 className="font-bold text-slate-300 text-sm">No analysis performed</h5>
                  <button 
                    onClick={triggerGaps}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-xl text-xs"
                  >
                    Perform Gap Analysis
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 4. BIBTEX TAB */}
          {activeTab === 'bibtex' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* BibTeX Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h6 className="text-xs font-bold uppercase tracking-wider text-slate-400">BibTeX Citation</h6>
                  <button 
                    onClick={() => copyToClipboard(bibtexCode)}
                    className="text-slate-400 hover:text-white transition-all p-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 flex items-center gap-1.5 text-[10px] font-semibold"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-[10px] text-indigo-300 overflow-x-auto leading-relaxed font-mono">
                  {bibtexCode}
                </pre>
              </div>

              {/* Document references parsed */}
              <div className="space-y-2">
                <h6 className="text-xs font-bold uppercase tracking-wider text-slate-400">Parsed References Section</h6>
                <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl text-[10px] text-slate-400 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                  {metaData.references || 'No references section parsed from the document.'}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 animate-spin border-4 border-indigo-200 border-t-indigo-600"></div>
          <p className="text-sm">Loading workspace routing parameters...</p>
        </div>
      </div>
    }>
      <WorkspaceContent />
    </Suspense>
  );
}
