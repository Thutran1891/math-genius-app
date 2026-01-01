// VariationTable.tsx - Bản ổn định đã gỡ lỗi
import React from 'react';
import { VariationTableData } from '../types';
import { LatexText } from './LatexText';

interface Props {
    data: VariationTableData;
}

export const VariationTable: React.FC<Props> = ({ data }) => {
    const width = 640;
    const paddingRight = 48;
    const rowHeight = 48;
    const yRowHeight = 112;
    const totalHeight = rowHeight * 2 + yRowHeight;
    const startX = 64;

    const usableWidth = width - startX - paddingRight; 
    const colWidth = usableWidth / Math.max(1, data.xNodes.length - 1);

    const cleanMath = (val: string): string => {
        if (!val) return "";
        let s = val.trim();
        if (!s.includes('\\infty') && !s.includes('\u221e')) {
            if (s.toLowerCase().includes('-inf')) s = '-\\infty';
            else if (s.toLowerCase().includes('+inf') || s.toLowerCase().includes('inf')) s = '+\\infty';
        }
        if (!s.startsWith('$')) return `$${s}$`;
        return s;
    };

    const getYPos = (val: string, index: number, isLeftOfAsymptote: boolean = false, isRightOfAsymptote: boolean = false) => {
        const yTop = rowHeight * 2 + 20;
        const yBot = totalHeight - 20;
        const yMid = rowHeight * 2 + yRowHeight / 2;
        const v = val ? val.toLowerCase().replace(/\$|\\/g, '') : ""; 

        if (v.includes('infty') || v.includes('inf') || v.includes('\u221e')) {
            if (v.includes('-')) return yBot;
            return yTop;
        }

        let leftSign = index > 0 ? data.yPrimeSigns?.[index - 1] : null;
        let rightSign = index < (data.yPrimeSigns?.length || 0) ? data.yPrimeSigns?.[index] : null;

        if (isLeftOfAsymptote) rightSign = null; 
        if (isRightOfAsymptote) leftSign = null;

        if (leftSign && rightSign) {
            if (leftSign === '+' && rightSign === '-') return yTop;
            if (leftSign === '-' && rightSign === '+') return yBot;
        }
        if (!leftSign && rightSign) {
            if (rightSign === '+') return yBot;
            if (rightSign === '-') return yTop;
        }
        if (leftSign && !rightSign) {
            if (leftSign === '+') return yTop;
            if (leftSign === '-') return yBot;
        }
        return yMid;
    };

    return (
        <div className="w-full max-w-full overflow-x-auto border border-gray-300 rounded p-4 bg-white shadow-sm mb-6 flex justify-start pl-2">
            <svg width={width} height={totalHeight} className="select-none" style={{minWidth: width}}>
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="black" />
                    </marker>
                </defs>

                <line x1="0" y1={rowHeight} x2={width} y2={rowHeight} stroke="black" strokeWidth="1" />
                <line x1="0" y1={rowHeight*2} x2={width} y2={rowHeight*2} stroke="black" strokeWidth="1" />
                <line x1={startX} y1="0" x2={startX} y2={totalHeight} stroke="black" strokeWidth="1" />

                <text x={startX/2} y={rowHeight/2 + 5} textAnchor="middle" className="font-bold italic text-lg font-serif">x</text>
                <text x={startX/2} y={rowHeight + rowHeight/2 + 5} textAnchor="middle" className="font-bold italic text-lg font-serif">y'</text>
                <text x={startX/2} y={rowHeight*2 + yRowHeight/2} textAnchor="middle" className="font-bold italic text-lg font-serif">y</text>
                               
                {data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    
                    // 1. CHUẨN HÓA BIẾN
                    const xValClean = (x || "").toLowerCase().replace(/\$|\\/g, '').trim();
                    const isInfinity = xValClean.includes('inf') || xValClean.includes('\u221e');
                    const rawY = data.yNodes[i] || "";
                    const rawYPrime = data.yPrimeVals?.[i] || "";

                    // --- 2. LOGIC TIỆM CẬN ĐỨNG (QUAN TRỌNG NHẤT) ---
                    // Điều kiện vẽ 2 vạch sọc:
                    // - KHÔNG phải vô cực.
                    // - Dòng Y BẮT BUỘC phải chứa '||' (thể hiện sự gián đoạn của hàm số).
                    // - Dòng Y' cũng phải chứa '||' HOẶC AI bỏ trống (không xác định).
                    const isAsymptote = !isInfinity && rawY.includes('||');

                    // 3. Render X Nodes
                    const xDisplay = (
                        <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                            <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                <LatexText text={cleanMath(x)} />
                            </div>
                        </foreignObject>
                    );

                    // --- 4. Render Y' Values (Số 0 hoặc ||) ---
                    let yPrimeValDisplay = null;
                    if (isAsymptote) {
                        yPrimeValDisplay = (
                            <g>
                                <line x1={cx - 3} y1={rowHeight} x2={cx - 3} y2={totalHeight} stroke="black" strokeWidth="1.2" />
                                <line x1={cx + 3} y1={rowHeight} x2={cx + 3} y2={totalHeight} stroke="black" strokeWidth="1.2" />
                            </g>
                        );
                    } 
                    else if (!isInfinity) {
                        // TỰ ĐỘNG BÙ SỐ 0: 
                        // Nếu không phải tiệm cận và không phải vô cực, ta luôn ưu tiên số 0 tại cực trị.
                        const valToDraw = (rawYPrime && rawYPrime.trim() !== "" && rawYPrime !== "||") 
                                        ? rawYPrime 
                                        : "0"; 

                        yPrimeValDisplay = (
                            <foreignObject x={cx - 20} y={rowHeight} width={40} height={rowHeight}>
                                <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                    <LatexText text={cleanMath(valToDraw)} />
                                </div>
                            </foreignObject>
                        );
                    }

                    // 5. Render Dấu Y' (+/-)
                    let signDisplay = null;
                    if (i < data.xNodes.length - 1 && data.yPrimeSigns?.[i]) {
                        const signCx = cx + colWidth / 2;
                        signDisplay = (
                            <foreignObject x={signCx - 20} y={rowHeight} width={40} height={rowHeight}>
                                <div className="flex justify-center w-full h-full font-bold text-lg items-center">
                                    <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                </div>
                            </foreignObject>
                        );
                    }

                    // 6. Render Y Nodes
                    let yNodeContent = null;
                    if (isAsymptote) {
                        const parts = rawY.split('||');
                        const lVal = (parts[0] || "").trim();
                        const rVal = (parts[1] || "").trim();
                        const lY = getYPos(lVal, i, true, false);
                        const rY = getYPos(rVal, i, false, true);
                        yNodeContent = (
                            <g>
                                <foreignObject x={cx - 52} y={lY - 15} width={50} height={30}>
                                    <div className="flex justify-end w-full h-full font-bold text-sm items-center pr-1">
                                        <LatexText text={cleanMath(lVal)} />
                                    </div>
                                </foreignObject>
                                <foreignObject x={cx + 2} y={rY - 15} width={50} height={30}>
                                    <div className="flex justify-start w-full h-full font-bold text-sm items-center pl-0">
                                        <LatexText text={cleanMath(rVal)} />
                                    </div>
                                </foreignObject>
                            </g>
                        );
                    } else {
                        const yPos = getYPos(rawY, i);
                        yNodeContent = (
                            <foreignObject x={cx - 40} y={yPos - 15} width={80} height={30}>
                                <div className="flex justify-center w-full h-full font-bold text-sm items-center bg-transparent">
                                    <LatexText text={cleanMath(rawY)} />
                                </div>
                            </foreignObject>
                        );
                    }

                    // 7. Mũi tên
                    let arrowLine = null;
                    if (i < data.xNodes.length - 1) {
                        const nextYRaw = data.yNodes[i+1] || "";
                        const nextCx = startX + 40 + (i+1) * colWidth;
                        let x1, y1, x2, y2;

                        if (rawY.includes('||')) {
                            y1 = getYPos(rawY.split('||')[1] || "", i, false, true);
                            x1 = cx + 8;
                        } else {
                            y1 = getYPos(rawY, i);
                            x1 = cx + 22;
                        }

                        if (nextYRaw.includes('||')) {
                            y2 = getYPos(nextYRaw.split('||')[0] || "", i+1, true, false);
                            x2 = nextCx - 18;
                        } else {
                            y2 = getYPos(nextYRaw, i+1);
                            x2 = nextCx - 32;
                        }

                        arrowLine = (
                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="black" strokeWidth="1.2" markerEnd="url(#arrowhead)" />
                        );
                    }

                    return (
                        <g key={i}>
                            {xDisplay}
                            {yPrimeValDisplay}
                            {signDisplay}
                            {yNodeContent}
                            {arrowLine}
                        </g>
                    );
                })}

            </svg>
        </div>
    );
};