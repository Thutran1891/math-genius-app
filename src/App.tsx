import confetti from 'canvas-confetti';
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
// ... các state cũ ...
  const [sourceType, setSourceType] = useState<'TOPIC' | 'IMAGE'>('TOPIC');
  const [lastImages, setLastImages] = useState<File[]>([]); 
  const [imageMode, setImageMode] = useState<'EXACT' | 'SIMILAR'>('SIMILAR');   // Lưu ảnh để dùng lại khi đổi đề
    // Thêm vào cùng chỗ với các useRef khác trong App.tsx
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  // Âm thanh chúc mừng
  const [showPerfectScoreModal, setShowPerfectScoreModal] = useState(false);
  const maxTotalScore = questions.reduce((sum, q) => {
    if (q.type === 'DS') return sum + 4;
    if (q.type === 'TLN') return sum + 2; //
    return sum + 1;
  }, 0);


  const handleSaveResult = useCallback(async (forcedTime?: number) => {
    if (!user || isSavedRef.current) return;
  
    // 1. Chốt danh sách câu hỏi và tính toán isCorrect
    const finalizedQuestions = questions.map(q => {
      // Nếu đã bấm "Kiểm tra" lẻ, giữ nguyên
      if (q.isCorrect !== undefined) return q;
  
      let isCorrect = false;
      const userAns = q.userAnswer;
  
      if (userAns !== undefined && userAns !== null) {
        if (q.type === 'TN') {
          isCorrect = userAns === q.correctAnswer;
        } 
        else if (q.type === 'TLN') {
          const uVal = parseFloat(userAns.toString().replace(/\s/g, '').replace(',', '.'));
          const cVal = parseFloat(q.correctAnswer?.toString().replace(/\s/g, '').replace(',', '.') || '');
          isCorrect = !isNaN(uVal) && !isNaN(cVal) && Math.abs(uVal - cVal) <= 0.01;
        } 
        else if (q.type === 'DS') {
          const ansObj = (userAns || {}) as Record<string, boolean>;
          const correctCount = q.statements?.filter(s => ansObj[s.id] === s.isCorrect).length || 0;
          // Chốt câu DS là đúng hoàn toàn nếu đạt 4/4 ý
          isCorrect = (correctCount === 4);
        }
      }
      // QUAN TRỌNG: Trả về userAnswer để không mất dấu vết trên UI
      return { ...q, isCorrect, userAnswer: userAns };
    });
  
    // 2. TÍNH ĐIỂM TỔNG HỢP (Chấm theo từng ý cho câu DS)
    const currentScore = finalizedQuestions.reduce((sum, q) => {
      if (q.type === 'DS') {
        const ansObj = (q.userAnswer || {}) as Record<string, boolean>;
        const correctCount = q.statements?.filter(s => ansObj[s.id] === s.isCorrect).length || 0;
        return sum + correctCount; // Mỗi ý đúng của câu DS được 1 điểm
      }
      if (q.type === 'TLN') return sum + (q.isCorrect ? 2 : 0);
      return sum + (q.isCorrect ? 1 : 0);
    }, 0);
  
    // 3. Cập nhật State
    setQuestions(finalizedQuestions);
    setScore(currentScore);
    setIsSaved(true);
    isSavedRef.current = true;
  
    // App.tsx

// PHÁO HOA

if (currentScore > 0 && currentScore === maxTotalScore) {
  // 1. PHÁT ÂM THANH CHÚC MỪNG
  // Bạn hãy để file congrats.mp3 vào thư mục public của dự án
  const audio = new Audio('/congrats.mp3'); 
  audio.volume = 0.7;
  audio.play().catch(e => console.warn("Trình duyệt chặn phát âm thanh tự động:", e));

  // 2. HIỆU ỨNG PHÁO HOA
  const duration = 3 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

  const interval: any = setInterval(function() {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return clearInterval(interval);

    const particleCount = 50 * (timeLeft / duration);
    confetti({ ...defaults, particleCount, origin: { x: 0.2, y: 0.6 } });
    confetti({ ...defaults, particleCount, origin: { x: 0.8, y: 0.6 } });
  }, 250);

  // 3. HIỂN THỊ THÔNG BÁO XUẤT SẮC (Tùy chọn)
  // Bạn có thể dùng hàm alert đơn giản hoặc set một State để hiện Modal đẹp hơn
  setTimeout(() => {
    alert("🌟 XUẤT SẮC! Bạn đã đạt điểm tối đa 10/10! 🌟");
  }, 500);
  setShowPerfectScoreModal(true);
}

    // Lưu vào Firestore
    try {
      const finalTimeSpent = forcedTime !== undefined ? forcedTime : elapsedTime;
      const historyRef = collection(db, "users", user.uid, "examHistory");
      await addDoc(historyRef, {
        topic: config?.topic || "Đề thi",
        score: currentScore,
        total: maxTotalScore,
        timeSpent: finalTimeSpent,
        timeLimit: config?.timeLimit || 15,
        date: serverTimestamp(),
        fullData: JSON.stringify(finalizedQuestions),
        violationCount: violationCountRef.current
      });
      
      if (timerRef.current) clearInterval(timerRef.current);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (e) {
      console.error("Lỗi khi lưu:", e);
      setIsSaved(false);
      isSavedRef.current = false;
    }
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
    // setAttemptCount(prev => prev + 1); // Tăng số lần làm bài
    setElapsedTime(0); // <--- THÊM DÒNG NÀY ĐỂ RESET BỘ ĐẾM VỀ 0
    // Đảm bảo lần đầu tạo luôn là 1
    setAttemptCount(1);
    
    // [QUAN TRỌNG] Reset bộ đếm vi phạm về 0
    setViolationCount(0);
    violationCountRef.current = 0; 
    lastViolationTime.current = 0;
    
    // setQuestions([]);
    // setTheoryContent('');
  };

  const handleGenerateFromImage = async (
    images: File[], 
    mode: 'EXACT' | 'SIMILAR', 
    prompt: string, 
    apiKey: string, 
    timeLimit: number, 
    topicName?: string
  ) => {
    setLoading(true);
    setCurrentApiKey(apiKey); // QUAN TRỌNG: Lưu Key ngay lập tức để nút Đổi đề có thể dùng
    resetQuizState(); 
  
    // Lưu thông tin để nút "Đổi đề" biết phải làm gì
    setSourceType('IMAGE');    
    setLastImages(images);     
    setImageMode(mode);        
  
    const defaultName = mode === 'EXACT' ? "Đề gốc từ ảnh" : "Đề tương tự từ ảnh";
    const finalTopic = topicName && topicName.trim() !== "" ? topicName : defaultName;
  
    // Cập nhật config để hiển thị tiêu đề và thời gian
    setConfig({
      topic: finalTopic,
      distribution: { 
        TN: { BIET: 0, HIEU: 0, VANDUNG: 0 }, 
        TLN: { BIET: 0, HIEU: 0, VANDUNG: 0 }, 
        DS: { BIET: 0, HIEU: 0, VANDUNG: 0 } 
      },
      additionalPrompt: prompt,
      timeLimit: timeLimit || 15
    });  
  
    try {
      // Gọi API với apiKey truyền trực tiếp từ tham số
      const result = await generateQuizFromImages(images, mode, apiKey, prompt);
      setQuestions(result);
    } catch (error: any) {
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
    setSourceType('TOPIC'); // Đánh dấu là tạo từ chủ đề
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

  const handleRegenerate = async () => {
    // Kiểm tra API Key đã được lưu từ bước trên chưa
    if (!currentApiKey) {
      alert("Không tìm thấy API Key. Vui lòng nhập lại API Key ở màn hình chính.");
      return;
    }
    if (!config) return;
  
    setAttemptCount(prev => prev + 1); // Tăng số lần (Lần 2 trở đi sẽ hiện chú thích)
    setLoading(true);
  
    try {
      if (sourceType === 'TOPIC') {
        const result = await generateQuiz(config, currentApiKey);
        setQuestions(result);
      } else {
        // Dùng các biến đã lưu: lastImages và imageMode
        if (lastImages.length > 0) {
          const result = await generateQuizFromImages(
            lastImages, 
            imageMode, // Đã sử dụng biến này, sẽ hết báo lỗi vàng
            currentApiKey,
            config.additionalPrompt
          );
          setQuestions(result);
        }
      }
      
      // Reset lại trạng thái làm bài cho đề mới
      setScore(0);
      setElapsedTime(0);
      setIsSaved(false);
    } catch (error: any) {
      alert("Lỗi khi đổi đề: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadExamFromHistory = (oldQuestions: Question[], topic: string, savedTimeLimit: number) => {
    resetQuizState();
    setLoading(false);

    setConfig({
      topic: topic,
      distribution: { 
        TN: { BIET: 0, HIEU: 0, VANDUNG: 0 }, 
        TLN: { BIET: 0, HIEU: 0, VANDUNG: 0 }, 
        DS: { BIET: 0, HIEU: 0, VANDUNG: 0 } 
      },
      additionalPrompt: "",
      timeLimit: savedTimeLimit || 15
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

const handleQuestionUpdate = useCallback((updatedQ: Question) => {
  setQuestions(prev => {
    // Chỉ cập nhật nếu thực sự có sự thay đổi để tránh render thừa
    return prev.map(q => (q.id === updatedQ.id ? updatedQ : q));
  });
}, []);

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

    {showPerfectScoreModal && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border-4 border-yellow-400 relative overflow-hidden">
          {/* Hiệu ứng tia sáng nền */}
          <div className="absolute inset-0 bg-gradient-to-b from-yellow-50 to-white -z-10"></div>
          
          <div className="mb-4 inline-block p-4 bg-yellow-100 rounded-full text-yellow-600">
            <Trophy size={60} strokeWidth={2.5} />
          </div>
          
          <h2 className="text-3xl font-black text-gray-800 mb-2">QUÁ TUYỆT VỜI!</h2>
          <p className="text-gray-600 mb-6 font-medium">Bạn đã hoàn thành bài thi với số điểm tuyệt đối</p>
          
          <div className="bg-yellow-500 text-white text-5xl font-black py-4 rounded-2xl mb-6 shadow-lg shadow-yellow-200">
            10 <span className="text-2xl">/ 10</span>
          </div>

          <button 
            onClick={() => setShowPerfectScoreModal(false)}
            className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-transform active:scale-95"
          >
            Tiếp tục học tập
          </button>
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