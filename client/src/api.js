import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const api = {
    getStructure: async (owner, repo, branch, userToken) => {
        const response = await client.post('/structure', { owner, repo, branch, userToken });
        return response.data;
    },

    validateRepo: async (url, userToken) => {
        try {
            const response = await client.post('/validate', { url, userToken });
            return response.data;
        } catch (error) {
            //Axios throws on 4xx/5xx, return the response data if available 
            if (error.response) {
                return error.response.data;
            }
            throw error;
        }
    },

    filterFiles: async (tree, subpath) => {
        const response = await client.post('/filter-files', { tree, subpath });
        return response.data;
    },

    fetchContent: async (owner, repo, branch, filePaths, userToken) => {
        const response = await client.post('/fetch-content', {
            owner,
            repo,
            branch,
            filePaths,
            userToken
        });
        return response.data;
    },

    generateDocs: async (tree, contentMap, geminiApiKey) => {
        try {
            const response = await client.post('/generate', { tree, contentMap, geminiApiKey });
            return response.data;
        } catch (error) {
            if (error.response) {
                return error.response.data;
            }
            throw error;
        }
    },

    getVisits: async () => {
        const response = await client.get('/visits');
        return response.data;
    },

    incrementVisits: async () => {
        const response = await client.post('/visits/increment');
        return response.data;
    }
};