import {GoogleGenAI} from "@google/genai";

const ai = new GoogleGenAI({apiKey: process.env.GOOGLE_API_KEY});

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
    for(const [path, content] of Object.entries(contentMap)){
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
    ${treeString}

    2. **Key File Contents**:
    ${filesContext}

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

export const generateDocumentation = async (fileTree, contentMap) => {
    const prompt = generatePrompt(fileTree, contentMap);
    try {
        const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
                responseMimeType: "application/json",
            }
        });

        console.log("Sending prompt to Gemini....");
        const response = result.text;

        console.log("Response from generateDocu...", response);

        return JSON.parse(response);
    } catch (error) {
        console.error("Gemini Error:", error);
        throw new Error("Failed to generate Documentation");
    }
};

