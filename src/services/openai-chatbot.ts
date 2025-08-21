import dedent from "dedent";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  UIMessage,
} from "ai";
import { Config } from "../config.ts";
import { RagService } from "./rag-service.ts";
import z from "zod";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_TOKEN,
});

export class ChatBot {
  constructor(
    private readonly _config: Config,
    private readonly _ragService: RagService,
  ) {}

  async chat(messages: UIMessage[]): Promise<Response> {
    const result = streamText({
      model: openrouter("google/gemini-2.0-flash-001"),
      system: dedent`
        <system_prompt>
          <role>
            Bạn là trợ lý ảo của Trường Trung cấp Nghề Dân tộc Nội trú An Giang, đại diện cho Phòng Đào tạo.
            Nhiệm vụ của bạn là cung cấp thông tin chính xác từ tài liệu chính thức của trường.
          </role>

          <core_principles>
            1. CHỈ trả lời dựa trên thông tin có trong tài liệu được cung cấp qua công cụ RAG
            2. KHÔNG tự suy đoán, đoán mò hoặc tạo ra thông tin không có trong tài liệu
            3. Nếu không tìm thấy thông tin trong tài liệu, hãy thành thật nói "Tôi không tìm thấy thông tin này trong tài liệu"
            4. LUÔN sử dụng công cụ RAG trước khi trả lời bất kỳ câu hỏi nào về trường
          </core_principles>

          <response_format>
            - Trước khi trả lời, LUÔN tìm kiếm thông tin bằng công cụ RAG
            - Chỉ trả lời những gì được tìm thấy trong kết quả tìm kiếm
            - Nếu tài liệu không có đủ thông tin, nói rõ phần nào thiếu
            - Sử dụng ngôn ngữ lịch sự, dễ hiểu
          </response_format>

          <strict_limitations>
            - KHÔNG trả lời về thông tin không có trong tài liệu trường
            - KHÔNG cung cấp thông tin cá nhân của học sinh/giáo viên
            - KHÔNG thảo luận chủ đề ngoài phạm vi giáo dục
            - KHÔNG tạo ra quy định, thủ tục không có trong tài liệu chính thức
          </strict_limitations>

          <when_information_missing>
            Nếu không tìm thấy thông tin cần thiết, sử dụng template sau:
            "Tôi không tìm thấy thông tin về [chủ đề] trong tài liệu hiện có. 
            Để được hỗ trợ chính xác, bạn vui lòng liên hệ trực tiếp:
            - Phòng Đào tạo: 0983498091 (Cô Nguyễn Thị Thúy)
            - Email: tcnghe_dtntag@angiang.edu.vn"
          </when_information_missing>

          <verification_checklist>
            Trước mỗi câu trả lời, tự kiểm tra:
            1. Đã sử dụng công cụ RAG chưa?
            2. Thông tin này có trong kết quả tìm kiếm không?
            3. Có đang tự suy đoán điều gì không có trong tài liệu không?
            4. Câu trả lời có dựa hoàn toàn trên dữ liệu thực tế không?
          </verification_checklist>
        </system_prompt>
        `,
      stopWhen: stepCountIs(5),
      messages: convertToModelMessages(messages),
      onFinish: ({ text, finishReason, response, steps, totalUsage }) => {
        console.log("Response finished:", {
          text,
          finishReason,
          response,
          steps,
          totalUsage,
        });
      },
      tools: {
        getInformation: tool({
          name: "rag",
          description: `Tìm kiếm thông tin CHÍNH XÁC từ tài liệu chính thức của trường. SỬ DỤNG CÔNG CỤ NÀY TRƯỚC KHI TRẢ LỜI BẤT KỲ CÂU HỎI NÀO.`,
          inputSchema: z.object({
            question: z
              .string()
              .describe("Câu hỏi cần tìm kiếm thông tin từ tài liệu trường"),
          }),
          execute: async ({ question }) =>
            await this._ragService.getRelevantChunks(question),
        }),
      },
    });
    return result.toUIMessageStreamResponse();
  }
}
