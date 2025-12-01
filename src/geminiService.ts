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
    questionText: { type: SchemaType.STRING, description: "Nội dung câu hỏi (LaTeX $). KHÔNG HTML. Trừ bảng thống kê." },
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
        maxOutputTokens: 15000,
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

      QUY TẮC:
      - 'questionText': Nội dung câu hỏi (LaTeX $).    
      - Câu Vận Dụng: Phải khó hơn, lắt léo hơn câu Biết/Hiểu. Chủ yếu là bài toán ứng dụng thực tế - tuỳ bối cảnh.
      
      QUY TẮC CÂU ĐÚNG/SAI (DS):
      - BẮT BUỘC trả về mảng 'statements' gồm 4 phát biểu (a, b, c, d).
      - Mỗi phát biểu có 'content' và 'isCorrect' (true/false).
      - KHÔNG được để trống 'statements'.

      QUY TẮC CÂU ĐIỀN ĐÁP SỐ (TLN): Câu hỏi phải có câu trả lời là 1 số nguyên hoặc số thập phân, nếu là số thập phân vô hạn thì thêm chú thích yêu cầu làm tròn đến chữ số thập phân thứ hai.

      QUY TẮC VẼ HÌNH KHÔNG GIAN (BẮT BUỘC TUÂN THỦ ĐỂ CÓ NÉT ĐỨT):
      
      1. HÌNH CHÓP S.ABCD (Đáy là hình bình hành/chữ nhật):
         - Đỉnh khuất là A (góc trong cùng).
         - Các cạnh xuất phát từ A phải là nét đứt ('DASHED'): AB, AD, SA.
         - Các cạnh còn lại là nét liền ('SOLID').
         - Tọa độ mẫu: A(0,0,0), B(4,0,0), C(6,2,0), D(2,2,0), S(3,1,5).

      2. HÌNH CHÓP S.ABC (Đáy là tam giác):         
         - Chỉ cạnh AC là nét đứt ('DASHED').
         - Các cạnh còn lại là nét liền ('SOLID').
         - Tọa độ mẫu: A(0,0,0), B(3,0,0), C(0,7,0), S(3,1,5).

      3. HÌNH HỘP CHỮ NHẬT ABCD.A'B'C'D':
         - Đỉnh khuất là A (góc trong cùng dưới đáy).
         - Các cạnh xuất phát từ A phải là nét đứt ('DASHED'): AB, AD, AA'.
         - Các cạnh còn lại là nét liền ('SOLID').
         - Tọa độ mẫu: A(0,0,0), B(4,0,0), C(4,3,0), D(0,3,0), A'(0,0,4)...

      4. HÌNH LĂNG TRỤ TAM GIÁC ABC.A'B'C':
         - Cạnh khuất thường là cạnh đáy bên trong (ví dụ AC) hoặc cạnh bên khuất.
         - Hãy suy luận logic để set 'style': 'DASHED' cho đúng cạnh bị che.

     HÌNH PHẲNG (2D) - Tam giác, Hình bình hành, Hình vuông...:
       - TUYỆT ĐỐI Đặt tất cả tọa độ Z = 0.
       - TẤT CẢ CÁC CẠNH PHẢI LÀ 'SOLID' (Nét liền).
       - KHÔNG ĐƯỢC dùng 'DASHED' cho hình phẳng 2D.

      QUY TẮC CHUNG:
      - 'questionText': Nội dung câu hỏi (LaTeX $).
      - Đồ thị hàm số: Dùng 'graphFunction'.
      - Bảng biến thiên: Dùng 'variationTableData'.
      - 'explanation': Lời giải chi tiết. BẮT BUỘC dùng ký tự '\\n' để ngắt dòng giữa các bước tính toán/lập luận.
      - Trong lời giải có câu chốt cuối cùng: Vậy đáp án đúng là ...

      Trả về JSON mảng ${totalQuestions} câu.
    `;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};