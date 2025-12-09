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
    graphHeight: 160, // Chiều cao khu vực vẽ đồ thị
    startX: 60,
    paddingY: 25,     // Khoảng đệm trên/dưới để mũi tên không chạm sát biên
};

export const VariationTable: React.FC<Props> = ({ data }) => {
    const totalHeight = CONFIG.rowHeight * 2 + CONFIG.graphHeight;
    const usableWidth = CONFIG.width - CONFIG.startX - 40;
    const colWidth = usableWidth / Math.max(1, data.xNodes.length - 1);

    // --- 1. HÀM LÀM SẠCH CHUỖI LATEX ---
    const cleanMath = (val: string): string => {
        if (!val) return "";
        let s = val.trim();
        // Chuẩn hóa ký hiệu vô cực
        if (!s.includes('\\infty') && !s.includes('\u221e')) {
            if (s.toLowerCase().includes('-inf')) s = '-\\infty';
            else if (s.toLowerCase().includes('+inf') || (s.toLowerCase().includes('inf') && !s.includes('-'))) s = '+\\infty';
        }
        // Thêm dấu $ nếu chưa có để LatexText hiểu
        if (!s.startsWith('$')) return `$${s}$`;
        return s;
    };

    // --- 2. HÀM CHUYỂN ĐỔI GIÁ TRỊ ĐỂ SẮP XẾP ---
    // Giúp so sánh được cả số, phân số và vô cực
    const parseValue = (val: string): number => {
        if (!val) return 0;
        const v = val.toLowerCase().trim().replace(/\$/g, ''); // Bỏ dấu $
        
        if (v.includes('-inf') || v.includes('-\\infty')) return -999999; 
        if (v.includes('+inf') || v.includes('+\\infty')) return 999999;
        
        try {
            // Xử lý phân số (ví dụ: 1/3)
            if (v.includes('/')) {
                const parts = v.split('/');
                return parseFloat(parts[0]) / parseFloat(parts[1]);
            }
            return parseFloat(v) || 0;
        } catch {
            return 0;
        }
    };

    // --- 3. LOGIC TÍNH TỌA ĐỘ Y (QUAN TRỌNG NHẤT) ---
    // Quét toàn bộ bảng, xếp hạng giá trị từ nhỏ đến lớn để chia chiều cao
    const yCoordinates = useMemo(() => {
        let allValues: { val: string, num: number }[] = [];
        
        data.yNodes.forEach(nodeRaw => {
            if (!nodeRaw) return;
            if (nodeRaw.includes('||')) {
                const parts = nodeRaw.split('||');
                parts.forEach(p => allValues.push({ val: p, num: parseValue(p) }));
            } else {
                allValues.push({ val: nodeRaw, num: parseValue(nodeRaw) });
            }
        });

        // Lọc trùng và sắp xếp tăng dần
        const uniqueValues = Array.from(new Set(allValues.map(v => v.num))).sort((a, b) => a - b);
        
        const mapY = new Map<number, number>();
        const Y_TOP = CONFIG.rowHeight * 2 + CONFIG.paddingY;
        const Y_BOT = totalHeight - CONFIG.paddingY;
        const drawHeight = Y_BOT - Y_TOP;

        if (uniqueValues.length === 0) return mapY;
        if (uniqueValues.length === 1) {
            mapY.set(uniqueValues[0], Y_TOP + drawHeight / 2);
            return mapY;
        }

        uniqueValues.forEach((val, index) => {
            // Tính tỉ lệ vị trí
            const ratio = index / (uniqueValues.length - 1); 
            // Đảo ngược vì Y nhỏ (0) nằm trên cao trong SVG
            const yPos = Y_BOT - ratio * drawHeight;
            mapY.set(val, yPos);
        });

        return mapY;
    }, [data.yNodes, totalHeight]);

    // Hàm lấy tọa độ pixel từ chuỗi giá trị
    const getY = (valStr: string) => {
        const num = parseValue(valStr);
        // Nếu không tìm thấy (lỗi), trả về giữa
        return yCoordinates.get(num) ?? (CONFIG.rowHeight * 2 + CONFIG.graphHeight / 2);
    };

    return (
        <div className="w-full max-w-full overflow-x-auto border border-gray-400 rounded p-4 bg-white shadow-sm mb-6 flex justify-start pl-2">
            <svg width={CONFIG.width} height={totalHeight} className="select-none" style={{ minWidth: CONFIG.width }}>
                <defs>
                    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                        <polygon points="0 0, 8 3, 0 6" fill="black" />
                    </marker>
                </defs>

                {/* --- KHUNG LƯỚI --- */}
                <line x1="0" y1={CONFIG.rowHeight} x2={CONFIG.width} y2={CONFIG.rowHeight} stroke="black" strokeWidth="1" />
                <line x1="0" y1={CONFIG.rowHeight * 2} x2={CONFIG.width} y2={CONFIG.rowHeight * 2} stroke="black" strokeWidth="1" />
                <line x1={CONFIG.startX} y1="0" x2={CONFIG.startX} y2={totalHeight} stroke="black" strokeWidth="1" />

                {/* LABEL HEADERS */}
                <text x={CONFIG.startX / 2} y={CONFIG.rowHeight / 2 + 6} textAnchor="middle" className="font-bold italic text-lg font-serif">x</text>
                <text x={CONFIG.startX / 2} y={CONFIG.rowHeight + CONFIG.rowHeight / 2 + 6} textAnchor="middle" className="font-bold italic text-lg font-serif">y'</text>
                <text x={CONFIG.startX / 2} y={CONFIG.rowHeight * 2 + CONFIG.graphHeight / 2} textAnchor="middle" className="font-bold italic text-lg font-serif">y</text>

                {/* --- RENDER DATA --- */}
                {data.xNodes.map((xVal, i) => {
                    const cx = CONFIG.startX + 40 + i * colWidth;
                    
                    // Xác định tính chất Tiệm Cận Đứng
                    const isVerticalAsymptote = data.yNodes[i]?.includes('||');
                    // Xác định tính chất Không Xác Định của đạo hàm
                    const isDerivativeUndefined = data.yPrimeVals?.[i]?.includes('||') || isVerticalAsymptote;

                    // 1. VẼ X
                    const xDisplay = (
                        <foreignObject x={cx - 40} y={8} width={80} height={CONFIG.rowHeight - 16}>
                            <div className="flex justify-center items-center w-full h-full font-bold text-sm">
                                <LatexText text={cleanMath(xVal)} />
                            </div>
                        </foreignObject>
                    );

                    // 2. VẼ Y'
                    let yPrimeDisplay = null;
                    if (isDerivativeUndefined) {
                        yPrimeDisplay = (
                            <g>
                                <line x1={cx - 2} y1={CONFIG.rowHeight} x2={cx - 2} y2={CONFIG.rowHeight*2} stroke="black" strokeWidth="1" />
                                <line x1={cx + 2} y1={CONFIG.rowHeight} x2={cx + 2} y2={CONFIG.rowHeight*2} stroke="black" strokeWidth="1" />
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

                    // 3. VẼ DẤU Y'
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
                        // Vẽ 2 gạch dọc cho tiệm cận đứng ở hàng y
                        yDisplay = (
                            <g>
                                <line x1={cx - 2} y1={CONFIG.rowHeight*2} x2={cx - 2} y2={totalHeight} stroke="black" strokeWidth="1" />
                                <line x1={cx + 2} y1={CONFIG.rowHeight*2} x2={cx + 2} y2={totalHeight} stroke="black" strokeWidth="1" />
                            </g>
                        );

                        const parts = rawY.split('||');
                        const leftVal = parts[0] ? parts[0].trim() : "";
                        const rightVal = parts[1] ? parts[1].trim() : "";
                        
                        const leftY = getY(leftVal);
                        const rightY = getY(rightVal);

                        // Giá trị bên trái ||
                        if (leftVal) {
                            yDisplay = (
                                <g>
                                    {yDisplay}
                                    <foreignObject x={cx - 65} y={leftY - 15} width={60} height={30}>
                                        <div className={`flex justify-end pr-1 w-full h-full font-bold text-sm ${parseValue(leftVal) > 0 ? 'items-start pt-1' : 'items-end pb-1'}`}>
                                            <LatexText text={cleanMath(leftVal)} />
                                        </div>
                                    </foreignObject>
                                </g>
                            );
                        }
                        // Giá trị bên phải ||
                        if (rightVal) {
                            yDisplay = (
                                <g>
                                    {yDisplay}
                                    <foreignObject x={cx + 5} y={rightY - 15} width={60} height={30}>
                                        <div className={`flex justify-start pl-1 w-full h-full font-bold text-sm ${parseValue(rightVal) > 0 ? 'items-start pt-1' : 'items-end pb-1'}`}>
                                            <LatexText text={cleanMath(rightVal)} />
                                        </div>
                                    </foreignObject>
                                </g>
                            );
                        }
                    } else {
                        // Điểm thường
                        const yPos = getY(rawY);
                        yDisplay = (
                            <foreignObject x={cx - 40} y={yPos - 15} width={80} height={30}>
                                <div className="flex justify-center items-center w-full h-full font-bold text-sm bg-white/60">
                                    <LatexText text={cleanMath(rawY)} />
                                </div>
                            </foreignObject>
                        );
                    }

                    // 5. VẼ MŨI TÊN (Nối từ cột trước i-1 sang cột hiện tại i)
                    let arrowElement = null;
                    if (i > 0) {
                        const prevIndex = i - 1;
                        const prevCx = CONFIG.startX + 40 + prevIndex * colWidth;
                        const prevRawY = data.yNodes[prevIndex] || "";
                        
                        let x1, y1, x2, y2;

                        // Tìm điểm đầu (x1, y1)
                        if (prevRawY.includes('||')) {
                            const val = prevRawY.split('||')[1] || "";
                            y1 = getY(val);
                            x1 = prevCx + 15; // Bên phải tiệm cận cũ
                        } else {
                            y1 = getY(prevRawY);
                            x1 = prevCx + 25; // Bên phải text node cũ
                        }

                        // Tìm điểm cuối (x2, y2)
                        if (rawY.includes('||')) {
                            const val = rawY.split('||')[0] || "";
                            y2 = getY(val);
                            x2 = cx - 15; // Bên trái tiệm cận mới
                        } else {
                            y2 = getY(rawY);
                            x2 = cx - 25; // Bên trái text node mới
                        }

                        // Tính toán để cắt ngắn mũi tên (tránh đè chữ)
                        if (x2 > x1) {
                            const dx = x2 - x1;
                            const dy = y2 - y1;
                            const dist = Math.sqrt(dx*dx + dy*dy);
                            
                            // Nếu khoảng cách đủ dài, cắt bớt đầu đuôi
                            if (dist > 30) {
                                const trim = 5; // Cắt bớt 5px mỗi đầu
                                const ratio = trim / dist;
                                // x1 += dx * ratio; // Không cần cắt điểm đầu nhiều
                                // y1 += dy * ratio;
                                x2 -= dx * ratio; // Cắt điểm cuối để mũi tên nhọn đẹp
                                y2 -= dy * ratio;
                            }

                            arrowElement = (
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
                            {arrowElement}
                            {yDisplay}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};