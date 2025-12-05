import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { QuizConfig, Question } from "./types";

// const apiKey = import.meta.env.VITE_API_KEY as string;
// const genAI = new GoogleGenerativeAI(apiKey || "");

// --- SCHEMA CHUẨN ---

const variationTableSchema = {
    type: SchemaType.OBJECT,
    properties: {
        xNodes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Mốc x (LaTeX)" },
        yPrimeSigns: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Dấu y'" },
        yPrimeVals: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Giá trị tại dòng y' (0, ||)" },
        yNodes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Giá trị y (LaTeX)" }
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
      
      1. NỘI DUNG CÂU HỎI (questionText):
        - CHỈ chứa đề bài text và công thức LaTeX ($...$).
        - Câu Vận Dụng: Phải khó hơn, lắt léo hơn câu Biết/Hiểu. Chủ yếu là bài toán ứng dụng thực tế - tuỳ bối cảnh.
        - PHÂN SỐ: Bắt buộc dùng LaTeX '\dfrac{a}{b}' (Ví dụ: $\dfrac{1}{2}$) thay vì viết '1/2'.
        - TUYỆT ĐỐI KHÔNG viết lời mô tả hình ảnh vào đây (Ví dụ SAI: "(Hình vẽ mô tả một đồ thị...)").
        - Nếu đề bài cần hình, hãy nói "Cho đồ thị như hình bên." và dùng các trường bên dưới để vẽ.
        - 'explanation': Lời giải chi tiết. BẮT BUỘC dùng ký tự '\\n' để ngắt dòng giữa các bước tính toán/lập luận.
        - Trong lời giải có câu chốt cuối cùng: Vậy đáp án đúng là ...
        - TUYỆT ĐỐI KHÔNG được tự viết code bảng biến thiên (như \\begin{array} hay <table>) vào đây. 
         - Nếu đề có bảng biến thiên, chỉ cần ghi "Cho bảng biến thiên như hình bên:" rồi để code tự vẽ.

      2. QUY TẮC CÂU ĐÚNG/SAI (DS):
      - BẮT BUỘC trả về mảng 'statements' gồm 4 phát biểu (a, b, c, d).
      - Mỗi phát biểu có 'content' và 'isCorrect' (true/false).
      - KHÔNG được để trống 'statements'.  

      3. QUY TẮC CÂU ĐIỀN ĐÁP SỐ (TLN): Câu hỏi phải có câu trả lời là 1 số nguyên hoặc số thập phân, nếu là số thập phân vô hạn thì thêm chú thích yêu cầu làm tròn đến chữ số thập phân thứ hai.

      4. ĐỒ THỊ HÀM SỐ (Giải tích):
         - BẮT BUỘC dùng trường 'graphFunction'.
         - Điền công thức JS chuẩn: "x**3 - 3*x + 1".

      5. DỮ LIỆU BẢNG BIẾN THIÊN ('variationTableData'):
        5.1. Với MỌI câu hỏi cần bảng biến thiên (dù hàm số bậc 3, phân thức, lượng giác…), BẮT BUỘC phải điền đầy đủ trường:
          "variationTableData": {
            "xNodes": ["$-\\infty$", "-2", "0", "1", "$+\\infty$"],  // ví dụ
            "yPrimeSigns": ["+", "-", "+"],
            "yPrimeVals": ["", "0", "", "0", ""],
            "yNodes": ["$+\\infty$", "5", "1", "3", "$-\\infty$"]
          }

        5.2. TUYỆT ĐỐI KHÔNG được viết bất kỳ đoạn LaTeX nào của bảng biến thiên (\\begin{array}, \\hline, v.v.) vào questionText hoặc explanation.
          Chỉ được viết đúng 1 câu duy nhất trong questionText:
          "Cho bảng biến thiên như hình bên."

        5.3. Nếu có tiệm cận đứng (x = k), thì:
          - yPrimeVals tại cột đó: "||"
          - yNodes tại cột đó: "$+\\infty$||$-\\infty$" hoặc ngược lại

        5.4. Với hàm bậc ba chuẩn (dẫn xuất bậc 2): luôn có 5 cột x, 3 dấu y', 2 điểm cực trị ghi "0" ở yPrimeVals.
        5.5. Với hàm bậc bốn chuẩn (dẫn xuất bậc 3): luôn có 6 cột x, 4 dấu y', 3 điểm cực trị ghi "0" ở yPrimeVals.

        5.6. Với hàm phân thức hữu tỉ có tiệm cận đứng và tiệm cận ngang: luôn có ít nhất 5–6 cột, có "||" ở đúng vị trí.

      6. HÌNH HỌC KHÔNG GIAN (Oxyz) (BẮT BUỘC TUÂN THỦ ĐỂ CÓ NÉT ĐỨT)::
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

      7. HÌNH PHẲNG (2D) - Tam giác, Hình bình hành, Hình vuông...:
          - TUYỆT ĐỐI Đặt tất cả tọa độ Z = 0.
          - TẤT CẢ CÁC CẠNH PHẢI LÀ 'SOLID' (Nét liền). KHÔNG ĐƯỢC dùng 'DASHED' cho hình phẳng 2D.
          - Vẽ đúng với số đo góc, vuông chuẩn vuông.
          - Đúng tỉ lệ độ dài các đoạn thẳng.
          
      8. NGUYÊN TẮC ĐỘC NHẤT DỮ LIỆU (QUAN TRỌNG):
         Đối với mỗi câu hỏi về hàm số, CHỈ ĐƯỢC CHỌN 1 trong 3 dạng dữ liệu sau (Không được để dư thừa):
         
         - DẠNG 1: CHO CÔNG THỨC (Algebraic):
           + Nội dung câu hỏi chứa công thức hàm số cụ thể (Ví dụ: "$y = x^3 - 3x + 1$").
           + Yêu cầu: variationTableData = null, geometryGraph = null.
           
         - DẠNG 2: CHO BẢNG BIẾN THIÊN (Tabular):
           + Nội dung câu hỏi chỉ ghi: "Cho hàm số $y=f(x)$ có bảng biến thiên như hình bên:" (Tuyệt đối KHÔNG viết công thức hàm số cụ thể trong lời dẫn).
           + Yêu cầu: variationTableData = { ...có dữ liệu... }, geometryGraph = null.
           
         - DẠNG 3: CHO ĐỒ THỊ (Graphical):
           + Nội dung câu hỏi chỉ ghi: "Cho hàm số $y=f(x)$ có đồ thị như hình bên:" (Tuyệt đối KHÔNG viết công thức hàm số cụ thể trong lời dẫn).
           + Yêu cầu: geometryGraph = { ...có dữ liệu... }, variationTableData = null.

      Trả về JSON mảng ${totalQuestions} câu.
    `;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};