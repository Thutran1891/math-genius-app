import React from 'react';
import { VariationTableData } from '../types';
import { LatexText } from './LatexText';

interface Props {
    data: VariationTableData;
}

export const VariationTable: React.FC<Props> = ({ data }) => {
    // 1. GIẢM KÍCH THƯỚC (Nhỏ gọn hơn để hiện đáp án)
    const width = 600;          
    const paddingRight = 40;    
    const rowHeight = 40;       // Giảm chiều cao hàng tiêu đề
    const yRowHeight = 100;     // Giảm chiều cao phần vẽ đồ thị
    const totalHeight = rowHeight * 2 + yRowHeight;
    const startX = 60;          

    const usableWidth = width - startX - paddingRight; 
    const colWidth = usableWidth / Math.max(1, data.xNodes.length - 1); 

    const cleanMath = (val: string): string => {
        if (!val) return "";
        let s = val.trim();
        if (!s.includes('\\infty') && !s.includes('\u221e')) {
            if (s.toLowerCase().includes('-inf')) s = '-\\infty';
            else if (s.toLowerCase().includes('inf') || s.toLowerCase().includes('+inf')) s = '+\\infty';
        }
        if (!s.startsWith('$')) return `$${s}$`;
        return s;
    };

    // Hàm xác định vị trí Y chuẩn (Cao/Thấp/Giữa)
    const getYPos = (val: string) => {
        const yTop = rowHeight * 2 + 20; // Cao nhất
        const yBot = totalHeight - 20;   // Thấp nhất
        const yMid = rowHeight * 2 + yRowHeight / 2; // Giữa

        const v = val.toLowerCase();
        // Logic vô cực
        if (v.includes('-\\infty') || v.includes('-inf')) return yBot;
        if (v.includes('+\\infty') || v.includes('+inf') || (v.includes('inf') && !v.includes('-'))) return yTop;
        
        return yMid; 
    };

    return (
        <div className="w-full max-w-full overflow-x-auto border border-gray-300 rounded p-2 bg-white shadow-sm mb-4 flex justify-start">
            <svg width={width} height={totalHeight} className="select-none" style={{minWidth: width}}>
                <defs>
                    <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                        <polygon points="0 0, 6 2, 0 4" fill="black" />
                    </marker>
                </defs>

                {/* Khung kẻ bảng */}
                <line x1="0" y1={rowHeight} x2={width} y2={rowHeight} stroke="black" strokeWidth="1" />
                <line x1="0" y1={rowHeight*2} x2={width} y2={rowHeight*2} stroke="black" strokeWidth="1" />
                <line x1={startX} y1="0" x2={startX} y2={totalHeight} stroke="black" strokeWidth="1" />

                {/* Tiêu đề (Giảm font size) */}
                <text x={startX/2} y={rowHeight/2 + 4} textAnchor="middle" className="font-bold italic text-sm font-serif">x</text>
                <text x={startX/2} y={rowHeight + rowHeight/2 + 4} textAnchor="middle" className="font-bold italic text-sm font-serif">y'</text>
                <text x={startX/2} y={rowHeight*2 + yRowHeight/2} textAnchor="middle" className="font-bold italic text-sm font-serif">y</text>

                {/* Nội dung */}
                {data.xNodes.map((x, i) => {
                    const cx = startX + 30 + i * colWidth;
                    const isAsymptote = data.yPrimeVals?.[i] === '||' || data.yNodes[i].includes('||');

                    // 1. Hàng X
                    const xDisplay = (
                        <foreignObject x={cx - 30} y={10} width={60} height={rowHeight - 10}>
                             <div className="flex justify-center w-full h-full font-bold text-xs">
                                <LatexText text={cleanMath(x)} />
                             </div>
                        </foreignObject>
                    );

                    // 2. Hàng Y' (Giá trị hoặc ||)
                    let yPrimeDisplay = null;
                    if (isAsymptote) {
                        // Kẻ 2 vạch dọc
                        yPrimeDisplay = (
                            <g>
                                <line x1={cx - 2} y1={rowHeight} x2={cx - 2} y2={totalHeight} stroke="black" strokeWidth="1" />
                                <line x1={cx + 2} y1={rowHeight} x2={cx + 2} y2={totalHeight} stroke="black" strokeWidth="1" />
                            </g>
                        );
                    } else if (data.yPrimeVals?.[i]) {
                        yPrimeDisplay = (
                            <foreignObject x={cx - 15} y={rowHeight + 10} width={30} height={25}>
                                 <div className="flex justify-center w-full h-full font-bold text-xs">
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
                             <foreignObject x={signCx - 15} y={rowHeight + 10} width={30} height={25}>
                                <div className="flex justify-center w-full h-full font-bold text-sm">
                                    <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                </div>
                             </foreignObject>
                         );
                    }

                    // 4. Hàng Y (Xử lý tách đôi tại tiệm cận)
                    let yDisplay = null;
                    const rawY = data.yNodes[i];
                    
                    if (isAsymptote && rawY.includes('||')) {
                        // Tách giá trị 2 bên tiệm cận: "+\infty||-\infty"
                        const [leftVal, rightVal] = rawY.split('||');
                        
                        // Tính vị trí Y riêng biệt
                        const leftY = getYPos(leftVal);
                        const rightY = getYPos(rightVal);

                        yDisplay = (
                            <g>
                                {/* Giá trị bên TRÁI tiệm cận (Sát vạch trái) */}
                                <foreignObject x={cx - 40} y={leftY - 10} width={35} height={25}>
                                    <div className="flex justify-end w-full h-full font-bold text-xs bg-white/80 pr-1">
                                        <LatexText text={cleanMath(leftVal)} />
                                    </div>
                                </foreignObject>
                                {/* Giá trị bên PHẢI tiệm cận (Sát vạch phải) */}
                                <foreignObject x={cx + 5} y={rightY - 10} width={35} height={25}>
                                    <div className="flex justify-start w-full h-full font-bold text-xs bg-white/80 pl-1">
                                        <LatexText text={cleanMath(rightVal)} />
                                    </div>
                                </foreignObject>
                            </g>
                        );
                    } else {
                        const yPos = getYPos(rawY);
                        yDisplay = (
                             <foreignObject x={cx - 30} y={yPos - 10} width={60} height={25}>
                                 <div className="flex justify-center w-full h-full font-bold text-xs bg-white/90 px-1">
                                    <LatexText text={cleanMath(rawY)} />
                                 </div>
                            </foreignObject>
                        );
                    }

                    // 5. VẼ MŨI TÊN (Logic Nâng Cao)
                    let arrowLine = null;
                    if (i < data.xNodes.length - 1) {
                        const currentYRaw = data.yNodes[i];
                        const nextYRaw = data.yNodes[i+1];
                        const nextCx = startX + 30 + (i+1) * colWidth;
                        
                        // --- TÍNH ĐIỂM ĐẦU (x1, y1) ---
                        let x1, y1;
                        if (currentYRaw.includes('||')) {
                            // Nếu i là tiệm cận -> Mũi tên xuất phát từ GIÁ TRỊ BÊN PHẢI
                            const rightVal = currentYRaw.split('||')[1];
                            y1 = getYPos(rightVal);
                            x1 = cx + 10; // Xuất phát ngay sát vạch phải
                        } else {
                            y1 = getYPos(currentYRaw);
                            x1 = cx + 25; // Xuất phát từ giữa ô
                        }

                        // --- TÍNH ĐIỂM CUỐI (x2, y2) ---
                        let x2, y2;
                        if (nextYRaw.includes('||')) {
                            // Nếu i+1 là tiệm cận -> Mũi tên kết thúc ở GIÁ TRỊ BÊN TRÁI
                            const leftVal = nextYRaw.split('||')[0];
                            y2 = getYPos(leftVal);
                            x2 = nextCx - 10; // Kết thúc ngay sát vạch trái
                        } else {
                            y2 = getYPos(nextYRaw);
                            x2 = nextCx - 25; // Kết thúc ở giữa ô
                        }

                        // --- VẼ ---
                        // Chỉ vẽ nếu không bị chặn bởi '||' ở giữa khoảng (logic này đã được xử lý ở tách cột)
                        // Nhưng cần kiểm tra kỹ lại trường hợp đặc biệt
                        const isCurrentBlocked = data.yPrimeVals?.[i] === '||';
                        const isNextBlocked = data.yPrimeVals?.[i+1] === '||';

                        // Luôn vẽ nối tiếp, trừ khi chính điểm đó là tiệm cận (đã xử lý tách điểm)
                        // Mũi tên: Luôn đi từ (x1, y1) -> (x2, y2)
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