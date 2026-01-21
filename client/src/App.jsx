import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from './api';
import Mermaid from './Mermaid';
import Modal from './components/ui/Modal';
import VisitCounter from './components/VisitCounter';
import { Github, ArrowRight, Check, Download, Loader2, FileText, Copy, Key, Sparkles, ShieldAlert, FolderTree } from 'lucide-react';
import remarkGfm from 'remark-gfm';

function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('idle');
  const [repoData, setRepoData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Auth States
  const [githubToken, setGithubToken] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [showGithubModal, setShowGithubModal] = useState(false);

  // Flow States
  const [uiPhase, setUiPhase] = useState('input');
  const [treeData, setTreeData] = useState(null);
  const [monorepoCandidates, setMonorepoCandidates] = useState([]);
  const [processingStep, setProcessingStep] = useState('idle');
  const [finalDocs, setFinalDocs] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // --- Effects ---

  useEffect(() => {
    // Check for Gemini Key on mount
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setGeminiApiKey(storedKey);
    } else {
      setShowGeminiModal(true);
    }
  }, []);

  // --- Handlers ---

  const handleSaveGeminiKey = (key) => {
    if (!key.trim()) return;
    localStorage.setItem('gemini_api_key', key);
    setGeminiApiKey(key);
    setShowGeminiModal(false);
  };

  const handleCopy = () => {
    if (!finalDocs) return;
    navigator.clipboard.writeText(finalDocs.readme_markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setUiPhase('input');
    setRepoData(null);
    setTreeData(null);
    setFinalDocs(null);
    setUrl('');
    setStatus('idle');
    setGithubToken('');
  };

  const handleValidate = async () => {
    if (!url) return;
    setStatus('loading');
    setErrorMsg('');

    try {
      const valRes = await api.validateRepo(url, githubToken);

      if (valRes.status === 'success') {
        setRepoData(valRes.data);
        await fetchStructure(valRes.data.owner, valRes.data.repo, valRes.data.default_branch, githubToken);
      } else if (valRes.status === 'auth_required') {
        setStatus('idle'); // Reset status so spinner stops
        setShowGithubModal(true);
      } else {
        setStatus('error');
        setErrorMsg(valRes.message || 'Validation failed');
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.response?.data?.error || 'Failed to connect to server');
    }
  };

  const handleGithubTokenSubmit = async (token) => {
    setGithubToken(token);
    setShowGithubModal(false);
    // Retry validation with token
    setTimeout(() => handleValidateWithToken(token), 100);
  };

  const handleValidateWithToken = async (token) => {
    setStatus('loading');
    try {
      const valRes = await api.validateRepo(url, token);
      if (valRes.status === 'success') {
        setRepoData(valRes.data);
        await fetchStructure(valRes.data.owner, valRes.data.repo, valRes.data.default_branch, token);
      } else {
        setStatus('error');
        setErrorMsg(valRes.message || 'Validation failed with provided token');
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg('Validation failed');
    }
  };

  const fetchStructure = async (owner, repo, branch, userToken) => {
    try {
      const res = await api.getStructure(owner, repo, branch, userToken);

      if (res.status === 'success') {
        setTreeData(res.data.tree);

        if (res.data.monorepo_analysis.is_monorepo) {
          setMonorepoCandidates(res.data.monorepo_analysis.candidates);
          setUiPhase('selection')
          setStatus('idle');
        } else {
          // Pass repo details explicitly since state update is async/batched
          startGenerationFlow(res.data.tree, '', { owner, repo, default_branch: branch });
        }
      }
    } catch (error) {
      setStatus('error');
      setErrorMsg('Failed to fetch file structure')
    }
  }

  const startGenerationFlow = async (tree, rootPath, repoOverride = null) => {
    setUiPhase('processing');

    // Use override if provided (during initial auto-flow), otherwise fallback to state
    const currentRepo = repoOverride || repoData;

    try {
      // 1. Filter
      setProcessingStep('filtering');
      const filterRes = await api.filterFiles(tree, rootPath);
      const relevantFiles = filterRes.files;

      // 2. Fetch Content 
      setProcessingStep('fetching');
      const contentRes = await api.fetchContent(
        currentRepo.owner,
        currentRepo.repo,
        currentRepo.default_branch,
        relevantFiles,
        githubToken
      );

      // 3. Generate
      setProcessingStep('generating');
      const aiRes = await api.generateDocs(tree, contentRes.data, geminiApiKey);

      if (aiRes.status === 'success') {
        setFinalDocs(aiRes.data);

        // Increment global counter
        await api.incrementVisits();

        setProcessingStep('complete');
        setUiPhase('results');
      } else {
        throw new Error(aiRes.error || "AI Generation failed");
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message || 'Error generating documentation.');
      setUiPhase('input');
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <VisitCounter />

      {/* --- Header --- */}
      <header className="w-full py-6 px-4 sm:px-8 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
            <FileText size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-main)]">
            ReadMint
          </h1>
        </div>

        <button
          onClick={() => setShowGeminiModal(true)}
          className="glass-button px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-main)] flex items-center gap-2"
        >
          <Key size={16} className="text-[var(--color-primary)]" />
          {geminiApiKey ? 'Update Gemini Key' : 'Add Gemini Key'}
        </button>
      </header>

      {/* --- Main Content --- */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 relative z-0">

        {uiPhase === 'input' && (
          <div className="max-w-2xl w-full text-center space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-600 text-sm font-medium border border-blue-100">
                <Sparkles size={14} />
                AI-POWERED DOCUMENTATION
              </div>
              <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-[var(--color-text-main)]">
                Generate Your <span className="text-[var(--color-primary)]">README</span>
              </h1>
              <p className="text-xl text-[var(--color-text-muted)] max-w-lg mx-auto leading-relaxed">
                Paste your repository link and let Gemini craft the perfect documentation in seconds.
              </p>
            </div>

            <div className="glass-panel p-2 rounded-full flex items-center shadow-xl shadow-blue-100 transition-shadow hover:shadow-2xl">
              <div className="pl-6 text-slate-400">
                <Github size={20} />
              </div>
              <input
                type="text"
                placeholder="Paste GitHub repository link..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
                className="flex-1 bg-transparent border-none focus:ring-0 text-lg px-4 py-3 text-[var(--color-text-main)] placeholder-slate-400"
              />
              <button
                onClick={handleValidate}
                disabled={status === 'loading' || !url}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-8 py-4 rounded-full font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? <Loader2 className="animate-spin" /> : 'Generate'}
                {!status === 'loading' && <ArrowRight size={18} />}
              </button>
            </div>

            {status === 'error' && (
              <div className="text-red-500 bg-red-50 px-4 py-2 rounded-lg inline-block text-sm font-medium border border-red-100">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-center gap-8 text-sm text-[var(--color-text-muted)] pt-8">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Check size={12} strokeWidth={3} /></div>
                Markdown Ready
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Check size={12} strokeWidth={3} /></div>
                Instant Preview
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Check size={12} strokeWidth={3} /></div>
                One-click Copy
              </div>
            </div>
          </div>
        )}

        {uiPhase === 'selection' && (
          <div className="max-w-md w-full glass-panel rounded-2xl p-8 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FolderTree size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Select Project Scope</h2>
            <p className="text-[var(--color-text-muted)] mb-8">
              We detected multiple projects in this repository. Which one would you like to document?
            </p>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar text-left">
              <button
                onClick={() => startGenerationFlow(treeData, '')}
                className="w-full p-4 rounded-xl border border-[var(--color-border)] hover:border-blue-400 hover:bg-blue-50/50 transition-all flex items-center gap-3 group"
              >
                <Github className="text-slate-400 group-hover:text-blue-500" />
                <div>
                  <div className="font-semibold text-[var(--color-text-main)]">Root Repository</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Analyze everything</div>
                </div>
              </button>
              {monorepoCandidates.map(path => (
                <button
                  key={path}
                  onClick={() => startGenerationFlow(treeData, path)}
                  className="w-full p-4 rounded-xl border border-[var(--color-border)] hover:border-blue-400 hover:bg-blue-50/50 transition-all flex items-center gap-3 group"
                >
                  <FolderTree className="text-slate-400 group-hover:text-blue-500" />
                  <div>
                    <div className="font-semibold text-[var(--color-text-main)]">{path}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Sub-project</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {uiPhase === 'processing' && (
          <div className="text-center space-y-8 animate-in fade-in duration-500">
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="text-blue-500 animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-2">
                {processingStep === 'filtering' ? 'Scanning Repository...' :
                  processingStep === 'fetching' ? 'Reading Source Code...' :
                    'Crafting Documentation...'}
              </h2>
              <p className="text-[var(--color-text-muted)]">
                Using Gemini 3 Flash to analyze architecture and logic
              </p>
            </div>
          </div>
        )}

        {uiPhase === 'results' && finalDocs && (
          <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-12 duration-500 pb-20">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <button onClick={handleReset} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors">
                  ← Generator
                </button>
                <span className="text-slate-300">/</span>
                <span className="font-semibold">Preview</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`glass-button px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${isEditing ? 'bg-blue-50 border-blue-200 text-blue-600' : ''}`}
                >
                  {isEditing ? <Check size={16} /> : <FileText size={16} />}
                  {isEditing ? 'Done Editing' : 'Edit'}
                </button>
                <button
                  onClick={handleCopy}
                  className="glass-button px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                >
                  {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([finalDocs.readme_markdown], { type: 'text/markdown' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = 'README.md';
                    link.click();
                  }}
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20 flex items-center gap-2"
                >
                  <Download size={16} />
                  Download
                </button>
              </div>
            </div>

            <div className="glass-panel p-8 sm:p-12 rounded-2xl">
              {/* Header Section */}
              <div className="text-center mb-12 border-b border-[var(--color-border)] pb-8">
                <h1 className="text-4xl font-extrabold text-[var(--color-text-main)] mb-4">{finalDocs.project_name}</h1>
                <p className="text-xl text-[var(--color-text-muted)] max-w-2xl mx-auto">{finalDocs.tagline}</p>

                <div className="flex flex-wrap justify-center gap-2 mt-6">
                  {finalDocs.tech_stack.map(tech => (
                    <span key={tech} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold uppercase tracking-wide">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {/* Mermaid Diagram */}
              {finalDocs.architecture_mermaid && (
                <div className="mb-12 bg-slate-50/50 rounded-xl p-6 border border-[var(--color-border)]">
                  <h3 className="text-sm font-bold uppercase text-[var(--color-text-muted)] mb-4 tracking-wider">Architecture</h3>
                  <Mermaid chart={finalDocs.architecture_mermaid} />
                </div>
              )}

              {/* Markdown Content */}
              {isEditing ? (
                <textarea
                  value={finalDocs.readme_markdown}
                  onChange={(e) => setFinalDocs(prev => ({ ...prev, readme_markdown: e.target.value }))}
                  className="w-full h-[600px] p-6 bg-slate-900 text-slate-100 font-mono text-sm rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                  spellCheck={false}
                />
              ) : (
                <article className="prose prose-slate prose-lg max-w-none prose-headings:font-bold prose-a:text-blue-600">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]} // This enables tables, strikethrough, etc.
                    components={{
                      // Optional: You can override specific elements if needed
                      a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />
                    }}
                  >
                    {finalDocs.readme_markdown}
                  </ReactMarkdown>
                </article>
              )}
            </div>
          </div>
        )
        }

      </main >

      <footer className="w-full py-8 text-center text-[var(--color-text-muted)] text-sm relative z-10">
        <div className="flex justify-center gap-6 mb-4">
          <a href="#" className="hover:text-[var(--color-text-main)]">How it works</a>
          <a href="#" className="hover:text-[var(--color-text-main)]">Privacy Policy</a>
        </div>
        <p className="flex items-center justify-center gap-2">
          Powered by Google Gemini
          <Sparkles size={12} className="text-amber-400 fill-amber-400" />
        </p>
        <p className="mt-2 text-xs opacity-60">© 2024 ReadmeGen. All rights reserved.</p>
      </footer>

      {/* --- Modals --- */}

      {/* Gemini Key Modal */}
      <Modal
        isOpen={showGeminiModal}
        onClose={() => setShowGeminiModal(false)}
        title="Set Gemini API Key"
        showClose={!!geminiApiKey} // Can only close if key exists
      >
        <div className="space-y-4">
          <p className="text-[var(--color-text-muted)]">
            To generate high-quality documentation, we need a Gemini API Key.
            Your key is stored locally in your browser and never shared.
          </p>

          <input
            type="password"
            placeholder="Enter your Gemini API Key"
            className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveGeminiKey(e.target.value);
            }}
          />

          <div className="flex gap-3 pt-2">
            <a
              href="https://aistudio.google.com/app/api-keys"
              target="_blank"
              rel="noreferrer"
              className="flex-1 px-4 py-3 rounded-xl border border-[var(--color-border)] text-[var(--color-text-main)] font-medium text-center hover:bg-slate-50 transition-colors"
            >
              Get Key
            </a>
            <button
              onClick={(e) => handleSaveGeminiKey(e.target.previousSibling?.previousSibling?.value || document.querySelector('input[type="password"]').value)}
              className="flex-1 bg-[var(--color-primary)] text-white font-medium rounded-xl hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              Save & Continue
            </button>
          </div>
        </div>
      </Modal>

      {/* GitHub Token Modal */}
      <Modal
        isOpen={showGithubModal}
        onClose={() => setShowGithubModal(false)}
        title="Private Repository Access"
      >
        <div className="space-y-4">
          <div className="bg-amber-50 text-amber-700 p-4 rounded-xl flex items-start gap-3 text-sm">
            <ShieldAlert className="shrink-0 mt-0.5" size={18} />
            <p>This appears to be a private repository. Please provide a GitHub Personal Access Token (PAT) with <strong>repo</strong> scope to continue.</p>
          </div>

          <input
            type="password"
            placeholder="ghp_xxxxxxxxxxxx"
            className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
          />

          <div className="flex gap-3 pt-2">
            <a
              href="https://github.com/settings/tokens"
              target="_blank"
              rel="noreferrer"
              className="flex-1 px-4 py-3 rounded-xl border border-[var(--color-border)] text-[var(--color-text-main)] font-medium text-center hover:bg-slate-50 transition-colors"
            >
              Generate Token
            </a>
            <button
              onClick={() => handleGithubTokenSubmit(githubToken)}
              className="flex-1 bg-amber-600 text-white font-medium rounded-xl hover:bg-amber-700 transition-colors"
            >
              Authenticate
            </button>
          </div>
        </div>
      </Modal>

    </div >
  );
}

export default App;