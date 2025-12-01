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
}

export const QuestionCard: React.FC<Props> = ({ question, index, onUpdateScore }) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const [userAnswer, setUserAnswer] = useState<any>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const graphRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUserAnswer(question.type === 'DS' ? {} : '');
    setIsChecked(false);
    setIsCorrect(false);
    setShowExplanation(false);
  }, [question.id]);

  const playSound = (correct: boolean) => {
    const audio = new Audio(correct ? '/correct.mp3' : '/wrong.mp3');
    audio.volume = 1.0; 
    audio.play().catch(() => {});
  };

  // --- VẼ ĐỒ THỊ (ĐÃ SỬA LOGIC) ---
  useEffect(() => {
    if (question.graphFunction && graphRef.current && window.functionPlot) {
        try {
            graphRef.current.innerHTML = '';
            
            // SỬA LỖI Ở ĐÂY:
            // 1. Xóa dấu $
            // 2. Thay thế dấu nhân bị sót (3x -> 3*x) - Logic đơn giản
            // 3. QUAN TRỌNG: Chuyển '**' (JS) thành '^' (Toán) vì function-plot cần dấu ^
            let fn = question.graphFunction
                .replace(/\$/g, '')       // Xóa $
                .replace(/\*\*/g, '^')    // Đổi ** thành ^
                .replace(/\\/g, '');      // Xóa dấu gạch chéo ngược nếu có
            
            // Fix lỗi khoảng trắng
            fn = fn.trim();

            window.functionPlot({
                target: graphRef.current,
                width: 450, 
                height: 300, 
                grid: true,
                data: [{ 
                    fn: fn, 
                    sampler: 'builtIn', 
                    graphType: 'polyline',
                    color: '#2563eb' // Màu xanh
                }],
                xAxis: { domain: [-5, 5] }, // Giới hạn trục X
                yAxis: { domain: [-5, 5] }  // Giới hạn trục Y
            });
        } catch (e) { 
            console.error("Lỗi vẽ đồ thị:", e); 
            // Hiện thông báo lỗi nhỏ nếu không vẽ được
            graphRef.current.innerHTML = `<div class="text-red-500 text-xs p-2 bg-red-50 border border-red-200 rounded">Lỗi công thức: ${question.graphFunction}</div>`;
        }
    }
  }, [question.graphFunction, question.id]);


  // --- LOGIC CHẤM ĐIỂM THÔNG MINH ---
  const handleCheckResult = () => {
      if (!userAnswer) return;
      
      let correct = false;
      
      if (question.type === 'TN') {
          const userLabel = (userAnswer as string).trim().toUpperCase(); // VD: "A", "B"
          const aiAnswer = (question.correctAnswer || '').trim(); // VD: "A", "A. -4", "-4"

          // 1. Nếu AI trả về dạng "A" hoặc "A. ..." -> So sánh chữ cái đầu
          if (/^[A-D]/.test(aiAnswer)) {
              correct = aiAnswer.toUpperCase().startsWith(userLabel);
          } 
          // 2. Nếu AI trả về nội dung (VD: "-4") -> So sánh nội dung với option người dùng chọn
          else {
              // Tìm xem userLabel ("B") ứng với nội dung gì trong options
              const labelIndex = userLabel.charCodeAt(0) - 65; // A->0, B->1...
              const selectedOptionContent = question.options?.[labelIndex] || "";
              
              // Làm sạch chuỗi để so sánh (bỏ A., bỏ khoảng trắng)
              const cleanAi = aiAnswer.replace(/\s/g, '').toLowerCase();
              const cleanUser = selectedOptionContent.replace(/^[A-D]\.\s*/, '').replace(/\s/g, '').toLowerCase();
              
              correct = cleanUser === cleanAi || cleanUser.includes(cleanAi);
          }

      } else if (question.type === 'TLN') {
          // So sánh số: Chấp nhận sai số nhỏ
          const userVal = parseFloat((userAnswer as string).replace(',', '.'));
          // Trích xuất số từ đáp án AI (đề phòng AI trả về text "Khoảng 5")
          const aiVal = parseFloat((question.correctAnswer || '').replace(',', '.').match(/-?[\d.]+/)?.[0] || "0");
          
          if (!isNaN(userVal) && !isNaN(aiVal)) {
              correct = Math.abs(userVal - aiVal) < 0.05; // Sai số 0.05
          } else {
              // So sánh chuỗi nếu không phải số
              correct = (userAnswer as string).trim().toLowerCase() === (question.correctAnswer || '').trim().toLowerCase();
          }

      } else if (question.type === 'DS') {
          const allCorrect = question.statements?.every(stmt => 
             userAnswer[stmt.id] === stmt.isCorrect
          );
          correct = !!allCorrect;
      }

      setIsChecked(true);
      setIsCorrect(correct);
      playSound(correct);
      if (onUpdateScore) onUpdateScore(correct);
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded text-sm">Câu {index + 1}</span>
            <span className="text-gray-400 text-xs border px-2 py-1 rounded">{question.type}</span>
        </div>
        {isChecked && (
             <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold animate-pulse ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isCorrect ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {isCorrect ? (question.type === 'DS' ? 'Đã hoàn thành' : 'Chính xác!') : 'Chưa chính xác'}
             </div>
        )}
      </div>

      <div className="text-lg text-gray-800 mb-4 leading-relaxed">
         <LatexText text={question.questionText} />
      </div>

      {/* VẼ HÌNH ẢNH */}
      <div className="flex justify-center mb-6 flex-col items-center gap-4">
          {question.variationTableData && <VariationTable data={question.variationTableData} />}
          {question.geometryGraph && (
              <div className="border rounded p-4 bg-gray-50 shadow-inner">
                  <DynamicGeometry graph={question.geometryGraph} />
              </div>
          )}
          {question.graphFunction && <div ref={graphRef} className="bg-white border rounded shadow-sm overflow-hidden" />}
      </div>

      {/* 1. TRẮC NGHIỆM (TN) */}
      {question.type === 'TN' && question.options && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {question.options.map((opt, i) => {
            const label = String.fromCharCode(65 + i); 
            const isSelected = userAnswer === label;
            
            // Logic hiển thị màu sắc đáp án ĐÚNG/SAI sau khi kiểm tra
            let css = "p-3 border rounded-lg text-left hover:bg-gray-50 flex gap-2 transition-all ";
            
            if (isChecked) {
                // Xác định đâu là đáp án đúng để tô xanh
                let isRightOption = false;
                const aiAnswer = (question.correctAnswer || '').trim();
                
                if (/^[A-D]/.test(aiAnswer)) {
                    isRightOption = aiAnswer.toUpperCase().startsWith(label);
                } else {
                    // Nếu AI trả về nội dung "-4", phải so sánh nội dung option này với "-4"
                    const cleanOpt = opt.replace(/^[A-D]\.\s*/, '').replace(/\s/g, '').toLowerCase();
                    const cleanAi = aiAnswer.replace(/\s/g, '').toLowerCase();
                    isRightOption = cleanOpt === cleanAi || cleanOpt.includes(cleanAi);
                }

                if (isRightOption) css = "p-3 border-2 border-green-500 bg-green-50 text-green-800 font-bold flex gap-2";
                else if (isSelected) css = "p-3 border-2 border-red-500 bg-red-50 text-red-800 flex gap-2"; // Người dùng chọn sai
                else css += "opacity-50"; // Các đáp án khác mờ đi
            } else if (isSelected) {
                css = "p-3 border-2 border-blue-500 bg-blue-50 flex gap-2";
            }

            return (
              <button key={i} onClick={() => !isChecked && setUserAnswer(label)} className={css}>
                <span className="font-bold min-w-[20px]">{label}.</span>
                <div className="flex-1"><LatexText text={opt.replace(/^[A-D]\.\s*/, '')} /></div>
              </button>
            )
          })}
        </div>
      )}

      {/* 2. TỰ LUẬN (TLN) */}
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

      {/* 3. ĐÚNG / SAI (DS) */}
      {question.type === 'DS' && question.statements && (
          <div className="mb-6 space-y-2">
            {question.statements.map((stmt) => {
                // @ts-ignore
                const currentVal = userAnswer?.[stmt.id]; 
                return (
                  <div key={stmt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
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
              <button onClick={handleCheckResult} disabled={!userAnswer || (question.type === 'DS' && Object.keys(userAnswer).length < (question.statements?.length || 4))} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95">
                <Send className="w-4 h-4" /> Kiểm tra
              </button>
          ) : (
              <div className="flex-1"></div>
          )}
          {isChecked && (
              <button onClick={() => setShowExplanation(!showExplanation)} className="text-blue-600 flex items-center gap-1 font-semibold hover:underline">
                  {showExplanation ? <EyeOff size={18}/> : <Eye size={18}/>} {showExplanation ? 'Ẩn lời giải' : 'Xem lời giải'}
              </button>
          )}
      </div>

      {showExplanation && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-gray-800 text-sm animate-in fade-in">
              <div className="font-bold mb-2 text-yellow-800 uppercase text-xs tracking-wider">Lời giải chi tiết</div>
              <div className="leading-relaxed"><LatexText text={question.explanation} /></div>
          </div>
      )}
    </div>
  );
};