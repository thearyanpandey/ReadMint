import { use, useState } from 'react';
import { api } from './api';
import { Github, Loader2, AlertCircle, CheckCircle2, FolderTree, FileText } from 'lucide-react';

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
      </div>
    </div>
  );
}

export default App;