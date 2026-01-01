import React, { useState, useMemo, useEffect, useRef } from 'react';
import { QuizConfig } from '../types';
import { auth } from '../firebase'; 
import { useSubscription } from './SubscriptionGuard'; 
import { generateTheory } from '../geminiService'; 
import { LatexText } from './LatexText'; 
import { Sparkles, KeyRound, LogOut, Clock, BookOpen, X, Image, Upload, Copy, Wand2, Trash2, RefreshCcw, Camera } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { FileText } from 'lucide-react'; 
// Thêm các hàm mới vào dòng import từ pdfHelper
import { 
  getPdfPagesPreview, 
  renderHighResPage, 
  PdfPagePreview 
} from '../utils/pdfHelper';

// Import component Modal (Giả sử bạn để file này cùng thư mục components)
  import { PdfSelectorModal } from './PdfSelectorModal';

interface Props {
  onGenerate: (config: QuizConfig, apiKey: string) => void;
  onGenerateFromImage?: (images: File[], mode: 'EXACT' | 'SIMILAR', prompt: string, apiKey: string, timeLimit: number, topicName?: string) => void;
  isLoading: boolean;
}

export const QuizInput: React.FC<Props> = ({ onGenerate, onGenerateFromImage, isLoading }) => {
  const [topic, setTopic] = useState('');
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saveKey, setSaveKey] = useState(true);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imageTopic, setImageTopic] = useState('');
  const [showTheoryModal, setShowTheoryModal] = useState(false);
  const [theoryContent, setTheoryContent] = useState('');
  const [loadingTheory, setLoadingTheory] = useState(false);
  const [timeLimit, setTimeLimit] = useState(15);
  const pasteInputRef = useRef<HTMLInputElement>(null);
  
  const { daysLeft, isPremium } = useSubscription();

  // Gọi file PDF
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);

  const [pdfPreviews, setPdfPreviews] = useState<PdfPagePreview[] | null>(null);

const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setIsProcessingPdf(true);
  try {
    const previews = await getPdfPagesPreview(file);
    setPdfPreviews(previews); // Mở Modal chọn trang
  } catch (err) {
    alert("Lỗi đọc PDF");
  } finally {
    setIsProcessingPdf(false);
  }
};

const handleConfirmPdfPages = async (selectedOriginalPages: any[]) => {
  setIsProcessingPdf(true);
  setPdfPreviews(null); // Đóng modal
  try {
    const highResFiles = await Promise.all(
      selectedOriginalPages.map(page => renderHighResPage(page))
    );
    await addImagesToState(highResFiles); // Thêm vào danh sách ảnh để AI xử lý
  } catch (err) {
    alert("Lỗi chuyển đổi trang");
  } finally {
    setIsProcessingPdf(false);
  }
};

  useEffect(() => {
    // 1. Khi component mount, lấy key đã lưu từ máy lên
    const saved = localStorage.getItem('user_gemini_key');
    if (saved) setApiKey(saved);
  }, []);
  
  // 2. [THÊM MỚI] Tự động lưu Key mỗi khi giá trị apiKey thay đổi và saveKey được bật
  useEffect(() => {
    if (saveKey && apiKey.trim()) {
      localStorage.setItem('user_gemini_key', apiKey.trim());
    } else if (!saveKey) {
      localStorage.removeItem('user_gemini_key');
    }
  }, [apiKey, saveKey]);

  const [matrix, setMatrix] = useState({
    TN: { BIET: 0, HIEU: 0, VANDUNG: 0 },
    TLN: { BIET: 0, HIEU: 0, VANDUNG: 0 },
    DS: { BIET: 0, HIEU: 0, VANDUNG: 0 },
  });

  const totalQuestions = useMemo(() => {
    let total = 0;
    Object.values(matrix).forEach(type => {
      total += (type.BIET || 0) + (type.HIEU || 0) + (type.VANDUNG || 0);
    });
    return total;
  }, [matrix]);

  // SỬ DỤNG 'prompt' TẠI ĐÂY (Xóa cảnh báo getDisplayTotal)
  const getDisplayTotal = () => {
    if (selectedImages.length > 0) {
      const match = prompt.match(/\d+/); 
      return match ? match[0] : "?";
    }
    return totalQuestions;
  };

  const handleChange = (type: 'TN'|'TLN'|'DS', level: 'BIET'|'HIEU'|'VANDUNG', val: string) => {
    const num = parseInt(val) || 0;
    setMatrix(prev => ({ ...prev, [type]: { ...prev[type], [level]: num } }));
  };

  const addImagesToState = async (files: File[]) => {
    if (selectedImages.length + files.length > 4) return alert("Tối đa 4 ảnh!");
    try {
        const compressed = await Promise.all(files.map(async f => {
            if (f.size > 1024 * 1024) {
                return await imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true });
            }
            return f;
        }));
        setSelectedImages(prev => [...prev, ...compressed.map((f, i) => new File([f], files[i].name, { type: files[i].type }))]);
    } catch (err) { console.error(err); }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
    if (e.target.files) addImagesToState(Array.from(e.target.files)); 
  };

  const handleOpenTheory = async () => {
    if (!topic || !apiKey) return alert("Nhập chủ đề và API Key!");
    setShowTheoryModal(true);
    if (theoryContent) return;
    setLoadingTheory(true);
    try { setTheoryContent(await generateTheory(topic, apiKey)); } 
    catch { alert("Lỗi tải lý thuyết"); setShowTheoryModal(false); } 
    finally { setLoadingTheory(false); }
  };

  const handleSubmit = () => {
    if (!apiKey.trim() || !topic) return alert("Thiếu Key hoặc Chủ đề!");
    // SỬ DỤNG 'saveKey' TẠI ĐÂY (Xóa cảnh báo saveKey)
    if (saveKey) localStorage.setItem('user_gemini_key', apiKey);
    onGenerate({ topic, distribution: matrix, additionalPrompt: prompt, timeLimit }, apiKey);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-blue-100 relative">
      <button onClick={() => auth.signOut()} className="absolute top-5 right-5 text-gray-400 hover:text-red-500 text-xs flex items-center gap-1 font-bold"><LogOut size={14}/> Thoát</button>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">AI TẠO ĐỀ</h1>
        <p className="text-green-500 mb-2">Xin chào, {auth.currentUser?.displayName}!</p>
        <div className="inline-block bg-yellow-100 px-6 py-2 rounded-xl border border-yellow-300">
          <p className="text-violet-700 font-bold text-base">Tác giả: Trần Thị Kim Thu</p>
          <p className="text-violet-600 text-xs font-bold uppercase tracking-wider mt-1">Trường THPT Cây Dương</p>
        </div>
      </div>

      <div className="mb-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-bold text-yellow-800 flex items-center gap-2"><KeyRound size={18}/> Gemini API Key</label>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-blue-600">Lấy Key</a>
        </div>
        <input type="text" style={{ WebkitTextSecurity: 'disc' } as any} value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full p-3 border border-yellow-300 rounded-lg outline-none bg-white" placeholder="Dán mã Key..." />
        <div className="mt-2 flex items-center gap-2">
          <input type="checkbox" id="saveKeyInput" checked={saveKey} onChange={(e) => setSaveKey(e.target.checked)} />
          <label htmlFor="saveKeyInput" className="text-xs text-gray-600">Lưu Key trên máy này</label>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Chủ đề môn học</label>
        <div className="flex gap-2">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} className="flex-1 p-3 border rounded-lg outline-none focus:ring-2 focus:ring-primary" placeholder="Ví dụ: Đạo hàm..." />
          <button onClick={handleOpenTheory} className="bg-orange-500 text-white px-4 rounded-lg font-bold flex items-center gap-2 shadow-md"><BookOpen size={20} /> Lý thuyết</button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <label className="text-sm font-medium">Cấu trúc đề</label>
          <span className="text-xs text-red-500 italic mr-2">(Tổng trọng số nên: {'<='} 20 (TN = 1, TLN = 2, ĐS = 4))</span>
          <span className="text-sm font-bold text-primary bg-blue-50 px-2 py-1 rounded">Tổng: {totalQuestions} câu</span>
        </div>
        <div className="overflow-x-auto pb-2 border rounded-lg bg-gray-50 p-2">
          {/* Thay đổi grid-cols-4 và gap để các cột sát nhau hơn */}
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-2 text-center w-full min-w-[280px]">
          <div className="text-gray-400 font-bold text-xs">Loại\Mức</div>
          <div className="text-green-600 font-bold text-xs uppercase">Biết</div>
          <div className="text-blue-600 font-bold text-xs uppercase">Hiểu</div>
          <div className="text-purple-600 font-bold text-xs uppercase">VD</div>
          
          {['TN', 'TLN', 'DS'].map(type => (
            <React.Fragment key={type}>
              <div className="font-bold self-center text-xs">{type}</div>
              {(['BIET', 'HIEU', 'VANDUNG'] as const).map(level => (
                <input 
                  key={level} 
                  type="number" 
                  min="0" 
                  // Điều chỉnh padding (p-2), chiều cao (h-14) và cỡ chữ (text-xs) 
                  className="h-14 p-2 border rounded text-center text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary" 
                  onChange={e => handleChange(type as any, level, e.target.value)} 
                  placeholder=" "
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
      </div>

      {/* SỬ DỤNG 'prompt' TẠI ĐÂY (Xóa cảnh báo setPrompt) */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Yêu cầu bổ sung (Optional)</label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full p-3 border rounded-lg h-20 resize-none outline-none focus:ring-2 focus:ring-primary" placeholder="Ví dụ: Tạo 5 câu trắc nghiệm/Lời giải vắn tắt/Không vẽ hình" />
      </div>

      <div className="mb-8 border-t pt-6">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Image size={20} className="text-blue-600"/> Tạo đề từ ảnh</h3>
        <div className="flex gap-2 mb-4">
        <label htmlFor="pdf-up" className="bg-red-50 p-2 rounded border cursor-pointer flex items-center gap-1 text-xs text-red-700 border-red-200">
            {isProcessingPdf ? <RefreshCcw size={14} className="animate-spin"/> : <FileText size={14}/>}
            PDF
          </label>
          <input id="pdf-up" type="file" accept="application/pdf" className="hidden" onChange={handlePdfChange} disabled={isProcessingPdf} />
          {pdfPreviews && (
            <PdfSelectorModal 
              previews={pdfPreviews}
              onClose={() => setPdfPreviews(null)}
              onConfirm={handleConfirmPdfPages}
            />
          )}

          <label htmlFor="img-up" className="bg-gray-100 p-2 rounded border cursor-pointer flex items-center gap-1 text-xs"><Upload size={14}/> PNG</label>
          <input id="img-up" type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
          
          <label htmlFor="cam-up" className="bg-blue-50 p-2 rounded border cursor-pointer flex items-center gap-1 text-xs text-blue-700 border-blue-200"><Camera size={14}/> Camera</label>
          <input id="cam-up" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageChange} />
          
          {/* SỬ DỤNG 'pasteInputRef' & 'Copy' TẠI ĐÂY */}
          <button onClick={() => pasteInputRef.current?.focus()} className="bg-purple-50 p-2 rounded border border-purple-200 flex items-center gap-1 text-xs text-purple-700 relative">
            <Copy size={14}/> Dán ảnh
            <input ref={pasteInputRef} type="text" className="absolute opacity-0 inset-0 w-full" onPaste={(e) => {
              const items = e.clipboardData?.items;
              if (items) {
                const files = Array.from(items).filter(i => i.type.includes("image")).map(i => i.getAsFile()).filter(Boolean) as File[];
                if (files.length) addImagesToState(files);
              }
              if (pasteInputRef.current) pasteInputRef.current.value = '';
            }} />
          </button>
        </div>

        {selectedImages.length > 0 && (
          <div className="flex justify-between items-center mb-2 px-1">
             <span className="text-[10px] font-bold text-gray-400">{selectedImages.length}/4 ảnh</span>
             {/* SỬ DỤNG 'Trash2' TẠI ĐÂY */}
             <button onClick={() => setSelectedImages([])} className="text-red-500 flex items-center gap-1 text-[10px] font-bold uppercase"><Trash2 size={12}/> Xóa hết</button>
          </div>
        )}

        {selectedImages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {selectedImages.map((f, i) => (
              <div key={i} className="relative w-20 h-20 shrink-0">
                <img src={URL.createObjectURL(f)} className="w-full h-full object-cover rounded-lg border shadow-sm" alt="preview" />
                <button onClick={() => setSelectedImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md"><X size={12}/></button>
              </div>
            ))}
          </div>
        )}

        {/* SỬ DỤNG 'imageTopic' TẠI ĐÂY (Xóa cảnh báo setImageTopic) */}
        <div className="mb-3">
            <input value={imageTopic} onChange={(e) => setImageTopic(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Đặt tên cho đề này..." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => onGenerateFromImage?.(selectedImages, 'EXACT', prompt, apiKey, timeLimit, imageTopic)} disabled={isLoading || !selectedImages.length} className="py-3 bg-teal-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"><Copy size={18}/> GIỐNG HỆT</button>
          {/* SỬ DỤNG 'Wand2' TẠI ĐÂY */}
          <button onClick={() => onGenerateFromImage?.(selectedImages, 'SIMILAR', prompt, apiKey, timeLimit, imageTopic)} disabled={isLoading || !selectedImages.length} className="py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"><Wand2 size={18}/> TƯƠNG TỰ</button>
        </div>
      </div>

      <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
        <label className="text-sm font-bold text-blue-800 flex items-center gap-2"><Clock size={18}/> Thời gian làm bài (phút)</label>
        <input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Math.max(1, parseInt(e.target.value)||0))} className="w-full p-2 border border-blue-300 rounded-lg mt-2 focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      {/* SỬ DỤNG 'getDisplayTotal' TẠI ĐÂY */}
      <button onClick={handleSubmit} disabled={isLoading} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg flex justify-center items-center gap-2 active:scale-95 transition-all disabled:opacity-60">
        {isLoading ? (
            <div className="flex items-center gap-3">
                <RefreshCcw className="animate-spin" size={20} /> 
                <span>AI ĐANG TẠO ({getDisplayTotal()} CÂU)...</span>
            </div>
        ) : (
            <div className="flex items-center gap-2"><Sparkles size={20} /> TẠO THEO CHỦ ĐỀ ({totalQuestions} CÂU)</div>
        )}
      </button>

      <div className="mt-6 text-center border-t pt-4">
        {isPremium ? (
            <div className="text-sm font-bold text-green-600 flex items-center justify-center gap-1"><Sparkles size={16} /> Tài khoản VIP</div>
        ) : (
            <div className="text-xs text-gray-500"><Clock className="inline mr-1" size={14} /> Còn <b>{daysLeft} ngày</b> dùng thử.</div>
        )}
      </div>

      {showTheoryModal && (
        <div className="fixed top-24 right-5 w-[450px] max-w-[90vw] h-[80vh] bg-white rounded-2xl shadow-2xl border flex flex-col z-[100] animate-in slide-in-from-right duration-300">
          <div className="p-4 border-b flex justify-between items-center bg-orange-50 rounded-t-2xl">
            <h3 className="font-bold text-orange-800 flex items-center gap-2"><BookOpen size={20}/> LÝ THUYẾT GHI NHỚ</h3>
            <button onClick={() => setShowTheoryModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-gray-400 hover:text-red-500 shadow-sm border border-gray-100 transition-all"><X size={18}/></button>
          </div>
          <div className="p-5 overflow-y-auto flex-1 text-sm leading-relaxed">
            {loadingTheory ? (
                <div className="flex flex-col items-center justify-center h-full space-y-3">
                    <RefreshCcw className="animate-spin text-orange-500" size={32} />
                    <p className="text-gray-400 text-xs">Đang tra cứu...</p>
                </div>
            ) : (
                <div className="whitespace-pre-wrap"><LatexText text={theoryContent} /></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};