import React from 'react';
import { VariationTableData } from '../types';
import { LatexText } from './LatexText';

interface Props {
    data: VariationTableData;
}

export const VariationTable: React.FC<Props> = ({ data }) => {
    // 1. CẤU HÌNH KÍCH THƯỚC KHUNG
    const width = 640;
    const rowHeight = 48;       
    const yRowHeight = 140;     // Chiều cao khu vực vẽ mũi tên
    const totalHeight = rowHeight * 2 + yRowHeight;
    const startX = 64;          

    const usableWidth = width - startX - 48; 
    const colWidth = usableWidth / Math.max(1, data.xNodes.length - 1);

    // 2. CẤU HÌNH TỌA ĐỘ Y (QUAN TRỌNG: Y nhỏ là ở trên cao)
    const Y_TOP = rowHeight * 2 + 35;            // ĐỈNH CAO NHẤT (Dành cho +vc, Cực đại)
    const Y_BOT = totalHeight - 35;              // ĐÁY THẤP NHẤT (Dành cho -vc, Cực tiểu)
    const Y_MID = rowHeight * 2 + yRowHeight / 2; 

    // --- HELPER FUNCTIONS (Đã Fix lỗi TypeScript) ---
    
    // Chấp nhận string | null | undefined
    const isPos = (val: string | null | undefined): boolean => {
        if (!val) return false;
        return val.trim() === '+';
    };

    const isNeg = (val: string | null | undefined): boolean => {
        if (!val) return false;
        const v = val.trim();
        return ['-', '−', '–', '—', '\u2212'].includes(v);
    };

    const isPlusInf = (val: string) => {
        if (!val) return false;
        const v = val.toLowerCase();
        return v.includes('+inf') || (v.includes('inf') && !v.includes('-')) || v.includes('+\\infty');
    };
    
    const isMinusInf = (val: string) => {
        if (!val) return false;
        const v = val.toLowerCase();
        return v.includes('-inf') || v.includes('-\\infty');
    };

    const cleanMath = (val: string): string => {
        if (!val) return "";
        let s = val.trim();
        // Chuẩn hóa chuỗi vô cực
        if (!s.includes('\\infty') && !s.includes('\u221e')) {
            if (s.toLowerCase().includes('-inf')) s = '-\\infty';
            else if (isPlusInf(s)) s = '+\\infty';
        }
        if (!s.startsWith('$')) return `$${s}$`;
        return s;
    };

    /**
     * --- LOGIC TÍNH TỌA ĐỘ Y MỚI (FIX LỖI HÌNH 2 & 3) ---
     * Nguyên tắc:
     * 1. Nếu là Vô cực: Auto về Đỉnh/Đáy.
     * 2. Nếu là Số:
     * - Nếu là điểm Cực đại (Lên->Xuống): Về Đỉnh.
     * - Nếu là điểm Cực tiểu (Xuống->Lên): Về Đáy.
     * - Nếu nằm cạnh Tiệm cận hoặc Bìa bảng:
     * + Nhìn vào dấu đạo hàm của khoảng đó.
     * + Ví dụ: Ở bìa phải, đạo hàm là (-). Nghĩa là đồ thị đang đi xuống để tới điểm này -> Điểm này phải ở Đáy (Y_BOT).
     */
    const getYPos = (val: string, index: number, context: 'normal' | 'left_of_asymptote' | 'right_of_asymptote') => {
        const vRaw = val ? val.toLowerCase() : "";

        // 1. ƯU TIÊN TUYỆT ĐỐI CHO VÔ CỰC
        if (isMinusInf(vRaw)) return Y_BOT;
        if (isPlusInf(vRaw)) return Y_TOP;

        // Lấy dấu đạo hàm (an toàn với null/undefined)
        // sign[i] là dấu của khoảng từ node[i] đến node[i+1]
        const incomingSign = index > 0 ? data.yPrimeSigns?.[index - 1] : null; 
        const outgoingSign = index < (data.yPrimeSigns?.length || 0) ? data.yPrimeSigns?.[index] : null;

        // 2. XỬ LÝ THEO NGỮ CẢNH
        
        // --- A. BÊN TRÁI TIỆM CẬN (Hoặc cột cuối cùng bảng) ---
        // Ta quan tâm mũi tên đi VÀO điểm này (Incoming)
        if (context === 'left_of_asymptote' || (context === 'normal' && index === data.xNodes.length - 1)) {
            if (isPos(incomingSign)) return Y_TOP; // Đang đi lên -> Kết thúc ở Đỉnh
            if (isNeg(incomingSign)) return Y_BOT; // Đang đi xuống -> Kết thúc ở Đáy
        }

        // --- B. BÊN PHẢI TIỆM CẬN (Hoặc cột đầu tiên bảng) ---
        // Ta quan tâm mũi tên đi RA KHỎI điểm này (Outgoing)
        if (context === 'right_of_asymptote' || (context === 'normal' && index === 0)) {
            if (isPos(outgoingSign)) return Y_BOT; // Sắp đi lên -> Bắt đầu ở Đáy
            if (isNeg(outgoingSign)) return Y_TOP; // Sắp đi xuống -> Bắt đầu ở Đỉnh
        }

        // --- C. ĐIỂM Ở GIỮA (Cực trị) ---
        if (context === 'normal') {
            // Cực Đại (Lên -> Xuống)
            if (isPos(incomingSign) && isNeg(outgoingSign)) return Y_TOP;
            // Cực Tiểu (Xuống -> Lên)
            if (isNeg(incomingSign) && isPos(outgoingSign)) return Y_BOT;
            
            // Trường hợp đơn điệu qua điểm (ít gặp trong bảng biến thiên chuẩn, nhưng nếu có thì để giữa)
            return Y_MID;
        }

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

                {/* --- KHUNG LƯỚI --- */}
                <line x1="0" y1={rowHeight} x2={width} y2={rowHeight} stroke="black" strokeWidth="1" />
                <line x1="0" y1={rowHeight*2} x2={width} y2={rowHeight*2} stroke="black" strokeWidth="1" />
                <line x1={startX} y1="0" x2={startX} y2={totalHeight} stroke="black" strokeWidth="1" />

                {/* HEADER */}
                <text x={startX/2} y={rowHeight/2 + 5} textAnchor="middle" className="font-bold italic text-lg font-serif">x</text>
                <text x={startX/2} y={rowHeight + rowHeight/2 + 5} textAnchor="middle" className="font-bold italic text-lg font-serif">y'</text>
                <text x={startX/2} y={rowHeight*2 + yRowHeight/2} textAnchor="middle" className="font-bold italic text-lg font-serif">y</text>

                {/* --- RENDER DATA --- */}
                {data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    
                    // Kiểm tra xem cột này có phải là Tiệm cận đứng không (||)
                    const isAsymptote = (data.yPrimeVals?.[i]?.includes('||')) || (data.yNodes[i]?.includes('||'));

                    // 1. VẼ X
                    const xDisplay = (
                        <foreignObject x={cx - 40} y={12} width={80} height={rowHeight - 12}>
                             <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                <LatexText text={cleanMath(x)} />
                             </div>
                        </foreignObject>
                    );

                    // 2. VẼ Y' VALUE (0 hoặc ||)
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
                            <foreignObject x={cx - 20} y={rowHeight + 10} width={40} height={30}>
                                 <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                    <LatexText text={cleanMath(data.yPrimeVals[i])} />
                                 </div>
                            </foreignObject>
                        );
                    }

                    // 3. VẼ DẤU Y' (+ / -)
                    let signDisplay = null;
                    if (i < data.xNodes.length - 1 && data.yPrimeSigns?.[i]) {
                        const signCx = cx + colWidth / 2;
                        const signVal = data.yPrimeSigns[i];
                         signDisplay = (
                             <foreignObject x={signCx - 20} y={rowHeight + 10} width={40} height={30}>
                                <div className="flex justify-center w-full h-full font-bold text-lg items-center text-gray-800">
                                    <LatexText text={cleanMath(signVal)} />
                                </div>
                             </foreignObject>
                         );
                    }

                    // 4. VẼ Y NODES & MŨI TÊN
                    let yDisplay = null;
                    let arrowLine = null;
                    const rawY = data.yNodes[i] || "";
                    
                    if (isAsymptote) {
                        // Tách giá trị 2 bên tiệm cận
                        const parts = rawY.split('||');
                        const leftVal = parts[0] ? parts[0].trim() : "";
                        const rightVal = parts[1] ? parts[1].trim() : "";

                        // Tính tọa độ
                        const leftY = getYPos(leftVal, i, 'left_of_asymptote');
                        const rightY = getYPos(rightVal, i, 'right_of_asymptote');

                        yDisplay = (
                            <g>
                                {/* Giá trị bên trái || */}
                                <foreignObject x={cx - 60} y={leftY - 15} width={55} height={30}>
                                    <div className={`flex justify-end w-full h-full font-bold text-sm bg-white/0 pr-1 ${leftY === Y_TOP ? 'items-start pt-1' : 'items-end pb-1'}`}>
                                        <LatexText text={cleanMath(leftVal)} />
                                    </div>
                                </foreignObject>
                                {/* Giá trị bên phải || */}
                                <foreignObject x={cx + 5} y={rightY - 15} width={55} height={30}>
                                    <div className={`flex justify-start w-full h-full font-bold text-sm bg-white/0 pl-1 ${rightY === Y_TOP ? 'items-start pt-1' : 'items-end pb-1'}`}>
                                        <LatexText text={cleanMath(rightVal)} />
                                    </div>
                                </foreignObject>
                            </g>
                        );
                    } else {
                        // Node thường
                        const yPos = getYPos(rawY, i, 'normal');
                        yDisplay = (
                             <foreignObject x={cx - 40} y={yPos - 15} width={80} height={30}>
                                 <div className={`flex justify-center w-full h-full font-bold text-sm bg-white/80 px-1 ${yPos === Y_TOP ? 'items-start' : (yPos === Y_BOT ? 'items-end' : 'items-center')}`}>
                                    <LatexText text={cleanMath(rawY)} />
                                 </div>
                            </foreignObject>
                        );
                    }

                    // --- VẼ MŨI TÊN NỐI SANG CỘT SAU ---
                    if (i < data.xNodes.length - 1) {
                        const nextCx = startX + 40 + (i+1) * colWidth;
                        const currentYRaw = data.yNodes[i] || "";
                        const nextYRaw = data.yNodes[i+1] || "";
                        
                        let x1, y1, x2, y2;

                        // TÍNH ĐIỂM XUẤT PHÁT (x1, y1)
                        if (currentYRaw.includes('||')) {
                            // Xuất phát từ bên phải tiệm cận
                            const val = currentYRaw.split('||')[1] || "";
                            y1 = getYPos(val, i, 'right_of_asymptote');
                            x1 = cx + 15;
                        } else {
                            y1 = getYPos(currentYRaw, i, 'normal');
                            x1 = cx + 20;
                        }

                        // TÍNH ĐIỂM ĐÍCH (x2, y2)
                        if (nextYRaw.includes('||')) {
                            // Đích đến là bên trái tiệm cận tiếp theo
                            const val = nextYRaw.split('||')[0] || "";
                            y2 = getYPos(val, i+1, 'left_of_asymptote');
                            x2 = nextCx - 15;
                        } else {
                            y2 = getYPos(nextYRaw, i+1, 'normal');
                            x2 = nextCx - 20;
                        }

                        // Chỉ vẽ mũi tên nếu khoảng cách ngang đủ lớn
                        if (x2 > x1) {
                            arrowLine = (
                                <line 
                                    x1={x1} y1={y1} 
                                    x2={x2} y2={y2} 
                                    stroke="black" strokeWidth="1.2" markerEnd="url(#arrowhead)" 
                                />
                            );
                        }
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