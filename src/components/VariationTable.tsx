import React from 'react';
import { VariationTableData } from '../types';
import { LatexText } from './LatexText';

interface Props {
    data: VariationTableData;
    functionType?: 'cubic' | 'quartic' | 'rational11' | 'rational21_with_extrema' | 'rational21_no_extrema';
}

export const VariationTable: React.FC<Props> = ({ data, functionType = 'cubic' }) => {
    // 1. CẤU HÌNH KÍCH THƯỚC
    const width = 640;
    const paddingRight = 48;
    const rowHeight = 48;
    const yRowHeight = 112; // Chiều cao dòng y
    const totalHeight = rowHeight * 2 + yRowHeight;
    const startX = 64;
    const usableWidth = width - startX - paddingRight;
    
    // 2. HELPER FUNCTIONS
    const cleanMath = (val: string): string => {
        if (!val) return "";
        let s = val.trim();
        // Chuẩn hóa vô cực
        if (!s.includes('\\infty') && !s.includes('\u221e')) {
            if (s.toLowerCase().includes('-inf')) s = '-\\infty';
            else if (s.toLowerCase().includes('+inf') || s.toLowerCase().includes('inf')) s = '+\\infty';
        }
        // Thêm $ nếu chưa có
        if (!s.startsWith('$')) return `$${s}$`;
        return s;
    };

    // Xác định vị trí trên/dưới dựa vào giá trị
    const getYPosForValue = (val: string): 'top' | 'bottom' => {
        const s = val.toLowerCase();
        if (s.includes('-\\infty') || s.includes('-inf')) return 'bottom';
        if (s.includes('\\infty') || s.includes('+inf')) return 'top';
        return 'top'; // Mặc định
    };

    // Render giá trị Y đơn (cho cực trị hoặc đầu mút thường)
    const renderYValue = (cx: number, yPosition: 'top' | 'middle' | 'bottom', value: string) => {
        let yPos: number;
        if (yPosition === 'top') yPos = rowHeight * 2 + 25;
        else if (yPosition === 'middle') yPos = rowHeight * 2 + yRowHeight / 2;
        else yPos = totalHeight - 25; // bottom

        return (
            <foreignObject x={cx - 40} y={yPos - 15} width={80} height={30}>
                <div className="flex justify-center w-full h-full font-bold text-sm bg-white/90 px-1 items-center z-10">
                    <LatexText text={cleanMath(value)} />
                </div>
            </foreignObject>
        );
    };

    // Render 2 giá trị giới hạn sát tiệm cận đứng (Quan trọng cho hàm phân thức)
    const renderSplitLimit = (cx: number, rawValue: string) => {
        const parts = rawValue.split('||');
        const leftVal = parts[0] || '';
        const rightVal = parts[1] || '';

        // Xác định vị trí cao thấp
        const yPosLeft = getYPosForValue(leftVal) === 'top' ? rowHeight * 2 + 25 : totalHeight - 25;
        const yPosRight = getYPosForValue(rightVal) === 'top' ? rowHeight * 2 + 25 : totalHeight - 25;

        return (
            <>
                {/* Bên trái: Căn phải (justify-end) để ép sát vạch */}
                <foreignObject x={cx - 45} y={yPosLeft - 15} width={40} height={30}>
                    <div className="flex justify-end w-full h-full font-bold text-sm items-center pr-1 bg-white/50">
                        <LatexText text={cleanMath(leftVal)} />
                    </div>
                </foreignObject>

                {/* Bên phải: Căn trái (justify-start) để ép sát vạch */}
                <foreignObject x={cx + 5} y={yPosRight - 15} width={40} height={30}>
                    <div className="flex justify-start w-full h-full font-bold text-sm items-center pl-1 bg-white/50">
                        <LatexText text={cleanMath(rightVal)} />
                    </div>
                </foreignObject>
            </>
        );
    };

    // Render mũi tên
    const renderArrow = (x1: number, y1: number, x2: number, y2: number) => (
        <line 
            x1={x1} y1={y1} 
            x2={x2} y2={y2} 
            stroke="black" strokeWidth="1.2" markerEnd="url(#arrowhead)" 
        />
    );

    // Render tiệm cận đứng (2 vạch song song)
    const renderAsymptote = (cx: number) => (
        <g>
            {/* Vẽ từ rowHeight (bắt đầu dòng y') xuống tận totalHeight (hết dòng y) */}
            <line x1={cx - 2} y1={rowHeight} x2={cx - 2} y2={totalHeight} stroke="black" strokeWidth="1" />
            <line x1={cx + 2} y1={rowHeight} x2={cx + 2} y2={totalHeight} stroke="black" strokeWidth="1" />
        </g>
    );

    // 3. MAIN RENDER LOGIC
    const renderTemplate = () => {
        const colWidth = usableWidth / (data.xNodes.length - 1);
        
        // Helper tính tọa độ Y cho đầu mũi tên dựa vào giá trị text tại node đó
        const getArrowY = (index: number, position: 'start' | 'end') => {
            // Nếu là node tiệm cận (split value)
            if (data.yNodes[index]?.includes('||')) {
                const parts = data.yNodes[index].split('||');
                // Nếu tên mũi tên xuất phát từ đây (start), dùng giá trị bên phải (rightVal)
                // Nếu mũi tên kết thúc tại đây (end), dùng giá trị bên trái (leftVal)
                const val = position === 'start' ? parts[1] : parts[0];
                return getYPosForValue(val || '') === 'top' ? rowHeight * 2 + 35 : totalHeight - 35;
            }
            // Node thường
            return getYPosForValue(data.yNodes[index] || '') === 'top' ? rowHeight * 2 + 35 : totalHeight - 35;
        };

        switch(functionType) {
            case 'cubic':
            case 'quartic':
                // Logic cũ cho hàm đa thức (giữ nguyên để không ảnh hưởng)
                return data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    const isExtremum = data.yPrimeVals?.[i] === '0' && i > 0 && i < data.xNodes.length - 1;
                    return (
                        <g key={i}>
                            <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                                <div className="flex justify-center w-full h-full font-bold text-sm items-center"><LatexText text={cleanMath(x)} /></div>
                            </foreignObject>
                            {data.yPrimeVals?.[i] && <foreignObject x={cx - 20} y={rowHeight + 15} width={40} height={30}><div className="flex justify-center w-full h-full font-bold text-sm items-center"><LatexText text={cleanMath(data.yPrimeVals[i])} /></div></foreignObject>}
                            {i < data.xNodes.length - 1 && data.yPrimeSigns?.[i] && <foreignObject x={cx + colWidth / 2 - 20} y={rowHeight + 15} width={40} height={30}><div className="flex justify-center w-full h-full font-bold text-lg items-center"><LatexText text={cleanMath(data.yPrimeSigns[i])} /></div></foreignObject>}
                            
                            {data.yNodes[i] && renderYValue(cx, isExtremum ? (data.yPrimeSigns?.[i-1] === '+' ? 'top' : 'bottom') : 'middle', data.yNodes[i])}

                            {i < data.xNodes.length - 1 && renderArrow(
                                cx + 20,
                                i===0 ? rowHeight*2 + yRowHeight/2 : (data.yPrimeSigns?.[i] === '+' ? totalHeight - 30 : rowHeight * 2 + 30),
                                cx + colWidth - 20,
                                i===data.xNodes.length-2 ? rowHeight*2 + yRowHeight/2 : (data.yPrimeSigns?.[i] === '+' ? rowHeight * 2 + 30 : totalHeight - 30)
                            )}
                        </g>
                    );
                });

            // LOGIC CHUNG CHO HÀM PHÂN THỨC (1/1 và 2/1)
            case 'rational11':
            case 'rational21_with_extrema':
            case 'rational21_no_extrema':
                return data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    const isAsymptote = data.yPrimeVals?.[i] === '||'; // Check tiệm cận
                    
                    return (
                        <g key={i}>
                            {/* 1. X Value */}
                            <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                                <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                    <LatexText text={cleanMath(x)} />
                                </div>
                            </foreignObject>

                            {/* 2. Y' Value (Nếu không phải tiệm cận) */}
                            {!isAsymptote && data.yPrimeVals?.[i] && (
                                <foreignObject x={cx - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                        <LatexText text={cleanMath(data.yPrimeVals[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* 3. Dấu Y' */}
                            {i < data.xNodes.length - 1 && data.yPrimeSigns?.[i] && (
                                <foreignObject x={cx + colWidth / 2 - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-lg items-center">
                                        <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* 4. Y Values */}
                            {!isAsymptote ? (
                                // Node thường (Đầu mút hoặc Cực trị)
                                data.yNodes[i] && renderYValue(
                                    cx,
                                    // Logic tự động check top/bottom dựa vào giá trị text
                                    getYPosForValue(data.yNodes[i]),
                                    data.yNodes[i]
                                )
                            ) : (
                                // Node tiệm cận (Split 2 bên)
                                data.yNodes[i] && renderSplitLimit(cx, data.yNodes[i])
                            )}

                            {/* 5. Arrows */}
                            {i < data.xNodes.length - 1 && !isAsymptote && (
                                renderArrow(
                                    cx + 30, // Start x (dịch ra khỏi text một chút)
                                    getArrowY(i, 'start'), // Start y
                                    cx + colWidth - 30, // End x
                                    getArrowY(i + 1, 'end') // End y (dựa vào node tiếp theo)
                                )
                            )}
                            {/* Xử lý mũi tên xuất phát từ tiệm cận (bên phải tiệm cận) */}
                            {isAsymptote && i < data.xNodes.length - 1 && (
                                renderArrow(
                                    cx + 30, // Start x (bên phải tiệm cận)
                                    getArrowY(i, 'start'), 
                                    cx + colWidth - 30, 
                                    getArrowY(i + 1, 'end')
                                )
                            )}

                            {/* 6. VẼ TIỆM CẬN SAU CÙNG (Để đè lên trên) */}
                            {isAsymptote && renderAsymptote(cx)}
                        </g>
                    );
                });

            default:
                return null;
        }
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

                {/* Render nội dung */}
                {renderTemplate()}
            </svg>
        </div>
    );
};