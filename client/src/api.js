import axios from "axios";

const API_BASE = 'http://localhost:3000/api';

export const api = {
    //Phase 1
    validateRepo: async (url, userToken = null) => {
        const res =await axios.post(`${API_BASE}/validate`, {url, userToken});
        return res.data;
    },

    //Phase 2
    getStructure: async (owner, repo, branch, userToken = null) => {
        const res = await axios.post(`${API_BASE}/structure`, {owner, repo, branch, userToken});
        return res.data;
    },

    //Phase 3
    filterFiles: async (tree, subpath = '') => {
        const res = await axios.post(`${API_BASE}/filter-files`, {tree, subpath});
        return res.data;
    },
    
    //Phase 4
    fetchContent: async (owner, repo, branch, filePaths, userToken = null) => {
        const res = await axios.post(`${API_BASE}/fetch-content`, {owner, repo, branch, filePaths, userToken});
        return res.data;
    },

    //Phase 5 
    generateDocs: async (tree, contentMap) => {
        const res = await axios.post(`${API_BASE}/generate`, {tree, contentMap});
        return res.data;
    }
}