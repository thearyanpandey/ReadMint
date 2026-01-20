import React, { useEffect } from "react";
import mermaid from 'mermaid';

mermaid.initialize({
    startOnLoad: true,
    theme: 'dark',
    securityLevel: 'loose',
});

export default function Mermaid({chart}){
    useEffect(()=>{
        mermaid.contentLoaded()
    },[chart]);

    return (
        <div className="mermaid flex justify-center p-4 bg-slate-900 rounded-lg overflow-x-auto">
            {chart}
        </div>
    );
}