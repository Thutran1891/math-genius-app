import React from 'react';
import { VariationTableData } from '../types';
import { LatexText } from './LatexText';

interface Props {
    data: VariationTableData;
}

export const VariationTable: React.FC<Props> = ({ data }) => {
    // 1. CẤU HÌNH KÍCH THƯỚC (Thu nhỏ lại để không che đáp án)
    const width = 700;          
    const paddingRight = 40;    
    const rowHeight = 45;       // Giảm chiều cao hàng
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

    // Hàm xác định vị trí Y chuẩn
    const getYPos = (val: string) => {
        const yTop = rowHeight * 2 + 20; 
        const yBot = totalHeight - 20;   
        const yMid = rowHeight * 2 + yRowHeight / 2;

        const v = val.toLowerCase();
        if (v.includes('-\\infty') || v.includes('-inf')) return yBot;
        if (v.includes('+\\infty') || v.includes('+inf') || (v.includes('inf') && !v.includes('-'))) return yTop;
        
        return yMid; 
    };

    return (
        <div className="w-full max-w-full overflow-x-auto border border-gray-300 rounded p-2 bg-white shadow-sm mb-4 flex justify-start">
            <svg width={width} height={totalHeight} className="select-none" style={{minWidth: width}}>
                <defs>
                    {/* Định nghĩa mũi tên màu đen */}
                    <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                        <polygon points="0 0, 6 2, 0 4" fill="black" />
                    </marker>
                </defs>

                {/* Khung kẻ bảng */}
                <line x1="0" y1={rowHeight} x2={width} y2={rowHeight} stroke="black" strokeWidth="1" />
                <line x1="0" y1={rowHeight*2} x2={width} y2={rowHeight*2} stroke="black" strokeWidth="1" />
                <line x1={startX} y1="0" x2={startX} y2={totalHeight} stroke="black" strokeWidth="1" />

                {/* Tiêu đề */}
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

                    // 4. Hàng Y & Mũi tên
                    let yDisplay = null;
                    const rawY = data.yNodes[i];
                    
                    // Tách giá trị (để vẽ)
                    let valLeft = rawY, valRight = rawY;
                    if (isAsymptote && rawY.includes('||')) {
                        [valLeft, valRight] = rawY.split('||');
                        // Vẽ hiển thị tách đôi
                        yDisplay = (
                            <g>
                                <foreignObject x={cx - 40} y={getYPos(valLeft) - 10} width={35} height={25}>
                                    <div className="flex justify-end w-full h-full font-bold text-xs bg-white/80 pr-1">
                                        <LatexText text={cleanMath(valLeft)} />
                                    </div>
                                </foreignObject>
                                <foreignObject x={cx + 5} y={getYPos(valRight) - 10} width={35} height={25}>
                                    <div className="flex justify-start w-full h-full font-bold text-xs bg-white/80 pl-1">
                                        <LatexText text={cleanMath(valRight)} />
                                    </div>
                                </foreignObject>
                            </g>
                        );
                    } else {
                        yDisplay = (
                             <foreignObject x={cx - 30} y={getYPos(rawY) - 10} width={60} height={25}>
                                 <div className="flex justify-center w-full h-full font-bold text-xs bg-white/90 px-1">
                                    <LatexText text={cleanMath(rawY)} />
                                 </div>
                            </foreignObject>
                        );
                    }

                    // --- LOGIC VẼ MŨI TÊN QUAN TRỌNG ---
                    let arrowLine = null;
                    if (i < data.xNodes.length - 1) {
                        const nextRawY = data.yNodes[i+1];
                        const nextCx = startX + 30 + (i+1) * colWidth;
                        
                        // Xác định điểm đầu (Start)
                        let x1 = cx + 20; // Mặc định xuất phát từ giữa ô
                        let y1 = getYPos(valRight); // Lấy giá trị bên phải của ô hiện tại (nếu là tiệm cận)

                        if (isAsymptote) x1 = cx + 10; // Nếu là tiệm cận, xuất phát sát vạch

                        // Xác định điểm cuối (End)
                        let x2 = nextCx - 20; // Mặc định kết thúc giữa ô sau
                        // Nếu ô sau là tiệm cận, lấy giá trị bên trái của nó
                        let nextValTarget = nextRawY;
                        if (data.yPrimeVals?.[i+1] === '||' || nextRawY.includes('||')) {
                            nextValTarget = nextRawY.split('||')[0];
                            x2 = nextCx - 10; // Kết thúc sát vạch
                        }
                        let y2 = getYPos(nextValTarget);

                        // Chỉ vẽ mũi tên nếu không bị chặn bởi tiệm cận ở giữa (trường hợp đặc biệt)
                        // Logic: Luôn vẽ nối tiếp từ (i) sang (i+1)
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
                            {arrowLine} {/* Vẽ mũi tên trước để chữ đè lên nếu cần */}
                            {yDisplay}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};