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
  const [userAnswer, setUserAnswer] = useState<any>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const graphRef = useRef<HTMLDivElement>(null);

  // Khôi phục trạng thái khi xem lại hoặc reset khi qua câu mới
  useEffect(() => {
    if (question.userAnswer) {
        setUserAnswer(question.userAnswer);
        setIsChecked(true);
        setIsCorrect(!!question.isCorrect);
        setShowExplanation(false); 
    } else {
        setUserAnswer(question.type === 'DS' ? {} : '');
        setIsChecked(false);
        setIsCorrect(false);
        setShowExplanation(false);
    }
  }, [question.id, question.userAnswer]);

  const playSound = (correct: boolean) => {
    if (onUpdateScore) { // Chỉ phát tiếng khi đang làm bài
        const audio = new Audio(correct ? '/correct.mp3' : '/wrong.mp3');
        audio.volume = 1.0; 
        audio.play().catch(() => {});
    }
  };

  // Vẽ đồ thị hàm số 2D
  useEffect(() => {
    if (question.graphFunction && graphRef.current && window.functionPlot) {
        try {
            graphRef.current.innerHTML = '';
            let fn = question.graphFunction.replace(/\$/g, '').replace(/\^/g, '**');
            window.functionPlot({
                target: graphRef.current, width: 450, height: 300, grid: true,
                data: [{ fn: fn, sampler: 'builtIn', graphType: 'polyline' }]
            });
        } catch (e) {}
    }
  }, [question.graphFunction, question.id]);

  // --- LOGIC CHẤM ĐIỂM THÔNG MINH (ĐÃ SỬA) ---
  const handleCheckResult = () => {
      if (!userAnswer) return;
      
      let correct = false;
      
      if (question.type === 'TN') {
          // 1. Lấy chữ cái người dùng chọn (VD: "B")
          const userLabel = (userAnswer as string).trim().toUpperCase(); 
          
          // 2. Lấy đáp án từ AI và làm sạch (Bỏ dấu *, khoảng trắng thừa)
          let aiAnswer = (question.correctAnswer || '').trim().replace(/\*/g, ''); // VD: "B. -4" hoặc "B" hoặc "-4"

          // Cách 1: So sánh chữ cái đầu (Nếu AI trả về "B" hoặc "B. ...")
          const startWithLabel = aiAnswer.toUpperCase().startsWith(userLabel + ".") || aiAnswer.toUpperCase() === userLabel;

          if (startWithLabel) {
              correct = true;
          } else {
              // Cách 2: So sánh nội dung (Nếu AI chỉ trả về "-4" mà không có B)
              // Lấy nội dung của option người dùng chọn
              const labelIndex = userLabel.charCodeAt(0) - 65; // A->0, B->1
              const selectedOptionFull = question.options?.[labelIndex] || "";
              
              // Lọc lấy phần giá trị (Bỏ "B." ở đầu)
              const userValue = selectedOptionFull.replace(/^[A-D][).]\s*/, '').trim(); 
              
              // So sánh giá trị (Bỏ luôn dấu $ nếu có để so sánh số học)
              const v1 = userValue.replace(/\$/g, '').toLowerCase();
              const v2 = aiAnswer.replace(/\$/g, '').toLowerCase();
              
              correct = v1 === v2;
          }

      } else if (question.type === 'TLN') {
          const userVal = parseFloat((userAnswer as string).replace(',', '.'));
          // Lấy số đầu tiên tìm thấy trong chuỗi đáp án của AI
          const aiValMatch = (question.correctAnswer || '').replace(',', '.').match(/-?[\d.]+/);
          const aiVal = aiValMatch ? parseFloat(aiValMatch[0]) : NaN;
          
          if (!isNaN(userVal) && !isNaN(aiVal)) {
              correct = Math.abs(userVal - aiVal) < 0.05; // Chấp nhận sai số nhỏ
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
            <span className="text-gray-400 text-xs border px-2 py-1 rounded">{question.type}</span>
        </div>
        {isChecked && (
             <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold animate-pulse ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isCorrect ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {question.type === 'DS' ? (isCorrect ? 'Hoàn thành' : 'Chưa đúng') : (isCorrect ? 'Chính xác!' : 'Sai rồi!')}
             </div>
        )}
      </div>

      <div className="text-lg text-gray-800 mb-4 leading-relaxed">
         <LatexText text={question.questionText} />
      </div>

      <div className="flex justify-center mb-6 flex-col items-center gap-4">
          {question.variationTableData && <VariationTable data={question.variationTableData} />}
          {question.geometryGraph && (
              <div className="border rounded p-4 bg-gray-50 shadow-inner">
                  <DynamicGeometry graph={question.geometryGraph} />
              </div>
          )}
          {question.graphFunction && <div ref={graphRef} className="bg-white border rounded shadow-sm overflow-hidden" />}
      </div>

      {/* 1. TRẮC NGHIỆM */}
      {question.type === 'TN' && question.options && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {question.options.map((opt, i) => {
            const label = String.fromCharCode(65 + i); 
            const isSelected = userAnswer === label;
            let css = "p-3 border rounded-lg text-left hover:bg-gray-50 flex gap-2 transition-all ";
            
            if (isChecked) {
                // Logic tô màu đáp án
                let isRightOption = false;
                const aiAnswer = (question.correctAnswer || '').trim().replace(/\*/g, '');
                
                // Kiểm tra xem Option này có phải là đáp án đúng không (dựa trên logic Smart Matching ở trên)
                const startWithLabel = aiAnswer.toUpperCase().startsWith(label + ".") || aiAnswer.toUpperCase() === label;
                if (startWithLabel) {
                    isRightOption = true;
                } else {
                    const optContent = opt.replace(/^[A-D][).]\s*/, '').replace(/\$/g, '').trim().toLowerCase();
                    const aiContent = aiAnswer.replace(/\$/g, '').trim().toLowerCase();
                    if (optContent === aiContent) isRightOption = true;
                }

                if (isRightOption) css = "p-3 border-2 border-green-500 bg-green-50 text-green-800 font-bold flex gap-2";
                else if (isSelected) css = "p-3 border-2 border-red-500 bg-red-50 text-red-800 flex gap-2";
                else css += "opacity-50";
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
                            if (isRightAns) btnClass += "bg-green-100 text-green-700 border-green-500";
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
              <div className="flex-1 text-sm text-gray-500 italic">
                  {onUpdateScore ? "Đã hoàn thành" : "Chế độ xem lại"}
              </div>
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
              <div className="font-bold mb-2 text-yellow-800 uppercase text-xs tracking-wider">Lời giải chi tiết</div>
              <div className="leading-relaxed">
                <LatexText text={question.explanation} />
              </div>
          </div>
      )}
    </div>
  );
};