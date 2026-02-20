import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

const TypewriterText = ({ text, delay = 0, speed = 0.05, className = '' }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        let timeoutId;
        let currentIndex = 0;

        const startTyping = () => {
            setIsTyping(true);
            const typeChar = () => {
                if (currentIndex < text.length) {
                    setDisplayedText((prev) => prev + text[currentIndex]);
                    currentIndex++;
                    timeoutId = setTimeout(typeChar, speed * 1000);
                } else {
                    setIsTyping(false);
                }
            };
            typeChar();
        };

        const initialDelay = setTimeout(startTyping, delay * 1000);

        return () => {
            clearTimeout(timeoutId);
            clearTimeout(initialDelay);
        };
    }, [text, delay, speed]);

    return (
        <span className={`inline-block ${className}`}>
            {displayedText}
            <motion.span
                animate={{ opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                className={`inline-block w-[3px] h-[1em] bg-current ml-1 align-middle ${!isTyping ? 'opacity-50' : ''}`}
            />
        </span>
    );
};

export default TypewriterText;
