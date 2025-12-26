import React, { useState, useMemo, useEffect, useRef } from 'react';
import { QuizConfig } from '../types';
// import { Sparkles, KeyRound, LogOut, Clock } from 'lucide-react';
import { auth } from '../firebase'; // Import auth
import { useSubscription } from './SubscriptionGuard'; // Import Hook lấy ngày
// --------------------------------------THÊM LÝ THUYẾT
// import { Sparkles, KeyRound, LogOut, Clock, BookOpen, X } from 'lucide-react'; // Thêm BookOpen, X
import { generateTheory } from '../geminiService'; // Import hàm mới
import { LatexText } from './LatexText'; // Để hiển thị công thức toán
// Thêm Image, Upload, Copy, Wand2 vào dòng import từ 'lucide-react'
import { Sparkles, KeyRound, LogOut, Clock, BookOpen, X, Image, Upload, Copy, Wand2, Trash2, RefreshCcw, Camera} from 'lucide-react';
import imageCompression from 'browser-image-compression';
// ----------------------------------
interface Props {
  // Callback cũ cho tạo đề theo chủ đề
  onGenerate: (config: QuizConfig, apiKey: string) => void;
  // Cập nhật dòng này: thêm tham số topicName (string) vào cuối
  onGenerateFromImage?: (images: File[], mode: 'EXACT' | 'SIMILAR', prompt: string, apiKey: string, timeLimit: number, topicName?: string) => void;  isLoading: boolean;
}

export const QuizInput: React.FC<Props> = ({ onGenerate, onGenerateFromImage, isLoading }) => {
  const [topic, setTopic] = useState('');
  const [prompt, setPrompt] = useState('');
  
  // --- STATE CHO API KEY ---
  const [apiKey, setApiKey] = useState('');
  const [saveKey, setSaveKey] = useState(true);
  // ... các state cũ (topic, prompt, apiKey...)
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imageTopic, setImageTopic] = useState(''); // <--- THÊM DÒNG NÀY
  // -----------------THÊM LÝ THUYẾT
  // ... bên trong component QuizInput
  const [showTheoryModal, setShowTheoryModal] = useState(false);
  const [theoryContent, setTheoryContent] = useState('');
  const [loadingTheory, setLoadingTheory] = useState(false);
  // -------------------------------------
  // 1. Thêm state trong QuizInput
  const [timeLimit, setTimeLimit] = useState(15);
  // 1. Tạo Ref để hỗ trợ Dán ảnh trên Mobile (Đặt dưới selectedImages)
  const pasteInputRef = useRef<HTMLInputElement>(null);

  // 2. Hàm nén và thêm ảnh (Dùng chung cho cả 3 nguồn: File, Camera, Dán)
  const addImagesToState = async (files: File[]) => {
    const totalFiles = selectedImages.length + files.length;
    if (totalFiles > 4) {
      alert("Chỉ được chọn tối đa 4 ảnh!");
      return;
    }

    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
    };

    try {
      const compressedFiles: File[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        // Nén nếu file > 1MB
        const compressed = file.size / 1024 / 1024 > 1 
          ? await imageCompression(file, options) 
          : file;
        compressedFiles.push(new File([compressed], file.name, { type: file.type }));
      }
      setSelectedImages(prev => [...prev, ...compressedFiles]);
    } catch (error) {
      console.error("Lỗi nén ảnh:", error);
      const validImages = files.filter(f => f.type.startsWith('image/'));
      setSelectedImages(prev => [...prev, ...validImages]);
    }
  };

  // 3. Hàm xử lý khi bấm nút Chọn file hoặc Chụp ảnh
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addImagesToState(Array.from(e.target.files));
    }
  }; 

  // Hàm xóa ảnh đã chọn
  const removeImage = (index: number) => {
      setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };
// ====================================================================================
  // Lấy thông tin ngày còn lại từ SubscriptionGuard (MỚI THÊM)
  const { daysLeft, isPremium } = useSubscription();

  // Load Key từ LocalStorage khi mở app
  useEffect(() => {
    const saved = localStorage.getItem('user_gemini_key');
    if (saved) setApiKey(saved);
  }, []);

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
  // =====Thêm lý thuyết
  const handleOpenTheory = async () => {
    if (!topic) return alert("Vui lòng nhập chủ đề trước!");
    if (!apiKey) return alert("Cần có API Key để tải lý thuyết!");

    setShowTheoryModal(true);

    // Nếu đã có nội dung rồi thì không load lại để tiết kiệm token
    if (theoryContent) return;

    setLoadingTheory(true);
    try {
        const content = await generateTheory(topic, apiKey);
        setTheoryContent(content);
    } catch (e) {
        alert("Lỗi tải lý thuyết");
        setShowTheoryModal(false);
    } finally {
        setLoadingTheory(false);
    }
  };
  // -----------------------------
  // 2. Cập nhật hàm handleSubmit để gửi kèm timeLimit
  const handleSubmit = () => {
    if (!apiKey.trim()) return alert("Vui lòng nhập API Key!");
    if (!topic) return alert("Vui lòng nhập chủ đề!");
    
    onGenerate({ 
      topic, 
      distribution: matrix, 
      additionalPrompt: prompt,
      timeLimit: timeLimit // Gửi số phút xuống App.tsx
    }, apiKey);
  };

// 1. Tạo một function để lấy số câu dự kiến
// 4. Hàm tính số câu hiển thị trên nút (Đặt trước return)
    const getDisplayTotal = () => {
      if (selectedImages.length > 0) {
        const match = prompt.match(/\d+/); 
        return match ? match[0] : "?";
      }
      return totalQuestions;
    };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-blue-100 relative">
      
      {/* Nút Đăng xuất */}
      <button onClick={() => auth.signOut()} className="absolute top-5 right-5 text-gray-400 hover:text-red-500 text-xs flex items-center gap-1 font-bold">
        <LogOut size={14}/> Thoát
      </button>

      {/* ... code cũ ở trên ... */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">AI TẠO ĐỀ</h1>
        <p className="text-gray-500 mb-2">Cô Thu mến chào, {auth.currentUser?.displayName}!</p>
        
        {/* --- [CODE ĐÃ SỬA MÀU] --- */}
        {/* bg-yellow-100: Nền vàng nhạt */}
        {/* border-yellow-300: Viền vàng đậm hơn chút cho rõ nét */}
        <div className="inline-block bg-yellow-100 px-6 py-2 rounded-xl border border-yellow-300 shadow-sm">
            {/* text-violet-700: Chữ màu tím Violet đậm */}
            <p className="text-violet-700 font-bold text-base">
                Tác giả: Trần Thị Kim Thu
            </p>
            {/* text-violet-600: Chữ màu tím Violet nhạt hơn chút */}
            <p className="text-violet-600 text-xs font-bold uppercase tracking-wider mt-1">
                Trường THPT Cây Dương
            </p>
        </div>
        {/* ------------------------- */}
      </div>
      {/* --- KHU VỰC NHẬP API KEY --- */}
      <div className="mb-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-bold text-yellow-800 flex items-center gap-2">
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
    <div className="flex gap-2">
        <input 
          value={topic}
          onChange={(e) => {
              setTopic(e.target.value);
              setTheoryContent(''); // Reset lý thuyết khi đổi chủ đề
          }}
          placeholder="Ví dụ: Hàm số bậc 3, Tích phân..." 
          className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
        />

        {/* NÚT LÝ THUYẾT MỚI */}
        <button 
            onClick={handleOpenTheory}
            className="bg-orange-500 hover:bg-orange-600 text-white p-3 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 whitespace-nowrap"
            title="Xem công thức & Lý thuyết"
        >
            <BookOpen size={20} /> Lý thuyết
        </button>
        </div>
      </div>
      <div className="mb-6">
        <div className="flex justify-between items-end mb-2">
          <label className="block text-sm font-medium text-gray-700">Cấu trúc đề thi</label>
          {/* Thêm dòng chú thích nhỏ */}
          <span className="text-xs text-red-500 italic mr-2">(Khuyên dùng: &lt; 10 câu để AI chạy tốt nhất)</span>
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
          placeholder="Ví dụ: Câu mức vận dụng nên tạo bài toán thực tế..." 
          className="w-full p-3 border rounded-lg h-24 resize-none focus:ring-2 focus:ring-primary outline-none"
        />
      </div>

  {/* --- KHU VỰC TẠO ĐỀ TỪ ẢNH (MỚI) --- */}
  <div className="mb-8 border-t pt-6">
      <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Image size={20} className="text-blue-600"/> Tạo đề từ Hình ảnh
      </h3>
      <p className="text-sm text-gray-500 mb-4">Load tối đa 2 trang - tuỳ độ khó dễ hay ngắn dài của lời giải.</p>

      {/* Khu vực chọn file và hiển thị thumbnail */}
          <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
            {/* CHỌN FILE */}
            <label htmlFor="image-upload" className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg font-medium flex items-center gap-2 border border-gray-300 text-xs shadow-sm">
                <Upload size={16}/> File
            </label>
            <input id="image-upload" type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} disabled={isLoading} />

            {/* CHỤP ẢNH */}
            <label htmlFor="camera-upload" className="cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg font-medium flex items-center gap-2 border border-blue-200 text-xs shadow-sm">
                <Camera size={16}/> Camera
            </label>
            <input id="camera-upload" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageChange} disabled={isLoading} />

            {/* DÁN ẢNH (Dùng cho cả Mobile & PC) */}
            <button
                type="button"
                onClick={() => pasteInputRef.current?.focus()}
                className="relative overflow-hidden cursor-pointer bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-2 rounded-lg font-medium flex items-center gap-2 border border-purple-200 text-xs shadow-sm"
            >
                <Copy size={16}/> Dán ảnh
                <input
                    ref={pasteInputRef}
                    type="text"
                    className="absolute opacity-0 inset-0 w-full cursor-pointer"
                    onPaste={(e) => {
                        const items = e.clipboardData?.items;
                        if (items) {
                            const files: File[] = [];
                            for (let i = 0; i < items.length; i++) {
                                if (items[i].type.indexOf("image") !== -1) {
                                    const blob = items[i].getAsFile();
                                    if (blob) files.push(blob);
                                }
                            }
                            if (files.length > 0) addImagesToState(files);
                        }
                        if (pasteInputRef.current) pasteInputRef.current.value = '';
                    }}
                />
            </button>
        </div>
        
        {/* Hiển thị số lượng ảnh đã chọn */}
        <div className="flex justify-between items-center px-1 mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{selectedImages.length}/4 ảnh</span>
            {selectedImages.length > 0 && (
                <button onClick={() => setSelectedImages([])} className="text-[10px] text-red-400 hover:text-red-600 font-bold uppercase">Xóa hết</button>
            )}
        </div>
        
        {/* Thumbnails hiển thị ảnh */}
        {selectedImages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {selectedImages.map((file, index) => (
                    <div key={index} className="relative flex-shrink-0 w-20 h-20 rounded-lg border-2 border-white shadow-md overflow-hidden group">
                        <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                        <button onClick={() => removeImage(index)} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-90">
                            <Trash2 size={10} />
                        </button>
                    </div>
                ))}
            </div>
        )}
    </div>


          {/* --- THÊM Ô NHẬP TÊN ĐỀ --- */}
      <div className="mb-3">
          <input 
              type="text" 
              value={imageTopic}
              onChange={(e) => setImageTopic(e.target.value)}
              placeholder="Đặt tên cho đề này (VD: Đề thi giữa kỳ 1...)" 
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
      </div>
      {/* -------------------------- */}

      {/* Các nút chức năng ảnh */}
      <div className="grid grid-cols-2 gap-3">
          <button
              onClick={() => {
                  if(!apiKey) return alert("Vui lòng nhập API Key!");
                  if(selectedImages.length === 0) return alert("Vui lòng chọn ảnh!");
                  // Truyền thêm imageTopic vào cuối hàm
                  onGenerateFromImage?.(selectedImages, 'EXACT', prompt, apiKey, timeLimit, imageTopic);
              }}
              disabled={isLoading || selectedImages.length === 0}
              className="py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none shadow-sm shadow-teal-200"
          >
              <Copy size={18}/> TẠO ĐỀ GIỐNG HỆT
          </button>
          <button
              onClick={() => {
                  if(!apiKey) return alert("Vui lòng nhập API Key!");
                  if(selectedImages.length === 0) return alert("Vui lòng chọn ảnh!");
                  // Truyền thêm imageTopic vào cuối hàm
                  onGenerateFromImage?.(selectedImages, 'SIMILAR', prompt, apiKey, timeLimit, imageTopic);
              }}
              disabled={isLoading || selectedImages.length === 0}
              className="py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none shadow-sm shadow-indigo-200"
          >
              <Wand2 size={18}/> TẠO ĐỀ TƯƠNG TỰ
          </button>
      </div>
    </div>

    <div className="relative flex py-3 items-center mb-4">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink mx-4 text-gray-400 text-sm font-medium">HOẶC TẠO THEO CHỦ ĐỀ</span>
          <div className="flex-grow border-t border-gray-300"></div>
    </div>
    {/* 3. Thêm UI vào trước nút "Tạo theo chủ đề" */}
    <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
    <label className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
      <Clock size={18}/> Thời gian làm bài (phút)
    </label>
      <input 
        type="number" 
        value={timeLimit}
        onChange={(e) => setTimeLimit(Math.max(1, parseInt(e.target.value) || 0))}
        className="w-full p-2 border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p className="text-[11px] text-blue-600 mt-1 italic">* Đồng hồ sẽ đếm xuôi để theo dõi tổng thời gian làm bài.</p>
    </div>

      {/* ------------------------------------------- */}
        <button 
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none shadow-lg shadow-blue-200"
            >
              {isLoading ? (
                <div className="flex items-center gap-3">
                    <RefreshCcw className="animate-spin" size={24} /> 
                    <span>AI đang suy nghĩ ({getDisplayTotal()} câu)...</span>
                </div>
              ) : (          
                <div className="flex items-center gap-2">
                    <Sparkles size={20} /> 
                    TẠO THEO CHỦ ĐỀ ({totalQuestions} CÂU)
                </div>
              )}
      </button>

  {/* --- PHẦN HIỂN THỊ SỐ NGÀY CÒN LẠI (CẬP NHẬT) --- */}
      <div className="mt-6 text-center border-t pt-4">
        {isPremium ? (
            <div className="text-sm font-bold text-green-600 flex items-center justify-center gap-1">
                <Sparkles size={16} /> Tài khoản VIP (Không giới hạn)
            </div>
        ) : (
            <div className="space-y-2">
                <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                    <Clock size={14} /> 
                    Bạn còn <b className="text-blue-600">{daysLeft} ngày</b> dùng thử miễn phí.
                </div>
                
                {/* THÊM MỚI: Dòng mời trà ủng hộ tác giả */}
                <div className="bg-orange-50 p-3 rounded-xl border border-dashed border-orange-200 inline-block">
                    <p className="text-[11px] text-orange-800 italic">
                        Mời tác giả ly Trà qua stk: <b>Kienlongbank: 36480233</b>
                        <br /> (nếu thấy ứng dụng hữu ích)
                    </p>
                </div>
            </div>
        )}
      </div>

      {/* --- CẬP NHẬT: MODAL DẠNG SIDEBAR (VỪA XEM VỪA LÀM) --- */}
      {showTheoryModal && (
              // Thay đổi:
              // 1. Bỏ "inset-0 bg-black/50" (để không chắn màn hình)
              // 2. Thêm "fixed top-24 right-5" (để neo vào góc phải)
              // 3. Thêm shadow đậm để nổi bật trên nền trắng
              <div className="fixed top-24 right-5 w-[450px] max-w-[90vw] h-[80vh] bg-white rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.15)] border border-gray-200 z-50 flex flex-col animate-in slide-in-from-right duration-300">
                  
                  {/* Header Sidebar */}
                  {/* Thêm cursor-move nếu bạn muốn phát triển chức năng kéo thả sau này */}
                  <div className="p-4 border-b flex justify-between items-center bg-orange-50 rounded-t-2xl">
                      <h3 className="text-lg font-bold text-orange-800 flex items-center gap-2">
                          <BookOpen size={20}/> LÝ THUYẾT GHI NHỚ
                      </h3>
                      <button 
                          onClick={() => setShowTheoryModal(false)} 
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm border border-gray-100"
                          title="Đóng lý thuyết"
                      >
                          <X size={18} />
                      </button>
                  </div>

                  {/* Content Sidebar */}
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

                  {/* Footer Sidebar */}
                  <div className="p-3 border-t bg-gray-50 rounded-b-2xl text-center">
                      <p className="text-xs text-gray-400 italic">
                          Cửa sổ này cho phép bạn vừa xem vừa thao tác
                      </p>
                  </div>
              </div>
            )}
            {/* --------------------------------------- */}
    </div>
  );
};