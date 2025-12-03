import React from 'react';
import { VariationTableData } from '../types';
import { LatexText } from './LatexText';

interface Props {
    data: VariationTableData;
}

export const VariationTable: React.FC<Props> = ({ data }) => {
    // 1. CẤU HÌNH KÍCH THƯỚC (Rộng rãi để không bị cắt)
    const width = 800;
    const paddingRight = 60;
    const rowHeight = 60;
    const yRowHeight = 120; // Chiều cao dòng Y lớn để mũi tên dốc rõ ràng
    const totalHeight = rowHeight * 2 + yRowHeight;
    const startX = 80; 
    
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

    // --- THUẬT TOÁN TÍNH VỊ TRÍ Y (Theo logic của bạn) ---
    const getYPos = (val: string, index: number, isLeftOfAsymptote: boolean = false, isRightOfAsymptote: boolean = false) => {
        const yTop = rowHeight * 2 + 25;     // Vị trí CAO
        const yBot = totalHeight - 25;       // Vị trí THẤP
        const yMid = rowHeight * 2 + yRowHeight / 2; // Vị trí GIỮA

        const v = val.toLowerCase();
        // 1. Ưu tiên Vô cực
        if (v.includes('-\\infty') || v.includes('-inf')) return yBot;
        if (v.includes('+\\infty') || v.includes('+inf') || (v.includes('inf') && !v.includes('-'))) return yTop;

        // 2. Xử lý số hữu hạn dựa vào dấu đạo hàm
        // Lấy dấu bên trái và bên phải của điểm hiện tại
        // Lưu ý: Mảng yPrimeSigns có độ dài = xNodes.length - 1
        
        let leftSign = index > 0 ? data.yPrimeSigns?.[index - 1] : null;
        let rightSign = index < (data.yPrimeSigns?.length || 0) ? data.yPrimeSigns?.[index] : null;

        // Xử lý đặc biệt cho Tiệm Cận (khi tách đôi giá trị)
        if (isLeftOfAsymptote) rightSign = null; // Nếu đang xét bên trái tiệm cận, bỏ qua dấu bên phải
        if (isRightOfAsymptote) leftSign = null; // Nếu đang xét bên phải tiệm cận, bỏ qua dấu bên trái

        // LOGIC SUY LUẬN:
        
        // Trường hợp A: Cực trị (Giữa bảng)
        if (leftSign === '+' && rightSign === '-') return yTop; // Cực đại
        if (leftSign === '-' && rightSign === '+') return yBot; // Cực tiểu

        // Trường hợp B: Mép trái ngoài cùng (hoặc bên phải tiệm cận)
        if (!leftSign && rightSign) {
            if (rightSign === '+') return yBot; // Đồng biến đi lên -> Bắt đầu từ thấp
            if (rightSign === '-') return yTop; // Nghịch biến đi xuống -> Bắt đầu từ cao
        }

        // Trường hợp C: Mép phải ngoài cùng (hoặc bên trái tiệm cận)
        if (leftSign && !rightSign) {
            if (leftSign === '+') return yTop; // Đồng biến đi lên -> Kết thúc ở cao
            if (leftSign === '-') return yBot; // Nghịch biến đi xuống -> Kết thúc ở thấp
        }
        
        // Trường hợp D: Điểm uốn hoặc đơn điệu qua điểm (VD: y' = 0 nhưng không đổi dấu)
        // + 0 + -> Đi từ dưới lên trên
        if (leftSign === '+' && rightSign === '+') return yMid; 
        if (leftSign === '-' && rightSign === '-') return yMid;

        return yMid; // Mặc định
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

                {/* Tiêu đề */}
                <text x={startX/2} y={rowHeight/2 + 5} textAnchor="middle" className="font-bold italic text-lg font-serif">x</text>
                <text x={startX/2} y={rowHeight + rowHeight/2 + 5} textAnchor="middle" className="font-bold italic text-lg font-serif">y'</text>
                <text x={startX/2} y={rowHeight*2 + yRowHeight/2} textAnchor="middle" className="font-bold italic text-lg font-serif">y</text>

                {/* Nội dung */}
                {data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    const isAsymptote = data.yPrimeVals?.[i] === '||' || data.yNodes[i].includes('||');

                    // 1. Hàng X
                    const xDisplay = (
                        <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                             <div className="flex justify-center w-full h-full font-bold text-sm">
                                <LatexText text={cleanMath(x)} />
                             </div>
                        </foreignObject>
                    );

                    // 2. Hàng Y' (Giá trị hoặc ||)
                    let yPrimeDisplay = null;
                    if (isAsymptote) {
                        // Vẽ 2 gạch dọc (||)
                        yPrimeDisplay = (
                            <g>
                                <line x1={cx - 3} y1={rowHeight} x2={cx - 3} y2={totalHeight} stroke="black" strokeWidth="1" />
                                <line x1={cx + 3} y1={rowHeight} x2={cx + 3} y2={totalHeight} stroke="black" strokeWidth="1" />
                            </g>
                        );
                    } else if (data.yPrimeVals?.[i]) {
                        yPrimeDisplay = (
                            <foreignObject x={cx - 20} y={rowHeight + 15} width={40} height={30}>
                                 <div className="flex justify-center w-full h-full font-bold text-sm">
                                    <LatexText text={cleanMath(data.yPrimeVals[i])} />
                                 </div>
                            </foreignObject>
                        );
                    }

                    // 3. Dấu Y'
                    let signDisplay = null;
                    if (i < data.xNodes.length - 1 && data.yPrimeSigns?.[i]) {
                        const signCx = cx + colWidth / 2;
                         signDisplay = (
                             <foreignObject x={signCx - 20} y={rowHeight + 15} width={40} height={30}>
                                <div className="flex justify-center w-full h-full font-bold text-lg">
                                    <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                </div>
                             </foreignObject>
                         );
                    }

                    // 4. Hàng Y (Giá trị + Mũi tên)
                    let yDisplay = null;
                    const rawY = data.yNodes[i];
                    
                    if (isAsymptote && rawY.includes('||')) {
                        // --- TRƯỜNG HỢP TIỆM CẬN: TÁCH ĐÔI ---
                        const parts = rawY.split('||');
                        const leftVal = parts[0];
                        const rightVal = parts[1] || "";
                        
                        // Tính vị trí riêng biệt: Trái coi như mép phải của khoảng trước, Phải coi như mép trái của khoảng sau
                        const leftY = getYPos(leftVal, i, true, false);
                        const rightY = getYPos(rightVal, i, false, true);

                        yDisplay = (
                            <g>
                                <foreignObject x={cx - 45} y={leftY - 15} width={40} height={30}>
                                    <div className="flex justify-end w-full h-full font-bold text-sm bg-white/80">
                                        <LatexText text={cleanMath(leftVal)} />
                                    </div>
                                </foreignObject>
                                <foreignObject x={cx + 5} y={rightY - 15} width={40} height={30}>
                                    <div className="flex justify-start w-full h-full font-bold text-sm bg-white/80">
                                        <LatexText text={cleanMath(rightVal)} />
                                    </div>
                                </foreignObject>
                            </g>
                        );
                    } else {
                        // --- TRƯỜNG HỢP THƯỜNG ---
                        const yPos = getYPos(rawY, i);
                        yDisplay = (
                             <foreignObject x={cx - 40} y={yPos - 15} width={80} height={30}>
                                 <div className="flex justify-center w-full h-full font-bold text-sm bg-white/90 px-1">
                                    <LatexText text={cleanMath(rawY)} />
                                 </div>
                            </foreignObject>
                        );
                    }

                    // 5. Vẽ Mũi Tên nối sang cột sau
                    let arrowLine = null;
                    if (i < data.xNodes.length - 1) {
                        const currentYRaw = data.yNodes[i];
                        const nextYRaw = data.yNodes[i+1];
                        const nextCx = startX + 40 + (i+1) * colWidth;
                        
                        // Tính điểm đầu (x1, y1)
                        let y1; 
                        let x1 = cx + 20;
                        if (currentYRaw.includes('||')) {
                            // Nếu điểm hiện tại là tiệm cận -> Lấy giá trị bên phải
                            const rightVal = currentYRaw.split('||')[1];
                            y1 = getYPos(rightVal, i, false, true);
                            x1 = cx + 10; 
                        } else {
                            y1 = getYPos(currentYRaw, i);
                        }

                        // Tính điểm cuối (x2, y2)
                        let y2;
                        let x2 = nextCx - 20;
                        if (nextYRaw.includes('||')) {
                            // Nếu điểm đích là tiệm cận -> Lấy giá trị bên trái
                            const leftVal = nextYRaw.split('||')[0];
                            y2 = getYPos(leftVal, i+1, true, false);
                            x2 = nextCx - 10;
                        } else {
                            y2 = getYPos(nextYRaw, i+1);
                        }

                        // Chỉ vẽ nếu không bị chặn bởi tiệm cận ở giữa (yPrimeVals)
                        if (data.yPrimeVals?.[i] !== '||' && data.yPrimeVals?.[i+1] !== '||') {
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