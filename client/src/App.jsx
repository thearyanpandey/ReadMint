import { use, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from './api';
import Mermaid from './Mermaid';
import { Github,ArrowLeft,Check, Download, Loader2, AlertCircle, CheckCircle2, FolderTree, FileText, Copy } from 'lucide-react';

function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('idle');
  const [repoData, setRepoData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [token, setToken] = useState(''); 
  const [uiPhase, setUiPhase] = useState('input');
  const [treeData, setTreeData] = useState(null);
  const [monorepoCandidates, setMonorepoCandidates] = useState([]);
  const [seletedRoot, setSelectedRoot] = useState('');
  const [processingStep, setProcessingStep] = useState('idle');
  const [finalDocs, setFinalDocs] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if(!finalDocs) return;
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
  };
 
  const handleValidate = async () => {
    setStatus('loading');
    setErrorMsg('');
    
    try {
      const valRes = await api.validateRepo(url, token);

      if(valRes.status = 'success'){
        setRepoData(valRes.data);

        await fetchStructure(valRes.data.owner, valRes.data.repo, valRes.data.default_branch, token);
      } else if (valRes.status === 'auth_required'){
        setStatus('aut_required');
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

  const fetchStructure = async (owner, repo, branch, userToken) => {
    try {
      const res = await api.getStructure(owner, repo, branch, userToken);

      if (res.status === 'success') {
        setTreeData(res.data.tree);

        if(res.data.monorepo_analysis.is_monorepo){
          setMonorepoCandidates(res.data.monorepo_analysis.candidates);
          setUiPhase('selection')
        } else {
          setSelectedRoot('');
          startGenerationFlow(res.data.tree, '');
        }
      }
    } catch (error) {
      setStatus('error');
      setErrorMsg('Failed to fetch file structure')
    }
  }

  const startGenerationFlow = async(tree, rootPath) => {
    setUiPhase('processing');
    console.log("Ready to generate for: ", rootPath || "Root");
    setSelectedRoot(rootPath);

    try {
      //We'll filter
      setProcessingStep('filtering');
      const filterRes = await api.filterFiles(tree, rootPath);
      const relevantFiles = filterRes.files;
      console.log(`Filtered down to ${relevantFiles.length} files`);

      //Fetch Content 
      setProcessingStep('fetching');
      const contentRes = await api.fetchContent(
        repoData.owner,
        repoData.repo,
        repoData.default_branch,
        relevantFiles,
        token
      );

      const contentMap = contentRes.data;

      //AI Generation
      setProcessingStep('generating');
      const aiRes = await api.generateDocs(tree, contentMap);

      if(aiRes.status === 'success'){
        setFinalDocs(aiRes.data);
        setProcessingStep('complete');
        setUiPhase('results');
      } else{
        throw new Error(aiRes.error || "AI Generation failed");
      }
    } catch (error) {
      console.error(err);
      setStatus('error');
      setErrorMsg('Error generationg documentation. Please try again.');
      setUiPhase('input');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-xl w-full space-y-8 text-center">
        
        {/* Header */}
        <div className="space-y-2">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            {/* <Github className="w-8 h-8 text-white" /> */}
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Readmint
          </h1>
          <p className="text-slate-400">
            Generate beautiful documentation for any GitHub repository in seconds.
          </p>
        </div>

        {/* Input Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 shadow-xl">
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            {/* PHASE 2: Monorepo Selection */}
          {uiPhase === 'selection' && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4">
              <div className="text-left mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <FolderTree className="text-blue-400" />
                  Multiple Projects Detected
                </h2>
                <p className="text-slate-400 text-sm">
                  This looks like a monorepo. Which part do you want to document?
                </p>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {/* Option 1: The Root */}
                <button
                  onClick={() => startGenerationFlow(treeData, '')}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-700 hover:border-blue-500 hover:bg-slate-800 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-800 rounded group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                      <Github size={18} />
                    </div>
                    <div className="text-left">
                      <div className="text-white font-medium">Root Repository</div>
                      <div className="text-xs text-slate-500">Document the entire codebase</div>
                    </div>
                  </div>
                </button>

                {/* Dynamic Options: The Sub-packages */}
                {monorepoCandidates.map((path) => (
                  <button
                    key={path}
                    onClick={() => startGenerationFlow(treeData, path)}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-700 hover:border-blue-500 hover:bg-slate-800 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-800 rounded group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                        <FolderTree size={18} />
                      </div>
                      <div className="text-left">
                        <div className="text-white font-medium">{path}</div>
                        <div className="text-xs text-slate-500">Sub-project</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

            {/* Private Repo Token Input (Conditional) */}
            {status === 'auth_required' && (
              <div className="animate-in fade-in slide-in-from-top-2 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-left">
                <div className="flex gap-2 items-center text-yellow-500 mb-2">
                  <AlertCircle size={16} />
                  <span className="text-sm font-medium">Private Repository Detected</span>
                </div>
                <input
                  type="password"
                  placeholder="Paste your GitHub Personal Access Token (PAT)"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-yellow-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-2">
                  We only use this to fetch the repo structure. It is never stored.
                </p>
              </div>
            )}

            <button
              onClick={handleValidate}
              disabled={status === 'loading' || !url}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Validating...
                </>
              ) : (
                'Analyze Repository'
              )}
            </button>

            {/* Error Message */}
            {status === 'error' && (
              <div className="text-red-400 text-sm flex items-center justify-center gap-2">
                <AlertCircle size={16} />
                {errorMsg}
              </div>
            )}
          </div>
        </div>

        {/* Success Preview (For Phase 1 Check) */}
        {status === 'success' && repoData && (
          <div className="animate-in fade-in zoom-in duration-300 bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-4 text-left">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Repository Found</h3>
              <p className="text-sm text-slate-400">
                {repoData.owner}/{repoData.repo} • {repoData.default_branch} • {(repoData.size_kb / 1024).toFixed(1)} MB
              </p>
            </div>
          </div>
        )}

        {/* PHASE 3: Processing / Loading Screen */}
        {uiPhase === 'processing' && (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 shadow-xl max-w-md w-full animate-in fade-in zoom-in-95">
            <div className="flex flex-col items-center space-y-6">
              
              {/* Spinning Loader */}
              <div className="relative">
                <div className="w-16 h-16 border-4 border-slate-700 rounded-full"></div>
                <div className="absolute top-0 w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileText className="text-blue-400 w-6 h-6 animate-pulse" />
                </div>
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-white">Generating Documentation</h2>
                <p className="text-slate-400 text-sm">
                  Using Gemini 1.5 to analyze codebase structure...
                </p>
              </div>

              {/* Step Indicators */}
              <div className="w-full space-y-3">
                <StepItem 
                  label="Identifying Key Files" 
                  status={processingStep === 'filtering' ? 'active' : processingStep === 'fetching' || processingStep === 'generating' ? 'done' : 'waiting'} 
                />
                <StepItem 
                  label="Extracting Code Context" 
                  status={processingStep === 'fetching' ? 'active' : processingStep === 'generating' ? 'done' : 'waiting'} 
                />
                <StepItem 
                  label="Writing Documentation" 
                  status={processingStep === 'generating' ? 'active' : 'waiting'} 
                />
              </div>
            </div>
          </div>
        )}

        {/* PHASE 4: Results Screen */}
        {uiPhase === 'results' && finalDocs && (
          <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-500 pb-20">
            
            {/* Top Navigation / Actions */}
            <div className="flex items-center justify-between mb-6">
              <button 
                onClick={handleReset}
                className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
              >
                {/* <ArrowLeft size={20} /> */}
                Analyze Another
              </button>

              <div className="flex gap-3">
                 <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-all"
                >
                  {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                  {copied ? 'Copied!' : 'Copy Markdown'}
                </button>
                <button
                   onClick={() => {
                     const blob = new Blob([finalDocs.readme_markdown], { type: 'text/markdown' });
                     const link = document.createElement('a');
                     link.href = URL.createObjectURL(blob);
                     link.download = 'README.md';
                     link.click();
                   }}
                   className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all"
                >
                  <Download size={18} />
                  Download
                </button>
              </div>
            </div>

            {/* Header Card */}
            <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-xl p-8 mb-6 shadow-2xl">
              <h1 className="text-3xl font-bold text-white mb-2">{finalDocs.project_name}</h1>
              <p className="text-lg text-slate-300 mb-6">{finalDocs.tagline}</p>

              <div className="flex flex-wrap gap-2">
                {/* Tech Stack Badges */}
                {finalDocs.tech_stack.map((tech) => (
                  <span key={tech} className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-sm font-medium">
                    {tech}
                  </span>
                ))}
                {/* Complexity Badge */}
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${
                    finalDocs.complexity_score === 'Advanced' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                    finalDocs.complexity_score === 'Intermediate' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                    'bg-green-500/10 text-green-400 border-green-500/20'
                }`}>
                  {finalDocs.complexity_score} Complexity
                </span>
              </div>
            </div>

            {/* Architecture Diagram */}
            {finalDocs.architecture_mermaid && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6 overflow-hidden">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Architecture Overview
                </h3>
                <Mermaid chart={finalDocs.architecture_mermaid} />
              </div>
            )}

            {/* Markdown Preview */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 shadow-xl">
               <article className="prose prose-invert prose-blue max-w-none">
                  <ReactMarkdown>{finalDocs.readme_markdown}</ReactMarkdown>
               </article>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

function StepItem({label, status}){
  //status: 'waiting' | 'active' | 'done'

  return(
    <div className={`flex items-center gap-3 transition-all duration-500 ${status === 'waiting' ? 'opacity-40' : 'opacity-100'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border 
        ${status === 'active' ? 'border-blue-500 text-blue-500 animate-pulse' : 
          status === 'done' ? 'bg-green-500 border-green-500 text-slate-900' : 
          'border-slate-600 text-slate-600'}`}>
        {status === 'done' ? <CheckCircle2 size={14} /> : <div className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-blue-500' : 'bg-slate-600'}`} />}
      </div>
      <span className="text-sm font-medium text-slate-300">{label}</span>
    </div>
  )
}

export default App;