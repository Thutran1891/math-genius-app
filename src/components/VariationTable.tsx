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
    const yRowHeight = 90;
    const totalHeight = rowHeight * 2 + yRowHeight;
    const startX = 60;
    
    const usableWidth = width - startX - paddingRight; 
    const colWidth = usableWidth / Math.max(1, data.xNodes.length - 1); 

    const cleanMath = (val: string): string => {
        if (!val) return "";
        let s = val.trim();
        // Xử lý vô cực
        if (!s.includes('\\infty') && !s.includes('\u221e')) {
            if (s.toLowerCase().includes('-inf')) s = '-\\infty';
            else if (s.toLowerCase().includes('inf') || s.toLowerCase().includes('+inf')) s = '+\\infty';
        }
        if (!s.startsWith('$')) return `$${s}$`;
        return s;
    };

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
        <div className="w-full max-w-full overflow-x-auto border border-gray-300 rounded p-3 bg-white shadow-sm mb-4 flex justify-start">
            <svg width={width} height={totalHeight} className="select-none" style={{minWidth: width}}>
                <defs>
                    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                        <polygon points="0 0, 8 3, 0 6" fill="black" />
                    </marker>
                </defs>

                {/* Khung kẻ bảng */}
                <line x1="0" y1={rowHeight} x2={width} y2={rowHeight} stroke="black" strokeWidth="1" />
                <line x1="0" y1={rowHeight*2} x2={width} y2={rowHeight*2} stroke="black" strokeWidth="1" />
                <line x1={startX} y1="0" x2={startX} y2={totalHeight} stroke="black" strokeWidth="1" />

                {/* Tiêu đề */}
                <text x={startX/2} y={rowHeight/2 + 4} textAnchor="middle" className="font-bold italic text-base font-serif">x</text>
                <text x={startX/2} y={rowHeight + rowHeight/2 + 4} textAnchor="middle" className="font-bold italic text-base font-serif">y'</text>
                <text x={startX/2} y={rowHeight*2 + yRowHeight/2} textAnchor="middle" className="font-bold italic text-base font-serif">y</text>

                {/* Nội dung */}
                {data.xNodes.map((x, i) => {
                    const cx = startX + 30 + i * colWidth;
                    
                    // Kiểm tra xem có phải là tiệm cận đứng (||) không
                    // Logic: Nếu yPrimeVals là '||' HOẶC yNodes chứa '||'
                    const isAsymptote = data.yPrimeVals?.[i] === '||' || data.yNodes[i].includes('||');

                    // 1. Hàng X
                    const xDisplay = (
                        <foreignObject x={cx - 30} y={12} width={60} height={rowHeight - 12}>
                             <div className="flex justify-center w-full h-full font-bold text-sm">
                                <LatexText text={cleanMath(x)} />
                             </div>
                        </foreignObject>
                    );

                    // 2. Hàng Y' (Giá trị hoặc 2 gạch)
                    let yPrimeDisplay = null;
                    if (isAsymptote) {
                        // VẼ 2 GẠCH DỌC (||)
                        yPrimeDisplay = (
                            <g>
                                <line x1={cx - 2} y1={rowHeight} x2={cx - 2} y2={totalHeight} stroke="black" strokeWidth="1" />
                                <line x1={cx + 2} y1={rowHeight} x2={cx + 2} y2={totalHeight} stroke="black" strokeWidth="1" />
                            </g>
                        );
                    } else if (data.yPrimeVals?.[i]) {
                        yPrimeDisplay = (
                            <foreignObject x={cx - 15} y={rowHeight + 12} width={30} height={25}>
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
                             <foreignObject x={signCx - 15} y={rowHeight + 12} width={30} height={25}>
                                <div className="flex justify-center w-full h-full font-bold text-base">
                                    <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                </div>
                             </foreignObject>
                         );
                    }

                    // 4. Hàng Y (Xử lý tách đôi nếu là tiệm cận)
                    let yDisplay = null;
                    const rawY = data.yNodes[i];
                    
                    if (isAsymptote && rawY.includes('||')) {
                        // Tách trái phải: "+\infty||-\infty"
                        const parts = rawY.split('||');
                        const leftVal = parts[0];
                        const rightVal = parts[1] || "";
                        
                        const leftY = getYPos(leftVal);
                        const rightY = getYPos(rightVal);

                        yDisplay = (
                            <g>
                                {/* Giá trị bên trái tiệm cận */}
                                <foreignObject x={cx - 35} y={leftY - 12} width={30} height={30}>
                                    <div className="flex justify-end w-full h-full font-bold text-xs bg-white/90">
                                        <LatexText text={cleanMath(leftVal)} />
                                    </div>
                                </foreignObject>
                                {/* Giá trị bên phải tiệm cận */}
                                <foreignObject x={cx + 5} y={rightY - 12} width={30} height={30}>
                                    <div className="flex justify-start w-full h-full font-bold text-xs bg-white/90">
                                        <LatexText text={cleanMath(rightVal)} />
                                    </div>
                                </foreignObject>
                            </g>
                        );
                    } else {
                        // Giá trị thường
                        const yPos = getYPos(rawY);
                        yDisplay = (
                             <foreignObject x={cx - 30} y={yPos - 12} width={60} height={30}>
                                 <div className="flex justify-center w-full h-full font-bold text-xs bg-white/90 px-1">
                                    <LatexText text={cleanMath(rawY)} />
                                 </div>
                            </foreignObject>
                        );
                    }

                    // 5. Vẽ Mũi Tên
                    let arrowLine = null;
                    if (i < data.xNodes.length - 1) {
                        const currentYRaw = data.yNodes[i];
                        const nextYRaw = data.yNodes[i+1];
                        
                        const nextCx = startX + 30 + (i+1) * colWidth;
                        const currCx = cx;

                        // Start Point
                        let y1; 
                        let x1 = currCx + 20;
                        if (currentYRaw.includes('||')) {
                            const rightVal = currentYRaw.split('||')[1];
                            y1 = getYPos(rightVal);
                            x1 = currCx + 10; 
                        } else {
                            y1 = getYPos(currentYRaw);
                        }

                        // End Point
                        let y2;
                        let x2 = nextCx - 20;
                        if (nextYRaw.includes('||')) {
                            const leftVal = nextYRaw.split('||')[0];
                            y2 = getYPos(leftVal);
                            x2 = nextCx - 10; 
                        } else {
                            y2 = getYPos(nextYRaw);
                        }

                        // Logic: Không vẽ nếu xuyên qua tiệm cận đứng (đã được xử lý bởi logic || ở trên)
                        // Chỉ cần vẽ nối tiếp
                        arrowLine = (
                            <line 
                                x1={x1} y1={y1} 
                                x2={x2} y2={y2} 
                                stroke="black" strokeWidth="1" markerEnd="url(#arrowhead)" 
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