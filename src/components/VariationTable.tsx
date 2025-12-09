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
    graphHeight: 200, // Tăng chiều cao để bảng thoáng hơn cho hàm 2/1
    startX: 60,
    paddingY: 30,     // Khoảng cách từ biên trên/dưới đến vô cực
    safeZonePadding: 60 // Khoảng cách an toàn để số hữu hạn không chạm vô cực
};

export const VariationTable: React.FC<Props> = ({ data }) => {
    const totalHeight = CONFIG.rowHeight * 2 + CONFIG.graphHeight;
    // Tính toán độ rộng cột dựa trên số lượng mốc x
    const usableWidth = CONFIG.width - CONFIG.startX - 40;
    const colWidth = Math.max(80, usableWidth / Math.max(1, data.xNodes.length - 1));
    const svgWidth = Math.max(CONFIG.width, CONFIG.startX + 40 + (data.xNodes.length - 1) * colWidth + 20);

    // --- 1. HÀM LÀM SẠCH CHUỖI LATEX ---
    const cleanMath = (val: string): string => {
        if (!val) return "";
        let s = val.trim();
        // Chuẩn hóa ký hiệu vô cực về LaTeX chuẩn
        if (!s.includes('\\infty') && !s.includes('\u221e')) {
            if (s.toLowerCase().includes('-inf')) s = '-\\infty';
            else if (s.toLowerCase().includes('+inf') || (s.toLowerCase().includes('inf') && !s.includes('-'))) s = '+\\infty';
        }
        // Thêm dấu $ để LatexText hiểu
        if (!s.startsWith('$')) return `$${s}$`;
        return s;
    };

    // --- 2. HÀM CHUYỂN ĐỔI GIÁ TRỊ ĐỂ SẮP XẾP ---
    const parseValue = (val: string): number => {
        if (!val) return 0;
        const v = val.toLowerCase().trim().replace(/\$/g, '').replace(/\\displaystyle/g, '');
        
        // Gán giá trị đặc biệt cho vô cực
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

    // --- 3. LOGIC TÍNH TỌA ĐỘ Y (QUAN TRỌNG: PHÂN LỚP) ---
    const yCoordinates = useMemo(() => {
        let uniqueFiniteNumbers = new Set<number>();
        
        data.yNodes.forEach(nodeRaw => {
            if (!nodeRaw) return;
            const parts = nodeRaw.split('||'); // Tách nếu là tiệm cận
            parts.forEach(p => {
                const num = parseValue(p);
                // Chỉ thu thập các số hữu hạn (không phải vô cực)
                if (num !== Infinity && num !== -Infinity) {
                    uniqueFiniteNumbers.add(num);
                }
            });
        });

        const sortedFinite = Array.from(uniqueFiniteNumbers).sort((a, b) => a - b);
        const mapY = new Map<number, number>();
        
        // ĐỊNH NGHĨA CÁC MỐC CAO ĐỘ (Pixel)
        // Lưu ý: SVG y=0 là đỉnh, y=max là đáy
        const Y_TOP_INF = CONFIG.rowHeight * 2 + CONFIG.paddingY; // Vị trí +Vô cực
        const Y_BOT_INF = totalHeight - CONFIG.paddingY;          // Vị trí -Vô cực
        
        // Vùng an toàn cho số hữu hạn (nằm giữa bảng)
        const Y_SAFE_TOP = Y_TOP_INF + CONFIG.safeZonePadding;
        const Y_SAFE_BOT = Y_BOT_INF - CONFIG.safeZonePadding;
        const safeHeight = Y_SAFE_BOT - Y_SAFE_TOP;

        // 1. Gán cứng tọa độ cho Vô cực
        mapY.set(Infinity, Y_TOP_INF);
        mapY.set(-Infinity, Y_BOT_INF);

        // 2. Chia đều tọa độ cho các số hữu hạn trong vùng an toàn
        if (sortedFinite.length > 0) {
            if (sortedFinite.length === 1) {
                // Nếu chỉ có 1 giá trị (vd: y=1), đặt chính giữa
                mapY.set(sortedFinite[0], Y_SAFE_TOP + safeHeight / 2);
            } else {
                sortedFinite.forEach((val, index) => {
                    const ratio = index / (sortedFinite.length - 1);
                    // Đảo ngược ratio vì giá trị lớn (index lớn) phải nằm ở trên (y nhỏ)
                    const yPos = Y_SAFE_BOT - ratio * safeHeight;
                    mapY.set(val, yPos);
                });
            }
        } else {
            // Fallback nếu không có số hữu hạn nào
            mapY.set(0, Y_SAFE_TOP + safeHeight / 2);
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
                    
                    const rawYNode = data.yNodes[i] || "";
                    const isVerticalAsymptote = rawYNode.includes('||');
                    
                    // Nếu là tiệm cận đứng, đạo hàm tại đó là ||, ngược lại dùng dữ liệu từ yPrimeVals
                    const yPrimeVal = data.yPrimeVals?.[i];
                    // Logic check || cho hàng y': Nếu yNodes là || hoặc yPrimeVals là ||
                    const isYPrimeUndefined = isVerticalAsymptote || (yPrimeVal && yPrimeVal.includes('||'));

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
                    if (isYPrimeUndefined) {
                        yPrimeDisplay = (
                            <g>
                                <line x1={cx - 1.5} y1={CONFIG.rowHeight} x2={cx - 1.5} y2={CONFIG.rowHeight*2} stroke="black" strokeWidth="1" />
                                <line x1={cx + 1.5} y1={CONFIG.rowHeight} x2={cx + 1.5} y2={CONFIG.rowHeight*2} stroke="black" strokeWidth="1" />
                            </g>
                        );
                    } else if (yPrimeVal) {
                        yPrimeDisplay = (
                            <foreignObject x={cx - 20} y={CONFIG.rowHeight + 5} width={40} height={30}>
                                <div className="flex justify-center items-center w-full h-full font-bold text-sm">
                                    <LatexText text={cleanMath(yPrimeVal)} />
                                </div>
                            </foreignObject>
                        );
                    }

                    // 3. VẼ DẤU Y' (+ hoặc -) ở khoảng giữa
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

                    // 4. VẼ Y NODES & TIỆM CẬN ĐỨNG
                    let yDisplay = null;

                    if (isVerticalAsymptote) {
                        // A. VẼ 2 VẠCH DỌC XUYÊN SUỐT HÀNG Y
                        yDisplay = (
                            <g>
                                <line x1={cx - 1.5} y1={CONFIG.rowHeight*2} x2={cx - 1.5} y2={totalHeight} stroke="black" strokeWidth="1" />
                                <line x1={cx + 1.5} y1={CONFIG.rowHeight*2} x2={cx + 1.5} y2={totalHeight} stroke="black" strokeWidth="1" />
                            </g>
                        );

                        // B. VẼ CÁC GIÁ TRỊ VÔ CỰC 2 BÊN
                        const parts = rawYNode.split('||');
                        const leftVal = parts[0] ? parts[0].trim() : "";
                        const rightVal = parts[1] ? parts[1].trim() : "";
                        
                        const leftY = getY(leftVal);
                        const rightY = getY(rightVal);

                        // Bên trái || (Align Right, Padding Right)
                        if (leftVal) {
                            yDisplay = (
                                <g>
                                    {yDisplay}
                                    <foreignObject x={cx - 55} y={leftY - 15} width={50} height={30}>
                                        <div className="flex justify-end pr-1 w-full h-full font-bold text-sm">
                                            <LatexText text={cleanMath(leftVal)} />
                                        </div>
                                    </foreignObject>
                                </g>
                            );
                        }
                        // Bên phải || (Align Left, Padding Left)
                        if (rightVal) {
                            yDisplay = (
                                <g>
                                    {yDisplay}
                                    <foreignObject x={cx + 5} y={rightY - 15} width={50} height={30}>
                                        <div className="flex justify-start pl-1 w-full h-full font-bold text-sm">
                                            <LatexText text={cleanMath(rightVal)} />
                                        </div>
                                    </foreignObject>
                                </g>
                            );
                        }
                    } else {
                        // C. VẼ ĐIỂM THƯỜNG (Cực trị, biên)
                        const yPos = getY(rawYNode);
                        yDisplay = (
                            <foreignObject x={cx - 40} y={yPos - 15} width={80} height={30}>
                                <div className="flex justify-center items-center w-full h-full font-bold text-sm bg-white/0">
                                    <LatexText text={cleanMath(rawYNode)} />
                                </div>
                            </foreignObject>
                        );
                    }

                    // 5. VẼ MŨI TÊN (TỪ I-1 ĐẾN I)
                    let arrowElement = null;
                    if (i > 0) {
                        const prevIndex = i - 1;
                        const prevCx = CONFIG.startX + 40 + prevIndex * colWidth;
                        const prevRawY = data.yNodes[prevIndex] || "";
                        
                        let x1, y1, x2, y2;

                        // Tọa độ ĐIỂM ĐẦU (x1, y1)
                        if (prevRawY.includes('||')) {
                            // Xuất phát từ bên phải tiệm cận cũ
                            const val = prevRawY.split('||')[1] || "";
                            y1 = getY(val);
                            x1 = prevCx + 10; 
                        } else {
                            y1 = getY(prevRawY);
                            x1 = prevCx + 20; 
                        }

                        // Tọa độ ĐIỂM CUỐI (x2, y2)
                        if (rawYNode.includes('||')) {
                            // Kết thúc ở bên trái tiệm cận mới
                            const val = rawYNode.split('||')[0] || "";
                            y2 = getY(val);
                            x2 = cx - 10;
                        } else {
                            y2 = getY(rawYNode);
                            x2 = cx - 20;
                        }

                        // Chỉ vẽ mũi tên nếu có khoảng cách ngang
                        if (x2 > x1 + 5) {
                            const dx = x2 - x1;
                            const dy = y2 - y1;
                            const angle = Math.atan2(dy, dx);
                            const shorten = 15; // Rút ngắn đầu mũi tên để không đè chữ
                            
                            const finalX2 = x2 - shorten * Math.cos(angle);
                            const finalY2 = y2 - shorten * Math.sin(angle);
                            
                            // Điểm đầu rút ngắn ít hơn chút
                            const finalX1 = x1 + (shorten * 0.3) * Math.cos(angle);
                            const finalY1 = y1 + (shorten * 0.3) * Math.sin(angle);

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