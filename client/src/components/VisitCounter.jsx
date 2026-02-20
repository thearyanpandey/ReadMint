import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { api } from '../api';

const VisitCounter = () => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        const fetchVisits = async () => {
            try {
                const data = await api.getVisits();
                setCount(data.count);
            } catch (error) {
                console.error("Failed to fetch visits", error);
            }
        };
        fetchVisits();
    }, []);

    return (
        <div className="fixed bottom-4 right-4 z-40 bg-white/80 backdrop-blur-md border border-[var(--color-border)] px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] animate-in slide-in-from-bottom-4 duration-700">
            <Eye size={16} className="text-[var(--color-primary)]" />
            <span>{count.toLocaleString()} Generations</span>
        </div>
    );
};

export default VisitCounter;
