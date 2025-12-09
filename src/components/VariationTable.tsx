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

    // Hàm render giá trị Y tại vị trí Y cố định
    const renderYValue = (cx: number, yPosition: 'top' | 'middle' | 'bottom' | number, value: string) => {
        let yPos: number;
        if (yPosition === 'top') yPos = rowHeight * 2 + 20;
        else if (yPosition === 'middle') yPos = rowHeight * 2 + yRowHeight / 2;
        else if (yPosition === 'bottom') yPos = totalHeight - 20;
        else yPos = yPosition;

        return (
            <foreignObject x={cx - 40} y={yPos - 15} width={80} height={30}>
                <div className="flex justify-center w-full h-full font-bold text-sm bg-white/90 px-1 items-center">
                    <LatexText text={cleanMath(value)} />
                </div>
            </foreignObject>
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

    // Hàm render tiệm cận đứng
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
            // 1. HÀM BẬC 3 CÓ 2 CỰC TRỊ
            case 'cubic':
                return data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    const isExtremum = data.yPrimeVals?.[i] === '0' && i > 0 && i < data.xNodes.length - 1;
                    
                    return (
                        <g key={i}>
                            {/* X value */}
                            <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                                <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                    <LatexText text={cleanMath(x)} />
                                </div>
                            </foreignObject>

                            {/* Y' value */}
                            {data.yPrimeVals?.[i] && (
                                <foreignObject x={cx - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                        <LatexText text={cleanMath(data.yPrimeVals[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* Y' sign */}
                            {i < data.xNodes.length - 1 && data.yPrimeSigns?.[i] && (
                                <foreignObject x={cx + colWidth / 2 - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-lg items-center">
                                        <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* Y value */}
                            {data.yNodes[i] && renderYValue(
                                cx,
                                isExtremum ? 
                                    (data.yPrimeSigns?.[i-1] === '+' && data.yPrimeSigns?.[i] === '-') ? 'top' : 'bottom'
                                    : i === 0 || i === data.xNodes.length - 1 ? 'middle' : 'middle',
                                data.yNodes[i]
                            )}

                            {/* Arrow */}
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

            // 2. HÀM BẬC 4 CÓ 3 CỰC TRỊ
            case 'quartic':
                return data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    const isExtremum = data.yPrimeVals?.[i] === '0' && i > 0 && i < data.xNodes.length - 1;
                    
                    return (
                        <g key={i}>
                            {/* X value */}
                            <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                                <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                    <LatexText text={cleanMath(x)} />
                                </div>
                            </foreignObject>

                            {/* Y' value */}
                            {data.yPrimeVals?.[i] && (
                                <foreignObject x={cx - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                        <LatexText text={cleanMath(data.yPrimeVals[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* Y' sign */}
                            {i < data.xNodes.length - 1 && data.yPrimeSigns?.[i] && (
                                <foreignObject x={cx + colWidth / 2 - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-lg items-center">
                                        <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* Y value */}
                            {data.yNodes[i] && renderYValue(
                                cx,
                                isExtremum ? 
                                    (i === 1 || i === data.xNodes.length - 2) ? 'bottom' : 'top' // Cực đại ở vị trí 1 và 3
                                    : i === 0 || i === data.xNodes.length - 1 ? 'middle' : 'middle',
                                data.yNodes[i]
                            )}

                            {/* Arrow */}
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

            // 3. HÀM BẬC 1/1
            case 'rational11':
                return data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    const isAsymptote = data.yPrimeVals?.[i] === '||';
                    
                    return (
                        <g key={i}>
                            {/* X value */}
                            <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                                <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                    <LatexText text={cleanMath(x)} />
                                </div>
                            </foreignObject>

                            {/* Y' value hoặc tiệm cận */}
                            {isAsymptote ? renderAsymptote(cx) : data.yPrimeVals?.[i] && (
                                <foreignObject x={cx - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                        <LatexText text={cleanMath(data.yPrimeVals[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* Y' sign */}
                            {i < data.xNodes.length - 1 && data.yPrimeSigns?.[i] && (
                                <foreignObject x={cx + colWidth / 2 - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-lg items-center">
                                        <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* Y value */}
                            {data.yNodes[i] && !isAsymptote && renderYValue(
                                cx,
                                i === 0 || i === data.xNodes.length - 1 ? 'middle' : 'middle',
                                data.yNodes[i]
                            )}

                            {/* Vô cực bên trái/phải tiệm cận */}
                            {isAsymptote && data.yNodes[i] && data.yNodes[i].includes('||') && (
                                <>
                                    {/* Vô cực bên trái tiệm cận */}
                                    <foreignObject x={cx - 35} y={rowHeight * 2 + 20} width={30} height={30}>
                                        <div className="flex justify-end w-full h-full font-bold text-sm items-center pr-1">
                                            <LatexText text={cleanMath(data.yNodes[i].split('||')[0] || '')} />
                                        </div>
                                    </foreignObject>
                                    
                                    {/* Vô cực bên phải tiệm cận */}
                                    <foreignObject x={cx + 8} y={totalHeight - 20} width={30} height={30}>
                                        <div className="flex justify-start w-full h-full font-bold text-sm items-center pl-1">
                                            <LatexText text={cleanMath(data.yNodes[i].split('||')[1] || '')} />
                                        </div>
                                    </foreignObject>
                                </>
                            )}

                            {/* Arrow */}
                            {i < data.xNodes.length - 1 && !isAsymptote && renderArrow(
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

            // 4. HÀM BẬC 2/1 CÓ 2 CỰC TRỊ
            case 'rational21_with_extrema':
                return data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    const isAsymptote = data.yPrimeVals?.[i] === '||';
                    const isExtremum = data.yPrimeVals?.[i] === '0' && i > 0 && i < data.xNodes.length - 1;
                    
                    return (
                        <g key={i}>
                            {/* X value */}
                            <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                                <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                    <LatexText text={cleanMath(x)} />
                                </div>
                            </foreignObject>

                            {/* Y' value hoặc tiệm cận */}
                            {isAsymptote ? renderAsymptote(cx) : data.yPrimeVals?.[i] && (
                                <foreignObject x={cx - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                        <LatexText text={cleanMath(data.yPrimeVals[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* Y' sign */}
                            {i < data.xNodes.length - 1 && data.yPrimeSigns?.[i] && (
                                <foreignObject x={cx + colWidth / 2 - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-lg items-center">
                                        <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* Y value - vô cực ở đầu/cuối bảng */}
                            {data.yNodes[i] && !isAsymptote && renderYValue(
                                cx,
                                isExtremum ? (i === 1 ? 'top' : 'bottom') : // Cực đại ở vị trí 1, cực tiểu ở vị trí 3
                                i === 0 || i === data.xNodes.length - 1 ? 
                                    (data.yNodes[i].includes('+') ? 'top' : 'bottom') : 'middle',
                                data.yNodes[i]
                            )}

                            {/* Vô cực bên trái/phải tiệm cận */}
                            {isAsymptote && data.yNodes[i] && data.yNodes[i].includes('||') && (
                                <>
                                    {/* Vô cực bên trái tiệm cận */}
                                    <foreignObject x={cx - 35} y={rowHeight * 2 + 20} width={30} height={30}>
                                        <div className="flex justify-end w-full h-full font-bold text-sm items-center pr-1">
                                            <LatexText text={cleanMath(data.yNodes[i].split('||')[0] || '')} />
                                        </div>
                                    </foreignObject>
                                    
                                    {/* Vô cực bên phải tiệm cận */}
                                    <foreignObject x={cx + 8} y={totalHeight - 20} width={30} height={30}>
                                        <div className="flex justify-start w-full h-full font-bold text-sm items-center pl-1">
                                            <LatexText text={cleanMath(data.yNodes[i].split('||')[1] || '')} />
                                        </div>
                                    </foreignObject>
                                </>
                            )}

                            {/* Arrow */}
                            {i < data.xNodes.length - 1 && !isAsymptote && renderArrow(
                                cx + 20,
                                i === 0 ? (data.yNodes[0]?.includes('+') ? rowHeight * 2 + 20 : totalHeight - 20) :
                                data.yPrimeSigns?.[i] === '+' ? totalHeight - 30 : rowHeight * 2 + 30,
                                cx + colWidth - 20,
                                i === data.xNodes.length - 2 ? (data.yNodes[data.xNodes.length - 1]?.includes('+') ? rowHeight * 2 + 20 : totalHeight - 20) :
                                data.yPrimeSigns?.[i] === '+' ? rowHeight * 2 + 30 : totalHeight - 30
                            )}
                        </g>
                    );
                });

            // 5. HÀM BẬC 2/1 KHÔNG CÓ CỰC TRỊ
            case 'rational21_no_extrema':
                return data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    const isAsymptote = data.yPrimeVals?.[i] === '||';
                    
                    return (
                        <g key={i}>
                            {/* X value */}
                            <foreignObject x={cx - 40} y={15} width={80} height={rowHeight - 15}>
                                <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                    <LatexText text={cleanMath(x)} />
                                </div>
                            </foreignObject>

                            {/* Y' value hoặc tiệm cận */}
                            {isAsymptote ? renderAsymptote(cx) : data.yPrimeVals?.[i] && (
                                <foreignObject x={cx - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-sm items-center">
                                        <LatexText text={cleanMath(data.yPrimeVals[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* Y' sign */}
                            {i < data.xNodes.length - 1 && data.yPrimeSigns?.[i] && (
                                <foreignObject x={cx + colWidth / 2 - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-lg items-center">
                                        <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {/* Y value - vô cực ở đầu/cuối bảng */}
                            {data.yNodes[i] && !isAsymptote && renderYValue(
                                cx,
                                i === 0 || i === data.xNodes.length - 1 ? 
                                    (data.yNodes[i].includes('+') ? 'top' : 'bottom') : 'middle',
                                data.yNodes[i]
                            )}

                            {/* Vô cực bên trái/phải tiệm cận */}
                            {isAsymptote && data.yNodes[i] && data.yNodes[i].includes('||') && (
                                <>
                                    {/* Vô cực bên trái tiệm cận */}
                                    <foreignObject x={cx - 35} y={rowHeight * 2 + 20} width={30} height={30}>
                                        <div className="flex justify-end w-full h-full font-bold text-sm items-center pr-1">
                                            <LatexText text={cleanMath(data.yNodes[i].split('||')[0] || '')} />
                                        </div>
                                    </foreignObject>
                                    
                                    {/* Vô cực bên phải tiệm cận */}
                                    <foreignObject x={cx + 8} y={totalHeight - 20} width={30} height={30}>
                                        <div className="flex justify-start w-full h-full font-bold text-sm items-center pl-1">
                                            <LatexText text={cleanMath(data.yNodes[i].split('||')[1] || '')} />
                                        </div>
                                    </foreignObject>
                                </>
                            )}

                            {/* Arrow */}
                            {i < data.xNodes.length - 1 && !isAsymptote && renderArrow(
                                cx + 20,
                                i === 0 ? (data.yNodes[0]?.includes('+') ? rowHeight * 2 + 20 : totalHeight - 20) :
                                data.yPrimeSigns?.[i] === '+' ? totalHeight - 30 : rowHeight * 2 + 30,
                                cx + colWidth - 20,
                                i === data.xNodes.length - 2 ? (data.yNodes[data.xNodes.length - 1]?.includes('+') ? rowHeight * 2 + 20 : totalHeight - 20) :
                                data.yPrimeSigns?.[i] === '+' ? rowHeight * 2 + 30 : totalHeight - 30
                            )}
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