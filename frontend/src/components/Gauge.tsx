import React, { useEffect, useState } from 'react';

interface GaugeProps {
    value: number; // 0 to 100
    label: string;
    color?: string;
    size?: number;
}

export const Gauge: React.FC<GaugeProps> = ({ value, label, color = '#10b981', size = 200 }) => {
    const [animatedValue, setAnimatedValue] = useState(0);

    // Animation effect
    useEffect(() => {
        const timeout = setTimeout(() => {
            setAnimatedValue(value);
        }, 300);
        return () => clearTimeout(timeout);
    }, [value]);

    const strokeWidth = 15;
    const radius = size / 2 - strokeWidth;
    const circumference = radius * Math.PI; // Half circle
    const strokeDashoffset = circumference - (animatedValue / 100) * circumference;

    return (
        <div style={{ position: 'relative', width: size, height: size / 1.8, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background Track */}
                <path
                    d={`M ${strokeWidth} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth} ${size / 2}`}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />
                {/* Value Arc */}
                <path
                    d={`M ${strokeWidth} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth} ${size / 2}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
            </svg>
            <div style={{ position: 'absolute', bottom: 0, textAlign: 'center' }}>
                <div style={{ fontSize: size * 0.25, fontWeight: '800', color: '#1e293b', lineHeight: 1 }}>
                    {Math.round(animatedValue)}
                </div>
                <div style={{ fontSize: size * 0.08, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                    {label}
                </div>
            </div>
        </div>
    );
};
