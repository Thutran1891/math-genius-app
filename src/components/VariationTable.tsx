// src/components/VariationTable.tsx
import React from 'react';
import { VariationTableData } from '../types';
import { LatexText } from './LatexText';

interface Props {
    data: VariationTableData;
}

export const VariationTable: React.FC<Props> = ({ data }) => {
    if (!data?.xNodes?.length) {
        return <div className="text-red-600 font-bold text-center p-10 bg-red-50 rounded-xl border-2 border-red-400">
            ⚠️ Thiếu dữ liệu bảng biến thiên!
        </div>;
    }

    const width = 950;
    const rowHeight = 60;
    const graphHeight = 170;
    const totalHeight = rowHeight * 2 + graphHeight;
    const startX = 90;
    const usableWidth = width - startX - 70;
    const colWidth = usableWidth / (data.xNodes.length - 1);

    const yTop = rowHeight * 2 + 25;
    const yBot = rowHeight * 2 + graphHeight - 25;

    // Chuẩn hóa mọi dạng ∞ thành LaTeX đúng
    const clean = (s: string | undefined): string => {
        if (!s) return '';
        let str = s.trim();
        str = str.replace(/\+inf|\+∞/gi, '+\\infty');
        str = str.replace(/-inf|-∞/gi, '-\\infty');
        str = str.replace(/inf|∞/gi, '\\infty');
        if (!str.startsWith('$')) str = `$${str}$`;
        return str;
    };

    // Xác định vị trí Y chính xác theo dấu y' (chuẩn SGK 100%)
    const getYPos = (i: number): number => {
        const val = data.yNodes[i];
        const isAsym = data.yPrimeVals?.[i] === '||' || (typeof val === 'string' && val.includes('||'));
        if (isAsym) return rowHeight * 2 + graphHeight / 2;

        const signLeft = i > 0 ? data.yPrimeSigns[i - 1] : null;
        const signRight = i < data.yPrimeSigns.length ? data.yPrimeSigns[i] : null;

        if (i === 0) return signRight === '+' ? yBot : yTop;
        if (i === data.xNodes.length - 1) return signLeft === '+' ? yTop : yBot;
        return signLeft === '+' ? yTop : yBot;
    };

    return (
        <div className="overflow-x-auto border-3 border-gray-900 rounded-2xl p-6 bg-white shadow-2xl my-10">
            <svg width={width} height={totalHeight} className="select-none">
                <defs>
                    <marker id="arrow" markerWidth="12" markerHeight="10" refX="11" refY="5" orient="auto">
                        <path d="M0,0 L12,5 L0,10 Z" fill="#dc2626" />
                    </marker>
                </defs>

                {/* Đường ngang */}
                {[rowHeight, rowHeight * 2].map(y => (
                    <line key={y} x1="0" y1={y} x2={width} y2={y} stroke="black" strokeWidth="3" />
                ))}

                <line x1={startX} y1="0" x2={startX} y2={totalHeight} stroke="black" strokeWidth="3" />

                {/* Tiêu đề */}
                <text x={startX/2} y={rowHeight/2 + 12} textAnchor="middle" fontWeight="bold" fontSize="20">x</text>
                <text x={startX/2} y={rowHeight*1.5 + 12} textAnchor="middle" fontWeight="bold" fontSize="20">y'</text>
                <text x={startX/2} y={rowHeight*2 + graphHeight/2} textAnchor="middle" fontWeight="bold" fontSize="20">y</text>

                {data.xNodes.map((node, i) => {
                    const cx = startX + i * colWidth;
                    const isAsymptote = data.yPrimeVals?.[i] === '||' || (typeof data.yNodes[i] === 'string' && data.yNodes[i].includes('||'));

                    return (
                        <g key={i}>
                            {/* Tiệm cận đứng */}
                            {isAsymptote && (
                                <>
                                    <line x1={cx-6} y1={rowHeight} x2={cx-6} y2={totalHeight} stroke="black" strokeWidth="5" />
                                    <line x1={cx+6} y1={rowHeight} x2={cx+6} y2={totalHeight} stroke="black" strokeWidth="5" />
                                </>
                            )}

                            {/* Mốc x */}
                            <foreignObject x={cx-50} y={5} width={100} height={50}>
                                <div className="text-center font-bold text-base">
                                    <LatexText text={clean(node)} />
                                </div>
                            </foreignObject>

                            {/* Dấu y' */}
                            {i < data.yPrimeSigns.length && data.yPrimeSigns[i] && (
                                <text x={cx + colWidth/2} y={rowHeight + 35} textAnchor="middle" fontSize="32" fontWeight="bold" fill="#a855f7">
                                    {data.yPrimeSigns[i]}
                                </text>
                            )}

                            {/* Giá trị y' */}
                            {data.yPrimeVals?.[i] && data.yPrimeVals[i] !== '||' && (
                                <foreignObject x={cx-35} y={rowHeight+8} width={70} height={40}>
                                    <div className="text-center font-bold text-sm">
                                        <LatexText text={clean(data.yPrimeVals[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* Giá trị y – xử lý ∞ và tiệm cận */}
                            {(() => {
                                const yVal = data.yNodes[i];
                                if (isAsymptote && typeof yVal === 'string' && yVal.includes('||')) {
                                    const [left, right] = yVal.split('||');
                                    return (
                                        <>
                                            <foreignObject x={cx-110} y={yTop-20} width={100} height={40}>
                                                <div className="text-right font-bold text-base"><LatexText text={clean(left)} /></div>
                                            </foreignObject>
                                            <foreignObject x={cx+20} y={yBot-20} width={100} height={40}>
                                                <div className="text-left font-bold text-base"><LatexText text={clean(right)} /></div>
                                            </foreignObject>
                                        </>
                                    );
                                }

                                const yPos = getYPos(i);
                                return (
                                    <foreignObject x={cx-60} y={yPos-22} width={120} height={45}>
                                        <div className="text-center font-bold text-base">
                                            <LatexText text={clean(yVal as string)} />
                                        </div>
                                    </foreignObject>
                                );
                            })()}

                            {/* MŨI TÊN – QUAN TRỌNG NHẤT: KHÔNG VẼ XUYÊN TIỆM CẬN */}
                            {i < data.xNodes.length - 1 && (
                                <>
                                    {/* Chỉ vẽ nếu không có tiệm cận ở 2 đầu đoạn */}
                                    {!(isAsymptote || data.yPrimeVals?.[i+1] === '||') && (
                                        <line
                                            x1={cx + 45}
                                            y1={getYPos(i)}
                                            x2={startX + (i+1)*colWidth - 45}
                                            y2={getYPos(i+1)}
                                            stroke="#dc2626"
                                            strokeWidth="5"
                                            markerEnd="url(#arrow)"
                                        />
                                    )}

                                    {/* Nếu có tiệm cận ở đầu đoạn sau → dừng trước tiệm cận */}
                                    {data.yPrimeVals?.[i+1] === '||' && (
                                        <line
                                            x1={cx + 45}
                                            y1={getYPos(i)}
                                            x2={startX + (i+1)*colWidth - 70}
                                            y2={getYPos(i)}
                                            stroke="#dc2626"
                                            strokeWidth="5"
                                            markerEnd="url(#arrow)"
                                        />
                                    )}

                                    {/* Nếu có tiệm cận ở đầu đoạn hiện tại → bắt đầu từ sau tiệm cận */}
                                    {isAsymptote && (
                                        <line
                                            x1={cx + 70}
                                            y1={getYPos(i)}
                                            x2={startX + (i+1)*colWidth - 45}
                                            y2={getYPos(i+1)}
                                            stroke="#dc2626"
                                            strokeWidth="5"
                                            markerEnd="url(#arrow)"
                                        />
                                    )}
                                </>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};