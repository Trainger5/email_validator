import React from 'react';

interface ChartData {
    label: string;
    value: number;
    color: string;
}

interface DonutChartProps {
    data: ChartData[];
    size?: number;
    thickness?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({ data, size = 200, thickness = 20 }) => {
    const total = data.reduce((acc, item) => acc + item.value, 0);
    const radius = size / 2;
    const innerRadius = radius - thickness;
    let startAngle = 0;

    if (total === 0) {
        return (
            <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '50%' }}>
                <span className="tiny muted">No Data</span>
            </div>
        );
    }

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {data.map((item, index) => {
                const percentage = item.value / total;
                const angle = percentage * 360;
                const largeArcFlag = angle > 180 ? 1 : 0;

                const x1 = radius + innerRadius * Math.cos((Math.PI * startAngle) / 180);
                const y1 = radius + innerRadius * Math.sin((Math.PI * startAngle) / 180);
                const x2 = radius + radius * Math.cos((Math.PI * startAngle) / 180);
                const y2 = radius + radius * Math.sin((Math.PI * startAngle) / 180);

                const endAngle = startAngle + angle;
                const x3 = radius + radius * Math.cos((Math.PI * endAngle) / 180);
                const y3 = radius + radius * Math.sin((Math.PI * endAngle) / 180);
                const x4 = radius + innerRadius * Math.cos((Math.PI * endAngle) / 180);
                const y4 = radius + innerRadius * Math.sin((Math.PI * endAngle) / 180);

                const pathData = `
                    M ${x1} ${y1}
                    L ${x2} ${y2}
                    A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x3} ${y3}
                    L ${x4} ${y4}
                    A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1} ${y1}
                    Z
                `;

                startAngle += angle;

                return (
                    <path
                        key={item.label}
                        d={pathData}
                        fill={item.color}
                        stroke="white"
                        strokeWidth="2"
                    />
                );
            })}
            <circle cx={radius} cy={radius} r={innerRadius - 2} fill="white" />
            <text x="50%" y="50%" textAnchor="middle" dy=".3em" fontSize="24" fontWeight="bold" fill="#334155">
                {total}
            </text>
            <text x="50%" y="62%" textAnchor="middle" dy=".3em" fontSize="12" fill="#94a3b8">
                Total
            </text>
        </svg>
    );
};

interface BarChartProps {
    data: ChartData[];
    height?: number;
}

export const BarChart: React.FC<BarChartProps> = ({ data, height = 200 }) => {
    const max = Math.max(...data.map(d => d.value), 1); // Avoid division by zero

    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', height, gap: '1rem', width: '100%' }}>
            {data.map((item) => (
                <div key={item.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div
                        style={{
                            width: '100%',
                            height: `${(item.value / max) * 100}%`,
                            background: item.color,
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.3s ease',
                            minHeight: item.value > 0 ? 4 : 0
                        }}
                    />
                    <span className="tiny muted" style={{ textAlign: 'center' }}>{item.label}</span>
                </div>
            ))}
        </div>
    );
};
