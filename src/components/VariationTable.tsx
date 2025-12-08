import React from 'react';
import { VariationTableData } from '../types';
import { LatexText } from './LatexText';

interface Props {
    data: VariationTableData;
}

export const VariationTable: React.FC<Props> = ({ data }) => {
    // 1. CẤU HÌNH KÍCH THƯỚC
    const width = 640;
    const paddingRight = 48;
    const rowHeight = 48;
    const yRowHeight = 120; // Tăng chiều cao hàng Y lên chút để thoáng
    const totalHeight = rowHeight * 2 + yRowHeight;
    const startX = 64;

    const usableWidth = width - startX - paddingRight;
    const colWidth = usableWidth / Math.max(1, data.xNodes.length - 1);

    // --- CẤU HÌNH TỌA ĐỘ 5 TẦNG (LEVELS) ---
    // Đây là chìa khóa để vẽ đúng mọi dạng bài
    const Y_TOP = rowHeight * 2 + 25;           // Tầng 1: +Vô cực
    const Y_HIGH = rowHeight * 2 + 50;          // Tầng 2: Cực Đại
    const Y_MID = rowHeight * 2 + yRowHeight / 2; // Tầng 3: Tiệm cận ngang / Trung gian
    const Y_LOW = totalHeight - 50;             // Tầng 4: Cực Tiểu
    const Y_BOT = totalHeight - 25;             // Tầng 5: -Vô cực

    // --- HELPER FUNCTIONS ---
    
    // Làm sạch chuỗi LaTeX
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

    const isPos = (val: string | null | undefined) => val && val.trim() === '+';
    const isNeg = (val: string | null | undefined) => val && ['-', '−', '–', '—', '\u2212'].includes(val.trim());

    // --- LOGIC ĐỊNH VỊ (MAPPING LEVEL) ---
    const getYPos = (val: string, index: number) => {
        const v = val ? val.toLowerCase().replace(/\$|\\/g, '') : "";

        // 1. NHẬN DIỆN VÔ CỰC (Ưu tiên số 1)
        if (v.includes('infty') || v.includes('inf') || v.includes('\u221e')) {
            if (v.includes('-') || isNeg(val)) return Y_BOT; // -Vô cực -> Đáy
            return Y_TOP;                                    // +Vô cực -> Đỉnh
        }

        // 2. NHẬN DIỆN SỐ HỮU TỶ (Cực trị hay Tiệm cận?)
        // Ta nhìn vào dấu đạo hàm bên trái và bên phải
        const leftSign = index > 0 ? data.yPrimeSigns?.[index - 1] : null;
        const rightSign = index < (data.yPrimeSigns?.length || 0) ? data.yPrimeSigns?.[index] : null;

        // CỰC ĐẠI (Lên -> Xuống): + rồi -
        if (isPos(leftSign) && isNeg(rightSign)) return Y_HIGH;

        // CỰC TIỂU (Xuống -> Lên): - rồi +
        if (isNeg(leftSign) && isPos(rightSign)) return Y_LOW;

        // CÁC TRƯỜNG HỢP CÒN LẠI -> VỀ GIỮA
        // Bao gồm: 
        // - Tiệm cận ngang của hàm 1/1 (đầu/cuối bảng)
        // - Điểm uốn
        return Y_MID;
    };

    return (
        <div className="w-full max-w-full overflow-x-auto border border-gray-300 rounded p-4 bg-white shadow-sm mb-6 flex justify-start pl-2">
            <svg width={width} height={totalHeight} className="select-none" style={{minWidth: width}}>
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="black" />
                    </marker>
                </defs>

                {/* Grid Lines */}
                <line x1="0" y1={rowHeight} x2={width} y2={rowHeight} stroke="black" strokeWidth="1" />
                <line x1="0" y1={rowHeight*2} x2={width} y2={rowHeight*2} stroke="black" strokeWidth="1" />
                <line x1={startX} y1="0" x2={startX} y2={totalHeight} stroke="black" strokeWidth="1" />

                {/* Headers */}
                <text x={startX/2} y={rowHeight/2 + 5} textAnchor="middle" className="font-bold italic text-lg font-serif">x</text>
                <text x={startX/2} y={rowHeight + rowHeight/2 + 5} textAnchor="middle" className="font-bold italic text-lg font-serif">y'</text>
                <text x={startX/2} y={rowHeight*2 + yRowHeight/2} textAnchor="middle" className="font-bold italic text-lg font-serif">y</text>

                {/* Main Render Loop */}
                {data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    
                    // Check Tiệm cận đứng (dựa vào || ở dòng y' hoặc y)
                    const isAsymptote = data.yPrimeVals?.[i]?.includes('||') || (data.yNodes[i] && data.yNodes[i].includes('||'));

                    // --- 1. Draw X ---
                    const xDisplay = (
                        <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                             <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                <LatexText text={cleanMath(x)} />
                             </div>
                        </foreignObject>
                    );

                    // --- 2. Draw Y' Value ---
                    let yPrimeDisplay = null;
                    if (isAsymptote) {
                        yPrimeDisplay = (
                            <g>
                                <line x1={cx - 3} y1={rowHeight} x2={cx - 3} y2={totalHeight} stroke="black" strokeWidth="1" />
                                <line x1={cx + 3} y1={rowHeight} x2={cx + 3} y2={totalHeight} stroke="black" strokeWidth="1" />
                            </g>
                        );
                    } else if (data.yPrimeVals?.[i]) {
                        yPrimeDisplay = (
                            <foreignObject x={cx - 20} y={rowHeight + 15} width={40} height={30}>
                                 <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                    <LatexText text={cleanMath(data.yPrimeVals[i])} />
                                 </div>
                            </foreignObject>
                        );
                    }

                    // --- 3. Draw Signs ---
                    let signDisplay = null;
                    if (i < data.xNodes.length - 1 && data.yPrimeSigns?.[i]) {
                        const signCx = cx + colWidth / 2;
                         signDisplay = (
                             <foreignObject x={signCx - 20} y={rowHeight + 15} width={40} height={30}>
                                <div className="flex justify-center w-full h-full font-bold text-lg items-center">
                                    <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                </div>
                             </foreignObject>
                         );
                    }

                    // --- 4. Draw Y Nodes & Arrows ---
                    let yDisplay = null;
                    let arrowLine = null;
                    const rawY = data.yNodes[i] || "";
                    
                    // --- LOGIC XỬ LÝ VỊ TRÍ (QUAN TRỌNG) ---
                    if (isAsymptote) {
                        // Tách 2 bên của tiệm cận
                        const parts = rawY.split('||');
                        const leftVal = parts[0] ? parts[0].trim() : "";
                        const rightVal = parts[1] ? parts[1].trim() : "";

                        // Tiệm cận đứng: 
                        // Bên trái tính dựa vào giá trị trái. 
                        // Bên phải tính dựa vào giá trị phải.
                        const leftY = getYPos(leftVal, i);
                        const rightY = getYPos(rightVal, i); // Logic mới: index i vẫn đúng vì nó đại diện cho cột này

                        yDisplay = (
                            <g>
                                <foreignObject x={cx - 55} y={leftY - 15} width={50} height={30}>
                                    <div className="flex justify-end w-full h-full font-bold text-sm bg-white/0 items-center pr-2">
                                        <LatexText text={cleanMath(leftVal)} />
                                    </div>
                                </foreignObject>
                                <foreignObject x={cx + 5} y={rightY - 15} width={50} height={30}>
                                    <div className="flex justify-start w-full h-full font-bold text-sm bg-white/0 items-center pl-2">
                                        <LatexText text={cleanMath(rightVal)} />
                                    </div>
                                </foreignObject>
                            </g>
                        );
                    } else {
                        const yPos = getYPos(rawY, i);
                        yDisplay = (
                             <foreignObject x={cx - 40} y={yPos - 15} width={80} height={30}>
                                 <div className="flex justify-center w-full h-full font-bold text-sm bg-white/90 px-1 items-center">
                                    <LatexText text={cleanMath(rawY)} />
                                 </div>
                            </foreignObject>
                        );
                    }

                    // --- VẼ MŨI TÊN ---
                    if (i < data.xNodes.length - 1) {
                        let x1, y1, x2, y2;
                        const currentYRaw = data.yNodes[i] || "";
                        const nextYRaw = data.yNodes[i+1] || "";
                        const nextCx = startX + 40 + (i+1) * colWidth;

                        // TÍNH ĐIỂM ĐẦU (x1, y1)
                        if (currentYRaw.includes('||')) {
                            // Xuất phát từ vách PHẢI của tiệm cận
                            const rightVal = currentYRaw.split('||')[1] || "";
                            // Ta giả lập index i (đứng tại cột hiện tại) nhưng xét giá trị bên phải
                            // Lưu ý: Logic getYPos bây giờ chỉ phụ thuộc vào giá trị (Infinity/Number) 
                            // và dấu đạo hàm lân cận.
                            y1 = getYPos(rightVal, i); 
                            x1 = cx + 15; 
                        } else {
                            y1 = getYPos(currentYRaw, i);
                            x1 = cx + 20; 
                        }

                        // TÍNH ĐIỂM CUỐI (x2, y2)
                        if (nextYRaw.includes('||')) {
                            // Đích đến là vách TRÁI của tiệm cận
                            const leftVal = nextYRaw.split('||')[0] || "";
                            y2 = getYPos(leftVal, i+1);
                            x2 = nextCx - 15;
                        } else {
                            y2 = getYPos(nextYRaw, i+1);
                            x2 = nextCx - 20;
                        }

                        arrowLine = (
                            <line 
                                x1={x1} y1={y1} 
                                x2={x2} y2={y2} 
                                stroke="black" strokeWidth="1.2" markerEnd="url(#arrowhead)" 
                            />
                        );
                    }

                    return (
                        <g key={i}>
                            {xDisplay}
                            {yPrimeDisplay}
                            {signDisplay}
                            {arrowLine}
                            {yDisplay}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};