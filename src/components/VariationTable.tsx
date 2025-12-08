import React from 'react';
import { VariationTableData } from '../types';
import { LatexText } from './LatexText';

interface Props {
    data: VariationTableData;
}

export const VariationTable: React.FC<Props> = ({ data }) => {
    // 1. CẤU HÌNH KÍCH THƯỚC KHUNG
    const width = 640;
    const rowHeight = 48;       // Chiều cao dòng x và y'
    const yRowHeight = 100;     // Chiều cao dòng y (Tăng lên để mũi tên dốc hơn)
    const totalHeight = rowHeight * 2 + yRowHeight;
    const startX = 64;          // Lề trái cho tiêu đề

    const usableWidth = width - startX - 48; // Trừ padding phải
    const colWidth = usableWidth / Math.max(1, data.xNodes.length - 1);

    // 2. ĐỊNH NGHĨA TỌA ĐỘ Y (Visual Levels)
    // Lưu ý trong SVG: y càng nhỏ càng ở trên cao
    const Y_TOP = rowHeight * 2 + 20;            // Vị trí cao nhất (Cực đại, +Vc)
    const Y_BOT = totalHeight - 20;              // Vị trí thấp nhất (Cực tiểu, -Vc)
    const Y_MID = rowHeight * 2 + yRowHeight / 2; // Vị trí giữa (Dùng cho điểm uốn ngang nếu cần)

    // --- HELPER FUNCTIONS ---
    
    // [FIX LỖI] Cập nhật type để chấp nhận cả null
    const isPos = (val: string | null | undefined) => !!val && val.trim() === '+';
    const isNeg = (val: string | null | undefined) => !!val && ['-', '−', '–', '—', '\u2212'].includes(val.trim());

    // Hàm check vô cực
    const isPlusInf = (val: string) => {
        const v = val.toLowerCase();
        return v.includes('+inf') || (v.includes('inf') && !v.includes('-')) || v === '+\\infty';
    };
    const isMinusInf = (val: string) => {
        const v = val.toLowerCase();
        return v.includes('-inf') || v === '-\\infty';
    };

    // Làm sạch chuỗi LaTeX để hiển thị đẹp
    const cleanMath = (val: string): string => {
        if (!val) return "";
        let s = val.trim();
        // Chuẩn hóa vô cực để hiển thị
        if (!s.includes('\\infty') && !s.includes('\u221e')) {
            if (s.toLowerCase().includes('-inf')) s = '-\\infty';
            else if (isPlusInf(s)) s = '+\\infty';
        }
        if (!s.startsWith('$')) return `$${s}$`;
        return s;
    };

    /**
     * --- CORE LOGIC: XÁC ĐỊNH ĐỘ CAO (Y) ---
     * Dựa trên yêu cầu của bạn: Vị trí phụ thuộc vào xu hướng tăng/giảm (dấu đạo hàm)
     * @param val : Giá trị hiển thị
     * @param index : Chỉ số cột (x)
     * @param context : Ngữ cảnh ('normal', 'left_of_asymptote', 'right_of_asymptote')
     */
    const getYPos = (val: string, index: number, context: 'normal' | 'left_of_asymptote' | 'right_of_asymptote' = 'normal') => {
        const vRaw = val ? val.toLowerCase() : "";

        // 1. ƯU TIÊN VÔ CỰC (Tuyệt đối)
        if (isMinusInf(vRaw)) return Y_BOT;
        if (isPlusInf(vRaw)) return Y_TOP;

        // Lấy dấu đạo hàm bên trái và bên phải nút hiện tại
        // Sử dụng toán tử ?. và fallback về undefined để tránh lỗi truy cập mảng
        const leftSign = index > 0 ? data.yPrimeSigns?.[index - 1] : undefined;
        const rightSign = index < (data.yPrimeSigns?.length || 0) ? data.yPrimeSigns?.[index] : undefined;

        // 2. XỬ LÝ THEO NGỮ CẢNH VỊ TRÍ
        
        // CASE A: Mép phải của Tiệm cận Đứng HOẶC Đầu bảng
        // -> Nhìn dấu bên PHẢI (rightSign) để quyết định xuất phát
        if (context === 'right_of_asymptote' || (index === 0 && context === 'normal')) {
            if (isPos(rightSign)) return Y_BOT; // Mũi tên đi lên -> Bắt đầu từ đáy
            if (isNeg(rightSign)) return Y_TOP; // Mũi tên đi xuống -> Bắt đầu từ đỉnh
        }

        // CASE B: Mép trái của Tiệm cận Đứng HOẶC Cuối bảng
        // -> Nhìn dấu bên TRÁI (leftSign) để quyết định đích đến
        if (context === 'left_of_asymptote' || (index === data.xNodes.length - 1 && context === 'normal')) {
            if (isPos(leftSign)) return Y_TOP;  // Đã đi lên -> Kết thúc ở đỉnh
            if (isNeg(leftSign)) return Y_BOT;  // Đã đi xuống -> Kết thúc ở đáy
        }

        // CASE C: Điểm Cực Trị (Ở giữa)
        if (context === 'normal') {
            // Cực Đại (Lên -> Xuống): + rồi -
            if (isPos(leftSign) && isNeg(rightSign)) return Y_TOP;
            
            // Cực Tiểu (Xuống -> Lên): - rồi +
            if (isNeg(leftSign) && isPos(rightSign)) return Y_BOT;
            
            // Điểm uốn / Đơn điệu (Lên -> Lên hoặc Xuống -> Xuống)
            // Trường hợp này đặt ở giữa để mũi tên đi qua nó
            if (isPos(leftSign) && isPos(rightSign)) return Y_MID;
            if (isNeg(leftSign) && isNeg(rightSign)) return Y_MID;
        }

        // Fallback mặc định
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

                {/* --- KHUNG BẢNG --- */}
                {/* Đường ngang phân cách */}
                <line x1="0" y1={rowHeight} x2={width} y2={rowHeight} stroke="black" strokeWidth="1" />
                <line x1="0" y1={rowHeight*2} x2={width} y2={rowHeight*2} stroke="black" strokeWidth="1" />
                {/* Đường dọc ngăn tiêu đề */}
                <line x1={startX} y1="0" x2={startX} y2={totalHeight} stroke="black" strokeWidth="1" />

                {/* Tiêu đề cột */}
                <text x={startX/2} y={rowHeight/2 + 5} textAnchor="middle" className="font-bold italic text-lg font-serif">x</text>
                <text x={startX/2} y={rowHeight + rowHeight/2 + 5} textAnchor="middle" className="font-bold italic text-lg font-serif">y'</text>
                <text x={startX/2} y={rowHeight*2 + yRowHeight/2} textAnchor="middle" className="font-bold italic text-lg font-serif">y</text>

                {/* --- RENDER DỮ LIỆU --- */}
                {data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    
                    // Check Tiệm cận đứng (dựa vào ký hiệu '||' ở dòng y' hoặc y)
                    // Đôi khi AI trả về '||' ở yNodes, đôi khi ở yPrimeVals
                    const isAsymptote = (data.yPrimeVals?.[i] && data.yPrimeVals[i].includes('||')) || 
                                      (data.yNodes[i] && data.yNodes[i].includes('||'));

                    // 1. VẼ DÒNG X
                    const xDisplay = (
                        <foreignObject x={cx - 40} y={12} width={80} height={rowHeight - 12}>
                             <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                <LatexText text={cleanMath(x)} />
                             </div>
                        </foreignObject>
                    );

                    // 2. VẼ DÒNG Y' (Giá trị 0 hoặc ||)
                    let yPrimeDisplay = null;
                    if (isAsymptote) {
                        // Vẽ 2 gạch sọc xuyên suốt từ dòng y' xuống hết bảng
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

                    // 3. VẼ DẤU Y' (+ hoặc -)
                    let signDisplay = null;
                    if (i < data.xNodes.length - 1 && data.yPrimeSigns?.[i]) {
                        const signCx = cx + colWidth / 2;
                        // Chỉ vẽ dấu nếu không bị vướng vào tiệm cận (thường thì tiệm cận nằm tại node, dấu nằm giữa node)
                         signDisplay = (
                             <foreignObject x={signCx - 20} y={rowHeight + 10} width={40} height={30}>
                                <div className="flex justify-center w-full h-full font-bold text-lg items-center text-gray-800">
                                    <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                </div>
                             </foreignObject>
                         );
                    }

                    // 4. VẼ DÒNG Y VÀ MŨI TÊN
                    let yDisplay = null;
                    let arrowLine = null;
                    const rawY = data.yNodes[i] || "";
                    
                    // --- TÍNH TOÁN TỌA ĐỘ Y CHO NODE HIỆN TẠI ---
                    if (isAsymptote) {
                        // Nếu là tiệm cận: Tách giá trị bên trái và bên phải ||
                        const parts = rawY.split('||');
                        const leftVal = parts[0] ? parts[0].trim() : "";
                        const rightVal = parts[1] ? parts[1].trim() : "";

                        // Tính tọa độ riêng cho mỗi bên dựa trên context
                        const leftY = getYPos(leftVal, i, 'left_of_asymptote');
                        const rightY = getYPos(rightVal, i, 'right_of_asymptote');

                        yDisplay = (
                            <g>
                                {/* Giá trị bên trái tiệm cận */}
                                <foreignObject x={cx - 55} y={leftY - 15} width={48} height={30}>
                                    <div className={`flex justify-end w-full h-full font-bold text-sm bg-white/0 items-center pr-1 ${leftY === Y_TOP ? 'items-start pt-1' : 'items-end pb-1'}`}>
                                        <LatexText text={cleanMath(leftVal)} />
                                    </div>
                                </foreignObject>
                                {/* Giá trị bên phải tiệm cận */}
                                <foreignObject x={cx + 7} y={rightY - 15} width={48} height={30}>
                                    <div className={`flex justify-start w-full h-full font-bold text-sm bg-white/0 items-center pl-1 ${rightY === Y_TOP ? 'items-start pt-1' : 'items-end pb-1'}`}>
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

                    // --- VẼ MŨI TÊN (Nối từ cột hiện tại i sang cột i+1) ---
                    if (i < data.xNodes.length - 1) {
                        let x1, y1, x2, y2;
                        const currentYRaw = data.yNodes[i] || "";
                        const nextYRaw = data.yNodes[i+1] || "";
                        const nextCx = startX + 40 + (i+1) * colWidth;

                        // TÍNH ĐIỂM ĐẦU (x1, y1)
                        if (currentYRaw.includes('||')) {
                            // Xuất phát từ vách PHẢI của tiệm cận tại cột i
                            const rightVal = currentYRaw.split('||')[1] || "";
                            y1 = getYPos(rightVal, i, 'right_of_asymptote'); 
                            x1 = cx + 15; // Dịch sang phải tiệm cận một chút
                        } else {
                            // Xuất phát từ node thường tại cột i
                            y1 = getYPos(currentYRaw, i, 'normal');
                            x1 = cx + 20; 
                        }

                        // TÍNH ĐIỂM CUỐI (x2, y2)
                        if (nextYRaw.includes('||')) {
                            // Đích đến là vách TRÁI của tiệm cận tại cột i+1
                            const leftVal = nextYRaw.split('||')[0] || "";
                            y2 = getYPos(leftVal, i+1, 'left_of_asymptote');
                            x2 = nextCx - 15; // Dịch sang trái tiệm cận một chút
                        } else {
                            // Đích đến là node thường tại cột i+1
                            y2 = getYPos(nextYRaw, i+1, 'normal');
                            x2 = nextCx - 20;
                        }

                        // Chỉ vẽ nếu toạ độ hợp lệ (Tránh vẽ đường thẳng đứng hoặc đè lên nhau quá mức)
                        if (Math.abs(x2 - x1) > 5) {
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