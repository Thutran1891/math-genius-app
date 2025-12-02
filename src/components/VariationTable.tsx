// VariationTable.tsx (bản đã sửa hoàn chỉnh)
import React from 'react';
import { VariationTableData } from '../types';
import { LatexText } from './LatexText';

interface Props {
    data: VariationTableData;
}

export const VariationTable: React.FC<Props> = ({ data }) => {
    const width = 600;
    const paddingRight = 40;
    const rowHeight = 45;
    const yRowHeight = 100;           // tăng lên để đồ thị dốc rõ hơn
    const totalHeight = rowHeight * 2 + yRowHeight;
    const startX = 60;
    const usableWidth = width - startX - paddingRight;
    const colWidth = usableWidth / Math.max(1, data.xNodes.length - 1);

    const yTop = rowHeight * 2 + 15;          // vị trí +∞
    const yBot = rowHeight * 2 + yRowHeight - 15; // vị trí -∞
    const yMid = rowHeight * 2 + yRowHeight / 2;

    const cleanMath = (val: string): string => {
        if (!val) return "";
        let s = val.trim();
        s = s.replace(/inf/g, '\\infty');
        if (!s.startsWith('$')) s = `$${s}$`;
        return s;
    };

    // Hàm quyết định tọa độ Y chính xác theo quy tắc bạn đưa ra
    const getPreciseY = (index: number): number => {
        const yVal = data.yNodes[index];
        const hasAsymptote = data.yPrimeVals?.[index] === '||' || yVal.includes('||');

        // Trường hợp tiệm cận đứng → luôn trả về giữa để vẽ 2 giá trị 2 bên
        if (hasAsymptote) return yMid;

        const signLeft = index > 0 ? data.yPrimeSigns?.[index - 1] : null;   // dấu bên trái
        const signRight = index < data.yPrimeSigns.length ? data.yPrimeSigns?.[index] : null; // dấu bên phải

        const isLeftmost = index === 0;
        const isRightmost = index === data.xNodes.length - 1;

        // Quy tắc bạn yêu cầu
        if (isLeftmost && signRight === '+') return yBot;
        if (isLeftmost && signRight === '-') return yTop;

        if (isRightmost && signLeft === '-') return yBot;
        if (isRightmost && signLeft === '+') return yTop;

        if (!isLeftmost && !isRightmost && signLeft === '-') return yBot;
        if (!isLeftmost && !isRightmost && signLeft === '+') return yTop;

        return yMid; // mặc định
    };

    return (
        <div className="w-full overflow-x-auto border border-gray-300 rounded p-3 bg-white shadow-md mb-6">
            <svg width={width} height={totalHeight} className="select-none" style={{ minWidth: width }}>
                <defs>
                    <marker id="arrowhead" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
                        <polygon points="0 0, 7 2.5, 0 5" fill="black" />
                    </marker>
                </defs>

                {/* Đường ngang */}
                {[rowHeight, rowHeight * 2].map(y => (
                    <line key={y} x1="0" y1={y} x2={width} y2={y} stroke="black" strokeWidth="1.5" />
                ))}
                <line x1={startX} y1="0" x2={startX} y2={totalHeight} stroke="black" strokeWidth="1.5" />

                {/* Tiêu đề */}
                <text x={startX / 2} y={rowHeight / 2 + 6} textAnchor="middle" fontWeight="bold" fontSize="14">x</text>
                <text x={startX / 2} y={rowHeight + rowHeight / 2 + 6} textAnchor="middle" fontWeight="bold" fontSize="14">y'</text>
                <text x={startX / 2} y={rowHeight * 2 + yRowHeight / 2} textAnchor="middle" fontWeight="bold" fontSize="14">y</text>

                {data.xNodes.map((x, i) => {
                    const cx = startX + 30 + i * colWidth;
                    const isAsymptote = data.yPrimeVals?.[i] === '||' || data.yNodes[i].includes('||');

                    // Vạch tiệm cận đứng
                    {isAsymptote && (
                        <>
                            <line x1={cx - 3} y1={rowHeight} x2={cx - 3} y2={totalHeight} stroke="black" strokeWidth="2" />
                            <line x1={cx + 3} y1={rowHeight} x2={cx + 3} y2={totalHeight} stroke="black" strokeWidth="2" />
                        </>
                    )}

                    // Hàng x
                    <foreignObject x={cx - 35} y={8} width={70} height={rowHeight}>
                        <div className="flex justify-center items-center h-full font-bold text-sm">
                            <LatexText text={cleanMath(x)} />
                        </div>
                    </foreignObject>

                    // Dấu y' (giữa các cột)
                    {i < data.yPrimeSigns.length && data.yPrimeSigns[i] && (
                        <foreignObject x={cx + colWidth / 2 - 20} y={rowHeight + 8} width={40} height={30}>
                            <div className="flex justify-center items-center h-full text-lg font-bold">
                                <LatexText text={data.yPrimeSigns[i] === '+' ? '+' : '-'} />
                            </div>
                        </foreignObject>
                    )}

                    // Giá trị y' (0 hoặc ||)
                    {data.yPrimeVals?.[i] && data.yPrimeVals[i] !== '||' && (
                        <foreignObject x={cx - 20} y={rowHeight + 8} width={40} height={30}>
                            <div className="flex justify-center items-center h-full font-bold">
                                <LatexText text={cleanMath(data.yPrimeVals[i])} />
                            </div>
                        </foreignObject>
                    )}

                    // Giá trị y (có thể tách đôi khi có tiệm cận)
                    const rawY = data.yNodes[i];
                    if (isAsymptote && rawY.includes('||')) {
                        const [left, right] = rawY.split('||');
                        return (
                            <g key={i}>
                                <foreignObject x={cx - 55} y={yTop - 15} width={50} height={30}>
                                    <div className="text-right pr-2 font-bold text-sm"><LatexText text={cleanMath(left)} /></div>
                                </foreignObject>
                                <foreignObject x={cx + 10} y={yBot - 15} width={50} height={30}>
                                    <div className="text-left pl-2 font-bold text-sm"><LatexText text={cleanMath(right)} /></div>
                                </foreignObject>
                            </g>
                        );
                    } else {
                        const yPos = getPreciseY(i);
                        <foreignObject x={cx - 40} y={yPos - 15} width={80} height={30}>
                            <div className="flex justify-center items-center h-full font-bold text-sm">
                                <LatexText text={cleanMath(rawY)} />
                            </div>
                        </foreignObject>
                    }

                    // Mũi tên đồ thị y (quan trọng nhất)
                    {i < data.xNodes.length - 1 && (
                        <line
                            x1={cx + (isAsymptote ? 12 : 25)}
                            y1={getPreciseY(i)}
                            x2={startX + 30 + (i + 1) * colWidth - (data.yPrimeVals?.[i + 1] === '||' ? 12 : 25)}
                            y2={getPreciseY(i + 1)}
                            stroke="red"
                            strokeWidth="2.5"
                            markerEnd="url(#arrowhead)"
                        />
                    )}
                })}
            </svg>
        </div>
    );
};