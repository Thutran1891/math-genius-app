import React, { useState, useEffect, useRef } from 'react';
import { Question } from '../types';
import { CheckCircle, XCircle, Eye, EyeOff, Send } from 'lucide-react';
import { LatexText } from './LatexText';
import { VariationTable } from './VariationTable';
import { DynamicGeometry } from './DynamicGeometry';

declare global { interface Window { functionPlot: any; } }

interface Props {
  question: Question;
  index: number;
  onUpdateScore?: (isCorrect: boolean) => void;
  onDataChange?: (q: Question) => void;
}

export const QuestionCard: React.FC<Props> = ({ question, index, onUpdateScore, onDataChange }) => {
  const [showExplanation, setShowExplanation] = useState(false);
  
  // State lưu câu trả lời
  const [userAnswer, setUserAnswer] = useState<any>(null);
  
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const graphRef = useRef<HTMLDivElement>(null);

  // Reset state khi chuyển câu hỏi
  useEffect(() => {
    if (question.userAnswer) {
        // Khôi phục trạng thái nếu đã làm (Xem lại lịch sử)
        setUserAnswer(question.userAnswer);
        setIsChecked(true);
        setIsCorrect(!!question.isCorrect);
        setShowExplanation(false);
    } else {
        // Reset nếu là bài làm mới
        setUserAnswer(question.type === 'DS' ? {} : '');
        setIsChecked(false);
        setIsCorrect(false);
        setShowExplanation(false);
    }
  }, [question.id, question.userAnswer]);

  // Hàm phát âm thanh (Đã tối ưu Cleanup)
  const playSound = (correct: boolean) => {
    if (onUpdateScore) {
        let audio: HTMLAudioElement | null = new Audio(correct ? '/correct.mp3' : '/wrong.mp3'); // Đổi thành let
        audio.volume = 1.0; 
        
        audio.onended = () => {
            audio = null; // Bây giờ có thể gán null an toàn
        };

        audio.play().catch(() => {});
    }
    };

  // --- LOGIC VẼ ĐỒ THỊ & TIỆM CẬN (ĐÃ TỐI ƯU CLEANUP) ---
  useEffect(() => {
    // Chỉ chạy khi có dữ liệu đồ thị HOẶC tiệm cận, và thư viện đã sẵn sàng
    if ((question.graphFunction || question.asymptotes) && graphRef.current && window.functionPlot) {
        try {
            // Xóa hình cũ trước khi vẽ mới (Đảm bảo sạch sẽ)
            graphRef.current.innerHTML = '';
            
            // Mảng chứa tất cả các đường cần vẽ (Hàm chính + Tiệm cận)
            const dataToPlot: any[] = [];

            // ---------------------------------------------------------
            // 1. XỬ LÝ HÀM SỐ CHÍNH (Nếu có)
            // ---------------------------------------------------------
            if (question.graphFunction) {
                // Làm sạch chuỗi công thức từ AI (LaTeX -> Javascript)
                let fn = question.graphFunction
                    .replace(/\$/g, '')           // Bỏ dấu $
                    .replace(/\^/g, '**')         // Đổi mũ ^ thành **
                    .replace(/\\/g, '')           // Bỏ ký tự lạ của LaTeX
                    .replace(/ln\(/g, 'log(')     // Đổi ln -> log
                    .replace(/e\*\*/g, 'exp(')    // Đổi e mũ
                    // Tự động thêm Math. cho các hàm lượng giác/toán học
                    .replace(/\b(sin|cos|tan|cot|sqrt|abs|log|exp)\b/g, 'Math.$1') 
                    // Sửa lỗi nếu lỡ thêm Math.Math.
                    .replace(/Math\.Math\./g, 'Math.')
                    .trim();

                dataToPlot.push({
                    fn: fn, 
                    sampler: 'builtIn',  // Dùng sampler mặc định cho mượt
                    graphType: 'polyline',
                    color: '#2563eb',    // Màu xanh dương chủ đạo
                    range: [-10, 10]
                });
            }

            // ---------------------------------------------------------
            // 2. XỬ LÝ TIỆM CẬN (Ngang, Đứng, Xiên)
            // ---------------------------------------------------------
            if (question.asymptotes && question.asymptotes.length > 0) {
                question.asymptotes.forEach(asym => {
                    // Chuẩn hóa: Xóa khoảng trắng, chuyển về chữ thường
                    const cleanAsym = asym.replace(/\s/g, '').toLowerCase();
                    
                    // Tách vế trái (x hoặc y) và vế phải (biểu thức)
                    // Ví dụ: "y = 2*x + 1" -> parts[0]="y", parts[1]="2*x+1"
                    const parts = cleanAsym.split('=');
                    if (parts.length !== 2) return; // Bỏ qua nếu sai cú pháp

                    const type = parts[0]; // 'x' hoặc 'y'
                    let val = parts[1];    

                    // QUAN TRỌNG: Làm sạch biểu thức tiệm cận (để vẽ được tiệm cận xiên)
                    // Áp dụng quy tắc y hệt như hàm chính
                    val = val
                        .replace(/\^/g, '**')
                        .replace(/\\/g, '')
                        .replace(/ln\(/g, 'log(')
                        .replace(/\b(sin|cos|tan|sqrt|abs|log|exp)\b/g, 'Math.$1')
                        .replace(/Math\.Math\./g, 'Math.');

                    if (type === 'y') {
                        // CASE A: Tiệm cận NGANG (y=2) hoặc XIÊN (y=2*x+1)
                        // Thư viện functionPlot vẽ tốt cả 2 dạng này dưới dạng hàm số
                        dataToPlot.push({
                            fn: val, 
                            graphType: 'polyline',
                            color: '#dc2626', // Màu đỏ báo hiệu đường phụ
                            attr: { "stroke-dasharray": "4,4" } // Nét đứt
                        });
                    } else if (type === 'x') {
                        // CASE B: Tiệm cận ĐỨNG (x=1)
                        // Phải dùng dạng hàm ẩn (implicit): x - val = 0
                        dataToPlot.push({
                            fn: `x - (${val})`, 
                            fnType: 'implicit',
                            color: '#dc2626',
                            attr: { "stroke-dasharray": "4,4" }
                        });
                    }
                });
            }

            // ---------------------------------------------------------
            // 3. TIẾN HÀNH VẼ
            // ---------------------------------------------------------
            window.functionPlot({
              target: graphRef.current,
              width: 450, 
              height: 300, 
              grid: true,
              data: dataToPlot, // Đẩy toàn bộ dữ liệu đã xử lý vào đây
              xAxis: { domain: [-5, 5] },
              yAxis: { domain: [-5, 5] },
              tip: {
                  xLine: true,    // Hiện đường gióng khi di chuột
                  yLine: true,
              }
          });

        } catch (e) { 
            console.error("Lỗi vẽ đồ thị:", e);
            // Không hiển thị lỗi ra UI để tránh làm người dùng bối rối
        }
    }

    // [CLEANUP FUNCTION] - QUAN TRỌNG
    // React sẽ chạy hàm này khi component unmount hoặc trước khi chạy lại useEffect
    return () => {
        if (graphRef.current) {
            graphRef.current.innerHTML = ''; // Xóa sạch nội dung trong div
        }
    };

  }, [question.graphFunction, question.asymptotes, question.id]); 
  // Dependency: Chạy lại khi hàm số, tiệm cận hoặc ID câu hỏi thay đổi

  // Logic kiểm tra kết quả
// --- HÀM HỖ TRỢ LỌC ĐÁP ÁN SẠCH ---
const getCleanAIAnswer = (raw: string): string => {
    if (!raw) return "";
    // Sử dụng Regex để tìm chữ cái A, B, C, hoặc D đầu tiên xuất hiện
    const match = raw.match(/[A-D]/i); 
    return match ? match[0].toUpperCase() : raw.trim().toUpperCase().charAt(0);
};

// --- HÀM CHẤM ĐIỂM CHÍNH ---
const handleCheckResult = () => {
    if (!userAnswer) return;
    
    let correct = false;

    // 1. Xử lý Trắc nghiệm (TN)
    if (question.type === 'TN') {
        const userClean = (userAnswer as string).trim().toUpperCase();
        // Sử dụng hàm lọc để lấy duy nhất 1 ký tự A, B, C, D từ AI
        const correctClean = getCleanAIAnswer(question.correctAnswer || '');
        
        correct = userClean === correctClean;
    } 
    
    // 2. Xử lý Điền số (TLN)
    else if (question.type === 'TLN') {
        // Chuẩn hóa dấu phẩy thành dấu chấm để parseFloat không lỗi
        const userVal = parseFloat((userAnswer as string).replace(',', '.'));
        const aiValMatch = (question.correctAnswer || '').replace(',', '.').match(/-?[\d.]+/);
        const aiVal = aiValMatch ? parseFloat(aiValMatch[0]) : NaN;
        
        if (!isNaN(userVal) && !isNaN(aiVal)) {
            // Cho phép sai số nhỏ 0.05 để tránh lỗi làm tròn của AI
            correct = Math.abs(userVal - aiVal) < 0.05;
        } else {
            // Nếu không phải số, so sánh chuỗi văn bản thuần
            correct = (userAnswer as string).trim().toLowerCase() === (question.correctAnswer || '').trim().toLowerCase();
        }
    } 
    
    // 3. Xử lý Đúng/Sai (DS)
    else if (question.type === 'DS') {
        // Kiểm tra xem tất cả các phát biểu có khớp với đáp án của AI không
        const allCorrect = question.statements?.every(stmt => 
           userAnswer[stmt.id] === stmt.isCorrect
        );
        correct = !!allCorrect;
    }

    // Cập nhật trạng thái hiển thị
    setIsChecked(true);
    setIsCorrect(correct);
    
    // Phát âm thanh phản hồi (Đảm bảo đã sửa let audio ở hàm playSound)
    playSound(correct); 
    
    // Cập nhật điểm số lên App.tsx
    if (onUpdateScore) onUpdateScore(correct);

    // Đồng bộ dữ liệu câu hỏi (lưu câu trả lời của người dùng)
    if (onDataChange) {
        onDataChange({
            ...question,
            userAnswer: userAnswer,
            isCorrect: correct
        });
    }
    };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded text-sm">Câu {index + 1}</span>
            <span className="text-gray-500 text-xs border border-gray-300 px-2 py-1 rounded font-medium whitespace-nowrap min-w-fit">
                {question.type} - {question.difficulty === 'BIET' ? 'Biết' : question.difficulty === 'HIEU' ? 'Hiểu' : 'Vận dụng'}
            </span>
        </div>
        {isChecked && (
             <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold animate-pulse ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isCorrect ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {question.type === 'DS' ? (isCorrect ? 'Hoàn thành' : 'Chưa đúng') : (isCorrect ? 'Chính xác!' : 'Sai rồi!')}
             </div>
        )}
      </div>

      <div className="text-lg text-gray-800 mb-4 leading-relaxed whitespace-pre-wrap">
        <LatexText text={question.questionText.replace(/\\n/g, '\n')} />
      </div>

    {/* --- SỬA LẠI KHU VỰC NÀY ĐỂ TRÁNH TRÙNG LẶP --- */}
    {/* KHU VỰC VẼ HÌNH ẢNH MINH HỌA */}
    {/* Chỉ hiển thị div bao ngoài nếu có ít nhất 1 loại dữ liệu hình ảnh để tránh khoảng trắng thừa */}
    {(question.geometryGraph || (question.variationTableData && question.variationTableData.xNodes.length > 0) || question.graphFunction) && (
        <div className="space-y-6 flex justify-center mb-6">
            {(() => {
                // CASE 1: HÌNH HỌC (Ưu tiên cao nhất)
                if (question.geometryGraph) {
                    return (
                        <div className="border rounded-lg p-4 bg-gray-50 shadow-inner w-full max-w-md">
                            <DynamicGeometry graph={question.geometryGraph} />
                        </div>
                    );
                }

                // CASE 2: BẢNG BIẾN THIÊN
                if (question.variationTableData && question.variationTableData.xNodes.length > 0) {
                    return <VariationTable data={question.variationTableData} />;
                }

                // CASE 3: ĐỒ THỊ HÀM SỐ
                if (question.graphFunction) {
                    return (
                        <div ref={graphRef} className="bg-white border-2 border-gray-300 rounded-lg shadow-sm overflow-hidden" />
                    );
                }

                // KHÔNG CÓ DỮ LIỆU -> KHÔNG RENDER GÌ CẢ (Clean UI)
                return null;
            })()}
        </div>
    )}
    {/* ------------------------------------------------ */}    

      {/* 1. TRẮC NGHIỆM */}
      {question.type === 'TN' && question.options && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {question.options.map((opt, i) => {
            const label = String.fromCharCode(65 + i); 
            const isSelected = userAnswer === label;
            
            // --- THAY ĐỔI 1: NỀN VÀNG NHẠT CHO ĐÁP ÁN ---
            // Sửa class mặc định: Thêm bg-yellow-50 (nền vàng nhạt), border-yellow-200 (viền vàng nhẹ)
            // Thay hover:bg-gray-50 thành hover:bg-yellow-100 (vàng đậm hơn khi di chuột)
            let css = "p-3 border border-yellow-200 rounded-lg text-left bg-yellow-50 hover:bg-yellow-100 flex gap-2 transition-all shadow-sm ";
            
            if (isChecked) {
                const aiChar = (question.correctAnswer || '').trim().toUpperCase().charAt(0);
                const isRightOption = aiChar === label;

                // Giữ nguyên logic tô màu Xanh/Đỏ khi đã kiểm tra
                if (isRightOption) css = "p-3 border-2 border-green-500 bg-green-50 text-green-800 font-bold flex gap-2 shadow-md";
                else if (isSelected) css = "p-3 border-2 border-red-500 bg-red-50 text-red-800 flex gap-2 opacity-100";
                else css += "opacity-50"; // Làm mờ các đáp án không chọn
            } else if (isSelected) {
                // Giữ nguyên logic tô màu Xanh dương khi đang chọn
                css = "p-3 border-2 border-blue-500 bg-blue-50 flex gap-2 shadow-md";
            }

            return (
              <button key={i} onClick={() => !isChecked && setUserAnswer(label)} className={css}>
                {/* --- THAY ĐỔI 2: FONT CHỮ VÀ MÀU SẮC TIỀN TỐ (A., B....) --- */}
                {/* font-serif: Font có chân trông trang trọng hơn */}
                {/* text-green-800: Màu xanh lá đậm */}
                {/* text-lg: Cỡ chữ lớn hơn một chút */}
                <span className="font-serif font-bold text-green-800 text-lg min-w-[25px] leading-none mt-1">
                    {label}.
                </span>
                <div className="flex-1 text-gray-800">
                    <LatexText text={opt.replace(/^[A-D]\.\s*/, '')} />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* 2. TỰ LUẬN */}
      {question.type === 'TLN' && (
          <div className="flex gap-2 mb-4">
              <input 
                  className="border-2 border-gray-300 p-3 rounded-lg flex-1 focus:border-blue-500 outline-none font-bold text-lg" 
                  placeholder="Nhập đáp số..." 
                  value={userAnswer || ''}
                  onChange={e => setUserAnswer(e.target.value)}
                  disabled={isChecked}
                  onKeyDown={(e) => e.key === 'Enter' && handleCheckResult()}
              />
          </div>
      )}

      {/* 3. ĐÚNG / SAI */}
      {question.type === 'DS' && question.statements && (
          <div className="mb-6 space-y-2">
            {question.statements.map((stmt) => {
                // @ts-ignore
                const currentVal = userAnswer?.[stmt.id]; 
                return (
                  <div key={stmt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 mr-4 text-sm font-medium"><LatexText text={stmt.content} /></div>
                    <div className="flex gap-2 shrink-0">
                      {['Đúng', 'Sai'].map((label) => {
                        const isTrueBtn = label === 'Đúng';
                        const isSelected = currentVal === isTrueBtn;
                        let btnClass = "px-4 py-1.5 rounded text-xs font-bold border transition-all ";
                        
                        if (isChecked) {
                            const isRightAns = stmt.isCorrect === isTrueBtn;
                            if (isRightAns) btnClass += "bg-green-100 text-green-700 border-green-500 ring-1 ring-green-500";
                            else if (isSelected) btnClass += "bg-red-100 text-red-700 border-red-500";
                            else btnClass += "opacity-40 bg-white text-gray-400";
                        } else {
                            if (isSelected) btnClass += isTrueBtn ? "bg-blue-600 text-white border-blue-600" : "bg-orange-500 text-white border-orange-500";
                            else btnClass += "bg-white text-gray-500 hover:bg-gray-100";
                        }
                        return (
                          <button key={label} disabled={isChecked} onClick={() => setUserAnswer({ ...userAnswer, [stmt.id]: isTrueBtn })} className={btnClass}>
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                );
            })}
          </div>
      )}

      {/* Footer */}
      <div className="border-t pt-4 flex justify-between items-center">
          {!isChecked ? (
              <button 
                onClick={handleCheckResult} 
                disabled={!userAnswer || (question.type === 'DS' && Object.keys(userAnswer).length < (question.statements?.length || 4))}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
              >
                <Send className="w-4 h-4" /> Kiểm tra
              </button>
          ) : (
              <div className="flex-1"></div>
          )}

          {isChecked && (
              <button onClick={() => setShowExplanation(!showExplanation)} className="text-blue-600 flex items-center gap-1 font-semibold hover:underline">
                  {showExplanation ? <EyeOff size={18}/> : <Eye size={18}/>} 
                  {showExplanation ? 'Ẩn lời giải' : 'Xem lời giải'}
              </button>
          )}
      </div>

      {showExplanation && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-gray-800 text-sm animate-in fade-in">
              <div className="font-bold mb-3 text-yellow-800 uppercase text-xs tracking-wider border-b border-yellow-200 pb-2">
                  Lời giải chi tiết
              </div>
              
              {/* --- BẮT ĐẦU SỬA ĐỔI --- */}
              <div className="leading-relaxed text-base">
                {question.explanation
                    // Bước 1: Chuẩn hóa xuống dòng (xử lý cả \n của JSON và \\n do AI gen)
                    .replace(/\\n/g, '\n')
                    .replace(/\\displaystyleint/g, '\\displaystyle \\int') // Tách tích phân
                    .replace(/\\displaystylelim/g, '\\displaystyle \\lim') // Tách giới hạn (phòng hờ)
                    .replace(/\\displaystylesum/g, '\\displaystyle \\sum') // Tách tổng (phòng hờ)
                    // Bước 2: Tách chuỗi thành mảng các dòng
                    .split('\n')
                    // Bước 3: Render từng dòng
                    .map((line, idx) => {
                        // Bỏ qua dòng trống nếu muốn
                        if (!line.trim()) return null; 
                        return (
                            <div key={idx} className="mb-3 last:mb-0 text-gray-800">
                                <LatexText text={line} />
                            </div>
                        );
                    })
                }
              </div>
              {/* --- KẾT THÚC SỬA ĐỔI --- */}
          </div>
      )}
    </div>
  );
};