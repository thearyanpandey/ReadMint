import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Octokit } from '@octokit/rest';

const app = express();
dotenv.config();
app.use(cors());
app.use(express.json());

//Initialize the Shared Client
const sharedOctokit = new Octokit({
    auth : process.env.GITHUB_SHARED_TOKEN
});

// -----HELPER FUNCTION------
//Funtion to Extract Repo from URL
const parseGitHubUrl = (url) => {
    const regex = /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git|\/|$)/;
    const match = url.match(regex);
    if(!match) return null;
    console.log("log from server.js parseGitHubURL: " + {owner: match[1], repo: match[2]})
    return {owner: match[1], repo: match[2]};
}

//Detect Monorepo Candidates
const detectMonorepo =  (filePaths) => {
    const manifests = [
        'package.json', 
        'go.mod', 
        'Cargo.toml', 
        'pom.xml', 
        'requirements.txt',
        'composer.json',
        'mix.exs'
    ];

    const Candidates = [];
    const rootHasManifest = filePaths.some(path => manifests.includes(path));

    filePaths.forEach(path => {
        const parts = path.split('/');
        const fileName = parts.pop();
        const dir = parts.join('/');

        //if we find manifest file and its not in root dir
        if(manifests.includes(fileName) && dir !== ''){
            //It's a candidate for a sub-project 
            //verify if this just isn't some node_module or hidden folder
            if(!dir.includes('node_modules') && !dir.startsWith('.')){
                Candidates.push({path: dir, type: fileName});
            }
        }
    });
    
    const uniqueCandidates = [...new Set(Candidates.map(c => c.path))];

    return {
        is_monorepo: uniqueCandidates.length > 0,
        root_has_manifest: rootHasManifest,
        candidates: uniqueCandidates
    }
}

//-----API Routes-----
app.post('/api/structure', async (req, res) => {
    const {owner, repo, branch, userToken} = req.body;

    //Select Client
    const octokit = userToken ? new Octokit({auth: userToken}) : sharedOctokit;

    try {
        console.log(`Fetching file tree for ${owner}/${repo} on branch ${branch}....`);

        //Fetch the recursive tree
        //recursive: 1 tells Github to give us all files, not just top level folders
        const {data} = await octokit.git.getTree({
            owner,
            repo,
            tree_sha: branch, //You can pass the branch name here
            recursive: 1
        });

        //tree is an array of objects 
        const tree = data.tree;

        //filter any blobs(files), ignore sub-tree (folder) for list 
        const filePaths = tree
            .filter(item => item.type === 'blob')
            .map(item => item.path);

        const analysis = detectMonorepo(filePaths);

        return res.json({
            status: "success",
            data: {
                total_files: filePaths.length,
                is_truncated: data.truncated,
                monorepo_analysis: analysis,
                tree: tree
            }
        })


    } catch (error) {
        console.error(error);
        const status = error.status || 500;
        return res.status(status).json({ 
            error: "Failed to fetch repository structure. Check permissions or branch name." 
        });
    }
})

app.post('/api/validate', async (req, res) => {
    const {url, userToken} = req.body;

    //Check
    const parsed = parseGitHubUrl(url);
    if (!parsed) {
        return res.status(400).json({error: "Invalid GitHub URL format"});
    }

    const {owner, repo} = parsed;

    //If use provided a token, then we must use it 
    //otherwise use our shared pool.
    const octokit = userToken
        ? new Octokit({auth: userToken})
        : sharedOctokit;

    try {
        console.log(`Validating ${owner}/${repo} using ${userToken ? "User Token" : "Shared Token"}....`)

        //API Check using Shared Token
        // const {data} = await sharedOctokit.repos.get({
        //     owner,
        //     repo,
        // });

        const {data} = await octokit.repos.get({
            owner, 
            repo,
        });


        //Success: Public Repo
        return res.json({
            status: "success",
            data : {
                owner: data.owner.login,
                repo: data.name,
                default_branch: data.default_branch,
                is_private: data.private,
                size_kb: data.size,
                description: data.description,
                auth_method : userToken ? "user_pat" : "public_shared"
            }
        });

    } catch (error) {
        const status = error.status;

        if((status === 404 || status === 403) && !userToken){
            return res.json({
                status: "auth_required",
                message: "Repo not found or Private. Please provide a PAT",
                data: {owner, repo}
            });
        }
        if((status === 401 || status === 403 || status === 404) && userToken){
            return res.status(401).json({
                error: "Access Denied. Please check your Personal Access Token and try again."
            });
        }

        console.error(error);
        return res.status(500).json({error: "Internal Server Error"});
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));