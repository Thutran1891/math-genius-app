import React, { useState, useMemo, useEffect } from 'react';
import { QuizConfig } from '../types';
import { Sparkles, KeyRound, LogOut } from 'lucide-react';
import { auth } from '../firebase'; // Import auth

interface Props {
  // SỬA: Hàm callback nhận thêm apiKey
  onGenerate: (config: QuizConfig, apiKey: string) => void;
  isLoading: boolean;
}

export const QuizInput: React.FC<Props> = ({ onGenerate, isLoading }) => {
  const [topic, setTopic] = useState('');
  const [prompt, setPrompt] = useState('');
  
  // --- THÊM STATE CHO API KEY ---
  const [apiKey, setApiKey] = useState('');
  const [saveKey, setSaveKey] = useState(true);

  // Load Key từ LocalStorage khi mở app
  useEffect(() => {
    const saved = localStorage.getItem('user_gemini_key');
    if (saved) setApiKey(saved);
  }, []);
  // -----------------------------

  const [matrix, setMatrix] = useState({
    TN: { BIET: 0, HIEU: 0, VANDUNG: 0 },
    TLN: { BIET: 0, HIEU: 0, VANDUNG: 0 },
    DS: { BIET: 0, HIEU: 0, VANDUNG: 0 },
  });

  // Tính tổng số câu hỏi theo thời gian thực
  const totalQuestions = useMemo(() => {
    let total = 0;
    Object.values(matrix).forEach(type => {
      total += (type.BIET || 0) + (type.HIEU || 0) + (type.VANDUNG || 0);
    });
    return total;
  }, [matrix]);

  const handleChange = (type: 'TN'|'TLN'|'DS', level: 'BIET'|'HIEU'|'VANDUNG', val: string) => {
    const num = parseInt(val) || 0;
    setMatrix(prev => ({
      ...prev,
      [type]: { ...prev[type], [level]: num }
    }));
  };

  const handleSubmit = () => {
    // Validate Key
    if (!apiKey.trim()) return alert("Vui lòng nhập API Key để tiếp tục!");
    if (!topic) return alert("Vui lòng nhập chủ đề!");
    if (totalQuestions === 0) return alert("Vui lòng nhập số lượng câu hỏi ít nhất là 1!");
    
    // Lưu Key nếu người dùng chọn
    if (saveKey) localStorage.setItem('user_gemini_key', apiKey);
    else localStorage.removeItem('user_gemini_key');

    // Gửi Key kèm config
    onGenerate({ topic, distribution: matrix, additionalPrompt: prompt }, apiKey);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-blue-100 relative">
      
      {/* Nút Đăng xuất */}
      <button onClick={() => auth.signOut()} className="absolute top-5 right-5 text-gray-400 hover:text-red-500 text-xs flex items-center gap-1 font-bold">
        <LogOut size={14}/> Thoát
      </button>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">MathGenius AI</h1>
        <p className="text-gray-500">Cô Thu chào, {auth.currentUser?.displayName}!</p>
      </div>

      {/* --- KHU VỰC NHẬP API KEY --- */}
      <div className="mb-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-bold text-yellow-800 flex items-center gap-2">
                <KeyRound size={18}/> Gemini API Key
            </label>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                Dán Key tại đây
            </a>
        </div>
        <input 
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Dán mã Key bắt đầu bằng AIza..." 
          className="w-full p-3 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none bg-white"
        />
        <div className="mt-2 flex items-center gap-2">
            <input 
                type="checkbox" id="saveKey" 
                checked={saveKey} onChange={(e) => setSaveKey(e.target.checked)} 
                className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="saveKey" className="text-xs text-gray-600 cursor-pointer select-none">
                Lưu Key trên máy này cho lần sau
            </label>
        </div>
      </div>
      {/* --------------------------- */}

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề môn học</label>
        <input 
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Ví dụ: Hàm số bậc 3, Hình học không gian..." 
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
        />
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-end mb-2">
          <label className="block text-sm font-medium text-gray-700">Cấu trúc đề thi</label>
          <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
            Tổng cộng: {totalQuestions} câu
          </span>
        </div>
        
        <div className="grid grid-cols-4 gap-4 text-center text-sm">
          <div className="font-bold text-gray-400 self-end pb-2">Loại \ Mức</div>
          <div className="font-semibold text-green-600 bg-green-50 py-2 rounded">Biết</div>
          <div className="font-semibold text-blue-600 bg-blue-50 py-2 rounded">Hiểu</div>
          <div className="font-semibold text-purple-600 bg-purple-50 py-2 rounded">Vận dụng</div>

          {/* Dòng Trắc nghiệm */}
          <div className="flex items-center justify-center font-bold bg-gray-50 rounded">TN (4 chọn 1)</div>
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('TN', 'BIET', e.target.value)} />
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('TN', 'HIEU', e.target.value)} />
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('TN', 'VANDUNG', e.target.value)} />

          {/* Dòng Tự luận số */}
          <div className="flex items-center justify-center font-bold bg-gray-50 rounded">TLN (Điền số)</div>
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('TLN', 'BIET', e.target.value)} />
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('TLN', 'HIEU', e.target.value)} />
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('TLN', 'VANDUNG', e.target.value)} />

          {/* Dòng Đúng Sai */}
          <div className="flex items-center justify-center font-bold bg-gray-50 rounded">ĐS (Đúng/Sai)</div>
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('DS', 'BIET', e.target.value)} />
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('DS', 'HIEU', e.target.value)} />
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('DS', 'VANDUNG', e.target.value)} />
        </div>
      </div>

      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-1">Yêu cầu bổ sung (Optional)</label>
        <textarea 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ví dụ: Tập trung vào bài toán thực tế..." 
          className="w-full p-3 border rounded-lg h-24 resize-none focus:ring-2 focus:ring-primary outline-none"
        />
      </div>

      <button 
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-70"
      >
        {isLoading ? (
          <>Đang tạo {totalQuestions} câu hỏi...</>
        ) : (
          <><Sparkles /> TẠO ĐỀ NGAY ({totalQuestions} CÂU)</>
        )}
      </button>
    </div>
  );
};