import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { QuizConfig, Question } from "./types";

// const apiKey = import.meta.env.VITE_API_KEY as string;
const handleApiError = (error: any) => {
  console.error("Gemini API Error Detail:", error);

  let errorObj = {
    title: "Lỗi không xác định",
    detail: "Đã có sự cố xảy ra, vui lòng thử lại sau hoặc kiểm tra kết nối mạng."
  };

  const msg = error.message || "";

  // 1. Lỗi nội dung quá lớn/Tràn JSON (Biện pháp: Bớt số câu)
  if (msg.includes("400") || error instanceof SyntaxError || msg.includes("JSON")) {
    errorObj = {
      title: "Nội dung quá lớn",
      detail: "Số lượng câu hỏi hoặc hình ảnh vượt quá khả năng xử lý. Bạn hãy giảm bớt số lượng câu hỏi cần tạo (thử tạo 3-5 câu)."
    };
  }
  // 2. Lỗi API Key (Biện pháp: Thay key mới)
  else if (msg.includes("API_KEY_INVALID") || msg.includes("403")) {
    errorObj = {
      title: "API Key không hợp lệ",
      detail: "Mã Gemini Key của bạn đã hết hạn hoặc không chính xác. Vui lòng tạo Key mới tại AI Studio."
    };
  }
  // 3. Lỗi quá tải (Biện pháp: Chờ 1-2 phút)
  else if (msg.includes("429") || msg.includes("500") || msg.includes("503") || msg.includes("overloaded")) {
    errorObj = {
      title: "Máy chủ AI đang bận",
      detail: "Hệ thống Google đang quá tải. Bạn vui lòng chờ khoảng 1-2 phút rồi nhấn 'Tạo lại'."
    };
  }

  // BẮT BUỘC ném lỗi dưới dạng string JSON để App.tsx bắt được
  throw new Error(JSON.stringify(errorObj));
};

// Hàm thử lại (Retry) khi gặp lỗi quá tải
async function retryOperation<T>(
  operation: () => Promise<T>, 
  retries: number = 3, 
  delay: number = 2000
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Nếu hết lượt thử hoặc lỗi không phải do server (như sai Key, sai cú pháp) thì ném lỗi luôn
    // Mã 503 là Overloaded, 500 là Internal Server Error
    const isServerBusy = error.message?.includes('503') || error.message?.includes('Overloaded');
    
    if (retries <= 0 || !isServerBusy) {
      throw error;
    }
    
    console.warn(`Server quá tải, đang thử lại... (Còn ${retries} lần)`);
    
    // Chờ một chút trước khi thử lại (Exponential backoff: chờ lâu hơn sau mỗi lần lỗi)
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return retryOperation(operation, retries - 1, delay * 2);
  }
}

// --- SCHEMA CHUẨN ---

const variationTableSchema = {
    type: SchemaType.OBJECT,
    properties: {
        xNodes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Mốc x (LaTeX)" },
        yPrimeSigns: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Dấu y'" },
        yPrimeVals: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Giá trị tại dòng y' (0, ||)" },
        yNodes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Giá trị y (LaTeX). Tại tiệm cận đứng BẮT BUỘC dùng định dạng 'LeftVal||RightVal' (VD: '$+\\infty$||$-\\infty$')" }
    }
};

const geometryGraphSchema = {
    type: SchemaType.OBJECT,
    properties: {
        nodes: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    id: { type: SchemaType.STRING },
                    x: { type: SchemaType.NUMBER },
                    y: { type: SchemaType.NUMBER },
                    z: { type: SchemaType.NUMBER },
                    labelPosition: { type: SchemaType.STRING, nullable: true }
                },
                required: ['id', 'x', 'y', 'z']
            }
        },
        edges: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    from: { type: SchemaType.STRING },
                    to: { type: SchemaType.STRING },
                    style: { type: SchemaType.STRING, enum: ['SOLID', 'DASHED'] }
                },
                required: ['from', 'to', 'style']
            }
        }
    }
};

// Schema rỗng giả để tránh lỗi 400
const plotlyDataSchema = {
    type: SchemaType.OBJECT,
    properties: {
        data: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { x: {type: SchemaType.NUMBER, nullable:true} } } },
        layout: { type: SchemaType.OBJECT, properties: { title: {type: SchemaType.STRING, nullable:true} } }
    }
};

const questionSchema: any = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    type: { type: SchemaType.STRING, enum: ['TN', 'TLN', 'DS'] },
    // --- THÊM DÒNG NÀY VÀO ---
    difficulty: { type: SchemaType.STRING, enum: ["BIET", "HIEU", "VANDUNG"], description: "Mức độ câu hỏi" },
    // -------------------------
    questionText: { 
      type: SchemaType.STRING, 
      description: "Nội dung câu hỏi (LaTeX $). KHÔNG trả về HTML (như <table>). Nếu cần vẽ bảng thống kê, hãy dùng LaTeX Array. Đối với câu hỏi về hàm số thì chỉ cho duy nhất một trong các dạng thức: công thức, đồ thị, bảng biến thiên, đạo hàm, đồ thị đạo hàm."
  },
    options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    correctAnswer: { type: SchemaType.STRING, description: "TN: Chỉ trả về 'A', 'B', 'C' hoặc 'D'. TLN: Số." },
    explanation: { type: SchemaType.STRING, description: "Lời giải chi tiết. Dùng ký tự '\\n' để xuống dòng giữa các bước giải. Trình bày thoáng, dễ đọc." },

    // Cấu trúc bắt buộc cho câu Đúng/Sai
    statements: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          content: { type: SchemaType.STRING, description: "Nội dung phát biểu" },
          isCorrect: { type: SchemaType.BOOLEAN }
        },
        required: ["id", "content", "isCorrect"]
      },
      nullable: true
  },
  // ----------------------------------------------------
    
    variationTableData: { ...variationTableSchema, nullable: true },
    graphFunction: { 
      type: SchemaType.STRING, 
      nullable: true, 
      description: "BẮT BUỘC là null nếu câu hỏi không cần đồ thị. Tuyệt đối không để chuỗi rỗng." 
  },
    // --- THÊM DÒNG NÀY ---
    asymptotes: { 
      type: SchemaType.ARRAY, 
      items: { type: SchemaType.STRING }, 
      description: "BẮT BUỘC là null nếu không có đồ thị." 
  },
  // ---------------------
    geometryGraph: { ...geometryGraphSchema, nullable: true },
    plotlyData: { ...plotlyDataSchema, nullable: true }
  },
  required: ['id', 'type', 'questionText', 'explanation', 'correctAnswer', 'difficulty']
};

  // 1. TÍNH TỔNG SỐ CÂU HỎI
  export const generateQuiz = async (config: QuizConfig, userApiKey: string, signal?: AbortSignal): Promise<Question[]> => {
    if (!userApiKey) throw new Error("Vui lòng nhập API Key!");
  
    // 1. TÍNH TỔNG SỐ CÂU HỎI
    const totalQuestions = 
        Object.values(config.distribution).reduce((acc, type) => 
            acc + Object.values(type).reduce((sum, val) => sum + (val || 0), 0), 0);
  
    // 2. TỐI ƯU CHIA BATCH
    // SỬ DỤNG BIẾN totalQuestions TẠI ĐÂY:
    // Nếu tổng số câu ít (<= 20), gộp làm 1 batch duy nhất.
    // Nếu nhiều hơn, chia mỗi đợt 20 câu để đảm bảo ổn định.
    const BATCH_SIZE = totalQuestions <= 20 ? totalQuestions : 20; 
    
    const taskBatches: QuizConfig[] = [];
    const remainingDist = JSON.parse(JSON.stringify(config.distribution));
  
    const hasRemaining = () => {
        return Object.values(remainingDist).some((type: any) => 
            Object.values(type).some((val: any) => val > 0)
        );
    };

  while (hasRemaining()) {
      const batchDist = {
          TN: { BIET: 0, HIEU: 0, VANDUNG: 0 },
          TLN: { BIET: 0, HIEU: 0, VANDUNG: 0 },
          DS: { BIET: 0, HIEU: 0, VANDUNG: 0 },
      };
      let countInBatch = 0;

      for (const type of ['TN', 'DS', 'TLN'] as const) { 
          for (const level of ['BIET', 'HIEU', 'VANDUNG'] as const) {
              while (remainingDist[type][level] > 0 && countInBatch < BATCH_SIZE) {
                  batchDist[type][level]++;
                  remainingDist[type][level]--;
                  countInBatch++;
              }
          }
      }
      taskBatches.push({ ...config, distribution: batchDist });
  }

  try {
    // GỌI API SONG SONG (Giữ nguyên tính năng cũ)
    const results = await Promise.all(
        taskBatches.map(batchConfig => callGeminiAPI(batchConfig, userApiKey, signal))
    );
    
    const allQuestions = results.flat();

    // 3. LOGIC SẮP XẾP CHUYÊN NGHIỆP (Giữ nguyên tính năng cũ)
    const typePriority: Record<string, number> = {
      'TN': 1, 'DS': 2, 'TLN': 3
    };

    const difficultyPriority: Record<string, number> = {
      'BIET': 1, 'HIEU': 2, 'VANDUNG': 3
    };

    return allQuestions.sort((a, b) => {
      if (typePriority[a.type] !== typePriority[b.type]) {
        return typePriority[a.type] - typePriority[b.type];
      }
      return difficultyPriority[a.difficulty] - difficultyPriority[b.difficulty];
    });

} catch (error: any) {
    if (error.name === 'AbortError') throw error;
    return handleApiError(error);
}
};

async function callGeminiAPI(config: QuizConfig, userApiKey: string, signal?: AbortSignal): Promise<Question[]> {
  const genAI = new GoogleGenerativeAI(userApiKey);
  
  const tn = config.distribution.TN;
  const tln = config.distribution.TLN;
  const ds = config.distribution.DS;
  
  const totalInBatch = (tn.BIET + tn.HIEU + tn.VANDUNG) + 
                       (tln.BIET + tln.HIEU + tln.VANDUNG) + 
                       (ds.BIET + ds.HIEU + ds.VANDUNG);

  if (totalInBatch === 0) return [];

  const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview", 
      generationConfig: {
          responseMimeType: "application/json",
          responseSchema: { type: SchemaType.ARRAY, items: questionSchema },
          temperature: 0.9,  // Sự sáng tạo khác biệt thuộc [0, 1]
          maxOutputTokens: 64000, // Tận dụng tối đa khả năng phản hồi dài
      } 
  });
  // 2. TẠO SALT (Hạt giống ngẫu nhiên):
  const salt = Math.random().toString(36).substring(7);
  // Tạo đoạn nhắc nhở né tránh câu cũ nếu có
  const exclusionInstruction = config.excludeQuestions && config.excludeQuestions.length > 0
  ? `\nTUYỆT ĐỐI KHÔNG lặp lại hoặc tạo câu hỏi tương tự các nội dung sau:\n${config.excludeQuestions.join('\n')}`
  : "";
  // const timestamp = Date.now();

    const prompt = `
Bạn là Chuyên Gia Giáo Dục. [Mã phiên bản ngẫu nhiên: ${salt}]
      Tạo ${totalInBatch} câu hỏi cho chủ đề: "${config.topic}".
      ${exclusionInstruction}
Yêu cầu bổ sung: "${config.additionalPrompt || "Không có"}"
      
      PHÂN BỔ CẤP ĐỘ TRONG ĐỢT NÀY:
      - Trắc nghiệm: ${tn.BIET} Biết, ${tn.HIEU} Hiểu, ${tn.VANDUNG} Vận dụng
      - Điền số: ${tln.BIET} Biết, ${tln.HIEU} Hiểu, ${tln.VANDUNG} Vận dụng
      - Đúng/Sai: ${ds.BIET} Biết, ${ds.HIEU} Hiểu, ${ds.VANDUNG} Vận dụng
      QUY TẮC HIỂN THỊ (TUYỆT ĐỐI TUÂN THỦ):

      RULE 1. NỘI DUNG CÂU HỎI (questionText):
        - CHỈ chứa đề bài text và công thức LaTeX ($...$).
        - KHÔNG được mô tả hình ảnh bằng lời (Ví dụ SAI: "Hình vẽ bên là...").
        - Nếu đề bài dùng hình ảnh (Đồ thị/BBT/Hình không gian), hãy viết: "Cho hàm số có đồ thị/bảng biến thiên như hình bên." hoặc "Cho hình chóp...".
        - Đối với câu hỏi Hàm số: Nếu ĐÃ cung cấp dữ liệu hình ảnh (graphFunction hoặc variationTableData) thì trong text KHÔNG viết lại công thức hàm số tường minh nữa để tránh lộ đáp án.
        - Câu Vận Dụng: Phải khó hơn, lắt léo hơn câu Biết/Hiểu. Chủ yếu là bài toán ứng dụng thực tế - tuỳ bối cảnh.
        - PHÂN SỐ: Bắt buộc dùng LaTeX '\dfrac{a}{b}' (Ví dụ: $\dfrac{1}{2}$) thay vì viết '1/2'.
        - Ký hiệu giới hạn thì viết: '\displaystyle\lim\limits', kí hiệu nguyên hàm/tích phân thì viết '\displaystyle\int'.
        - TUYỆT ĐỐI KHÔNG viết lời mô tả hình ảnh vào đây (Ví dụ SAI: "(Hình vẽ mô tả một đồ thị...)").
        - Nếu đề bài cần hình, hãy nói "Cho đồ thị như hình bên." và dùng các trường bên dưới để vẽ.
        - 'explanation': Lời giải ngắn gọn. BẮT BUỘC dùng ký tự '\\n' để ngắt dòng giữa các bước tính toán/lập luận.
        - Trong lời giải có câu chốt cuối cùng: Vậy đáp án là ... (nội dung của đáp án - không viết tiền tố A/B/C/D).
        - TUYỆT ĐỐI KHÔNG được tự viết code bảng biến thiên (như \\begin{array} hay <table>) vào đây. 
         - Nếu đề có bảng biến thiên, chỉ cần ghi "Cho bảng biến thiên như hình bên:" rồi để code tự vẽ.
         - Nếu có biểu đồ thì chuyển thành bảng.

      RULE 2: NGUYÊN TẮC ĐÁP ÁN TRẮC NGHIỆM (TN) - CỰC KỲ QUAN TRỌNG:
    - AI BẮT BUỘC phải đặt nội dung đáp án ĐÚNG vào phương án ĐẦU TIÊN (vị trí A) trong mảng 'options'.
    - Ba phương án còn lại (B, C, D) phải là các phương án NHIỄU (SAI).
    - Trường 'correctAnswer' BẮT BUỘC phải luôn trả về giá trị là "A".
    - Điều này áp dụng cho cả việc trích xuất từ ảnh (EXACT) và tạo mới (SIMILAR).
    - Khi trích xuất từ ảnh, nếu đáp án đúng trong ảnh là C, bạn vẫn phải đưa nội dung đó lên vị trí A trong mảng 'options' và set 'correctAnswer' = "A".

        - Xử lý lỗi thường gặp về đẳng thức vectơ:
            + Nếu $\\vec{MA} + \\vec{MB} = \\vec{0}$ là đúng 
            + THÌ:  $\\vec{AM} + \\vec{BM} = \\vec{0}$ cũng đúng.
            + TUYỆT ĐỐI KHÔNG đưa cả hai đẳng thức đều đúng vào câu hỏi tìm đáp án đúng.
            + Các phương án nhiễu phải là các phương án sai hẳn.
            + Tương tự cho các tình huống khác.

        - ĐẶC BIỆT VỚI CÂU HỎI PHỦ ĐỊNH (Tìm câu SAI, khẳng định KHÔNG ĐÚNG): 
            + 'correctAnswer' PHẢI là chữ cái của phương án chứa nội dung sai đó.
            + Ví dụ: Nếu đề hỏi "Mệnh đề nào sai?" và mệnh đề ở phương án C sai về toán học, thì 'correctAnswer' BẮT BUỘC phải là "C".
            
      RULE 3. QUY TẮC CÂU ĐÚNG/SAI (DS):
      - BẮT BUỘC trả về mảng 'statements' gồm 4 phát biểu (a, b, c, d).
      - Mỗi phát biểu có 'content' và 'isCorrect' (true/false).
      - KHÔNG được để trống 'statements'.  

      RULE 4. QUY TẮC CÂU ĐIỀN ĐÁP SỐ (TLN): Câu hỏi phải có câu trả lời là 1 số nguyên hoặc số thập phân, nếu là số thập phân vô hạn thì thêm chú thích yêu cầu làm tròn đến chữ số thập phân thứ hai.

      RULE 5 (Bổ sung): > - TUYỆT ĐỐI KHÔNG được trả về trường graphFunction là chuỗi rỗng "" hay bất kỳ giá trị nào nếu không có công thức hàm số cụ thể.
        - Nếu không cần vẽ đồ thị, trường graphFunction BẮT BUỘC phải là null.
        - Bất kỳ sự xuất hiện của hệ trục tọa độ mà không có đường biểu diễn hàm số nào đều bị coi là lỗi nghiêm trọng.

      RULE 6. TỐI ƯU HÓA DỮ LIỆU:
      - Nếu một câu hỏi có thể giải bằng văn bản mà không cần hình minh họa, hãy ưu tiên chỉ dùng văn bản để tiết kiệm tài nguyên hệ thống.
      
      RULE 7. HÌNH HỌC KHÔNG GIAN (Oxyz) (BẮT BUỘC TUÂN THỦ ĐỂ CÓ NÉT ĐỨT)::
         - BẮT BUỘC dùng trường 'geometryGraph' (Nodes & Edges).  
            
        a. HÌNH CHÓP S.ABCD (Đáy là hình bình hành/chữ nhật):
          - Đỉnh khuất là A (góc trong cùng).
          - Các cạnh xuất phát từ A phải là nét đứt ('DASHED'): AB, AD, SA.
          - Các cạnh còn lại là nét liền ('SOLID').
          - Tọa độ mẫu: A(0,0,0), B(4,0,0), C(6,2,0), D(2,2,0), S(3,1,5).

        b. HÌNH CHÓP S.ABC (Đáy là tam giác):         
          - Chỉ cạnh AC là nét đứt ('DASHED').
          - Các cạnh còn lại là nét liền ('SOLID').
          - Tọa độ mẫu: A(0,0,0), B(3,0,0), C(0,7,0), S(3,1,4).

        c. HÌNH HỘP CHỮ NHẬT ABCD.A'B'C'D':
          - Đỉnh khuất là A (góc trong cùng dưới đáy).
          - Các cạnh xuất phát từ A phải là nét đứt ('DASHED'): AB, AD, AA'.
          - Các cạnh còn lại là nét liền ('SOLID').
          - Tọa độ mẫu: A(0,0,0), B(4,0,0), C(4,3,0), D(0,3,0), A'(0,0,4)...

        d. HÌNH LĂNG TRỤ TAM GIÁC ABC.A'B'C':
          - Cạnh khuất thường là cạnh đáy bên trong (ví dụ AC) hoặc cạnh bên khuất.
          - Hãy suy luận logic để set 'style': 'DASHED' cho đúng cạnh bị che.

      RULE 8. HÌNH PHẲNG (2D) - Tam giác, Hình bình hành, Hình thang...:
          - BẮT BUỘC Đặt tất cả tọa độ Z = 0.
          - SỬ DỤNG HỆ TRỤC TỌA ĐỘ OXY CHUẨN:
            + Trục hoành là x, Trục tung là y.
            + Để vẽ góc vuông chuẩn, hãy đặt các cạnh song song với trục tọa độ.
            + Ví dụ Tam giác ABC vuông tại A: A(0,0,0), B(0,4,0), C(3,0,0). (Vuông tại gốc tọa độ).
            + Ví dụ Hình chữ nhật: (0,0,0), (4,0,0), (4,2,0), (0,2,0).
          - TẤT CẢ CÁC CẠNH PHẢI LÀ 'SOLID'.
          
      RULE 9. QUY TẮC ĐỒ THỊ HÀM SỐ (QUAN TRỌNG):
              - Nếu câu hỏi yêu cầu nhìn đồ thị để tìm cực trị, đồng biến/nghịch biến...:
              - BẮT BUỘC trả về trường 'graphFunction'.
              - CÚ PHÁP PHẢI LÀ JAVASCRIPT THUẦN (Không dùng LaTeX):
                  + SAI: x^3 - 3x, sin(x), \frac{1}{x}
                  + ĐÚNG: x*x*x - 3*x, Math.sin(x), 1/x, (x+1)/(x-2)
              - Ví dụ hàm bậc 3: "x*x*x - 3*x + 1"
              - Ví dụ hàm phân thức: "(2*x + 1)/(x - 1)"
            - Nếu đồ thị có tiệm cận, BẮT BUỘC trả về mảng 'asymptotes'.
            - Cú pháp tiệm cận:
                + Tiệm cận ngang y = 1 -> Viết: "y=1"
                + Tiệm cận đứng x = 2 -> Viết: "x=2"
                + Tiệm cận xiên y = 2x - 1 -> Viết: "y=2*x-1" (Nhớ có dấu * nhân)
            - Ví dụ đầy đủ: 
              {
                "graphFunction": "(2*x + 1)/(x - 1)",
                "asymptotes": ["x=1", "y=2"]
              }


      RULE 10. QUY TẮC BẢNG BIẾN THIÊN (VariationTable):
        - Nếu câu hỏi là "Cho bảng biến thiên như hình bên", BẮT BUỘC phải sinh dữ liệu 'variationTableData'.
        - Cấu trúc CHUẨN KỸ THUẬT:
            + xNodes: ["$-\\infty$", "x1", "x2", "$+\\infty$"] (Luôn bắt đầu và kết thúc bằng vô cực nếu là hàm đa thức/phân thức)
            + yPrimeSigns: ["+", "-", "+"] (Số lượng ít hơn xNodes 1 đơn vị)
            + yPrimeVals: Tại các điểm cực trị (nghiệm của y'), trường yPrimeVals BẮT BUỘC phải là '0'. Tại các điểm hàm số không xác định, yPrimeVals BẮT BUỘC là '||'.
            + yNodes: Phải khớp logic với dấu của y'.
              * QUAN TRỌNG VỚI TIỆM CẬN ĐỨNG: Tại vị trí x mà hàm số không xác định (có dấu || ở y' và y), giá trị yNodes BẮT BUỘC phải viết cả giới hạn trái và phải ngăn cách bởi '||'.
              * VÍ DỤ ĐÚNG: "$+\\infty$||$-\\infty$" (Tuyệt đối KHÔNG được viết thiếu như "$+\\infty$||" hay chỉ "$+\\infty$").
              * Nếu y' là "+" -> yNodes tăng. Nếu y' là "-" -> yNodes giảm.
        - MẸO: Hãy tự kiểm tra logic: "Dương đi lên, Âm đi xuống".

      RULE 11. NGUYÊN TẮC PHÂN LOẠI DỮ LIỆU (QUAN TRỌNG - SỬA ĐỔI):
        
        A. NẾU LÀ CÂU HỎI HÌNH HỌC (Oxyz, Hình không gian, Hình phẳng):
           - BẮT BUỘC trả về 'geometryGraph' để vẽ hình.
           - KHÔNG trả về 'variationTableData' hay 'graphFunction'.

        B. NẾU LÀ CÂU HỎI GIẢI TÍCH / HÀM SỐ:
           - Bắt buộc chọn DUY NHẤT 1 trong 3 hình thức hiển thị sau (Không được trộn lẫn):
           
           Option 1: CHO BẰNG CÔNG THỨC (Đại số)
             - Chỉ cung cấp text và công thức trong 'questionText'.
             - Để null các trường: 'graphFunction', 'variationTableData', 'geometryGraph'.
             
           Option 2: CHO BẰNG ĐỒ THỊ
             - Trả về 'graphFunction' (và 'asymptotes' nếu có).
             - Để null các trường: 'variationTableData', 'geometryGraph'.
             - Trong 'questionText' phải ghi: "Cho đồ thị hàm số y=f(x) như hình bên."
             
           Option 3: CHO BẰNG BẢNG BIẾN THIÊN
             - Trả về 'variationTableData'.
             - Để null các trường: 'graphFunction', 'geometryGraph'.
             - Trong 'questionText' phải ghi: "Cho bảng biến thiên như hình bên."

        RULE 12. QUY TẮC ĐÁP ÁN TỌA ĐỘ/VECTƠ:
          - Tuyệt đối KHÔNG đưa tọa độ (x;y;z) hoặc biểu thức chứa biến vào trường 'correctAnswer' của loại 'TLN'.
          - Nếu đáp án là tọa độ hoặc biểu thức, BẮT BUỘC phải dùng loại 'TN'.
          - Các phương án trắc nghiệm (options) chứa tọa độ phải đặt trong LaTeX: "$\vec{a} = (1; 2; 3)$" hoặc "$M(1; -2; 0)$".


        Trả về đúng định dạng JSON mảng ${totalInBatch} câu hỏi.
    `;

    try {
      const result = await retryOperation(async () => {
          return await model.generateContent(prompt, { signal });
      });

      const responseText = result.response.text();
      const jsonStart = responseText.indexOf('[');
      const jsonEnd = responseText.lastIndexOf(']') + 1;
      const cleanJson = responseText.substring(jsonStart, jsonEnd);
      
      const rawQuestions: Question[] = JSON.parse(cleanJson);
      // Giữ nguyên tính năng trộn đáp án
      return rawQuestions.map(q => shuffleQuestion(q)); 
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.warn("Yêu cầu đã bị hủy bởi người dùng hoặc hệ thống.");
        throw e; 
      }
      return handleApiError(e); 
    }
}
    

  // --- BỔ SUNG: HELPER CHUYỂN FILE ẢNH SANG BASE64 ---
  const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string, mimeType: string } }> => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });

    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
  };

  // --- BỔ SUNG: HÀM TẠO ĐỀ TỪ ẢNH ---
  export const generateQuizFromImages = async (
    imageFiles: File[],
    mode: 'EXACT' | 'SIMILAR',
    userApiKey: string,
    additionalPrompt: string = "",
    signal?: AbortSignal // Tham số optional để ở cuối cùng
  ): Promise<Question[]> => {
  
    if (!userApiKey) throw new Error("Vui lòng nhập API Key!");
    if (imageFiles.length === 0) throw new Error("Vui lòng chọn ít nhất 1 ảnh!");
    if (imageFiles.length > 4) throw new Error("Tối đa chỉ được chọn 4 ảnh!");
  
    const genAI = new GoogleGenerativeAI(userApiKey);
  
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: { type: SchemaType.ARRAY, items: questionSchema },
        temperature: mode === 'EXACT' ? 0.1 : 0.4,
        maxOutputTokens: 64000,
      } 
    });
  
    // 1. Chuẩn bị dữ liệu hình ảnh
    const imageParts = await Promise.all(imageFiles.map(fileToGenerativePart));
    
      // 2. Chuẩn bị Prompt (Chỉ đạo AI)
      let taskDescription = "";
      if (mode === 'EXACT') {
        taskDescription = `
          NHIỆM VỤ: 
          1. Đếm chính xác tổng số câu hỏi có trong các ảnh.
          2. Trích xuất và giải chi tiết TẤT CẢ các câu hỏi đó.
          3. Nếu ảnh là lý thuyết và không có câu hỏi, hãy tự tạo số lượng câu hỏi tương ứng theo yêu cầu của người dùng.
          4. GIẢI TOÁN NGẮN GỌN: Tự giải bài toán trước khi đưa ra đáp án. 
          5. QUY ƯỚC ĐẦU RA: Đáp án ĐÚNG luôn ở vị trí đầu tiên (A). 'correctAnswer' luôn là "A".
          6. CHUẨN LATEX ĐÁP ÁN: Tất cả các con số, tọa độ, vectơ, phân số trong phần 'options' BẮT BUỘC phải nằm trong dấu $. Ví dụ: "$I\left(-\frac{7}{2}; \frac{15}{2}; -34\right)$". Không được để text thuần nếu có ký hiệu toán.
        `;
      } else {
        taskDescription = `
          NHIỆM VỤ: 
          1. Đếm chính xác tổng số câu hỏi có trong các ảnh. 
          2. Tạo câu hỏi MỚI tương tự về kiến thức và độ khó như trong ảnh.
          3. THAY ĐỔI SỐ LIỆU: Giữ nguyên dạng bài nhưng thay đổi con số, tên gọi và bối cảnh.
          4. GIẢI TOÁN NGẮN GỌN: Tự giải bài toán trước khi đưa ra đáp án. 
          5. QUY ƯỚC ĐẦU RA: Luôn đặt đáp án ĐÚNG vào vị trí đầu tiên (A). 'correctAnswer' luôn là "A".
          6. CHUẨN LATEX ĐÁP ÁN: Tất cả các con số, tọa độ, vectơ, phân số trong phần 'options' BẮT BUỘC phải nằm trong dấu $. Ví dụ: "$I\left(-\frac{7}{2}; \frac{15}{2}; -34\right)$". Không được để text thuần nếu có ký hiệu toán.
        `;
      }
    
      const prompt = `
      Bạn là chuyên gia Toán học và OCR (nhận diện chữ viết) hàng đầu.
      ${taskDescription}
      Yêu cầu bổ sung/Số lượng câu từ người dùng: "${additionalPrompt}"
    
      QUY TRÌNH XỬ LÝ (BẮT BUỘC):
      1. QUÉT TOÀN BỘ ẢNH: Đếm chính xác tổng số câu hỏi xuất hiện trong (các) ảnh được cung cấp.
      2. KHÔNG ĐƯỢC BỎ SÓT: Phải chuyển đổi TẤT CẢ các câu hỏi đã đếm được sang định dạng JSON.
      3. KIỂM TRA ĐẦU RA: Đảm bảo số lượng phần tử trong mảng JSON trả về bằng đúng số lượng câu hỏi có trong ảnh.

      QUY TẮC ĐẾM & TẠO:
      - Nếu trong "Yêu cầu bổ sung" người dùng có nhập số lượng (VD: "Tạo 5 câu", "Lấy 10 câu"), hãy ưu tiên thực hiện đúng số lượng đó.
      - Nếu không có yêu cầu số lượng cụ thể, hãy bám sát số câu thực tế trong ảnh.
    
      QUY TẮC HIỂN THỊ BẮT BUỘC:
      - QUY TẮC "ĐÚNG TẠI A": Trong mảng 'options', phần tử đầu tiên (index 0) là nội dung ĐÚNG. 
      - MÔI TRƯỜNG TOÁN HỌC: Tất cả các chữ số, tọa độ, biểu thức, phân số PHẢI được bao bọc bởi dấu $. Ví dụ: $x=2$, $A(1;2;3)$.
      - PHÂN SỐ: Luôn dùng $\\frac{a}{b}$ hoặc $\\dfrac{a}{b}$.
      - TỌA ĐỘ: Dùng dấu chấm phẩy ";" để ngăn cách (ví dụ: $(1; 2; 3)$).
      - LOẠI CÂU HỎI: Tự động phân loại 'type' là 'TN' (Trắc nghiệm), 'TLN' (Điền số) hoặc 'DS' (Đúng/Sai) dựa trên nội dung ảnh. 
      - LƯU Ý: Nếu câu hỏi là câu tự luận thì chỉ viết 'type' 'TLN' khi đáp số là một số (số thực hoặc số nguyên) đơn lẻ duy nhất, ngược lại thì chuyển về 'type' 'TN' (trắc nghiệm) và tự bổ sung thêm 3 phương án nhiễu hợp lý.
      - Trường 'graphFunction' PHẢI là cú pháp Javascript (Dùng *, /, Math.pow). TUYỆT ĐỐI KHÔNG DÙNG LaTeX trong trường này.

      TRẢ VỀ JSON ARRAY CHỨA ĐỦ SỐ LƯỢNG CÂU HỎI.
    `;      
      // 3. Gửi yêu cầu (Bọc trong try-catch và dùng retryOperation)
  try {
    const result = await retryOperation(async () => {
      // Truyền [prompt, ...imageParts] và object chứa signal
      return await model.generateContent([prompt, ...imageParts], { signal });
    });

    const responseText = result.response.text();

    // Bước 1: Chuyển văn bản từ AI thành mảng đối tượng Question
    let rawQuestions: Question[] = [];
    try {
        // Loại bỏ các ký tự không phải JSON ở đầu/cuối (phòng trường hợp AI trả về text kèm markdown)
        const jsonStart = responseText.indexOf('[');
        const jsonEnd = responseText.lastIndexOf(']') + 1;
        const cleanJson = responseText.substring(jsonStart, jsonEnd);
        
        rawQuestions = JSON.parse(cleanJson);
      } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        // GỌI HÀM NÀY ĐỂ XÓA CẢNH BÁO VÀ BÁO LỖI CHUẨN
        return handleApiError(error);
      }
    // Bước 2: Trộn đáp án và trả về
    return rawQuestions.map(q => shuffleQuestion(q));

  } catch (error: any) {
    // Xử lý khi người dùng chủ động hủy request
    if (error.name === 'AbortError') {
      console.log("User cancelled the request.");
      throw error;
    }

    console.error("Gemini Vision Error:", error);
    if (error.message?.includes("image")) {
      throw new Error("Lỗi xử lý ảnh. Vui lòng kiểm tra lại định dạng hoặc dung lượng ảnh.");
    }
    throw error;
  }
};
// Thêm hàm sinh lý thuyết
export const generateTheory = async (topic: string, userApiKey: string, signal?: AbortSignal): Promise<string> => {
  if (!userApiKey) throw new Error("Vui lòng nhập API Key!");
  
  const genAI = new GoogleGenerativeAI(userApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const prompt = `
    Bạn là giáo viên Phổ thông giỏi. Hãy tóm tắt LÝ THUYẾT TRỌNG TÂM cho chủ đề: "${topic}".
    Yêu cầu:
    1. Ngắn gọn, súc tích, tập trung vào công thức, định nghĩa, tính chất quan trọng nhất.
    2. Trình bày bằng Markdown.
    3. Các công thức toán học BẮT BUỘC dùng LaTeX kẹp trong dấu $. Ví dụ: $\\int_{a}^{b} f(x) dx$.
    4. Chia mục rõ ràng (I. Định nghĩa, II. Công thức...).
  `;


  try {
    // Sửa lỗi: Chỉ gọi 1 lần, dùng đúng biến prompt và truyền signal
    const result = await model.generateContent(prompt, { signal });
    
    return result.response.text();
  } catch (error: any) {
    // Xử lý trường hợp người dùng hủy request
    if (error.name === 'AbortError') {
      console.log("Hủy tải lý thuyết bởi người dùng.");
      throw error; // Hoặc trả về chuỗi rỗng tùy logic của bạn
    }

    console.error("Lỗi lấy lý thuyết:", error);
    return "Không thể tải lý thuyết lúc này. Vui lòng thử lại.";
  }
};

// Hàm trộn mảng Fisher-Yates
export const shuffleQuestion = (question: Question): Question => {
  if (question.type !== 'TN' || !question.options || question.options.length < 2) {
    return question;
  }

  // Lấy ra nội dung đáp án đúng (đang ở vị trí A - index 0 theo quy ước mới)
  const correctContent = question.options[0];
  
  // Trộn mảng options
  const shuffledOptions = [...question.options];
  for (let i = shuffledOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
  }

  // Tìm vị trí mới của nội dung đáp án đúng
  const newCorrectIndex = shuffledOptions.indexOf(correctContent);
  const newCorrectLetter = String.fromCharCode(65 + newCorrectIndex); // 0->A, 1->B...

  return {
    ...question,
    options: shuffledOptions,
    correctAnswer: newCorrectLetter // Cập nhật lại chữ cái đúng mới (A, B, C hoặc D)
  };
};
