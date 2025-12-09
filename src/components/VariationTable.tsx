import React, { useMemo } from 'react';
import { VariationTableData } from '../types';
import { LatexText } from './LatexText';

interface Props {
    data: VariationTableData;
}

// CẤU HÌNH KÍCH THƯỚC
const CONFIG = {
    width: 640,
    rowHeight: 40,
    graphHeight: 180, // Tăng nhẹ chiều cao để bảng thoáng hơn
    startX: 60,
    paddingY: 30,     // Tăng padding để đỉnh/đáy không chạm mép
};

export const VariationTable: React.FC<Props> = ({ data }) => {
    const totalHeight = CONFIG.rowHeight * 2 + CONFIG.graphHeight;
    const usableWidth = CONFIG.width - CONFIG.startX - 40;
    // Đảm bảo colWidth không quá nhỏ
    const colWidth = Math.max(60, usableWidth / Math.max(1, data.xNodes.length - 1));
    const svgWidth = Math.max(CONFIG.width, CONFIG.startX + 40 + (data.xNodes.length - 1) * colWidth + 20);

    // --- 1. HÀM LÀM SẠCH CHUỖI LATEX ---
    const cleanMath = (val: string): string => {
        if (!val) return "";
        let s = val.trim();
        // Chuẩn hóa ký hiệu vô cực
        if (!s.includes('\\infty') && !s.includes('\u221e')) {
            if (s.toLowerCase().includes('-inf')) s = '-\\infty';
            else if (s.toLowerCase().includes('+inf') || (s.toLowerCase().includes('inf') && !s.includes('-'))) s = '+\\infty';
        }
        // Thêm dấu $ nếu chưa có
        if (!s.startsWith('$')) return `$${s}$`;
        return s;
    };

    // --- 2. HÀM CHUYỂN ĐỔI GIÁ TRỊ ĐỂ SẮP XẾP ---
    const parseValue = (val: string): number => {
        if (!val) return 0;
        const v = val.toLowerCase().trim().replace(/\$/g, '').replace(/\\displaystyle/g, '');
        
        // Ưu tiên xử lý vô cực
        if (v.includes('-inf') || v.includes('-\\infty')) return -Infinity; 
        if (v.includes('+inf') || v.includes('+\\infty')) return Infinity;
        
        try {
            // Xử lý phân số LaTeX: \frac{a}{b} hoặc \dfrac{a}{b}
            if (v.includes('frac')) {
                const match = v.match(/frac\{(-?[\d.]+)\}\{(-?[\d.]+)\}/);
                if (match && match[1] && match[2]) {
                    return parseFloat(match[1]) / parseFloat(match[2]);
                }
            }
            // Xử lý phân số thường: 1/3
            if (v.includes('/')) {
                const parts = v.split('/');
                return parseFloat(parts[0]) / parseFloat(parts[1]);
            }
            // Xử lý số thường
            const parsed = parseFloat(v);
            return isNaN(parsed) ? 0 : parsed;
        } catch {
            return 0;
        }
    };

    // --- 3. LOGIC TÍNH TỌA ĐỘ Y ---
    const yCoordinates = useMemo(() => {
        let uniqueNumbers = new Set<number>();
        
        data.yNodes.forEach(nodeRaw => {
            if (!nodeRaw) return;
            const parts = nodeRaw.split('||'); // Tách nếu là tiệm cận
            parts.forEach(p => {
                const num = parseValue(p);
                // Chỉ thêm số hữu hạn vào set để sort khoảng giữa
                if (num !== Infinity && num !== -Infinity) {
                    uniqueNumbers.add(num);
                }
            });
        });

        // Sắp xếp các giá trị hữu hạn
        const sortedFinite = Array.from(uniqueNumbers).sort((a, b) => a - b);
        
        const mapY = new Map<number, number>();
        const Y_TOP = CONFIG.rowHeight * 2 + CONFIG.paddingY;
        const Y_BOT = totalHeight - CONFIG.paddingY;
        
        // Tính toán vị trí
        // Quy ước: +Infinity ở Y_TOP, -Infinity ở Y_BOT
        // Các số hữu hạn sẽ chia đều khoảng giữa (Y_TOP + gap) đến (Y_BOT - gap)
        
        mapY.set(Infinity, Y_TOP);
        mapY.set(-Infinity, Y_BOT);

        if (sortedFinite.length > 0) {
            const margin = 30; // Khoảng cách an toàn so với vô cực
            const drawTop = Y_TOP + margin;
            const drawBot = Y_BOT - margin;
            const drawH = drawBot - drawTop;

            if (sortedFinite.length === 1) {
                // Nếu chỉ có 1 giá trị (ví dụ Tiệm cận ngang y=2), cho nằm giữa
                mapY.set(sortedFinite[0], Y_TOP + (Y_BOT - Y_TOP) / 2);
            } else {
                sortedFinite.forEach((val, index) => {
                    const ratio = index / (sortedFinite.length - 1);
                    const yPos = drawBot - ratio * drawH; // Đảo ngược vì Y nhỏ nằm dưới
                    mapY.set(val, yPos);
                });
            }
        } else {
             // Trường hợp đặc biệt không có số nào (chỉ có vô cực - hiếm gặp)
             mapY.set(0, Y_TOP + (Y_BOT - Y_TOP) / 2);
        }

        return mapY;
    }, [data.yNodes, totalHeight]);

    // Hàm lấy tọa độ pixel
    const getY = (valStr: string) => {
        const num = parseValue(valStr);
        return yCoordinates.get(num) ?? (CONFIG.rowHeight * 2 + CONFIG.graphHeight / 2);
    };

    return (
        <div className="w-full max-w-full overflow-x-auto border border-gray-400 rounded p-4 bg-white shadow-sm mb-6 flex justify-start pl-2">
            <svg width={svgWidth} height={totalHeight} className="select-none" style={{ minWidth: svgWidth }}>
                <defs>
                    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                        <polygon points="0 0, 8 3, 0 6" fill="black" />
                    </marker>
                </defs>

                {/* --- KHUNG LƯỚI --- */}
                <line x1="0" y1={CONFIG.rowHeight} x2={svgWidth} y2={CONFIG.rowHeight} stroke="black" strokeWidth="1" />
                <line x1="0" y1={CONFIG.rowHeight * 2} x2={svgWidth} y2={CONFIG.rowHeight * 2} stroke="black" strokeWidth="1" />
                <line x1={CONFIG.startX} y1="0" x2={CONFIG.startX} y2={totalHeight} stroke="black" strokeWidth="1" />

                {/* LABEL HEADERS */}
                <text x={CONFIG.startX / 2} y={CONFIG.rowHeight / 2 + 6} textAnchor="middle" className="font-bold italic text-lg font-serif">x</text>
                <text x={CONFIG.startX / 2} y={CONFIG.rowHeight + CONFIG.rowHeight / 2 + 6} textAnchor="middle" className="font-bold italic text-lg font-serif">y'</text>
                <text x={CONFIG.startX / 2} y={CONFIG.rowHeight * 2 + CONFIG.graphHeight / 2} textAnchor="middle" className="font-bold italic text-lg font-serif">y</text>

                {/* --- RENDER DATA --- */}
                {data.xNodes.map((xVal, i) => {
                    const cx = CONFIG.startX + 40 + i * colWidth;
                    
                    const isVerticalAsymptote = data.yNodes[i]?.includes('||');
                    // Nếu là tiệm cận đứng thì đạo hàm tại đó là ||, ngược lại hiển thị giá trị
                    const isDerivativeUndefined = data.yPrimeVals?.[i]?.includes('||') || isVerticalAsymptote;

                    // 1. VẼ X
                    const xDisplay = (
                        <foreignObject x={cx - 40} y={8} width={80} height={CONFIG.rowHeight - 16}>
                            <div className="flex justify-center items-center w-full h-full font-bold text-sm">
                                <LatexText text={cleanMath(xVal)} />
                            </div>
                        </foreignObject>
                    );

                    // 2. VẼ Y' (Dấu gạch || hoặc số 0)
                    let yPrimeDisplay = null;
                    if (isDerivativeUndefined) {
                        yPrimeDisplay = (
                            <g>
                                <line x1={cx - 1.5} y1={CONFIG.rowHeight} x2={cx - 1.5} y2={CONFIG.rowHeight*2} stroke="black" strokeWidth="1" />
                                <line x1={cx + 1.5} y1={CONFIG.rowHeight} x2={cx + 1.5} y2={CONFIG.rowHeight*2} stroke="black" strokeWidth="1" />
                            </g>
                        );
                    } else if (data.yPrimeVals?.[i]) {
                        yPrimeDisplay = (
                            <foreignObject x={cx - 20} y={CONFIG.rowHeight + 5} width={40} height={30}>
                                <div className="flex justify-center items-center w-full h-full font-bold text-sm">
                                    <LatexText text={cleanMath(data.yPrimeVals[i])} />
                                </div>
                            </foreignObject>
                        );
                    }

                    // 3. VẼ DẤU Y' (+ hoặc -) ở giữa các khoảng
                    let signDisplay = null;
                    if (i < data.xNodes.length - 1 && data.yPrimeSigns?.[i]) {
                        const signCx = cx + colWidth / 2;
                        signDisplay = (
                            <foreignObject x={signCx - 20} y={CONFIG.rowHeight + 5} width={40} height={30}>
                                <div className="flex justify-center items-center w-full h-full font-bold text-lg text-gray-800">
                                    <LatexText text={cleanMath(data.yPrimeSigns[i])} />
                                </div>
                            </foreignObject>
                        );
                    }

                    // 4. VẼ Y NODES
                    let yDisplay = null;
                    const rawY = data.yNodes[i] || "";

                    if (isVerticalAsymptote) {
                        // Vẽ 2 gạch dọc suốt chiều cao đồ thị y
                        yDisplay = (
                            <g>
                                <line x1={cx - 1.5} y1={CONFIG.rowHeight*2} x2={cx - 1.5} y2={totalHeight} stroke="black" strokeWidth="1" />
                                <line x1={cx + 1.5} y1={CONFIG.rowHeight*2} x2={cx + 1.5} y2={totalHeight} stroke="black" strokeWidth="1" />
                            </g>
                        );

                        const parts = rawY.split('||');
                        const leftVal = parts[0] ? parts[0].trim() : "";
                        const rightVal = parts[1] ? parts[1].trim() : "";
                        
                        const leftY = getY(leftVal);
                        const rightY = getY(rightVal);

                        // Tinh chỉnh vị trí text cho || để ôm sát vạch
                        if (leftVal) {
                            yDisplay = (
                                <g>
                                    {yDisplay}
                                    {/* Bên trái: align phải, padding phải nhỏ */}
                                    <foreignObject x={cx - 55} y={leftY - 15} width={50} height={30}>
                                        <div className={`flex justify-end pr-1 w-full h-full font-bold text-sm`}>
                                            <LatexText text={cleanMath(leftVal)} />
                                        </div>
                                    </foreignObject>
                                </g>
                            );
                        }
                        if (rightVal) {
                            yDisplay = (
                                <g>
                                    {yDisplay}
                                    {/* Bên phải: align trái, padding trái nhỏ */}
                                    <foreignObject x={cx + 5} y={rightY - 15} width={50} height={30}>
                                        <div className={`flex justify-start pl-1 w-full h-full font-bold text-sm`}>
                                            <LatexText text={cleanMath(rightVal)} />
                                        </div>
                                    </foreignObject>
                                </g>
                            );
                        }
                    } else {
                        // Điểm thường (Cực trị, biên)
                        const yPos = getY(rawY);
                        yDisplay = (
                            <foreignObject x={cx - 40} y={yPos - 15} width={80} height={30}>
                                <div className="flex justify-center items-center w-full h-full font-bold text-sm bg-white/0">
                                    <LatexText text={cleanMath(rawY)} />
                                </div>
                            </foreignObject>
                        );
                    }

                    // 5. VẼ MŨI TÊN (Từ i-1 sang i)
                    let arrowElement = null;
                    if (i > 0) {
                        const prevIndex = i - 1;
                        const prevCx = CONFIG.startX + 40 + prevIndex * colWidth;
                        const prevRawY = data.yNodes[prevIndex] || "";
                        
                        let x1, y1, x2, y2;

                        // Tọa độ ĐIỂM ĐẦU (x1, y1)
                        if (prevRawY.includes('||')) {
                            // Xuất phát từ bên phải của tiệm cận cũ
                            const val = prevRawY.split('||')[1] || "";
                            y1 = getY(val);
                            x1 = prevCx + 10; 
                        } else {
                            // Xuất phát từ node thường
                            y1 = getY(prevRawY);
                            x1 = prevCx + 20; 
                        }

                        // Tọa độ ĐIỂM CUỐI (x2, y2)
                        if (rawY.includes('||')) {
                            // Kết thúc ở bên trái của tiệm cận mới
                            const val = rawY.split('||')[0] || "";
                            y2 = getY(val);
                            x2 = cx - 10;
                        } else {
                            // Kết thúc ở node thường
                            y2 = getY(rawY);
                            x2 = cx - 20;
                        }

                        // Vẽ mũi tên nếu khoảng cách hợp lý
                        if (x2 > x1 + 5) {
                            // Rút ngắn mũi tên một chút để không chạm chữ
                            const dx = x2 - x1;
                            const dy = y2 - y1;
                            const angle = Math.atan2(dy, dx);
                            const shorten = 12; // Pixel rút ngắn
                            
                            // Chỉ rút ngắn điểm cuối
                            const finalX2 = x2 - shorten * Math.cos(angle);
                            const finalY2 = y2 - shorten * Math.sin(angle);
                            const finalX1 = x1 + shorten * Math.cos(angle) * 0.5; // Rút đầu ít hơn
                            const finalY1 = y1 + shorten * Math.sin(angle) * 0.5;

                            arrowElement = (
                                <line 
                                    x1={finalX1} y1={finalY1} 
                                    x2={finalX2} y2={finalY2} 
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
                            {arrowElement}
                            {yDisplay}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};