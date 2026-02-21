import React, { useEffect, useRef, useState } from "react";
import mermaid from 'mermaid';

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
});

export default function Mermaid({ chart }) {
    const containerRef = useRef(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const renderChart = async () => {
            if (chart && containerRef.current) {
                try {
                    setError(null);
                    
                    // 1. Strip markdown wrappers
                    // 2. Convert literal '\n' to actual newlines
                    let cleanChart = chart
                        .replace(/```mermaid\n?/gi, '') // Added 'i' flag for case-insensitivity
                        .replace(/```/g, '')
                        .replace(/\\n/g, '\n')          // <-- The fix for escaped newlines
                        .trim();

                    const id = 'mermaid-svg-' + Math.round(Math.random() * 10000000);
                    const { svg } = await mermaid.render(id, cleanChart);
                    containerRef.current.innerHTML = svg;
                } catch (err) {
                    console.error("Mermaid rendering error:", err);
                    setError(err.message || "Syntax error in Mermaid diagram");
                }
            }
        };
        renderChart();
    }, [chart]);

    return (
        <div className="flex flex-col items-center justify-center p-4 bg-slate-900 rounded-lg overflow-x-auto min-h-[100px]">
            {error ? (
                <div className="text-red-400 font-mono text-xs w-full whitespace-pre-wrap p-4 bg-red-950/30 rounded border border-red-900/50">
                    Failed to render diagram: {error}
                </div>
            ) : (
                <div ref={containerRef} className="mermaid-container w-full flex justify-center" />
            )}
        </div>
    );
}