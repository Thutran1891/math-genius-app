import { useState, useEffect } from 'react';
import { QuizInput } from './components/QuizInput';
import { QuestionCard } from './components/QuestionCard';
import { Login } from './components/Login';
import { History } from './components/History'; // Import History
import { generateQuiz } from './geminiService';
import { QuizConfig, Question } from './types';
import { RefreshCcw, Trophy, ArrowLeft, History as HistoryIcon, Save } from 'lucide-react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<QuizConfig | null>(null);
  const [score, setScore] = useState(0);
  const [currentApiKey, setCurrentApiKey] = useState<string>("");
  const [viewHistory, setViewHistory] = useState(false); // State chuyển view Lịch sử
  const [isSaved, setIsSaved] = useState(false); // Trạng thái đã lưu điểm chưa

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleGenerate = async (newConfig: QuizConfig, apiKey: string) => {
    setLoading(true);
    setConfig(newConfig);
    setCurrentApiKey(apiKey);
    setScore(0);
    setIsSaved(false);
    setQuestions([]); 
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

  const handleUpdateScore = (isCorrect: boolean) => {
    if (isCorrect) setScore(prev => prev + 1);
  };

  // HÀM LƯU KẾT QUẢ VÀO FIRESTORE
  const handleSaveResult = async () => {
    if (!user || !config || isSaved) return;
    try {
      await addDoc(collection(db, "results"), {
        userId: user.uid,
        topic: config.topic,
        score: score,
        total: questions.length,
        date: serverTimestamp()
      });
      setIsSaved(true);
      alert("Đã lưu kết quả thành công!");
    } catch (e) {
      console.error("Lỗi lưu:", e);
      alert("Không thể lưu kết quả.");
    }
  };

  if (!user) return <Login />;

  // View Lịch sử
  if (viewHistory) {
    return <History onBack={() => setViewHistory(false)} />;
  }

  return (
    <div className="min-h-screen py-8 px-4 font-sans bg-slate-50">
      {questions.length === 0 ? (
        <>
          {/* Nút xem lịch sử ở màn hình chính */}
          <div className="max-w-2xl mx-auto mb-4 flex justify-end">
             <button 
                onClick={() => setViewHistory(true)}
                className="flex items-center gap-2 text-blue-600 font-bold hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors"
             >
                <HistoryIcon size={20}/> Xem Lịch sử
             </button>
          </div>
          <QuizInput onGenerate={handleGenerate} isLoading={loading} />
        </>
      ) : (
        <div className="max-w-3xl mx-auto animate-fade-in">
          {/* Header kết quả */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 mb-6 flex flex-col sm:flex-row justify-between items-center sticky top-2 z-10 gap-3">
            <div className="flex-1">
              <h2 className="font-bold text-lg text-gray-800 line-clamp-1">{config?.topic}</h2>
              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                <span className="flex items-center gap-1"><Trophy size={16} className="text-yellow-500" /> Đúng: <b className="text-primary">{score}/{questions.length}</b></span>
                
                {/* Nút Lưu điểm */}
                {!isSaved ? (
                    <button onClick={handleSaveResult} className="flex items-center gap-1 text-green-600 hover:underline font-medium text-xs bg-green-50 px-2 py-1 rounded border border-green-200">
                        <Save size={14}/> Lưu điểm
                    </button>
                ) : (
                    <span className="text-green-600 text-xs font-bold flex items-center gap-1"><Save size={14}/> Đã lưu</span>
                )}
              </div>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => setQuestions([])} className="flex-1 sm:flex-none justify-center px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium flex items-center gap-1 border border-transparent hover:border-gray-200">
                <ArrowLeft size={16}/> Quay lại
              </button>
              <button onClick={handleRegenerate} disabled={loading} className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 shadow-sm">
                <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
                {loading ? "Đang tạo..." : "Tạo đề lại"}
              </button>
            </div>
          </div>

          <div className="space-y-6 pb-20">
            {questions.map((q, idx) => (
              <QuestionCard 
                key={q.id || idx} 
                index={idx} 
                question={q} 
                onUpdateScore={handleUpdateScore} 
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;