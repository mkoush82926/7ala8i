"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfettiPiece {
    id: number;
    x: number;
    y: number;
    type: "dot" | "cross";
    color: string;
    delay: number;
    duration: number;
}

const colors = [
    "var(--accent-mint)",
    "var(--accent-lavender)",
    "var(--accent-blue)",
    "var(--accent-amber)",
];

function generatePieces(count = 20): ConfettiPiece[] {
    return Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 200 - 100,
        y: 0,
        type: Math.random() > 0.5 ? "dot" : "cross",
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
        duration: 1.5 + Math.random() * 1,
    }));
}

interface ConfettiProps {
    trigger: boolean;
    onComplete?: () => void;
}

export function Confetti({ trigger, onComplete }: ConfettiProps) {
    const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (trigger) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPieces(() => generatePieces(24));
            setShow(true);
            const timer = setTimeout(() => {
                setShow(false);
                onComplete?.();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [trigger, onComplete]);

    return (
        <AnimatePresence>
            {show && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
                    {pieces.map((piece) => (
                        <motion.div
                            key={piece.id}
                            initial={{
                                opacity: 1,
                                x: "50%",
                                y: "80%",
                                rotate: 0,
                                scale: 1,
                            }}
                            animate={{
                                opacity: 0,
                                x: `calc(50% + ${piece.x}px)`,
                                y: "-10%",
                                rotate: piece.type === "cross" ? 180 : 360,
                                scale: 0.6,
                            }}
                            transition={{
                                duration: piece.duration,
                                delay: piece.delay,
                                ease: [0.25, 1, 0.5, 1],
                            }}
                            className="absolute"
                        >
                            {piece.type === "dot" ? (
                                <div
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: piece.color }}
                                />
                            ) : (
                                <div className="relative w-2.5 h-2.5">
                                    <div
                                        className="absolute top-1/2 left-0 w-full h-[2px] -translate-y-1/2 rounded-full"
                                        style={{ backgroundColor: piece.color }}
                                    />
                                    <div
                                        className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 rounded-full"
                                        style={{ backgroundColor: piece.color }}
                                    />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}
        </AnimatePresence>
    );
}
