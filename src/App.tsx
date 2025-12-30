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
import { RefreshCcw, Trophy, ArrowLeft, History as HistoryIcon, Save, BookOpen, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { LatexText } from './components/LatexText';
import { generateQuiz, generateTheory, generateQuizFromImages } from './geminiService';
import { TimerDisplay } from './components/TimerDisplay';


function App() {
  const [user, setUser] = useState<User | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const questionsRef = useRef<Question[]>([]); // Thêm dòng này
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
  // const [elapsedTime, setElapsedTime] = useState(0);
  const [savedTime, setSavedTime] = useState(0);
  // Bắt lỗi
  const [errorInfo, setErrorInfo] = useState<{title: string, detail: string} | null>(null);
  // Âm thanh chúc mừng
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultFeedback, setResultFeedback] = useState({
    title: '',
    message: '',
    colorClass: '',
    score: ''
  });
  const maxTotalScore = questions.reduce((sum, q) => {
    if (q.type === 'DS') return sum + 4;
    if (q.type === 'TLN') return sum + 2; //
    return sum + 1;
  }, 0);

  const handleQuestionDataChange = useCallback((updatedQuestion: Question) => {
    setQuestions(prev => prev.map(q => 
      q.id === updatedQuestion.id ? updatedQuestion : q
    ));
  }, []);

  // TỰ ĐỘNG LƯU -----------------
  // App.tsx hoặc một file util riêng
const STORAGE_KEY = "current_quiz_session";

const saveSession = (data: {
  questions: any[],
  elapsedTime: number,
  config: any,
  violationCount: number
}) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...data,
    timestamp: Date.now()
  }));
};

const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY);
};

const getSavedSession = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  
  const parsed = JSON.parse(saved);
  // Nếu dữ liệu quá cũ (ví dụ > 24h), có thể bỏ qua không khôi phục
  const isExpired = Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000;
  return isExpired ? null : parsed;
};

  // --- ĐẶT Ở ĐÂY (Sau các khai báo useState) ---
  useEffect(() => {
    // Chúng ta chỉ khôi phục khi có user và chưa có câu hỏi nào hiện tại (để tránh ghi đè bài mới)
    if (user && questions.length === 0) {
      const savedSession = getSavedSession();
      
      if (savedSession) {
        const confirmRestore = window.confirm(
          `Hệ thống tìm thấy bài làm dở dang: "${savedSession.config.topic}". Bạn có muốn tiếp tục không?`
        );

        if (confirmRestore) {
          setQuestions(savedSession.questions);
          setSavedTime(savedSession.elapsedTime);
          setConfig(savedSession.config);
          setViolationCount(savedSession.violationCount);
          violationCountRef.current = savedSession.violationCount;
        } else {
          clearSession();
        }
      }
    }
  }, [user]); // Chạy lại khi trạng thái đăng nhập thay đổi  

  // --- ĐẶT Ở ĐÂY (Phía dưới các logic xử lý khác) ---
  useEffect(() => {
    // Chỉ lưu khi đang có bài (questions > 0) và bài đó chưa được nộp (isSaved = false)
    if (questions.length > 0 && !isSaved) {
      saveSession({
        questions,
        elapsedTime: savedTime,
        config,
        violationCount: violationCountRef.current
      });
    }
  }, [questions, savedTime, isSaved]); 
  // useEffect này sẽ "lắng nghe": mỗi khi học sinh chọn đáp án (questions thay đổi) 
  // hoặc đồng hồ nhảy (elapsedTime thay đổi), nó sẽ lưu ngay lập tức.  
  // --------------------------------------
  // Cập nhật ref mỗi khi state questions thay đổi
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  const handleSaveResult = useCallback(async (forcedTime?: number) => {
    if (!user || isSavedRef.current) return;
  
    // LẤY DỮ LIỆU MỚI NHẤT TỪ REF thay vì state câu hỏi trực tiếp
  const currentQuestions = questionsRef.current;

  const finalizedQuestions = currentQuestions.map(q => {
    // Nếu đã bấm "Kiểm tra" (isCorrect đã có true/false) thì giữ nguyên
    if (q.isCorrect !== undefined) return q;

    // Nếu chưa bấm "Kiểm tra", tiến hành chấm điểm dựa trên userAnswer đã lưu
    let isCorrect = false;
    const userAns = q.userAnswer;
    if (!userAns) return { ...q, isCorrect: false };

    if (q.type === 'TN') {
      isCorrect = userAns === q.correctAnswer;
    } else if (q.type === 'TLN') {
      const uVal = parseFloat(userAns.toString().replace(',', '.'));
      const cVal = parseFloat(q.correctAnswer?.toString().replace(',', '.') || '');
      isCorrect = !isNaN(uVal) && !isNaN(cVal) && Math.abs(uVal - cVal) <= 0.01;
    } else if (q.type === 'DS') {
      const ansObj = (userAns as unknown || {}) as Record<string, boolean>; // Thêm || {}
      const correctCount = q.statements?.filter(s => ansObj[s.id] === s.isCorrect).length || 0;
      isCorrect = (correctCount === (q.statements?.length || 4));
  }
    return { ...q, isCorrect };
  });

  // Tính tổng điểm
  const currentScore = finalizedQuestions.reduce((sum, q) => {
    if (q.type === 'DS') {
      const ansObj = (q.userAnswer || {}) as Record<string, boolean>;
      return sum + (q.statements?.filter(s => ansObj[s.id] === s.isCorrect).length || 0);
    }
    if (q.type === 'TLN') return sum + (q.isCorrect ? 2 : 0);
    return sum + (q.isCorrect ? 1 : 0);
  }, 0);

  setQuestions(finalizedQuestions);
  setScore(currentScore);
  setIsSaved(true);
  isSavedRef.current = true;
  
    // THÔNG BÁO KẾT QUẢ
      // 1. TÍNH ĐIỂM HỆ 10 ĐỂ PHÂN LOẠI FEEDBACK
    const score10Raw = maxTotalScore > 0 ? (currentScore / maxTotalScore) * 10 : 0;
    const s10 = parseFloat(score10Raw.toFixed(1));

    let feedback = { title: '', message: '', colorClass: '' };

    // 2. PHÂN LOẠI THÔNG BÁO THEO MỨC ĐIỂM
    if (s10 === 10) {
        feedback = { 
            title: 'QUÁ TUYỆT VỜI!', 
            message: 'Bạn đã hoàn thành bài thi với số điểm tuyệt đối!', 
            colorClass: 'bg-yellow-500 border-yellow-400 text-yellow-600' 
        };
        
        // Chỉ bắn pháo hoa và phát âm thanh khi đạt điểm 10
        const audio = new Audio('/congrats.mp3');
        audio.play().catch(() => {});
        
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const interval: any = setInterval(function() {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            confetti({ particleCount: 50, spread: 360, origin: { x: 0.2, y: 0.6 }, zIndex: 999 });
            confetti({ particleCount: 50, spread: 360, origin: { x: 0.8, y: 0.6 }, zIndex: 999 });
        }, 250);
    } 
    else if (s10 >= 8) {
        feedback = { 
            title: 'RẤT TỐT!', 
            message: 'Kết quả rất ấn tượng, hãy tiếp tục phát huy nhé!', 
            colorClass: 'bg-green-500 border-green-400 text-green-600' 
        };
    } 
    else if (s10 >= 5) {
        feedback = { 
            title: 'KHÁ TỐT!', 
            message: 'Bạn đã nắm được kiến thức cơ bản, cố gắng thêm chút nữa nhé!', 
            colorClass: 'bg-blue-500 border-blue-400 text-blue-600' 
        };
    } 
    else {
        feedback = { 
            title: 'CẦN CỐ GẮNG!', 
            message: 'Đáng tiếc, bạn cần xem lại lý thuyết và luyện tập thêm.', 
            colorClass: 'bg-red-500 border-red-400 text-red-600' 
        };
    }

    // 3. HIỂN THỊ MODAL (Dòng này cực kỳ quan trọng, nằm ngoài các lệnh IF trên)
    setResultFeedback({ ...feedback, score: s10.toString() });
    setShowResultModal(true);

    // Lưu vào Firestore
    try {
      const finalTimeSpent = forcedTime !== undefined ? forcedTime : savedTime;
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
      // THÊM DÒNG NÀY:
      clearSession();
    } catch (e) {
      console.error("Lỗi khi lưu:", e);
      setIsSaved(false);
      isSavedRef.current = false;
    }
  }, [user, questions, savedTime, config, maxTotalScore]);
  

  // useEffect xử lý bộ đếm
  // Logic đếm giờ và Tự động khóa bài
  useEffect(() => {
    // Điều kiện: Có câu hỏi, chưa lưu điểm và không phải đang xem lịch sử
    if (questions.length > 0 && !isSaved && !viewHistory) {
      timerRef.current = setInterval(() => {
        setSavedTime(prev => {
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
    setSavedTime(0);
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
    setErrorInfo(null); // Reset lỗi cũ
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
      try {
        // Giải mã JSON lỗi từ geminiService ném về
        const parsedError = JSON.parse(error.message);
        setErrorInfo({
          title: parsedError.title,
          detail: parsedError.detail
        });
      } catch {
        // Nếu lỗi không phải định dạng JSON (lỗi code thuần)
        setErrorInfo({ 
          title: "Lỗi hệ thống", 
          detail: error.message || "Đã có lỗi xảy ra." 
        });
      }
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
    setErrorInfo(null); // Xóa lỗi cũ trước khi bắt đầu
    setConfig(newConfig);
    setCurrentApiKey(apiKey);
    resetQuizState(); // Gọi hàm reset
    try {
      const result = await generateQuiz(newConfig, apiKey);
      setQuestions(result);
    } catch (error: any) {
      console.error("Bắt được lỗi tại App:", error.message);
      try {
        // Phải parse vì geminiService ném ra chuỗi JSON
        const parsedError = JSON.parse(error.message);
        setErrorInfo(parsedError); 
      } catch (e) {
        // Nếu không parse được (lỗi lạ), hiện lỗi mặc định
        setErrorInfo({ 
          title: "Lỗi không xác định", 
          detail: error.message || "Vui lòng kiểm tra console để biết thêm chi tiết." 
        });
      }
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
      setSavedTime(0);
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
                  <TimerDisplay 
                    timeLimit={config?.timeLimit || 15}
                    isSaved={isSaved}
                    initialTime={savedTime} 
                    onChange={(currentTime) => setSavedTime(currentTime)} // Nhận thời gian để Auto-save
                    onTimeUp={(finalTime) => {
                      setSavedTime(finalTime);
                      handleSaveResult(finalTime);
                    }}
                  />

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
              onDataChange={handleQuestionDataChange} // Đổi từ handleQuestionUpdate sang hàm này
              isLocked={isSaved} 
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

      {/* Báo lỗi */}
            {errorInfo && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[250] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border-t-4 border-red-500">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle size={24} />
              <h3 className="font-bold text-lg">{errorInfo.title}</h3>
            </div>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              {errorInfo.detail}
            </p>
            <button 
              onClick={() => setErrorInfo(null)}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

        {/* Thống báo kết quả thi */}
    {showResultModal && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in">
        <div className={`bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border-4 relative overflow-hidden ${resultFeedback.colorClass.split(' ')[1]}`}>
          <div className="absolute inset-0 bg-gradient-to-b from-white/50 to-white -z-10"></div>
          
          <div className={`mb-4 inline-block p-4 rounded-full ${resultFeedback.colorClass.split(' ')[2].replace('text', 'bg').replace('600', '100')} ${resultFeedback.colorClass.split(' ')[2]}`}>
            <Trophy size={60} strokeWidth={2.5} />
          </div>
          
          <h2 className="text-3xl font-black text-gray-800 mb-2 uppercase">{resultFeedback.title}</h2>
          <p className="text-gray-600 mb-6 font-medium leading-tight">{resultFeedback.message}</p>
          
          <div className={`${resultFeedback.colorClass.split(' ')[0]} text-white text-5xl font-black py-4 rounded-2xl mb-6 shadow-lg`}>
            {resultFeedback.score} <span className="text-2xl">/ 10</span>
          </div>

          <button 
            onClick={() => setShowResultModal(false)}
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