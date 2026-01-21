import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../config.env") });

// Debug: Check if API key is loaded
console.log("API Key loaded:", !!process.env.GOOGLE_API_KEY);
console.log("First 10 chars:", process.env.GOOGLE_API_KEY?.substring(0, 10));

const initializeAI = (apiKey) => {
    return new GoogleGenAI({
        apiKey: apiKey || process.env.GOOGLE_API_KEY
    });
};

const generatePrompt = (fileTree, contentMap) => {
    //1. Convert Tree to a visual string (like the 'tree' command)
    //We only use the top 50 paths to save context if it's huge,
    //or pass the whole thing if it fits.

    const treeString = fileTree
        .slice(0, 200) //Safety cap
        .map(f => f.path)
        .join('\n');

    //2. Format the file contents
    let filesContext = "";
    for (const [path, content] of Object.entries(contentMap)) {
        filesContext += `
    --- START OF FILE: ${path} ---
    ${content}
    --- END OF FILE: ${path} ---
    `;
    }

    //3 The Instruction
    return `
    You are an expert Senior Software Engineer and Technical Writer.
    Your task is to analyze the following codebase and generate comprehensive documentation.

    CONTEXT:
    1. **Project Structure**:
    ${fileTree.slice(0, 200).map(f => f.path).join('\n')}

    2. **Key File Contents**:
    ${Object.entries(contentMap).map(([path, content]) => `
    --- START OF FILE: ${path} ---
    ${content}
    --- END OF FILE: ${path} ---
    `).join('\n')}

    INSTRUCTIONS:
    Analyze the code logic, dependencies, and architecture. 
    Return a STRICT JSON object. Do not use Markdown formatting for the JSON itself.
    The JSON must have this specific structure:

    {
    "project_name": "Name of the project",
    "tagline": "A short, catchy one-sentence description",
    "tech_stack": ["Array", "of", "technologies", "used"],
    "installation" : "Describe how to set up this code base locally and use it",
    "complexity_score": "Beginner | Intermediate | Advanced",
    "architecture_mermaid": "A Mermaid.js graph string (TD or LR) showing the flow between modules/components",
    "readme_markdown": "The full, professional README.md content using Markdown. Include badges, install steps, usage examples, and API docs if relevant."
    }

    Use the 'readme_markdown' field to write a complete, beautiful README. 
    If information is missing, make a reasonable inference or mark it with [Check Code].
`;
}

export const generateDocumentation = async (fileTree, contentMap, apiKey = null) => {
    const prompt = generatePrompt(fileTree, contentMap);
    const ai = initializeAI(apiKey);
    try {
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        console.log("Sending prompt to Gemini....");
        const response = result.text;
        console.log("Response from generateDocu...", response);
        console.log(response.substring(0, 500));

        let cleanedText = response.trim();

        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        // ✅ Parse JSON safely
        const parsed = JSON.parse(cleanedText);

        console.log("✅ Successfully parsed documentation");
        return parsed;

    } catch (error) {
        console.error("Gemini Error:", error);
        throw new Error("Failed to generate Documentation");
    }
};

