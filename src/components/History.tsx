import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore'; // Thêm deleteDoc, writeBatch, doc
import { auth, db } from '../firebase';
import { Clock, Calendar, Trophy, ChevronLeft, RotateCcw, AlertTriangle, Trash2 } from 'lucide-react'; // Thêm Trash2
import { Question } from '../types';
import { QuestionCard } from './QuestionCard';

interface HistoryItem {
  id: string;
  topic: string;
  score: number;
  total: number;
  date: any; 
  fullData?: string; 
  violationCount?: number;
  timeSpent?: number;
  timeLimit?: number;
}

interface Props {
  onBack: () => void;
  // Sửa dòng dưới đây để nhận thêm timeLimit (số)
  onLoadExam: (questions: Question[], topic: string, timeLimit: number) => void; 
}

export const History: React.FC<Props> = ({ onBack, onLoadExam }) => { 
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<HistoryItem | null>(null);

  // --- HÀM TẢI DỮ LIỆU ---
  const fetchHistory = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const historyRef = collection(db, "users", auth.currentUser.uid, "examHistory");
      const q = query(historyRef, orderBy("date", "desc"));
      const querySnapshot = await getDocs(q);
      const data: HistoryItem[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as HistoryItem);
      });
      setHistory(data);
    } catch (error) {
      console.error("Lỗi tải lịch sử:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // --- HÀM XÓA 1 MỤC ---
  const handleDeleteItem = async (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation(); // Ngăn sự kiện click lan ra thẻ cha (không mở chi tiết bài thi)
    
    if (!window.confirm("Bạn chắc chắn muốn xóa bài thi này?")) return;

    try {
      if (!auth.currentUser) return;
      await deleteDoc(doc(db, "users", auth.currentUser.uid, "examHistory", itemId));
      
      // Cập nhật lại UI: Lọc bỏ item đã xóa
      setHistory(prev => prev.filter(item => item.id !== itemId));
    } catch (error) {
      alert("Lỗi khi xóa: " + error);
    }
  };

  // --- HÀM XÓA TẤT CẢ (Dùng Batch) ---
  const handleDeleteAll = async () => {
    if (history.length === 0) return;
    if (!window.confirm("CẢNH BÁO: Bạn có chắc muốn xóa TOÀN BỘ lịch sử làm bài? Hành động này không thể hoàn tác!")) return;

    // 1. Lấy user ra biến riêng để TypeScript hiểu
    const user = auth.currentUser; 
    if (!user) return; // Kiểm tra biến user này

    try {
      setLoading(true);

      const batch = writeBatch(db);
      
      history.forEach(item => {
        // 2. Dùng user.uid (lúc này TypeScript đã biết user chắc chắn không null)
        const itemRef = doc(db, "users", user.uid, "examHistory", item.id);
        batch.delete(itemRef);
      });

      await batch.commit(); 

      setHistory([]); 
      alert("Đã xóa sạch lịch sử!");
    } catch (error) {
      console.error("Lỗi xóa tất cả:", error);
      alert("Có lỗi xảy ra khi xóa.");
    } finally {
      setLoading(false);
    }
  };

  // --- MÀN HÌNH CHI TIẾT BÀI THI ---
  if (selectedExam && selectedExam.fullData) {
      const questions: Question[] = JSON.parse(selectedExam.fullData);

      return (
        <div className="max-w-3xl mx-auto bg-slate-50 min-h-screen animate-in slide-in-from-right duration-200">
            <div className="sticky top-0 bg-white shadow-sm p-4 z-10 flex flex-col sm:flex-row items-center gap-3 border-b">
                <div className="flex items-center gap-3 flex-1 w-full">
                    <button onClick={() => setSelectedExam(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ChevronLeft className="text-gray-600" />
                    </button>
                    <div>
                        <h2 className="font-bold text-lg text-gray-800 line-clamp-1">{selectedExam.topic}</h2>
                        <p className="text-xs text-gray-500">Xem lại bài làm cũ</p>
                    </div>
                </div>

                <button 
                    onClick={() => onLoadExam(questions, selectedExam.topic, selectedExam.timeLimit || 15)} // Thêm tham số thứ 3
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-blue-700 shadow-sm active:scale-95 transition-all"
                >
                    <RotateCcw size={18}/> Làm lại đề này
                </button>
            </div>
            
            <div className="p-4 space-y-6 pb-20">
                {questions.map((q, idx) => (
                    <QuestionCard key={idx} index={idx} question={q} />
                ))}
            </div>
        </div>
      );
  }

  // Logic tính số lần làm (như cũ)
  const getAttemptInfo = (currentItem: HistoryItem) => {
    const sameTopicExams = history.filter(h => h.topic === currentItem.topic);
    sameTopicExams.sort((a, b) => {
        const timeA = a.date?.seconds || 0;
        const timeB = b.date?.seconds || 0;
        return timeA - timeB;
    });
    const index = sameTopicExams.findIndex(h => h.id === currentItem.id);
    return index + 1; 
  };

  // --- MÀN HÌNH DANH SÁCH ---
  return (
    <div className="max-w-3xl mx-auto bg-white min-h-screen sm:min-h-0 sm:rounded-2xl shadow-xl border border-blue-100 flex flex-col">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Clock className="text-blue-600" /> Lịch sử làm bài
        </h2>
        <div className="flex gap-2">
            {/* NÚT XÓA TẤT CẢ */}
            {history.length > 0 && (
                <button 
                    onClick={handleDeleteAll} 
                    className="text-sm font-bold text-red-500 hover:text-red-700 px-3 py-1 rounded hover:bg-red-50 flex items-center gap-1 transition-colors"
                    title="Xóa toàn bộ lịch sử"
                >
                    <Trash2 size={16}/> Xóa hết
                </button>
            )}
            <button onClick={onBack} className="text-sm font-medium text-gray-500 hover:text-gray-800 px-3 py-1 rounded hover:bg-gray-100">
            Đóng
            </button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto max-h-[80vh]">
        {loading ? (
          <div className="text-center py-10 text-gray-400 flex flex-col items-center gap-2">
             <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
             <span>Đang tải dữ liệu...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-10 text-gray-400 flex flex-col items-center gap-2">
              <Trophy size={40} className="text-gray-200" />
              <p>Lịch sử trống.</p>
          </div>
        ) : (
          <div className="space-y-3">
          {history.map((item) => {
              // 1. Tính toán điểm số hệ 10 (Sử dụng dự phòng || 0 để tránh lỗi NaN)
              const scoreVal = item.score || 0;
              const totalVal = item.total || 1; // Tránh chia cho 0
              const score10 = ((scoreVal / totalVal) * 10).toFixed(1);
              const sVal = parseFloat(score10);
              
              // 2. Xử lý ngày tháng
              const dateObj = item.date?.toDate ? item.date.toDate() : new Date();
              
              // 3. Xác định màu sắc điểm số
              const scoreColor = sVal >= 8 ? 'text-green-600' : sVal >= 5 ? 'text-blue-600' : 'text-red-600';

              // 4. Tính toán thời gian làm bài (Chuyển đổi giây -> phút:giây)
              const timeInSeconds = item.timeSpent || 0; 
              const minutes = Math.floor(timeInSeconds / 60);
              const seconds = timeInSeconds % 60;
              const displayTime = `${minutes}p ${seconds < 10 ? '0' + seconds : seconds}s`;

              const attemptCount = getAttemptInfo(item);

              return (
                <div 
                    key={item.id} 
                    onClick={() => {
                        if (item.fullData) setSelectedExam(item);
                        else alert("Bài thi cũ này chưa hỗ trợ xem lại.");
                    }}
                    className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-blue-300 group relative pr-12"
                >
                  {/* NÚT XÓA TỪNG ITEM (Tuyệt đối nằm bên phải) */}
                  <button 
                    onClick={(e) => handleDeleteItem(e, item.id)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all z-10"
                    title="Xóa bài này"
                  >
                    <Trash2 size={18} />
                  </button>

                  <div className="flex justify-between items-center">
                      <div className="flex-1 pr-4">
                        <h3 className="font-bold text-gray-800 text-base mb-1 line-clamp-2 group-hover:text-blue-700 transition-colors">
                            {item.topic} 
                            {attemptCount > 1 && (
                                <span className="ml-2 text-xs font-normal text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                                    (Lần {attemptCount})
                                </span>
                            )}
                        </h3>

                        {/* Tìm đoạn này và chèn thêm phần Clock */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                          
                          {/* 1. Hiển thị thời gian làm bài (MỚI THÊM) */}
                          <span className="flex items-center gap-1 text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded">
                            <Clock size={12}/> {displayTime}
                          </span>

                          {/* 2. Hiển thị lỗi vi phạm (Đã có) */}
                          {item.violationCount && item.violationCount > 0 && (
                            <span className="flex items-center gap-1 text-red-500 font-bold bg-red-50 px-1 rounded">
                                <AlertTriangle size={12}/> {item.violationCount} lỗi
                            </span>
                          )}

                          {/* 3. Hiển thị ngày tháng (Đã có) */}
                          <span className="flex items-center gap-1">
                              <Calendar size={12}/> 
                              {dateObj.toLocaleString('vi-VN', { 
                                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                              })}
                          </span>
                          
                          {/* 4. Hiển thị điểm số (Đã có) */}
                          <span className="flex items-center gap-1">
                              <Trophy size={12}/> {item.score}/{item.total} điểm
                          </span>
                        </div>
                      </div>
                      
                      {/* Điểm số */}
                      <div className="text-right pl-4 border-l border-gray-100 min-w-[60px] mr-6"> 
                        <div className={`text-2xl font-black ${scoreColor}`}>{score10}</div>
                      </div>
                  </div>
                </div>
              );
            })}

          </div>
        )}
      </div>
    </div>
  );
};