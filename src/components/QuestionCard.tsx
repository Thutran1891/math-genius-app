import React, { useState, useEffect, useRef, useMemo } from 'react';
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

  // --- [NEW] HÀM TÌM ĐÁP ÁN THÔNG MINH (DÙNG CHUNG CHO CẢ CHẤM ĐIỂM VÀ HIỂN THỊ) ---
  // Sử dụng useMemo để không phải tính toán lại liên tục
  const smartCorrectAnswer = useMemo(() => {
    if (question.type !== 'TN') return question.correctAnswer || '';

    let aiRaw = (question.correctAnswer || '').trim();

    // 1. CƠ CHẾ BACKUP: Nếu AI quên trả về đáp án, tự tìm trong lời giải
    if (!aiRaw || aiRaw.length === 0) {
        const explanationMatch = question.explanation.match(/(?:chọn|đáp án|phương án|kết quả|đúng là).*?([A-D])(?:$|\.| )/i);
        if (explanationMatch) {
            aiRaw = explanationMatch[1];
        }
    }

    // 2. CHUẨN HÓA: Dùng Regex để lấy đúng ký tự A, B, C, D
    const match = aiRaw.match(/(?:^|[\s*:.])([A-D])(?:$|[\s*:.])/i);
    return match ? match[1].toUpperCase() : aiRaw.toUpperCase().charAt(0);
  }, [question.correctAnswer, question.explanation, question.type]);
  // ----------------------------------------------------------------------------------

  // Reset state khi chuyển câu hỏi
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
    if (onUpdateScore) { 
        const audio = new Audio(correct ? '/correct.mp3' : '/wrong.mp3');
        audio.volume = 1.0; 
        audio.onended = () => { (audio as any) = null; };
        audio.play().catch(() => {});
    }
  };

  // --- LOGIC VẼ ĐỒ THỊ & TIỆM CẬN ---
  useEffect(() => {
    if ((question.graphFunction || question.asymptotes) && graphRef.current && window.functionPlot) {
        try {
            graphRef.current.innerHTML = '';
            const dataToPlot: any[] = [];

            if (question.graphFunction) {
                let fn = question.graphFunction
                    .replace(/\$/g, '')
                    .replace(/\^/g, '**')
                    .replace(/\\/g, '')
                    .replace(/ln\(/g, 'log(')
                    .replace(/e\*\*/g, 'exp(')
                    .replace(/\b(sin|cos|tan|cot|sqrt|abs|log|exp)\b/g, 'Math.$1') 
                    .replace(/Math\.Math\./g, 'Math.')
                    .trim();

                dataToPlot.push({
                    fn: fn, sampler: 'builtIn', graphType: 'polyline', color: '#2563eb', range: [-10, 10]
                });
            }

            if (question.asymptotes && question.asymptotes.length > 0) {
                question.asymptotes.forEach(asym => {
                    const cleanAsym = asym.replace(/\s/g, '').toLowerCase();
                    const parts = cleanAsym.split('=');
                    if (parts.length !== 2) return;

                    const type = parts[0]; 
                    let val = parts[1]
                        .replace(/\^/g, '**')
                        .replace(/\\/g, '')
                        .replace(/ln\(/g, 'log(')
                        .replace(/\b(sin|cos|tan|sqrt|abs|log|exp)\b/g, 'Math.$1')
                        .replace(/Math\.Math\./g, 'Math.');

                    if (type === 'y') {
                        dataToPlot.push({
                            fn: val, graphType: 'polyline', color: '#dc2626', attr: { "stroke-dasharray": "4,4" }
                        });
                    } else if (type === 'x') {
                        dataToPlot.push({
                            fn: `x - (${val})`, fnType: 'implicit', color: '#dc2626', attr: { "stroke-dasharray": "4,4" }
                        });
                    }
                });
            }

            window.functionPlot({
              target: graphRef.current,
              width: 450, height: 300, grid: true,
              data: dataToPlot,
              xAxis: { domain: [-5, 5] },
              yAxis: { domain: [-5, 5] },
              tip: { xLine: true, yLine: true }
          });
        } catch (e) { console.error("Lỗi vẽ đồ thị:", e); }
    }
    return () => { if (graphRef.current) graphRef.current.innerHTML = ''; };
  }, [question.graphFunction, question.asymptotes, question.id]); 

  // Logic kiểm tra kết quả
  const handleCheckResult = () => {
      if (!userAnswer) return;
      
      let correct = false;
      if (question.type === 'TN') {
          const userClean = (userAnswer as string).trim().toUpperCase();
          // [UPDATED] So sánh với đáp án thông minh đã tính toán ở trên
          correct = userClean === smartCorrectAnswer;

      } else if (question.type === 'TLN') {
          const userVal = parseFloat((userAnswer as string).replace(',', '.'));
          const aiValMatch = (question.correctAnswer || '').replace(',', '.').match(/-?[\d.]+/);
          const aiVal = aiValMatch ? parseFloat(aiValMatch[0]) : NaN;
          
          if (!isNaN(userVal) && !isNaN(aiVal)) {
              correct = Math.abs(userVal - aiVal) <= 0.15; // Giữ độ lệch an toàn
          } else {
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
      if (onDataChange) onDataChange({ ...question, userAnswer: userAnswer, isCorrect: correct });
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

    {(question.geometryGraph || (question.variationTableData && question.variationTableData.xNodes.length > 0) || question.graphFunction) && (
        <div className="space-y-6 flex justify-center mb-6">
            {(() => {
                if (question.geometryGraph) return <div className="border rounded-lg p-4 bg-gray-50 shadow-inner w-full max-w-md"><DynamicGeometry graph={question.geometryGraph} /></div>;
                if (question.variationTableData && question.variationTableData.xNodes.length > 0) return <VariationTable data={question.variationTableData} />;
                if (question.graphFunction) return <div ref={graphRef} className="bg-white border-2 border-gray-300 rounded-lg shadow-sm overflow-hidden" />;
                return null;
            })()}
        </div>
    )}

      {/* 1. TRẮC NGHIỆM */}
      {question.type === 'TN' && question.options && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {question.options.map((opt, i) => {
            const label = String.fromCharCode(65 + i); 
            const isSelected = userAnswer === label;
            
            let css = "p-3 border border-yellow-200 rounded-lg text-left bg-yellow-50 hover:bg-yellow-100 flex gap-2 transition-all shadow-sm ";
            
            if (isChecked) {
                // [UPDATED] Sử dụng smartCorrectAnswer để tô màu (đồng bộ với logic chấm điểm)
                const isRightOption = smartCorrectAnswer === label;

                if (isRightOption) css = "p-3 border-2 border-green-500 bg-green-50 text-green-800 font-bold flex gap-2 shadow-md";
                else if (isSelected) css = "p-3 border-2 border-red-500 bg-red-50 text-red-800 flex gap-2 opacity-100";
                else css += "opacity-50"; 
            } else if (isSelected) {
                css = "p-3 border-2 border-blue-500 bg-blue-50 flex gap-2 shadow-md";
            }

            return (
              <button key={i} onClick={() => !isChecked && setUserAnswer(label)} className={css}>
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
              <div className="flex-1 text-sm">
                  <span className="font-bold text-gray-500">Đáp án: </span> 
                  {/* Hiển thị đáp án thông minh đã tìm được */}
                  <span className="font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">
                      {question.type === 'TN' ? smartCorrectAnswer : (question.correctAnswer || "Xem lời giải")}
                  </span>
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
              <div className="font-bold mb-3 text-yellow-800 uppercase text-xs tracking-wider border-b border-yellow-200 pb-2">
                  Lời giải chi tiết
              </div>
              
              <div className="leading-relaxed text-base">
                {question.explanation
                    .replace(/\\n/g, '\n')
                    .replace(/\\displaystyleint/g, '\\displaystyle \\int')
                    .replace(/\\displaystylelim/g, '\\displaystyle \\lim')
                    .replace(/\\displaystylesum/g, '\\displaystyle \\sum')
                    .split('\n')
                    .map((line, idx) => {
                        if (!line.trim()) return null; 
                        return (
                            <div key={idx} className="mb-3 last:mb-0 text-gray-800">
                                <LatexText text={line} />
                            </div>
                        );
                    })
                }
              </div>
          </div>
      )}
    </div>
  );
};