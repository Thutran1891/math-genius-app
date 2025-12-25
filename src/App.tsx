import { useState, useEffect, useRef, useCallback } from 'react'; // Thêm useCallback
import { QuizInput } from './components/QuizInput';
import { QuestionCard } from './components/QuestionCard';
import { Login } from './components/Login';
import { History } from './components/History';
import { QuizConfig, Question } from './types';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { SubscriptionGuard } from './components/SubscriptionGuard';
import { RefreshCcw, Trophy, ArrowLeft, History as HistoryIcon, Save, BookOpen, X, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { LatexText } from './components/LatexText';
import { generateQuiz, generateTheory, generateQuizFromImages } from './geminiService';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<QuizConfig | null>(null);
  const [score, setScore] = useState(0);
  const [currentApiKey, setCurrentApiKey] = useState<string>("");
  const [viewHistory, setViewHistory] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  const [attemptCount, setAttemptCount] = useState(1);
  const [violationCount, setViolationCount] = useState(0);
  const [showToast, setShowToast] = useState(false);

  // --- HỆ THỐNG REFS CHỐNG GIAN LẬN "BẤT TỬ" ---
  const isTestingRef = useRef(false); 
  const isSavedRef = useRef(false);
  const lastViolationTime = useRef<number>(0);
  // [MỚI] Dùng Ref để đếm số lần vi phạm (Chính xác tuyệt đối)
  const violationCountRef = useRef(0);

  // --- STATE QUẢN LÝ LÝ THUYẾT ---
  const [showTheory, setShowTheory] = useState(false);
  const [theoryContent, setTheoryContent] = useState('');
  const [loadingTheory, setLoadingTheory] = useState(false);

    // Thêm vào vùng khai báo useState
    // Thêm vào cùng chỗ với các useRef khác trong App.tsx
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const maxTotalScore = questions.reduce((sum, q) => {
    if (q.type === 'DS') return sum + 4;
    if (q.type === 'TLN') return sum + 2; //
    return sum + 1;
  }, 0);


  const handleSaveResult = useCallback(async (forcedTime?: number) => {
    // Giữ nguyên logic kiểm tra của bạn
    if (!user || isSavedRef.current) return;
    
    isSavedRef.current = true;
    setIsSaved(true);
  
    // Logic tính điểm trực tiếp của bạn rất tốt, giữ nguyên:
    const currentScore = questions.reduce((sum, q) => {
      if (q.type === 'DS') {
        const userAns = (q.userAnswer || {}) as Record<string, boolean>;
        return sum + (q.statements?.filter(s => userAns[s.id] === s.isCorrect).length || 0);
      }
      if (q.type === 'TLN') {
        const uVal = parseFloat(q.userAnswer?.toString().replace(',', '.') || '');
        const cVal = parseFloat(q.correctAnswer?.toString().replace(',', '.') || '');
        return sum + (!isNaN(uVal) && !isNaN(cVal) && Math.abs(uVal - cVal) <= 0.01 ? 2 : 0);
      }
      return sum + (q.userAnswer === q.correctAnswer ? 1 : 0);
    }, 0);
  
    const finalTimeSpent = forcedTime !== undefined ? forcedTime : elapsedTime;
  
    try {
      const historyRef = collection(db, "users", user.uid, "examHistory");
      await addDoc(historyRef, {
        topic: config?.topic || "Đề thi",
        score: currentScore,
        total: maxTotalScore,
        timeSpent: finalTimeSpent,
        timeLimit: config?.timeLimit || 15,
        date: serverTimestamp(),
        fullData: JSON.stringify(questions),
        violationCount: violationCountRef.current
      });
      
      if (timerRef.current) clearInterval(timerRef.current);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (e) {
      console.error("Lỗi khi lưu:", e);
      isSavedRef.current = false;
      setIsSaved(false);
    }
  // Quan trọng: Thêm questions vào mảng này để hàm luôn lấy dữ liệu mới nhất
  }, [user, questions, elapsedTime, config, maxTotalScore]);
  

  // useEffect xử lý bộ đếm
  // Logic đếm giờ và Tự động khóa bài
  useEffect(() => {
    // Điều kiện: Có câu hỏi, chưa lưu điểm và không phải đang xem lịch sử
    if (questions.length > 0 && !isSaved && !viewHistory) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          const limitInSeconds = (config?.timeLimit || 15) * 60;
  
          // --- TỰ ĐỘNG LƯU VÀ KHÓA BÀI KHI HẾT GIỜ ---
          if (newTime >= limitInSeconds) {
            if (timerRef.current) clearInterval(timerRef.current);
            
            // Truyền newTime trực tiếp để History ghi nhận đúng thời gian giới hạn
            handleSaveResult(newTime); 
            
            return limitInSeconds;
          }
          return newTime;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    
    // THAY ĐỔI QUAN TRỌNG: Theo dõi toàn bộ mảng 'questions' thay vì chỉ '.length'
    // Điều này đảm bảo mỗi khi người dùng chọn đáp án, useEffect sẽ biết 
    // và chuẩn bị hàm handleSaveResult với dữ liệu mới nhất.
  }, [questions, isSaved, viewHistory, config?.timeLimit, handleSaveResult]);

  // Hàm định dạng hiển thị mm:ss
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' + s : s}`;
  };

  // Đồng bộ State React sang Ref liên tục
  useEffect(() => {
    isTestingRef.current = questions.length > 0 && !isSaved && !viewHistory;
    isSavedRef.current = isSaved;
  }, [questions.length, isSaved, viewHistory]);

  // --- THUẬT TOÁN CHỐNG GIAN LẬN (PHIÊN BẢN FIX LỖI ĐẾM 1 LẦN) ---
  useEffect(() => {
    const handleViolation = () => {
      // 1. Kiểm tra điều kiện: Phải đang thi và chưa lưu
      if (!isTestingRef.current || isSavedRef.current) return;

      const now = Date.now();
      // Giảm Debounce xuống 500ms để nhạy hơn nhưng vẫn tránh đếm trùng
      if (now - lastViolationTime.current < 500) return;

      // 2. Tăng biến đếm trong Ref trước (Đảm bảo luôn tăng)
      violationCountRef.current += 1;
      
      // 3. Cập nhật ra giao diện (Lấy giá trị từ Ref ném ra State)
      setViolationCount(violationCountRef.current);
      
      lastViolationTime.current = now;
    };

    const onVisibilityChange = () => {
      if (document.hidden) handleViolation();
    };

    const onBlur = () => {
      handleViolation();
    };

    // Gắn sự kiện 1 lần duy nhất - Bất chấp chia đôi màn hình
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  }, []); // Dependency rỗng -> Sự kiện luôn sống

  // Hàm reset thông số khi tạo đề mới
  const resetQuizState = () => {
    setScore(0);
    setIsSaved(false);
    isSavedRef.current = false;
    setAttemptCount(prev => prev + 1); // Tăng số lần làm bài
    setElapsedTime(0); // <--- THÊM DÒNG NÀY ĐỂ RESET BỘ ĐẾM VỀ 0
    
    // [QUAN TRỌNG] Reset bộ đếm vi phạm về 0
    setViolationCount(0);
    violationCountRef.current = 0; 
    lastViolationTime.current = 0;
    
    // setQuestions([]);
    // setTheoryContent('');
  };

  const handleGenerateFromImage = async (images: File[], mode: 'EXACT' | 'SIMILAR', prompt: string, apiKey: string, topicName?: string) => {
    setLoading(true);
    setCurrentApiKey(apiKey);
    resetQuizState(); // Gọi hàm reset

    const defaultName = mode === 'EXACT' ? "Đề gốc từ ảnh" : "Đề tương tự từ ảnh";
    const finalTopic = topicName && topicName.trim() !== "" ? topicName : defaultName;

    setConfig({
        topic: finalTopic,
        distribution: {
          TN: { BIET: 0, HIEU: 0, VANDUNG: 0 },
          TLN: { BIET: 0, HIEU: 0, VANDUNG: 0 },
          DS: { BIET: 0, HIEU: 0, VANDUNG: 0 }
        },
        additionalPrompt: prompt,
        timeLimit: 15 // Thêm dòng này (mặc định 15 phút cho đề từ ảnh)
    });  

    try {
      const result = await generateQuizFromImages(images, mode, apiKey, prompt);
      setQuestions(result);
      if (result.length === 0) {
          alert("AI không tìm thấy câu hỏi nào trong ảnh. Vui lòng thử ảnh khác rõ nét hơn.");
      }
    } catch (error: any) {
      console.error("Lỗi tạo đề từ ảnh:", error);
      alert("Lỗi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleToggleTheory = async () => {
    setShowTheory(true);
    if (theoryContent || !config?.topic || !currentApiKey) return;

    setLoadingTheory(true);
    try {
      const content = await generateTheory(config.topic, currentApiKey);
      setTheoryContent(content);
    } catch (error) {
      console.error(error);
      setTheoryContent("Không thể tải lý thuyết. Vui lòng thử lại.");
    } finally {
      setLoadingTheory(false);
    }
  };

  const handleGenerate = async (newConfig: QuizConfig, apiKey: string) => {
    setLoading(true);
    setConfig(newConfig);
    setCurrentApiKey(apiKey);
    resetQuizState(); // Gọi hàm reset
    try {
      const result = await generateQuiz(newConfig, apiKey);
      setQuestions(result);
    } catch (error: any) {
      alert("Lỗi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = () => {
    if (config && currentApiKey) handleGenerate(config, currentApiKey);
  };

  const handleLoadExamFromHistory = (oldQuestions: Question[], topic: string) => {
    resetQuizState(); // Gọi hàm reset
    setLoading(false);

    setConfig({
      topic: topic,
      distribution: { 
        TN: { BIET: 0, HIEU: 0, VANDUNG: 0 }, 
        TLN: { BIET: 0, HIEU: 0, VANDUNG: 0 }, 
        DS: { BIET: 0, HIEU: 0, VANDUNG: 0 } 
      },
      additionalPrompt: "",
      timeLimit: 15 // Thêm dòng này
    });

    const cleanQuestions = oldQuestions.map(q => ({
      ...q,
      userAnswer: undefined,
      isCorrect: undefined
    }));

    setQuestions(cleanQuestions);
    setViewHistory(false);
  };

  // Thay đổi tham số từ boolean sang number (điểm số)
const handleUpdateScore = (points: number) => {
  setScore(prev => prev + points);
};

  const handleQuestionUpdate = (updatedQ: Question) => {
    setQuestions(prev => prev.map(q => q.id === updatedQ.id ? updatedQ : q));
  };

    // Thêm đoạn này dưới các dòng khai báo useState
  // const maxTotalScore = questions.reduce((sum, q) => {
  //   if (q.type === 'DS') return sum + 4;
  //   return sum + 1;
  // }, 0);
  
// Trong App.tsx

  // 1. Cập nhật hàm handleSaveResult để nhận tham số thời gian chủ động
  // 1. Nhớ thêm useCallback vào dòng import từ 'react'

  if (!user) return <Login />;

  if (viewHistory) {
    return (
      <History 
          onBack={() => setViewHistory(false)} 
          onLoadExam={handleLoadExamFromHistory} 
      />
    );
  }


  return (
    <SubscriptionGuard>
      <div className="min-h-screen py-8 px-4 font-sans bg-slate-50">
        
        {/* --- TOAST NOTIFICATION --- */}
        {showToast && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[100] animate-in slide-in-from-top duration-100">
                <CheckCircle className="w-6 h-6 text-white" />
                <span className="font-bold text-sm">Đã lưu kết quả vào Lịch sử!</span>
            </div>
        )}

        {questions.length === 0 ? (
          <>
            <div className="max-w-2xl mx-auto mb-4 flex justify-end">
               <button onClick={() => setViewHistory(true)} className="flex items-center gap-2 text-blue-600 font-bold hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors">
                  <HistoryIcon size={20}/> Xem Lịch sử
               </button>
            </div>
            <QuizInput 
              onGenerate={handleGenerate} 
              onGenerateFromImage={handleGenerateFromImage} 
              isLoading={loading} 
            />
          </>
        ) : (
          <div className="max-w-3xl mx-auto animate-fade-in relative">
            
            {/* Header */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 mb-6 flex flex-col sm:flex-row justify-between items-center sticky top-2 z-10 gap-3">
              <div className="flex-1">
                <h2 className="font-bold text-lg text-gray-800 line-clamp-1">
                    {config?.topic} {attemptCount > 1 && <span className="text-red-500 text-base font-normal">(Làm lại lần {attemptCount})</span>}
                </h2>
                <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                  {/* ĐỒNG HỒ ĐẾM XUÔI */}
                  <span className={`flex items-center gap-1 font-mono font-bold px-2 py-1 rounded ${elapsedTime >= (config?.timeLimit || 0) * 60 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-blue-700'}`}>
                    <Clock size={14} /> {formatTime(elapsedTime)} / {config?.timeLimit}:00
                  </span>
                <span className="flex items-center gap-1">
                  <Trophy size={16} className="text-yellow-500" /> 
                  Điểm: <b className="text-primary">{score}/{maxTotalScore}</b>
                  <span className="ml-1 text-green-600 font-bold">
                    ({maxTotalScore > 0 ? ((score / maxTotalScore) * 10).toFixed(1) : "0.0"}đ)
                  </span>
                </span>
                  
                  {/* Hiển thị số lỗi vi phạm */}
                  {violationCount > 0 && (
                      <span className="flex items-center gap-1 text-red-600 font-bold bg-red-100 px-2 py-1 rounded border border-red-200 animate-pulse">
                          <AlertTriangle size={14} /> Rời tab: {violationCount} lần
                      </span>
                  )}
                  
                  {!isSaved ? (
                    <button 
                      onClick={() => handleSaveResult()} 
                      className="flex items-center gap-1 text-green-600 hover:text-green-700 font-bold bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg border border-green-200 shadow-sm transition-colors"
                    >
                        <Save size={16}/> 
                        <span>Lưu điểm</span>
                    </button>
                ) : (
                    <span className="text-green-600 text-sm font-bold flex items-center gap-1 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 opacity-60">
                        <CheckCircle size={16}/> Đã lưu
                    </span>
                )}
                </div>
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={handleToggleTheory}
                  className="flex-1 sm:flex-none justify-center px-3 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg text-sm font-bold flex items-center gap-2 border border-orange-200 transition-colors"
                >
                  <BookOpen size={18}/> <span className="hidden sm:inline">Lý thuyết</span>
                </button>

                <button onClick={() => setQuestions([])} className="flex-1 sm:flex-none justify-center px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium flex items-center gap-1 border border-transparent hover:border-gray-200">
                  <ArrowLeft size={16}/> <span className="hidden sm:inline">Thoát</span>
                </button>
                
                <button onClick={handleRegenerate} disabled={loading} className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 shadow-sm">
                  <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
                  {loading ? "Đang tạo..." : <span className="hidden sm:inline">Đổi đề</span>}
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-6 pb-20">
              {questions.map((q, idx) => (
                <QuestionCard 
                  key={q.id || idx} 
                  index={idx} 
                  question={q} 
                  onUpdateScore={handleUpdateScore} 
                  onDataChange={handleQuestionUpdate}
                  isLocked={isSaved} // <-- TRUYỀN GIÁ TRỊ TẠI ĐÂY
                />
              ))}
            </div>

            {/* Theory Modal */}
            {showTheory && (
              <div className="fixed top-24 right-5 w-[450px] max-w-[90vw] h-[80vh] bg-white rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.15)] border border-gray-200 z-50 flex flex-col animate-in slide-in-from-right duration-300">
                  <div className="p-4 border-b flex justify-between items-center bg-orange-50 rounded-t-2xl">
                      <h3 className="text-lg font-bold text-orange-800 flex items-center gap-2">
                          <BookOpen size={20}/> KIẾN THỨC: {config?.topic}
                      </h3>
                      <button 
                          onClick={() => setShowTheory(false)} 
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm border border-gray-100"
                      >
                          <X size={18} />
                      </button>
                  </div>

                  <div className="p-5 overflow-y-auto flex-1 text-gray-800 leading-relaxed text-sm scroll-smooth">
                      {loadingTheory ? (
                          <div className="flex flex-col items-center justify-center h-full space-y-3">
                              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                              <p className="text-gray-500 text-xs animate-pulse">Đang tra cứu kiến thức...</p>
                          </div>
                      ) : (
                          <div className="whitespace-pre-wrap">
                              <LatexText text={theoryContent} />
                          </div>
                      )}
                  </div>                  
              </div>
            )}

          </div>
        )}    
      </div>
    </SubscriptionGuard>
  );  
}

export default App;