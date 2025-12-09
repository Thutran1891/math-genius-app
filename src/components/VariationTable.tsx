import React from 'react';
import { VariationTableData } from '../types';
import { LatexText } from './LatexText';

interface Props {
    data: VariationTableData;
}

export const VariationTable: React.FC<Props> = ({ data }) => {
    // 1. CẤU HÌNH KÍCH THƯỚC (SCALE 80%)
    const width = 640;          // 800 * 0.8
    const paddingRight = 48;    // 60 * 0.8
    const rowHeight = 48;       // 60 * 0.8
    const yRowHeight = 112;     // 140 * 0.8
    const totalHeight = rowHeight * 2 + yRowHeight;
    const startX = 64;          // 80 * 0.8

    // Tính toán độ rộng cột
    const usableWidth = width - startX - paddingRight; 
    const colWidth = usableWidth / Math.max(1, data.xNodes.length - 1);

    // Hàm làm sạch và chuẩn hóa LaTeX
    const cleanMath = (val: string): string => {
        if (!val) return "";
        let s = val.trim();
        // Chuẩn hóa các ký hiệu vô cực
        if (!s.includes('\\infty') && !s.includes('\u221e')) {
            if (s.toLowerCase().includes('-inf')) s = '-\\infty';
            else if (s.toLowerCase().includes('+inf') || s.toLowerCase().includes('inf')) s = '+\\infty';
        }
        // Thêm dấu $ nếu chưa có (để LatexText render đúng)
        if (!s.startsWith('$')) return `$${s}$`;
        return s;
    };

    // --- CHUẨN BỊ: TÌM CHỈ SỐ TIỆM CẬN ĐỂ CHỈ VẼ 1 ĐƯỜNG Ở CHỈ SỐ "CHÍNH GIỮA" ---
    // Tập hợp các index mà dữ liệu đánh dấu là tiệm cận (||)
    const asymIndices: number[] = [];
    for (let i = 0; i < data.xNodes.length; i++) {
        const flag = data.yPrimeVals?.[i] === '||' || (data.yNodes[i] && data.yNodes[i].includes('||'));
        if (flag) asymIndices.push(i);
    }
    // Nếu có nhiều hơn 1, chọn index nằm ở giữa mảng asymIndices (giữa các tiệm cận)
    const asymIndexToDraw = asymIndices.length ? asymIndices[Math.floor(asymIndices.length / 2)] : null;

    // --- THUẬT TOÁN TÍNH VỊ TRÍ Y ---
    const getYPos = (val: string, index: number, isLeftOfAsymptote: boolean = false, isRightOfAsymptote: boolean = false) => {
        const yTop = rowHeight * 2 + 20;       // Sát mép trên
        const yBot = totalHeight - 20;         // Sát mép dưới
        const yMid = rowHeight * 2 + yRowHeight / 2;

        // Chuẩn hóa string để so sánh
        const v = val ? val.toLowerCase().replace(/\$|\\/g, '') : ""; 

        // 1. Ưu tiên TUYỆT ĐỐI cho Vô cực (Bất kể dấu y')
        // Check "infty", "inf", "∞"
        if (v.includes('infty') || v.includes('inf') || v.includes('\u221e')) {
            if (v.includes('-')) return yBot; // Âm vô cực -> Đáy
            return yTop;                      // Dương vô cực -> Đỉnh
        }

        // 2. Logic cho số hữu hạn dựa vào đạo hàm
        let leftSign = index > 0 ? data.yPrimeSigns?.[index - 1] : null;
        let rightSign = index < (data.yPrimeSigns?.length || 0) ? data.yPrimeSigns?.[index] : null;

        // Nếu là điểm nằm sát tiệm cận, ta bỏ qua phía bên kia của tiệm cận
        if (isLeftOfAsymptote) rightSign = null; 
        if (isRightOfAsymptote) leftSign = null;

        // A. Cực Trị (Có dấu 2 bên)
        if (leftSign && rightSign) {
            if (leftSign === '+' && rightSign === '-') return yTop; // Cực đại
            if (leftSign === '-' && rightSign === '+') return yBot; // Cực tiểu
            return yMid;
        }

        // B. Mép Trái (hoặc bên Phải tiệm cận) - Bắt đầu mũi tên
        if (!leftSign && rightSign) {
            if (rightSign === '+') return yBot; // Đồng biến đi lên -> Bắt đầu Thấp
            if (rightSign === '-') return yTop; // Nghịch biến đi xuống -> Bắt đầu Cao
        }

        // C. Mép Phải (hoặc bên Trái tiệm cận) - Kết thúc mũi tên
        if (leftSign && !rightSign) {
            if (leftSign === '+') return yTop; // Đồng biến đi lên -> Kết thúc Cao
            if (leftSign === '-') return yBot; // Nghịch biến đi xuống -> Kết thúc Thấp
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

                {/* Khung kẻ bảng */}
                <line x1="0" y1={rowHeight} x2={width} y2={rowHeight} stroke="black" strokeWidth="1" />
                <line x1="0" y1={rowHeight*2} x2={width} y2={rowHeight*2} stroke="black" strokeWidth="1" />
                <line x1={startX} y1="0" x2={startX} y2={totalHeight} stroke="black" strokeWidth="1" />

                {/* Tiêu đề cột */}
                <text x={startX/2} y={rowHeight/2 + 5} textAnchor="middle" className="font-bold italic text-lg font-serif">x</text>
                <text x={startX/2} y={rowHeight + rowHeight/2 + 5} textAnchor="middle" className="font-bold italic text-lg font-serif">y'</text>
                <text x={startX/2} y={rowHeight*2 + yRowHeight/2} textAnchor="middle" className="font-bold italic text-lg font-serif">y</text>

                {/* Render Data Loops */}
                {data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    
                    // Kiểm tra Tiệm cận đứng: Dựa vào yPrimeVals='||' HOẶC yNodes chứa '||'
                    const isAsymptoteFlag = data.yPrimeVals?.[i] === '||' || (data.yNodes[i] && data.yNodes[i].includes('||'));
                    // chỉ vẽ TIỆM CẬN duy nhất tại asymIndexToDraw
                    const isAsymptoteDrawn = isAsymptoteFlag && asymIndexToDraw !== null && i === asymIndexToDraw;

                    // 1. Render X Values
                    const xDisplay = (
                        <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                             <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                <LatexText text={cleanMath(x)} />
                             </div>
                        </foreignObject>
                    );

                    // 2. Render Y' Values (Dấu || hoặc số 0)
                    let yPrimeDisplay = null;
                    if (isAsymptoteDrawn) {
                        // Vẽ 1 đường tiệm cận đứng duy nhất ở giữa cột (đường mảnh)
                        yPrimeDisplay = (
                            <g>
                                <line x1={cx} y1={rowHeight} x2={cx} y2={totalHeight} stroke="black" strokeWidth="1" />
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

                    // 3. Render Dấu Y' (+ hoặc -)
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

                    // 4. Render Y Values (Xử lý tách đôi nếu là tiệm cận)
                    let yDisplay = null;
                    const rawY = data.yNodes[i] || "";
                    
                    if (isAsymptoteFlag) {
                        // Tách giá trị trái/phải tiệm cận
                        // Ví dụ rawY = "$+\infty$||$-\infty$"
                        const parts = rawY.split('||');
                        const leftVal = parts[0] ? parts[0].trim() : "";
                        const rightVal = parts[1] ? parts[1].trim() : "";

                        const leftY = getYPos(leftVal, i, true, false);
                        const rightY = getYPos(rightVal, i, false, true);

                        // ĐIỀU CHỈNH vị trí hiển thị: đặt sát mép tiệm cận hơn
                        yDisplay = (
                            <g>
                                {/* Giá trị bên TRÁI tiệm cận: đặt ngay sát trái cột tiệm cận */}
                                <foreignObject x={cx - 48} y={leftY - 15} width={46} height={30}>
                                    <div className="flex justify-end w-full h-full font-bold text-sm bg-white/0 items-center pr-2">
                                        <LatexText text={cleanMath(leftVal)} />
                                    </div>
                                </foreignObject>
                                {/* Giá trị bên PHẢI tiệm cận: đặt sát mép phải tiệm cận (gần hơn so với trước) */}
                                <foreignObject x={cx + 2} y={rightY - 15} width={46} height={30}>
                                    <div className="flex justify-start w-full h-full font-bold text-sm bg-white/0 items-center pl-2">
                                        <LatexText text={cleanMath(rightVal)} />
                                    </div>
                                </foreignObject>
                            </g>
                        );
                    } else {
                        // Giá trị thường
                        const yPos = getYPos(rawY, i);
                        yDisplay = (
                             <foreignObject x={cx - 40} y={yPos - 15} width={80} height={30}>
                                 <div className="flex justify-center w-full h-full font-bold text-sm bg-white/90 px-1 items-center">
                                    <LatexText text={cleanMath(rawY)} />
                                 </div>
                            </foreignObject>
                        );
                    }

                    // 5. Render Mũi Tên (Arrow)
                    // Logic mới: Luôn vẽ nối sang cột sau, tự động tránh tiệm cận
                    let arrowLine = null;
                    if (i < data.xNodes.length - 1) {
                        let x1, y1, x2, y2;
                        const currentYRaw = data.yNodes[i] || "";
                        const nextYRaw = data.yNodes[i+1] || "";
                        const nextCx = startX + 40 + (i+1) * colWidth;

                        // --- TÍNH ĐIỂM ĐẦU (x1, y1) ---
                        if (currentYRaw.includes('||')) {
                            // Nếu xuất phát từ Tiệm Cận -> Lấy nhánh PHẢI
                            const rightVal = currentYRaw.split('||')[1] || "";
                            y1 = getYPos(rightVal, i, false, true);
                            // Dịch ra khỏi vạch tiệm cận 1 khoảng nhỏ (điều chỉnh nhỏ từ +15 -> +8)
                            x1 = cx + 8;
                        } else {
                            // Xuất phát thường
                            y1 = getYPos(currentYRaw, i);
                            x1 = cx + 20; 
                        }

                        // --- TÍNH ĐIỂM ĐÍCH (x2, y2) ---
                        if (nextYRaw.includes('||')) {
                            // Nếu đích đến là Tiệm Cận -> Lấy nhánh TRÁI
                            const leftVal = nextYRaw.split('||')[0] || "";
                            y2 = getYPos(leftVal, i+1, true, false);
                            // Dừng trước vạch tiệm cận một khoảng nhỏ (điều chỉnh nhỏ từ -15 -> -8)
                            x2 = nextCx - 8;
                        } else {
                            // Đích đến thường
                            y2 = getYPos(nextYRaw, i+1);
                            x2 = nextCx - 20;
                        }

                        // Vẽ mũi tên (Không còn điều kiện chặn if yPrimeVals === || nữa)
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
