// src/components/VariationTable.tsx
import React from 'react';
import { VariationTableData } from '../types';
import { LatexText } from './LatexText';

interface Props {
    data: VariationTableData;
}

export const VariationTable: React.FC<Props> = ({ data }) => {
    if (!data || !data.xNodes || data.xNodes.length === 0) {
        return (
            <div className="text-red-600 font-bold text-center my-8 p-6 bg-red-50 border-2 border-red-300 rounded-xl">
                ⚠️ Lỗi: Thiếu dữ liệu bảng biến thiên!
            </div>
        );
    }

    const width = 800;
    const rowHeight = 50;
    const graphHeight = 130;
    const totalHeight = rowHeight * 2 + graphHeight;
    const startX = 70;
    const colWidth = (width - startX - 50) / (data.xNodes.length - 1);

    const yTop = rowHeight * 2 + 15;
    const yBot = rowHeight * 2 + graphHeight - 15;

    const clean = (s: string | undefined) => s ? `$${s.trim().replace(/inf/g, '\\infty')}$` : '';

    const getY = (i: number): number => {
        const val = data.yNodes[i];
        if (typeof val === 'string') {
            if (val.includes('+\\infty') || val.includes('+inf')) return yTop;
            if (val.includes('-\\infty') || val.includes('-inf')) return yBot;
        }
        return rowHeight * 2 + graphHeight / 2;
    };

    return (
        <div className="overflow-x-auto border-2 border-gray-800 rounded-lg p-4 bg-white shadow-lg my-6">
            <svg width={width} height={totalHeight} className="select-none">
                <defs>
                    <marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                        <path d="M0,0 L8,3 L0,6 Z" fill="red" />
                    </marker>
                </defs>

                {/* Đường kẻ ngang – DÙNG MAP THAY VÌ forEach */}
                {[rowHeight, rowHeight * 2].map(y => (
                    <line key={y} x1="0" y1={y} x2={width} y2={y} stroke="black" strokeWidth="2" />
                ))}

                {/* Đường kẻ dọc */}
                <line x1={startX} y1="0" x2={startX} y2={totalHeight} stroke="black" strokeWidth="2" />

                {/* Tiêu đề */}
                <text x={startX / 2} y={rowHeight / 2 + 8} textAnchor="middle" fontWeight="bold" fontSize="16">x</text>
                <text x={startX / 2} y={rowHeight * 1.5 + 8} textAnchor="middle" fontWeight="bold" fontSize="16">y'</text>
                <text x={startX / 2} y={rowHeight * 2 + graphHeight / 2} textAnchor="middle" fontWeight="bold" fontSize="16">y</text>

                {data.xNodes.map((x, i) => {
                    const cx = startX + i * colWidth;
                    const isVertAsym = data.yPrimeVals?.[i] === '||' || (typeof data.yNodes[i] === 'string' && data.yNodes[i].includes('||'));

                    return (
                        <g key={i}>
                            {/* Vạch tiệm cận đứng */}
                            {isVertAsym && (
                                <>
                                    <line x1={cx - 4} y1={rowHeight} x2={cx - 4} y2={totalHeight} stroke="black" strokeWidth="3" />
                                    <line x1={cx + 4} y1={rowHeight} x2={cx + 4} y2={totalHeight} stroke="black" strokeWidth="3" />
                                </>
                            )}

                            {/* Giá trị x */}
                            <foreignObject x={cx - 40} y={5} width={80} height={45}>
                                <div className="text-center font-bold text-sm">
                                    <LatexText text={clean(x)} />
                                </div>
                            </foreignObject>

                            {/* Dấu y' giữa các cột */}
                            {i < data.yPrimeSigns.length && data.yPrimeSigns[i] && (
                                <text x={cx + colWidth / 2} y={rowHeight + 28} textAnchor="middle" fontSize="24" fontWeight="bold" fill="#d946ef">
                                    {data.yPrimeSigns[i]}
                                </text>
                            )}

                            {/* Giá trị y' (0 hoặc các giá trị đặc biệt) */}
                            {data.yPrimeVals?.[i] && data.yPrimeVals[i] !== '||' && (
                                <foreignObject x={cx - 25} y={rowHeight + 8} width={50} height={30}>
                                    <div className="text-center font-bold text-xs">
                                        <LatexText text={clean(data.yPrimeVals[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* Giá trị y – xử lý tiệm cận đứng */}
                            {(() => {
                                const yVal = data.yNodes[i];
                                if (isVertAsym && typeof yVal === 'string' && yVal.includes('||')) {
                                    const [left, right] = yVal.split('||');
                                    return (
                                        <>
                                            <foreignObject x={cx - 80} y={yTop - 15} width={70} height={30}>
                                                <div className="text-right pr-2 font-bold text-sm"><LatexText text={clean(left)} /></div>
                                            </foreignObject>
                                            <foreignObject x={cx + 15} y={yBot - 15} width={70} height={30}>
                                                <div className="text-left pl-2 font-bold text-sm"><LatexText text={clean(right)} /></div>
                                            </foreignObject>
                                        </>
                                    );
                                }
                                return (
                                    <foreignObject x={cx - 40} y={getY(i) - 15} width={80} height={30}>
                                        <div className="text-center font-bold text-sm">
                                            <LatexText text={clean(yVal as string)} />
                                        </div>
                                    </foreignObject>
                                );
                            })()}

                            {/* Mũi tên đồ thị y – đỏ đậm, dốc rõ */}
                            {i < data.xNodes.length - 1 && (
                                <line
                                    x1={cx + (isVertAsym ? 15 : 35)}
                                    y1={getY(i)}
                                    x2={startX + (i + 1) * colWidth - (data.yPrimeVals?.[i + 1] === '||' ? 15 : 35)}
                                    y2={getY(i + 1)}
                                    stroke="red"
                                    strokeWidth="3"
                                    markerEnd="url(#arr)"
                                />
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};