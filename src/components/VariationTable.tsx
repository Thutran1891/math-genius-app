// src/components/VariationTable.tsx
import React from 'react';
import { VariationTableData } from '../types';
import { LatexText } from './LatexText';

interface Props {
    data: VariationTableData;
}

export const VariationTable: React.FC<Props> = ({ data }) => {
    if (!data?.xNodes?.length) {
        return <div className="text-red-600 font-bold text-center p-8 bg-red-50 rounded-xl">Lỗi dữ liệu bảng biến thiên!</div>;
    }

    const width = 900;
    const rowHeight = 55;
    const graphHeight = 160;           // tăng để mũi tên dốc rõ hơn
    const totalHeight = rowHeight * 2 + graphHeight;
    const startX = 80;
    const usableWidth = width - startX - 60;
    const colWidth = usableWidth / (data.xNodes.length - 1);

    // Vị trí chính xác cho +∞ và -∞
    const yTop = rowHeight * 2 + 20;
    const yBot = rowHeight * 2 + graphHeight - 20;

    const clean = (s: string | undefined) => {
        if (!s) return '';
        return `$${s.trim().replace(/inf/g, '\\infty').replace(/\+\s*\\infty/g, '+\\infty').replace(/-\s*\\infty/g, '-\\infty')}$`;
    };

    // Hàm xác định Y chính xác theo dấu y' (rất quan trọng)
    const getYPosition = (i: number): number => {
        const val = data.yNodes[i];
        const hasAsym = data.yPrimeVals?.[i] === '||' || (typeof val === 'string' && val.includes('||'));
        if (hasAsym) return rowHeight * 2 + graphHeight / 2;

        // Xét dấu y' bên trái và bên phải ô hiện tại
        const signLeft = i > 0 ? data.yPrimeSigns[i - 1] : null;
        const signRight = i < data.yPrimeSigns.length ? data.yPrimeSigns[i] : null;

        // Quy tắc chuẩn SGK
        if (i === 0) return signRight === '+' ? yBot : yTop;                    // đầu trái
        if (i === data.xNodes.length - 1) return signLeft === '+' ? yTop : yBot; // đầu phải
        return signLeft === '+' ? yTop : yBot;                                  // ở giữa
    };

    return (
        <div className="overflow-x-auto border-2 border-gray-800 rounded-xl p-5 bg-white shadow-xl my-8">
            <svg width={width} height={totalHeight} className="select-none">
                <defs>
                    <marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                        <path d="M0,0 L10,4 L0,8 Z" fill="#dc2626" />
                    </marker>
                </defs>

                {/* Đường ngang */}
                {[rowHeight, rowHeight * 2].map(y => (
                    <line key={y} x1="0" y1={y} x2={width} y2={y} stroke="black" strokeWidth="2.5" />
                ))}

                {/* Đường dọc đầu bảng */}
                <line x1={startX} y1="0" x2={startX} y2={totalHeight} stroke="black" strokeWidth="2.5" />

                {/* Tiêu đề */}
                <text x={startX/2} y={rowHeight/2 + 10} textAnchor="middle" fontWeight="bold" fontSize="18">x</text>
                <text x={startX/2} y={rowHeight*1.5 + 10} textAnchor="middle" fontWeight="bold" fontSize="18">y'</text>
                <text x={startX/2} y={rowHeight*2 + graphHeight/2} textAnchor="middle" fontWeight="bold" fontSize="18">y</text>

                {data.xNodes.map((node, i) => {
                    const cx = startX + i * colWidth;
                    const isAsymptote = data.yPrimeVals?.[i] === '||' || (typeof data.yNodes[i] === 'string' && data.yNodes[i].includes('||'));

                    return (
                        <g key={i}>
                            {/* Tiệm cận đứng */}
                            {isAsymptote && (
                                <>
                                    <line x1={cx-5} y1={rowHeight} x2={cx-5} y2={totalHeight} stroke="black" strokeWidth="4" />
                                    <line x1={cx+5} y1={rowHeight} x2={cx+5} y2={totalHeight} stroke="black" strokeWidth="4" />
                                </>
                            )}

                            {/* Mốc x */}
                            <foreignObject x={cx-45} y={8} width={90} height={45}>
                                <div className="text-center font-bold text-sm">
                                    <LatexText text={clean(node)} />
                                </div>
                            </foreignObject>

                            {/* Dấu y' giữa các cột */}
                            {i < data.yPrimeSigns.length && data.yPrimeSigns[i] && (
                                <text x={cx + colWidth/2} y={rowHeight + 32} textAnchor="middle" fontSize="28" fontWeight="bold" fill="#a855f7">
                                    {data.yPrimeSigns[i]}
                                </text>
                            )}

                            {/* Giá trị y' (0, cực trị) */}
                            {data.yPrimeVals?.[i] && data.yPrimeVals[i] !== '||' && (
                                <foreignObject x={cx-30} y={rowHeight+5} width={60} height={35}>
                                    <div className="text-center font-bold text-xs">
                                        <LatexText text={clean(data.yPrimeVals[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* Giá trị y – xử lý ±∞ và tiệm cận */}
                            {(() => {
                                const yVal = data.yNodes[i];
                                if (isAsymptote && typeof yVal === 'string' && yVal.includes('||')) {
                                    const [left, right] = yVal.split('||');
                                    return (
                                        <>
                                            <foreignObject x={cx-90} y={yTop-15} width={80} height={35}>
                                                <div className="text-right pr-3 font-bold"><LatexText text={clean(left)} /></div>
                                            </foreignObject>
                                            <foreignObject x={cx+15} y={yBot-15} width={80} height={35}>
                                                <div className="text-left pl-3 font-bold"><LatexText text={clean(right)} /></div>
                                            </foreignObject>
                                        </>
                                    );
                                }

                                // Trường hợp ±∞ ở đầu/cuối
                                const yPos = getYPosition(i);
                                return (
                                    <foreignObject x={cx-50} y={yPos-18} width={100} height={40}>
                                        <div className="text-center font-bold text-sm">
                                            <LatexText text={clean(yVal as string)} />
                                        </div>
                                    </foreignObject>
                                );
                            })()}

                            {/* MŨI TÊN ĐỎ – DỐC RÕ RÀNG NHẤT */}
                            {i < data.xNodes.length - 1 && (
                                <line
                                    x1={cx + (isAsymptote ? 18 : 40)}
                                    y1={getYPosition(i)}
                                    x2={startX + (i+1)*colWidth - (data.yPrimeVals?.[i+1] === '||' ? 18 : 40)}
                                    y2={getYPosition(i+1)}
                                    stroke="#dc2626"
                                    strokeWidth="4"
                                    markerEnd="url(#arrow)"
                                />
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};