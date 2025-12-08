import React from 'react';
import { VariationTableData } from '../types';
import { LatexText } from './LatexText';

interface Props {
    data: VariationTableData;
}

export const VariationTable: React.FC<Props> = ({ data }) => {
    // 1. CẤU HÌNH KÍCH THƯỚC (Giữ nguyên tỉ lệ hiển thị tốt)
    const width = 640;
    const paddingRight = 48;
    const rowHeight = 48;
    const yRowHeight = 112;
    const totalHeight = rowHeight * 2 + yRowHeight;
    const startX = 64;

    const usableWidth = width - startX - paddingRight;
    const colWidth = usableWidth / Math.max(1, data.xNodes.length - 1);

    // --- 2. HÀM XỬ LÝ CHUỖI MẠNH MẼ HƠN ---
    
    // Làm sạch LaTeX và ký tự lạ
    const cleanMath = (val: string): string => {
        if (!val) return "";
        let s = val.trim();
        // Chuẩn hóa vô cực
        if (!s.includes('\\infty') && !s.includes('\u221e')) {
            if (s.toLowerCase().includes('-inf')) s = '-\\infty';
            else if (s.toLowerCase().includes('+inf') || s.toLowerCase().includes('inf')) s = '+\\infty';
        }
        // Đóng gói LaTeX nếu cần
        if (!s.startsWith('$')) return `$${s}$`;
        return s;
    };

    // Kiểm tra dấu: Bắt tất cả các loại dấu trừ (hyphen, en-dash, minus sign...)
    const isNeg = (val: string | null | undefined): boolean => {
        if (!val) return false;
        const s = val.trim();
        return ['-', '−', '–', '—', '\u2212'].includes(s); 
    };

    const isPos = (val: string | null | undefined): boolean => {
        if (!val) return false;
        return val.trim() === '+';
    };

    // --- 3. THUẬT TOÁN TÍNH VỊ TRÍ Y (Đã sửa lỗi logic) ---
    const getYPos = (val: string, index: number, isLeftOfAsymptote: boolean = false, isRightOfAsymptote: boolean = false) => {
        const yTop = rowHeight * 2 + 25;       // Vị trí CAO NHẤT
        const yBot = totalHeight - 25;         // Vị trí THẤP NHẤT
        const yMid = rowHeight * 2 + yRowHeight / 2; // Vị trí GIỮA

        const v = val ? val.toLowerCase().replace(/\$|\\/g, '') : "";

        // A. Ưu tiên TUYỆT ĐỐI cho giá trị Vô cực hiển thị trong ô Y
        if (v.includes('infty') || v.includes('inf') || v.includes('\u221e')) {
            if (v.includes('-') || isNeg(val)) return yBot; 
            return yTop;
        }

        // B. Logic suy luận khi KHÔNG có giá trị Y cụ thể (ví dụ tại tiệm cận)
        // Lấy dấu đạo hàm bên trái và bên phải điểm đang xét
        let leftSign = index > 0 ? data.yPrimeSigns?.[index - 1] : null;
        let rightSign = index < (data.yPrimeSigns?.length || 0) ? data.yPrimeSigns?.[index] : null;

        // Nếu đang đứng cạnh tiệm cận, bỏ qua phía bên kia tiệm cận
        if (isLeftOfAsymptote) rightSign = null; 
        if (isRightOfAsymptote) leftSign = null;

        // CASE 1: ĐIỂM BẮT ĐẦU CỦA MŨI TÊN (Sau tiệm cận hoặc biên trái)
        // Logic: Chỉ quan tâm dấu đạo hàm của khoảng TIẾP THEO (rightSign)
        if (!leftSign && rightSign) {
            if (isPos(rightSign)) return yBot; // Đồng biến (+) -> Bắt đầu THẤP để đi lên
            if (isNeg(rightSign)) return yTop; // Nghịch biến (-) -> Bắt đầu CAO để đi xuống
        }

        // CASE 2: ĐIỂM KẾT THÚC CỦA MŨI TÊN (Trước tiệm cận hoặc biên phải)
        // Logic: Chỉ quan tâm dấu đạo hàm của khoảng TRƯỚC ĐÓ (leftSign)
        if (leftSign && !rightSign) {
            if (isPos(leftSign)) return yTop; // Đồng biến (+) -> Kết thúc CAO
            if (isNeg(leftSign)) return yBot; // Nghịch biến (-) -> Kết thúc THẤP
        }

        // CASE 3: CỰC TRỊ (Giao điểm giữa 2 khoảng)
        if (isPos(leftSign) && isNeg(rightSign)) return yTop; // Cực đại
        if (isNeg(leftSign) && isPos(rightSign)) return yBot; // Cực tiểu

        // Mặc định trả về giữa nếu không suy luận được
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

                {/* Vòng lặp Render từng cột */}
                {data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    
                    // Kiểm tra xem tại x[i] có phải là tiệm cận đứng không (dựa vào || ở dòng y' hoặc y)
                    const isAsymptote = data.yPrimeVals?.[i]?.includes('||') || (data.yNodes[i] && data.yNodes[i].includes('||'));

                    // 1. Render X Value
                    const xDisplay = (
                        <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                             <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                <LatexText text={cleanMath(x)} />
                             </div>
                        </foreignObject>
                    );

                    // 2. Render Y' Value (số 0 hoặc ||)
                    let yPrimeDisplay = null;
                    if (isAsymptote) {
                        // Vẽ 2 đường sọc đứng xuyên suốt
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

                    // 3. Render Dấu Y' (+ hoặc -) nằm giữa các cột
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

                    // 4. Render Giá trị Y và Mũi tên
                    let yDisplay = null;
                    let arrowLine = null;
                    const rawY = data.yNodes[i] || "";
                    
                    // --- A. Render Text Giá trị Y ---
                    if (isAsymptote) {
                        const parts = rawY.split('||');
                        const leftVal = parts[0] ? parts[0].trim() : "";
                        const rightVal = parts[1] ? parts[1].trim() : "";

                        // Tính vị trí text dựa trên logic tiệm cận
                        const leftY = getYPos(leftVal, i, true, false);
                        const rightY = getYPos(rightVal, i, false, true);

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

                    // --- B. Tính toán và Vẽ Mũi tên ---
                    if (i < data.xNodes.length - 1) {
                        let x1, y1, x2, y2;
                        const currentYRaw = data.yNodes[i] || "";
                        const nextYRaw = data.yNodes[i+1] || "";
                        const nextCx = startX + 40 + (i+1) * colWidth;

                        // TÍNH ĐIỂM ĐẦU (x1, y1)
                        if (currentYRaw.includes('||')) {
                            const rightVal = currentYRaw.split('||')[1] || "";
                            // Quan trọng: Truyền isRightOfAsymptote = true để ép logic xét dấu phải
                            y1 = getYPos(rightVal, i, false, true);
                            x1 = cx + 15; 
                        } else {
                            y1 = getYPos(currentYRaw, i);
                            x1 = cx + 20; 
                        }

                        // TÍNH ĐIỂM CUỐI (x2, y2)
                        if (nextYRaw.includes('||')) {
                            const leftVal = nextYRaw.split('||')[0] || "";
                            // Quan trọng: Truyền isLeftOfAsymptote = true để ép logic xét dấu trái
                            y2 = getYPos(leftVal, i+1, true, false);
                            x2 = nextCx - 15;
                        } else {
                            y2 = getYPos(nextYRaw, i+1);
                            x2 = nextCx - 20;
                        }

                        // Vẽ đường nối
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