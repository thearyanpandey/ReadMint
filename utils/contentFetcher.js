import axios from 'axios';

//Helper to truncate long files to save tokens
//keeps header (imports) and footer (exports), cuts the middle

const smartTruncate = (text, maxChars = 3000) => {
    if(!text || text.length <= maxChars) return text;

    const half = Math.floor(maxChars / 2);
    const head = text.substring(0, half);
    const tail = text.substring(text.length - half);

    return `${head}\n\n... [TRUNCATED ${text.length - maxChars} CHARACTERS] ...\n\n${tail}`;
};

//Generates the GraphQL query for a batch of files
const generateQuery = (owner, repo, branch, filePaths) => {
    //We map each file path to a unique alias like "f0", "f1"
    const fileQueries = filePaths.map((path, index) => `
        f${index}: object(expression: "${branch}:${path}"){
            ... on Blob {
                text
                byteSize
            }
        }
    `).join('\n');

    return `
        query {
            repository(owner: "${owner}", name: "${repo}"){
                ${fileQueries}
            }
        }
    `;
};

//Main function to fetch file contents

export const fetchFileContents = async (filePaths, owner, repo, branch, token) => {
    const BATCH_SIZE = 15; // Github node limit safety
    const results = {};

    //Split files into chunks of 15 
    for (let i = 0; i < filePaths.length; i += BATCH_SIZE){
        const batch = filePaths.slice(i, i+BATCH_SIZE);
        const query = generateQuery(owner, repo, branch, batch);

        try {
            console.log(`Fetching batch ${i/BATCH_SIZE + 1}....`);

            const response = await axios.post(
                'https://api.github.com/graphql',
                {query},
                {
                    headers: {
                        'Authorization': `Bearer  ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const data = response.data.data.repository;

            if(!data) continue;

            //Map aliases (f0, f1) back to original paths
            batch.forEach((path, index) => {
                const alias =  `f${index}`;
                const fileData = data[alias];

                if(fileData && fileData.text){
                    results[path] = smartTruncate(fileData.text);
                }else{
                    //Handle binary files or empty files (GraphQl returns null text for images)
                    results[path] = "[Binary or Empty Files]";
                }
            });
        } catch (error) {
            console.error(`Error fetching batch ${i}:`, error.response?.data || error.message);
            
        }
    }
    return results;
};