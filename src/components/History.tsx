import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Clock, Calendar, Trophy } from 'lucide-react';

interface HistoryItem {
  id: string;
  topic: string;
  score: number;
  total: number;
  date: any; // Timestamp
}

interface Props {
  onBack: () => void;
}

export const History: React.FC<Props> = ({ onBack }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!auth.currentUser) return;
      
      try {
        // Lấy dữ liệu từ collection 'results' của user hiện tại
        const q = query(
          collection(db, "results"),
          where("userId", "==", auth.currentUser.uid),
          orderBy("date", "desc")
        );

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

  return (
    <div className="max-w-3xl mx-auto bg-white min-h-screen sm:min-h-0 sm:rounded-2xl shadow-xl border border-blue-100 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Clock className="text-blue-600" /> Lịch sử làm bài
        </h2>
        <button onClick={onBack} className="text-sm font-medium text-gray-500 hover:text-gray-800">
          Đóng
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto max-h-[80vh]">
        {loading ? (
          <div className="text-center py-10 text-gray-400">Đang tải dữ liệu...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Bạn chưa làm bài thi nào.</div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => {
              // Tính điểm hệ 10
              const score10 = ((item.score / item.total) * 10).toFixed(1);
              const date = item.date?.toDate ? item.date.toDate() : new Date();
              
              // Màu sắc theo điểm
              let scoreColor = "text-red-500";
              if (Number(score10) >= 8) scoreColor = "text-green-500";
              else if (Number(score10) >= 5) scoreColor = "text-yellow-600";

              return (
                <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 text-lg mb-1 line-clamp-2">{item.topic}</h3>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Calendar size={12}/> {date.toLocaleDateString('vi-VN')}</span>
                      <span className="flex items-center gap-1"><Trophy size={12}/> {item.score}/{item.total} câu đúng</span>
                    </div>
                  </div>
                  
                  <div className="text-right pl-4 border-l border-gray-100 ml-4">
                    <div className={`text-2xl font-black ${scoreColor}`}>{score10}</div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold">Điểm</div>
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