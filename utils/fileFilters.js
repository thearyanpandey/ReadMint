// Blocklist: Files we NEVER want to see
const IGNORED_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', // Images
    '.lock', '.pdf', '.mp4', '.mov', '.mp3', // Binary/Media
    '.map', '.min.js', '.min.css', // Build artifacts
    '.eot', '.ttf', '.woff', '.woff2', // Fonts
    '.jar', '.war', '.class', '.exe', '.dll', '.so', '.o', // Compiled
    '.DS_Store' 
];

const IGNORED_DIRS = [
    'node_modules', 'dist', 'build', 'coverage', 
    '.git', '.idea', '.vscode', '__tests__', 
    'vendor', 'tmp', 'temp'
];

// Tier 1: The "Brain" (High Value)
// These explain HOW the project is built and run.
const TIER_1_FILES = [
    /^package\.json$/,
    /^go\.mod$/, 
    /^cargo\.toml$/,
    /^pom\.xml$/,
    /^requirements\.txt$/,
    /^dockerfile$/i,
    /^docker-compose\.yml$/,
    /^readme\.md$/i,
    /^contributing\.md$/i,
    /^\.github\/workflows\/.*\.yml$/ // CI/CD tells us build steps!
];

// Tier 2: The "Logic" (Code Structure)
// We prioritize entry points and router/controller logic.
const TIER_2_PATTERNS = [
    /src\/index\.[a-z]+$/, 
    /src\/main\.[a-z]+$/, 
    /src\/server\.[a-z]+$/,
    
    // Next.js App Router & Pages Router
    /app\/page\.[a-z]+$/,       // High value: Key UI pages
    /app\/layout\.[a-z]+$/,     // High value: Main layouts
    /pages\/_app\.[a-z]+$/,
    
    // Backend/API
    /app\/api\/.*\.[a-z]+$/,    // Next.js API routes
    /routes?\//,     
    /controllers?\//,
    /handlers?\//,              // You have 'Handlers/' in your tree!
    
    // Data & Types
    /prisma\/schema\.prisma$/,  // VITAL for understanding the DB
    /models?\//,
    /types\.ts$/,               // You have 'packages/common/src/types.ts'
    /\.d\.ts$/       
];

/**
 * Filter the raw file tree down to the essential files.
 * @param {Array} tree - The full array of file objects from GitHub API
 * @param {String} contextPath - Optional. The folder to scope the search to (e.g. "packages/ui")
 * @returns {Array} - Array of selected file paths
 */

export const selectKeyFiles = (tree, contextPath = '') => {
    //1. Normalize Context Path (ensure it doesn't end with /)
    const rootDir = contextPath ? contextPath.replace(/\/$/,'') : '';

    //2. Filter and Clean Paths
    let candidate = tree
        .filter(item => item.type === 'blob') //Files only
        .map(item => item.path);

    //If a sub-package is selected, Only keep files inside it 
    if(rootDir){
        candidate = candidate
            .filter(path => path.startsWith(rootDir + '/'))
            //Remove the prefix for cleaner matching logic, but keep original for fetching 
            .map(path => ({original: path, relative: path.replace(rootDir + '/', '')}));
    }else{
        candidate = candidate.map(path => ({original: path, relative: path}));
    }

    //3. Apply Blocklist 
    candidate = candidate.filter(file => {
        const lower = file.relative.toLowerCase();

        //Check Extensions
        if(IGNORED_EXTENSIONS.some(ext => lower.endsWith(ext))) return false;

        //check directories
        const parts = file.relative.split('/');
        if (parts.some(part => IGNORED_DIRS.includes(part))) return false;

        return true;
    });

    const selectedFiles = new Set();
    const MAX_FILES = 40;  //Hard cap to save tokens

    //4. Select Tier 1 files 
    candidate.forEach(file => {
        if(TIER_1_FILES.some(regex => regex.test(file.relative))){
            selectedFiles.add(file.original);
        }
    });

    //5. Select Tier 2 Files
    //Only if we haven't hit the cap 
    if(selectKeyFiles.size < MAX_FILES){
        candidate.forEach(file => {
            if(selectedFiles.size >= MAX_FILES) return;
            if(selectedFiles.has(file.original)) return; //Don't add twice 

            if(TIER_2_PATTERNS.some(regex => regex.test(file.relative))){
                selectedFiles.add(file.original);
            }
        });
    }

    // 6. Fill with Tier 3 (Source Files) if still empty
    // If we have very few files, grab some top-level source files
    if(selectedFiles.size < 10){
        candidate.forEach(file => {
            if(selectedFiles.size >= 20) return;
            if(selectedFiles.has(file.original)) return;

            //Just grab generic code file in root or src/
            if(file.relative.match(/\.(js|ts|py|go|rb|java)$/)){
                selectedFiles.add(file.original);
            }
        });
    }
    return Array.from(selectedFiles);
}