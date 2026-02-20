import { X } from 'lucide-react';
import { useEffect } from 'react';

const Modal = ({ isOpen, onClose, title, children, showClose = true }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="glass-panel w-full max-w-md rounded-2xl p-6 relative animate-in zoom-in-95 duration-200 shadow-2xl">
                {showClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                )}

                {title && (
                    <h2 className="text-2xl font-bold mb-4 text-[var(--color-primary)]">
                        {title}
                    </h2>
                )}

                <div>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
