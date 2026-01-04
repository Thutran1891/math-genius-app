import confetti from 'canvas-confetti';
import { useState, useEffect, useRef, useCallback } from 'react'; // Thêm useCallback
import { QuizInput } from './components/QuizInput';
import { QuestionCard } from './components/QuestionCard';
import { Login } from './components/Login';
import { History } from './components/History';
import { QuizConfig, Question } from './types';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { addDoc, collection, serverTimestamp, doc, setDoc } from 'firebase/firestore'; // Dành cho Firestore
import { getDatabase, ref, onDisconnect, set } from 'firebase/database'; // Dành cho Realtime Database (Online status)
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
    const saveApiKeyToFirebase = async (apiKey: string) => {
      if (auth.currentUser) {
        try {
          // Sử dụng doc và setDoc đã import ở dòng 10
          const userRef = doc(db, "users", auth.currentUser.uid);
          await setDoc(userRef, { geminiApiKey: apiKey }, { merge: true });
        } catch (e) {
          console.error("Lỗi lưu Key:", e);
        }
      }
    };
  // THÊM DÒNG NÀY: Dùng để lưu trữ trạng thái của yêu cầu đang chạy
  const abortControllerRef = useRef<AbortController | null>(null);
    // Thanh tiến trình
  const [progress, setProgress] = useState(0);
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

  // THANH TIẾN TRÌNH
  const [isStreaming, setIsStreaming] = useState(false);

useEffect(() => {
  let interval: NodeJS.Timeout;

  if (loading) {
    setProgress(0);
    // Chạy nhanh lên 30% đầu
    interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 30) return prev + 5; // Tăng nhanh
        if (prev < 85) return prev + 2; // Tăng vừa
        if (prev < 98) return prev + 0.5; // Tăng chậm dần (chờ AI)
        return prev;
      });
    }, 400); // Mỗi 0.4 giây cập nhật một lần
  } else {
    // Khi AI trả kết quả xong, nhảy vọt lên 100% rồi biến mất
    setProgress(100);
    setTimeout(() => setProgress(0), 500);
  }

  return () => clearInterval(interval);
}, [loading]);

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
    // Nếu câu hỏi này đã được chấm trước đó (người dùng bấm "Kiểm tra" thủ công), giữ nguyên
    if (q.isCorrect !== undefined) return q;

    // 1. KIỂM TRA XEM CÓ LÀM BÀI KHÔNG
    let isSkipped = false;
    const uAns = q.userAnswer;

    if (q.type === 'DS') {
        // Với câu Đúng/Sai, nếu object rỗng hoặc null -> Chưa làm
        if (!uAns || Object.keys(uAns).length === 0) isSkipped = true;
    } else {
        // Với TN và TLN, nếu null, undefined hoặc chuỗi rỗng -> Chưa làm
        // Lưu ý: TLN nhập số 0 vẫn tính là đã làm (check String().trim())
        if (uAns === null || uAns === undefined || String(uAns).trim() === '') {
            isSkipped = true;
        }
    }

    // Nếu chưa làm -> Đánh dấu Skipped, Tính là sai (isCorrect = false) để không cộng điểm
    if (isSkipped) {
        return { ...q, isCorrect: false, isSkipped: true };
    }

    // 2. NẾU ĐÃ LÀM -> TIẾN HÀNH CHẤM ĐIỂM (Logic cũ)
    let isCorrect = false;
    if (q.type === 'TN') {
        isCorrect = uAns === q.correctAnswer;
    } else if (q.type === 'TLN') {
        const uVal = parseFloat(uAns.toString().replace(',', '.'));
        const cVal = parseFloat(q.correctAnswer?.toString().replace(',', '.') || '');
        isCorrect = !isNaN(uVal) && !isNaN(cVal) && Math.abs(uVal - cVal) <= 0.01;
    } else if (q.type === 'DS') {
        const ansObj = (uAns as unknown || {}) as Record<string, boolean>;
        const correctCount = q.statements?.filter(s => ansObj[s.id] === s.isCorrect).length || 0;
        isCorrect = (correctCount === (q.statements?.length || 4));
    }

    return { ...q, isCorrect, isSkipped: false };
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
    // 1. Quản lý AbortController
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setErrorInfo(null);
    setIsStreaming(false);
    setCurrentApiKey(apiKey);
    localStorage.setItem('user_gemini_key', apiKey);
    resetQuizState(); 
  
    setSourceType('IMAGE');    
    setLastImages(images);     
    setImageMode(mode);        
  
    const defaultName = mode === 'EXACT' ? "Đề gốc từ ảnh" : "Đề tương tự từ ảnh";
    const finalTopic = topicName && topicName.trim() !== "" ? topicName : defaultName;
  
    setConfig({
      topic: finalTopic,
      distribution: { TN: { BIET: 0, HIEU: 0, VANDUNG: 0 }, TLN: { BIET: 0, HIEU: 0, VANDUNG: 0 }, DS: { BIET: 0, HIEU: 0, VANDUNG: 0 } },
      additionalPrompt: prompt,
      timeLimit: timeLimit || 15
    });  
  
    try {
      // 2. Gọi API với controller.signal
      const result = await generateQuizFromImages(images, mode, apiKey, prompt, controller.signal);
      setIsStreaming(true);
      setQuestions(result);
      setSavedTime(0);
      abortControllerRef.current = null;
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      // Xử lý báo lỗi JSON tương tự như handleGenerate...
    } finally {
      setLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
};

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    setUser(currentUser);

    // 1. Luôn ưu tiên khôi phục nhanh từ LocalStorage để người dùng thấy ngay
    const localKey = localStorage.getItem('user_gemini_key');
    if (localKey) {
      setCurrentApiKey(localKey);
    }

    // 2. Nếu có mạng và đã đăng nhập -> Thực hiện các tác vụ
    if (currentUser) {
      
      // --- [MỚI] A. Cập nhật trạng thái Online (Dùng Realtime Database) ---
      // Giúp tự động xóa tên khi người dùng tắt Tab/Trình duyệt
      try {
        const rtdb = getDatabase();
        const presenceRef = ref(rtdb, `online_users/${currentUser.uid}`);

        // Cài đặt: Nếu mất kết nối -> Xóa node này ngay lập tức
        onDisconnect(presenceRef).remove();

        // Ghi nhận trạng thái đang online
        set(presenceRef, {
          displayName: currentUser.displayName || "User không tên",
          email: currentUser.email,
          lastSeen: Date.now(),
          state: 'online'
        });
      } catch (e) {
        console.error("Lỗi Realtime Database:", e);
      }

      // --- [CŨ] B. Tải API Key từ Firestore ---
      try {
        // Import dynamic Firestore để lấy key (giữ nguyên logic cũ của bạn)
        const { doc, getDoc } = await import('firebase/firestore');

        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists() && userSnap.data().geminiApiKey) {
          const cloudKey = userSnap.data().geminiApiKey;
          setCurrentApiKey(cloudKey);
          localStorage.setItem('user_gemini_key', cloudKey); // Đồng bộ lại local
        }
      } catch (e) {
        console.error("Lỗi tải API Key từ Firestore:", e);
      }
    }
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
    // 1. Hủy yêu cầu cũ nếu đang chạy
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }

    // 2. Khởi tạo Controller mới
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Thiết lập các trạng thái ban đầu
    setSourceType('TOPIC'); 
    setLoading(true);
    setIsStreaming(false); 
    setErrorInfo(null); 
    setConfig(newConfig);
    setCurrentApiKey(apiKey);
    localStorage.setItem('user_gemini_key', apiKey); 
    saveApiKeyToFirebase(apiKey);
    resetQuizState(); 

    // --- CẢI TIẾN BỘ ĐẾM THỜI GIAN CHỜ (TIMEOUT) ---
    // Sử dụng biến cục bộ để theo dõi trạng thái chính xác hơn
    let hasStartedStreaming = false;

    const timeoutId = setTimeout(() => {
        // Chỉ hủy nếu sau 60s vẫn chưa nhận được bất kỳ dữ liệu nào
        if (!hasStartedStreaming) {
            controller.abort();
            setLoading(false);
            setErrorInfo({
                title: "Hết thời gian chờ",
                detail: "Kết nối mạng quá yếu hoặc AI phản hồi lâu. Vui lòng kiểm tra lại Key hoặc thử lại sau."
            });
        }
    }, 90000); // Tăng lên 90 giây để AI có đủ thời gian "suy nghĩ"

    try {
        // 3. Gọi API với signal
        const result = await generateQuiz(newConfig, apiKey, controller.signal);
        
        // --- NGAY KHI CÓ DỮ LIỆU ---
        hasStartedStreaming = true; // Đánh dấu đã nhận được dữ liệu
        clearTimeout(timeoutId); 
        
        setIsStreaming(true);
        setQuestions(result);
        
        // Sửa lỗi: Sử dụng setSavedTime(0) thay vì setTotalTime
        setSavedTime(0);
        
        // Ẩn nút Hủy ngay lập tức
        abortControllerRef.current = null; 

    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.log("Yêu cầu đã được hủy.");
            return;
        }

        try {
            const parsedError = JSON.parse(error.message);
            setErrorInfo(parsedError); 
        } catch (e) {
            setErrorInfo({ 
                title: "Lỗi tạo đề", 
                detail: error.message || "Kiểm tra kết nối mạng và API Key của bạn." 
            });
        }
    } finally {
        setLoading(false);
        setIsStreaming(false);
        abortControllerRef.current = null;
    }
};

    // Thêm hàm này bên dưới handleGenerate
  const handleCancelRequest = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        setLoading(false);
        // Có thể reset thêm progress bar nếu bạn có dùng
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
    // Bước chèn mới: Lấy danh sách văn bản câu hỏi hiện tại để yêu cầu AI né tránh
    // Chúng ta chỉ lấy tối đa 10 câu gần nhất để tránh làm Prompt quá dài gây tốn token
    const currentQuestionsContent = questions.map(q => q.questionText).slice(-10);
    
    // Tạo bản sao config có kèm danh sách loại trừ
    const configWithExclusion: QuizConfig = {
        ...config,
        excludeQuestions: currentQuestionsContent
    };
  
    try {
      if (sourceType === 'TOPIC') {
        // Sử dụng configWithExclusion thay vì config cũ
        const result = await generateQuiz(configWithExclusion, currentApiKey);
        setQuestions(result);
      } else {
        // Dùng các biến đã lưu: lastImages và imageMode
        if (lastImages.length > 0) {
          // Đối với tạo từ ảnh, chúng ta gửi danh sách né vào tham số additionalPrompt
          const exclusionText = `\nKHÔNG tạo lại các câu hỏi có nội dung sau: ${currentQuestionsContent.join(" | ")}`;
          
          const result = await generateQuizFromImages(
              lastImages,
              imageMode,
              currentApiKey,
              (config.additionalPrompt || "") + exclusionText
          );
          setQuestions(result);
        }
      }
      
      // Reset lại trạng thái làm bài cho đề mới
      setScore(0);
      setSavedTime(0);
      setIsSaved(false);
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Cuộn lên đầu cho trải nghiệm tốt hơn
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
        
              {/* Giao diện Thanh tiến trình */}
          {loading && (
            <div className="fixed top-0 left-0 w-full z-[200]">
              {/* Background mờ cho toàn màn hình */}
              <div className="fixed inset-0 bg-white/20 backdrop-blur-[2px] z-[-1]" />
              
              {/* Thanh Progress Bar chạy trên đỉnh */}
              <div className="h-1.5 w-full bg-blue-100 overflow-hidden relative">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              {/* Khung thông báo trung tâm */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 w-full max-w-xs sm:max-w-md">
                <div className="bg-white px-5 py-2.5 rounded-full shadow-xl border border-blue-50 flex items-center gap-3 animate-bounce">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-bold text-blue-700 whitespace-nowrap">
                    AI Đang soạn đề... {Math.round(progress)}%
                  </span>
                </div>

                {/* CHỈ HIỆN NÚT HỦY KHI CHƯA CÓ DỮ LIỆU ĐỔ VỀ VÀ REF CÒN TỒN TẠI */}
                {!isStreaming && abortControllerRef.current && (
                  <button 
                      onClick={handleCancelRequest}
                      className="px-4 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-[11px] font-black uppercase tracking-wider hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95"
                  >
                      Hủy yêu cầu (Dừng AI)
                  </button>
                )}
              </div>
            </div>
          )}

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