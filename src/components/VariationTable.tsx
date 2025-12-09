import React from 'react';
import { VariationTableData } from '../types';
import { LatexText } from './LatexText';

interface Props {
    data: VariationTableData;
    functionType?: 'cubic' | 'quartic' | 'rational11' | 'rational21_with_extrema' | 'rational21_no_extrema';
}

export const VariationTable: React.FC<Props> = ({ data, functionType = 'cubic' }) => {
    // 1. CẤU HÌNH KÍCH THƯỚC (SCALE 80%)
    const width = 640;
    const paddingRight = 48;
    const rowHeight = 48;
    const yRowHeight = 112;
    const totalHeight = rowHeight * 2 + yRowHeight;
    const startX = 64;
    const usableWidth = width - startX - paddingRight;
    
    // Hàm làm sạch và chuẩn hóa LaTeX
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

    // Helper: Xác định vị trí Y (Top/Bottom) dựa trên giá trị text
    const getYPosForValue = (val: string): 'top' | 'bottom' => {
        const s = val.toLowerCase();
        // Nếu là âm vô cực hoặc số âm lớn (tùy logic) -> Bottom
        // Ở đây ưu tiên check dấu trừ của vô cực
        if (s.includes('-\\infty') || s.includes('-inf')) return 'bottom';
        // Nếu là dương vô cực -> Top
        if (s.includes('\\infty') || s.includes('+inf')) return 'top';
        
        // Mặc định cho số thường: Tùy ngữ cảnh, nhưng hàm này chủ yếu dùng cho Limit
        return 'top'; 
    };

    // Hàm render giá trị Y tại vị trí Y cố định (Dùng cho các điểm cực trị hoặc đầu mút)
    const renderYValue = (cx: number, yPosition: 'top' | 'middle' | 'bottom' | number, value: string) => {
        let yPos: number;
        if (yPosition === 'top') yPos = rowHeight * 2 + 20;
        else if (yPosition === 'middle') yPos = rowHeight * 2 + yRowHeight / 2;
        else if (yPosition === 'bottom') yPos = totalHeight - 20;
        else yPos = yPosition;

        return (
            <foreignObject x={cx - 40} y={yPos - 15} width={80} height={30}>
                <div className="flex justify-center w-full h-full font-bold text-sm bg-white/90 px-1 items-center z-10">
                    <LatexText text={cleanMath(value)} />
                </div>
            </foreignObject>
        );
    };

    // Xử lý hiển thị giới hạn sát hai bên tiệm cận (NEW)
    const renderSplitLimit = (cx: number, rawValue: string) => {
        const parts = rawValue.split('||');
        const leftVal = parts[0] || '';
        const rightVal = parts[1] || '';

        const yPosLeft = getYPosForValue(leftVal) === 'top' ? rowHeight * 2 + 20 : totalHeight - 20;
        const yPosRight = getYPosForValue(rightVal) === 'top' ? rowHeight * 2 + 20 : totalHeight - 20;

        return (
            <>
                {/* Bên trái: Align Right, sát vạch */}
                <foreignObject x={cx - 50} y={yPosLeft - 15} width={45} height={30}>
                    <div className="flex justify-end w-full h-full font-bold text-sm items-center pr-1">
                        <LatexText text={cleanMath(leftVal)} />
                    </div>
                </foreignObject>

                {/* Bên phải: Align Left, sát vạch */}
                <foreignObject x={cx + 5} y={yPosRight - 15} width={45} height={30}>
                    <div className="flex justify-start w-full h-full font-bold text-sm items-center pl-1">
                        <LatexText text={cleanMath(rightVal)} />
                    </div>
                </foreignObject>
            </>
        );
    };

    // Hàm render mũi tên
    const renderArrow = (x1: number, y1: number, x2: number, y2: number) => (
        <line 
            x1={x1} y1={y1} 
            x2={x2} y2={y2} 
            stroke="black" strokeWidth="1.2" markerEnd="url(#arrowhead)" 
        />
    );

    // Hàm render tiệm cận đứng (Đảm bảo vẽ xuyên suốt)
    const renderAsymptote = (cx: number) => (
        <g>
            <line x1={cx - 3} y1={rowHeight} x2={cx - 3} y2={totalHeight} stroke="black" strokeWidth="1" />
            <line x1={cx + 3} y1={rowHeight} x2={cx + 3} y2={totalHeight} stroke="black" strokeWidth="1" />
        </g>
    );

    // RENDER TEMPLATE CHO TỪNG LOẠI HÀM
    const renderTemplate = () => {
        const colWidth = usableWidth / (data.xNodes.length - 1);
        
        switch(functionType) {
            // 1. HÀM BẬC 3
            case 'cubic':
                return data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    const isExtremum = data.yPrimeVals?.[i] === '0' && i > 0 && i < data.xNodes.length - 1;
                    
                    return (
                        <g key={i}>
                            <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                                <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                    <LatexText text={cleanMath(x)} />
                                </div>
                            </foreignObject>

                            {data.yPrimeVals?.[i] && (
                                <foreignObject x={cx - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                        <LatexText text={cleanMath(data.yPrimeVals[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {i < data.xNodes.length - 1 && data.yPrimeSigns?.[i] && (
                                <foreignObject x={cx + colWidth / 2 - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-lg items-center">
                                        <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {data.yNodes[i] && renderYValue(
                                cx,
                                isExtremum ? 
                                    (data.yPrimeSigns?.[i-1] === '+' && data.yPrimeSigns?.[i] === '-') ? 'top' : 'bottom'
                                    : 'middle',
                                data.yNodes[i]
                            )}

                            {i < data.xNodes.length - 1 && renderArrow(
                                cx + 20,
                                i === 0 ? rowHeight * 2 + yRowHeight / 2 :
                                data.yPrimeSigns?.[i] === '+' ? totalHeight - 30 : rowHeight * 2 + 30,
                                cx + colWidth - 20,
                                i === data.xNodes.length - 2 ? rowHeight * 2 + yRowHeight / 2 :
                                data.yPrimeSigns?.[i] === '+' ? rowHeight * 2 + 30 : totalHeight - 30
                            )}
                        </g>
                    );
                });

            // 2. HÀM BẬC 4
            case 'quartic':
                return data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    const isExtremum = data.yPrimeVals?.[i] === '0' && i > 0 && i < data.xNodes.length - 1;
                    
                    return (
                        <g key={i}>
                            <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                                <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                    <LatexText text={cleanMath(x)} />
                                </div>
                            </foreignObject>

                            {data.yPrimeVals?.[i] && (
                                <foreignObject x={cx - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                        <LatexText text={cleanMath(data.yPrimeVals[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {i < data.xNodes.length - 1 && data.yPrimeSigns?.[i] && (
                                <foreignObject x={cx + colWidth / 2 - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-lg items-center">
                                        <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {data.yNodes[i] && renderYValue(
                                cx,
                                isExtremum ? (i === 1 || i === data.xNodes.length - 2) ? 'bottom' : 'top' : 'middle',
                                data.yNodes[i]
                            )}

                            {i < data.xNodes.length - 1 && renderArrow(
                                cx + 20,
                                i === 0 ? rowHeight * 2 + yRowHeight / 2 :
                                data.yPrimeSigns?.[i] === '+' ? totalHeight - 30 : rowHeight * 2 + 30,
                                cx + colWidth - 20,
                                i === data.xNodes.length - 2 ? rowHeight * 2 + yRowHeight / 2 :
                                data.yPrimeSigns?.[i] === '+' ? rowHeight * 2 + 30 : totalHeight - 30
                            )}
                        </g>
                    );
                });

            // 3. HÀM BẬC 1/1 (LOGIC ĐÃ SỬA)
            case 'rational11':
                return data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    const isAsymptote = data.yPrimeVals?.[i] === '||';
                    
                    return (
                        <g key={i}>
                            <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                                <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                    <LatexText text={cleanMath(x)} />
                                </div>
                            </foreignObject>

                            {/* Render y' val */}
                            {!isAsymptote && data.yPrimeVals?.[i] && (
                                <foreignObject x={cx - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                        <LatexText text={cleanMath(data.yPrimeVals[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* Dấu y' */}
                            {i < data.xNodes.length - 1 && data.yPrimeSigns?.[i] && (
                                <foreignObject x={cx + colWidth / 2 - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-lg items-center">
                                        <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* Y value (Non-asymptote) */}
                            {data.yNodes[i] && !isAsymptote && renderYValue(
                                cx,
                                'middle', // Đầu mút hàm 1/1 thường ở giữa cho đẹp hoặc tùy chỉnh top/bottom nếu cần
                                data.yNodes[i]
                            )}

                            {/* Y value (Asymptote - Split) - SÁT TIỆM CẬN */}
                            {isAsymptote && data.yNodes[i] && renderSplitLimit(cx, data.yNodes[i])}

                            {/* Arrow */}
                            {i < data.xNodes.length - 1 && !isAsymptote && renderArrow(
                                cx + 20,
                                i === 0 ? rowHeight * 2 + yRowHeight / 2 :
                                data.yPrimeSigns?.[i] === '+' ? totalHeight - 30 : rowHeight * 2 + 30,
                                cx + colWidth - 20,
                                i === data.xNodes.length - 2 ? rowHeight * 2 + yRowHeight / 2 :
                                data.yPrimeSigns?.[i] === '+' ? rowHeight * 2 + 30 : totalHeight - 30
                            )}

                            {/* VẼ TIỆM CẬN SAU CÙNG ĐỂ ĐÈ LÊN MỌI THỨ */}
                            {isAsymptote && renderAsymptote(cx)}
                        </g>
                    );
                });

            // 4. HÀM BẬC 2/1 CÓ CỰC TRỊ (LOGIC ĐÃ SỬA)
            case 'rational21_with_extrema':
                return data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    const isAsymptote = data.yPrimeVals?.[i] === '||';
                    const isExtremum = data.yPrimeVals?.[i] === '0' && i > 0 && i < data.xNodes.length - 1;
                    
                    return (
                        <g key={i}>
                            <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                                <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                    <LatexText text={cleanMath(x)} />
                                </div>
                            </foreignObject>

                            {!isAsymptote && data.yPrimeVals?.[i] && (
                                <foreignObject x={cx - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                        <LatexText text={cleanMath(data.yPrimeVals[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {i < data.xNodes.length - 1 && data.yPrimeSigns?.[i] && (
                                <foreignObject x={cx + colWidth / 2 - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-lg items-center">
                                        <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* Y Nodes: Xử lý Extremum và Đầu mút */}
                            {data.yNodes[i] && !isAsymptote && renderYValue(
                                cx,
                                isExtremum ? (i === 1 ? 'top' : 'bottom') : // i=1 là CĐ (Top), i=3 là CT (Bottom)
                                (data.yNodes[i].includes('-') ? 'bottom' : 'top'), // Đầu mút vô cực
                                data.yNodes[i]
                            )}

                            {/* Y Nodes: Tiệm cận */}
                            {isAsymptote && data.yNodes[i] && renderSplitLimit(cx, data.yNodes[i])}

                            {/* Arrows */}
                            {i < data.xNodes.length - 1 && !isAsymptote && renderArrow(
                                cx + 20,
                                i === 0 ? (data.yNodes[0]?.includes('+') ? rowHeight * 2 + 20 : totalHeight - 20) :
                                data.yPrimeSigns?.[i] === '+' ? totalHeight - 30 : rowHeight * 2 + 30,
                                cx + colWidth - 20,
                                i === data.xNodes.length - 2 ? (data.yNodes[data.xNodes.length - 1]?.includes('+') ? rowHeight * 2 + 20 : totalHeight - 20) :
                                data.yPrimeSigns?.[i] === '+' ? rowHeight * 2 + 30 : totalHeight - 30
                            )}

                            {/* Render Tiệm cận sau cùng */}
                            {isAsymptote && renderAsymptote(cx)}
                        </g>
                    );
                });

            // 5. HÀM BẬC 2/1 KHÔNG CÓ CỰC TRỊ (LOGIC ĐÃ SỬA)
            case 'rational21_no_extrema':
                return data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    const isAsymptote = data.yPrimeVals?.[i] === '||';
                    
                    return (
                        <g key={i}>
                            <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                                <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                    <LatexText text={cleanMath(x)} />
                                </div>
                            </foreignObject>

                            {!isAsymptote && data.yPrimeVals?.[i] && (
                                <foreignObject x={cx - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                        <LatexText text={cleanMath(data.yPrimeVals[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {i < data.xNodes.length - 1 && data.yPrimeSigns?.[i] && (
                                <foreignObject x={cx + colWidth / 2 - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-lg items-center">
                                        <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {data.yNodes[i] && !isAsymptote && renderYValue(
                                cx,
                                data.yNodes[i].includes('+') ? 'top' : 'bottom',
                                data.yNodes[i]
                            )}

                            {isAsymptote && data.yNodes[i] && renderSplitLimit(cx, data.yNodes[i])}

                            {i < data.xNodes.length - 1 && !isAsymptote && renderArrow(
                                cx + 20,
                                i === 0 ? (data.yNodes[0]?.includes('+') ? rowHeight * 2 + 20 : totalHeight - 20) :
                                data.yPrimeSigns?.[i] === '+' ? totalHeight - 30 : rowHeight * 2 + 30,
                                cx + colWidth - 20,
                                i === data.xNodes.length - 2 ? (data.yNodes[data.xNodes.length - 1]?.includes('+') ? rowHeight * 2 + 20 : totalHeight - 20) :
                                data.yPrimeSigns?.[i] === '+' ? rowHeight * 2 + 30 : totalHeight - 30
                            )}

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

                {/* Render template */}
                {renderTemplate()}
            </svg>
        </div>
    );
};