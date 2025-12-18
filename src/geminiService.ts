import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { QuizConfig, Question } from "./types";

// const apiKey = import.meta.env.VITE_API_KEY as string;
// const genAI = new GoogleGenerativeAI(apiKey || "");
// Thêm đoạn này vào đầu file geminiService.ts, sau các dòng import

// Hàm thử lại (Retry) khi gặp lỗi quá tải
async function retryOperation<T>(
  operation: () => Promise<T>, 
  retries: number = 3, 
  delay: number = 5000
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
      }
  },
  // ----------------------------------------------------
    
    variationTableData: { ...variationTableSchema, nullable: true },
    graphFunction: { type: SchemaType.STRING },
    // --- THÊM DÒNG NÀY ---
    asymptotes: { 
      type: SchemaType.ARRAY, 
      items: { type: SchemaType.STRING }, 
      description: "Mảng chứa các đường tiệm cận. Ví dụ: ['x=2', 'y=1', 'y = 2*x + 1]" 
  },
  // ---------------------
    geometryGraph: { ...geometryGraphSchema, nullable: true },
    plotlyData: { ...plotlyDataSchema, nullable: true }
  },
  required: ['id', 'type', 'questionText', 'explanation']
};

// Thêm tham số userApiKey
export const generateQuiz = async (config: QuizConfig, userApiKey: string): Promise<Question[]> => {
  if (!userApiKey) throw new Error("Vui lòng nhập API Key!");

  // Khởi tạo GenAI với key người dùng nhập (thay vì key mặc định)
  const genAI = new GoogleGenerativeAI(userApiKey);

  const tnCount = (config.distribution.TN.BIET || 0) + (config.distribution.TN.HIEU || 0) + (config.distribution.TN.VANDUNG || 0);
  const tlnCount = (config.distribution.TLN.BIET || 0) + (config.distribution.TLN.HIEU || 0) + (config.distribution.TLN.VANDUNG || 0);
  const dsCount = (config.distribution.DS.BIET || 0) + (config.distribution.DS.HIEU || 0) + (config.distribution.DS.VANDUNG || 0);
  const totalQuestions = tnCount + tlnCount + dsCount;

  if (totalQuestions === 0) throw new Error("Nhập số lượng câu hỏi!");

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: { type: SchemaType.ARRAY, items: questionSchema },
        temperature: 0.3,
        // TĂNG LÊN MỨC CAO ĐỂ TRÁNH BỊ CẮT CỤT JSON
        maxOutputTokens: 20000,
      }
    });

    const prompt = `
      Bạn là Chuyên Gia Giáo Dục. Tạo ${totalQuestions} câu hỏi:
      1. CHỦ ĐỀ: "${config.topic}"
      2. BỔ SUNG: "${config.additionalPrompt || "Không có"}"
      
      3. PHÂN PHỐI CHI TIẾT (BẮT BUỘC TUÂN THỦ CẤP ĐỘ):
         - Trắc nghiệm (${tnCount} câu):
            + Mức Biết: ${config.distribution.TN.BIET || 0} câu
            + Mức Hiểu: ${config.distribution.TN.HIEU || 0} câu
            + Mức Vận dụng: ${config.distribution.TN.VANDUNG || 0} câu
         
         - Điền số (${tlnCount} câu):
            + Mức Biết: ${config.distribution.TLN.BIET || 0} câu
            + Mức Hiểu: ${config.distribution.TLN.HIEU || 0} câu
            + Mức Vận dụng: ${config.distribution.TLN.VANDUNG || 0} câu
            
         - Đúng/Sai (${dsCount} câu):
            + Mức Biết: ${config.distribution.DS.BIET || 0} câu
            + Mức Hiểu: ${config.distribution.DS.HIEU || 0} câu
            + Mức Vận dụng: ${config.distribution.DS.VANDUNG || 0} câu

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
        - 'explanation': Lời giải chi tiết. BẮT BUỘC dùng ký tự '\\n' để ngắt dòng giữa các bước tính toán/lập luận.
        - Trong lời giải có câu chốt cuối cùng: Vậy đáp án đúng là ...
        - TUYỆT ĐỐI KHÔNG được tự viết code bảng biến thiên (như \\begin{array} hay <table>) vào đây. 
         - Nếu đề có bảng biến thiên, chỉ cần ghi "Cho bảng biến thiên như hình bên:" rồi để code tự vẽ.

      RULE 2: NGUYÊN TẮC ĐÁP ÁN ĐÚNG DUY NHẤT (QUAN TRỌNG NHẤT)
        - Với câu hỏi Trắc nghiệm (TN), trong 4 phương án A, B, C, D:
        - CHỈ ĐƯỢC PHÉP CÓ 1 PHƯƠNG ÁN ĐÚNG. 3 phương án còn lại PHẢI LÀ SAI (Phương án nhiễu).
        - Xử lý lỗi thường gặp về tính Đơn điệu (Đồng biến/Nghịch biến):
            + Nếu hàm số đồng biến trên cả 2 khoảng $(-\\infty; -1)$ và $(1; +\\infty)$.
            + THÌ: Chỉ được đưa 1 trong 2 khoảng đó vào đáp án đúng (Ví dụ chọn A là $(1; +\\infty)$).
            + TUYỆT ĐỐI KHÔNG đưa khoảng đúng còn lại (là $(-\\infty; -1)$) vào các phương án B, C, D.
            + Các phương án nhiễu phải là các khoảng nghịch biến hoặc khoảng sai hẳn.

        - Xử lý lỗi thường gặp về đẳng thức vectơ:
            + Nếu $\\vec{MA} + \\vec{MB} = \\vec{0}$ là đúng 
            + THÌ:  $\\vec{AM} + \\vec{BM} = \\vec{0}$ hay $\\vec{AM} = \\vec{MB}$ cũng đúng.
            + TUYỆT ĐỐI KHÔNG đưa cả hai đẳng thức đều đúng vào câu hỏi tìm đáp án đúng.
            + Các phương án nhiễu phải là các phương án sai hẳn.
            + Tương tự cho các tình huống khác.
            
      RULE 3. QUY TẮC CÂU ĐÚNG/SAI (DS):
      - BẮT BUỘC trả về mảng 'statements' gồm 4 phát biểu (a, b, c, d).
      - Mỗi phát biểu có 'content' và 'isCorrect' (true/false).
      - KHÔNG được để trống 'statements'.  

      RULE 4. QUY TẮC CÂU ĐIỀN ĐÁP SỐ (TLN): Câu hỏi phải có câu trả lời là 1 số nguyên hoặc số thập phân, nếu là số thập phân vô hạn thì thêm chú thích yêu cầu làm tròn đến chữ số thập phân thứ hai.

      RULE 5. HÌNH HỌC KHÔNG GIAN (Oxyz) (BẮT BUỘC TUÂN THỦ ĐỂ CÓ NÉT ĐỨT)::
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

      RULE 6. HÌNH PHẲNG (2D) - Tam giác, Hình bình hành, Hình thang...:
          - BẮT BUỘC Đặt tất cả tọa độ Z = 0.
          - SỬ DỤNG HỆ TRỤC TỌA ĐỘ OXY CHUẨN:
            + Trục hoành là x, Trục tung là y.
            + Để vẽ góc vuông chuẩn, hãy đặt các cạnh song song với trục tọa độ.
            + Ví dụ Tam giác ABC vuông tại A: A(0,0,0), B(0,4,0), C(3,0,0). (Vuông tại gốc tọa độ).
            + Ví dụ Hình chữ nhật: (0,0,0), (4,0,0), (4,2,0), (0,2,0).
          - TẤT CẢ CÁC CẠNH PHẢI LÀ 'SOLID'.
          
      RULE 7. QUY TẮC ĐỒ THỊ HÀM SỐ (QUAN TRỌNG):
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


      RULE 8. QUY TẮC BẢNG BIẾN THIÊN (VariationTable):
        - Nếu câu hỏi là "Cho bảng biến thiên như hình bên", BẮT BUỘC phải sinh dữ liệu 'variationTableData'.
        - Cấu trúc CHUẨN KỸ THUẬT:
            + xNodes: ["$-\\infty$", "x1", "x2", "$+\\infty$"] (Luôn bắt đầu và kết thúc bằng vô cực nếu là hàm đa thức/phân thức)
            + yPrimeSigns: ["+", "-", "+"] (Số lượng ít hơn xNodes 1 đơn vị)
            + yPrimeVals: Tại vị trí nghiệm ghi "0", tại vị trí không xác định ghi "||".
            + yNodes: Phải khớp logic với dấu của y'.
              * QUAN TRỌNG VỚI TIỆM CẬN ĐỨNG: Tại vị trí x mà hàm số không xác định (có dấu || ở y' và y), giá trị yNodes BẮT BUỘC phải viết cả giới hạn trái và phải ngăn cách bởi '||'.
              * VÍ DỤ ĐÚNG: "$+\\infty$||$-\\infty$" (Tuyệt đối KHÔNG được viết thiếu như "$+\\infty$||" hay chỉ "$+\\infty$").
              * Nếu y' là "+" -> yNodes tăng. Nếu y' là "-" -> yNodes giảm.
        - MẸO: Hãy tự kiểm tra logic: "Dương đi lên, Âm đi xuống".

      RULE 9. NGUYÊN TẮC PHÂN LOẠI DỮ LIỆU (QUAN TRỌNG - SỬA ĐỔI):
        
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

         Trả về JSON mảng ${totalQuestions} câu.
    `;

    // Mới: Bọc trong retryOperation
    const result = await retryOperation(async () => {
      return await model.generateContent(prompt);
    });
    return JSON.parse(result.response.text());
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

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
      mode: 'EXACT' | 'SIMILAR', // EXACT: Giống hệt, SIMILAR: Tương tự
      userApiKey: string,
      additionalPrompt: string = ""
    ): Promise<Question[]> => {
      if (!userApiKey) throw new Error("Vui lòng nhập API Key!");
      if (imageFiles.length === 0) throw new Error("Vui lòng chọn ít nhất 1 ảnh!");
      if (imageFiles.length > 4) throw new Error("Tối đa chỉ được chọn 4 ảnh!");
    
      const genAI = new GoogleGenerativeAI(userApiKey);
    
      // Sử dụng model gemini-2.5-flash (hoặc pro) để hỗ trợ tốt hình ảnh
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash", // Flash nhanh và rẻ hơn cho vision
        generationConfig: {
          responseMimeType: "application/json",
          // Tái sử dụng schema đã định nghĩa ở trên
          responseSchema: { type: SchemaType.ARRAY, items: questionSchema },
          temperature: mode === 'EXACT' ? 0.1 : 0.4, // EXACT cần chính xác (temp thấp), SIMILAR cần sáng tạo (temp cao hơn)
          maxOutputTokens: 20000,
        }
      });
    
      // 1. Chuẩn bị dữ liệu hình ảnh
      const imageParts = await Promise.all(imageFiles.map(fileToGenerativePart));
    
      // 2. Chuẩn bị Prompt (Chỉ đạo AI)
      let taskDescription = "";
      if (mode === 'EXACT') {
        taskDescription = `
          NHIỆM VỤ: Trích xuất và giải TẤT CẢ các câu hỏi toán học (hay môn học bất kỳ) có trong các hình ảnh được cung cấp.
          YÊU CẦU ĐẶC BIỆT:
          1. GIỮ NGUYÊN văn phong, số liệu, và các phương án lựa chọn (nếu là trắc nghiệm) HỆT NHƯ trong ảnh. Không được tự ý thay đổi đề bài.
          2. Nếu ảnh mờ hoặc cắt không hết, hãy cố gắng suy luận nội dung chính xác nhất có thể.
          3. Cung cấp lời giải chi tiết (explanation) cho từng câu.
        `;
      } else {
        taskDescription = `
          NHIỆM VỤ: Phân tích các dạng toán và mức độ kiến thức trong các hình ảnh. Sau đó, TẠO RA các câu hỏi MỚI tương tự.
          YÊU CẦU ĐẶC BIỆT:
          1. KHÔNG chép lại đề bài cũ. Hãy thay đổi số liệu, ngữ cảnh, nhưng giữ nguyên dạng bài và độ khó.
          2. Tạo ra số lượng câu hỏi tương đương với số câu hỏi phát hiện được trong ảnh.
          3. Cung cấp lời giải chi tiết (explanation) cho các câu hỏi mới này.
        `;
      }
    
      const prompt = `
        Bạn là một trợ lý AI chuyên về Toán học và OCR (Nhận dạng quang học).
        ${taskDescription}
        Bổ sung yêu cầu từ người dùng: "${additionalPrompt}"

        QUAN TRỌNG:
        - Output BẮT BUỘC phải là JSON Array theo schema đã định nghĩa.
        - Tuân thủ nghiêm ngặt các RULE 1 đến RULE 9 về định dạng LaTeX, đồ thị, bảng biến thiên đã được quy định trước đó trong hệ thống này.
        - Nếu là câu trắc nghiệm (TN) trong ảnh, hãy trích xuất đủ các options A, B, C, D và xác định correctAnswer.
        - Nếu là tự luận, hãy chuyển về dạng TN (Chọn 1 trong 4 đáp án) nếu có thể, hoặc TLN (Điền số) nếu đáp án là 1 số thực duy nhất.
      `;
    
      // 3. Gửi yêu cầu (Prompt text + Image parts)
      try {
        // Mới:
        const result = await retryOperation(async () => {
          return await model.generateContent([prompt, ...imageParts]);
        });
        const responseText = result.response.text();
        return JSON.parse(responseText);
      } catch (error: any) {
          console.error("Gemini Vision Error:", error);
          // Bắt lỗi cụ thể liên quan đến ảnh (ví dụ: ảnh quá lớn, định dạng không hỗ trợ)
          if (error.message?.includes("image")) {
              throw new Error("Lỗi xử lý ảnh. Vui lòng kiểm tra lại định dạng hoặc dung lượng ảnh.");
          }
        throw error;
      }
    };
// Thêm hàm sinh lý thuyết
export const generateTheory = async (topic: string, userApiKey: string): Promise<string> => {
  if (!userApiKey) throw new Error("Vui lòng nhập API Key!");
  const genAI = new GoogleGenerativeAI(userApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    Bạn là giáo viên Phổ thông giỏi. Hãy tóm tắt LÝ THUYẾT TRỌNG TÂM cho chủ đề: "${topic}".
    Yêu cầu:
    1. Ngắn gọn, súc tích, tập trung vào công thức, định nghĩa, tính chất quan trọng nhất.
    2. Trình bày bằng Markdown.
    3. Các công thức toán học BẮT BUỘC dùng LaTeX kẹp trong dấu $. Ví dụ: $\\int_{a}^{b} f(x) dx$.
    4. Chia mục rõ ràng (I. Định nghĩa, II. Công thức...).
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Lỗi lấy lý thuyết:", error);
    return "Không thể tải lý thuyết lúc này. Vui lòng thử lại.";
  }
};