import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
// Thêm RotateCcw vào đây
import { Clock, Calendar, Trophy, ChevronLeft, RotateCcw } from 'lucide-react'; 
import { Question } from '../types';
import { QuestionCard } from './QuestionCard';

interface HistoryItem {
  id: string;
  topic: string;
  score: number;
  total: number;
  date: any; 
  fullData?: string; 
}

interface Props {
  onBack: () => void;
  // Khai báo nhận hàm onLoadExam từ App
  onLoadExam: (questions: Question[], topic: string) => void; 
}

export const History: React.FC<Props> = ({ onBack, onLoadExam }) => { // Nhận prop ở đây
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Sửa: Lưu cả object bài thi để lấy được tên Topic
  const [selectedExam, setSelectedExam] = useState<HistoryItem | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!auth.currentUser) return;
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
    fetchHistory();
  }, []);

  // --- MÀN HÌNH CHI TIẾT BÀI THI ---
  if (selectedExam && selectedExam.fullData) {
      // Parse dữ liệu câu hỏi từ chuỗi JSON
      const questions: Question[] = JSON.parse(selectedExam.fullData);

      return (
        <div className="max-w-3xl mx-auto bg-slate-50 min-h-screen">
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

                {/* --- NÚT LÀM LẠI ĐỀ NÀY --- */}
                <button 
                    onClick={() => onLoadExam(questions, selectedExam.topic)}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-blue-700 shadow-sm active:scale-95 transition-all"
                >
                    <RotateCcw size={18}/> Làm lại đề này
                </button>
                {/* --------------------------- */}
            </div>
            
            <div className="p-4 space-y-6 pb-20">
                {questions.map((q, idx) => (
                    <QuestionCard key={idx} index={idx} question={q} />
                ))}
            </div>
        </div>
      );
  }
  // --- LOGIC MỚI: Tính số thứ tự lần làm (Lần 1, 2, 3...) ---
  // Hàm này sẽ chạy cho mỗi item để kiểm tra xem nó là lần thứ mấy
  const getAttemptInfo = (currentItem: HistoryItem) => {
    // 1. Lọc ra tất cả các bài thi có CÙNG TÊN CHỦ ĐỀ
    const sameTopicExams = history.filter(h => h.topic === currentItem.topic);
    
    // 2. Sắp xếp chúng theo thời gian TĂNG DẦN (Cũ nhất -> Mới nhất)
    // Lưu ý: Firestore Timestamp có dạng { seconds, nanoseconds }
    sameTopicExams.sort((a, b) => {
        const timeA = a.date?.seconds || 0;
        const timeB = b.date?.seconds || 0;
        return timeA - timeB;
    });

    // 3. Tìm vị trí (index) của bài hiện tại trong danh sách đã sắp xếp
    const index = sameTopicExams.findIndex(h => h.id === currentItem.id);
    
    // 4. Trả về kết quả (index + 1 chính là số lần)
    return index + 1; 
  };
// -----------------------------------------------------------


  // --- MÀN HÌNH DANH SÁCH ---
  return (
    <div className="max-w-3xl mx-auto bg-white min-h-screen sm:min-h-0 sm:rounded-2xl shadow-xl border border-blue-100 flex flex-col">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Clock className="text-blue-600" /> Lịch sử làm bài
        </h2>
        <button onClick={onBack} className="text-sm font-medium text-gray-500 hover:text-gray-800 px-3 py-1 rounded hover:bg-gray-100">
          Đóng
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto max-h-[80vh]">
        {loading ? (
          <div className="text-center py-10 text-gray-400">Đang tải dữ liệu...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-10 text-gray-400 flex flex-col items-center gap-2">
              <Trophy size={40} className="text-gray-200" />
              <p>Bạn chưa làm bài thi nào.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => {
              const score10 = ((item.score / item.total) * 10).toFixed(1);
              const dateObj = item.date?.toDate ? item.date.toDate() : new Date();
              
              // --- TÍNH TOÁN LOGIC MÀU SẮC ---
              let scoreColor = "text-red-500";
              if (Number(score10) >= 8) scoreColor = "text-green-500";
              else if (Number(score10) >= 5) scoreColor = "text-yellow-600";

              // --- GỌI HÀM TÍNH SỐ LẦN LÀM ---
              const attemptCount = getAttemptInfo(item);

              return (
                <div 
                    key={item.id} 
                    onClick={() => {
                        if (item.fullData) setSelectedExam(item);
                        else alert("Bài thi cũ này chưa hỗ trợ xem lại.");
                    }}
                    className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-blue-300 group"
                >
                  <div className="flex justify-between items-center">
                      <div className="flex-1 pr-4">
                        
                        {/* --- SỬA 1: HIỂN THỊ TÊN CHỦ ĐỀ KÈM SỐ LẦN LÀM --- */}
                        <h3 className="font-bold text-gray-800 text-base mb-1 line-clamp-2 group-hover:text-blue-700 transition-colors">
                            {item.topic} 
                            {/* Chỉ hiện chú thích nếu làm từ lần 2 trở đi */}
                            {attemptCount > 1 && (
                                <span className="ml-2 text-xs font-normal text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                                    (Lần {attemptCount})
                                </span>
                            )}
                        </h3>

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {/* --- SỬA 2: HIỂN THỊ ĐẦY ĐỦ GIỜ:PHÚT:GIÂY --- */}
                          <span className="flex items-center gap-1" title="Thời gian nộp bài">
                              <Calendar size={12}/> 
                              {dateObj.toLocaleString('vi-VN', { 
                                  hour: '2-digit', 
                                  minute: '2-digit', 
                                  second: '2-digit',
                                  day: '2-digit', 
                                  month: '2-digit', 
                                  year: 'numeric' 
                              })}
                          </span>
                          
                          <span className="flex items-center gap-1"><Trophy size={12}/> {item.score}/{item.total} câu</span>
                        </div>
                      </div>
                      <div className="text-right pl-4 border-l border-gray-100 min-w-[60px]">
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