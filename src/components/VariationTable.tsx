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
    const yRowHeight = 112; 
    const totalHeight = rowHeight * 2 + yRowHeight;
    const startX = 64;
    const usableWidth = width - startX - paddingRight;
    
    // --- HELPER FUNCTIONS ---

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

    const getYPosForValue = (val: string): 'top' | 'bottom' => {
        const s = val.toLowerCase();
        if (s.includes('-\\infty') || s.includes('-inf')) return 'bottom';
        if (s.includes('\\infty') || s.includes('+inf')) return 'top';
        return 'top'; 
    };

    // --- RENDER COMPONENT HELPERS ---

    // 1. Render giá trị Y thường
    const renderYValue = (cx: number, yPosition: 'top' | 'middle' | 'bottom', value: string) => {
        let yPos: number;
        if (yPosition === 'top') yPos = rowHeight * 2 + 25;
        else if (yPosition === 'middle') yPos = rowHeight * 2 + yRowHeight / 2;
        else yPos = totalHeight - 25;

        return (
            <foreignObject x={cx - 40} y={yPos - 15} width={80} height={30}>
                <div className="flex justify-center w-full h-full font-bold text-sm bg-white/90 px-1 items-center z-10">
                    <LatexText text={cleanMath(value)} />
                </div>
            </foreignObject>
        );
    };

    // 2. Render giá trị "kẹp" sát tiệm cận
    const renderSplitLimit = (cx: number, rawValue: string) => {
        const parts = rawValue.split('||');
        const leftVal = parts[0] || '';
        const rightVal = parts[1] || '';

        const yPosLeft = getYPosForValue(leftVal) === 'top' ? rowHeight * 2 + 25 : totalHeight - 25;
        const yPosRight = getYPosForValue(rightVal) === 'top' ? rowHeight * 2 + 25 : totalHeight - 25;

        return (
            <>
                {/* Bên trái: Align Right sát vạch (cx - 4px) */}
                <foreignObject x={cx - 64} y={yPosLeft - 15} width={60} height={30}>
                    <div className="flex justify-end w-full h-full font-bold text-sm items-center pr-1">
                        <LatexText text={cleanMath(leftVal)} />
                    </div>
                </foreignObject>

                {/* Bên phải: Align Left sát vạch (cx + 4px) */}
                <foreignObject x={cx + 4} y={yPosRight - 15} width={60} height={30}>
                    <div className="flex justify-start w-full h-full font-bold text-sm items-center pl-1">
                        <LatexText text={cleanMath(rightVal)} />
                    </div>
                </foreignObject>
            </>
        );
    };

    // 3. Render Mũi tên
    const renderArrow = (x1: number, y1: number, x2: number, y2: number) => (
        <line 
            x1={x1} y1={y1} 
            x2={x2} y2={y2} 
            stroke="black" strokeWidth="1.2" markerEnd="url(#arrowhead)" 
        />
    );

    // 4. Render 2 vạch tiệm cận (Xuyên suốt dòng y)
    const renderAsymptote = (cx: number) => (
        <g>
            <line x1={cx - 2} y1={rowHeight} x2={cx - 2} y2={totalHeight} stroke="black" strokeWidth="1" />
            <line x1={cx + 2} y1={rowHeight} x2={cx + 2} y2={totalHeight} stroke="black" strokeWidth="1" />
        </g>
    );

    // --- LOGIC TÍNH TOÁN TỌA ĐỘ (Đã fix warning) ---
    
    // Tính Y
    const getPointY = (index: number, type: 'start' | 'end') => {
        const valStr = data.yNodes[index] || '';
        if (valStr.includes('||')) {
            const parts = valStr.split('||');
            const targetVal = type === 'start' ? parts[1] : parts[0];
            const pos = getYPosForValue(targetVal || '');
            return pos === 'top' ? rowHeight * 2 + 35 : totalHeight - 35;
        }
        const pos = getYPosForValue(valStr);
        return pos === 'top' ? rowHeight * 2 + 35 : totalHeight - 35;
    };

    // Tính X: Đã bỏ colWidth thừa, chỉ nhận vào cx của node đích danh
    const getPointX = (index: number, type: 'start' | 'end', nodeCx: number) => {
        const isAsymptote = data.yPrimeVals?.[index] === '||';
        
        if (type === 'start') {
            // Nếu start từ tiệm cận -> sát vạch (+18)
            // Nếu start thường -> xa vạch (+30)
            return isAsymptote ? nodeCx + 18 : nodeCx + 30;
        } else {
            // Nếu end tại tiệm cận -> sát vạch (-18)
            // Nếu end thường -> xa vạch (-30)
            return isAsymptote ? nodeCx - 18 : nodeCx - 30; 
        }
    };

    // --- MAIN RENDER ---
    const renderTemplate = () => {
        const colWidth = usableWidth / (data.xNodes.length - 1);

        switch(functionType) {
            case 'rational11':
            case 'rational21_with_extrema':
            case 'rational21_no_extrema':
                return data.xNodes.map((x, i) => {
                    const cx = startX + 40 + i * colWidth;
                    const isAsymptote = data.yPrimeVals?.[i] === '||';
                    
                    // Tính nextCx để vẽ mũi tên tới
                    const nextIndex = i + 1;
                    const nextCx = startX + 40 + nextIndex * colWidth;
                    const hasNext = nextIndex < data.xNodes.length;

                    return (
                        <g key={i}>
                            {/* X, Y', Sign, Y Values... */}
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

                            {hasNext && data.yPrimeSigns?.[i] && (
                                <foreignObject x={cx + colWidth / 2 - 20} y={rowHeight + 15} width={40} height={30}>
                                    <div className="flex justify-center w-full h-full font-bold text-lg items-center">
                                        <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                    </div>
                                </foreignObject>
                            )}

                            {isAsymptote 
                                ? data.yNodes[i] && renderSplitLimit(cx, data.yNodes[i])
                                : data.yNodes[i] && renderYValue(cx, getYPosForValue(data.yNodes[i]), data.yNodes[i])
                            }

                            {/* Mũi tên: Đã áp dụng hàm getPointX/Y */}
                            {hasNext && (
                                renderArrow(
                                    getPointX(i, 'start', cx),          // x1 (cx hiện tại)
                                    getPointY(i, 'start'),              // y1
                                    getPointX(nextIndex, 'end', nextCx),// x2 (cx tiếp theo)
                                    getPointY(nextIndex, 'end')         // y2
                                )
                            )}

                            {isAsymptote && renderAsymptote(cx)}
                        </g>
                    );
                });

            // Fallback cho hàm đa thức (Logic cũ, đã ổn định)
            default:
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

                <line x1="0" y1={rowHeight} x2={width} y2={rowHeight} stroke="black" strokeWidth="1" />
                <line x1="0" y1={rowHeight*2} x2={width} y2={rowHeight*2} stroke="black" strokeWidth="1" />
                <line x1={startX} y1="0" x2={startX} y2={totalHeight} stroke="black" strokeWidth="1" />

                <text x={startX/2} y={rowHeight/2 + 5} textAnchor="middle" className="font-bold italic text-lg font-serif">x</text>
                <text x={startX/2} y={rowHeight + rowHeight/2 + 5} textAnchor="middle" className="font-bold italic text-lg font-serif">y'</text>
                <text x={startX/2} y={rowHeight*2 + yRowHeight/2} textAnchor="middle" className="font-bold italic text-lg font-serif">y</text>

                {renderTemplate()}
            </svg>
        </div>
    );
};