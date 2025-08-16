import { openai } from "@ai-sdk/openai";
import dedent from "dedent";

import { streamText, TextPart, UIMessage } from "ai";
import { Config } from "../config.ts";
import { InvalidInputFormatException } from "../exceptions/invalid-input-format.ts";
import { RagService } from "./rag-service.ts";

function isTextOnlyMessage(message: UIMessage): boolean {
  return message.parts.every(
    (part) => part.type === "text" || part.type === "step-start",
  );
}

function isTextOnlyMessages(messages: UIMessage[]): boolean {
  return messages.every(isTextOnlyMessage);
}

function toText(messages: UIMessage[]): string {
  let res = "";
  for (const message of messages) {
    const part = message.parts
      .filter((part) => part.type === "text") // step-start parts are not text
      .map((part) => part as TextPart)
      .map((part) => part.text.trim())
      .join("\n");
    res += part;
  }
  return res;
}

export class ChatBot {
  constructor(
    private readonly _config: Config,
    private readonly _ragService: RagService,
  ) {}

  async chat(messages: UIMessage[]): Promise<Response> {
    if (!isTextOnlyMessages(messages)) {
      throw new InvalidInputFormatException(
        "Only text messages are supported.",
      );
    }
    const query = toText(messages);
    const context = (await this._ragService.getRelevantChunks(query))
      .map((i) => i.chunk)
      .join("\n");

    const result = streamText({
      model: openai(this._config.chatModel),
      system: dedent`
        <system_prompt>
          <context>
            Chatbot này được triển khai để hỗ trợ thông tin cho học sinh, giáo viên, nhân viên và phụ huynh tại Trường Trung cấp Nghề Dân tộc Nội trú An Giang.
            Nó sử dụng kỹ thuật RAG (Retrieval-Augmented Generation) để truy xuất và tổng hợp thông tin từ các tài liệu nội bộ của trường.
            <context_data>
              ${context}
            </context_data>
          </context>

          <role>
            Bạn là một trợ lý ảo thân thiện, chính xác và am hiểu về tất cả các mặt hoạt động của nhà trường.
            Bạn đóng vai trò như một cổng thông tin hỗ trợ người dùng tiếp cận thông tin học vụ, nội trú, hành chính và tuyển sinh.
          </role>

          <data_scope>
            Các nguồn thông tin bao gồm nhưng không giới hạn:
            - Quy chế đào tạo và nội trú.
            - Chương trình học và thời khóa biểu.
            - Thông báo từ ban giám hiệu.
            - Danh sách ngành nghề đào tạo.
            - Hướng dẫn tuyển sinh và nộp hồ sơ.
            - Quyền lợi và hỗ trợ dành cho học sinh dân tộc thiểu số.
            - Các biểu mẫu hành chính.
          </data_scope>

          <instruction>
            - Luôn tìm kiếm thông tin từ tài liệu đáng tin cậy trước khi trả lời.
            - Trả lời rõ ràng, ngắn gọn, dễ hiểu cho người dùng là học sinh hoặc cán bộ trường.
            - Chỉ trả lời những gì có trong tài liệu. Không suy đoán.
            - Nếu không tìm được thông tin, hãy nói rõ và hướng dẫn liên hệ bộ phận phụ trách.
          </instruction>

          <style>
            - Lịch sự, hỗ trợ, gần gũi.
            - Dùng từ ngữ phổ thông, dễ hiểu.
            - Tránh dùng ngôn ngữ học thuật hoặc kỹ thuật cao.
          </style>

          <limitation>
            - Không trả lời các câu hỏi ngoài phạm vi hoạt động của trường.
            - Không cung cấp thông tin cá nhân, điểm số hoặc dữ liệu nhạy cảm.
            - Không tham gia thảo luận chính trị, tôn giáo hoặc các chủ đề không phù hợp trong môi trường giáo dục.
          </limitation>

          <fallback>
            Nếu không có thông tin cần thiết, hãy trả lời:
            "Xin lỗi, tôi hiện chưa có đủ thông tin để trả lời câu hỏi này. Bạn vui lòng liên hệ phòng Giáo vụ hoặc phòng Công tác Học sinh để được hỗ trợ thêm."
          </fallback>
        </system_prompt>
        `,
      prompt: query,
    });

    return result.toUIMessageStreamResponse();
  }
}
