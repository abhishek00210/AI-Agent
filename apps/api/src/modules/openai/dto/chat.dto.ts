import { IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class SendChatMessageDto {
  @IsUUID()
  agentId!: string;

  @IsUUID()
  conversationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  message!: string;
}
